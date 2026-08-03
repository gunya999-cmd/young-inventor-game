import bpy
import math
import os
from mathutils import Vector

OUT = os.environ.get('JITB_OUT', 'public/assets/jack-in-the-box-option-a.glb')
PREVIEW = os.environ.get('JITB_PREVIEW', 'test-results/jack-option-a-blender.png')

# -----------------------------------------------------------------------------
# Scene / helpers
# -----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0


def material(name, color, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = 1.46
    return m


PAINT = material('Painted deep blue enamel', (0.055, 0.165, 0.215), 0.12, 0.48)
PAINT_DARK = material('Dark blue edge wear', (0.025, 0.075, 0.095), 0.18, 0.56)
CREAM = material('Aged warm ivory paint', (0.62, 0.535, 0.39), 0.02, 0.58)
RED = material('Muted vermilion paint', (0.46, 0.065, 0.045), 0.06, 0.48)
BURGUNDY = material('Burgundy cloth', (0.22, 0.018, 0.025), 0.0, 0.82)
BRASS = material('Aged brass', (0.43, 0.255, 0.075), 0.78, 0.34)
STEEL = material('Brushed steel', (0.39, 0.42, 0.43), 0.90, 0.27)
STEEL_DARK = material('Blackened steel', (0.055, 0.065, 0.068), 0.82, 0.42)
WOOD = material('Dark walnut', (0.19, 0.072, 0.028), 0.0, 0.58)
FACE = material('Painted carved wood face', (0.63, 0.47, 0.32), 0.0, 0.64)
WHITE = material('Warm eye white', (0.76, 0.73, 0.66), 0.0, 0.48)
BLACK = material('Charcoal details', (0.012, 0.014, 0.014), 0.0, 0.73)
BLUE_CLOTH = material('Dusty blue cloth', (0.055, 0.16, 0.245), 0.0, 0.78)
RUBBER = material('Dark rubber feet', (0.022, 0.026, 0.026), 0.0, 0.92)


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def smooth(obj):
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True


def cube(name, loc, dims, mat, parent=None, bevel=0.018, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new('Real edge radius', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=48, rotation=(0,0,0), bevel=0.006):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    if bevel > 0:
        mod = o.modifiers.new('Machined edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    smooth(o)
    if parent:
        o.parent = parent
    return o


def sphere(name, loc, scale, mat, parent=None, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    smooth(o)
    if parent:
        o.parent = parent
    return o


def torus(name, loc, major, minor, mat, parent=None, rotation=(0,0,0), major_segments=64, minor_segments=16):
    bpy.ops.mesh.primitive_torus_add(major_segments=major_segments, minor_segments=minor_segments,
                                    location=loc, major_radius=major, minor_radius=minor, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    smooth(o)
    if parent:
        o.parent = parent
    return o


def cone(name, loc, r1, r2, depth, mat, parent=None, vertices=48, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    mod = o.modifiers.new('Soft cloth edge', 'BEVEL')
    mod.width = 0.008
    mod.segments = 2
    smooth(o)
    if parent:
        o.parent = parent
    return o


def screw(name, x, y, z, parent):
    # Front-facing screw. Blender Y maps to Three -Z, so front is negative Y.
    o = cylinder(name, (x, y, z), 0.022, 0.018, BRASS, parent, 24, (math.pi/2,0,0), 0.002)
    slot = cube(name + '_slot', (x, y-0.012, z), (0.026, 0.008, 0.004), STEEL_DARK, parent, 0.001, 1)
    slot.rotation_euler[1] = math.radians(24)
    return o


def curve_tube(name, points, radius, mat, parent=None, resolution=4):
    data = bpy.data.curves.new(name + '_curve', type='CURVE')
    data.dimensions = '3D'
    data.resolution_u = 2
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1.0)
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.select_set(False)
    return o


def rod_between(name, a, b, radius, mat, parent=None, vertices=32):
    a, b = Vector(a), Vector(b)
    mid = (a+b)*0.5
    direction = b-a
    length = direction.length
    o = cylinder(name, mid, radius, length, mat, parent, vertices, (0,0,0), 0.003)
    o.rotation_euler = direction.to_track_quat('Z','Y').to_euler()
    return o


# -----------------------------------------------------------------------------
# Named physical assemblies expected by the game runtime
# -----------------------------------------------------------------------------
housing = empty('JITB_Housing')
lid = empty('JITB_Lid')
drive = empty('JITB_Drive')
jack = empty('JITB_Jack')
spring_root = empty('JITB_Spring')

# -----------------------------------------------------------------------------
# Housing: real panel construction, trims, fasteners, base and interior
# Game coordinates after GLTF export: X = x, Y = Blender Z, Z = -Blender Y.
# -----------------------------------------------------------------------------
# Outer panel dimensions are aligned with current Planck hosts.
cube('Housing_Back', (0, 0.505, -0.05), (1.22, 0.065, 1.04), PAINT, housing, 0.026, 4)
cube('Housing_Front', (0, -0.505, -0.05), (1.22, 0.065, 1.04), PAINT, housing, 0.026, 4)
cube('Housing_Left', (-0.595, 0, -0.05), (0.065, 0.96, 1.04), PAINT, housing, 0.022, 3)
cube('Housing_Right', (0.595, 0, -0.05), (0.065, 0.96, 1.04), PAINT, housing, 0.022, 3)
cube('Housing_Floor', (0, 0, -0.555), (1.16, 0.94, 0.07), PAINT_DARK, housing, 0.025, 3)

# Interior lip / realistic opening.
for x in (-0.54, 0.54):
    cube('OpeningSide', (x, 0, 0.48), (0.055, 0.92, 0.07), STEEL_DARK, housing, 0.010, 2)
for y in (-0.44, 0.44):
    cube('OpeningRail', (0, y, 0.48), (1.05, 0.055, 0.07), STEEL_DARK, housing, 0.010, 2)

# Corner straps and small rivets.
for x in (-0.625, 0.625):
    for y in (-0.535, 0.535):
        cube('CornerStrap', (x, y, -0.04), (0.055, 0.045, 1.12), BRASS, housing, 0.010, 2)
        for z in (-0.39, 0.28):
            cylinder('CornerRivet', (x, y - (0.030 if y < 0 else -0.030), z), 0.020, 0.018, BRASS, housing, 20,
                     (math.pi/2,0,0) if abs(y) > 0.5 else (0,0,0), 0.002)

# Front ivory inset and diamond motif.
cube('FrontInset', (0, -0.545, -0.07), (0.82, 0.035, 0.54), CREAM, housing, 0.028, 4)
diamond = cube('FrontDiamond', (0, -0.568, -0.07), (0.245, 0.022, 0.245), RED, housing, 0.016, 3)
diamond.rotation_euler[1] = math.radians(45)
for x in (-0.48, 0.48):
    for z in (-0.40, 0.30):
        screw('FrontScrew', x, -0.548, z, housing)

# Lower plinth and feet.
cube('BasePlinth', (0, 0, -0.605), (1.30, 1.06, 0.085), WOOD, housing, 0.026, 4)
for x in (-0.48, 0.48):
    for y in (-0.38, 0.38):
        cylinder('RubberFoot', (x, y, -0.67), 0.065, 0.055, RUBBER, housing, 32, (0,0,0), 0.006)

# -----------------------------------------------------------------------------
# Lid: root origin is the physical hinge. Geometry extends +X from it.
# -----------------------------------------------------------------------------
cube('LidBoard', (0.59, 0, 0.02), (1.19, 1.06, 0.09), PAINT, lid, 0.035, 5)
cube('LidInner', (0.59, 0, -0.045), (1.10, 0.97, 0.035), PAINT_DARK, lid, 0.018, 3)
# Metallic rim rails around the lid.
for y in (-0.505, 0.505):
    cube('LidRimLong', (0.59, y, 0.065), (1.20, 0.030, 0.040), BRASS, lid, 0.008, 2)
for x in (0.02, 1.16):
    cube('LidRimShort', (x, 0, 0.065), (0.030, 1.00, 0.040), BRASS, lid, 0.008, 2)
# Hinge barrels centered on lid pivot.
for y in (-0.34, 0.34):
    cylinder('HingeBarrel', (0.0, y, -0.015), 0.040, 0.25, BRASS, lid, 40, (math.pi/2,0,0), 0.004)
    cylinder('HingePin', (0.0, y, -0.015), 0.018, 0.29, STEEL, lid, 28, (math.pi/2,0,0), 0.002)

# -----------------------------------------------------------------------------
# Drive: cast wheel + recessed hub + metal crank + walnut grip.
# Root aligns to current driveHost.
# -----------------------------------------------------------------------------
cylinder('DriveWheel', (0, 0, 0), 0.245, 0.115, PAINT_DARK, drive, 72, (math.pi/2,0,0), 0.010)
for y in (-0.060, 0.060):
    torus('DriveRim', (0, y, 0), 0.224, 0.020, BRASS, drive, (math.pi/2,0,0), 72, 12)
cylinder('DriveHub', (0, -0.075, 0), 0.075, 0.17, STEEL, drive, 40, (math.pi/2,0,0), 0.005)
rod_between('CrankArm', (0, -0.11, 0), (0.27, -0.11, 0.12), 0.026, BRASS, drive, 28)
rod_between('CrankAxle', (0.27, -0.11, 0.12), (0.27, -0.22, 0.12), 0.024, STEEL, drive, 24)
cylinder('WalnutHandle', (0.27, -0.31, 0.12), 0.065, 0.18, WOOD, drive, 40, (math.pi/2,0,0), 0.012)
# Three spoke impressions for readable rotation.
for ang in (0, 2*math.pi/3, 4*math.pi/3):
    a=(0, -0.064, 0)
    b=(math.cos(ang)*0.16, -0.064, math.sin(ang)*0.16)
    rod_between('DriveSpoke', a, b, 0.014, BRASS, drive, 20)

# -----------------------------------------------------------------------------
# Jack: intentionally a believable carved vintage jester, not horror/cartoon.
# Compact proportions so it hides inside the box when latched.
# -----------------------------------------------------------------------------
# Mechanical neck sleeve and torso.
cylinder('JackNeckSleeve', (0, 0, 0.04), 0.095, 0.16, BRASS, jack, 40, (0,0,0), 0.006)
cone('JackTorso', (0, 0, 0.13), 0.19, 0.14, 0.26, BURGUNDY, jack, 48)
# Cloth collar as central torus + twelve ruffles.
torus('JackCollarCore', (0, 0, 0.24), 0.15, 0.032, CREAM, jack, (0,0,0), 56, 12)
for i in range(12):
    a=2*math.pi*i/12
    sphere('CollarRuffle', (math.cos(a)*0.18, math.sin(a)*0.18, 0.245), (0.052,0.028,0.035), CREAM, jack, 24, 12)

# Carved wooden head — modest size, slightly elongated, visible cheeks.
sphere('JackHead', (0, 0, 0.39), (0.176, 0.155, 0.195), FACE, jack, 64, 32)
sphere('LeftCheek', (-0.085, -0.135, 0.365), (0.055, 0.025, 0.040), RED, jack, 28, 14)
sphere('RightCheek', (0.085, -0.135, 0.365), (0.055, 0.025, 0.040), RED, jack, 28, 14)
# Small inset eyes, not bulging.
for x in (-0.062, 0.062):
    sphere('EyeWhite', (x, -0.145, 0.425), (0.034, 0.016, 0.026), WHITE, jack, 28, 14)
    sphere('Pupil', (x, -0.160, 0.423), (0.012, 0.007, 0.012), BLACK, jack, 20, 10)
# Nose is carved / subtle.
sphere('Nose', (0, -0.165, 0.385), (0.034, 0.022, 0.030), FACE, jack, 28, 14)
# Painted curved smile as thin tube.
smile=[]
for i in range(24):
    t=i/23
    x=(t-0.5)*0.13
    z=0.345 - 0.018*math.cos((t-0.5)*math.pi*2)
    smile.append((x,-0.170,z))
curve_tube('PaintedSmile', smile, 0.006, RED, jack, resolution=2)

# Two-piece cloth jester cap, muted blue/red, with brass bells.
cone('CapBase', (0, 0.005, 0.555), 0.16, 0.055, 0.18, BLUE_CLOTH, jack, 48)
left_horn = cone('CapHornBlue', (-0.075, 0.005, 0.67), 0.075, 0.016, 0.26, BLUE_CLOTH, jack, 40, (0, math.radians(-24), math.radians(8)))
right_horn = cone('CapHornRed', (0.075, 0.005, 0.67), 0.075, 0.016, 0.26, BURGUNDY, jack, 40, (0, math.radians(24), math.radians(-8)))
sphere('LeftBell', (-0.125, 0.005, 0.785), (0.034,0.034,0.034), BRASS, jack, 28, 14)
sphere('RightBell', (0.125, 0.005, 0.785), (0.034,0.034,0.034), BRASS, jack, 28, 14)

# -----------------------------------------------------------------------------
# Spring: real steel helix. Local/world range matches runtime stretch constants.
# -----------------------------------------------------------------------------
pts=[]
turns=11.5
samples=460
for i in range(samples):
    t=i/(samples-1)
    a=t*math.pi*2*turns
    r=0.095
    pts.append((math.cos(a)*r, math.sin(a)*r, -0.48 + 0.37*t))
curve_tube('SpringCoil', pts, 0.012, STEEL, spring_root, resolution=3)
cylinder('SpringBottomSeat', (0,0,-0.49), 0.14, 0.025, STEEL_DARK, spring_root, 48, (0,0,0), 0.004)
cylinder('SpringTopSeat', (0,0,-0.10), 0.13, 0.020, STEEL_DARK, spring_root, 48, (0,0,0), 0.004)

# -----------------------------------------------------------------------------
# Apply modifiers so triangle counts and normals in the GLB are deterministic.
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

# Friendly metadata on the roots.
housing['asset_role'] = 'static_housing'
lid['asset_role'] = 'dynamic_hinged_lid'
drive['asset_role'] = 'rotating_crank_drive'
jack['asset_role'] = 'spring_driven_jester'
spring_root['asset_role'] = 'stretchable_visual_spring'
housing['asset_version'] = 'jack-in-the-box-v5-original-blender'
housing['authorship'] = 'Original project asset, modeled procedurally in Blender source under tools/build-jitb-option-a.py'

# -----------------------------------------------------------------------------
# Export GLB. No third-party geometry/textures are used.
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
# Studio render for mandatory visual review BEFORE link is shared.
# We render the asset in a pleasing open pose without changing exported GLB.
# -----------------------------------------------------------------------------
# Lid opens around Blender Y axis after coordinate conversion; rotate preview only.
lid.rotation_euler[1] = math.radians(-62)
jack.location.z = 0.56
spring_root.scale.z = 2.1
spring_root.location.z = -0.48 * (1.0 - spring_root.scale.z)

scene.render.engine = 'BLENDER_EEVEE'
if hasattr(scene, 'eevee'):
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.2
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.055, 0.065, 0.075)
scene.view_settings.look = 'Medium High Contrast'

# Ground
bpy.ops.mesh.primitive_plane_add(size=12, location=(0,0,-0.72))
ground=bpy.context.object
ground_mat=material('Studio floor',(0.24,0.26,0.27),0.0,0.92)
ground.data.materials.append(ground_mat)

# Lighting
def area(name, loc, energy, size, color):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.size=size
    data.color=color
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Key',(4.2,-5.2,5.6),900,4.0,(1.0,0.88,0.76))
area('Fill',(-4.0,-2.0,3.2),520,3.6,(0.70,0.82,1.0))
area('Rim',(2.5,4.4,4.5),750,3.0,(1.0,0.82,0.64))

cam_data=bpy.data.cameras.new('Camera')
cam=bpy.data.objects.new('Camera',cam_data)
bpy.context.collection.objects.link(cam)
cam.location=(3.6,-5.4,2.6)
target=Vector((0,0,0.45))
cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
cam_data.lens=58
scene.camera=cam
os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
scene.render.filepath=PREVIEW
bpy.ops.render.render(write_still=True)

# Print deterministic report for Actions logs.
triangles=0
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj != ground:
        triangles += sum(len(p.vertices)-2 for p in obj.data.polygons)
print({'out': OUT, 'preview': PREVIEW, 'triangles': triangles, 'objects': len(bpy.context.scene.objects)})
