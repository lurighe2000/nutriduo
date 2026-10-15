"""Export a neutral geometry review, not an animation-ready character.

Blender 4.5 --background --factory-startup --disable-autoexec
  --python-exit-code 1 --python prepare_sculpt.py -- INPUT.glb OUTPUT.glb SOURCE.blend

The sole appearance input was Luca's selected Angel JPG. Preserve the raw
generated source separately. No recolored Stitch geometry is used here.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def prepare(source, output, project):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(meshes) != 1:
        raise ValueError('Expected the single-mesh, unrigged geometry result')
    mesh = meshes[0]
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    points = [v.co.copy() for v in mesh.data.vertices]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    scale = 2 / (high.z-low.z)
    origin = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    for vertex in mesh.data.vertices:
        vertex.co = (vertex.co-origin)*scale
    mesh.name = 'AngelVolumeStudy_NotRigged'
    modifier = mesh.modifiers.new('GeometryReviewBudget', 'DECIMATE')
    modifier.ratio = .28
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for face in mesh.data.polygons:
        face.use_smooth = True
    clay = bpy.data.materials.new('NeutralReview_NotFinalColor')
    clay.use_nodes = True
    shader = clay.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (.30,.32,.36,1)
    shader.inputs['Roughness'].default_value = .8
    mesh.data.materials.clear()
    mesh.data.materials.append(clay)
    mesh['reviewStatus'] = 'Unrigged sculpt; ear, face and limb corrections outstanding'
    mesh['soleVisualReference'] = 'e9d7c2032d1d829d746280cefeae2df4.jpg'
    for path in (output, project):
        path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(project))
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',
                              use_selection=True,export_animations=False,
                              export_extras=True,export_materials='EXPORT')
    print('Geometry review:',len(mesh.data.vertices),'vertices,',len(mesh.data.polygons),'triangles')


if __name__ == '__main__':
    prepare(*[Path(a).resolve() for a in sys.argv[sys.argv.index('--')+1:]])
