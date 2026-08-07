import bpy, math, os
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'generated-assets','level01-v3')
os.makedirs(OUT,exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name,color,metallic=0.0,roughness=0.45):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Roughness'].default_value=roughness
    return m

# Clean-minimalism palette: bright metal is dominant; dark material is only an accent.
ALU=mat('Brushed aluminium',(0.68,0.70,0.71),0.76,0.31)
BRIGHT=mat('Satin aluminium',(0.76,0.78,0.79),0.72,0.24)
STEEL=mat('Machined steel',(0.54,0.57,0.59),0.86,0.20)
DARK=mat('Dark steel accent',(0.22,0.24,0.25),0.76,0.30)
RUBBER=mat('Rubber',(0.10,0.105,0.11),0.0,0.76)
ROPE=mat('Natural rope',(0.48,0.43,0.35),0.0,0.92)
WHITE=mat('Studio polymer',(0.88,0.88,0.86),0.02,0.68)

def bevel(obj,amount=0.08,segments=3):
    mod=obj.modifiers.new('Bevel','BEVEL');mod.width=amount;mod.segments=segments
    mod.limit_method='ANGLE'
    bpy.ops.object.shade_smooth()
    return obj

def cube(name,scale,loc=(0,0,0),material=ALU,bevel_amt=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel(o,bevel_amt);o.data.materials.append(material);return o

def cyl(name,r,depth,loc=(0,0,0),rot=(0,0,0),material=ALU,verts=96,bevel_amt=.035):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object;o.name=name;bevel(o,bevel_amt);o.data.materials.append(material);return o

def torus(name,major,minor,loc=(0,0,0),rot=(0,0,0),material=ALU):
    bpy.ops.mesh.primitive_torus_add(major_segments=128,minor_segments=32,location=loc,rotation=rot,major_radius=major,minor_radius=minor)
    o=bpy.context.object;o.name=name;bpy.ops.object.shade_smooth();o.data.materials.append(material);return o

def uv_sphere(name,r,loc=(0,0,0),material=ALU):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128,ring_count=64,radius=r,location=loc)
    o=bpy.context.object;o.name=name;bpy.ops.object.shade_smooth();o.data.materials.append(material);return o

def setup_render(target=(0,0,0),distance=8.0,camera_z=1.2):
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.35
    scene.world.color=(0.88,0.89,0.87)
    bpy.ops.object.camera_add(location=(0,-distance,camera_z))
    cam=bpy.context.object
    direction=Vector(target)-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    cam.data.lens=62;scene.camera=cam
    bpy.ops.object.light_add(type='AREA',location=(-4,-4,7));key=bpy.context.object;key.data.energy=1100;key.data.size=6.5
    bpy.ops.object.light_add(type='AREA',location=(5,-2,5));fill=bpy.context.object;fill.data.energy=650;fill.data.size=5
    bpy.ops.object.light_add(type='AREA',location=(0,3,7));rim=bpy.context.object;rim.data.energy=650;rim.data.size=4
    cube('Ground',(20,20,.15),(0,0,-1.25),WHITE,.03)

