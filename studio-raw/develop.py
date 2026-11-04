"""Développement d'une photo (RAW ou JPG/TIFF…) avec les réglages d'un preset Lightroom.

Chaîne de traitement (en flottant 32 bits) :
  RAW → dématriçage LibRaw (linéaire, sRGB, balance des blancs du preset ou de l'appareil)
  → exposition, hautes lumières / ombres (locales), blancs / noirs, contraste
  → courbes de tonalité (paramétrique + points, RVB), présence (texture, clarté, correction du voile)
  → vibrance, saturation, TSL par couleur, noir & blanc, étalonnage couleur / virage partiel
  → vignetage, grain, accentuation → JPG.

C'est une ré-implémentation : le rendu est proche de Lightroom, pas identique au pixel près
(Lightroom utilise les profils Adobe et des algorithmes non publiés).
"""
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

try:
    import rawpy
except ImportError:  # l'appli peut quand même traiter des JPG
    rawpy = None

try:  # photos iPhone
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

RAW_EXT = {".3fr", ".ari", ".arw", ".bay", ".cr2", ".cr3", ".crw", ".dcr", ".dng", ".erf", ".fff",
           ".iiq", ".k25", ".kdc", ".mef", ".mos", ".mrw", ".nef", ".nrw", ".orf", ".pef", ".raf",
           ".raw", ".rw2", ".rwl", ".sr2", ".srf", ".srw", ".x3f"}
IMG_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".heic", ".heif"}
SUPPORTED = RAW_EXT | IMG_EXT

HSL_COLORS = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"]
HSL_CENTERS = np.array([0, 30, 60, 120, 180, 240, 270, 300], dtype=np.float32)

f32 = np.float32


# ---------------------------------------------------------------- outils

def _g(s, key, default=0.0):
    v = s.get(key, default)
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else default


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def luminance(rgb):
    return rgb[..., 0] * f32(0.2126) + rgb[..., 1] * f32(0.7152) + rgb[..., 2] * f32(0.0722)


def srgb_encode(x):
    x = np.clip(x, 0, None)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055).astype(f32)


def srgb_decode(x):
    return np.where(x <= 0.04045, x / 12.92, np.power((x + 0.055) / 1.055, 2.4)).astype(f32)


def _box(a, r, axis):
    if r < 1:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(f32)


def blur(a, sigma):
    """Flou gaussien approché (3 flous boîte), calculé sur une version réduite si le rayon est grand."""
    if sigma < 0.5:
        return a
    h, w = a.shape
    f = max(1.0, sigma / 4)
    small = a
    if f > 1:
        small = np.asarray(Image.fromarray(a, "F").resize((max(1, round(w / f)), max(1, round(h / f))),
                                                           Image.BOX))
    s = sigma / f
    r = max(1, round((math.sqrt(4 * s * s + 1) - 1) / 2))
    for _ in range(3):
        small = _box(_box(small, r, 0), r, 1)
    if f > 1:
        small = np.asarray(Image.fromarray(small, "F").resize((w, h), Image.BILINEAR))
    return small


def resize_rgb(rgb, size):
    w, h = size
    return np.stack([np.asarray(Image.fromarray(np.ascontiguousarray(rgb[..., c]), "F")
                                .resize((w, h), Image.LANCZOS)) for c in range(3)], axis=-1)


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    d = mx - np.minimum(np.minimum(r, g), b)
    s = d / np.maximum(mx, f32(1e-6))
    dd = np.maximum(d, f32(1e-6))
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4))
    h *= f32(60)
    h[d <= 1e-6] = 0
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h6 = (h % 360) * f32(1 / 60)
    vs = v * s
    out = np.empty(h.shape + (3,), f32)
    for i, n in enumerate((5, 3, 1)):
        k = (n + h6) % 6
        out[..., i] = v - vs * np.clip(np.minimum(k, 4 - k), 0, 1)
    return out


def hue_weight(h, i):
    """Poids (0–1) de la teinte h (degrés) pour la bande TSL i ; les poids des 8 bandes font 1."""
    c = HSL_CENTERS[i]
    nxt = HSL_CENTERS[(i + 1) % 8] + (360 if i == 7 else 0)
    prv = HSL_CENTERS[i - 1] - (360 if i == 0 else 0)
    dh = (h - c + 180) % 360 - 180
    return np.where(dh >= 0, np.clip(1 - dh / (nxt - c), 0, 1), np.clip(1 + dh / (c - prv), 0, 1)).astype(f32)


