"""Independent Blender study authored only from Luca's chosen Angel image.

No network calls, AI services, downloaded character mesh or paid dependencies.
This is an editable development study, not a film model or a finished app asset.
"""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion
from mathutils.kdtree import KDTree

if '--' not in sys.argv or len(sys.argv[sys.argv.index('--')+1:]) != 1:
    raise SystemExit('Pass -- OUTPUT_DIRECTORY outside the public app bundle.')
OUT = Path(sys.argv[sys.argv.index('--')+1]).resolve()
OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(c):
    return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4

def mat(name, hexcolor, roughness=.57):
    rgb = tuple(linear(int(hexcolor[i:i+2],16)/255) for i in (0,2,4))
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    m.diffuse_color=(*rgb,1)
    s=m.node_tree.nodes.get('Principled BSDF')
    s.inputs['Base Color'].default_value=(*rgb,1)
    s.inputs['Roughness'].default_value=roughness
    s.inputs['Specular IOR Level'].default_value=.28
    return m

pink=mat('Angel | warm pink','ED9DC2')
belly=mat('Angel | pale belly','F6C7DC')
earpink=mat('Angel | ear interior','F8CDDF')
earrim=mat('Angel | lavender ear rim','C884B0')
white=mat('Angel | white V and glints','FFF8FB',.42)
nosemat=mat('Angel | lilac nose','B48CB9',.46)
nosedark=mat('Angel | nostrils','776B99')
black=mat('Angel | eyes and lashes','120F23',.28)
reflection=mat('Angel | lower eye reflection','243B61',.34)
mouthmat=mat('Angel | mouth cavity','27152E')
tonguemat=mat('Angel | cyan tongue','62CEE8',.42)
lipmat=mat('Angel | muzzle','F5BCD4')
nailmat=mat('Angel | raspberry nails','BD3A78',.48)
flowerdark=mat('Angel | hibiscus folds','C51F70')
flowerpink=mat('Angel | hibiscus petals','F03A91')
flowerlight=mat('Angel | hibiscus rim','FF79B9')
yellow=mat('Angel | stamen','FFCC32')

meshes=[]
weights={}
def finish(o,name,material,group):
    o.name=name
    if material: o.data.materials.append(material)
    if o.type=='MESH':
        for p in o.data.polygons: p.use_smooth=True
        meshes.append(o)
        if group:
            g=o.vertex_groups.new(name=group)
            g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    return o

def sphere(name,loc,scale,material,group,segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object
    o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,group)

def mesh(name,verts,faces,material,group):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    o=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(o)
    return finish(o,name,material,group)

def tube(name,points,radius,material,group,resolution=8):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'
    curve.resolution_u=resolution
    curve.bevel_depth=radius
    curve.bevel_resolution=3
    curve.resolution_u=10
    spline=curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for bp,point in zip(spline.bezier_points,points):
        bp.co=point
        bp.handle_left_type='AUTO'
        bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o=bpy.context.object
    o.select_set(False)
    return finish(o,name,material,group)

def capsule(name,a,b,r,material,group):
    a,b=Vector(a),Vector(b)
    o=sphere(name,(a+b)*.5,(r,r,(b-a).length*.5+r),material,group,24,16)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

# Rest anatomy: y negative faces the camera, z up. Head is independently shaped.
core=[]
torso=sphere('Pear-shaped torso',(0,.035,.64),(.265,.18,.405),pink,'spine',40,28)
for v in torso.data.vertices:
    z=v.co.z/.405
    v.co.x*=1-.30*max(0,z)
core.append(torso)
core.append(sphere('Short neck',(0,.015,1.02),(.135,.13,.20),pink,'head'))
head=sphere('Rounded Angel head',(0,-.015,1.395),(.465,.265,.348),pink,'head',48,32)
for v in head.data.vertices:
    z=v.co.z/.348
    v.co.x*=1-.09*max(0,z)
    if v.co.y<0: v.co.y*=.90
