from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

OUT = os.environ.get('WINDMILL_OUT', 'test-results/windmill-v1.glb')
PREVIEW = os.environ.get('WINDMILL_PREVIEW', 'test-results/windmill-v1-blender.png')
TEX = Path(os.environ.get('WINDMILL_TEXTURE_DIR', '/tmp/windmill_v1_textures'))

# -----------------------------------------------------------------------------
# Scene reset
# -----------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    pass


def empty(name: str, location=(0.0, 0.0, 0.0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return obj


def load_image(name: str):
    path = TEX / name
    if not path.exists():
        raise RuntimeError(f'Missing texture: {path}')
    return bpy.data.images.load(str(path), check_existing=True)


def pbr_material(name: str, prefix: str, metallic: float, fallback_color, normal_strength: float = 0.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Base Color'].default_value = (*fallback_color, 1.0)
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    albedo = nodes.new('ShaderNodeTexImage')
    albedo.image = load_image(f'{prefix}_albedo.png')
    albedo.image.colorspace_settings.name = 'sRGB'
    links.new(albedo.outputs['Color'], bsdf.inputs['Base Color'])

    rough = nodes.new('ShaderNodeTexImage')
    rough.image = load_image(f'{prefix}_roughness.png')
    rough.image.colorspace_settings.name = 'Non-Color'
    links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])

    normal_tex = nodes.new('ShaderNodeTexImage')
    normal_tex.image = load_image(f'{prefix}_normal.png')
    normal_tex.image.colorspace_settings.name = 'Non-Color'
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = normal_strength
    links.new(normal_tex.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


PAINT = pbr_material('Aged blue-green cast paint', 'painted_metal', 0.48, (0.07, 0.17, 0.20), 0.65)
WOOD = pbr_material('Lacquered ash blade', 'wood', 0.02, (0.35, 0.18, 0.07), 0.72)
DARK_STEEL = pbr_material('Machined dark steel', 'dark_steel', 0.91, (0.12, 0.14, 0.15), 0.48)
STEEL = pbr_material('Brushed steel', 'steel', 0.94, (0.55, 0.59, 0.61), 0.52)

BRASS = bpy.data.materials.new('Aged brass')
BRASS.use_nodes = True
bsdf = BRASS.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.36, 0.19, 0.055, 1.0)
bsdf.inputs['Metallic'].default_value = 0.84
bsdf.inputs['Roughness'].default_value = 0.30

RUBBER = bpy.data.materials.new('Rubber belt groove')
RUBBER.use_nodes = True
bsdf = RUBBER.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.018, 0.021, 0.022, 1.0)
bsdf.inputs['Metallic'].default_value = 0.05
bsdf.inputs['Roughness'].default_value = 0.83


def apply_bevel(obj, width: float, segments: int = 3):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Manufactured edge bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    finally:
        obj.select_set(False)