def spline_lut(points, n=1024):
    """Courbe Lightroom (points 0–255) → table 0–1 (spline cubique naturelle, comme Lightroom)."""
    pts = sorted({(float(x), float(y)) for x, y in points})
    if len(pts) < 2:
        return None
    x = np.array([p[0] for p in pts]) / 255
    y = np.array([p[1] for p in pts]) / 255
    if len(pts) == 2 and np.allclose(x, y):
        return None
    grid = np.linspace(0, 1, n)
    if len(pts) == 2:
        out = np.interp(grid, x, y)
    else:
        k = len(x)
        hseg = np.diff(x)
        A = np.zeros((k, k))
        B = np.zeros(k)
        A[0, 0] = A[-1, -1] = 1
        for j in range(1, k - 1):
            A[j, j - 1] = hseg[j - 1]
            A[j, j] = 2 * (hseg[j - 1] + hseg[j])
            A[j, j + 1] = hseg[j]
            B[j] = 3 * ((y[j + 1] - y[j]) / hseg[j] - (y[j] - y[j - 1]) / hseg[j - 1])
        c = np.linalg.solve(A, B)
        j = np.clip(np.searchsorted(x, grid) - 1, 0, k - 2)
        t = grid - x[j]
        b = (y[j + 1] - y[j]) / hseg[j] - hseg[j] * (2 * c[j] + c[j + 1]) / 3
        d = (c[j + 1] - c[j]) / (3 * hseg[j])
        out = y[j] + b * t + c[j] * t ** 2 + d * t ** 3
        out = np.where(grid < x[0], y[0], np.where(grid > x[-1], y[-1], out))
    return np.clip(out, 0, 1).astype(f32)


def apply_lut(a, lut):
    return np.interp(a, np.linspace(0, 1, len(lut)), lut).astype(f32)


# ---------------------------------------------------------------- balance des blancs

def kelvin_tint_to_xy(temp, tint):
    t = min(max(temp, 1700.0), 25000.0)

    def planck(T):
        if T <= 4000:
            x = -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.179910
        else:
            x = -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.240390
        if T <= 2222:
            y = -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683
        elif T <= 4000:
            y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        else:
            y = 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483
        den = -2 * x + 12 * y + 3
        return 4 * x / den, 6 * y / den

    u, v = planck(t)
    u2, v2 = planck(t + 10)
    du, dv = u2 - u, v2 - v
    norm = math.hypot(du, dv) or 1
    nu, nv = -dv / norm, du / norm
    if nv < 0:  # normale orientée vers le vert (au-dessus du lieu de Planck)
        nu, nv = -nu, -nv
    off = -tint / 3000.0  # échelle de teinte du SDK DNG d'Adobe ; teinte + = magenta
    u, v = u + nu * off, v + nv * off
    den = 2 * u - 8 * v + 4
    return 3 * u / den, 2 * v / den


def raw_user_wb(raw, temp, tint):
    m = np.array(raw.rgb_xyz_matrix)[:3]
    if not np.any(m):
        return None
    x, y = kelvin_tint_to_xy(temp, tint)
    xyz = np.array([x / y, 1.0, (1 - x - y) / y])
    cam = m @ xyz
    if np.any(cam <= 0):
        return None
    mul = 1 / cam
    mul = mul / mul[1]
    return [float(mul[0]), 1.0, float(mul[2]), 1.0]


# ---------------------------------------------------------------- lecture