core.append(head)
bones={
    'root':((0,0,0),(0,0,.16),None),
    'pelvis':((0,0,.30),(0,0,.58),'root'),
    'spine':((0,0,.58),(0,0,1.02),'pelvis'),
    'head':((0,0,1.02),(0,0,1.67),'spine'),
}
for side,label in [(1,'L'),(-1,'R')]:
    shoulder=(side*.205,.01,1.105)
    elbow=(side*.350,-.005,.915)
    wrist=(side*.430,-.055,.72)
    hip=(side*.135,.035,.38)
    knee=(side*.19,.015,.23)
    ankle=(side*.205,-.025,.105)
    bones.update({
        f'upper_arm.{label}':(shoulder,elbow,'spine'),
        f'forearm.{label}':(elbow,wrist,f'upper_arm.{label}'),
        f'hand.{label}':(wrist,(side*.445,-.065,.625),f'forearm.{label}'),
        f'thigh.{label}':(hip,knee,'pelvis'),
        f'shin.{label}':(knee,ankle,f'thigh.{label}'),
        f'foot.{label}':(ankle,(side*.205,-.17,.065),f'shin.{label}'),
        f'ear.{label}':((side*.355,.035,1.5),(side*.66,.04,2.07),'head'),
        f'antenna.{label}':((side*.16,.14,1.68),(side*.40,.25,1.85),'head'),
    })
    core.append(capsule(f'Upper arm {label}',shoulder,elbow,.081,pink,f'upper_arm.{label}'))
    core.append(capsule(f'Forearm {label}',elbow,wrist,.076,pink,f'forearm.{label}'))
    core.append(capsule(f'Thigh {label}',hip,knee,.101,pink,f'thigh.{label}'))
    core.append(capsule(f'Shin {label}',knee,ankle,.074,pink,f'shin.{label}'))
    sphere(f'Foot {label}',(side*.205,-.08,.071),(.114,.15,.073),pink,f'foot.{label}')
    sphere(f'Palm {label}',(side*.450,-.064,.67),(.087,.05,.098),pink,f'hand.{label}')
    for i in range(3):
        x=side*(.390+i*.052)
        sphere(f'Finger {label} {i}',(x,-.068,.60),(.027,.032,.055),pink,f'hand.{label}',20,12)
        sphere(f'Fingernail {label} {i}',(x,-.094,.578),(.018,.011,.020),nailmat,f'hand.{label}',16,10)
        tx=side*(.137+i*.065)
        sphere(f'Toe {label} {i}',(tx,-.179,.058),(.036,.045,.035),pink,f'foot.{label}',20,12)
        sphere(f'Toenail {label} {i}',(tx,-.210,.071),(.021,.013,.016),nailmat,f'foot.{label}',16,10)
    sphere(f'Thumb {label}',(side*.376,-.07,.675),(.038,.033,.055),pink,f'hand.{label}',20,12)
    sphere(f'Thumbnail {label}',(side*.352,-.095,.66),(.018,.011,.018),nailmat,f'hand.{label}',16,10)
    for i in range(3):
        sphere(f'Palm pad {label} {i}',(side*(.399+i*.049),-.111,.626),(.014,.008,.015),nailmat,f'hand.{label}',16,10)

# Fuse the continuous body and transfer deliberate part weights, then smooth seams.
bpy.ops.object.select_all(action='DESELECT')
for o in core: o.select_set(True)
bpy.context.view_layer.objects.active=torso
bpy.ops.object.join()
body=bpy.context.object
body.name='Angel continuous body'
body_vertices=[]
for v in body.data.vertices:
    groups=[(body.vertex_groups[g.group].name,g.weight) for g in v.groups]
    body_vertices.append((v.co.copy(),groups))
kd=KDTree(len(body_vertices))
for i,(co,groups) in enumerate(body_vertices): kd.insert(co,i)
kd.balance()
modifier=body.modifiers.new('Continuous sculpt union','REMESH')
modifier.mode='VOXEL'
modifier.voxel_size=.012
modifier.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=modifier.name)
for group in body.vertex_groups: group.remove(list(range(len(body.data.vertices))))
for v in body.data.vertices:
    nearby=kd.find_n(v.co,6)
    blend={}
    for co,index,distance in nearby:
        weight=1/(distance+.012)**3
        for group,value in body_vertices[index][1]: blend[group]=blend.get(group,0)+weight*value
    total=sum(blend.values())
    for name,value in blend.items():
        if value/total>.015: body.vertex_groups[name].add([v.index],value/total,'REPLACE')
