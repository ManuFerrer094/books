"""Offline Cycles renders of CC0 models and our complementary shelf ornaments.

Run with Blender --background --factory-startup --disable-autoexec --python
scripts/render-bookshelf-decor.py -- [asset names]. The app never needs Blender.
"""
import bpy, bmesh, math, random, sys, json, re
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path.cwd()
SOURCES = ROOT / '.tmp/decor-source/models'
OUTPUT = ROOT / '.tmp/decor-source/renders'
OUTPUT.mkdir(parents=True, exist_ok=True)
random.seed(42)

# Stable editor identifiers are preserved, even where the new plant has a more
# accurate display name. Masks identify just the material that can be recolored.
ASSETS = {
 'fern': ('fern_02', 'fern_02_b', 'fern', '#70814d', 0),
 'monstera': ('potted_plant_02', '', 'leaves', '#527745', 12),
 'ivy': ('potted_plant_01', '', 'leaves', '#66814d', -12),
 'cactus': ('potted_plant_04', '', 'potted_plant_04', '#66814d', 15),
 'flowers': ('flower_gazania', 'flower_gazania_h_LOD0', 'flower', '#68854a', 0),
 'bonsai': ('potted_plant_04', 'potted_plant_04_pot', 'foliage', '#53734a', 0),
 'pot': ('planter_pot_clay', '', 'planter_pot_clay', '#bb805d', 0),
 'ceramic-pot': ('potted_plant_04', 'potted_plant_04_pot', 'potted_plant_04', '#d5d4c6', 15),
 'vase': ('ceramic_vase_01', '', 'ceramic_vase_01', '#dbd9ce', 0),
 'round-vase': ('ceramic_vase_02', '', 'ceramic_vase_02', '#bf9b82', 0),
 'candle': ('brass_candleholders', 'brass_candleholder_01', 'brass_candleholders_01', '#b89851', 0),
 'candles': ('brass_candleholders', 'brass_candleholder_01', 'brass_candleholders_01', '#b89851', 0),
 'lamp': ('desk_lamp_arm_01', '', '^desk_lamp_arm_01$', '#85816e', 20),
 'lantern': ('wooden_lantern_01', '', '^wooden_lantern_01$', '#997957', 15),
 'portrait': ('standing_picture_frame_01', '', '^standing_picture_frame_01$', '#54514c', 0),
 'landscape': ('standing_picture_frame_02', '', '^standing_picture_frame_02$', '#b39977', 0),
 'cat': ('concrete_cat_statue', '', 'concrete_cat_statue', '#d6d2c3', -12),
 'bird': (None, '', '', '#c7d2c8', 0),
 'moon': (None, '', '', '#bda168', 0),
 'star': (None, '', '', '#bda168', 0),
 'arch': (None, '', '', '#d7cec0', 0),
 'mountain': (None, '', '', '#a8aba7', 0),
 'divider': (None, '', '', '#bda168', 0),
 'label': (None, '', '', '#bda168', 0),
 'clock': ('mantel_clock_01', '', '^mantel_clock_01$', '#917657', 0),
 'mug': ('tea_set_01', 'tea_set_01_cup_small_01', '^tea_set_01$', '#dbd4c5', -90),
 'crystal': (None, '', '', '#b4a3c3', 0),
}

def meshes():
    return [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]

def bounds(objects):
    points = [obj.matrix_world @ Vector(p) for obj in objects for p in obj.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])

def transform(objects, matrix):
    # Freeze world matrices first, so parents cannot produce a double transform.
    transforms = [(obj, obj.matrix_world.copy()) for obj in objects]
    for obj, original in transforms: obj.matrix_world = matrix @ original
    bpy.context.view_layer.update()

def fit(objects, width=None, height=None, floor=0):
    low, high = bounds(objects)
    scale = (width / (high.x - low.x)) if width else height / (high.z - low.z)
    center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    transform(objects, Matrix.Translation((0, 0, floor)) @ Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(-center))

def source(asset, name=''):
    path = SOURCES / asset / f'{asset}.blend'
    existing_images = set(bpy.data.images)
    with bpy.data.libraries.load(str(path), link=False) as (available, loaded):
        loaded.objects = available.objects
    originals = [obj for obj in loaded.objects if obj]
    for image in set(bpy.data.images) - existing_images:
        if image.filepath.startswith('//'): image.filepath = str(path.parent / image.filepath[2:])
    for obj in originals:
        bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    copies = []
    for obj in originals:
        if obj.type not in ('MESH', 'CURVE') or obj.hide_render or obj.name.lower().startswith(('wdg_', 'wgt')): continue
        if name and obj.name != name: continue
        if re.search(r'LOD[1-9]', obj.name): continue
        evaluated = obj.evaluated_get(graph)
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=graph)
        copy = bpy.data.objects.new(obj.name + '_render', mesh)
        copy.matrix_world = evaluated.matrix_world.copy()
        bpy.context.scene.collection.objects.link(copy)
        copies.append(copy)
    for obj in originals: bpy.data.objects.remove(obj, do_unlink=True)
    if not copies: raise RuntimeError(f'Model contains no renderable geometry: {asset}/{name}')
    bpy.context.view_layer.update()
    return copies

