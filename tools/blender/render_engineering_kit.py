import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(ROOT, "engineering_kit_spec.json")
OUTPUT_DIR = os.path.abspath(os.path.join(ROOT, "..", "..", "generated-assets", "forgekit"))
ICON_DIR = os.path.join(OUTPUT_DIR, "icons")

MATERIAL_CACHE = {}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)
    MATERIAL_CACHE.clear()


def principled_material(name, color, metallic, roughness, noise_strength=0.0):
    if name in MATERIAL_CACHE:
        return MATERIAL_CACHE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if noise_strength > 0:
        noise = nodes.new("ShaderNodeTexNoise")
        bump = nodes.new("ShaderNodeBump")
        noise.inputs["Scale"].default_value = 42.0
        noise.inputs["Detail"].default_value = 2.0
        noise.inputs["Roughness"].default_value = 0.62
        bump.inputs["Strength"].default_value = noise_strength
        bump.inputs["Distance"].default_value = 0.018
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    MATERIAL_CACHE[name] = mat
    return mat


def get_material(key):
    palette = {
        "blue_steel": ("Forge blue", (0.025, 0.105, 0.205), 0.68, 0.24, 0.08),
        "orange_steel": ("Safety orange", (0.88, 0.16, 0.025), 0.48, 0.27, 0.06),
        "brushed_steel": ("Brushed steel", (0.34, 0.37, 0.40), 0.96, 0.18, 0.17),
        "dark_steel": ("Dark steel", (0.045, 0.055, 0.065), 0.88, 0.24, 0.11),
        "black_rubber": ("Black rubber", (0.012, 0.015, 0.018), 0.0, 0.72, 0.18),
        "brass": ("Warm brass", (0.43, 0.21, 0.045), 0.82, 0.23, 0.08),
    }
    name, color, metallic, roughness, noise = palette[key]
    return principled_material(name, color, metallic, roughness, noise)


