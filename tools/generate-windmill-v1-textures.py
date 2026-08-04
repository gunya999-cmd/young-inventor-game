from __future__ import annotations

import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(os.environ.get('WINDMILL_TEXTURE_DIR', '/tmp/windmill_v1_textures'))
SIZE = int(os.environ.get('WINDMILL_TEXTURE_SIZE', '768'))
OUT.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(1501)

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


def fbm(shape: tuple[int, int], octaves: int = 5) -> np.ndarray:
    total = np.zeros(shape, dtype=np.float32)
    amp = 1.0
    amp_sum = 0.0
    for octave in range(octaves):
        small = max(4, shape[0] // (8 * (2 ** octave)))
        seed = (rng.random((small, small)) * 255).astype(np.uint8)
        image = Image.fromarray(seed, 'L').resize((shape[1], shape[0]), Image.Resampling.BICUBIC)
        total += np.asarray(image, dtype=np.float32) * amp
        amp_sum += amp
        amp *= 0.52
    return total / max(amp_sum, 1e-6)

# Painted cast-metal housing: subtly uneven, worn at random micro-spots.
noise = fbm((SIZE, SIZE), 6)
speck = rng.random((SIZE, SIZE))
base = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
base[:] = np.array([38, 68, 77], dtype=np.float32)
variation = (noise - 128.0)[..., None] * np.array([0.085, 0.11, 0.12])
base += variation
wear = speck > 0.997
base[wear] = np.array([107, 111, 104])
rough = 142 + (noise - 128) * 0.22
rough[wear] = 105
height = 128 + (noise - 128) * 0.16
save_rgb('painted_metal_albedo.png', base)
save_gray('painted_metal_roughness.png', rough)
save_rgb('painted_metal_normal.png', normal_from_height(height, 3.0))

# Wood blades: directional grain with restrained color variation.
y = np.arange(SIZE, dtype=np.float32)[:, None]
x = np.arange(SIZE, dtype=np.float32)[None, :]
phase = x * 0.075 + 6.0 * np.sin(y * 0.015) + 2.5 * np.sin(y * 0.051)
grain = 0.5 + 0.5 * np.sin(phase)
wood_noise = fbm((SIZE, SIZE), 5) / 255.0
wood = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
wood[:] = np.array([132, 88, 48], dtype=np.float32)
wood += ((grain * 22.0 + wood_noise * 16.0 - 19.0)[..., None]) * np.array([1.0, 0.72, 0.42])
wood_rough = 132 + grain * 28 + wood_noise * 18
wood_height = 110 + grain * 45 + wood_noise * 18
save_rgb('wood_albedo.png', wood)
save_gray('wood_roughness.png', wood_rough)
save_rgb('wood_normal.png', normal_from_height(wood_height, 4.0))

# Dark steel/pulley: radial machining marks and small roughness variation.
cx = (SIZE - 1) * 0.5
cy = (SIZE - 1) * 0.5
xx, yy = np.meshgrid(np.arange(SIZE), np.arange(SIZE))
r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
ring = 0.5 + 0.5 * np.sin(r * 0.22)
steel_noise = fbm((SIZE, SIZE), 5) / 255.0
steel = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
steel[:] = np.array([72, 78, 80])
steel += ((ring * 7 + steel_noise * 9 - 8)[..., None])
steel_rough = 84 + ring * 20 + steel_noise * 16
steel_height = 120 + ring * 24 + steel_noise * 12
save_rgb('dark_steel_albedo.png', steel)
save_gray('dark_steel_roughness.png', steel_rough)
save_rgb('dark_steel_normal.png', normal_from_height(steel_height, 2.2))

# Brushed bright steel: linear scratches.
scratch = rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32)
scratch_img = Image.fromarray(np.clip(128 + scratch * 26, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius=0.7))
scratch_arr = np.asarray(scratch_img, dtype=np.float32)
bright = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
bright[:] = np.array([167, 174, 176], dtype=np.float32)
bright += ((scratch_arr - 128.0) * 0.09)[..., None]
bright_rough = 68 + np.abs(scratch_arr - 128) * 0.35
save_rgb('steel_albedo.png', bright)
save_gray('steel_roughness.png', bright_rough)
save_rgb('steel_normal.png', normal_from_height(scratch_arr, 2.4))

print({'out': str(OUT), 'size': SIZE, 'files': len(list(OUT.glob('*.png')))})
