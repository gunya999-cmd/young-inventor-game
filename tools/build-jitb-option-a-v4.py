import bpy
import math
import os
from pathlib import Path
from mathutils import Vector

# Build the refined original geometry, but stop before its export/render stage.
base_path = Path('tools/build-jitb-option-a-v2.py')
source = base_path.read_text(encoding='utf-8')
marker = '# -----------------------------------------------------------------------------\n# Export neutral physical pose.'
if marker not in source:
    raise RuntimeError('Refined Jack source export marker missing')
exec(compile(source.split(marker, 1)[0], str(base_path), 'exec'), globals())

OUT = os.environ.get('JITB_OUT', 'public/assets/jack-in-the-box-option-a.glb')
PREVIEW = os.environ.get('JITB_PREVIEW', 'test-results/jack-option-a-blender.png')
TEX = Path('/tmp/jitb_option_a_textures')


def clear_texture_nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for node in list(nt.nodes):
        if node.bl_idname in ('ShaderNodeTexImage', 'ShaderNodeNormalMap'):
            nt.nodes.remove(node)


def apply_pbr_set(mat, stem, normal_strength=0.55):
    clear_texture_nodes(mat)
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    albedo = bpy.data.images.load(str(TEX / f'{stem}_albedo.png'), check_existing=False)
    rough = bpy.data.images.load(str(TEX / f'{stem}_roughness.png'), check_existing=False)
    normal = bpy.data.images.load(str(TEX / f'{stem}_normal.png'), check_existing=False)
    albedo.colorspace_settings.name = 'sRGB'
    rough.colorspace_settings.name = 'Non-Color'
    normal.colorspace_settings.name = 'Non-Color'

    tex_a = nt.nodes.new('ShaderNodeTexImage'); tex_a.name = f'{stem}_Albedo'; tex_a.image = albedo
    tex_r = nt.nodes.new('ShaderNodeTexImage'); tex_r.name = f'{stem}_Roughness'; tex_r.image = rough
    tex_n = nt.nodes.new('ShaderNodeTexImage'); tex_n.name = f'{stem}_Normal'; tex_n.image = normal
    nmap = nt.nodes.new('ShaderNodeNormalMap'); nmap.name = f'{stem}_NormalMap'; nmap.inputs['Strength'].default_value = normal_strength
    nt.links.new(tex_a.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex_r.outputs['Color'], bsdf.inputs['Roughness'])
    nt.links.new(tex_n.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])


apply_pbr_set(PAINT, 'blue_paint', 0.38)
apply_pbr_set(PAINT_DARK, 'dark_blue_paint', 0.34)
apply_pbr_set(WOOD, 'walnut', 0.62)
apply_pbr_set(FACE, 'carved_face', 0.30)
apply_pbr_set(CREAM, 'ivory', 0.22)

# Physically restrained surface response.
for m, roughness, metalness in [
    (PAINT, 0.56, 0.18), (PAINT_DARK, 0.62, 0.24), (CREAM, 0.68, 0.02),
    (RED, 0.60, 0.04), (BRASS, 0.43, 0.72), (STEEL, 0.35, 0.88),
    (WOOD, 0.70, 0.0), (FACE, 0.72, 0.0), (BURGUNDY, 0.84, 0.0), (BLUE_CLOTH, 0.84, 0.0)
]:
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metalness

# -----------------------------------------------------------------------------
# Jester refinement: antique carved puppet rather than cartoon/horror character.
# -----------------------------------------------------------------------------
# Remove the bright painted cartoon smile from V2.
for obj in list(bpy.data.objects):
    if obj.name.startswith('PaintedSmile'):
        bpy.data.objects.remove(obj, do_unlink=True)

# Make eyes tiny and inset, closer to glass beads set into a carved mask.
for obj in bpy.data.objects:
    if obj.name.startswith('EyeWhite'):
        obj.scale *= 0.72
        obj.location.y += 0.006
    elif obj.name.startswith('Pupil'):
        obj.scale *= 0.72
        obj.location.y += 0.007
    elif obj.name == 'Nose':
        obj.scale *= 0.82
        obj.location.y += 0.003

# Neutral carved mouth groove, only 8 cm wide in model scale.
mouth=[]
for i in range(18):
    t=i/17
    x=(t-0.5)*0.085
    z=0.345 - 0.004*math.cos((t-0.5)*math.pi*2)
    mouth.append((x,-0.169,z-0.36))