def load_linear(path, s, *, target_long=None, preview=False, keep_camera_wb=False):
    """Renvoie (image linéaire sRGB float32 HxWx3, est_raw)."""
    path = Path(path)
    if path.suffix.lower() in RAW_EXT:
        if rawpy is None:
            raise RuntimeError("rawpy n'est pas installé (pip install rawpy)")
        with rawpy.imread(str(path)) as raw:
            kw = dict(gamma=(1, 1), no_auto_bright=True, output_bps=16,
                      output_color=rawpy.ColorSpace.sRGB,
                      highlight_mode=rawpy.HighlightMode.Blend)
            wb = str(s.get("WhiteBalance", "As Shot"))
            user = None
            if not keep_camera_wb and wb not in ("As Shot", "Auto") and "Temperature" in s:
                user = raw_user_wb(raw, _g(s, "Temperature", 5500), _g(s, "Tint", 0))
            if user:
                kw["user_wb"] = user
            elif wb == "Auto" and not keep_camera_wb:
                kw["use_auto_wb"] = True
            else:
                kw["use_camera_wb"] = True
            longest = max(raw.sizes.width, raw.sizes.height)
            if preview or (target_long and target_long * 1.9 <= longest):
                kw["half_size"] = True  # 4× plus rapide et suffisant pour un export réduit
            nr = _g(s, "LuminanceSmoothing")
            if nr >= 15:
                kw["fbdd_noise_reduction"] = (rawpy.FBDDNoiseReductionMode.Full if nr >= 45
                                              else rawpy.FBDDNoiseReductionMode.Light)
            rgb = raw.postprocess(**kw).astype(f32) / 65535
        return rgb, True
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        rgb = srgb_decode(np.asarray(im, dtype=f32) / 255)
    return rgb, False


# ---------------------------------------------------------------- réglages

def local_tone(lin, s, is_raw):
    """Exposition + hautes lumières / ombres (locales, sur la luminance floutée)."""
    ev = _g(s, "Exposure2012", _g(s, "Exposure")) + (0.35 if is_raw else 0)
    if ev:
        lin *= f32(2 ** ev)
    hl, sh = _g(s, "Highlights2012"), _g(s, "Shadows2012")
    if hl or sh:
        ly = np.log2(np.maximum(luminance(lin), f32(1e-5)))
        sigma = max(lin.shape[:2]) / 50
        base = f32(0.6) * blur(ly, sigma) + f32(0.4) * ly  # mélange local/global : moins de halos
        del ly
        rel = base - f32(math.log2(0.18))
        delta = f32(hl / 100 * 1.3) * smoothstep(f32(0.3), f32(2.6), rel) \
            + f32(sh / 100 * 1.6) * smoothstep(f32(-0.5), f32(-4.5), rel)
        lin *= np.exp2(delta)[..., None]
    np.maximum(lin, 0, out=lin)
    return lin


def tone_curve_1d(x, s, is_raw):
    """Blancs / noirs / contraste + rendu de base, valeur linéaire → valeur sRGB 0–1 (1D)."""
    if is_raw:  # épaule douce : les hautes lumières se compressent au lieu d'être brûlées
        k = 0.78
        x = np.where(x < k, x, k + (1 - k) * (1 - np.exp(-(x - k) / (1 - k))))
    d = srgb_encode(np.minimum(x, 1)).astype(np.float64)
    if is_raw:  # rendu de base type « Adobe Couleur » : légère courbe en S
        d = d + 0.16 * (smoothstep(0, 1, d) - d)
    wh, bl = _g(s, "Whites2012"), _g(s, "Blacks2012")
    if wh:
        d = d + wh / 100 * 0.22 * d ** 3
    if bl:
        d = d + bl / 100 * 0.18 * (1 - np.clip(d, 0, 1)) ** 3
    c = _g(s, "Contrast2012", _g(s, "Contrast"))
    if c:
        d = np.clip(d, 0, 1)
        d = d + c / 100 * 0.7 * (smoothstep(0, 1, d) - d)
    return np.clip(d, 0, 1)


