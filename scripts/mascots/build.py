"""Author NutriDuo's character variants and motion clips in Blender 4.5 LTS.

blender -b --factory-startup --disable-autoexec --python-exit-code 1
  --python build.py -- SOURCE.glb OUTPUT_DIRECTORY SOURCE_DIRECTORY
Source model and attribution: public/mascots/credits.json.
"""
import math
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import tessellate_polygon

FPS = 30
CLIPS = {"idle": 6, "wave": 4, "look": 4, "scratch": 4,
         "nose": 4, "point": 4, "celebrate": 5, "sad": 6,
         "dance": 6, "headstand": 7, "reference": 5}


def smooth(value):
    value = min(1, max(0, value))
    return value * value * (3 - 2 * value)


def envelope(t, duration, edge=0.85):
    return smooth(t / edge) * smooth((duration - t) / edge)


def empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def material(name, color, roughness=.48):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat


class Character:
    def __init__(self, source, kind):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
        self.kind = kind
        self.arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        # The source's separate prop material contains both blasters.
        for obj in list(bpy.context.scene.objects):
            if obj.type == "MESH" and any("mat2_" in mat.name for mat in obj.data.materials):
                bpy.data.objects.remove(obj, do_unlink=True)
        self.meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"
                       and any(m.type == "ARMATURE" for m in o.modifiers)]
        bpy.context.view_layer.update()
        points = [o.matrix_world @ Vector(c) for o in self.meshes for c in o.bound_box]
        low = Vector([min(p[i] for p in points) for i in range(3)])
        high = Vector([max(p[i] for p in points) for i in range(3)])
        self.motion = empty("CompanionMotion")
        norm = empty("CharacterScale")
        for obj in list(bpy.context.scene.objects):
            if obj not in (norm, self.motion) and obj.parent is None and obj.type != "MESH":
                obj.parent = norm
        norm.parent = self.motion
        scale = 2 / (high.z - low.z)
        norm.scale = (scale,) * 3
        norm.location = (-(high.x + low.x) * .5 * scale,
                         -(high.y + low.y) * .5 * scale, -low.z * scale)
        bpy.context.view_layer.update()
        self.bones = self.arm.pose.bones
        for bone in self.bones:
            bone.rotation_mode = "QUATERNION"
        self.extra_bones = []
        if kind == "angel":
            self.pink_textures()
            self.angel_geometry()
            self.reshape_angel()
            self.angel_face_materials()
            self.chest_mark()
            self.antennae()
            self.flower()
        for mat in bpy.data.materials:
            if mat.use_nodes:
                shader = mat.node_tree.nodes.get("Principled BSDF")
                if shader:
                    shader.inputs["Roughness"].default_value = .5
                    shader.inputs["Metallic"].default_value = 0
        self.meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"
                       and o.name != "Icosphere"]
        bpy.context.scene.render.fps = FPS

    def pink_textures(self):
        # Preserve painted shading while remapping blue and cyan regions.
        for image in list(bpy.data.images):
            if image.type != "IMAGE" or image.colorspace_settings.name != "sRGB":
                continue
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            rgba = pixels.reshape(-1, 4)
            rgb = rgba[:, :3]
            mask = (rgb[:, 2] > rgb[:, 0] * 1.12) & (rgb[:, 2] > .05)
            brightness = np.max(rgb, axis=1)
            cyan = mask & (rgb[:, 1] > rgb[:, 2] * .73)
            blue = mask & ~cyan
            rgb[blue] = np.array([.82, .25, .50]) + brightness[blue, None] * np.array([.18, .35, .35])
            rgb[cyan] = np.array([.95, .67, .80]) + brightness[cyan, None] * np.array([.05, .20, .15])
            dark = blue & (brightness < .10)
            rgb[dark] = np.array([.42, .26, .48]) + brightness[dark, None] * np.array([.6, .5, .6])
            replacement = bpy.data.images.new(f"Angel-{image.name}",
                width=image.size[0], height=image.size[1], alpha=True)
            replacement.pixels.foreach_set(pixels)
            replacement.update()
            replacement.pack()
            for mat in bpy.data.materials:
                if mat.use_nodes:
                    for node in mat.node_tree.nodes:
                        if node.type == "TEX_IMAGE" and node.image == image:
                            node.image = replacement

    def angel_geometry(self):
        # Angel's ears have rounded continuous edges, unlike Stitch's notches.
        for obj in self.meshes:
            # Fur tufts are disconnected surface islands in this source mesh.
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            unseen = set(bm.verts)
            fur = []
            uv = bm.loops.layers.uv.active
            texture = next((node.image for mat in obj.data.materials if mat.use_nodes
                            for node in mat.node_tree.nodes if node.type == "TEX_IMAGE"), None)
            pixels = None
            if texture and uv:
                tw, th = texture.size
                pixels = np.array(texture.pixels[:], dtype=np.float32).reshape(th, tw, 4)
            while unseen:
                seed = unseen.pop()
                island, stack = {seed}, [seed]
                while stack:
                    vertex = stack.pop()
                    for edge in vertex.link_edges:
                        other = edge.other_vert(vertex)
                        if other in unseen:
                            unseen.remove(other)
                            island.add(other)
                            stack.append(other)
                if len(island) > 150:
                    continue
                coords = [obj.matrix_world @ vertex.co for vertex in island]
                chest_fur = all(abs(p.x) < .18 and .90 < p.z < 1.28 for p in coords) and sum(p.y for p in coords)/len(coords) < -.13
                if chest_fur:
                    inverse = obj.matrix_world.inverted()
                    for vertex in island:
                        point = obj.matrix_world @ vertex.co
                        point.y = -.205 + .07*(point.x/.2)**2 + .015*((point.z-1.08)/.2)**2
                        vertex.co = inverse @ point
                if all(abs(p.x) < .12 and p.z > 1.80 for p in coords):
                    fur.extend(island)
                if pixels is not None and all(1.25 < p.z < 1.50 for p in coords):
                    colors = []
                    for vertex in island:
                        for loop in vertex.link_loops:
                            u, v = loop[uv].uv
                            colors.append(pixels[min(th-1, max(0, int(v*th))), min(tw-1, max(0, int(u*tw))), :3])
                    red, green, blue = np.mean(colors, axis=0)
                    if red > .65 and green > .60 and red > blue*1.15:
                        fur.extend(island)
            if fur:
                bmesh.ops.delete(bm, geom=fur, context="VERTS")
            bm.to_mesh(obj.data)
            bm.free()
            ear_groups = {g.index for g in obj.vertex_groups if "mimi" in g.name}
            remove = {v.index for v in obj.data.vertices
                      if sum(g.weight for g in v.groups if g.group in ear_groups) > .65}
            if remove:
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bm.verts.ensure_lookup_table()
                bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index in remove], context="VERTS")
                bm.to_mesh(obj.data)
                bm.free()
        outer = material("Angel outer ears", (.95, .32, .57))
        inner = material("Angel inner ears", (1, .70, .81))
        lash = material("Angel eyelashes", (.045, .018, .05))
        for side in (1, -1):
            for is_inner in (False, True):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16,
                    location=(side*.58, -.075 if is_inner else -.015, 1.87))
                obj = bpy.context.object
                obj.name = f"AngelEar{side}{'Inner' if is_inner else 'Outer'}"
                obj.scale = (.145, .025, .425) if is_inner else (.205, .075, .51)
                obj.rotation_euler.y = side * .36
                obj.data.materials.append(inner if is_inner else outer)
                for face in obj.data.polygons:
                    face.use_smooth = True
                bpy.context.view_layer.update()
                world = obj.matrix_world.copy()
                obj.parent = self.arm
                obj.parent_type = "BONE"
                obj.parent_bone = "L_mimi1_011" if side == 1 else "R_mimi1_015"
                obj.matrix_world = world
            for index in range(3):
                curve = bpy.data.curves.new("Eyelash", "CURVE")
                curve.dimensions = "3D"
                curve.bevel_depth = .008
                curve.bevel_resolution = 2
                spline = curve.splines.new("BEZIER")
                spline.bezier_points.add(2)
                for control, point in zip(spline.bezier_points, [
                    (side*(.27+index*.025), -.37, 1.73-index*.012),
                    (side*(.30+index*.03), -.39, 1.78-index*.008),
                    (side*(.34+index*.03), -.37, 1.80-index*.008),
                ]):
                    control.co = point
                    control.handle_left_type = control.handle_right_type = "AUTO"
                curve.materials.append(lash)
                obj = bpy.data.objects.new(f"AngelLash{side}{index}", curve)
                bpy.context.collection.objects.link(obj)
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.convert(target="MESH")
                obj = bpy.context.object
                obj.select_set(False)
                self.head_parent(obj)

    def reshape_angel(self):
        for obj in self.meshes:
            inverse = obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                point = obj.matrix_world @ vertex.co
                if point.z > 1.27:
                    # A rounder forehead and softer, narrower lower jaw.
                    point.x *= .95 + .20*smooth((point.z-1.27)/.45)
                    point.z = 1.60 + (point.z-1.60)*1.06
                elif .33 < point.z < 1.28 and abs(point.x) < .43:
                    torso = sum(g.weight for g in vertex.groups
                        if any(name in obj.vertex_groups[g.group].name
                               for name in ("hara", "mune", "koshi", "center")))
                    taper = .82 + .12*math.exp(-((point.z-.62)/.28)**2)
                    point.x *= 1-torso*(1-taper)
                if abs(point.x) > .3 and 1.02 < point.z < 1.34:
                    arm = sum(g.weight for g in vertex.groups
                        if any(name in obj.vertex_groups[g.group].name
                               for name in ("ude", "te_", "yubi")))
                    point.y = -.11 + (point.y+.11)*(1-.20*arm)
                    point.z = 1.164 + (point.z-1.164)*(1-.20*arm)
                vertex.co = inverse @ point
            obj.data.update()

        # Match the reference's larger head and shorter body, moving the rig too.
        def proportion(point):
            point = point.copy()
            point.z = point.z*.88 if point.z <= 1.27 else 1.27*.88+(point.z-1.27)*1.20
            return point
        for obj in self.meshes:
            inverse = obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                vertex.co = inverse @ proportion(obj.matrix_world @ vertex.co)
            obj.data.update()
        bpy.context.view_layer.objects.active = self.arm
        self.arm.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        inverse = self.arm.matrix_world.inverted()
        for bone in self.arm.data.edit_bones:
            bone.head = inverse @ proportion(self.arm.matrix_world @ bone.head)
            bone.tail = inverse @ proportion(self.arm.matrix_world @ bone.tail)
        bpy.ops.object.mode_set(mode="OBJECT")
        self.arm.select_set(False)
        bpy.context.view_layer.update()

    def angel_face_materials(self):
        nose = material("Angel lavender nose", (.42, .27, .51), .36)
        tongue = material("Angel blue tongue", (.06, .52, .80), .4)
        for obj in self.meshes:
            obj.data.materials.append(nose)
            nose_slot = len(obj.data.materials)-1
            obj.data.materials.append(tongue)
            tongue_slot = len(obj.data.materials)-1
            nose_groups = {g.index for g in obj.vertex_groups if g.name in ("C_nose_039", "C_noseroot_038")}
            tongue_groups = {g.index for g in obj.vertex_groups if "tong" in g.name}
            for face in obj.data.polygons:
                center = sum((obj.matrix_world @ obj.data.vertices[i].co for i in face.vertices), Vector())/len(face.vertices)
                weights = [sum(g.weight for g in obj.data.vertices[i].groups if g.group in nose_groups) for i in face.vertices]
                if min(weights, default=0) > .40 or (abs(center.x) < .17 and center.y < -.40 and 1.28 < center.z < 1.68):
                    face.material_index = nose_slot
                weights = [sum(g.weight for g in obj.data.vertices[i].groups if g.group in tongue_groups) for i in face.vertices]
                if min(weights, default=0) > .45:
                    face.material_index = tongue_slot

    def chest_mark(self):
        body = next(obj for obj in self.meshes if any("mat0_" in mat.name for mat in obj.data.materials))
        bpy.context.view_layer.update()
        vertices = [body.matrix_world @ v.co for v in body.data.vertices]
        tree = BVHTree.FromPolygons(vertices, [list(f.vertices) for f in body.data.polygons])
        nearest = KDTree(len(vertices))
        for index, vertex in enumerate(vertices):
            nearest.insert(vertex, index)
        nearest.balance()
        points, faces = [], []
        outline = [Vector((x, 0, z*.88)) for x, z in [(-.20,1.24),(-.12,1.17),(0,1.04),
            (.12,1.17),(.20,1.24),(.14,1.02),(.06,.96),(0,.92),(-.06,.96),(-.14,1.02)]]
        divisions = 6
        for triangle in tessellate_polygon([outline]):
            a, b, c = [outline[item] if isinstance(item, int) else item for item in triangle]
            indices = {}
            for i in range(divisions+1):
                for j in range(divisions+1-i):
                    point = a*(1-(i+j)/divisions)+b*i/divisions+c*j/divisions
                    hit = tree.ray_cast(Vector((point.x,-3,point.z)),Vector((0,1,0)))[0]
                    if hit is None:
                        raise ValueError("Chest marking must remain on the body surface")
                    indices[i,j] = len(points)
                    points.append(Vector((point.x,hit.y-.003,point.z)))
            for i in range(divisions):
                for j in range(divisions-i):
                    faces.append((indices[i,j],indices[i+1,j],indices[i,j+1]))
                    if i+j < divisions-1:
                        faces.append((indices[i+1,j],indices[i+1,j+1],indices[i,j+1]))
        inverse = self.arm.matrix_world.inverted()
        mesh = bpy.data.meshes.new("Angel white V")
        mesh.from_pydata([inverse @ p for p in points], [], faces)
        mesh.materials.append(material("Angel chest white", (1, .97, .98), .65))
        obj = bpy.data.objects.new("AngelChestV", mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = self.arm
        obj.matrix_world = self.arm.matrix_world.copy()
        for group in body.vertex_groups:
            obj.vertex_groups.new(name=group.name)
        for index, point in enumerate(points):
            _, source, _ = nearest.find(point)
            for group in body.data.vertices[source].groups:
                obj.vertex_groups[group.group].add([index], group.weight, "REPLACE")
        modifier = obj.modifiers.new("Chest skin", "ARMATURE")
        modifier.object = self.arm
        for face in mesh.polygons:
            face.use_smooth = True

    def head_parent(self, obj):
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = self.arm
        obj.parent_type = "BONE"
        obj.parent_bone = "atama_010"
        obj.matrix_world = world

    def flower(self):
        petal = material("Hibiscus rose", (.82, .055, .26))
        center = material("Hibiscus pollen", (1, .58, .08))
        for index in range(5):
            angle = index * math.tau / 5
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8,
                location=(.34 + math.sin(angle) * .10, -.36,
                          1.98 + math.cos(angle) * .10))
            obj = bpy.context.object
            obj.name = f"HibiscusPetal{index}"
            obj.scale = (.09, .027, .12)
            obj.rotation_euler.y = angle
            obj.data.materials.append(petal)
            for face in obj.data.polygons:
                face.use_smooth = True
            self.head_parent(obj)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8,
                                           location=(.34, -.405, 1.98))
        obj = bpy.context.object
        obj.name = "HibiscusCenter"
        obj.scale = (.046, .04, .046)
        obj.data.materials.append(center)
        self.head_parent(obj)

    def antennae(self):
        # A pair of deformable tubes; each has its own four-joint chain.
        pink = material("Angel antennae", (.88, .34, .58))
        inverse = self.arm.matrix_world.inverted()
        for side in (1, -1):
            def point(t):
                if t < .45:
                    u = t/.45
                    controls = [(side*.14, .30, 1.90), (side*.15, .60, 2.65),
                                (side*.60, .65, 2.70), (side*.62, .65, 2.05)]
                else:
                    u = (t-.45)/.55
                    controls = [(side*.62, .65, 2.05), (side*.68, .65, .60),
                                (side*.94, .65, .70), (side*.96, .55, 1.05)]
                p0, p1, p2, p3 = [Vector(p) for p in controls]
                return (1-u)**3*p0 + 3*(1-u)**2*u*p1 + 3*(1-u)*u*u*p2 + u**3*p3
            bpy.context.view_layer.objects.active = self.arm
            self.arm.select_set(True)
            bpy.ops.object.mode_set(mode="EDIT")
            names = []
            for j in range(4):
                name = f"Antenna{'L' if side == 1 else 'R'}{j}"
                bone = self.arm.data.edit_bones.new(name)
                bone.head = inverse @ point(j / 4)
                bone.tail = inverse @ point((j + 1) / 4)
                bone.parent = self.arm.data.edit_bones[names[-1] if names else "atama_010"]
                names.append(name)
            bpy.ops.object.mode_set(mode="OBJECT")
            self.arm.select_set(False)
            self.extra_bones.extend(names)
            vertices, faces = [], []
            rings, sides = 33, 8
            for j in range(rings):
                t = j / (rings - 1)
                direction = (point(min(1, t + .002)) - point(max(0, t - .002))).normalized()
                normal = direction.cross(Vector((0, 1, 0))).normalized()
                bitangent = direction.cross(normal)
                radius = .027 * (1 - .5 * t)
                for k in range(sides):
                    angle = k * math.tau / sides
                    vertices.append(inverse @ (point(t) + radius *
                        (math.cos(angle) * normal + math.sin(angle) * bitangent)))
                    if j:
                        a, b = (j-1)*sides+k, (j-1)*sides+(k+1)%sides
                        faces.append((a, b, b+sides, a+sides))
            mesh = bpy.data.meshes.new(f"AntennaTube{side}")
            mesh.from_pydata(vertices, [], faces)
            mesh.materials.append(pink)
            obj = bpy.data.objects.new(f"AngelAntenna{side}", mesh)
            bpy.context.collection.objects.link(obj)
            obj.parent = self.arm
            obj.matrix_world = self.arm.matrix_world.copy()
            groups = [obj.vertex_groups.new(name=name) for name in names]
            for j in range(rings):
                f = min(3, j / (rings-1) * 4)
                a = int(f); b = min(3, a+1); w = f-a
                indices = list(range(j*sides, (j+1)*sides))
                groups[a].add(indices, 1-w, "REPLACE")
                if b != a:
                    groups[b].add(indices, w, "REPLACE")
            modifier = obj.modifiers.new("Antenna skin", "ARMATURE")
            modifier.object = self.arm
            for face in mesh.polygons:
                face.use_smooth = True
        bpy.context.view_layer.update()

    def rotate(self, name, x=0, y=0, z=0):
        bone = self.bones.get(name)
        if bone is None:
            return
        # Express an anatomical rotation in stage coordinates, despite imported axes.
        base = (self.arm.matrix_world @ bone.bone.matrix_local).to_quaternion()
        delta = Euler(tuple(math.radians(a) for a in (x, y, z)), "XYZ").to_quaternion()
        bone.rotation_quaternion = base.inverted() @ delta @ base

    def translate(self, name, offset):
        bone = self.bones[name]
        basis = self.arm.matrix_world @ bone.bone.matrix_local
        bone.location = basis.inverted().to_3x3() @ Vector(offset)

    def joint(self, name):
        return self.arm.matrix_world @ self.bones[name].head

    def aim(self, name, child, target):
        bpy.context.view_layer.update()
        bone = self.bones[name]
        start = self.joint(name)
        direction = self.joint(child) - start
        desired = target - start
        if direction.length < 1e-8 or desired.length < 1e-8:
            return
        world_delta = direction.rotation_difference(desired)
        basis = (self.arm.matrix_world @ bone.matrix).to_quaternion()
        bone.rotation_quaternion = bone.rotation_quaternion @ basis.inverted() @ world_delta @ basis

    def hand(self, side, target, strength):
        names = ("L_ude1_061", "L_ude2_062", "L_te_063") if side == 1 else ("R_ude1_082", "R_ude2_083", "R_te_084")
        bpy.context.view_layer.update()
        shoulder, elbow, wrist = [self.joint(n) for n in names]
        target = wrist.lerp(Vector(target), strength)
        vector = target - shoulder
        length1, length2 = (elbow-shoulder).length, (wrist-elbow).length
        distance = min(length1+length2-.0001, max(abs(length1-length2)+.0001, vector.length))
        direction = vector.normalized()
        pole = Vector((side * .7, -.7, .05))
        perpendicular = (pole - direction * pole.dot(direction)).normalized()
        a = (length1**2-length2**2+distance**2) / (2*distance)
        h = math.sqrt(max(0, length1**2-a*a))
        middle = shoulder + a*direction + h*perpendicular
        self.aim(names[0], names[1], middle)
        self.aim(names[1], names[2], shoulder + direction*distance)

    def pose(self, clip, t, duration):
        for bone in self.bones:
            bone.rotation_quaternion = Quaternion()
            bone.location = (0, 0, 0)
            bone.scale = (1, 1, 1)
        e = envelope(t, duration)
        self.motion.location = (0, 0, 0)
        self.motion.rotation_euler = (0, 0, 0)
        self.motion.scale = (1, 1, 1)
        self.rotate("L_ude1_061", y=64)
        self.rotate("R_ude1_082", y=-64)
        self.rotate("L_ude2_062", z=-12)
        self.rotate("R_ude2_083", z=12)
        breathing = math.sin(t * math.tau / 3)
        self.rotate("hara1_07", x=breathing * .8)
        self.rotate("atama_010", x=breathing * .7, z=math.sin(t*1.2)*1.5)
        if self.kind == "angel":
            self.rotate("C_jaw_040", x=8)
            self.translate("LU_cor_052", (0, -.005, .034))
            self.translate("RU_cor_056", (0, -.005, .034))
        ear_base = 0
        self.rotate("L_mimi1_011", y=ear_base + math.sin(t*2)*2)
        self.rotate("R_mimi1_015", y=-ear_base + math.sin(t*2+.5)*2)
        for j, name in enumerate(self.extra_bones):
            self.rotate(name, x=math.sin(t*2-j*.6)*3, y=math.sin(t*1.6-j*.8)*2)
        # Two brief asymmetric blinks in the idle cycle; never stretch whole eyes.
        blink = max(0, 1-abs(t-1.7)/.12, 1-abs(t-4.8)/.12)
        for name in ("LU_eyelid_a_024", "LU_eyelid_b_025", "LU_eyelid_c_028",
                     "RU_eyelid_a_032", "RU_eyelid_b_033", "RU_eyelid_c_036"):
            self.translate(name, (0, -.003*blink, -.07*blink))
        if clip == "wave":
            self.hand(1, (.60 + .08*math.sin(t*9), -.16, 1.9), e)
            self.rotate("atama_010", y=-6*e, z=5*e)
        elif clip == "look":
            self.rotate("atama_010", x=-3*e, y=5*math.sin(t*2)*e, z=22*math.sin(t*1.5)*e)
        elif clip in ("scratch", "nose"):
            target = (.42, -.03, 1.76) if clip == "scratch" else (.03, -.49, 1.50)
            wiggle = .025*math.sin(t*16)*e
            self.hand(1, (target[0]+wiggle, target[1], target[2]+wiggle), e)
            self.rotate("atama_010", x=-4*e, y=8*e, z=-8*e)
            for name in ("L_yubiB1_067", "L_yubiC1_069", "L_yubiD1_071"):
                self.rotate(name, y=30*e)
        elif clip == "point":
            self.hand(-1, (-.79, -.08, .96), e)
            self.rotate("atama_010", z=-15*e, y=-5*e)
        elif clip == "celebrate":
            self.hand(1, (.65, -.04, 1.95), e)
            self.hand(-1, (-.65, -.04, 1.95), e)
            self.motion.location.z = max(0, math.sin((t-.8)*math.tau/1.4))*.10*e
            self.rotate("C_jaw_040", x=(8 if self.kind == "angel" else 0)+9*e)
            self.rotate("atama_010", x=-6*e, y=4*math.sin(t*4)*e)
        elif clip == "sad":
            self.rotate("atama_010", x=12*e, y=-5*e)
            self.rotate("L_mimi1_011", y=ear_base+20*e)
            self.rotate("R_mimi1_015", y=-ear_base-20*e)
            self.translate("LU_cor_052", (0, 0, -.022*e))
            self.translate("RU_cor_056", (0, 0, -.022*e))
        elif clip == "dance":
            self.motion.location.x = .09*math.sin(t*math.tau)*e
            self.rotate("hara1_07", y=5*math.sin(t*math.tau)*e)
            self.rotate("atama_010", y=-6*math.sin(t*math.tau)*e)
            self.hand(1, (.65, -.22, 1.3+.16*math.sin(t*math.tau)), e)
            self.hand(-1, (-.65, -.22, 1.3-.16*math.sin(t*math.tau)), e)
        elif clip == "reference":
            self.hand(1, (.60, -.30, 1.63), e)
            self.hand(-1, (-.60, -.30, 1.63), e)
            self.rotate("atama_010", y=-10*e)
            self.rotate("R_momo_0110", x=-35*e, y=-20*e)
            self.rotate("R_sune_0111", x=65*e)
        elif clip == "headstand":
            # Complete entrance and exit, with contact pinned to the stage.
            inversion = smooth((t-.6)/1.6) * smooth((duration-t-.6)/1.6)
            self.hand(1, (.45, -.21, 1.90), inversion)
            self.hand(-1, (-.45, -.21, 1.90), inversion)
            self.rotate("L_momo_0103", y=10*math.sin(t*3)*inversion)
            self.rotate("R_momo_0110", y=-10*math.sin(t*3)*inversion)
            self.motion.rotation_euler.y = -math.pi * inversion
            bpy.context.view_layer.update()
            graph = bpy.context.evaluated_depsgraph_get()
            minimum = min((obj.evaluated_get(graph).matrix_world @ Vector(c)).z
                          for obj in self.meshes for c in obj.evaluated_get(graph).bound_box)
            self.motion.location.z = -minimum
        bpy.context.view_layer.update()

    def animate(self):
        actions = []
        for clip, duration in CLIPS.items():
            if self.kind == "angel" and clip in ("nose", "headstand") or self.kind == "stitch" and clip == "reference":
                continue
            self.arm.animation_data_clear()
            self.motion.animation_data_clear()
            for frame in range(0, duration*FPS+1, 3):
                self.pose(clip, frame/FPS, duration)
                for bone in self.bones:
                    bone.keyframe_insert("rotation_quaternion", frame=frame)
                    if bone.location.length > 0 or any(x in bone.name for x in ("eyelid", "cor_")):
                        bone.keyframe_insert("location", frame=frame)
                self.motion.keyframe_insert("location", frame=frame)
                self.motion.keyframe_insert("rotation_euler", frame=frame)
            rig_action = self.arm.animation_data.action
            rig_action.name = f"{clip}-rig"
            root_action = self.motion.animation_data.action
            root_action.name = f"{clip}-motion"
            actions.append((clip, duration, rig_action, root_action))
        for obj, index in ((self.arm, 2), (self.motion, 3)):
            obj.animation_data_create()
            obj.animation_data.action = None
            for clip, duration, *unused in actions:
                action = next(row[index] for row in actions if row[0] == clip)
                track = obj.animation_data.nla_tracks.new()
                track.name = clip
                strip = track.strips.new(clip, 0, action)
                strip.frame_end = duration*FPS
                strip.extrapolation = "NOTHING"
                track.mute = True
        self.pose("idle", 0, CLIPS["idle"])

    def save(self, output, sources):
        sources.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(sources / f"{self.kind}.blend"))
        bpy.ops.object.select_all(action="DESELECT")
        for obj in bpy.context.scene.objects:
            if obj.name != "Icosphere":
                obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(output / f"{self.kind}.glb"),
            export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="NLA_TRACKS", export_force_sampling=True,
            export_frame_step=2, export_optimize_animation_size=True,
            export_nla_strips=True, export_extras=False,
            export_image_format="AUTO", export_materials="EXPORT")


if __name__ == "__main__":
    source, output, sources = [Path(a).resolve() for a in sys.argv[sys.argv.index("--")+1:]]
    output.mkdir(parents=True, exist_ok=True)
    # Angel's rejected Stitch adaptation stays out of the working preview.
    # Her replacement is being built from the sole user-selected image.
    for kind in ("stitch",):
        character = Character(source, kind)
        character.animate()
        character.save(output, sources)
