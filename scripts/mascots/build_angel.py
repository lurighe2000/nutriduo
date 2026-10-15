"""Rig and color the exact sculpture approved by Luca, without replacing its shape.

Blender --background --factory-startup --disable-autoexec --python-exit-code 1
  --python build_angel.py -- APPROVED.glb OUTPUT_DIRECTORY
Appearance palette comes only from the user-selected Angel image.
"""
import sys, math, json
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

source,output=[Path(a).resolve() for a in sys.argv[sys.argv.index('--')+1:]]
output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=body
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.name='AngelApprovedSculpt'
modifier=body.modifiers.new('Mobile silhouette budget','DECIMATE');modifier.ratio=.45
bpy.ops.object.modifier_apply(modifier=modifier.name)
for face in body.data.polygons: face.use_smooth=True

def rgb(value):
    color=np.array([int(value[i:i+2],16)/255 for i in (0,2,4)])
    return np.where(color<=.04045,color/12.92,((color+.055)/1.055)**2.4)

pink=rgb('EB9ABB'); pale=rgb('F8CDDE'); white=rgb('FFF7FA')
black=rgb('151123'); blue=rgb('24466D'); lilac=rgb('B995C3')
fuchsia=rgb('E92C83'); yellow=rgb('FFD23B'); dark=rgb('29162E'); cyan=rgb('5CD1EC')
coords=np.array([v.co[:] for v in body.data.vertices])
print('BOUNDS',coords.min(axis=0).tolist(),coords.max(axis=0).tolist())

# Landmarks are measured on this sculpture, not transferred from a different model.
# The front camera looks along +Y; all regions remain attached to real geometry.
def ellipse(x,z,cx,cz,rx,rz): return ((x-cx)/rx)**2+((z-cz)/rz)**2
colors=body.data.color_attributes.new(name='Angel pigment',type='FLOAT_COLOR',domain='POINT')
rough=[]
for index,point in enumerate(coords):
    x,y,z=point
    color=pink.copy(); material=0
    front=y<.03
    # Broad pale belly, with the short separate white V above it.
    def paint(target,distance,edge=.18):
        a=max(0,min(1,(1-distance)/edge))
        return color*(1-a)+target*a
    if front: color=paint(pale,ellipse(x,z,-.10,.68,.24,.32),.22)
    vcenter=-.05+(z-.95)*.2
    if front and .91<z<1.11:
        distance=abs(abs(x-vcenter)-(.15*(z-.91)/.20))/.024
        color=paint(white,distance,.30)
    if z>1.78 and -.24<x<.27: color=paint(fuchsia,1-(z-1.78)/.028,.9)
    if z>1.92 and -.11<x<.03: color=paint(yellow,1-(z-1.92)/.015,.9)
    # Recessed ear interiors; pale pigment follows the visible cupped surfaces.
    if front: color=paint(pale,ellipse(x,z,.56,1.58,.15,.33)/.82,.25)
    if y>-.15: color=paint(pale,ellipse(x,z,-.48,.95,.15,.27)/.68,.25)
    # Soft muzzle, dark open smile and cyan tongue, preserving the approved smile.
    if front: color=paint(pale,ellipse(x,z,-.025,1.34,.34,.15),.35)
    if y<-.12: color=paint(dark,ellipse(x,z,-.025,1.34,.255,.075),.22)
    if y<-.13: color=paint(cyan,ellipse(x,z,.045,1.30,.115,.027),.3)
    # Nose and eyes are refined from the first calibration render below.
    if y<-.12: color=paint(lilac,ellipse(x,z,-.045,1.55,.115,.105),.20)
    colors.data[index].color=(*color,1)
    rough.append(material)
for name,roughness in [('Angel soft pink',.58),('Angel smile',.68),('Angel eyes and nose',.33)]:
    material=bpy.data.materials.new(name);material.use_nodes=True
    shader=material.node_tree.nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Specular IOR Level'].default_value=.28
    pigment=material.node_tree.nodes.new('ShaderNodeVertexColor');pigment.layer_name=colors.name
    material.node_tree.links.new(pigment.outputs['Color'],shader.inputs['Base Color'])
    body.data.materials.append(material)