def curve_luts(s):
    """Courbe paramétrique, courbe de points principale, puis courbes R, V, B → 3 fonctions 0–1."""
    x = np.linspace(0, 1, 4096)
    y = x.copy()
    zones = [_g(s, k) for k in ("ParametricShadows", "ParametricDarks", "ParametricLights", "ParametricHighlights")]
    if any(zones):
        s1 = _g(s, "ParametricShadowSplit", 25) / 100
        s2 = _g(s, "ParametricMidtoneSplit", 50) / 100
        s3 = _g(s, "ParametricHighlightSplit", 75) / 100
        bounds = [(0, s1, s2), (0, (s1 + s2) / 2, s3), (s1, (s2 + s3) / 2, 1), (s2, s3 + (1 - s3) / 2, 1)]
        for amt, (lo, mid, hi) in zip(zones, bounds):
            bump = np.where(x < mid, smoothstep(lo, mid, x), 1 - smoothstep(mid, hi, x))
            y = y + amt / 100 * 0.16 * bump
        y = np.clip(np.maximum.accumulate(y), 0, 1)
    master = s.get("ToneCurvePV2012")
    if isinstance(master, list) and (lut := spline_lut(master)) is not None:
        y = apply_lut(y, lut)
    out = []
    for ch in ("Red", "Green", "Blue"):
        pts = s.get("ToneCurvePV2012" + ch)
        lut = spline_lut(pts) if isinstance(pts, list) else None
        out.append(apply_lut(y, lut) if lut is not None else y)
    return x, out


def tone_and_curves(lin, s, is_raw):
    """Toute la partie 1D (par canal) en une seule table de 65 536 entrées par canal."""
    xmax = float(min(max(lin.max(), 1.0), 256.0))
    n = 65536
    grid = (np.linspace(0, 1, n) ** 2) * xmax  # table en racine carrée : précise dans les ombres
    base = tone_curve_1d(grid, s, is_raw)
    cx, cys = curve_luts(s)
    out = np.empty(lin.shape, f32)
    for c in range(3):
        lut = np.interp(base, cx, cys[c]).astype(f32)
        for r0 in range(0, lin.shape[0], 256):
            blk = lin[r0:r0 + 256, :, c]
            idx = (np.sqrt(np.minimum(blk * f32(1 / xmax), 1)) * (n - 1) + 0.5).astype(np.int32)
            out[r0:r0 + 256, :, c] = lut[idx]
    return out


def presence(d, s):
    long = max(d.shape[:2])
    tex, cla, dh = _g(s, "Texture"), _g(s, "Clarity2012", _g(s, "Clarity")), _g(s, "Dehaze")
    if tex or cla:
        L = luminance(d)
        delta = np.zeros_like(L)
        if tex:
            delta += f32(tex / 100 * 0.6) * (L - blur(L, long / 700))
        if cla:
            mid = 0.35 + 0.65 * (4 * L * (1 - L))
            delta += f32(cla / 100 * 0.9) * (L - blur(L, long / 70)) * mid
        d = d + delta[..., None]
    if dh:
        a = dh / 100
        L = luminance(d)[..., None]
        if a > 0:
            haze = f32(0.10 * a)
            d = (d - haze) / (1 - haze)
            d = L + (d - L) * f32(1 + 0.35 * a)
            d = d * (1 + 0.08 * a)  # Lightroom compense un peu l'assombrissement
        else:
            b = -a
            d = d * f32(1 - 0.35 * b) + f32(0.32 * b)
            d = L + (d - L) * f32(1 - 0.4 * b)
    return np.clip(d, 0, 1).astype(f32)


