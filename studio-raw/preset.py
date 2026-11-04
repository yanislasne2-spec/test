"""Lecture des presets Lightroom / Camera Raw.

Formats acceptés :
- .xmp  : presets Lightroom Classic / CC / Camera Raw (format actuel)
- .lrtemplate : anciens presets Lightroom (avant 2018)
- .dng / .jpg / tout fichier contenant un bloc XMP « crs: » (presets vendus en DNG,
  photo exportée de Lightroom avec ses réglages intégrés…)

Le résultat est un simple dict {nom_du_réglage: valeur}, avec les noms Camera Raw
(Exposure2012, Contrast2012, ToneCurvePV2012, HueAdjustmentRed…).
Les courbes sont des listes de points [(x, y), …] sur 0–255.
"""
import re
import xml.etree.ElementTree as ET
from pathlib import Path

CRS = "http://ns.adobe.com/camera-raw-settings/1.0/"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
CURVE_KEYS = ("ToneCurvePV2012", "ToneCurvePV2012Red", "ToneCurvePV2012Green",
              "ToneCurvePV2012Blue", "ToneCurve")


class PresetError(ValueError):
    pass


def _value(text):
    """'+0.35' → 0.35, 'True' → True, 'As Shot' → 'As Shot'."""
    t = text.strip()
    if t.lower() in ("true", "false"):
        return t.lower() == "true"
    try:
        return float(t)
    except ValueError:
        return t


def _curve(items):
    pts = []
    for it in items:
        nums = re.findall(r"-?\d+(?:\.\d+)?", str(it))
        if len(nums) >= 2:
            pts.append((float(nums[0]), float(nums[1])))
    return pts


def _parse_xmp(xml_text):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise PresetError(f"XMP illisible : {e}") from e
    s = {}
    for el in root.iter():
        for k, v in el.attrib.items():
            if k.startswith("{" + CRS + "}"):
                s[k[len(CRS) + 2:]] = _value(v)
        if el.tag.startswith("{" + CRS + "}"):
            name = el.tag[len(CRS) + 2:]
            lis = [li.text or "" for li in el.iter("{" + RDF + "}li")]
            if lis:
                s[name] = _curve(lis) if name in CURVE_KEYS else lis
            elif el.text and el.text.strip() and len(el) == 0:
                s[name] = _value(el.text)
    for k in CURVE_KEYS:  # une courbe écrite en attribut (rare) : "0, 0, 255, 255"
        if isinstance(s.get(k), str):
            n = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", s[k])]
            s[k] = list(zip(n[::2], n[1::2]))
    return s


def _parse_lrtemplate(text):
    m = re.search(r"settings\s*=\s*\{(.*)\}", text, re.S)
    body = m.group(1) if m else text
    s = {}
    for k, inner in re.findall(r"(\w+)\s*=\s*\{([^{}]*)\}", body):
        if k in CURVE_KEYS:
            n = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", inner)]
            s[k] = list(zip(n[::2], n[1::2]))
    body_flat = re.sub(r"\w+\s*=\s*\{[^{}]*\}", "", body)
    for k, v in re.findall(r"(\w+)\s*=\s*(\"[^\"]*\"|-?[\d.]+|true|false)", body_flat):
        s[k] = v.strip('"') if v.startswith('"') else _value(v)
    return s


def parse_preset(data, filename=""):
    """data : bytes du fichier preset. Renvoie (réglages, nom du preset)."""
    name = Path(filename).stem or "preset"
    text = data.decode("utf-8", errors="ignore")
    if filename.lower().endswith(".lrtemplate") or (
            "s.settings" not in text and re.search(r"^\s*s\s*=\s*\{", text, re.M)):
        settings = _parse_lrtemplate(text)
        m = re.search(r'title\s*=\s*(?:ZSTR\s*)?"([^"]+)"', text)
        if m:
            name = m.group(1)
    else:
        m = re.search(r"<x:xmpmeta.*?</x:xmpmeta>", text, re.S)
        if not m:
            raise PresetError("Aucun réglage Lightroom trouvé dans ce fichier "
                              "(il faut un preset .xmp, .lrtemplate ou un DNG/JPG avec ses réglages).")
        settings = _parse_xmp(m.group(0))
        m = re.search(r'<crs:Name>.*?<rdf:li[^>]*>([^<]+)</rdf:li>', text, re.S)
        if m:
            name = m.group(1).strip()
    if not any(isinstance(v, (int, float, list)) for v in settings.values()):
        raise PresetError("Le preset ne contient aucun réglage reconnu.")
    return settings, name