def material(name, rgb, roughness=.35, metal=0, editable=False, transmission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat['editable_tint'] = editable
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Transmission Weight'].default_value = transmission
    bsdf.inputs['IOR'].default_value = 1.46
    noise = mat.node_tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 110 if metal else 65
    bump = mat.node_tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .09
    bump.inputs['Distance'].default_value = .025
    mat.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    mat.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

def finish(obj, mat, bevel=0, smooth=True):
    obj.data.materials.clear(); obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL'); mod.width = bevel; mod.segments = 4
        normal = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    if smooth:
        for polygon in obj.data.polygons: polygon.use_smooth = True
    return obj

def box(name, location, size, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object; obj.name = name; obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)

def ellipsoid(name, location, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1, location=location)
    obj = bpy.context.object; obj.name = name; obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat)

def tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = radius; curve.bevel_resolution = 4
    spline = curve.splines.new('BEZIER'); spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points): point.co = co; point.handle_left_type = 'AUTO'; point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj); curve.materials.append(mat)
    return obj

def profile(name, outline, thickness, mat, bevel=.015):
    # X/Z silhouette extruded along Y; concave outlines keep their real openings.
    n = len(outline)
    verts = [(x, -thickness/2, z) for x,z in outline] + [(x, thickness/2, z) for x,z in outline]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update()
    bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    return finish(obj, mat, bevel, False)

