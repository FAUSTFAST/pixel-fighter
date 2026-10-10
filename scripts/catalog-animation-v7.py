"""Inspect original generated sheets and write animation metadata (PNG files untouched).

One fixed scale per sheet; reviewed hip landmarks register walking poses to the
same skeleton origin. Alpha bounds trim storage, never stretch or resize poses.
Requires Pillow, no game tests.
"""
from pathlib import Path
from statistics import median
import json
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'assets/characters/animation-v7'
CHARS = ['ryu', 'mei', 'tank', 'volt', 'kaze', 'sage']
GROUPS = {
    'walk': {'walk': list(range(8)), 'backwalk': list(range(8,16))},
    'stance': {'idle': list(range(4)), 'crouch': list(range(4,8)), 'guard': list(range(8,12)), 'guardLow': list(range(12,16))},
    'air': {'jump': list(range(4)), 'backjump': list(range(4,8)), 'airPunch': list(range(8,12)), 'airKick': list(range(12,16))},
    'punch': {'jab': list(range(8)), 'heavy': list(range(8,16))},
    'kick': {'kick': list(range(8)), 'lowKick': list(range(8,16))},
    'special': {'cast': list(range(4)), 'rise': list(range(4,8)), 'rush': list(range(8,12)), 'throw': list(range(12,16))},
    'reaction': {'head': list(range(4)), 'body': list(range(4,8)), 'fall': list(range(8,12)), 'getup': list(range(12,16))},
}
NEUTRAL = {'walk':[0,7,8,15], 'stance':[0,1,2,3], 'air':[1,5], 'punch':[0,7,8,15], 'kick':[0,7], 'special':[0,3], 'reaction':[3,15]}