def cube(name: str, dims, loc, material, bevel=0.02, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    if material:
        obj.data.materials.append(material)
    if bevel > 0:
        apply_bevel(obj, bevel, 4)
    if parent:
        obj.parent = parent
    return obj


def cylinder(name: str, radius: float, depth: float, loc, material, parent=None, vertices=64, axis='Y'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':
        obj.rotation_euler.x = math.radians(90)
    elif axis == 'X':
        obj.rotation_euler.y = math.radians(90)
    if material:
        obj.data.materials.append(material)
    apply_bevel(obj, min(radius * 0.10, 0.018), 3)
    if parent:
        obj.parent = parent
    return obj


def torus(name: str, major: float, minor: float, loc, material, parent=None, axis='Y'):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=72, minor_segments=16, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':
        obj.rotation_euler.x = math.radians(90)
    if material:
        obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def trapezoid_blade(name: str, parent, angle: float):
    # Local blade extends away from hub in +Z. Wider outer paddle mirrors the classic TIM silhouette.
    r0, r1 = 0.24, 0.96
    w0, w1 = 0.105, 0.205
    t = 0.045
    verts = [
        (-w0, -t/2, r0), (w0, -t/2, r0), (w1, -t/2, r1), (-w1, -t/2, r1),
        (-w0, t/2, r0), (w0, t/2, r0), (w1, t/2, r1), (-w1, t/2, r1),
    ]
    faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    mesh = bpy.data.meshes.new(name + 'Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(WOOD)
    obj.parent = parent
    obj.rotation_euler.y = angle
    apply_bevel(obj, 0.018, 4)

    # Brushed-steel leading-edge strip and outer cap make the assembly read as a real machine.
    strip = cube(name + '_SteelEdge', (0.027, 0.055, 0.69), (-0.155, -0.002, 0.60), STEEL, 0.008, parent=obj)
    strip.rotation_euler.y = 0.0
    cap = cube(name + '_OuterCap', (0.34, 0.058, 0.035), (0.0, -0.002, 0.925), STEEL, 0.008, parent=obj)

    # Two countersunk fasteners per blade.
    for z in (0.34, 0.76):
        bolt = cylinder(name + f'_Rivet_{z:.2f}', 0.025, 0.062, (0.0, -0.006, z), BRASS, parent=obj, vertices=36, axis='Y')
    return obj


# -----------------------------------------------------------------------------
# Articulated roots
# -----------------------------------------------------------------------------
frame = empty('WM_Frame')
rotor = empty('WM_Rotor', (0.0, -0.18, 1.16))
blades_root = empty('WM_Blades')
blades_root.parent = rotor
shaft_root = empty('WM_Shaft', (0.0, -0.02, 1.16))
output = empty('WM_OutputPulley', (0.0, 0.0, 1.16))

# Heavy cast foot and pedestal.
base = cube('WM_BasePlate', (1.02, 0.62, 0.13), (0.0, 0.04, 0.08), PAINT, 0.045, frame)
for x in (-0.41, 0.41):
    for y in (-0.20, 0.20):
        cylinder('WM_BaseBolt', 0.045, 0.15, (x, y, 0.105), BRASS, frame, 40, axis='Z')

column = cube('WM_PedestalColumn', (0.46, 0.40, 0.72), (0.0, 0.04, 0.48), PAINT, 0.055, frame)
# Two triangular-looking gussets approximated by bevelled braces.
for x in (-0.31, 0.31):
    brace = cube('WM_Gusset', (0.15, 0.30, 0.48), (x, 0.04, 0.33), PAINT, 0.035, frame)
    brace.rotation_euler.y = math.radians(-22 if x < 0 else 22)

# Bearing block around the shaft.
bearing_outer = cylinder('WM_BearingHousing', 0.31, 0.46, (0.0, 0.02, 1.16), PAINT, frame, 72, axis='Y')
bearing_ring_front = torus('WM_BearingRetainerFront', 0.245, 0.038, (0.0, -0.225, 1.16), STEEL, frame)
bearing_ring_back = torus('WM_BearingRetainerBack', 0.245, 0.038, (0.0, 0.265, 1.16), STEEL, frame)
for ang in range(0, 360, 90):
    a = math.radians(ang)
    x = math.cos(a) * 0.235
    z = 1.16 + math.sin(a) * 0.235
    cylinder('WM_BearingBolt', 0.027, 0.055, (x, -0.255, z), BRASS, frame, 32, axis='Y')

# Shaft is visually separate so runtime can rotate it from the Planck body.
cylinder('WM_MainShaft', 0.075, 0.86, (0.0, 0.0, 0.0), STEEL, shaft_root, 72, axis='Y')
# Keyway / machined flat indicator makes spin readable.
key = cube('WM_ShaftKey', (0.034, 0.40, 0.035), (0.062, -0.04, 0.0), DARK_STEEL, 0.006, shaft_root)

# Four canonical blades.
for i in range(4):
    trapezoid_blade(f'WM_Blade_{i+1}', blades_root, math.radians(45 + i * 90))

# Front hub stack and fasteners.
cylinder('WM_RotorHub', 0.245, 0.22, (0.0, 0.0, 0.0), DARK_STEEL, rotor, 80, axis='Y')
cylinder('WM_RotorHubCap', 0.155, 0.235, (0.0, -0.03, 0.0), BRASS, rotor, 72, axis='Y')
for ang in range(0, 360, 45):
    a = math.radians(ang)
    bolt = cylinder('WM_HubBolt', 0.021, 0.25, (math.cos(a)*0.19, -0.045, math.sin(a)*0.19), STEEL, rotor, 28, axis='Y')

# Output V-belt pulley on the rear of the same physical shaft.
cylinder('WM_OutputPulleyCore', 0.285, 0.17, (0.0, 0.39, 0.0), DARK_STEEL, output, 80, axis='Y')
torus('WM_OutputPulleyFlangeA', 0.245, 0.042, (0.0, 0.315, 0.0), STEEL, output)
torus('WM_OutputPulleyFlangeB', 0.245, 0.042, (0.0, 0.465, 0.0), STEEL, output)
torus('WM_OutputPulleyGroove', 0.245, 0.032, (0.0, 0.39, 0.0), RUBBER, output)
cylinder('WM_OutputHub', 0.105, 0.22, (0.0, 0.39, 0.0), BRASS, output, 64, axis='Y')

# Small manufacturer plate and rivets on pedestal.
plate = cube('WM_NamePlate', (0.30, 0.025, 0.14), (0.0, -0.214, 0.54), BRASS, 0.012, frame)
for x in (-0.115, 0.115):
    cylinder('WM_NamePlateRivet', 0.012, 0.034, (x, -0.232, 0.54), STEEL, frame, 24, axis='Y')

# Metadata used by the runtime and visual gate.
frame['asset_version'] = 'windmill-v1-original-blender'
frame['source_license'] = 'PROJECT-ORIGINAL'
frame['visual_direction'] = 'realistic compact four-blade mechanical windmill inspired by TIM function, no copied TIM art'
frame['physics_contract'] = 'airflow-to-finite-shaft-torque'
frame['snap_point'] = 'output-fan-belt'

# Apply remaining bevel modifiers before export.
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

# Export neutral game pose before adding studio-only objects.
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
# Mandatory studio preview of the actual exported assembly
# -----------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('WindmillStudioWorld')
scene.world.color = (0.055, 0.065, 0.072)
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

# Floor only for preview.
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.01))
ground = bpy.context.object
ground.name = 'PreviewGround'
ground_mat = bpy.data.materials.new('Preview floor')
ground_mat.use_nodes = True
gbsdf = ground_mat.node_tree.nodes.get('Principled BSDF')
gbsdf.inputs['Base Color'].default_value = (0.13, 0.145, 0.155, 1.0)
gbsdf.inputs['Roughness'].default_value = 0.93
ground.data.materials.append(ground_mat)


def area(name, loc, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    target = Vector((0, 0, 0.72))
    obj.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

area('Key', (4.0, -5.2, 5.4), 1250, 4.0, (1.0, 0.92, 0.82))
area('Fill', (-4.3, -2.2, 3.2), 720, 3.7, (0.74, 0.86, 1.0))
area('Rim', (2.7, 4.4, 4.0), 900, 3.0, (1.0, 0.84, 0.70))

cam_data = bpy.data.cameras.new('Camera')
cam = bpy.data.objects.new('Camera', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (3.35, -5.7, 2.45)
target = Vector((0.0, 0.0, 0.78))
cam.rotation_euler = (target - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 66
scene.camera = cam
os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
scene.render.filepath = PREVIEW
bpy.ops.render.render(write_still=True)

triangles = 0
meshes = 0
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj is not ground:
        meshes += 1
        triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
print({'out': OUT, 'preview': PREVIEW, 'triangles': triangles, 'meshes': meshes})
