import os, math
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT = os.environ.get('JITB_OUT', '/mnt/data/jitb-v4-clean.glb')
scene = trimesh.Scene()

# Subdued, physically readable materials: aged paint, exposed metal, brass and fabric.
def mat(name, rgba, metallic=0.0, rough=0.65):
    return PBRMaterial(name=name, baseColorFactor=np.array(rgba, dtype=np.uint8), metallicFactor=metallic, roughnessFactor=rough)

BLUE = mat('aged_cobalt_paint', [31, 72, 86, 255], 0.20, 0.70)
BLUE_DARK = mat('dark_blue_interior', [13, 31, 37, 255], 0.12, 0.82)
STEEL = mat('brushed_aged_steel', [116, 119, 116, 255], 0.92, 0.38)
STEEL_DARK = mat('blackened_steel', [48, 51, 49, 255], 0.94, 0.46)
BRASS = mat('aged_brass', [118, 87, 34, 255], 0.88, 0.42)
IVORY = mat('aged_ivory_paint', [181, 164, 129, 255], 0.08, 0.78)
RED = mat('aged_red_paint', [135, 39, 31, 255], 0.18, 0.66)
RED_DARK = mat('dark_red_lacquer', [93, 27, 23, 255], 0.15, 0.60)
WOOD = mat('dark_worn_wood', [69, 43, 27, 255], 0.03, 0.84)
SKIN = mat('painted_wood_face', [181, 142, 104, 255], 0.02, 0.71)
HAIR = mat('painted_carved_hair', [112, 43, 25, 255], 0.06, 0.76)
CLOTH = mat('aged_canvas_collar', [153, 142, 115, 255], 0.00, 0.94)
BLACK = mat('matte_black', [16, 17, 16, 255], 0.18, 0.82)
WHITE = mat('aged_eye_white', [204, 197, 176, 255], 0.0, 0.73)


def apply_material(mesh, material):
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def transform(mesh, scale=None, translation=None, rotation=None):
    if scale is not None:
        s = np.eye(4); s[0,0], s[1,1], s[2,2] = scale
        mesh.apply_transform(s)
    if rotation is not None:
        axis, angle = rotation
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    if translation is not None:
        mesh.apply_translation(translation)
    return mesh


def add(mesh, node, parent, material):
    apply_material(mesh, material)
    scene.add_geometry(mesh, node_name=node, parent_node_name=parent)


def box(extents, pos, node, parent, material):
    m = trimesh.creation.box(extents=extents)
    m.apply_translation(pos)
    add(m, node, parent, material)
    return m


def cyl(radius, height, pos, node, parent, material, sections=48, axis='z'):
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == 'x': m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0,1,0]))
    elif axis == 'y': m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1,0,0]))
    m.apply_translation(pos)
    add(m, node, parent, material)
    return m


def sphere(radius, pos, node, parent, material, scale=(1,1,1), subdivisions=3):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    transform(m, scale=scale, translation=pos)
    add(m, node, parent, material)
    return m


def cone(radius, height, pos, node, parent, material, sections=64):
    m = trimesh.creation.cone(radius=radius, height=height, sections=sections)
    # creation cone runs along z; rotate so vertical axis is +y
    m.apply_transform(trimesh.transformations.rotation_matrix(-math.pi/2, [1,0,0]))
    m.apply_translation(pos)
    add(m, node, parent, material)
    return m


def tube_between(a, b, radius, node, parent, material, sections=32):
    a=np.asarray(a,float); b=np.asarray(b,float); vec=b-a; length=np.linalg.norm(vec)
    m=trimesh.creation.cylinder(radius=radius,height=length,sections=sections)
    # cylinder axis z -> vec
    z=np.array([0.,0.,1.]); v=vec/length; cross=np.cross(z,v); dot=float(np.dot(z,v))
    if np.linalg.norm(cross)>1e-8:
        angle=math.acos(max(-1,min(1,dot))); m.apply_transform(trimesh.transformations.rotation_matrix(angle,cross/np.linalg.norm(cross)))
    elif dot < 0:
        m.apply_transform(trimesh.transformations.rotation_matrix(math.pi,[1,0,0]))
    m.apply_translation((a+b)/2)
    add(m,node,parent,material)


def helix_tube(turns=9.2, radius=0.115, wire=0.016, bottom=-0.49, top=-0.11, samples=420, sides=12):
    verts=[]; faces=[]
    ys=np.linspace(bottom,top,samples)
    theta=np.linspace(0,turns*2*math.pi,samples)
    centers=np.c_[radius*np.cos(theta),ys,radius*np.sin(theta)]
    for i,(c,t) in enumerate(zip(centers,theta)):
        tangent=np.array([-radius*math.sin(t), (top-bottom)/(turns*2*math.pi), radius*math.cos(t)])
        tangent/=np.linalg.norm(tangent)
        n=np.array([math.cos(t),0,math.sin(t)]); n/=np.linalg.norm(n)
        b=np.cross(tangent,n); b/=np.linalg.norm(b)
        for j in range(sides):
            a=2*math.pi*j/sides
            verts.append(c + wire*(math.cos(a)*n + math.sin(a)*b))
    for i in range(samples-1):
        for j in range(sides):
            nj=(j+1)%sides
            a=i*sides+j; bb=i*sides+nj; c=(i+1)*sides+nj; d=(i+1)*sides+j
            faces.extend([[a,bb,c],[a,c,d]])
    return trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)

