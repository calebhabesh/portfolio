"""Build a repeatable, subtly worn geometry derivative without changing the source.

Run through npm run weather:model. Fine pits/scuffs and patina use the browser's
triplanar material; this Blender pass adds shallow irregularity to the silhouette.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent.parent / 'models' / 'emblem'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'lion_emblem.blend'))
bpy.ops.object.select_all(action='DESELECT')
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in meshes:
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # Object-space coordinates keep front, back and wall sampling at equal scale.
    texture = bpy.data.textures.new(f'{obj.name} circulation wear', type='CLOUDS')
    texture.noise_scale = 0.026
    texture.noise_depth = 2
    texture.use_color_ramp = True
    ramp = texture.color_ramp
    ramp.elements[0].position = 0.48
    ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
    ramp.elements[1].position = 0.76
    ramp.elements[1].color = (0.0, 0.0, 0.0, 1)
    wear = obj.modifiers.new('Sparse circulation dents', 'DISPLACE')
    wear.texture = texture
    wear.texture_coords = 'GLOBAL'
    # Long triangles across the flat fields turn displacement into parallel ridges.
    # Keep geometry wear on the perimeter; the isotropic shader details every face.
    edge_wear = obj.vertex_groups.new(name='Perimeter wear')
    for vertex in obj.data.vertices:
        weight = max(0.0, 1.0 - abs(vertex.normal.y) / 0.45) ** 2
        if weight > 0.0:
            edge_wear.add([vertex.index], weight, 'REPLACE')
    wear.vertex_group = edge_wear.name
    wear.strength = 0.001
    wear.mid_level = 0.5
    # Displace before weighted normals / edge splitting to keep seams connected.
    bpy.ops.object.modifier_move_up(modifier=wear.name)
    bpy.ops.object.modifier_move_up(modifier=wear.name)
    obj['wear_notes'] = 'Sparse shallow dents; fine patina and scuffs supplied by the web material.'

# This derivative is reproducible; avoid accumulating Blender backup copies.
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'lion_emblem.vintage.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'lion_emblem.vintage.glb'),
                          export_format='GLB', use_selection=True, export_apply=True)
print('Vintage geometry exported; source Blender project preserved.')
