"""Render every exported clip at its midpoint, then emit a small inspection report.
Blender --background --factory-startup --disable-autoexec --python-exit-code 1
  --python review_clips.py -- CHARACTER.glb OUTPUT_DIRECTORY
"""
import sys,json
from pathlib import Path
import bpy
from mathutils import Vector
source,out=[Path(a).resolve() for a in sys.argv[sys.argv.index('--')+1:]]
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
scene=bpy.context.scene
owners=[]
rest={obj:obj.matrix_basis.copy() for obj in scene.objects}
for obj in list(scene.objects):
    if obj.animation_data:owners.append(obj)
    if obj.type=='MESH' and obj.data.shape_keys and obj.data.shape_keys.animation_data:owners.append(obj.data.shape_keys)
clips={track.name for owner in owners for track in owner.animation_data.nla_tracks}
scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=420;scene.render.resolution_y=420;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.world=bpy.data.worlds.new('Review');scene.world.color=(.2,.2,.2)
for loc,energy in [((3,-4,5),200),((-3,-2,3),100),((0,3,4),180)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=4
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-6,1.2));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.75;scene.camera=camera;scene.view_settings.view_transform='Standard'
report=[]
for name in sorted(clips):
    end=0
    for obj,matrix in rest.items():obj.matrix_basis=matrix.copy()
    for owner in owners:
        owner.animation_data.action=None
        for track in owner.animation_data.nla_tracks:
            track.mute=True
            if track.name==name and track.strips:
                strip=track.strips[0];owner.animation_data.action=strip.action
                owner.animation_data.action_slot=strip.action_slot
                end=max(end,strip.frame_end)
    scene.frame_set(round(end*.48));bpy.context.view_layer.update()
    scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
    bounds=[obj.matrix_world @ Vector(corner) for obj in scene.objects if obj.type=='MESH' and obj.name!='Icosphere' and not obj.hide_render for corner in obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).bound_box]
    report.append({'clip':name,'duration':end/scene.render.fps,'sampleFrame':scene.frame_current,
        'minimumZ':min(v.z for v in bounds),'maximumZ':max(v.z for v in bounds)})
(out/'review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('CLIPS_REVIEWED',len(report))
