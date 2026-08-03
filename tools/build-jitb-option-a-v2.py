import bpy
import math
import os
import random
from pathlib import Path

# Reuse the reviewed mechanical construction source, but stop before its export/render stage.
base_path = Path('tools/build-jitb-option-a.py')
source = base_path.read_text(encoding='utf-8')
marker = '# -----------------------------------------------------------------------------\n# Export GLB. No third-party geometry/textures are used.'
if marker not in source:
    raise RuntimeError('Base Jack source export marker missing')
exec(compile(source.split(marker, 1)[0], str(base_path), 'exec'), globals())

OUT = os.environ.get('JITB_OUT', 'public/assets/jack-in-the-box-option-a.glb')
PREVIEW = os.environ.get('JITB_PREVIEW', 'test-results/jack-option-a-blender.png')

# -----------------------------------------------------------------------------
# PBR-ish authored texture maps (original project pixels, no external images).
# glTF exporter embeds these image textures in the GLB.
# -----------------------------------------------------------------------------
def make_color_texture(name, base, seed, kind='paint', size=384):
    rng = random.Random(seed)
    img = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    # Preselect a few abrasion centers for deterministic wear.
    chips = [(rng.random(), rng.random(), rng.uniform(0.008, 0.025)) for _ in range(22 if kind == 'paint' else 8)]
    for y in range(size):
        v = y / max(1, size - 1)
        for x in range(size):
            u = x / max(1, size - 1)
            noise = (rng.random() - 0.5)
            if kind == 'wood':
                grain = math.sin((u * 38.0 + math.sin(v * 9.0) * 1.8) * math.pi) * 0.045
                variation = grain + noise * 0.025
            elif kind == 'face':
                grain = math.sin((u * 24.0 + v * 3.5) * math.pi) * 0.018
                variation = grain + noise * 0.018
            else:
                variation = noise * 0.038 + math.sin((u + v) * math.pi * 11.0) * 0.007
            r, g, b = [max(0.0, min(1.0, c + variation)) for c in base]
            if kind == 'paint':
                for cx, cy, rad in chips:
                    d = ((u-cx)**2 + (v-cy)**2) ** 0.5
                    if d < rad:
                        edge = max(0.0, min(1.0, d / max(rad, 1e-6)))
                        r = r * edge + 0.17 * (1-edge)
                        g = g * edge + 0.12 * (1-edge)
                        b = b * edge + 0.075 * (1-edge)
                        break
            i = (y * size + x) * 4
            pixels[i:i+4] = [r, g, b, 1.0]
    img.pixels.foreach_set(pixels)
    img.colorspace_settings.name = 'sRGB'
    path = f'/tmp/{name}.png'
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    return img


def attach_basecolor(mat, image):
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.name = image.name + '_Texture'
    tex.image = image
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])


attach_basecolor(PAINT, make_color_texture('jack_blue_paint', (0.055, 0.165, 0.215), 14014, 'paint'))
attach_basecolor(PAINT_DARK, make_color_texture('jack_dark_paint', (0.027, 0.073, 0.088), 14015, 'paint'))
attach_basecolor(WOOD, make_color_texture('jack_walnut', (0.19, 0.072, 0.028), 14016, 'wood'))
attach_basecolor(FACE, make_color_texture('jack_carved_face', (0.61, 0.455, 0.31), 14017, 'face'))
attach_basecolor(CREAM, make_color_texture('jack_ivory', (0.61, 0.53, 0.40), 14018, 'paint'))

# Less polished, more physical material response.
for m, rough in [(PAINT,0.58),(PAINT_DARK,0.64),(CREAM,0.66),(RED,0.57),(BRASS,0.42),(STEEL,0.34),(WOOD,0.66),(FACE,0.70)]:
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=rough

# -----------------------------------------------------------------------------
# Face refinement: carved vintage jester, not Pixar/clown-horror.
# -----------------------------------------------------------------------------
for obj in list(bpy.data.objects):
    if obj.name.startswith('LeftCheek') or obj.name.startswith('RightCheek'):
        bpy.data.objects.remove(obj, do_unlink=True)

head = bpy.data.objects.get('JackHead')
if head:
    head.scale.x *= 0.88
    head.scale.y *= 0.95
    head.scale.z *= 1.06