curve_tube('CarvedMouthGroove', mouth, 0.0032, BLACK, jack, resolution=1)

# Thin upper eyelids / brow grooves reduce the doll-eye effect.
for side in (-1,1):
    pts=[]
    for i in range(12):
        t=i/11
        x=side*(0.020+t*0.032)
        z=0.438-0.36 + math.sin(t*math.pi)*0.004
        pts.append((x,-0.164,z))
    curve_tube('EyeLidGroove', pts, 0.0026, BLACK, jack, resolution=1)

# Add a simple carved ear on each side of the head; this makes the head read as a crafted doll, not a sphere.
for side in (-1,1):
    ear=sphere('CarvedEar', (side*0.158,-0.002,0.392-0.36), (0.028,0.018,0.050), FACE, jack, 28, 14)
    ear.rotation_euler[2]=side*0.12

# Replace perfectly round brass bells with smaller aged bells.
for obj in bpy.data.objects:
    if obj.name.startswith('LeftBell') or obj.name.startswith('RightBell'):
        obj.scale *= 0.72

# Add a stitched seam to the cloth collar and cap using dark thread-like geometry.
for i in range(10):
    a=2*math.pi*i/10
    x=math.cos(a)*0.145; y=math.sin(a)*0.145
    cylinder('CollarStitch', (x,y,0.245-0.36), 0.0028, 0.018, BLACK, jack, 12, (math.pi/2,0,0), 0.0)

# Slightly irregular front enamel chips, now subordinate to texture wear.
rng=random.Random(141419)
for idx in range(8):
    x=rng.choice([rng.uniform(-0.53,-0.44),rng.uniform(0.44,0.53)])
    z=rng.uniform(-0.42,0.35)
    mark=cube(f'EdgeChipV4_{idx}',(x,-0.542,z),(rng.uniform(0.022,0.055),0.003,rng.uniform(0.004,0.010)),WORN,housing,0.0004,1)
    mark.rotation_euler[1]=rng.uniform(-0.5,0.5)

# Apply modifiers created after the reused V2 application pass.
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

housing['asset_version']='jack-in-the-box-v5-original-blender'
housing['visual_direction']='realistic vintage mechanical toy, original project mesh and PBR maps'
housing['external_geometry']='none'
housing['external_textures']='none'

# Export the neutral pose expected by the runtime.
os.makedirs(os.path.dirname(OUT),exist_ok=True)
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

# Mandatory visual review in the same assembly locations as the gameplay hosts.
lid.location=(-0.58,0.0,0.52)
lid.rotation_euler[1]=math.radians(-58)
drive.location=(0.79,-0.64,-0.03)
jack.location=(0.0,0.0,0.58)
spring_root.scale.z=2.18
spring_root.location.z=-0.48*(1.0-spring_root.scale.z)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1024
scene.render.resolution_y=1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
if scene.world is None:
    scene.world=bpy.data.worlds.new('StudioWorld')
scene.world.color=(0.19,0.205,0.215)
try: scene.view_settings.look='AgX - Medium High Contrast'
except Exception: pass

bpy.ops.mesh.primitive_plane_add(size=12,location=(0,0,-0.72))
ground=bpy.context.object
ground.data.materials.append(material('Neutral studio floor',(0.50,0.52,0.53),0.0,0.92))

def area(name,loc,energy,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=loc
    target=Vector((0,0,0.25)); obj.rotation_euler=(target-Vector(loc)).to_track_quat('-Z','Y').to_euler()

area('Key',(4.2,-5.5,5.2),1100,4.0,(1.0,0.93,0.84))
area('Fill',(-4.0,-2.0,3.0),700,3.8,(0.77,0.88,1.0))
area('Rim',(2.8,4.3,4.2),800,3.1,(1.0,0.88,0.76))

cam_data=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',cam_data); bpy.context.collection.objects.link(cam)
cam.location=(3.6,-5.3,2.45)
target=Vector((0.08,0.0,0.28)); cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
cam_data.lens=62
scene.camera=cam
os.makedirs(os.path.dirname(PREVIEW),exist_ok=True)
scene.render.filepath=PREVIEW
bpy.ops.render.render(write_still=True)

triangles=0
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj!=ground:
        triangles += sum(max(0,len(p.vertices)-2) for p in obj.data.polygons)
print({'out':OUT,'preview':PREVIEW,'triangles':triangles,'objects':len(bpy.context.scene.objects)})
