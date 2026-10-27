"""Genera le icone dell'app (icon.png 80x80, largeIcon.png 130x130). Richiede Pillow."""
import os
import sys

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')


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


def main():
    for name, size in (('icon.png', 80), ('largeIcon.png', 130)):
        path = os.path.join(OUT, name)
        draw_icon(size).save(path)
        print('scritto', os.path.normpath(path))


if __name__ == '__main__':
    sys.exit(main())
