import bpy, math, os
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'generated-assets','level01-v3')
os.makedirs(OUT,exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for db in (bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.cameras,bpy.data.lights):
        pass

def mat(name,color,metallic=0.0,roughness=0.45):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Roughness'].default_value=roughness
    return m

ALU=mat('Brushed aluminium',(0.47,0.50,0.52),0.78,0.28)
DARK=mat('Dark steel',(0.08,0.09,0.10),0.88,0.22)
STEEL=mat('Machined steel',(0.32,0.35,0.37),0.9,0.18)
RUBBER=mat('Rubber',(0.035,0.04,0.045),0.0,0.72)
ROPE=mat('Natural rope',(0.36,0.31,0.24),0.0,0.9)
WHITE=mat('Studio polymer',(0.72,0.73,0.72),0.02,0.55)

def bevel(obj,amount=0.08,segments=3):
    mod=obj.modifiers.new('Bevel','BEVEL');mod.width=amount;mod.segments=segments
    mod.limit_method='ANGLE'
    bpy.ops.object.shade_smooth()
    return obj

def cube(name,scale,loc=(0,0,0),material=ALU,bevel_amt=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel(o,bevel_amt)
    o.data.materials.append(material)
    return o

def cyl(name,r,depth,loc=(0,0,0),rot=(0,0,0),material=ALU,verts=96,bevel_amt=.035):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object;o.name=name;bevel(o,bevel_amt);o.data.materials.append(material);return o

def torus(name,major,minor,loc=(0,0,0),rot=(0,0,0),material=ALU):
    bpy.ops.mesh.primitive_torus_add(major_segments=128,minor_segments=32,location=loc,rotation=rot,major_radius=major,minor_radius=minor)
    o=bpy.context.object;o.name=name;bpy.ops.object.shade_smooth();o.data.materials.append(material);return o

def uv_sphere(name,r,loc=(0,0,0),material=ALU):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128,ring_count=64,radius=r,location=loc)
    o=bpy.context.object;o.name=name;bpy.ops.object.shade_smooth();o.data.materials.append(material);return o

def setup_render(target=(0,0,0),distance=8.0):
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.world.color=(0.74,0.75,0.74)
    bpy.ops.object.camera_add(location=(0,-distance,1.2))
    cam=bpy.context.object
    direction=Vector(target)-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    cam.data.lens=58;scene.camera=cam
    bpy.ops.object.light_add(type='AREA',location=(-4,-4,7));key=bpy.context.object;key.data.energy=850;key.data.size=5.5
    bpy.ops.object.light_add(type='AREA',location=(5,-2,4));fill=bpy.context.object;fill.data.energy=420;fill.data.size=4
    bpy.ops.object.light_add(type='AREA',location=(0,3,6));rim=bpy.context.object;rim.data.energy=500;rim.data.size=3
    cube('Ground',(20,20,.15),(0,0,-1.25),WHITE,.03)

def export_and_render(name):
    scene=bpy.context.scene
    scene.render.filepath=os.path.join(OUT,f'{name}.png')
    bpy.ops.render.render(write_still=True)
    # select only visible mesh objects except studio floor
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type in {'MESH','CURVE'} and o.name!='Ground': o.select_set(True)
    glb=os.path.join(OUT,f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)


def build_ball():
    clear();setup_render(distance=6.4)
    ball=uv_sphere('Ball',1.0,(0,0,0),STEEL)
    # equatorial micro-groove and small rubber contact band for richer silhouette
    torus('EquatorGroove',1.0,.018,(0,0,0),(math.pi/2,0,0),DARK)
    export_and_render('ball-premium-v3')

def build_ramp():
    clear();setup_render(target=(0,0,.05),distance=9.5)
    rail=cube('RampBody',(6.8,1.0,.42),(0,0,0),ALU,.11)
    rail.rotation_euler[2]=math.radians(-8)
    # inset high-friction running strip
    strip=cube('RunningStrip',(6.15,.18,.47),(0,-.30,.02),RUBBER,.035);strip.rotation_euler[2]=rail.rotation_euler[2]
    # machined end caps and pivot boss
    for x in (-3.33,3.33):
        c=cyl('EndCap',.48,.46,(x,0,.02),(math.pi/2,0,0),STEEL,96,.04);c.rotation_euler[1]=math.pi/2
    pivot=cyl('PivotBoss',.44,.68,(2.75,.18,.05),(math.pi/2,0,0),DARK,96,.045);pivot.rotation_euler[1]=math.pi/2
    cyl('PivotPin',.16,.85,(2.75,.18,.05),(math.pi/2,0,0),STEEL,64,.02).rotation_euler[1]=math.pi/2
    export_and_render('ramp-premium-v3')

def build_pulley():
    clear();setup_render(distance=7.2)
    torus('PulleyOuter',1.18,.18,(0,0,.05),(math.pi/2,0,0),STEEL)
    torus('PulleyGroove',.91,.13,(0,0,.08),(math.pi/2,0,0),DARK)
    hub=cyl('Hub',.28,.62,(0,0,.05),(math.pi/2,0,0),DARK,96,.04)
    for a in range(0,360,45):
        spoke=cube('Spoke',(.12,1.45,.18),(0,.0,.05),ALU,.025);spoke.rotation_euler[2]=math.radians(a)
    cyl('Axle',.12,.92,(0,0,.05),(math.pi/2,0,0),STEEL,64,.02)
    # short rope segment visibly seated in groove
    curve=bpy.data.curves.new('RopeCurve','CURVE');curve.dimensions='3D';curve.bevel_depth=.055;curve.bevel_resolution=5
    spl=curve.splines.new('POLY');pts=[]
    for i in range(33):
        t=math.radians(195+(150*i/32));pts.append((.91*math.cos(t),.91*math.sin(t),.34,1))
    spl.points.add(len(pts)-1)
    for p,v in zip(spl.points,pts):p.co=v
    rope=bpy.data.objects.new('Rope',curve);bpy.context.collection.objects.link(rope);curve.materials.append(ROPE)
    export_and_render('pulley-premium-v3')

def build_fan():
    clear();setup_render(target=(0,0,.2),distance=10.5)
    # weighted cast base and telescoping stand
    cube('FanBase',(3.0,1.2,.32),(0,0,-1.0),DARK,.12)
    cyl('StandOuter',.18,4.5,(0,0,1.0),(0,0,0),STEEL,96,.035)
    cyl('StandInner',.11,1.2,(0,0,3.55),(0,0,0),ALU,96,.03)
    # motor housing behind rotor plane
    cyl('MotorHousing',.58,1.25,(0,.45,4.3),(math.pi/2,0,0),DARK,128,.09)
    torus('GuardOuter',1.82,.11,(0,0,4.3),(math.pi/2,0,0),STEEL)
    torus('GuardInner',1.63,.035,(0,0,4.3),(math.pi/2,0,0),ALU)
    # radial guard wires
    for a in range(0,360,15):
        wire=cube('GuardWire',(.035,3.1,.035),(0,0,4.3),ALU,.008);wire.rotation_euler[2]=math.radians(a)
    hub=cyl('FanHub',.34,.56,(0,-.05,4.3),(math.pi/2,0,0),DARK,128,.055)
    # curved blades as flattened beveled meshes
    for i in range(3):
        ang=math.radians(i*120)
        blade=cube('Blade',(1.5,.58,.10),(.83*math.cos(ang),.83*math.sin(ang),4.3),DARK,.16)
        blade.rotation_euler[2]=ang+math.radians(22)
        blade.scale.y=.75
    cyl('CenterCap',.23,.64,(0,-.12,4.3),(math.pi/2,0,0),STEEL,96,.04)
    export_and_render('fan-premium-v3')

for fn in (build_ball,build_ramp,build_pulley,build_fan): fn()
print('LEVEL01_V3_ASSETS_READY',OUT)
