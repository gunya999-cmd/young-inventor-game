import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import render_engineering_kit as forgekit


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def choose_render_engine(scene):
    available = {
        item.identifier
        for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    }
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        if candidate in available:
            scene.render.engine = candidate
            print(f"ForgeKit render engine: {candidate}")
            return candidate
    raise RuntimeError(f"No supported Blender render engine found. Available: {sorted(available)}")


def set_eevee_samples(scene, samples):
    eevee = getattr(scene, "eevee", None)
    if eevee is None:
        return
    for property_name in ("taa_render_samples", "taa_samples"):
        if hasattr(eevee, property_name):
            setattr(eevee, property_name, samples)
            print(f"ForgeKit samples: {property_name}={samples}")
            return


def set_supported_look(scene):
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        try:
            scene.view_settings.look = look
            print(f"ForgeKit color look: {look}")
            return
        except TypeError:
            continue
    print("ForgeKit color look: Blender default")


def compatible_setup_scene(render_config):
    scene = bpy.context.scene
    choose_render_engine(scene)
    set_eevee_samples(scene, int(render_config.get("samples", 32)))

    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = bool(render_config.get("transparent", True))
    set_supported_look(scene)
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("ForgeKit studio")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.012, 0.020, 0.032, 1)
        background.inputs["Strength"].default_value = 0.42

    bpy.ops.object.camera_add(location=(6.4, -8.8, 5.8))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.lens = 52
    scene.camera = camera

    lights = [
        ("Key", (-4.5, -5.5, 7.2), 1150, 5.0, (1.0, 0.86, 0.72)),
        ("Fill", (4.8, -2.0, 3.8), 680, 4.0, (0.42, 0.66, 1.0)),
        ("Rim", (2.0, 4.5, 6.0), 920, 3.2, (1.0, 0.24, 0.08)),
    ]
    for name, location, energy, size, color in lights:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.size = size
        light.data.color = color
        point_at(light, (0, 0, 0.35))

    return camera


print(f"ForgeKit Blender version: {bpy.app.version_string}")
forgekit.setup_scene = compatible_setup_scene
forgekit.main()