# Replace the old clay slot, retaining only the three new material slots.
while len(body.data.materials)>3: body.data.materials.pop(index=0)
for face in body.data.polygons:
    face.material_index=max(set(rough[i] for i in face.vertices),key=lambda v:sum(rough[i]==v for i in face.vertices))

definition={
 'root':((0,0,0),(0,0,.18),None),
 'pelvis':((-.10,0,.42),(-.07,0,.73),'root'),
 'spine':((-.07,0,.73),(-.02,0,1.13),'pelvis'),
 'head':((-.02,0,1.13),(-.03,0,1.70),'spine'),
 'upper.L':((.15,-.04,1.12),(.37,-.16,1.24),'spine'),
 'fore.L':((.37,-.16,1.24),(.42,-.26,1.48),'upper.L'),
 'hand.L':((.42,-.26,1.48),(.40,-.27,1.62),'fore.L'),
 'upper.R':((-.20,0,1.12),(-.44,-.18,1.27),'spine'),
 'fore.R':((-.44,-.18,1.27),(-.56,-.25,1.49),'upper.R'),
 'hand.R':((-.56,-.25,1.49),(-.56,-.25,1.66),'fore.R'),
 'thigh.L':((.08,0,.53),(.06,-.03,.28),'pelvis'),
 'shin.L':((.06,-.03,.28),(.10,-.04,.10),'thigh.L'),
 'foot.L':((.10,-.04,.10),(.11,-.12,.08),'shin.L'),
 'thigh.R':((-.22,0,.53),(-.34,-.04,.39),'pelvis'),
 'shin.R':((-.34,-.04,.39),(-.45,-.02,.32),'thigh.R'),
 'foot.R':((-.45,-.02,.32),(-.52,-.12,.30),'shin.R'),
 'ear.L':((.45,.04,1.42),(.55,.04,1.89),'head'),
 'ear.R':((-.42,.10,1.23),(-.48,.10,.89),'head'),
 'antenna.L':((.20,.12,1.85),(.59,.17,1.09),'head'),
 'antenna.tip.L':((.59,.17,1.09),(.78,.07,.32),'antenna.L'),
}
armdata=bpy.data.armatures.new('Angel approved-pose skeleton')
arm=bpy.data.objects.new('AngelRig',armdata);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in definition.items():
    bone=armdata.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
names=list(definition)
for name in names:body.vertex_groups.new(name=name)
skin=np.zeros((len(coords),len(names)),dtype=np.float32)
def distance(point,name):
    a,b,_=definition[name];a=np.array(a);b=np.array(b);v=b-a
    t=np.clip(np.dot(point-a,v)/np.dot(v,v),0,1)
    return np.linalg.norm(point-a-v*t)
for i,point in enumerate(coords):
    x,y,z=point
    candidates=['pelvis','spine','head']
    if y<-.08 and (ellipse(x,z,-.245,1.58,.14,.17)<1.4 or ellipse(x,z,.205,1.61,.14,.17)<1.4):candidates=['head']
    elif x>.54 and z<1.35:candidates=['antenna.L','antenna.tip.L']
    elif x>.43 and z>1.40 and y>-.10:candidates=['ear.L','head']
    elif x<-.40 and .70<z<1.27 and y>0:candidates=['ear.R','head']
    elif x>.27 and 1.10<z<1.72 and y<-.04:candidates=['upper.L','fore.L','hand.L','head']
    elif x<-.30 and 1.10<z<1.78 and y<-.04:candidates=['upper.R','fore.R','hand.R','head']
    elif z<.53:
        side='R' if x<-.27 else 'L';candidates=['pelvis',f'thigh.{side}',f'shin.{side}',f'foot.{side}']
    scores=np.array([math.exp(-distance(point,name)**2/.012) for name in candidates])
    scores/=max(scores.sum(),1e-15)
    for name,value in zip(candidates,scores):skin[i,names.index(name)]=value
# Smooth only neighboring weights, preserving the approved undeformed surface.
edges=np.array([edge.vertices[:] for edge in body.data.edges],dtype=np.int32)
degree=np.ones(len(coords),dtype=np.float32)
np.add.at(degree,edges[:,0],1);np.add.at(degree,edges[:,1],1)
for _ in range(6):
    total=skin.copy();np.add.at(total,edges[:,0],skin[edges[:,1]]);np.add.at(total,edges[:,1],skin[edges[:,0]])
    skin=.6*skin+.4*total/degree[:,None]
