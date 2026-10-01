import bpy
import math
from mathutils import Vector
import os
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "emblem"

def hex_to_linear(hex_str):
    """Converts sRGB hex string into linear RGB for Blender PBR nodes."""
    hex_str = hex_str.lstrip('#')
    srgb = [int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    def to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(to_linear(c) for c in srgb) + (1.0,)

def hex_to_srgb(hex_str):
    """Converts hex string into sRGB RGBA tuple for Blender viewport display."""
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)

def setup_rim_profile(curve, depth=0.0032, floor_height=0.68):
    """Configures a rounded tubular border bead with a dished recessed interior matching the Meshy reference."""
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.resolution_u = 48
    curve.bevel_mode = "PROFILE"
    curve.bevel_depth = depth
    prof = curve.bevel_profile
    
    while len(prof.points) > 2:
        prof.points.remove(prof.points[1])
        
    prof.points[0].location = (1.0, 0.0)          # Outer perimeter side wall
    prof.points[1].location = (0.0, floor_height) # Recessed interior plateau
    
    # Semicircular tubular bead arc
    prof.points.add(0.85, 0.62)
    prof.points.add(0.70, 0.94)
    prof.points.add(0.52, 1.00)  # Crest apex of the tube
    prof.points.add(0.35, 0.92)
    prof.points.add(0.20, 0.58)  # Inner dish fillet
    prof.update()

