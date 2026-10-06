"""Catalog original imagegen sprite sheets; writes metadata only, never modifies art."""
from PIL import Image
from pathlib import Path
import json, statistics
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'assets/characters/animation-v6'

def catalog(name):
    im=Image.open(DIR/(name+'.png'));w,h=im.size
    alpha=im.getchannel('A');pixels=alpha.tobytes();seen=bytearray(w*h);bodies=[]
    for pos,value in enumerate(pixels):
        if value<=64 or seen[pos]:continue
        todo=[pos];seen[pos]=1;x0=x1=pos%w;y0=y1=pos//w;n=0
        while todo:
            p=todo.pop();x=p%w;y=p//w;n+=1;x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for q in (p-1 if x else -1,p+1 if x<w-1 else -1,p-w if y else -1,p+w if y<h-1 else -1):
                if q>=0 and not seen[q] and pixels[q]>64:seen[q]=1;todo.append(q)
        if n>1000:bodies.append({'rect':[x0,y0,x1-x0+1,y1-y0+1],'seed':pos,'bottom':y1+1})
    rows=[]
    for b in sorted(bodies,key=lambda b:b['bottom']):
        if not rows or b['bottom']-statistics.median(x['bottom'] for x in rows[-1])>45:rows.append([])
        rows[-1].append(b)
    for row in rows:
        row.sort(key=lambda b:b['rect'][0])
        for b in row:
            x,y,bw,bh=b['rect']
            # Root follows the torso, never the bounding-box centre of an extended limb.
            band=[]
            for yy in range(y+int(bh*.47),y+int(bh*.60)):
                band.extend(xx for xx in range(x,x+bw) if pixels[yy*w+xx]>64)
            b['root']=round(statistics.median(band) if band else x+bw*.5,2)
            b['ground']=b.pop('bottom')
    return rows

names=['ryu','mei','tank','volt','kaze','sage','kicks','kaze-strike','mei-recoil']
rows={name:catalog(name) for name in names if (DIR/(name+'.png')).exists()}
result={'version':6,'mode':'built-in imagegen','characters':{}}
for name in names[:6]:
    rs=rows[name];walk=[b for row in rs[:2] for b in (row[1:9] if name=='mei' else row)]
    back=[b for row in rs[2:4] for b in (row[1:9] if name=='mei' else row)]
    groups={'walk':(name,walk),'backwalk':(name,back),'strike':(name,rs[4]),'kick':(name,rs[5]),'rise':(name,rs[5 if name=='volt' else 6]),'recoil':(name,rs[6 if name=='volt' else 7])}
    if name in ('ryu','volt'):
        start=0 if name=='ryu' else 2;groups['kick']=('kicks',rows['kicks'][start]+rows['kicks'][start+1])
    if name=='kaze' and 'kaze-strike' in rows:groups['strike']=('kaze-strike',sum(rows['kaze-strike'],[]))
    if name=='mei' and 'mei-recoil' in rows:groups['recoil']=('mei-recoil',sum(rows['mei-recoil'],[]))
    clips={}
    for clip,(sheet,frames) in groups.items():
        # Fixed scale per sequence, calibrated from its neutral pose; never resize each frame.
        reference=statistics.median(b['rect'][3] for b in frames) if clip in ('walk','backwalk') else statistics.mean([frames[0]['rect'][3],frames[-1]['rect'][3]])
        scale=50/reference
        clips[clip]={'sheet':sheet,'scale':round(scale,6),'frames':frames}
    result['characters'][name]=clips
(DIR/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
print({name:{clip:len(data['frames']) for clip,data in clips.items()} for name,clips in result['characters'].items()})
