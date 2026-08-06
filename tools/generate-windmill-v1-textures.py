from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(os.environ.get('WINDMILL_TEXTURE_DIR', '/tmp/windmill_v1_textures'))
SIZE = int(os.environ.get('WINDMILL_TEXTURE_SIZE', '1024'))
OUT.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(1502)


def save_rgb(name: str, arr: np.ndarray) -> None:
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr, 'RGB').save(OUT / name, optimize=True)


def save_gray(name: str, arr: np.ndarray) -> None:
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr, 'L').save(OUT / name, optimize=True)


def normal_from_height(height: np.ndarray, strength: float = 2.0) -> np.ndarray:
    h = height.astype(np.float32) / 255.0
    gy, gx = np.gradient(h)
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / length, ny / length, nz / length), axis=-1)
    return ((normal * 0.5 + 0.5) * 255.0).astype(np.uint8)


def fbm(shape: tuple[int, int], octaves: int = 6, seed_scale: int = 10) -> np.ndarray:
    total = np.zeros(shape, dtype=np.float32)
    amp = 1.0
    amp_sum = 0.0
    h, w = shape
    for octave in range(octaves):
        sh = max(4, h // (seed_scale * (2 ** octave)))
        sw = max(4, w // (seed_scale * (2 ** octave)))
        seed = (rng.random((sh, sw)) * 255).astype(np.uint8)
        image = Image.fromarray(seed, 'L').resize((w, h), Image.Resampling.BICUBIC)
        total += np.asarray(image, dtype=np.float32) * amp
        amp_sum += amp
        amp *= 0.50
    return total / max(amp_sum, 1e-6)


def smooth_noise(shape: tuple[int, int], blur: float = 8.0) -> np.ndarray:
    raw = (rng.random(shape) * 255).astype(np.uint8)
    img = Image.fromarray(raw, 'L').filter(ImageFilter.GaussianBlur(radius=blur))
    return np.asarray(img, dtype=np.float32)


# -----------------------------------------------------------------------------
# Aged painted cast metal
# The old version pushed low-frequency albedo noise too hard, which made the
# housing read like marbled plastic. Keep colour comparatively stable and move
# most surface information into roughness + normal instead.
# -----------------------------------------------------------------------------
macro = fbm((SIZE, SIZE), 6, 12)
micro = fbm((SIZE, SIZE), 4, 3)
base = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
base[:] = np.array([33, 63, 70], dtype=np.float32)
base += ((macro - 128.0) * 0.035)[..., None] * np.array([0.70, 1.00, 1.05])
base += ((micro - 128.0) * 0.010)[..., None]

# Sparse pin chips and faint linear scuffs, deliberately restrained.
chips = rng.random((SIZE, SIZE)) > 0.9990
base[chips] = np.array([90, 92, 87], dtype=np.float32)
scuff_field = np.zeros((SIZE, SIZE), dtype=np.float32)
for _ in range(max(12, SIZE // 48)):
    y0 = int(rng.integers(0, SIZE))
    x0 = int(rng.integers(0, SIZE))
    length = int(rng.integers(SIZE // 16, SIZE // 5))
    width = int(rng.integers(1, 3))
    x1 = min(SIZE, x0 + length)
    scuff_field[max(0, y0-width):min(SIZE, y0+width+1), x0:x1] += rng.uniform(18, 42)
scuff_field = np.asarray(Image.fromarray(np.clip(scuff_field, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.55)), dtype=np.float32)
base += (scuff_field * 0.035)[..., None]

paint_rough = 150 + (macro - 128) * 0.20 + (micro - 128) * 0.11 - scuff_field * 0.18
paint_rough[chips] = 112
paint_height = 128 + (micro - 128) * 0.13 + scuff_field * 0.20
save_rgb('painted_metal_albedo.png', base)
save_gray('painted_metal_roughness.png', paint_rough)
save_rgb('painted_metal_normal.png', normal_from_height(paint_height, 2.1))


# -----------------------------------------------------------------------------
# Ash / beech blade wood
# Replace the old regular sine-wave grain with warped longitudinal fibres,
# annual bands and occasional knots. Colour is less orange and lacquer is
# represented mostly through roughness, not glossy colour contrast.
# -----------------------------------------------------------------------------
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
warp = (fbm((SIZE, SIZE), 5, 14) - 128.0) / 128.0
warp2 = (smooth_noise((SIZE, SIZE), 14.0) - 128.0) / 128.0
longitudinal = xx + 24.0 * warp + 10.0 * np.sin(yy * 0.010 + warp2 * 2.4)

fine = 0.5 + 0.5 * np.sin(longitudinal * 0.115 + 0.9 * np.sin(longitudinal * 0.022))
coarse = 0.5 + 0.5 * np.sin(longitudinal * 0.027 + warp * 4.0)
pores = fbm((SIZE, SIZE), 4, 4) / 255.0

# A few elliptical knot disturbances.
knot_field = np.zeros((SIZE, SIZE), dtype=np.float32)
for _ in range(5):
    kx = float(rng.uniform(0.12, 0.88) * SIZE)
    ky = float(rng.uniform(0.10, 0.90) * SIZE)
    rx = float(rng.uniform(26, 58) * SIZE / 1024)
    ry = float(rng.uniform(42, 95) * SIZE / 1024)
    dist = np.sqrt(((xx-kx)/max(rx,1.0))**2 + ((yy-ky)/max(ry,1.0))**2)
    rings = np.cos(dist * 11.0) * np.exp(-dist * 1.9)
    knot_field += np.clip(rings, -1.0, 1.0)

wood_luma = fine * 0.50 + coarse * 0.32 + pores * 0.18
wood_luma += knot_field * 0.10
wood = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
wood[:] = np.array([145, 105, 68], dtype=np.float32)
wood += ((wood_luma - 0.5) * 38.0)[..., None] * np.array([1.00, 0.78, 0.52])
wood += (warp[..., None] * np.array([4.0, 3.0, 2.0]))
wood_rough = 118 + (1.0 - fine) * 24 + pores * 20 + np.abs(knot_field) * 12
wood_height = 126 + (fine - 0.5) * 19 + (coarse - 0.5) * 9 + knot_field * 7
save_rgb('wood_albedo.png', wood)
save_gray('wood_roughness.png', wood_rough)
save_rgb('wood_normal.png', normal_from_height(wood_height, 2.5))


# -----------------------------------------------------------------------------
# Dark machined steel / belt pulley
# Fine concentric machining marks, subdued colour variation, slightly oily
# roughness patches. The surface should read as metal before it reads as noise.
# -----------------------------------------------------------------------------
cx = (SIZE - 1) * 0.5
cy = (SIZE - 1) * 0.5
xgrid, ygrid = np.meshgrid(np.arange(SIZE), np.arange(SIZE))
r = np.sqrt((xgrid - cx) ** 2 + (ygrid - cy) ** 2)
ring = 0.5 + 0.5 * np.sin(r * 0.34)
steel_macro = fbm((SIZE, SIZE), 5, 14) / 255.0
steel_micro = fbm((SIZE, SIZE), 3, 3) / 255.0
dark = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
dark[:] = np.array([65, 69, 70], dtype=np.float32)
dark += ((ring - 0.5) * 5.0 + (steel_macro - 0.5) * 4.0)[..., None]
dark_rough = 76 + ring * 18 + steel_macro * 15 + steel_micro * 7
dark_height = 126 + (ring - 0.5) * 15 + (steel_micro - 0.5) * 8
save_rgb('dark_steel_albedo.png', dark)
save_gray('dark_steel_roughness.png', dark_rough)
save_rgb('dark_steel_normal.png', normal_from_height(dark_height, 1.65))


# -----------------------------------------------------------------------------
# Brushed bright steel
# Directional hairline scratches with a second softer frequency. Albedo remains
# almost neutral; anisotropy is communicated by roughness and normal variation.
# -----------------------------------------------------------------------------
line_noise = rng.normal(0, 1, (SIZE, max(16, SIZE // 28))).astype(np.float32)
line_img = Image.fromarray(np.clip(128 + line_noise * 24, 0, 255).astype(np.uint8), 'L').resize((SIZE, SIZE), Image.Resampling.BICUBIC)
line_img = line_img.filter(ImageFilter.GaussianBlur(radius=0.45))
lines = np.asarray(line_img, dtype=np.float32)
fine_scratch = rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32)
fine_img = Image.fromarray(np.clip(128 + fine_scratch * 14, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius=0.35))
fine_arr = np.asarray(fine_img, dtype=np.float32)
bright = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
bright[:] = np.array([168, 172, 173], dtype=np.float32)
bright += ((lines - 128.0) * 0.045 + (fine_arr - 128.0) * 0.018)[..., None]
bright_rough = 64 + np.abs(lines - 128) * 0.27 + np.abs(fine_arr - 128) * 0.12
bright_height = 128 + (lines - 128.0) * 0.45 + (fine_arr - 128.0) * 0.20
save_rgb('steel_albedo.png', bright)
save_gray('steel_roughness.png', bright_rough)
save_rgb('steel_normal.png', normal_from_height(bright_height, 1.75))

print({'out': str(OUT), 'size': SIZE, 'files': len(list(OUT.glob('*.png'))), 'texture_revision': 'v1.1-natural-surfaces'})