modifier=body.modifiers.new('Soft anatomical joins','SMOOTH')
modifier.factor=.8
modifier.iterations=5
bpy.ops.object.modifier_apply(modifier=modifier.name)
modifier=body.modifiers.new('Mobile sculpture budget','DECIMATE')
modifier.ratio=.62
bpy.ops.object.modifier_apply(modifier=modifier.name)

# Surface-colored belly and the distinct short V follow the curved torso.
def body_front(x,z,offset=.003):
    vz=(z-.64)/.405
    width=.265*(1-.30*max(0,vz))
    value=max(.01,1-vz*vz-(x/width)**2)
    return .035-.18*math.sqrt(value)-offset

verts=[(0,body_front(0,.59,.004),.59)]
for r in range(1,9):
    for i in range(48):
        a=2*math.pi*i/48
        x=.172*(r/8)*math.cos(a)
        z=.59+.25*(r/8)*math.sin(a)
        verts.append((x,body_front(x,z,.005),z))
faces=[]
for i in range(48): faces.append((0,1+i,1+(i+1)%48))
for r in range(7):
    for i in range(48):
        a=1+r*48+i; b=1+r*48+(i+1)%48
        faces.append((a,a+48,b+48,b))
mesh('Pale pear-shaped belly',verts,faces,belly,'spine')
verts=[]; faces=[]
for side in (-1,1):
    start=len(verts)
    for j in range(16):
        t=j/15
        x=side*.126*t
        z=.818+.145*t
        width=.020*(1-.5*t)
        for dz in (-width,width): verts.append((x,body_front(x,z+dz,.012),z+dz))
    for j in range(15):
        a=start+2*j
        faces.append((a,a+2,a+3,a+1) if side<0 else (a,a+1,a+3,a+2))
mesh('Small white chest V',verts,faces,white,'spine')