def create_lion_emblem(
    svg_path="/home/ethioking/dev/assets/Portfolio/blender-base-logo.svg",
    output_glb=str(MODEL_DIR / "lion_emblem.glb"),
    output_blend=str(MODEL_DIR / "lion_emblem.blend"),
    base_extrude=0.020,
    face_extrude=0.026,
    face_z_offset=0.008
):
    """
    Builds the production 3D Lion Emblem with raised border rims & recessed interior faces:
    - Stylized raised border rims on the face, mane petals, chin, and ears
    - Symmetrical, clean eye bevels with zero pinching, folding, or shadow artifacts
    - Micro-duplicate point cleanup on top left mane petal (path22) eliminating edge creases
    - Unified single-piece top petal (path5) planar-bisected at X = 0 for razor-sharp color split
    - Authentic SVG PBR palette: Gold/Yellow face (#fcdd09), Green left mane (#078930), Red right mane (#da121a), Brown inner ears (#a55a44)
    - Viewport Diffuse Colors for instant visibility in Blender's default Solid Mode
    - Weighted Normal modifier + Edge Split for pristine planar shading
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)

    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"SVG file not found at {svg_path}")

    # Import SVG
    bpy.ops.import_curve.svg(filepath=svg_path)

    # 1. Use unified top petal (path5) and remove split halves (path30 & path1)
    for p in ["path30", "path1"]:
        if p in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[p], do_unlink=True)

    mid_x = 0.15649905

    # 2. Perfect mirror of path20 (clean 12-pt petal) to path22 (green petal)
    p20 = bpy.data.objects.get("path20")
    p22 = bpy.data.objects.get("path22")
    if p20 and p22:
        bpy.data.objects.remove(p22, do_unlink=True)
        new_p22 = p20.copy()
        new_p22.data = p20.data.copy()
        new_p22.name = "path22"
        bpy.context.scene.collection.objects.link(new_p22)
        for bp in new_p22.data.splines[0].bezier_points:
            bp.co.x = 2 * mid_x - bp.co.x
            bp.handle_left.x = 2 * mid_x - bp.handle_left.x
            bp.handle_right.x = 2 * mid_x - bp.handle_right.x
        bpy.context.view_layer.objects.active = new_p22
        new_p22.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.curve.select_all(action="SELECT")
        bpy.ops.curve.switch_direction()
        bpy.ops.object.mode_set(mode="OBJECT")

    # 3. Smooth rounded eye joins on Face (path2)
    face_obj = bpy.data.objects.get("path2")
    if face_obj:
        old_pts = face_obj.data.splines[0].bezier_points

        clean_face = bpy.data.curves.new("clean_face", "CURVE")
        clean_face.dimensions = "2D"
        clean_face.fill_mode = "BOTH"
        clean_face.resolution_u = 32
        s_face = clean_face.splines.new("BEZIER")
        s_face.use_cyclic_u = True

        # Left eye continuous smooth rounded inner fillet and crisp pointed outer apex
        mod_pts = {
            26: (
                Vector((0.131564, 0.184091, 0)),
                Vector((0.131587, 0.180054, 0)),
                Vector((0.131564, 0.200000, 0))
            ),
            27: (
                Vector((0.128500, 0.218000, 0)),
                Vector((0.131564, 0.205000, 0)),
                Vector((0.125500, 0.226000, 0))
            ),
            28: (
                Vector((0.120000, 0.229500, 0)),
                Vector((0.124500, 0.227500, 0)),
                Vector((0.114000, 0.231383, 0))
            ),
            29: (
                Vector((0.108431, 0.231383, 0)),
                Vector((0.114000, 0.231383, 0)),
                Vector((0.098000, 0.231383, 0))
            ),
            30: (
                Vector((0.093500, 0.231342, 0)),
                Vector((0.097500, 0.231342, 0)),
                Vector((0.089500, 0.231342, 0))
            ),
            31: (
                Vector((0.086500, 0.229500, 0)),
                Vector((0.086500, 0.230500, 0)),
                Vector((0.086500, 0.228200, 0))
            ),
            32: (
                Vector((0.093500, 0.224200, 0)),
                Vector((0.089500, 0.226200, 0)),
                Vector((0.098500, 0.221500, 0))
            ),
            33: (
                Vector((0.104000, 0.218500, 0)),
                Vector((0.099500, 0.221000, 0)),
                Vector((0.110000, 0.216000, 0))
            ),
        }

        def mirror_point(src_co, src_hl, src_hr):
            co = Vector((2 * mid_x - src_co.x, src_co.y, src_co.z))
            hl = Vector((2 * mid_x - src_hr.x, src_hr.y, src_hr.z))
            hr = Vector((2 * mid_x - src_hl.x, src_hl.y, src_hl.z))
            return co, hl, hr

        left_idx_map = {
            14: 34,
            15: 33,
            16: 32,
            17: 31,
            18: 30,
            19: 29,
            20: 28,
            21: 27,
            22: 26,
        }

        new_face_pts = []
        for i in range(len(old_pts)):
            if i in mod_pts:
                new_face_pts.append(mod_pts[i])
            elif i in left_idx_map:
                src_idx = left_idx_map[i]
                if src_idx in mod_pts:
                    src_co, src_hl, src_hr = mod_pts[src_idx]
                else:
                    src = old_pts[src_idx]
                    src_co, src_hl, src_hr = src.co, src.handle_left, src.handle_right
                new_face_pts.append(mirror_point(src_co, src_hl, src_hr))
            else:
                p = old_pts[i]
                new_face_pts.append((p.co.copy(), p.handle_left.copy(), p.handle_right.copy()))

        s_face.bezier_points.add(len(new_face_pts) - 1)
        for i, item in enumerate(new_face_pts):
            bp = s_face.bezier_points[i]
            bp.co = item[0]
            bp.handle_left = item[1]
            bp.handle_right = item[2]

        face_obj.data = clean_face

    # 4. Create PBR Materials matching the SVG color palette
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)

    def make_mat(name, hex_color, metallic=0.18, roughness=0.30):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        mat.diffuse_color = hex_to_srgb(hex_color)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = hex_to_linear(hex_color)
            bsdf.inputs["Roughness"].default_value = roughness
            if "Metallic" in bsdf.inputs:
                bsdf.inputs["Metallic"].default_value = metallic
        return mat

    mat_yellow = make_mat("Mat_Yellow", "fcdd09", metallic=0.20, roughness=0.28)
    mat_green  = make_mat("Mat_Green",  "078930", metallic=0.18, roughness=0.30)
    mat_red    = make_mat("Mat_Red",    "da121a", metallic=0.18, roughness=0.30)
    mat_brown  = make_mat("Mat_Brown",  "a55a44", metallic=0.15, roughness=0.35)

    curves = [obj for obj in bpy.context.scene.objects if obj.type == "CURVE"]

    # Configure 2D Curve geometry, raised rim profiles, and material assignments
    for obj in curves:
        curve = obj.data
        obj.data.materials.clear()

        if obj.name == "path2":  # Face: Tubular rounded rim
            obj.data.materials.append(mat_yellow)
            setup_rim_profile(curve, depth=0.0028, floor_height=0.68)
            curve.extrude = face_extrude
            obj.location.z = face_z_offset
        elif obj.name == "path24":  # Chin
            obj.data.materials.append(mat_yellow)
            setup_rim_profile(curve, depth=0.0032, floor_height=0.68)
            curve.extrude = base_extrude + 0.0015
            obj.location.z = 0.003
        elif obj.name in ["path33", "path33-5"]:  # Inner Ears
            obj.data.materials.append(mat_brown)
            setup_rim_profile(curve, depth=0.0022, floor_height=0.72)
            curve.extrude = base_extrude
            obj.location.z = 0.0
        elif obj.name in ["path28", "path6", "path10", "path14", "path18", "path22"]:  # Left Green
            obj.data.materials.append(mat_green)
            setup_rim_profile(curve, depth=0.0035, floor_height=0.68)
            curve.extrude = base_extrude
            obj.location.z = 0.0
        elif obj.name == "path5":  # Top Petal
            setup_rim_profile(curve, depth=0.0035, floor_height=0.68)
            curve.extrude = base_extrude
            obj.location.z = 0.0
        else:  # Right Red
            obj.data.materials.append(mat_red)
            setup_rim_profile(curve, depth=0.0035, floor_height=0.68)
            curve.extrude = base_extrude
            obj.location.z = 0.0

    # 5. Bisect top petal directly to ensure 100% clean material assignment
    top_petal = bpy.data.objects.get("path5")
    top_petal.select_set(True)
    bpy.context.view_layer.objects.active = top_petal
    bpy.ops.object.convert(target="MESH")

    xs = [v.co.x for v in top_petal.data.vertices]
    mid_x_petal = (min(xs) + max(xs)) / 2.0

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(plane_co=(mid_x_petal, 0, 0), plane_no=(1, 0, 0), clear_inner=False, clear_outer=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    top_petal.data.materials.append(mat_green)  # slot 0
    top_petal.data.materials.append(mat_red)    # slot 1

    for poly in top_petal.data.polygons:
        poly_cx = sum(top_petal.data.vertices[i].co.x for i in poly.vertices) / len(poly.vertices)
        if poly_cx >= mid_x_petal - 0.00001:
            poly.material_index = 1  # Red
        else:
            poly.material_index = 0  # Green

    # Convert all other curves to mesh
    other_curves = [obj for obj in bpy.context.scene.objects if obj.type == "CURVE"]
    for obj in other_curves:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = other_curves[0]
    bpy.ops.object.convert(target="MESH")

    # Join all objects into a single clean mesh
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    bpy.context.view_layer.objects.active = top_petal
    bpy.ops.object.join()

    emblem = bpy.context.active_object
    emblem.name = "Lion_Emblem"

    # Topology & Normal Clean-up
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.mode_set(mode="OBJECT")

    # Center origin
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    emblem.location = Vector((0, 0, 0))

    # Orient upright facing front (-Y) with Green on Left and Red on Right
    emblem.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Normalize scale to fit 2.0 bounding box
    max_dim = max(emblem.dimensions.x, emblem.dimensions.y, emblem.dimensions.z)
    if max_dim > 0:
        scale_factor = 2.0 / max_dim
        emblem.scale = (scale_factor, scale_factor, scale_factor)
        bpy.ops.object.transform_apply(scale=True)

    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    emblem.location = Vector((0, 0, 0))
    bpy.ops.object.transform_apply(location=True)

    # Shade smooth with Weighted Normal and Edge Split
    bpy.ops.object.shade_smooth()

    wn = emblem.modifiers.new(name="WeightedNormal", type="WEIGHTED_NORMAL")
    wn.keep_sharp = True
    wn.weight = 100

    es = emblem.modifiers.new(name="EdgeSplit", type="EDGE_SPLIT")
    es.split_angle = math.radians(40)
    es.use_edge_angle = True

    # Setup Camera and Studio Lighting
    cam_data = bpy.data.cameras.new("Camera")
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_obj.location = (-1.4, -2.6, 1.1)
    cam_obj.rotation_euler = (math.radians(68), 0, math.radians(-28))

    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.08, 0.08, 0.09, 1.0)

    l1 = bpy.data.lights.new("Key", type="SUN")
    l1.energy = 4.0
    lo1 = bpy.data.objects.new("Key", l1)
    bpy.context.scene.collection.objects.link(lo1)
    lo1.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

    l2 = bpy.data.lights.new("Fill", type="SUN")
    l2.energy = 1.8
    lo2 = bpy.data.objects.new("Fill", l2)
    bpy.context.scene.collection.objects.link(lo2)
    lo2.rotation_euler = (math.radians(30), math.radians(-30), math.radians(60))

    l3 = bpy.data.lights.new("Rim", type="SUN")
    l3.energy = 3.5
    lo3 = bpy.data.objects.new("Rim", l3)
    bpy.context.scene.collection.objects.link(lo3)
    lo3.rotation_euler = (math.radians(-60), math.radians(20), math.radians(140))

    # Save Blend file
    Path(output_blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=output_blend)
    print(f"Saved Blender project to: {output_blend}")

    # Export web-ready GLB
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format="GLB",
        use_selection=False,
        export_apply=True
    )
    print(f"Exported web-ready GLB to: {output_glb}")

if __name__ == "__main__":
    create_lion_emblem()