def inspect(path, sheet, neutral_slots, grid=(4,4), hip_x=None, frame_count=None):
    im = Image.open(path).convert('RGBA')
    w,h = im.size
    columns,rows=grid
    count=frame_count or columns*rows
    alpha = im.getchannel('A').tobytes()
    if min(alpha) > 0:
        raise ValueError('No transparent background')
    visited = bytearray(w*h)
    bodies = []
    for seed,value in enumerate(alpha):
        if value <= 64 or visited[seed]:
            continue
        queue=[seed];visited[seed]=1
        x0=x1=seed%w;y0=y1=seed//w;n=0
        while queue:
            p=queue.pop();x=p%w;y=p//w;n+=1
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for q in (p-1 if x else -1,p+1 if x<w-1 else -1,p-w if y else -1,p+w if y<h-1 else -1):
                if q>=0 and not visited[q] and alpha[q]>64:
                    visited[q]=1;queue.append(q)
        if n > 500:
            bodies.append({'rect':[x0,y0,x1-x0+1,y1-y0+1], 'seed':seed, 'pixels':n})
    cells={}
    for body in bodies:
        x,y,bw,bh=body['rect']
        col=min(columns-1,int((x+bw*.5)/(w/columns)))
        row=min(rows-1,int((y+bh*.5)/(h/rows)))
        slot=row*columns+col
        if slot not in cells or cells[slot]['pixels']<body['pixels']:
            cells[slot]=body
    if len(cells)!=count:
        raise ValueError(f'Expected {count} independent poses; found {len(cells)} cells, {len(bodies)} bodies')
    # Inspect the neutral poses once. Attacks and crouches use this SAME scale.
    neutral=[cells[i] for i in neutral_slots]
    height=median(b['rect'][3] for b in neutral)
    if sheet.startswith('walk'):
        for i,b in cells.items():
            x,y,bw,bh=b['rect']
            if bh<height*.85 or bh>height*1.15 or y+bh>=h:
                raise ValueError(f'Walking pose {i} is cropped or has inconsistent standing height')
    if sheet=='air':
        height=max(b['rect'][3] for b in cells.values())
    scale=50/height
    roots=[];grounds=[]
    for i in neutral_slots:
        x,y,bw,bh=cells[i]['rect']
        # Neutral ankle midpoint provides an origin independent of hair or weapon reach.
        ankle=[xx for yy in range(y+int(bh*.88),y+bh) for xx in range(x,x+bw) if alpha[yy*w+xx]>64]
        roots.append((min(ankle)+max(ankle))/2-(i%columns)*w/columns if ankle else w/(columns*2))
        grounds.append(y+bh-(i//columns)*h/rows)
    root=median(roots);ground=median(grounds)
    if hip_x is not None:
        if not sheet.startswith('walk') or len(hip_x)!=count:
            raise ValueError('Hip registration must cover every walking pose')
        # Generated sheet cells are not registered to the same body position.
        # Keep the pelvis stable, retaining the authored limb motion and lean.
        hip_origin=median(hip_x[i]-(i%columns)*w/columns for i in neutral_slots)
    row_ground=[median(cells[i]['rect'][1]+cells[i]['rect'][3] for i in range(r*columns,min(count,(r+1)*columns))) for r in range((count+columns-1)//columns)]
    if sheet=='reaction':
        row_ground[2]=cells[11]['rect'][1]+cells[11]['rect'][3]
    frames=[]
    for i in range(count):
        body=cells[i];body.pop('pixels')
        body['root']=round((i%columns)*w/columns+root,3)
        if hip_x is not None:
            body['root']=round(hip_x[i]-hip_origin+root,3)
        # A slow walking pose always has a planted support sole. Align that sole
        # to the floor, removing sheet-layout drift without stretching the body.
        body['ground']=round(body['rect'][1]+body['rect'][3] if sheet.startswith('walk') else row_ground[i//columns],3)
        body['slot']=i
        frames.append(body)
    return {'sheet':path.stem,'scale':round(scale,7),'size':[w,h],'frames':frames,'sourceHeight':height}

def main():
    # Only manually reviewed sheets may enter the game. A generator finishing in
    # the background must not silently replace a character's approved costume.
    lock=json.loads((DIR/'identity-lock.json').read_text())
    cachepath=DIR/'catalog-cache.json'
    cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
    manifest={'version':7,'identityVersion':lock['version'],'mode':'built-in imagegen','characters':{}}
    report=[]
    for char in CHARS:
        approved=lock['characters'][char]
        clips={}
        sheet_data={}
        for sheet,groups in GROUPS.items():
            asset=approved['sheets'][sheet]
            path=DIR/asset['file']
            try:
                if not path.name.startswith(char+'-') or path.parent!=DIR:
                    raise ValueError('Sheet belongs to another character')
                digest=hashlib.sha256(path.read_bytes()).hexdigest()
                if digest!=asset['sha256']:
                    raise ValueError('Sheet changed since visual identity review')
                neutral=asset.get('neutral',NEUTRAL[sheet])
                grid=asset.get('grid',[4,4])
                hip_x=asset.get('hipX')
                authored_groups=asset.get('clips',groups)
                if set(authored_groups)!=set(groups):
                    raise ValueError('Unexpected clip names in approved sheet')
                stamp=['style-stable1',digest,neutral,grid,hip_x]
                entry=cache.get(path.name)
                if not entry or entry['stamp']!=stamp:
                    entry={'stamp':stamp,'data':inspect(path,sheet,neutral,grid,hip_x)}
                    cache[path.name]=entry
                    cachepath.write_text(json.dumps(cache,separators=(',',':')))
                data=entry['data']
                sheet_data[sheet]=data
                for clip,indices in authored_groups.items():
                    clips[clip]={'owner':char,'identity':approved['identity'],'revision':digest[:16],
                        'sheet':data['sheet'],'scale':data['scale'],'frames':[data['frames'][i] for i in indices]}
                report.append({'asset':path.name,'status':'cataloged','frames':len(data['frames']),'sourceHeight':data['sourceHeight']})
            except (ValueError,OSError) as error:
                report.append({'asset':path.name,'status':'needs-art-repair','detail':str(error)})
        for direction,clip_name in [('Forward','walk'),('Backward','backwalk')]:
            asset=approved['sheets'].get('walk'+direction)
            if not asset:
                continue
            path=DIR/asset['file']
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            if digest!=asset['sha256']:
                raise ValueError('Walking sheet changed since visual review')
            data=inspect(path,'walk'+direction,asset['neutral'],asset['grid'],asset.get('hipX'),asset['count'])
            clips[clip_name]={'owner':char,'identity':approved['identity'],'revision':digest[:16],
                'sheet':data['sheet'],'scale':data['scale'],'frames':data['frames']}
            report.append({'asset':path.name,'status':'cataloged','frames':asset['count'],'sourceHeight':data['sourceHeight']})
        if len(clips)==sum(len(groups) for groups in GROUPS.values()):
            # Airborne legs fold; feet and flying cloth are not a body origin or
            # a height reference. Register all aerial poses to the standing hip.
            stance=sheet_data['stance']
            hip=approved['standingHip']
            reference=stance['frames'][0]
            hip_offset=[(hip[0]-reference['root'])*stance['scale'],
                        (hip[1]-reference['ground'])*stance['scale']]
            air=approved['sheets']['air']
            air_scale=stance['scale']*air.get('bodyScale',1)
            for name in GROUPS['air']:
                clips[name]['scale']=air_scale
                clips[name]['frames']=[dict(f) for f in clips[name]['frames']]
                for frame in clips[name]['frames']:
                    x,y=air['hips'][frame['slot']]
                    frame['root']=round(x-hip_offset[0]/air_scale,3)
                    frame['ground']=round(y-hip_offset[1]/air_scale,3)
            # Locomotion must derive from the exact neutral costume / head / hip
            # pixels. Separately generated walk sheets remain archived references.
            for name,direction in [('walk',1),('backwalk',-1)]:
                idle=clips['idle']
                clips[name]={**idle,'gaitRig':{'base':'idle','frame':0,'steps':16,'direction':direction,'hip':hip_offset},
                    'frames':[{**idle['frames'][0],'slot':i} for i in range(16)]}
            manifest['characters'][char]=clips
    issues=[r for r in report if r['status']!='cataloged']
    (DIR/'catalog-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'ready':list(manifest['characters']),'assets':len(report)-len(issues),'issues':issues},ensure_ascii=False))
    if issues or len(manifest['characters'])!=len(CHARS):
        raise SystemExit('Incomplete identity set; previous manifest retained')
    # Publish all 6 complete identities together; never publish half a new outfit.
    pending=DIR/'manifest.pending.json'
    pending.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    pending.replace(DIR/'manifest.json')

if __name__=='__main__':
    main()
