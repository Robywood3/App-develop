"""Genera le icone delle app (icon.png 80x80, largeIcon.png 130x130). Richiede Pillow."""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def draw_icon(size):
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = s // 5
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=(17, 24, 38, 255))
    # Corpo della telecamera
    cx, cy = s // 2, int(s * 0.47)
    body = int(s * 0.30)
    d.ellipse([cx - body, cy - body, cx + body, cy + body], fill=(240, 244, 250, 255))
    lens = int(s * 0.18)
    d.ellipse([cx - lens, cy - lens, cx + lens, cy + lens], fill=(17, 24, 38, 255))
    inner = int(s * 0.10)
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(255, 90, 54, 255))
    glint = int(s * 0.035)
    gx, gy = cx - int(s * 0.05), cy - int(s * 0.05)
    d.ellipse([gx - glint, gy - glint, gx + glint, gy + glint], fill=(255, 255, 255, 220))
    # Base / supporto
    bw, bh = int(s * 0.34), int(s * 0.07)
    by = int(s * 0.83)
    d.rounded_rectangle([cx - bw // 2, by - bh // 2, cx + bw // 2, by + bh // 2], radius=bh // 2, fill=(240, 244, 250, 255))
    sw = int(s * 0.07)
    d.rectangle([cx - sw // 2, cy + body - 4, cx + sw // 2, by], fill=(240, 244, 250, 255))
    # Punto "live"
    led = int(s * 0.045)
    lx, ly = int(s * 0.80), int(s * 0.20)
    d.ellipse([lx - led, ly - led, lx + led, ly + led], fill=(61, 220, 132, 255))
    return img.resize((size, size), Image.LANCZOS)


def draw_ha_icon(size):
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = s // 5
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=(17, 24, 38, 255))
    blue = (3, 169, 244, 255)
    white = (240, 244, 250, 255)
    # Casa: tetto e corpo
    cx = s // 2
    top, eave, bottom = int(s * 0.16), int(s * 0.46), int(s * 0.84)
    half_roof, half_body = int(s * 0.36), int(s * 0.27)
    d.polygon([(cx, top), (cx + half_roof, eave), (cx - half_roof, eave)], fill=blue)
    d.rectangle([cx - half_body, eave - 2, cx + half_body, bottom], fill=blue)
    # Circuito stilizzato (come nel logo di Home Assistant)
    w = max(2, int(s * 0.035))
    node = int(s * 0.045)
    base_y, mid_y, low_y = bottom, int(s * 0.47), int(s * 0.60)
    left = (cx - int(s * 0.12), int(s * 0.53))
    right = (cx + int(s * 0.12), int(s * 0.43))
    center = (cx, mid_y - int(s * 0.04))
    d.line([(cx, base_y), (cx, center[1])], fill=white, width=w)
    d.line([(cx, low_y + int(s * 0.06)), left], fill=white, width=w)
    d.line([(cx, low_y), right], fill=white, width=w)
    for x, y in (left, right, center):
        d.ellipse([x - node, y - node, x + node, y + node], outline=white, width=w, fill=blue)
    return img.resize((size, size), Image.LANCZOS)


APPS = (('app', draw_icon), ('ha-app', draw_ha_icon))


def main():
    for folder, draw in APPS:
        for name, size in (('icon.png', 80), ('largeIcon.png', 130)):
            path = os.path.join(ROOT, folder, name)
            draw(size).save(path)
            print('scritto', os.path.normpath(path))


if __name__ == '__main__':
    sys.exit(main())