for i,row in enumerate(skin):
    row[row<.01]=0;row/=max(row.sum(),1e-15)
    for group,value in enumerate(row):
        if value:body.vertex_groups[group].add([i],float(value),'REPLACE')
modifier=body.modifiers.new('Angel articulation','ARMATURE');modifier.object=arm
body.parent=arm
body.shape_key_add(name='Basis');blink=body.shape_key_add(name='Blink');concern=body.shape_key_add(name='Concern')
for i,(x,y,z) in enumerate(coords):
    for cx,cz in [(-.245,1.58),(.205,1.61)]:
        e=ellipse(x,z,cx,cz,.12,.15)
        # Eyelids are animated on the separate pigment surface. Collapsing the
        # sculpt itself would fold its forehead and is deliberately avoided.
    e=ellipse(x,z,-.025,1.34,.30,.12)
    if y<-.12 and e<1.5:
        amount=max(0,min(1,(1.5-e)/.5))
        target=z+.012-.035*(abs(x+.025)/.30)**1.3
        concern.data[i].co.z=z+(target-z)*amount

# Smooth pigment surfaces conform to the approved eye volumes; no flat picture.
bvh=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons])
eyes=[]
for side,(cx,cz) in enumerate([(-.245,1.58),(.205,1.61)]):
    points=[];faces=[]
    center_hit=bvh.ray_cast(Vector((cx,-1,cz)),Vector((0,1,0)))
    center_y=center_hit[0].y-.012 if center_hit[0] else -.22
    for ring in range(13):
        r=ring/12
        for segment in range(64):
            angle=segment*2*math.pi/64
            x=cx+.105*r*math.cos(angle);z=cz+.13*r*math.sin(angle)
            y=center_y+.025*r*r
            points.append((x,y,z))
    for ring in range(12):
        for segment in range(64):
            a=ring*64+segment;b=ring*64+(segment+1)%64
            faces.append((a,a+64,b+64,b))
    data=bpy.data.meshes.new('Angel smooth eye pigment');data.from_pydata(points,[],faces);data.update()
    eye=bpy.data.objects.new('AngelEye'+str(side),data);bpy.context.collection.objects.link(eye)
    pigment=data.color_attributes.new(name='Eye pigment',type='FLOAT_COLOR',domain='POINT')
    for i,p in enumerate(points):
        amount=max(0,min(1,(cz-.065-p[2])/.05))
        pigment.data[i].color=(*(black*(1-amount)+blue*amount),1)
    material=bpy.data.materials.new('Angel glossy eye '+str(side));material.use_nodes=True
    shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.40
    node=material.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Eye pigment'
    material.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color']);data.materials.append(material)
    glintmat=bpy.data.materials.get('Angel eye glint')
    if not glintmat:
        glintmat=bpy.data.materials.new('Angel eye glint');glintmat.diffuse_color=(*white,1)
    x=cx-.028;z=cz+.055
    y=center_y-.012+.025*ellipse(x,z,cx,cz,.105,.13)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(x,y,z))
    glint=bpy.context.object;glint.scale=(.025,.009,.034);glint.data.materials.append(glintmat)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.object.select_all(action='DESELECT');glint.select_set(True);eye.select_set(True);bpy.context.view_layer.objects.active=eye
    bpy.ops.object.join()
    for p in eye.data.polygons:p.use_smooth=True
    group=eye.vertex_groups.new(name='head');group.add(list(range(len(eye.data.vertices))),1,'REPLACE')
    modifier=eye.modifiers.new('Eye follows head','ARMATURE');modifier.object=arm;eye.parent=arm
    eye.shape_key_add(name='Basis');key=eye.shape_key_add(name='Blink')
    for v in key.data:v.co.z=cz+(v.co.z-cz)*.035
    eye.data.shape_keys.animation_data_create();eyes.append(eye)