# Cupped, round-tipped ears with continuous rims and recessed interiors.
for side,label in [(1,'L'),(-1,'R')]:
    ear=sphere(f'{label} round cupped ear',(side*.54,.045,1.82),(.15,.058,.36),earrim,f'ear.{label}',40,32)
    ear.data.materials.append(earpink)
    for p in ear.data.polygons:
        center=sum((ear.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        if center.y<-.015 and (center.x/.134)**2+(center.z/.325)**2<1:
            p.material_index=1
    ear.rotation_euler.y=side*.40

    tube(f'{label} long rear antenna',[
        (side*.16,.14,1.68),(side*.28,.18,1.96),(side*.38,.22,2.00),
        (side*.45,.27,1.64),(side*.48,.26,1.19),(side*.59,.22,.85),
        (side*.72,.18,.78),(side*.78,.17,.86)],.023,pink,f'antenna.{label}')

# Eyes, swept eyelashes, soft eyebrows. Front patches are light pink, not white sclera.
eye_parts={}
for side,label in [(1,'L'),(-1,'R')]:
    patch=sphere(f'{label} pink eye surround',(side*.222,-.235,1.441),(.192,.052,.234),lipmat,'head',40,24)
    eye=[]
    eye.append(sphere(f'{label} glossy black eye',(side*.230,-.283,1.432),(.128,.043,.170),black,'head',40,24))
    eye.append(sphere(f'{label} blue eye reflection',(side*.237,-.318,1.328),(.074,.013,.035),reflection,'head',24,12))
    eye.append(sphere(f'{label} large white glint',(side*.205-.030,-.327,1.525),(.042,.012,.052),white,'head',24,16))
    eye.append(sphere(f'{label} tiny eye glint',(side*.257,-.328,1.373),(.011,.005,.012),white,'head',16,10))
    for index in range(3):
        x=.315+index*.019
        eye.append(tube(f'{label} swept lash {index}',[(side*x,-.287,1.565-index*.012),
            (side*(x+.055),-.287,1.583+index*.005),(side*(x+.090),-.264,1.622+index*.010)],.008-index*.001,black,'head'))
    bpy.ops.object.select_all(action='DESELECT')
    for o in eye: o.select_set(True)
    bpy.context.view_layer.objects.active=eye[0]
    bpy.ops.object.join()
    combined=bpy.context.object
    combined.name=f'{label} eye and eyelashes'
    basis=combined.shape_key_add(name='Basis')
    blink=combined.shape_key_add(name='Blink')
    # World-space flattening respects the current object origin.
    center=1.425-combined.location.z
    for v in blink.data: v.co.z=center+(v.co.z-center)*.035
    eye_parts[label]=combined
    tube(f'{label} fine eyebrow',[(side*.115,-.22,1.68),(side*.213,-.22,1.71),(side*.300,-.18,1.672)],.006,black,'head')

# Triangular lilac nose is sculpted with rounded subdivision, never Stitch's blue nose.
noseverts=[(-.112,-.285,1.405),(-.082,-.337,1.46),(0,-.365,1.474),(.082,-.337,1.46),
    (.112,-.285,1.405),(.065,-.357,1.345),(0,-.372,1.318),(-.065,-.357,1.345),(0,-.414,1.398),(0,-.270,1.40)]
nosefaces=[(8,i,(i+1)%8) for i in range(8)]+[(9,(i+1)%8,i) for i in range(8)]
nose=mesh('Rounded triangular lilac nose',noseverts,nosefaces,nosemat,'head')
sub=nose.modifiers.new('Rounded nose','SUBSURF'); sub.levels=2
bpy.context.view_layer.objects.active=nose
bpy.ops.object.modifier_apply(modifier=sub.name)
for side in (1,-1):
    sphere('Subtle nostril',(side*.060,-.380,1.350),(.025,.010,.014),nosedark,'head',20,12)

# Curved open smile and continuous pale lower muzzle: no large teeth.
mouthverts=[]; mouthfaces=[]
for j in range(9):
    t=j/8
    for i in range(41):
        u=-1+2*i/40
        top=1.261-.043*(1-u*u)
        bottom=1.256-.141*(1-u*u)**.65
        z=top*(1-t)+bottom*t
        y=-.266-.054*(1-u*u)-.018*math.sin(t*math.pi)
        mouthverts.append((.319*u,y,z))
for j in range(8):
    for i in range(40):
        a=j*41+i; mouthfaces.append((a,a+1,a+42,a+41))
mouth=mesh('Open upturned smile',mouthverts,mouthfaces,mouthmat,'head')
tube('Soft curved upper lip',[(-.326,-.264,1.263),(-.20,-.305,1.234),(0,-.319,1.218),(.20,-.305,1.234),(.326,-.264,1.263)],.016,lipmat,'head')
tube('Rounded smiling lower muzzle',[(-.326,-.264,1.257),(-.23,-.313,1.175),(0,-.344,1.103),(.23,-.313,1.175),(.326,-.264,1.257)],.031,lipmat,'head')
sphere('Small cyan tongue',(0,-.344,1.149),(.099,.013,.028),tonguemat,'head',32,16)
for side in (1,-1):
    tube('Smile corner crease',[(side*.322,-.271,1.26),(side*.348,-.254,1.272),(side*.355,-.244,1.29)],.006,nailmat,'head')

# Five folded hibiscus petals and a yellow curved stamen, positioned as in the photo.
flowercenter=Vector((.255,-.15,1.797))
for petal in range(5):
    angle=petal*2*math.pi/5+.21
    direction=Vector((math.cos(angle),0,math.sin(angle)))
    perpendicular=Vector((-math.sin(angle),0,math.cos(angle)))
    vertices=[]; faces=[]
    for j in range(15):
        t=j/14
        width=.097*math.sin(math.pi*t)**.7
        radius=.025+.195*t
        for k in range(13):
            u=-1+2*k/12
            p=flowercenter+direction*radius+perpendicular*width*u
            p.y-=.030*math.sin(math.pi*t)+.040*(1-u*u)*math.sin(math.pi*t)
            p.y+=.015*math.sin(3*math.pi*t+petal)*u*u
            vertices.append(tuple(p))
    for j in range(14):
        for k in range(12):
            a=j*13+k; faces.append((a,a+1,a+14,a+13))
    pet=mesh(f'Folded hibiscus petal {petal}',vertices,faces,flowerpink,'head')
    solid=pet.modifiers.new('Petal thickness','SOLIDIFY'); solid.thickness=.006
    bpy.context.view_layer.objects.active=pet; bpy.ops.object.modifier_apply(modifier=solid.name)
    line=[]
    for t in (.05,.35,.7,.9):
        p=flowercenter+direction*(.025+.195*t)
        p.y-=.074*math.sin(math.pi*t)+.003
        line.append(tuple(p))
    tube(f'Hibiscus deep fold {petal}',line,.008,flowerdark,'head')
sphere('Hibiscus center',tuple(flowercenter+Vector((0,-.024,0))),(.046,.022,.040),flowerdark,'head',24,16)
tube('Hibiscus curved yellow stamen',[tuple(flowercenter+Vector((0,-.03,0))),(.21,-.22,1.89),(.15,-.22,1.98)],.010,yellow,'head')
for i in range(6):
    angle=i*math.pi/3
    sphere('Yellow pollen',( .15+.022*math.cos(angle),-.225+.009*math.sin(angle),1.98+.015*math.sin(angle)),(.012,.012,.012),yellow,'head',12,8)

# Create a genuine deforming skeleton. All new meshes receive armature modifiers.
armdata=bpy.data.armatures.new('Angel authored skeleton')
arm=bpy.data.objects.new('AngelRig',armdata)
bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in bones.items():
    b=armdata.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    modifier=o.modifiers.new('Angel skeletal deformation','ARMATURE'); modifier.object=arm
    o.parent=arm
for pb in arm.pose.bones: pb.rotation_mode='QUATERNION'
scene=bpy.context.scene
scene.render.fps=30

def ease(t):
    t=max(0,min(1,t)); return t*t*(3-2*t)

def align(name,direction):
    pb=arm.pose.bones[name]
    base=pb.bone.matrix_local.copy()
    if pb.parent: base=pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() @ base
    local=base.to_3x3().inverted() @ Vector(direction)
    pb.rotation_quaternion=Vector((0,1,0)).rotation_difference(local.normalized())
    bpy.context.view_layer.update()

def arm_target(label,elbow,wrist):
    upper=arm.pose.bones[f'upper_arm.{label}']
    shoulder=upper.head.copy()
    delta=Vector(wrist)-shoulder
    a=upper.bone.length
    b=arm.pose.bones[f'forearm.{label}'].bone.length
    distance=min(delta.length,a+b-.001)
    direction=delta.normalized()
    along=(a*a-b*b+distance*distance)/(2*distance)
    hint=Vector(elbow)-shoulder
    hint-=direction*hint.dot(direction)
    if hint.length<.001: hint=Vector((1,0,0))
    actual_elbow=shoulder+direction*along+hint.normalized()*math.sqrt(max(0,a*a-along*along))
    actual_wrist=shoulder+direction*distance
    align(upper.name,actual_elbow-shoulder)
    lower=arm.pose.bones[f'forearm.{label}']
    align(lower.name,actual_wrist-lower.head)

durations={'idle':6,'wave':4,'look':4,'point':4,'celebrate':5,'sad':6,'dance':6,'reference':5}
actions={}
for clip,duration in durations.items():
    action=bpy.data.actions.new('angel_'+clip)
    arm.animation_data_create(); arm.animation_data.action=action
    actions[clip]=action
    for tframe in range(0,duration*30+1,2):
        t=tframe/30; scene.frame_set(tframe)
        for pb in arm.pose.bones:
            pb.rotation_quaternion=Quaternion(); pb.location=(0,0,0); pb.scale=(1,1,1)
        env=ease(t/.7)*ease((duration-t)/.7)
        breath=.012*math.sin(2*math.pi*t/3)
        arm.pose.bones['spine'].scale=(1+breath*.25,1+breath,1+breath*.2)
        def rotation(name,axis,angle): arm.pose.bones[name].rotation_quaternion=Quaternion(Vector(axis),angle)
        rotation('head',(0,1,0),.025*math.sin(t*1.2))
        for side,label in [(1,'L'),(-1,'R')]:
            rotation(f'ear.{label}',(0,1,0),side*.025*math.sin(t*2.1+side))
            rotation(f'antenna.{label}',(1,0,0),.035*math.sin(t*1.6+side))
        if clip=='wave':
            arm_target('L',(.43,-.18,1.21),(.43,-.31,1.40))
            rotation('hand.L',(0,1,0),env*.20*math.sin(t*7))
        elif clip=='point':
            arm_target('L',(.38,-.01,1.06),(.59,-.02,1.10))
            rotation('head',(0,0,1),-.15*env)
        elif clip in ('celebrate','reference'):
            for side,label in [(1,'L'),(-1,'R')]:
                arm_target(label,(side*.48,-.14,1.16),(side*.40,-.30,1.40))
            if clip=='celebrate':
                arm.pose.bones['root'].location.z=.035*env*math.sin(t*5)**2
                rotation('spine',(0,1,0),.07*env*math.sin(t*4))
            else:
                rotation('head',(0,1,0),-.13*env)
                rotation('thigh.R',(1,0,0),-.48*env)
                rotation('shin.R',(1,0,0),1.0*env)
        elif clip=='look': rotation('head',(0,0,1),.27*env*math.sin(t*1.6))
        elif clip=='sad':
            rotation('head',(1,0,0),.12*env)
            for side,label in [(1,'L'),(-1,'R')]: rotation(f'ear.{label}',(0,1,0),side*.20*env)
        elif clip=='dance':
            rotation('spine',(0,1,0),.10*env*math.sin(t*3))
            rotation('head',(0,1,0),-.08*env*math.sin(t*3))
            for side,label in [(1,'L'),(-1,'R')]:
                rotation(f'upper_arm.{label}',(0,1,0),side*.25*env*(.5+.5*math.sin(t*3+side)))
        for pb in arm.pose.bones:
            pb.keyframe_insert('location',frame=tframe,group=pb.name)
            pb.keyframe_insert('rotation_quaternion',frame=tframe,group=pb.name)
            pb.keyframe_insert('scale',frame=tframe,group=pb.name)
    # Clip entry/exit for raised arms must blend from/to the actual rest pose.
    if clip in ('wave','point','celebrate','reference'):
        for f in (0,duration*30):
            scene.frame_set(f)
            for label in ('L','R'):
                for part in ('upper_arm','forearm','hand'):
                    pb=arm.pose.bones[f'{part}.{label}']; pb.rotation_quaternion=Quaternion()
                    pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name)
    action.use_fake_user=True
arm.animation_data.action=None
for name,action in actions.items():
    track=arm.animation_data.nla_tracks.new(); track.name=name
    strip=track.strips.new(name,0,action)
    track.mute=True

for label,obj in eye_parts.items():
    data=obj.data.shape_keys
    data.animation_data_create()
    for clip,duration in durations.items():
        action=bpy.data.actions.new('angel_'+clip+'_eye_'+label)
        data.animation_data.action=action
        blink=data.key_blocks['Blink']
        for frame in range(0,duration*30+1):
            t=frame/30
            distance=min(abs(t-1.9),abs(t-4.6))
            value=max(0,1-distance/.11)
            if clip=='sad': value=max(value,.38*ease(t/.7)*ease((duration-t)/.7))
            blink.value=value; blink.keyframe_insert('value',frame=frame)
        action.use_fake_user=True
        track=data.animation_data.nla_tracks.new(); track.name=clip
        track.strips.new(clip,0,action); track.mute=True
    data.animation_data.action=None

# Review pose with the exact reference composition, still flagged as a study.
arm.animation_data.action=actions['reference']
scene.frame_set(60)
for label,obj in eye_parts.items(): obj.data.shape_keys.key_blocks['Blink'].value=0
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=800; scene.render.resolution_y=800
scene.render.resolution_percentage=100; scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Neutral studio'); scene.world.color=(.32,.32,.32)
for loc,power,size in [((3,-4,5),250,4),((-3,-2,3),130,4),((0,3,4),220,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    o=bpy.context.object; o.data.energy=power; o.data.size=size
    o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-6,1.2)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.65; scene.camera=camera
scene.view_settings.view_transform='Standard'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'angel-authored-study.blend'))
for label,loc in [('front',(0,-6,1.2)),('side',(6,0,1.2)),('back',(0,6,1.2))]:
    camera.location=loc
    camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'angel-authored-{label}.png')
    bpy.ops.render.render(write_still=True)
print('ANGEL_AUTHORED_STUDY_COMPLETE',str(OUT))