def apply_bevel(obj, width=0.055, segments=4):
    mod = obj.modifiers.new("Industrial edge bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def rounded_box(name, dimensions, location=(0, 0, 0), material_key="blue_steel", bevel=0.055):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(get_material(material_key))
    apply_bevel(obj, bevel, 5)
    return obj


def cylinder(name, radius, depth, location=(0, 0, 0), axis="Z", material_key="brushed_steel", vertices=64):
    rotation = (0, 0, 0)
    if axis == "X":
        rotation = (0, math.radians(90), 0)
    elif axis == "Y":
        rotation = (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(get_material(material_key))
    apply_bevel(obj, min(radius * 0.12, 0.045), 4)
    return obj


def torus(name, major_radius, minor_radius, location=(0, 0, 0), axis="Y", material_key="brushed_steel"):
    rotation = (0, 0, 0)
    if axis == "X":
        rotation = (0, math.radians(90), 0)
    elif axis == "Y":
        rotation = (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=18,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(get_material(material_key))
    bpy.ops.object.shade_smooth()
    return obj


def boolean_hole(obj, location, radius, depth, axis="Y"):
    rotation = (0, 0, 0)
    if axis == "X":
        rotation = (0, math.radians(90), 0)
    elif axis == "Y":
        rotation = (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    cutter = bpy.context.object
    modifier = obj.modifiers.new("Standard connector hole", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    bpy.data.objects.remove(cutter, do_unlink=True)


def add_hole_ring(location, radius, front_y, material_key="brushed_steel"):
    return torus(
        "Connector rim",
        major_radius=radius * 1.34,
        minor_radius=radius * 0.16,
        location=(location[0], front_y, location[2]),
        axis="Y",
        material_key=material_key,
    )


def perforated_bar(name, holes, pitch, height, depth, hole_radius, axis="X", material_key="blue_steel", location=(0, 0, 0)):
    end_margin = pitch * 0.58
    length = (holes - 1) * pitch + end_margin * 2
    if axis == "X":
        dims = (length, depth, height)
    else:
        dims = (height, depth, length)
    bar = rounded_box(name, dims, location, material_key, bevel=min(height, depth) * 0.22)
    positions = []
    for index in range(holes):
        offset = -((holes - 1) * pitch) / 2 + index * pitch
        if axis == "X":
            hole_location = (location[0] + offset, location[1], location[2])
        else:
            hole_location = (location[0], location[1], location[2] + offset)
        boolean_hole(bar, hole_location, hole_radius, depth * 4.0, axis="Y")
        add_hole_ring(hole_location, hole_radius, location[1] - depth / 2 - 0.012)
        positions.append(hole_location)
    return bar, positions, length


def parent_to_root(objects):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root = bpy.context.object
    root.name = "Asset root"
    for obj in objects:
        if obj and obj != root:
            obj.parent = root
    root.rotation_euler = (
        math.radians(7),
        math.radians(-10),
        math.radians(-7),
    )
    return root


def build_beam(part, system):
    pitch = system["blender_module"]
    objects = []
    bar, _, _ = perforated_bar(
        part["id"],
        part["holes"],
        pitch,
        0.42,
        0.24,
        0.12,
        "X",
        part["material"],
    )
    objects.append(bar)
    return parent_to_root(objects)


def build_angle_bracket(part, system):
    pitch = system["blender_module"]
    objects = []
    horizontal_length = (part["horizontal_holes"] - 1) * pitch + pitch * 1.16
    vertical_length = (part["vertical_holes"] - 1) * pitch + pitch * 1.16
    h_location = ((horizontal_length - 0.42) / 2 - horizontal_length / 2, 0, 0)
    horizontal, _, _ = perforated_bar(
        "Angle horizontal",
        part["horizontal_holes"], pitch, 0.42, 0.24, 0.12, "X", part["material"],
        location=(horizontal_length * 0.25, 0, 0),
    )
    vertical, _, _ = perforated_bar(
        "Angle vertical",
        part["vertical_holes"], pitch, 0.42, 0.24, 0.12, "Z", part["material"],
        location=(-horizontal_length * 0.25, 0, vertical_length * 0.25),
    )
    corner = rounded_box(
        "Reinforced corner",
        (0.58, 0.30, 0.58),
        location=(-horizontal_length * 0.25, 0, 0),
        material_key="dark_steel",
        bevel=0.06,
    )
    objects.extend([horizontal, vertical, corner])
    return parent_to_root(objects)


def build_upright(part, system):
    pitch = system["blender_module"]
    objects = []
    post, _, post_length = perforated_bar(
        "Upright post", part["holes"], pitch, 0.42, 0.24, 0.12, "Z", part["material"],
        location=(0, 0, post_length_placeholder(part["holes"], pitch) / 2),
    )
    base = rounded_box("Upright base", (2.1, 0.72, 0.22), (0, 0.03, 0), "dark_steel", 0.08)
    for x in (-0.68, 0.68):
        boolean_hole(base, (x, 0.03, 0), 0.13, 2.2, axis="Y")
        add_hole_ring((x, 0.03, 0), 0.13, -0.34)
    gusset_left = rounded_box("Left gusset", (0.34, 0.42, 0.82), (-0.42, 0.01, 0.38), "orange_steel", 0.05)
    gusset_right = rounded_box("Right gusset", (0.34, 0.42, 0.82), (0.42, 0.01, 0.38), "orange_steel", 0.05)
    objects.extend([post, base, gusset_left, gusset_right])
    return parent_to_root(objects)


def post_length_placeholder(holes, pitch):
    return (holes - 1) * pitch + pitch * 1.16


def build_axle(part, system):
    length = part["length_modules"] * system["blender_module"]
    objects = []
    shaft = cylinder("Axle shaft", 0.112, length, axis="X", material_key="brushed_steel")
    collar_left = cylinder("Axle left collar", 0.18, 0.14, location=(-length / 2 + 0.07, 0, 0), axis="X", material_key="dark_steel")
    collar_right = cylinder("Axle right collar", 0.18, 0.14, location=(length / 2 - 0.07, 0, 0), axis="X", material_key="dark_steel")
    objects.extend([shaft, collar_left, collar_right])
    return parent_to_root(objects)


def build_hinge(part, system):
    objects = []
    left = rounded_box("Hinge left leaf", (1.18, 0.24, 0.72), (-0.68, 0, 0), "orange_steel", 0.07)
    right = rounded_box("Hinge right leaf", (1.18, 0.24, 0.72), (0.68, 0, 0), "orange_steel", 0.07)
    for x in (-0.85, -0.50, 0.50, 0.85):
        target = left if x < 0 else right
        boolean_hole(target, (x, 0, 0), 0.105, 1.2, axis="Y")
        add_hole_ring((x, 0, 0), 0.105, -0.132)
    knuckle_positions = (-0.34, 0.0, 0.34)
    for index, z in enumerate(knuckle_positions):
        cylinder(
            f"Hinge knuckle {index}",
            0.17,
            0.30,
            location=(0, 0, z),
            axis="Z",
            material_key="dark_steel" if index == 1 else "orange_steel",
        )
        objects.append(bpy.context.object)
    pin = cylinder("Hinge pin", 0.075, 1.12, axis="Z", material_key="brushed_steel")
    objects.extend([left, right, pin])
    return parent_to_root(objects)


def build_lever(part, system):
    pitch = system["blender_module"]
    objects = []
    bar, positions, _ = perforated_bar(
        "Lever bar", part["holes"], pitch, 0.42, 0.24, 0.12, "X", part["material"]
    )
    pivot_location = positions[part["pivot_hole"]]
    boss = cylinder("Lever pivot boss", 0.27, 0.38, pivot_location, axis="Y", material_key="dark_steel")
    pin = cylinder("Lever pivot pin", 0.095, 0.56, pivot_location, axis="Y", material_key="brushed_steel")
    grip = cylinder("Lever grip", 0.15, 0.42, location=(positions[-1][0], -0.02, 0), axis="Y", material_key="black_rubber")
    objects.extend([bar, boss, pin, grip])
    return parent_to_root(objects)


def build_pulley(part, system):
    radius = part["radius_modules"] * system["blender_module"]
    objects = []
    core = cylinder("Pulley core", radius * 0.78, 0.30, axis="Y", material_key=part["material"], vertices=96)
    boolean_hole(core, (0, 0, 0), 0.12, 1.0, axis="Y")
    front = cylinder("Pulley front rim", radius, 0.08, location=(0, -0.19, 0), axis="Y", material_key=part["material"], vertices=96)
    back = cylinder("Pulley back rim", radius, 0.08, location=(0, 0.19, 0), axis="Y", material_key=part["material"], vertices=96)
    for rim in (front, back):
        boolean_hole(rim, (0, rim.location.y, 0), 0.12, 1.0, axis="Y")
    groove = torus("Pulley rope groove", radius * 0.86, radius * 0.075, (0, 0, 0), "Y", "black_rubber")
    axle = cylinder("Pulley axle", 0.105, 0.62, axis="Y", material_key="brushed_steel")
    hub = cylinder("Pulley hub", radius * 0.22, 0.42, axis="Y", material_key="dark_steel")
    objects.extend([core, front, back, groove, axle, hub])
    return parent_to_root(objects)


def build_weight(part, system):
    objects = []
    body = cylinder("Weight body", 0.58, 1.18, location=(0, 0, -0.06), axis="Z", material_key=part["material"], vertices=96)
    band = torus("Weight safety band", 0.56, 0.055, location=(0, 0, 0.22), axis="Z", material_key="orange_steel")
    neck = cylinder("Weight neck", 0.20, 0.24, location=(0, 0, 0.64), axis="Z", material_key="dark_steel")
    eye = torus("Weight eye", 0.22, 0.07, location=(0, 0, 0.93), axis="X", material_key="brushed_steel")
    objects.extend([body, band, neck, eye])
    return parent_to_root(objects)


def create_helix(name, coils, radius, height, wire_radius, location=(0, 0, 0), material_key="brushed_steel"):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = wire_radius
    curve_data.bevel_resolution = 5
    spline = curve_data.splines.new("POLY")
    steps = coils * 36
    spline.points.add(steps)
    for index in range(steps + 1):
        t = index / steps
        angle = t * coils * math.tau
        x = math.cos(angle) * radius + location[0]
        y = math.sin(angle) * radius * 0.34 + location[1]
        z = t * height + location[2]
        spline.points[index].co = (x, y, z, 1)
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(get_material(material_key))
    return obj


def build_spring_module(part, system):
    objects = []
    base = rounded_box("Spring base", (1.85, 0.82, 0.22), (0, 0, 0), "dark_steel", 0.08)
    for x in (-0.58, 0.58):
        boolean_hole(base, (x, 0, 0), 0.13, 2.0, axis="Y")
        add_hole_ring((x, 0, 0), 0.13, -0.42)
    coil = create_helix("Compression spring", part["coils"], 0.38, 1.45, 0.075, (0, 0, 0.18), "brushed_steel")
    lower = cylinder("Spring lower seat", 0.52, 0.16, location=(0, 0, 0.22), axis="Z", material_key="orange_steel")
    upper = cylinder("Spring upper seat", 0.52, 0.18, location=(0, 0, 1.72), axis="Z", material_key="orange_steel")
    top_pin = cylinder("Spring top pin", 0.11, 0.52, location=(0, 0, 1.96), axis="Z", material_key="brushed_steel")
    objects.extend([base, coil, lower, upper, top_pin])
    return parent_to_root(objects)


def build_part(part, system):
    builders = {
        "beam": build_beam,
        "angle_bracket": build_angle_bracket,
        "upright": build_upright,
        "axle": build_axle,
        "hinge": build_hinge,
        "lever": build_lever,
        "pulley": build_pulley,
        "weight": build_weight,
        "spring_module": build_spring_module,
    }
    builder = builders.get(part["type"])
    if not builder:
        raise ValueError(f"Unsupported ForgeKit part type: {part['type']}")
    return builder(part, system)


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_scene(render_config):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = render_config["samples"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = render_config["transparent"]
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("ForgeKit studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.020, 0.032, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42

    bpy.ops.object.camera_add(location=(6.4, -8.8, 5.8))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.lens = 52
    scene.camera = camera

    lights = [
        ("Key", "AREA", (-4.5, -5.5, 7.2), 1150, 5.0, (1.0, 0.86, 0.72)),
        ("Fill", "AREA", (4.8, -2.0, 3.8), 680, 4.0, (0.42, 0.66, 1.0)),
        ("Rim", "AREA", (2.0, 4.5, 6.0), 920, 3.2, (1.0, 0.24, 0.08)),
    ]
    for name, light_type, location, energy, size, color in lights:
        bpy.ops.object.light_add(type=light_type, location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.size = size
        light.data.color = color
        point_at(light, (0, 0, 0.35))

    return camera


def mesh_bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        if obj.hide_render:
            continue
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
        else:
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            if evaluated.bound_box:
                points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    if not points:
        return Vector((0, 0, 0)), 3.0
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    zs = [p.z for p in points]
    center = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    extent = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    return center, extent


def fit_camera(camera):
    bpy.context.view_layer.update()
    center, extent = mesh_bounds()
    offset = Vector((6.2, -8.6, 5.5))
    camera.location = center + offset
    point_at(camera, center)
    camera.data.ortho_scale = max(2.3, extent * 1.52)
    for obj in bpy.context.scene.objects:
        if obj.type == "LIGHT":
            point_at(obj, center)


def render_to(path, resolution):
    scene = bpy.context.scene
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_part(part, spec):
    clear_scene()
    camera = setup_scene(spec["render"])
    build_part(part, spec["system"])
    fit_camera(camera)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)
    render_to(os.path.join(OUTPUT_DIR, part["id"] + ".png"), spec["render"]["resolution"])
    render_to(os.path.join(ICON_DIR, part["id"] + ".png"), 256)
    print(f"Rendered ForgeKit part: {part['id']}")


def write_manifest(spec):
    manifest = {
        "system": spec["system"],
        "parts": [],
    }
    for part in spec["parts"]:
        manifest["parts"].append({
            **part,
            "sprite": f"forgekit/{part['id']}.png",
            "icon": f"forgekit/icons/{part['id']}.png",
        })
    with open(os.path.join(OUTPUT_DIR, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)


def main():
    with open(SPEC_PATH, "r", encoding="utf-8") as handle:
        spec = json.load(handle)
    for part in spec["parts"]:
        render_part(part, spec)
    write_manifest(spec)
    print(f"ForgeKit complete: {len(spec['parts'])} parts")


if __name__ == "__main__":
    main()