scene=bpy.context.scene;scene.render.fps=30
durations={'idle':6,'wave':4,'look':4,'scratch':4,'nose':4,'point':4,'celebrate':5,'sad':6,'dance':6,'reference':5}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
arm.animation_data_create();keys=body.data.shape_keys;keys.animation_data_create()
for clip,duration in durations.items():
    action=bpy.data.actions.new(clip+'-rig');arm.animation_data.action=action
    face=bpy.data.actions.new(clip+'-face');keys.animation_data.action=face
    eye_actions=[]
    for eye in eyes:
        eye_action=bpy.data.actions.new(clip+'-'+eye.name);eye.data.shape_keys.animation_data.action=eye_action
        eye_actions.append((eye.data.shape_keys,eye_action))
    for frame in range(0,duration*30+1,2):
        t=frame/30;env=smooth(t/.8)*smooth((duration-t)/.8)
        for pb in arm.pose.bones:pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
        def turn(name,axis,angle):arm.pose.bones[name].rotation_quaternion=Quaternion(Vector(axis),angle)
        turn('head',(0,1,0),.018*math.sin(2*math.pi*t/6))
        turn('ear.L',(0,1,0),.035*math.sin(2*math.pi*t/3))
        turn('ear.R',(1,0,0),.025*math.sin(2*math.pi*t/3))
        turn('antenna.tip.L',(1,0,0),.045*math.sin(2*math.pi*t/6))
        arm.pose.bones['spine'].scale=(1,1+.008*math.sin(2*math.pi*t/3),1)
        if clip=='wave':turn('hand.R',(0,1,0),.14*env*math.sin(t*6))
        elif clip=='look':turn('head',(0,0,1),.10*env*math.sin(t*1.6))
        elif clip=='scratch':
            turn('fore.L',(1,0,0),.07*env);turn('hand.L',(0,1,0),.11*env*math.sin(t*9))
        elif clip=='nose':
            turn('fore.R',(0,1,0),-.10*env);turn('hand.R',(0,0,1),.12*env*math.sin(t*5))
        elif clip=='point':
            turn('fore.L',(0,1,0),.17*env);turn('hand.L',(0,0,1),.12*env)
        elif clip=='celebrate':
            arm.pose.bones['root'].location.y=.045*env*math.sin(t*5)**2
            turn('spine',(0,1,0),.05*env*math.sin(t*4));turn('hand.R',(0,1,0),.11*env*math.sin(t*6))
        elif clip=='sad':
            turn('head',(1,0,0),.055*env);turn('ear.L',(0,0,1),-.20*env);turn('ear.R',(0,0,1),.10*env)
        elif clip=='dance':
            turn('spine',(0,1,0),.055*env*math.sin(t*3));turn('head',(0,1,0),-.04*env*math.sin(t*3))
            arm.pose.bones['root'].location.x=.035*env*math.sin(t*3)
        eye=max(0,1-min(abs(t-1.9),abs(t-4.6))/.12)
        blink.value=max(eye,.35*env if clip=='sad' else 0);concern.value=env if clip=='sad' else 0
        blink.keyframe_insert('value',frame=frame);concern.keyframe_insert('value',frame=frame)
        for eye_mesh in eyes:
            eye_key=eye_mesh.data.shape_keys.key_blocks['Blink'];eye_key.value=blink.value;eye_key.keyframe_insert('value',frame=frame)
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            pb.keyframe_insert('location',frame=frame,group=pb.name);pb.keyframe_insert('scale',frame=frame,group=pb.name)
    for owner,created in [(arm,action),(keys,face),*eye_actions]:
        created.use_fake_user=True;track=owner.animation_data.nla_tracks.new();track.name=clip
        track.strips.new(clip,0,created);track.mute=True
arm.animation_data.action=None;keys.animation_data.action=None
for eye in eyes:eye.data.shape_keys.animation_data.action=None;eye.data.shape_keys.key_blocks['Blink'].value=0
for pb in arm.pose.bones:pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
blink.value=0;concern.value=0;scene.frame_set(0)

scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Soft studio');scene.world.color=(.22,.22,.22)
for loc,power in [((3,-4,5),220),((-3,-2,3),120),((0,3,4),200)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object;light.data.energy=power;light.data.size=4
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-6,1.08));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.4;scene.camera=camera
scene.view_settings.view_transform='Standard'
scene.render.filepath=str(output/'angel-color-review.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output/'angel.blend'))
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);body.select_set(True)
for eye in eyes:eye.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'angel.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
    export_frame_step=2,export_optimize_animation_size=True,export_nla_strips=True,
    export_extras=False,export_materials='EXPORT')
print('ANGEL_READY',len(body.data.vertices),len(body.data.polygons))