# Create explicit assembly roots before adding child geometry.
for root in ['JITB_Housing','JITB_Lid','JITB_Drive','JITB_Jack','JITB_Spring']:
    scene.graph.update(frame_from=scene.graph.base_frame, frame_to=root, matrix=np.eye(4))

# ---------- HOUSING: thin sheet-metal panels, inner cavity, structural steel edges ----------
# Panels are deliberately flat; this removes the balloon/pillow shading of previous versions.
box([1.18,0.94,0.055],[0,-0.08,0.515],'housing_front_sheet','JITB_Housing',BLUE)
box([1.18,0.94,0.055],[0,-0.08,-0.515],'housing_back_sheet','JITB_Housing',BLUE)
box([0.055,0.94,0.98],[-0.60,-0.08,0],'housing_left_sheet','JITB_Housing',BLUE)
box([0.055,0.94,0.98],[0.60,-0.08,0],'housing_right_sheet','JITB_Housing',BLUE)
box([1.18,0.055,0.98],[0,-0.555,0],'housing_bottom_sheet','JITB_Housing',BLUE_DARK)
# Dark inset cavity lip
for x in (-0.54,0.54): box([0.045,0.055,0.90],[x,0.41,0],'top_lip_x_'+str(x),'JITB_Housing',STEEL_DARK)
for z in (-0.45,0.45): box([1.05,0.055,0.045],[0,0.41,z],'top_lip_z_'+str(z),'JITB_Housing',STEEL_DARK)
# Steel corner extrusions, caps, and bolts
for x in (-0.625,0.625):
    for z in (-0.54,0.54):
        cyl(0.032,1.02,[x,-0.08,z],f'corner_post_{x}_{z}','JITB_Housing',STEEL,32,axis='y')
        for y in (-0.50,0.34): sphere(0.038,[x,y,z],f'corner_cap_{x}_{y}_{z}','JITB_Housing',STEEL,subdivisions=2)
# horizontal edge rails
for y in (-0.55,0.42):
    for z in (-0.54,0.54): box([1.22,0.04,0.04],[0,y,z],f'rail_x_{y}_{z}','JITB_Housing',STEEL)
    for x in (-0.625,0.625): box([0.04,0.04,1.04],[x,y,0],f'rail_z_{y}_{x}','JITB_Housing',STEEL)
# front recessed wood/ivory placard, red diamond and fasteners
box([0.82,0.53,0.035],[0,-0.08,0.555],'front_wood_backer','JITB_Housing',WOOD)
box([0.77,0.48,0.018],[0,-0.08,0.578],'front_ivory_plate','JITB_Housing',IVORY)
diamond=trimesh.creation.box(extents=[0.29,0.29,0.018]); diamond.apply_transform(trimesh.transformations.rotation_matrix(math.pi/4,[0,0,1])); diamond.apply_translation([0,-0.08,0.596]); add(diamond,'front_red_diamond','JITB_Housing',RED)
for x in (-0.36,0.36):
    for y in (-0.30,0.14): cyl(0.022,0.018,[x,y,0.602],f'plate_screw_{x}_{y}','JITB_Housing',BRASS,24)
# extra body rivets
for x in (-0.53,0.53):
    for y in (-0.43,0.28): cyl(0.019,0.012,[x,y,0.548],f'body_rivet_{x}_{y}','JITB_Housing',BRASS,20)
# subtle exposed wear strips on lower edges
box([0.50,0.010,0.006],[-0.22,-0.535,0.585],'front_edge_wear','JITB_Housing',STEEL_DARK)
box([0.006,0.27,0.012],[0.588,0.05,0.542],'side_edge_wear','JITB_Housing',STEEL_DARK)

# ---------- LID relative to physical hinge host at (-0.58, .52, 0) ----------
box([1.16,0.075,1.04],[0.58,0.00,0],'lid_outer_sheet','JITB_Lid',BLUE)
box([1.08,0.022,0.96],[0.58,-0.048,0],'lid_inner_sheet','JITB_Lid',STEEL_DARK)
# rim rails
for z in (-0.51,0.51): box([1.18,0.045,0.035],[0.58,0.025,z],f'lid_rail_z_{z}','JITB_Lid',STEEL)
for x in (0.01,1.15): box([0.035,0.045,1.00],[x,0.025,0],f'lid_rail_x_{x}','JITB_Lid',STEEL)
# hinge knuckles along hinge edge z-axis
for z in (-0.36,-0.12,0.12,0.36): cyl(0.035,0.16,[0.03,-0.035,z],f'hinge_{z}','JITB_Lid',STEEL,28,axis='z')

