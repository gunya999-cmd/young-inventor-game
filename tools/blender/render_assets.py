import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(ROOT, 'asset_catalog.json')
OUTPUT_DIR = os.path.abspath(os.path.join(ROOT, '..', '..', 'generated-assets'))


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, base_color, metallic=0.0, roughness=0.45):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def wood_material():
    mat = bpy.data.materials.new('Worn wood')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    noise = nodes.new('ShaderNodeTexNoise')
    mapping = nodes.new('ShaderNodeMapping')
    tex = nodes.new('ShaderNodeTexCoord')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    noise.inputs['Scale'].default_value = 4.0
    noise.inputs['Detail'].default_value = 4.0
    noise.inputs['Roughness'].default_value = 0.72
    mapping.inputs['Scale'].default_value = (0.55, 5.0, 1.0)
    ramp.color_ramp.elements[0].color = (0.12, 0.035, 0.012, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.23, 0.055, 1)
    bump.inputs['Strength'].default_value = 0.22
    bump.inputs['Distance'].default_value = 0.08
    bsdf.inputs['Roughness'].default_value = 0.42

    links.new(tex.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def add_bevel(obj, width=0.06, segments=4):
    mod = obj.modifiers.new('Soft bevels', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()


def create_plank(asset):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.name = asset['id']
    obj.dimensions = (asset['length'], asset['width'], asset['thickness'])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    add_bevel(obj, asset.get('bevel', 0.08), 5)
    obj.data.materials.append(wood_material())

    # Two subtle dark end caps make the plank read better at game scale.
    cap_mat = material('Dark end grain', (0.16, 0.055, 0.018), 0.0, 0.5)
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(location=(side * asset['length'] / 2, 0, 0))
        cap = bpy.context.object
        cap.dimensions = (0.035, asset['width'] * 0.95, asset['thickness'] * 0.94)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        add_bevel(cap, 0.015, 2)
        cap.data.materials.append(cap_mat)
    return obj


def create_ball(asset):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=asset['radius'])
    obj = bpy.context.object
    obj.name = asset['id']
    obj.data.materials.append(material('Polished steel', (0.2, 0.24, 0.28), 0.92, 0.13))
    bpy.ops.object.shade_smooth()
    return obj


def create_weight(asset):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=asset['radius'], depth=asset['height'])
    body = bpy.context.object
    body.name = asset['id']
    body.data.materials.append(material('Dark steel', (0.055, 0.07, 0.08), 0.82, 0.25))
    add_bevel(body, 0.07, 4)

    bpy.ops.mesh.primitive_torus_add(major_radius=asset['radius'] * 0.42, minor_radius=0.09,
                                    major_segments=64, minor_segments=20,
                                    location=(0, 0, asset['height'] / 2 + 0.18))
    ring = bpy.context.object
    ring.rotation_euler.x = math.radians(90)
    ring.data.materials.append(material('Ring steel', (0.11, 0.13, 0.14), 0.9, 0.18))
    bpy.ops.object.shade_smooth()
    return body


def add_ground_shadow():
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.85))
    plane = bpy.context.object
    plane.data.materials.append(material('Shadow catcher', (0.025, 0.035, 0.045), 0.0, 0.68))


def point_camera(camera, target=(0, 0, 0)):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def setup_scene(resolution, samples, transparent):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = transparent
    scene.view_settings.look = 'Medium High Contrast'

    world = bpy.data.worlds.new('Studio world')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.018, 0.027, 0.04, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35

    bpy.ops.object.camera_add(location=(7.3, -8.8, 6.0))
    camera = bpy.context.object
    point_camera(camera, (0, 0, 0))
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 7.2
    scene.camera = camera

    bpy.ops.object.light_add(type='AREA', location=(-3.5, -4.5, 6.5))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.shape = 'DISK'
    key.data.size = 5.0
    point_camera(key, (0, 0, 0))

    bpy.ops.object.light_add(type='AREA', location=(4.5, -1.0, 3.0))
    fill = bpy.context.object
    fill.data.energy = 520
    fill.data.size = 4.0
    fill.data.color = (0.45, 0.68, 1.0)
    point_camera(fill, (0, 0, 0))

    bpy.ops.object.light_add(type='AREA', location=(0.0, 4.0, 5.0))
    rim = bpy.context.object
    rim.data.energy = 800
    rim.data.size = 3.0
    rim.data.color = (1.0, 0.36, 0.18)
    point_camera(rim, (0, 0, 0.5))


def render_asset(asset, render_cfg):
    clear_scene()
    setup_scene(render_cfg['resolution'], render_cfg['samples'], render_cfg['transparent'])

    if asset['type'] == 'plank':
        root = create_plank(asset)
        root.rotation_euler = (math.radians(8), math.radians(-7), math.radians(-10))
    elif asset['type'] == 'ball':
        root = create_ball(asset)
        root.location.z = -0.1
    elif asset['type'] == 'weight':
        root = create_weight(asset)
        root.location.z = -0.18
    else:
        raise ValueError(f"Unsupported asset type: {asset['type']}")

    add_ground_shadow()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(OUTPUT_DIR, asset['id'] + '.png')
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {asset['id']}")


def main():
    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    for asset in catalog['assets']:
        render_asset(asset, catalog['render'])


if __name__ == '__main__':
    main()