# Small inset eyes and pupils.
for obj in bpy.data.objects:
    if obj.name.startswith('EyeWhite'):
        obj.scale *= 0.64
        obj.location.x *= 0.82
        obj.location.y += 0.010
        obj.location.z += 0.005
    elif obj.name.startswith('Pupil'):
        obj.scale *= 0.62
        obj.location.x *= 0.82
        obj.location.y += 0.012
        obj.location.z += 0.005
    elif obj.name == 'Nose':
        obj.scale *= 0.58
        obj.location.y += 0.012
    elif obj.name.startswith('CollarRuffle'):
        obj.scale *= 0.70
    elif obj.name.startswith('CapHorn'):
        obj.scale *= 0.86

# Dark carved eyebrows and a subtle mouth line.
for side in (-1, 1):
    pts=[]
    for i in range(10):
        t=i/9
        x=side*(0.030 + t*0.045)
        z=0.465 + math.sin(t*math.pi)*0.010
        pts.append((x,-0.158,z))
    curve_tube('CarvedBrow', pts, 0.0045, BLACK, jack, resolution=2)

# Shift the whole jester down inside its local physics host so it is hidden when latched.
for child in list(jack.children):
    child.location.z -= 0.36

# -----------------------------------------------------------------------------
# Physical wear details visible at phone/tablet distance.
# -----------------------------------------------------------------------------
WORN = material('Exposed worn metal', (0.17, 0.105, 0.055), 0.52, 0.70)
rng = random.Random(141414)
for idx in range(16):
    # Keep central plaque readable by placing most scratches near outer bands.
    x = rng.choice([rng.uniform(-0.54,-0.43), rng.uniform(0.43,0.54), rng.uniform(-0.52,0.52)])
    z = rng.uniform(-0.45,0.38)
    if abs(x) < 0.38 and -0.34 < z < 0.22:
        x = 0.46 if x >= 0 else -0.46
    length = rng.uniform(0.045,0.16)
    scratch = cube(f'PaintWear_{idx}', (x,-0.540,z), (length,0.004,rng.uniform(0.0035,0.008)), WORN, housing, 0.001, 1)
    scratch.rotation_euler[1] = rng.uniform(-0.45,0.45)

# Small wear on ivory plaque.
for idx in range(5):
    x=rng.uniform(-0.34,0.34); z=rng.uniform(-0.24,0.10)
    chip=cube(f'IvoryWear_{idx}',(x,-0.568,z),(rng.uniform(0.018,0.045),0.003,0.004),WORN,housing,0.0005,1)
    chip.rotation_euler[1]=rng.uniform(-0.6,0.6)

# -----------------------------------------------------------------------------
# Apply added modifiers before export.
# -----------------------------------------------------------------------------
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    obj.select_set(False)

# Metadata.
housing['asset_version'] = 'jack-in-the-box-v5-original-blender'
housing['visual_direction'] = 'realistic vintage mechanical toy, original project mesh'
housing['external_geometry'] = 'none'

# -----------------------------------------------------------------------------
# Export neutral physical pose.
# -----------------------------------------------------------------------------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)

# -----------------------------------------------------------------------------
# Mandatory studio preview with the same root placements as game physics hosts.
# -----------------------------------------------------------------------------
# Housing remains at origin.
lid.location = (-0.58, 0.0, 0.52)
lid.rotation_euler[1] = math.radians(-58)
drive.location = (0.79, -0.64, -0.03)
jack.location = (0.0, 0.0, 0.57)
spring_root.scale.z = 2.15
spring_root.location.z = -0.48 * (1.0 - spring_root.scale.z)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('StudioWorld')
scene.world.color = (0.045,0.052,0.058)
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

bpy.ops.mesh.primitive_plane_add(size=12, location=(0,0,-0.72))
ground=bpy.context.object
ground.data.materials.append(material('Studio floor',(0.23,0.245,0.255),0.0,0.94))

def area(name, loc, energy, size, color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Key',(4.5,-5.8,5.7),920,4.2,(1.0,0.89,0.78))
area('Fill',(-4.0,-1.8,3.2),440,3.5,(0.68,0.80,1.0))
area('Rim',(2.8,4.3,4.8),700,3.0,(1.0,0.84,0.68))

cam_data=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',cam_data); bpy.context.collection.objects.link(cam)
cam.location=(3.9,-5.7,2.8)
target=Vector((0.08,0,0.30))
cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
cam_data.lens=62
scene.camera=cam
os.makedirs(os.path.dirname(PREVIEW),exist_ok=True)
scene.render.filepath=PREVIEW
bpy.ops.render.render(write_still=True)

triangles=0
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj != ground:
        triangles += sum(max(0,len(p.vertices)-2) for p in obj.data.polygons)
print({'out':OUT,'preview':PREVIEW,'triangles':triangles,'objects':len(bpy.context.scene.objects)})