def color(d, s):
    vib, sat = _g(s, "Vibrance"), _g(s, "Saturation")
    hue_adj = [_g(s, "HueAdjustment" + c) for c in HSL_COLORS]
    sat_adj = [_g(s, "SaturationAdjustment" + c) for c in HSL_COLORS]
    lum_adj = [_g(s, "LuminanceAdjustment" + c) for c in HSL_COLORS]
    bw = s.get("ConvertToGrayscale") is True
    gray_mix = [_g(s, "GrayMixer" + c) for c in HSL_COLORS]

    if any(hue_adj) or any(sat_adj) or any(lum_adj) or (bw and any(gray_mix)):
        h, sv, v = rgb_to_hsv(d)
        dh = np.zeros_like(h)
        ds = np.zeros_like(h)
        dl = np.zeros_like(h)
        dg = np.zeros_like(h)
        for i in range(8):
            if not (hue_adj[i] or sat_adj[i] or lum_adj[i] or gray_mix[i]):
                continue
            w = hue_weight(h, i)
            dh += w * f32(hue_adj[i] / 100 * 30)
            ds += w * f32(sat_adj[i] / 100)
            dl += w * f32(lum_adj[i] / 100)
            dg += w * f32(gray_mix[i] / 100)
        if not bw:
            d = hsv_to_rgb(h + dh, np.clip(sv * (1 + ds), 0, 1), v)
            d = d * (1 + 0.55 * dl * sv)[..., None]
        else:
            L = luminance(d) * (1 + 0.8 * dg * sv)
            d = np.repeat(L[..., None], 3, axis=-1)
    elif bw:
        d = np.repeat(luminance(d)[..., None], 3, axis=-1)

    if not bw and (vib or sat):
        L = luminance(d)[..., None]
        _, sv, _ = rgb_to_hsv(np.clip(d, 0, 1))
        factor = 1 + sat / 100
        if vib:
            factor = factor + (vib / 100) * 0.7 * (1 - sv[..., None]) ** 1.5
        d = L + (d - L) * factor
    d = np.clip(d, 0, 1)

    # étalonnage couleur (Lightroom 10+) et virage partiel (anciens presets)
    def tint(hue):
        c = hsv_to_rgb(np.array([hue], f32), np.array([1], f32), np.array([1], f32))[0]
        return c - luminance(c)

    grades = []
    sh_h = _g(s, "ColorGradeShadowHue", _g(s, "SplitToningShadowHue"))
    sh_s = _g(s, "ColorGradeShadowSat", _g(s, "SplitToningShadowSaturation"))
    hi_h = _g(s, "ColorGradeHighlightHue", _g(s, "SplitToningHighlightHue"))
    hi_s = _g(s, "ColorGradeHighlightSat", _g(s, "SplitToningHighlightSaturation"))
    grades.append(("shadow", sh_h, sh_s, _g(s, "ColorGradeShadowLum")))
    grades.append(("mid", _g(s, "ColorGradeMidtoneHue"), _g(s, "ColorGradeMidtoneSat"), _g(s, "ColorGradeMidtoneLum")))
    grades.append(("high", hi_h, hi_s, _g(s, "ColorGradeHighlightLum")))
    grades.append(("global", _g(s, "ColorGradeGlobalHue"), _g(s, "ColorGradeGlobalSat"), _g(s, "ColorGradeGlobalLum")))
    if any(g[2] or g[3] for g in grades):
        L = luminance(d)
        bal = _g(s, "SplitToningBalance", _g(s, "ColorGradeBalance")) / 100
        pivot = 0.5 - 0.3 * bal
        w = 0.12 + 0.4 * _g(s, "ColorGradeBlending", 50) / 100
        masks = {"shadow": 1 - smoothstep(pivot - w, pivot + w, L),
                 "high": smoothstep(pivot - w, pivot + w, L),
                 "mid": np.clip(1 - np.abs(L - 0.5) / (0.25 + w), 0, 1),
                 "global": np.ones_like(L)}
        for zone, hue, sa, lu in grades:
            if not (sa or lu):
                continue
            m = masks[zone][..., None]
            if sa:
                d = d + m * tint(hue) * f32(sa / 100 * 0.3)
            if lu:
                d = d + m * f32(lu / 100 * 0.25)
        d = np.clip(d, 0, 1)
    return d.astype(f32)


