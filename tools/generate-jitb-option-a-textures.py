from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageFilter

OUT = Path('/tmp/jitb_option_a_textures')
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512


def clamp(x):
    return np.clip(x, 0, 255).astype(np.uint8)


def normal_from_height(height: np.ndarray, strength: float = 4.0) -> np.ndarray:
    h = height.astype(np.float32) / 255.0
    gy, gx = np.gradient(h)
    nx = -gx * strength
    ny = gy * strength
    nz = np.ones_like(h)
    mag = np.sqrt(nx*nx + ny*ny + nz*nz)
    nx /= mag; ny /= mag; nz /= mag
    rgb = np.stack([(nx*0.5+0.5)*255, (ny*0.5+0.5)*255, (nz*0.5+0.5)*255], axis=-1)
    return clamp(rgb)


def save_set(name, base_rgb, seed, kind):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    u = xx / (SIZE-1)
    v = yy / (SIZE-1)
    noise = rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32)

    if kind == 'paint':
        macro = (np.sin((u*5.3 + v*3.7)*math.pi*2) * 0.5 + 0.5)
        fine = noise * 0.020
        variation = (macro-0.5)*0.035 + fine
        height = 128 + noise*8 + np.sin(u*math.pi*44)*2.2 + np.sin(v*math.pi*39)*1.8
        rough = 158 + noise*12
        # Long, sparse scratches and edge chips.
        mask = np.zeros((SIZE,SIZE), dtype=np.float32)
        py = random.Random(seed)
        for _ in range(42):
            x0=py.randint(8,SIZE-9); y0=py.randint(8,SIZE-9)
            length=py.randint(10,65); ang=py.uniform(-0.5,0.5)
            for t in range(length):
                x=int(x0+math.cos(ang)*t); y=int(y0+math.sin(ang)*t)
                if 1<=x<SIZE-1 and 1<=y<SIZE-1:
                    mask[y-1:y+2,x-1:x+2]=np.maximum(mask[y-1:y+2,x-1:x+2], 1.0-(t/max(length,1))*0.35)
        # A little denser wear close to UV borders.
        border = np.minimum.reduce([u,v,1-u,1-v])
        edge = np.clip((0.045-border)/0.045, 0, 1)
        mask=np.clip(mask + edge*0.34,0,1)
        base=np.zeros((SIZE,SIZE,3),dtype=np.float32)
        for c,val in enumerate(base_rgb): base[...,c]=val
        base *= (1.0+variation[...,None])
        exposed=np.array([82,63,44],dtype=np.float32)
        base=base*(1-mask[...,None]*0.48)+exposed[None,None,:]*(mask[...,None]*0.48)
        rough = rough + mask*38
        height = height - mask*24
    elif kind == 'wood':
        grain=np.sin((u*22 + np.sin(v*9)*1.5)*math.pi*2)
        grain2=np.sin((u*57 + v*3.2)*math.pi*2)*0.32
        variation=grain*0.09+grain2*0.025+noise*0.012
        base=np.zeros((SIZE,SIZE,3),dtype=np.float32)
        for c,val in enumerate(base_rgb): base[...,c]=val
        base *= (1.0+variation[...,None])
        height=128 + grain*21 + grain2*6 + noise*4
        rough=168 - grain*10 + noise*5
    elif kind == 'face':
        # Painted carved wood: subtle vertical grain, freckles and age, no horror grime.
        grain=np.sin((u*29 + np.sin(v*5)*0.9)*math.pi*2)
        variation=grain*0.025+noise*0.012
        base=np.zeros((SIZE,SIZE,3),dtype=np.float32)
        for c,val in enumerate(base_rgb): base[...,c]=val
        base *= (1.0+variation[...,None])
        height=128 + grain*6 + noise*3
        rough=176 + noise*6
        py=random.Random(seed)
        for _ in range(65):
            cx=py.randint(0,SIZE-1); cy=py.randint(0,SIZE-1); rad=py.randint(1,3)
            y1=max(0,cy-rad);y2=min(SIZE,cy+rad+1);x1=max(0,cx-rad);x2=min(SIZE,cx+rad+1)
            base[y1:y2,x1:x2]*=py.uniform(0.78,0.92)
            rough[y1:y2,x1:x2]+=12
    elif kind == 'ivory':
        mottled=(np.sin((u*7.7+v*5.1)*math.pi*2)+np.sin((u*13.3-v*4.2)*math.pi*2))*0.5
        variation=mottled*0.018+noise*0.010
        base=np.zeros((SIZE,SIZE,3),dtype=np.float32)
        for c,val in enumerate(base_rgb): base[...,c]=val
        base *= (1.0+variation[...,None])
        height=128+mottled*3+noise*2
        rough=174+noise*5
    else:
        raise ValueError(kind)

    albedo=clamp(base)
    height=clamp(height)
    rough=clamp(rough)
    normal=normal_from_height(height, 3.2 if kind=='wood' else 2.0)
    Image.fromarray(albedo,'RGB').save(OUT/f'{name}_albedo.png', optimize=True)
    Image.fromarray(rough,'L').save(OUT/f'{name}_roughness.png', optimize=True)
    Image.fromarray(normal,'RGB').save(OUT/f'{name}_normal.png', optimize=True)


save_set('blue_paint', (50,103,126), 14140, 'paint')
save_set('dark_blue_paint', (33,58,68), 14141, 'paint')
save_set('walnut', (87,49,29), 14142, 'wood')
save_set('carved_face', (181,145,109), 14143, 'face')
save_set('ivory', (202,186,150), 14144, 'ivory')
print({'out': str(OUT), 'files': len(list(OUT.glob('*.png'))), 'size': SIZE})