def complementary(asset):
    ivory = material('Porcelain', (.72,.74,.66), .2, editable=True)
    brass = material('Brushed brass', (.61,.43,.17), .24, .8, editable=True)
    base = material('Limestone base', (.66,.62,.55), .43)
    if asset == 'bird':
        box('Plinth', (0,0,.07), (.57,.35,.14), base)
        ellipsoid('Body', (-.05,0,.49), (.29,.14,.22), ivory)
        tube('Curved neck', [(.12,0,.58),(.31,0,.78),(.17,0,.92),(.12,0,1.02)], .075, ivory)
        ellipsoid('Head', (.11,0,1.02), (.09,.075,.085), ivory)
        profile('Beak', [(.03,1.04),(-.19,1.01),(.02,.98)], .04, brass, .005)
        profile('Tail', [(-.22,.47),(-.49,.62),(-.34,.41)], .12, ivory)
        for x in (-.09,.08): tube('Leg', [(x,0,.12),(x+.015,0,.32)], .021, brass)
        dark = material('Eye', (.02,.028,.025), .2)
        ellipsoid('Eye', (.08,-.072,1.04), (.012,.008,.012), dark)
    elif asset in ('moon','star'):
        box('Stone plinth', (0,0,.045), (.62,.28,.09), base)
        tube('Stand', [(0,0,.06),(0,0,.32)], .018, brass)
        if asset == 'star':
            points = [(math.cos(math.pi/2+i*math.pi/5)*(.45 if i%2==0 else .22), .74+math.sin(math.pi/2+i*math.pi/5)*(.45 if i%2==0 else .22)) for i in range(10)]
        else:
            # Explicit paired quads avoid ambiguous tessellation of a very
            # concave crescent ngon (which can leave black interior triangles).
            count = 51
            outer = [(.43*math.cos(math.radians(55+250*i/(count-1))), .76+.43*math.sin(math.radians(55+250*i/(count-1)))) for i in range(count)]
            inner = [(.17+.32*math.cos(math.radians(70+220*i/(count-1))), .76+.38*math.sin(math.radians(70+220*i/(count-1)))) for i in range(count)]
            inner[0], inner[-1] = outer[0], outer[-1]
            verts = [(x,y,z) for y in (-.0375,.0375) for curve in (outer,inner) for x,z in curve]
            faces = []
            for i in range(count-1):
                faces += [(i,i+1,count+i+1,count+i), (2*count+i,3*count+i,3*count+i+1,2*count+i+1), (i,2*count+i,2*count+i+1,i+1), (count+i,count+i+1,3*count+i+1,3*count+i)]
            mesh = bpy.data.meshes.new('Crescent'); mesh.from_pydata(verts,[],faces); mesh.update()
            bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
            obj=bpy.data.objects.new('Crescent',mesh); bpy.context.collection.objects.link(obj); finish(obj,brass,.009,False)
            return
        profile(asset, points, .075, brass, .012)
    elif asset == 'arch':
        ceramic = material('Warm ivory ceramic', (.76,.70,.60), .25, editable=True)
        points = [(-.5,0),(-.5,.56)] + [(.5*math.cos(a*math.pi/36), .56+.5*math.sin(a*math.pi/36)) for a in range(36,-1,-1)]
        points += [(.5,0),(.27,0),(.27,.56)] + [(.27*math.cos(a*math.pi/36), .56+.27*math.sin(a*math.pi/36)) for a in range(37)] + [(-.27,0)]
        profile('Ceramic arch', points, .24, ceramic, .024)
    elif asset == 'mountain':
        stone = material('Slate', (.36,.40,.39), .42, editable=True)
        profile('Mountain ridge', [(-.55,0),(-.36,.56),(-.2,.48),(.05,1.01),(.29,.57),(.36,.68),(.57,0)], .27, stone, .014)
        snow = material('Quartz cap', (.83,.82,.74), .35)
        cap = profile('Quartz vein', [(-.07,.78),(.05,1.01),(.17,.78),(.07,.82),(.01,.75)], .275, snow, .005)
    elif asset in ('divider','label'):
        box('Brass divider', (0,0,.71), (.1,.10,1.42), brass, .014)
        box('Foot', (.13,.0,.018), (.34,.2,.036), brass, .007)
        if asset == 'label':
            box('Label frame', (0,-.01,.93), (.53,.08,.29), brass, .022)
            paper = material('Ivory paper', (.83,.78,.65), .65)
            box('Inset label', (0,-.057,.93), (.45,.014,.21), paper, .014)
            bpy.ops.object.text_add(location=(0,-.068,.908), rotation=(math.pi/2,0,0))
            text = bpy.context.object; text.data.body='RELATOS'; text.data.align_x='CENTER'; text.data.size=.064; text.data.extrude=.0003
            text.data.materials.append(material('Lettering', (.10,.10,.08), .6))
    elif asset == 'crystal':
        quartz = material('Lavender quartz', (.42,.31,.57), .1, editable=True, transmission=.55)
        for x, y, height, radius in [(0,0,1.1,.24),(-.26,-.06,.65,.17),(.28,.07,.8,.18)]:
            sides=6
            verts=[(x+radius*math.cos(i*math.tau/sides),y+radius*math.sin(i*math.tau/sides),z) for z in (0,height*.76) for i in range(sides)] + [(x+.03,y,height)]
            faces=[tuple(range(sides-1,-1,-1))] + [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)] + [(i+sides,(i+1)%sides+sides,2*sides) for i in range(sides)]
            mesh=bpy.data.meshes.new('Crystal'); mesh.from_pydata(verts,[],faces); mesh.update()
            obj=bpy.data.objects.new('Crystal',mesh); bpy.context.collection.objects.link(obj); finish(obj,quartz,.004,False)

