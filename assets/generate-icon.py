#!/usr/bin/env python3
"""Generate the Aster Vault icon source (1024x1024 PNG) with no dependencies.

The mark is a four-point aster: four restrained separated petals around
protected negative space, in the Aster Vault palette. Pure stdlib (zlib + math).

Usage: python3 assets/generate-icon.py assets/icon-source.png
"""

import math
import struct
import sys
import zlib

SIZE = 1024
BG = (16, 24, 39)  # Midnight #101827
EMERALD = (46, 134, 111)  # #2E866F
EMERALD_LIGHT = (58, 160, 132)
PORCELAIN = (247, 248, 245)


def rounded_rect_coverage(x, y, half, radius):
    """Coverage of a rounded square centred at the image centre."""
    dx = abs(x - SIZE / 2)
    dy = abs(y - SIZE / 2)
    inner = half - radius
    qx = max(dx - inner, 0.0)
    qy = max(dy - inner, 0.0)
    dist = math.hypot(qx, qy)
    # distance from the rounded boundary
    return clamp(radius - dist + 0.5, 0.0, 1.0)


def leaf(x, y, angle_deg):
    """Coverage of one petal pointing outward along `angle_deg`."""
    angle = math.radians(angle_deg)
    dx = x - SIZE / 2
    dy = y - SIZE / 2
    ca = math.cos(-angle)
    sa = math.sin(-angle)
    rx = dx * ca - dy * sa
    ry = dx * sa + dy * ca
    u = (rx - 0.40 * SIZE / 2) / (0.36 * SIZE / 2)
    v = ry / (0.15 * SIZE / 2)
    d = math.sqrt(u * u + v * v)
    return clamp((1.0 - d) * 40.0, 0.0, 1.0)


def clamp(value, low, high):
    return max(low, min(high, value))


def blend(dst, src, alpha):
    return tuple(int(round(dst[i] * (1 - alpha) + src[i] * alpha)) for i in range(3))


def render():
    half = SIZE / 2 - 40
    radius = SIZE * 0.22
    angles = [45, 135, 225, 315]
    colors = [EMERALD_LIGHT, EMERALD, EMERALD, EMERALD_LIGHT]

    rows = []
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            # background
            bg_a = rounded_rect_coverage(x + 0.5, y + 0.5, half, radius)
            color = BG
            alpha = bg_a

            # petals (supersampled 3x3 for smooth edges)
            petal_cov = [0.0, 0.0, 0.0, 0.0]
            for sy in range(3):
                for sx in range(3):
                    px = x + (sx + 0.5) / 3
                    py = y + (sy + 0.5) / 3
                    for i, angle in enumerate(angles):
                        petal_cov[i] += leaf(px, py, angle) / 9
            for i, coverage in enumerate(petal_cov):
                if coverage <= 0:
                    continue
                color = blend(color, colors[i], coverage)
                alpha = clamp(alpha + coverage, 0.0, 1.0)

            # a small porcelain spark in the negative space
            spark = clamp(1.0 - math.hypot(x - SIZE / 2, y - SIZE / 2) / 26.0, 0.0, 1.0)
            if spark > 0:
                color = blend(color, PORCELAIN, spark)
                alpha = clamp(alpha + spark, 0.0, 1.0)

            row += bytes((color[0], color[1], color[2], int(round(alpha * 255))))
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "assets/icon-source.png"
    write_png(out, render())
    print(f"wrote {out}")