# ---------- DRIVE relative to physical drive host ----------
cyl(0.265,0.10,[0,0,0],'drive_outer_pulley','JITB_Drive',STEEL_DARK,72)
cyl(0.205,0.115,[0,0,0.012],'drive_inner_disc','JITB_Drive',BRASS,72)
cyl(0.075,0.14,[0,0,0.028],'drive_hub','JITB_Drive',STEEL,48)
# concentric V groove rings as slim discs
for r,z in ((0.235,0.056),(0.225,-0.056)):
    cyl(r,0.018,[0,0,z],f'drive_ring_{r}_{z}','JITB_Drive',STEEL,72)
# crank arm in local XY plane, slightly bent feel using two rods
tube_between([0,0,0.082],[0.20,0.015,0.082],0.024,'crank_arm_1','JITB_Drive',BRASS,32)
tube_between([0.20,0.015,0.082],[0.315,0.06,0.082],0.024,'crank_arm_2','JITB_Drive',BRASS,32)
sphere(0.066,[0.335,0.07,0.082],'crank_knob','JITB_Drive',RED_DARK,scale=(1.0,1.0,0.92),subdivisions=3)

# ---------- JACK relative to moving physical jack host ----------
# carved neck/body base
cyl(0.18,0.16,[0,-0.10,0],'jack_collar_base','JITB_Jack',RED_DARK,64,axis='y')
cyl(0.10,0.14,[0,0.01,0],'jack_neck','JITB_Jack',SKIN,48,axis='y')
# vintage carved face - elliptical, less spherical/cartoonish
sphere(0.205,[0,0.19,0.00],'jack_head','JITB_Jack',SKIN,scale=(0.88,1.06,0.83),subdivisions=4)
# ears
sphere(0.055,[-0.185,0.20,0],'ear_left','JITB_Jack',SKIN,scale=(0.65,1.0,0.75),subdivisions=2)
sphere(0.055,[0.185,0.20,0],'ear_right','JITB_Jack',SKIN,scale=(0.65,1.0,0.75),subdivisions=2)
# glass eyes on forward +Z side
for x in (-0.067,0.067):
    sphere(0.031,[x,0.225,0.157],f'eye_white_{x}','JITB_Jack',WHITE,scale=(1.0,0.88,0.55),subdivisions=2)
    sphere(0.013,[x,0.225,0.174],f'eye_pupil_{x}','JITB_Jack',BLACK,scale=(1,1,0.55),subdivisions=2)
# restrained nose, brows and mouth details
sphere(0.041,[0,0.174,0.174],'jack_nose','JITB_Jack',RED_DARK,scale=(0.90,0.85,0.75),subdivisions=3)
for x in (-0.067,0.067): tube_between([x-0.025,0.273,0.168],[x+0.025,0.279,0.169],0.006,f'brow_{x}','JITB_Jack',HAIR,12)
tube_between([-0.055,0.117,0.174],[0,0.105,0.181],0.006,'mouth_left','JITB_Jack',RED_DARK,12)
tube_between([0,0.105,0.181],[0.055,0.117,0.174],0.006,'mouth_right','JITB_Jack',RED_DARK,12)
# carved hair clusters, smaller and irregular
hair_centers=[(-0.168,0.29,-0.015),(-0.18,0.235,-0.02),(-0.16,0.18,-0.03),(0.168,0.29,-0.015),(0.18,0.235,-0.02),(0.16,0.18,-0.03)]
for i,p in enumerate(hair_centers): sphere(0.063,p,f'hair_curl_{i}','JITB_Jack',HAIR,scale=(0.75,1.0,0.82),subdivisions=3)
# layered cloth ruff around neck
for i in range(16):
    a=2*math.pi*i/16
    p=[0.16*math.cos(a),0.045,0.16*math.sin(a)]
    m=trimesh.creation.icosphere(subdivisions=2,radius=0.055)
    transform(m,scale=(1.05,0.40,0.72),translation=p)
    add(m,f'ruff_{i}','JITB_Jack',CLOTH)
# hat and metal-ish tip
cone(0.13,0.25,[0,0.40,-0.005],'jack_hat','JITB_Jack',BLUE,64)
cyl(0.132,0.025,[0,0.405,0],'hat_band','JITB_Jack',BRASS,64,axis='y')
sphere(0.026,[0,0.535,0],'hat_tip','JITB_Jack',BRASS,subdivisions=3)

# ---------- SPRING root; loader stretches it with physical Jack position ----------
spring=helix_tube()
add(spring,'spring_wire','JITB_Spring',STEEL_DARK)

# Export with required root nodes in graph.
os.makedirs(os.path.dirname(OUT), exist_ok=True)
blob=scene.export(file_type='glb')
with open(OUT,'wb') as f: f.write(blob)
faces=sum(len(g.faces) for g in scene.geometry.values() if hasattr(g,'faces'))
print({'out':OUT,'bytes':len(blob),'faces':faces,'geometries':len(scene.geometry),'nodes':len(scene.graph.nodes)})
assert faces >= 30000, faces
for required in ['JITB_Housing','JITB_Lid','JITB_Drive','JITB_Jack','JITB_Spring']:
    assert required in scene.graph.nodes, required
