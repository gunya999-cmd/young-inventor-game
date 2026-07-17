import json
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


def set_supported_look(scene):
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        try:
            scene.view_settings.look = look
            print(f"ForgeKit color look: {look}")
            return
        except (TypeError, ValueError, AttributeError):
            continue
    print("ForgeKit color look: Blender default")


def disable_all_denoising(scene):
    # Ubuntu's Blender 4.0.2 package is built without OpenImageDenoiser.
    cycles = getattr(scene, "cycles", None)
    if cycles is not None:
        for property_name in (
            "use_denoising",
            "use_preview_denoising",
            "use_guiding",
        ):
            if hasattr(cycles, property_name):
                try:
                    setattr(cycles, property_name, False)
                except (TypeError, ValueError, AttributeError):
                    pass

    for view_layer in scene.view_layers:
        layer_cycles = getattr(view_layer, "cycles", None)
        if layer_cycles is None:
            continue
        for property_name in (
            "use_denoising",
            "denoising_store_passes",
        ):
            if hasattr(layer_cycles, property_name):
                try:
                    setattr(layer_cycles, property_name, False)
                except (TypeError, ValueError, AttributeError):
                    pass

    scene.render.use_compositing = False
    print("ForgeKit denoising: disabled")


def compatible_setup_scene(render_config):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = min(int(render_config.get("samples", 32)), 16)
    scene.cycles.use_adaptive_sampling = False
    if hasattr(scene.cycles, "preview_samples"):
        scene.cycles.preview_samples = min(8, scene.cycles.samples)
    disable_all_denoising(scene)

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

    print(f"ForgeKit render engine: {scene.render.engine}")
    print(f"ForgeKit Cycles CPU samples: {scene.cycles.samples}")
    return camera


def smoke_or_full_main():
    with open(forgekit.SPEC_PATH, "r", encoding="utf-8") as handle:
        spec = json.load(handle)

    requested_limit = int(os.environ.get("FORGEKIT_LIMIT", "0"))
    parts = spec["parts"][:requested_limit] if requested_limit > 0 else spec["parts"]

    for part in parts:
        forgekit.render_part(part, spec)

    manifest_spec = dict(spec)
    manifest_spec["parts"] = parts
    forgekit.write_manifest(manifest_spec)
    print(f"ForgeKit complete: {len(parts)} parts")


print(f"ForgeKit Blender version: {bpy.app.version_string}")
forgekit.setup_scene = compatible_setup_scene
smoke_or_full_main()