def export_and_render(name):
    scene=bpy.context.scene
    scene.render.filepath=os.path.join(OUT,f'{name}.png')
    bpy.ops.render.render(write_still=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type in {'MESH','CURVE'} and o.name!='Ground': o.select_set(True)
    glb=os.path.join(OUT,f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_draco_mesh_compression_enable=False)

def build_ball():
    clear();setup_render(distance=6.7)
    uv_sphere('Ball',1.0,(0,0,0),BRIGHT)
    # Fine machined seam: detail without turning the sphere into a black object.
    torus('EquatorGroove',1.003,.012,(0,0,0),(math.pi/2,0,0),DARK)
    export_and_render('ball-premium-v3')

def build_ramp():
    clear();setup_render(target=(0,0,.05),distance=9.8)
    rail=cube('RampBody',(6.8,1.0,.42),(0,0,0),BRIGHT,.11);rail.rotation_euler[2]=math.radians(-8)
    strip=cube('RunningStrip',(6.05,.13,.47),(0,-.31,.02),RUBBER,.028);strip.rotation_euler[2]=rail.rotation_euler[2]
    for x in (-3.32,3.32):
        cap=cyl('EndCap',.45,.44,(x,0,.02),(math.pi/2,0,0),STEEL,96,.035);cap.rotation_euler[1]=math.pi/2
    pivot=cyl('PivotBoss',.40,.66,(2.72,.18,.05),(math.pi/2,0,0),DARK,96,.04);pivot.rotation_euler[1]=math.pi/2
    pin=cyl('PivotPin',.13,.84,(2.72,.18,.05),(math.pi/2,0,0),BRIGHT,64,.02);pin.rotation_euler[1]=math.pi/2
    export_and_render('ramp-premium-v3')

def build_pulley():
    clear();setup_render(distance=7.5)
    torus('PulleyOuter',1.18,.17,(0,0,.05),(math.pi/2,0,0),BRIGHT)
    torus('PulleyGroove',.92,.105,(0,0,.08),(math.pi/2,0,0),STEEL)
    hub=cyl('Hub',.27,.62,(0,0,.05),(math.pi/2,0,0),DARK,96,.04)
    for a in range(0,360,45):
        spoke=cube('Spoke',(.105,1.42,.15),(0,0,.05),ALU,.022);spoke.rotation_euler[2]=math.radians(a)
    cyl('Axle',.105,.92,(0,0,.05),(math.pi/2,0,0),BRIGHT,64,.018)
    curve=bpy.data.curves.new('RopeCurve','CURVE');curve.dimensions='3D';curve.bevel_depth=.047;curve.bevel_resolution=6
    spl=curve.splines.new('POLY');pts=[]
    # Rope follows the top half of the groove and leaves vertically on both sides.
    pts.extend([(-.92,-.02,.30,1),(-.92,.18,.30,1)])
    for i in range(29):
        t=math.pi-(math.pi*i/28);pts.append((.92*math.cos(t),.18+.92*math.sin(t),.30,1))
    pts.extend([(.92,.18,.30,1),(.92,-.35,.30,1)])
    spl.points.add(len(pts)-1)
    for p,v in zip(spl.points,pts):p.co=v
    rope=bpy.data.objects.new('Rope',curve);bpy.context.collection.objects.link(rope);curve.materials.append(ROPE)
    export_and_render('pulley-premium-v3')

def build_fan():
    clear();setup_render(target=(0,0,2.25),distance=14.2,camera_z=2.4)
    cube('FanBase',(3.0,1.15,.32),(0,0,-1.0),STEEL,.12)
    cyl('StandOuter',.17,4.5,(0,0,1.0),(0,0,0),ALU,96,.035)
    cyl('StandInner',.105,1.2,(0,0,3.55),(0,0,0),BRIGHT,96,.025)
    cyl('MotorHousing',.58,1.25,(0,.45,4.3),(math.pi/2,0,0),DARK,128,.09)
    torus('GuardOuter',1.82,.105,(0,0,4.3),(math.pi/2,0,0),BRIGHT)
    torus('GuardInner',1.63,.032,(0,0,4.3),(math.pi/2,0,0),ALU)
    for a in range(0,360,15):
        wire=cube('GuardWire',(.028,3.08,.028),(0,0,4.3),ALU,.007);wire.rotation_euler[2]=math.radians(a)
    cyl('FanHub',.34,.56,(0,-.05,4.3),(math.pi/2,0,0),DARK,128,.055)
    for i in range(3):
        ang=math.radians(i*120)
        blade=cube('Blade',(1.55,.56,.09),(.83*math.cos(ang),.83*math.sin(ang),4.3),DARK,.18)
        blade.rotation_euler[2]=ang+math.radians(24);blade.scale.y=.72
    cyl('CenterCap',.23,.64,(0,-.12,4.3),(math.pi/2,0,0),STEEL,96,.04)
    export_and_render('fan-premium-v3')

for fn in (build_ball,build_ramp,build_pulley,build_fan): fn()
print('LEVEL01_V3_ASSETS_READY',OUT)
