#!/usr/bin/env python3
"""Build the app-icon source PNG from the brand mark.

Composites the transparent brand mark (`assets/brand/aster-mark.png`) onto a
near-black rounded tile and writes a 1024x1024 PNG that `tauri icon` consumes.

    python3 scripts/make-icon.py

Pure stdlib (zlib + struct): no Pillow/ImageMagick required.
"""

import struct
import sys
import zlib

CANVAS = 1024
TILE = (0x0B, 0x12, 0x20)  # --color-tile (#0B1220)
CORNER_RADIUS = 0.22 * CANVAS
MARK_BOX = 700  # scaled mark canvas (px), centred on the tile


# --- PNG decode ------------------------------------------------------------
def decode_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    i = 8
    idat = b""
    width = height = depth = color = None
    while i < len(data):
        length = struct.unpack(">I", data[i : i + 4])[0]
        tag = data[i + 4 : i + 8]
        chunk = data[i + 8 : i + 8 + length]
        i += 12 + length
        if tag == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(
                ">IIBBBBB", chunk
            )
            assert interlace == 0, "interlaced PNG not supported"
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break
    assert depth == 8 and color == 6, "expected 8-bit RGBA"

    raw = zlib.decompress(idat)
    channels = 4
    stride = width * channels
    out = bytearray()
    prev = bytearray(stride)
    pos = 0

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return a if pa <= pb and pa <= pc else (b if pb <= pc else c)

    for _ in range(height):
        filt = raw[pos]
        pos += 1
        line = bytearray(raw[pos : pos + stride])
        pos += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif filt == 4:
                line[x] = (line[x] + paeth(a, b, c)) & 255
        out += line
        prev = line
    return width, height, out


def sample(src, sw, x, y):
    o = (y * sw + x) * 4
    return src[o], src[o + 1], src[o + 2], src[o + 3]


def bilinear(src, sw, sh, fx, fy):
    x0 = min(sw - 1, max(0, int(fx)))
    y0 = min(sh - 1, max(0, int(fy)))
    x1 = min(sw - 1, x0 + 1)
    y1 = min(sh - 1, y0 + 1)
    dx = fx - x0
    dy = fy - y0
    out = []
    for ch in range(4):
        v00 = src[(y0 * sw + x0) * 4 + ch]
        v10 = src[(y0 * sw + x1) * 4 + ch]
        v01 = src[(y1 * sw + x0) * 4 + ch]
        v11 = src[(y1 * sw + x1) * 4 + ch]
        top = v00 + (v10 - v00) * dx
        bot = v01 + (v11 - v01) * dx
        out.append(int(round(top + (bot - top) * dy)))
    return out


# --- PNG encode ------------------------------------------------------------
def write_png(path, width, height, rgba):
    raw = b"".join(
        b"\x00" + rgba[y * width * 4 : (y + 1) * width * 4] for y in range(height)
    )

    def chunk(tag, payload):
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    open(path, "wb").write(png)


def tile_alpha(x, y):
    """Coverage of the rounded tile."""
    half = CANVAS / 2
    dx, dy = abs(x + 0.5 - half), abs(y + 0.5 - half)
    inner = half - CORNER_RADIUS
    qx, qy = max(dx - inner, 0.0), max(dy - inner, 0.0)
    import math

    dist = math.hypot(qx, qy)
    return max(0.0, min(1.0, CORNER_RADIUS - dist + 0.5))


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else "assets/brand/aster-mark.png"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "assets/icon-source.png"

    sw, sh, src = decode_png(src_path)
    scale = MARK_BOX / max(sw, sh)
    offset = (CANVAS - MARK_BOX) / 2
    mark_w, mark_h = int(sw * scale), int(sh * scale)
    offset_x = (CANVAS - mark_w) / 2
    offset_y = (CANVAS - mark_h) / 2

    out = bytearray(CANVAS * CANVAS * 4)
    for y in range(CANVAS):
        for x in range(CANVAS):
            ta = tile_alpha(x, y)
            # tile background
            r, g, b = TILE
            a = ta
            # mark overlay
            mx, my = x - offset_x, y - offset_y
            if 0 <= mx < mark_w and 0 <= my < mark_h:
                sx = mx / scale
                sy = my / scale
                sr, sg, sb, sa = bilinear(src, sw, sh, sx, sy)
                saf = sa / 255.0
                if saf > 0:
                    out_a = saf + (a / 255.0) * (1 - saf)
                    if out_a > 0:
                        r = (sr * saf + r * (a / 255.0) * (1 - saf)) / out_a
                        g = (sg * saf + g * (a / 255.0) * (1 - saf)) / out_a
                        b = (sb * saf + b * (a / 255.0) * (1 - saf)) / out_a
                    a = out_a * 255
            o = (y * CANVAS + x) * 4
            out[o] = int(round(r))
            out[o + 1] = int(round(g))
            out[o + 2] = int(round(b))
            out[o + 3] = int(round(a))

    write_png(out_path, CANVAS, CANVAS, out)
    print(f"wrote {out_path} ({CANVAS}x{CANVAS}) from {src_path} ({sw}x{sh})")


if __name__ == "__main__":
    main()