def effects(d, s, seed=0):
    h, w = d.shape[:2]
    amt = _g(s, "PostCropVignetteAmount")
    if amt:
        mid = _g(s, "PostCropVignetteMidpoint", 50) / 100
        feather = _g(s, "PostCropVignetteFeather", 50) / 100
        roundness = _g(s, "PostCropVignetteRoundness", 0) / 100
        sh, sw = max(2, h // 8), max(2, w // 8)  # masque très doux : calculé en petit puis agrandi
        ay, ax = np.mgrid[0:sh, 0:sw].astype(f32)
        ax = (ax + 0.5) / sw * 2 - 1
        ay = (ay + 0.5) / sh * 2 - 1
        ar = w / h
        if roundness > 0 and ar > 1:  # vers un cercle
            ax = ax * (1 + (ar - 1) * roundness)
        elif roundness > 0 and ar < 1:
            ay = ay * (1 + (1 / ar - 1) * roundness)
        r = np.sqrt(ax ** 2 + ay ** 2) / f32(math.sqrt(2))
        inner = 0.15 + 0.75 * mid
        mask = smoothstep(f32(inner - 0.05), f32(inner + 0.12 + 0.8 * feather), r).astype(f32)
        mask = np.asarray(Image.fromarray(mask, "F").resize((w, h), Image.BILINEAR))[..., None]
        if amt < 0:
            d *= 1 + f32(amt / 100 * 0.85) * mask
        else:
            d += (1 - d) * (f32(amt / 100 * 0.85) * mask)

    g = _g(s, "GrainAmount")
    if g:
        size = _g(s, "GrainSize", 25) / 100
        rough = _g(s, "GrainFrequency", 50) / 100
        cell = max(1.0, (1 + size * 3) * max(h, w) / 3000)
        rng = np.random.default_rng(seed)
        gh, gw = max(2, round(h / cell)), max(2, round(w / cell))
        n = rng.standard_normal((gh, gw)).astype(f32)
        n = blur(n, 0.6 * (1 - rough)) if rough < 1 else n
        n = n / f32(n.std() * 0.85 + 1e-6)  # ~ écart-type après agrandissement
        n = np.array(Image.fromarray(n, "F").resize((w, h), Image.BICUBIC))
        L = luminance(d)
        n *= f32(g / 100 * 0.09) * (f32(0.3) + f32(2.8) * L * (1 - L))
        d += n[..., None]
    return np.clip(d, 0, 1, out=d)


def incremental_wb(lin, s, is_raw):
    """Température/teinte relatives (presets « pour JPG ») ou en complément sur un JPG."""
    t = _g(s, "IncrementalTemperature")
    ti = _g(s, "IncrementalTint")
    if not is_raw and not (t or ti) and str(s.get("WhiteBalance", "As Shot")) not in ("As Shot", "Auto"):
        # preset RAW appliqué à un JPG : on traduit la température absolue en décalage relatif
        temp = _g(s, "Temperature", 5500)
        t = max(-100, min(100, (temp - 5500) / 50))
        ti = _g(s, "Tint")
    if not (t or ti):
        return lin
    gains = np.array([2 ** (t / 100 * 0.6), 2 ** (-ti / 100 * 0.35), 2 ** (-t / 100 * 0.6)], f32)
    return lin * gains


# ---------------------------------------------------------------- export

def develop(path, settings, *, long_side=None, preview=False, keep_camera_wb=False, seed=0):
    """Développe une photo et renvoie une image PIL (RGB 8 bits)."""
    s = settings
    lin, is_raw = load_linear(path, s, target_long=long_side, preview=preview, keep_camera_wb=keep_camera_wb)
    h, w = lin.shape[:2]
    if long_side and max(h, w) > long_side:
        k = long_side / max(h, w)
        lin = np.clip(resize_rgb(lin, (max(1, round(w * k)), max(1, round(h * k)))), 0, None)
    lin = incremental_wb(lin, s, is_raw)
    lin = local_tone(lin, s, is_raw)
    d = tone_and_curves(lin, s, is_raw)
    del lin
    d = presence(d, s)
    for r0 in range(0, d.shape[0], 384):  # réglages couleur pixel par pixel : par bandes (mémoire)
        d[r0:r0 + 384] = color(d[r0:r0 + 384], s)
    d = effects(d, s, seed=seed)
    im = Image.fromarray((d * 255 + 0.5).astype(np.uint8), "RGB")

    amount = _g(s, "Sharpness", 40 if is_raw else 0)
    if amount > 0:
        radius = min(3.0, max(0.5, _g(s, "SharpenRadius", 1.0) * 0.8))
        threshold = int(_g(s, "SharpenEdgeMasking", 0) / 12)
        im = im.filter(ImageFilter.UnsharpMask(radius=radius, percent=int(amount * 1.6), threshold=threshold))
    return im


def save_jpeg(im, dest, source=None, quality=92):
    im.save(dest, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0 if quality >= 90 else 2)
    # métadonnées (date, appareil, objectif, réglages…) recopiées si exiftool est installé
    if source and shutil.which("exiftool"):
        subprocess.run(["exiftool", "-q", "-q", "-overwrite_original", "-TagsFromFile", str(source),
                        "-all:all", "-unsafe", "-Orientation#=1", "-ThumbnailImage=", "-PreviewImage=",
                        str(dest)], check=False, capture_output=True)