def construct(asset):
    model, selection, tint, _, angle = ASSETS[asset]
    primary = source(model, selection) if model else []
    if asset in ('fern','flowers'):
        pot = source('planter_pot_clay'); fit(pot, width=.48)
        _, top = bounds(pot)
        fit(primary, width=.92 if asset=='fern' else .75, floor=top.z*(.90 if asset=='fern' else .20))
    elif asset == 'bonsai':
        fit(primary, width=.74)
        _, top = bounds(primary)
        bark = material('Bonsai bark', (.16,.10,.05), .7)
        foliage = material('Bonsai foliage', (.12,.24,.075), .38, editable=True)
        ellipsoid('Soil', (0,0,top.z*.93), (.31,.29,.025), bark)
        z=top.z*.92
        tube('Trunk', [(0,0,z),(-.04,0,z+.22),(.06,0,z+.43),(0,0,z+.70)], .047, bark)
        for cx,cy,cz,spread in [(-.23,0,z+.43,.22),(.23,.01,z+.6,.24),(-.08,.03,z+.77,.25)]:
            tube('Branch', [(0,0,z+.25),(cx*.6,cy,cz-.09),(cx,cy,cz)], .022, bark)
            for i in range(95):
                a=random.random()*math.tau; r=spread*math.sqrt(random.random()); py=(random.random()-.5)*spread*1.4
                leaf=ellipsoid('Leaf', (cx+math.cos(a)*r,cy+py,cz+math.sin(a)*r*.30), (.036,.009,.019), foliage)
                leaf.rotation_euler=(random.uniform(-.6,.6),random.uniform(-.5,.5),a)
    elif asset == 'candles':
        fit(primary, height=.8)
        original=primary[0]
        original.location.x=-.24
        for x, scale in [(0,.8),(.24,1.12)]:
            copy=original.copy(); copy.data=original.data.copy(); bpy.context.collection.objects.link(copy)
            copy.matrix_world=Matrix.Translation((x,0,0)) @ Matrix.Diagonal((scale,scale,scale,1)) @ Matrix.Translation((.24,0,0)) @ original.matrix_world
    elif asset == 'cat':
        ceramic=material('Glazed ceramic cat', (.74,.73,.67), .23, editable=True)
        for obj in primary: obj.data.materials.clear(); obj.data.materials.append(ceramic)
    elif not model: complementary(asset)
    # Recolor just the intended material, never the photograph/artwork or flame.
    for mat in bpy.data.materials:
        if tint and re.search(tint, mat.name) and not re.search('glass|artwork|flame|light', mat.name): mat['editable_tint']=True
    visible=[obj for obj in bpy.context.scene.objects if obj.type in ('MESH','CURVE','FONT') and not obj.hide_render]
    if angle: transform(visible, Matrix.Rotation(math.radians(angle),4,'Z'))
    # Include evaluated curves/fonts in silhouette bounds.
    graph=bpy.context.evaluated_depsgraph_get()
    for obj in list(visible):
        if obj.type == 'MESH': continue
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(graph), depsgraph=graph)
        copy=bpy.data.objects.new(obj.name+'_static',mesh); copy.matrix_world=obj.matrix_world; bpy.context.collection.objects.link(copy)
        bpy.data.objects.remove(obj,do_unlink=True)
    fit(meshes(), height=1)

def light(name, location, power, size, color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=location
    obj.rotation_euler=(Vector((0,0,.55))-obj.location).to_track_quat('-Z','Y').to_euler()

def setup():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24
    scene.cycles.use_denoising=True; scene.cycles.adaptive_threshold=.06
    scene.cycles.max_bounces=6; scene.cycles.transparent_max_bounces=12
    scene.render.threads_mode='FIXED'; scene.render.threads=6
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.image_settings.color_depth='8'
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.world=bpy.data.worlds.new('Studio environment'); scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.58,.62,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.6
    low,high=bounds(meshes()); aspect=max(.25,(high.x-low.x)/1.05)
    scene.render.resolution_y=1024; scene.render.resolution_x=max(160,math.ceil(1024*aspect)); scene.render.resolution_percentage=100
    camera=bpy.data.cameras.new('Frontal camera'); camera.type='ORTHO'; camera.ortho_scale=max(1.10,1.10*aspect)
    obj=bpy.data.objects.new('Frontal camera',camera); scene.collection.objects.link(obj)
    obj.location=(0,-6,.78); obj.rotation_euler=(Vector((0,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler(); scene.camera=obj
    light('Large warm key',(-3,-4,6),480,4,(1,.90,.78))
    light('Neutral fill',(3,-2,3),180,3,(.82,.91,1))
    light('Soft rim',(2,3,4),280,3,(1,.94,.83))

def mask_material(editable):
    mat=bpy.data.materials.new('Tint mask' if editable else 'Holdout'); mat.use_nodes=True
    nodes=mat.node_tree.nodes; nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    shader=nodes.new('ShaderNodeEmission' if editable else 'ShaderNodeHoldout')
    if editable: shader.inputs['Color'].default_value=(1,1,1,1); shader.inputs['Strength'].default_value=1
    mat.node_tree.links.new(shader.outputs[0],output.inputs['Surface'])
    return mat

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(ASSETS)
for asset in args:
    if asset not in ASSETS: raise ValueError(asset)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    construct(asset); setup()
    scene=bpy.context.scene
    scene.render.filepath=str(OUTPUT / f'{asset}.png')
    bpy.ops.render.render(write_still=True)
    white=mask_material(True); holdout=mask_material(False)
    editable_count=0
    for obj in meshes():
        for slot in obj.material_slots:
            editable=bool(slot.material and slot.material.get('editable_tint'))
            # This scan uses one texture atlas for plant, soil and pot. Select
            # the plant mesh rather than recoloring the whole atlas.
            if asset == 'cactus': editable = obj.name.startswith('potted_plant_04_plant')
            editable_count+=int(editable); slot.material=white if editable else holdout
    if not editable_count: raise RuntimeError(f'No editable material for {asset}')
    scene.cycles.samples=4; scene.cycles.use_denoising=False
    scene.render.filepath=str(OUTPUT / f'{asset}.mask.png')
    bpy.ops.render.render(write_still=True)
    print('DECOR_RENDERED',asset,flush=True)
