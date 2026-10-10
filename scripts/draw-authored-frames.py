"""Fixed pixel drawings from explicitly authored exposure sheets.

No image generation model, optical flow, bitmap deformation or inbetweening.
Face / hair shapes retain the approved reference with a unified material palette.
Bodies, clothes,
limbs and their connecting joints are painted afresh for each listed pose.
Edit POSES and the character palettes to edit the drawings; every output is PNG.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageColor
import json, math, hashlib, copy
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/animation-v8'
REF=OUT/'reference'
W,H,OX,OY=192,160,96,144
IDENT=json.loads((ROOT/'assets/characters/animation-v7/identity-lock.json').read_text())
TARGETS=json.loads((REF/'contact-targets.json').read_text())
# Outline, skin shade/mid/light, cloth shade/mid/light, trim, boot shade/light.
PALETTES={
 'ryu':dict(out='#101827',skin=['#884331','#c8764a','#f2b57b'],cloth=['#18213c','#25385d','#3d5280'],top=['#12376c','#1e5799','#4080bf'],trim='#933445',boot=['#192036','#56617b'],wrap='#c4c6d4'),
 'mei':dict(out='#1c1324',skin=['#a2533d','#d68d60','#fac28b'],cloth=['#211d31','#39304b','#5b4b68'],top=['#86153a','#b52455','#e74d79'],trim='#ecc55d',boot=['#781c3a','#cb385e'],wrap='#ccd0d9'),
 'tank':dict(out='#18171a',skin=['#884321','#c07137','#eea660'],cloth=['#572019','#943023','#c84d31'],top=['#884321','#c07137','#eea660'],trim='#c49c38',boot=['#171d1d','#474c3e'],wrap='#e63734'),
 'volt':dict(out='#182022',skin=['#895432','#c78d54','#f1c480'],cloth=['#1c293a','#344356','#576578'],top=['#9b5b18','#d19324','#f4c958'],trim='#3da9c9',boot=['#202731','#626c69'],wrap='#30343a'),
 'kaze':dict(out='#221c35',skin=['#935943','#c7916b','#f3cdb1'],cloth=['#242640','#3a3b5c','#5b5d7b'],top=['#818397','#c4c3d0','#efeee9'],trim='#7262a0',boot=['#292632','#655f65'],wrap='#292632'),
 'sage':dict(out='#221d30',skin=['#91654d','#be9975','#f1d1a7'],cloth=['#271d3b','#493265','#6d4c89'],top=['#271d3b','#493265','#6d4c89'],trim='#be9138',boot=['#241f2c','#5c5260'],wrap='#322c3b'),
}
# Body hues follow the approved portraits: deep blue / crimson rather than
# slate blue / brown, warm ivory instead of grey-white, saturated violet.
PALETTES['ryu'].update(skin=['#6a2d2a','#d08353','#f8c28f'],cloth=['#101839','#283161','#4b60a0'],top=['#082061','#103e9c','#3571d0'],trim='#960c35',wrap='#9ca2b7')
PALETTES['mei'].update(cloth=['#1b1623','#37303f','#63586c'],top=['#690d31','#c80d4d','#fb4c82'])
PALETTES['tank'].update(skin=['#6e2715','#b45e2b','#f2b36f'],top=['#6e2715','#b45e2b','#f2b36f'],cloth=['#54121b','#a2250d','#e05b2d'])
PALETTES['volt'].update(top=['#5b3304','#d18308','#f8bd38'],cloth=['#16223c','#323f5d','#596e92'],trim='#299aad')
PALETTES['kaze'].update(top=['#615b82','#c6bcbc','#f6eed9'],cloth=['#161c44','#2b356b','#596796'])
PALETTES['sage'].update(top=['#221136','#562774','#9352ae'],cloth=['#201829','#392b4b','#645477'])
# Each entry is a deliberate key drawing: rear/front knee and sole, pelvis
# offset, chest offset, shoulder dip and cloth trailing offset. No tween frames.
WALK=[
 ((-10,-12),(-18,-2),(10,-12),(14,-2),0,0,0,0),
 ((-11,-12),(-19,-2),(11,-13),(14,-3),0,0,.5,0),
 ((-12,-12),(-20,-2),(12,-15),(15,-5),0,.5,1,-1),
 ((-12,-12),(-21,-2),(13,-16),(17,-6),.5,1,1,-2),
 ((-13,-12),(-22,-2),(14,-16),(19,-5),.5,1,.5,-2),
 ((-14,-12),(-23,-2),(15,-15),(21,-4),0,.5,0,-1),
 ((-14,-12),(-24,-2),(16,-14),(23,-3),0,0,0,0),
 ((-15,-12),(-25,-2),(16,-13),(23,-2),0,-.5,.5,1),
 ((-15,-12),(-26,-2),(16,-12),(22,-2),0,0,1,1),
 ((-14,-14),(-25,-4),(15,-12),(21,-2),0,.5,1,0),
 ((-13,-16),(-24,-6),(14,-12),(20,-2),.5,1,.5,-1),
 ((-12,-17),(-22,-7),(13,-12),(19,-2),.5,1,0,-2),
 ((-11,-17),(-20,-6),(12,-12),(18,-2),.5,.5,0,-2),
 ((-10,-16),(-18,-5),(11,-12),(17,-2),0,0,.5,-1),
 ((-10,-14),(-17,-3),(11,-12),(16,-2),0,-.5,1,0),
 ((-10,-13),(-17,-2),(10,-12),(15,-2),0,0,.5,1),
]
BACK=[
 ((-10,-12),(-18,-2),(10,-12),(14,-2),0,0,0,0),
 ((-11,-14),(-18,-3),(11,-12),(15,-2),0,-.5,.5,1),
 ((-12,-15),(-19,-4),(12,-12),(16,-2),-.5,-1,1,2),
 ((-13,-16),(-21,-5),(12,-12),(17,-2),-.5,-1,1,2),
 ((-14,-15),(-23,-4),(13,-12),(18,-2),-.5,-.5,.5,1),
 ((-15,-14),(-25,-3),(14,-12),(19,-2),0,0,0,0),
 ((-16,-13),(-26,-2),(14,-12),(20,-2),0,.5,0,-1),
 ((-16,-12),(-25,-2),(15,-12),(21,-2),0,0,.5,-1),
 ((-15,-12),(-24,-2),(16,-12),(22,-2),0,0,1,0),
 ((-14,-12),(-23,-2),(16,-14),(23,-3),0,-.5,1,1),
 ((-14,-12),(-22,-2),(15,-16),(22,-5),-.5,-1,.5,2),
 ((-13,-12),(-21,-2),(14,-17),(20,-6),-.5,-1,0,2),
 ((-12,-12),(-20,-2),(13,-17),(18,-5),-.5,-.5,0,1),
 ((-12,-12),(-19,-2),(12,-15),(16,-4),0,0,.5,0),
 ((-11,-12),(-18,-2),(11,-14),(15,-3),0,.5,1,-1),
 ((-10,-12),(-17,-2),(10,-13),(14,-2),0,0,.5,-1),
]
# Punch positions are elbow/wrist pairs. 'hit' is the approved contact endpoint,
# painted with a closed hand; intermediate limbs have explicitly bent elbows.
PUNCH=[((10,-30),(13,-35),0,0),((8,-29),(10,-34),-.5,-1),((6,-30),(8,-35),-1,-1.5),((13,-34),(17,-36),0,.5),('hit',1,2),('hit',1,2.5),((16,-32),(19,-35),1,1.5),((11,-29),(15,-33),.5,.5),((8,-29),(12,-33),0,-.5),((9,-30),(13,-35),0,0),((10,-30),(13,-35),0,0),((10,-30),(13,-35),0,0)]
# Kicks: explicit pelvis, striking knee, ankle, supporting knee/ankle, torso lean.
KICK=[(0,(10,-12),(14,-2),(-10,-12),(-18,-2),0),
 (0,(10,-17),(10,-8),(-9,-12),(-17,-2),-.5),
 (0,(9,-24),(9,-13),(-7,-13),(-14,-2),-1),
 (1,(12,-29),(16,-23),(-5,-14),(-10,-2),-1.5),
 ('hit',1,-2),('hit',1,-2.5),
 (1,(14,-29),(18,-26),(-4,-14),(-9,-2),-1.5),
 (0,(10,-26),(11,-17),(-5,-13),(-11,-2),-1),
 (0,(10,-21),(10,-11),(-7,-13),(-14,-2),-.5),
 (0,(11,-17),(12,-7),(-9,-12),(-16,-2),0),
 (0,(11,-14),(14,-4),(-10,-12),(-18,-2),0),
 (0,(10,-12),(14,-2),(-10,-12),(-18,-2),0)]
TIMELINE=[.07,.16,.24,.32,.45,.59,.66,.74,.82,.9,.96,1]

def point(p):return (round(OX+p[0]*2),round(OY+p[1]*2))
def add(p,q):return (p[0]+q[0],p[1]+q[1])
class Brush:
 def __init__(self):self.im=Image.new('RGBA',(W,H));self.d=ImageDraw.Draw(self.im)
 def poly(self,pts,color,outline=None):
  pts=[point(p) for p in pts];self.d.polygon(pts,fill=color)
  if outline:self.d.line(pts+[pts[0]],fill=outline,width=1,joint='curve')
 def line(self,pts,color,width=.5):self.d.line([point(p) for p in pts],fill=color,width=max(1,round(width*2)),joint='curve')
 def dot(self,x,y,color,r=.5):self.d.rectangle([point((x-r,y-r)),point((x+r,y+r))],fill=color)
 def detail(self,pts,color,width=.5,fill=False):
  # Hand-placed pixel creases / muscle planes cannot grow the silhouette.
  layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
  if fill:d.polygon([point(q) for q in pts],fill=color)
  else:d.line([point(q) for q in pts],fill=color,width=max(1,round(width*2)))
  bounds=layer.getbbox()
  if not bounds:return
  src=layer.load();dst=self.im.load()
  for y in range(bounds[1],bounds[3]):
   for x in range(bounds[0],bounds[2]):
    if src[x,y][3] and dst[x,y][3]:dst[x,y]=(*src[x,y][:3],dst[x,y][3])
 def soften_seams(self,outline,head,head_offset):
  # Segment outlines inside a solid limb are cloth seams, not black cut-outs.
  # Soften only internal ink, preserve the outer edge and all portrait pixels.
  src=self.im.copy();pixels=src.load();dst=self.im.load();ink=ImageColor.getrgb(outline)
  hx,hy=head_offset;hp=head.load()
  for y in range(1,H-1):
   for x in range(1,W-1):
    c=pixels[x,y]
    if c[:3]!=ink or not c[3]:continue
    if 0<=x-hx<head.width and 0<=y-hy<head.height and hp[x-hx,y-hy][3]:continue
    neighbours=[pixels[x-1,y],pixels[x+1,y],pixels[x,y-1],pixels[x,y+1]]
    if any(v[3]!=255 for v in neighbours):continue
    colors=[v[:3] for v in neighbours if v[:3]!=ink]
    if not colors:continue
    q=min(colors,key=lambda q:sum(q));dst[x,y]=(*(round(v*.84) for v in q),c[3])
 def surface(self,a,b,width,colors,fabric=False,region=None):
  """Paint stepped volume / fold clusters inside the existing silhouette.

  RGB only: never move an edge, change alpha, or create a new pose. The light
  comes from above-left for skin, cloth, wraps and accessories alike. Marks
  are attached to each drawn garment panel, not screen-space noise.
  """
  rgb=[ImageColor.getrgb(c) for c in colors]
  ramp=[]
  for i in range(7):
   t=i/3;lo=min(1,int(t));u=t-lo
   ramp.append(tuple(round(rgb[lo][k]*(1-u)+rgb[lo+1][k]*u) for k in range(3)))
  # Restrict repainting to this material; the outline / other layers survive.
  eligible=set(rgb+ramp)
  mask=Image.new('1',(W,H));md=ImageDraw.Draw(mask)
  if region:md.polygon([point(q) for q in region],fill=1)
  else:
   dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
   nx,ny=-dy/length*width/2,dx/length*width/2
   md.polygon([point(q) for q in [(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]],fill=1)
  bounds=mask.getbbox()
  if not bounds:return
  dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
  ux,uy=dx/length,dy/length;nx,ny=-uy,ux
  toward_light=1 if -nx-.65*ny>=0 else -1
  pixels=self.im.load();ink=mask.load()
  for y in range(bounds[1],bounds[3]):
   for x in range(bounds[0],bounds[2]):
    c=pixels[x,y]
    if not ink[x,y] or not c[3] or c[:3] not in eligible:continue
    px=(x-OX)/2-a[0];py=(y-OY)/2-a[1]
    along=(px*ux+py*uy)/length
    across=max(-1,min(1,(px*nx+py*ny)/(width*.5)))
    # Broad curved masses, with a narrow lit edge and a dark turned underside.
    volume=.24+.58*math.sqrt(max(0,1-(across+.25*toward_light)**2))
    volume+=.11*across*toward_light-.13*max(0,along-.55)
    if fabric:
     # Two deliberate tapered diagonal folds, clustered in native pixels.
     for centre,slope in [(.31,.12),(.69,-.09)]:
      crease=abs(along-centre-across*slope)
      if crease<.035 and -.8<across<.45:volume-=.24*(1-abs(across)*.5)
      elif .035<=crease<.068 and -.75<across<.25:volume+=.13
    else:
     # Muscle insertion / joint shade; no mechanical transverse tube stripes.
     if along>.84:volume-=.10
     if .16<along<.70 and -.56<across*toward_light<-.25:volume+=.08
    level=max(0,min(6,round(volume*6)))
    pixels[x,y]=(*ramp[level],c[3])
 def limb(self,a,b,width,colors,outline):
  dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy) or 1;nx,ny=-dy/l*width/2,dx/l*width/2
  self.poly([(a[0]+nx,a[1]+ny),(b[0]+nx*.83,b[1]+ny*.83),(b[0]-nx*.83,b[1]-ny*.83),(a[0]-nx,a[1]-ny)],colors[1],outline)
  self.poly([a,b,(b[0]-nx*.7,b[1]-ny*.7),(a[0]-nx*.7,a[1]-ny*.7)],colors[0])
  self.line([(a[0]+nx*.55,a[1]+ny*.55),(b[0]+nx*.4,b[1]+ny*.4)],colors[2],.75)
  # Individual painted folds / muscle creases, not a tiled bitmap texture.
  for t in [.3,.68]:
   c=(a[0]+dx*t,a[1]+dy*t)
   self.line([(c[0]-nx*.3,c[1]-ny*.3),(c[0]+nx*.48-dx*.07,c[1]+ny*.48-dy*.07)],colors[0],.5)
  self.surface(a,b,width,colors,fabric=not any(colors is p['skin'] for p in PALETTES.values()))
  # Short, tapering highlight clusters follow the length of the limb.
  for t0,t1 in [(.12,.29),(.43,.55)]:
   self.detail([(a[0]+dx*t0+nx*.34,a[1]+dy*t0+ny*.34),(a[0]+dx*t1+nx*.29,a[1]+dy*t1+ny*.29)],colors[2],.5)
 def boot(self,a,side,pal,raised=False):
  x,y=a;toe=3.5 if side==1 else -1
  self.poly([(x-2.2,y-2.7),(x+1.6,y-2.6),(x+1.8,y-.7),(x+toe+2,y+.3),(x+toe+2,y+1.8),(x-3,y+1.8)],pal['boot'][0],pal['out'])
  self.line([(x-1.5,y-2),(x+.6,y-1.5)],pal['boot'][1],1)
  self.line([(x-2.6,y+1.3),(x+toe+1.6,y+1.3)],pal['boot'][1],.5)
  self.dot(x-.4,y-1,pal['trim'],.35)
  self.surface((x-.5,y-2.5),(x+.5,y+1.5),7,[pal['boot'][0],pal['boot'][1],pal['wrap']],region=[(x-3,y-3),(x+6,y-3),(x+6,y+2),(x-3,y+2)])
 def fist(self,p,pal,open=False):
  x,y=p
  if open:
   self.poly([(x-1.6,y+2),(x-1.5,y-1.4),(x-.5,y-3.8),(x+.4,y-3.6),(x+.7,y-.3),(x+1.3,y-2.9),(x+2,y-2.5),(x+1.7,y+1.5),(x+.1,y+2.7)],pal['skin'][1],pal['out'])
   self.line([(x-.3,y-2.5),(x-.3,y+.3)],pal['skin'][2])
  elif pal is PALETTES['tank']:
   self.poly([(x-3.6,y-2.5),(x-1,y-3.5),(x+2,y-2.8),(x+3,y-.6),(x+2.3,y+2.4),(x-.8,y+3),(x-3.3,y+1.5)],'#c32027',pal['out'])
   self.line([(x-2.7,y-1.5),(x-.8,y-2.6),(x+1.3,y-1.8)],'#fa5146',1)
   self.line([(x-3.4,y+1),(x-.8,y+1.8)],'#7a1624',1)
  else:
   self.poly([(x-2.2,y-1.8),(x+.7,y-2.2),(x+2,y-1),(x+1.7,y+1.5),(x-1,y+2),(x-2.5,y+.7)],pal['skin'][1],pal['out'])
   self.line([(x-1.5,y-1.4),(x+.5,y-1.6)],pal['skin'][2],.5)
   self.line([(x-1.5,y+.7),(x+1,y+.6)],pal['skin'][0],.5)
  shades=['#7a1624','#c32027','#fa5146'] if pal is PALETTES['tank'] else pal['skin']
  self.surface((x-.5,y-2),(x+.5,y+2),6,shades,region=[(x-4,y-4),(x+4,y-4),(x+4,y+4),(x-4,y+4)])

HEADS={}
HAIR={
 'ryu':['#080c20','#151b36','#343d67'],
 'mei':['#11101c','#28212f','#554553'],
 'tank':['#100b0b','#27201c','#4a3629'],
 'volt':['#101318','#292829','#544d40'],
 'kaze':['#170d29','#362049','#69477d'],
 'sage':['#5c477b','#aba3c6','#f4edf4'],
}
def shades(colors):
 rgb=[ImageColor.getrgb(c) for c in colors];out=[]
 for i in range(7):
  t=i/3;lo=min(1,int(t));u=t-lo
  out.append(tuple(round(rgb[lo][k]*(1-u)+rgb[lo+1][k]*u) for k in range(3)))
 return out
for cid in PALETTES:
 src=Image.open(REF/f'{cid}-idle.png').convert('RGBA');head=Image.new('RGBA',src.size)
 for y in range(src.height):
  for x in range(src.width):
   lx=(x-80)/2;ly=(y-124)/2;c=src.getpixel((x,y))
   keep=ly<-39 and -27<lx<16
   if cid in ['mei','kaze'] and lx<-10 and ly<-30 and sum(c[:3])<240:keep=True
   if cid=='sage' and lx<-8 and ly<-34 and c[0]>100 and c[2]>120:keep=True
   if cid=='tank' and lx<-7 and ly>-44:keep=False
   if c[3] and keep:head.putpixel((x,y),c)
 # Keep every face / hair pixel's location and silhouette. Repaint their colors
 # into the same seven-step material ramps used on the body, removing the
 # mismatch between hundreds of portrait shades and broad body color blocks.
 pal=PALETTES[cid]
 swatches=list(dict.fromkeys(shades(pal['skin'])+shades(HAIR[cid])+shades([pal['out'],pal['trim'],'#e8be69'])+[(244,237,244),ImageColor.getrgb(pal['out'])]))
 for y in range(head.height):
  for x in range(head.width):
   c=head.getpixel((x,y))
   if not c[3]:continue
   nearest=min(swatches,key=lambda q:sum((c[k]-q[k])**2 for k in range(3)))
   head.putpixel((x,y),(*nearest,c[3]))
 HEADS[cid]=head

def neutral():return dict(hip=(0,-24.5),chest=(0,-32),rk=(-13,-12),ra=(-18,-2),fk=(15,-13),fa=(14,-2),re=(-12,-29),rw=(-5,-30),fe=(10,-30),fw=(13,-35),dip=0,cloth=0,open=False,head=(0,0),angle=0)
def walkposes(table):
 out=[]
 for rk,ra,fk,fa,h,c,d,cloth in table:
  p=neutral();p.update(rk=(rk[0]-3,rk[1]),ra=ra,fk=(fk[0]+3,fk[1]),fa=fa,hip=(h,-24.5+d),chest=(c,-32+d),dip=d,cloth=cloth,head=(c*.5,d))
  p.update(fe=(10+c*.5,-30+d),fw=(13-c*.5,-35+d),re=(-12+c*.5,-29+d),rw=(-5+c,-30+d))
  out.append(p)
 return out

def attackposes(cid,clip):
 poses=[];tx,ty=TARGETS[cid][clip]
 for spec in (PUNCH if clip in ['jab','heavy'] else KICK):
  p=neutral()
  if clip in ['jab','heavy']:
   if spec[0]=='hit':
    _,h,c=spec;p.update(hip=(h,-24.5),chest=(c,-32),head=(c*.5,.5))
    # Paint the fist's far edge at the retained contact target.
    wrist=(tx-(3 if cid=='tank' else 2),ty)
    elbow=(max(7,wrist[0]-10),ty+.8)
   else:
    elbow,wrist,h,c=spec;p.update(hip=(h,-24.5),chest=(c,-32),head=(c*.5,0))
    wrist=(wrist[0],wrist[1]+(ty+36)*.55);elbow=(elbow[0],elbow[1]+(ty+36)*.55)
   if clip=='jab':p.update(fe=elbow,fw=wrist)
   else:p.update(re=elbow,rw=wrist,fe=(8,-30),fw=(10,-34),rk=(-12,-12),ra=(-20,-2),fk=(12,-12),fa=(16,-2))
   if cid=='kaze' and clip=='heavy':
    # The wrist and blade tip are separately drawn anchors, never an elbow on a blade.
    if spec[0]=='hit':p.update(rw=(10,ty),re=(3,ty+1),bladeTip=(tx,ty))
    else:
     p['rw']=(min(11,wrist[0]*.55),wrist[1]);p['re']=(2,elbow[1]);p['bladeTip']=(p['rw'][0]+14,p['rw'][1]-3)
  else:
   if spec[0]=='hit':
    _,h,c=spec;p.update(hip=(h,-24.5),chest=(c,-32),fk=(13,ty+1),fa=(tx-4,ty-1.3),rk=(-5,-13),ra=(-10,-2),head=(c*.5,0))
   else:
    h,k,a,rk,ra,c=spec;p.update(hip=(h,-24.5),chest=(c,-32),fk=k,fa=a,rk=rk,ra=ra,head=(c*.5,0))
   p.update(fe=(8,-31),fw=(10,-36),re=(-11,-30),rw=(-6,-33))
   if clip=='lowKick':
    p['hip']=(p['hip'][0],-20);p['chest']=(p['chest'][0],-27);p['head']=(p['head'][0],5)
    if spec[0]=='hit':p.update(fk=(12,-9),fa=(tx-4,ty-1.3))
    else:p.update(fk=(p['fk'][0],max(-16,p['fk'][1]+8)),fa=(p['fa'][0],max(-14,p['fa'][1]+8)))
    p.update(fe=(8,-25),fw=(11,-30),re=(-12,-24),rw=(-5,-28))
  poses.append(p)
 return poses

def build_poses(cid):
 poses={'idle':[neutral() for _ in range(4)],'walk':walkposes(WALK),'backwalk':walkposes(BACK)}
 poses['walk'][0]=neutral();poses['backwalk'][0]=neutral()
 poses['idle'][1]['head']=(0,.5);poses['idle'][2]['head']=(.5,.5)
 for clip in ['jab','heavy','kick','lowKick']:poses[clip]=attackposes(cid,clip)
 crouch=[]
 for drop in [2,5,8,8]:
  p=neutral();p.update(hip=(0,-24.5+drop),chest=(0,-32+drop),head=(0,drop),rk=(-13,-10),fk=(14,-10),re=(-12,-29+drop),rw=(-4,-30+drop),fe=(10,-30+drop),fw=(13,-35+drop));crouch.append(p)
 poses['crouch']=crouch
 guard=[]
 for s in [0,1,2,1]:
  p=neutral();p.update(chest=(-s*.5,-32),head=(-s*.5,0),fe=(11,-32),fw=(5,-41),re=(-10,-32),rw=(1,-38));guard.append(p)
 poses['guard']=guard
 poses['guardLow']=[]
 for p in guard:
  q=copy.deepcopy(p)
  for k in ['hip','chest','re','rw','fe','fw']:q[k]=add(q[k],(0,8))
  q['head']=add(q['head'],(0,8));q.update(rk=(-13,-10),fk=(14,-10));poses['guardLow'].append(q)
 air=[]
 for legs in [((-9,-16),(-15,-6),(9,-16),(14,-8)),((-7,-23),(-12,-14),(9,-24),(16,-18)),((-5,-27),(-9,-19),(8,-26),(13,-18)),((-4,-28),(-9,-20),(9,-27),(15,-20)),((-5,-25),(-10,-16),(9,-25),(16,-16)),((-8,-22),(-13,-11),(9,-20),(16,-10)),((-10,-17),(-17,-5),(10,-16),(17,-5)),((-11,-15),(-18,-3),(10,-15),(17,-3))]:
  p=neutral();p.update(rk=legs[0],ra=legs[1],fk=legs[2],fa=legs[3],fe=(9,-33),fw=(12,-39),rw=(-6,-35));air.append(p)
 poses['jump']=air;poses['backjump']=copy.deepcopy(air)
 for p in poses['backjump']:p['head']=(-1,0);p['chest']=(-1,-32)
 for clip,ground in [('airPunch','jab'),('airKick','kick')]:
  poses[clip]=[]
  for idx in [0,2,3,4,5,6,8,10]:
   p=copy.deepcopy(poses[ground][idx]);p.update(rk=(-8,-22),ra=(-13,-12))
   if clip=='airPunch':p.update(fk=(8,-22),fa=(13,-12))
   if idx in [4,5]:
    tx,ty=TARGETS[cid][clip]
    if clip=='airPunch':p.update(fe=(tx-12,ty+1),fw=(tx-2,ty))
    else:p.update(fk=(13,ty+1),fa=(tx-4,ty-1.3))
   poses[clip].append(p)
 # Special moves use deliberate prepare / release / recoil drawings.
 poses['cast']=[]
 for re,rw,fe,fw,lean in [((-12,-29),(-6,-30),(9,-30),(13,-35),0),((-12,-29),(-5,-30),(8,-28),(3,-31),-1),((-13,-29),(-4,-30),(5,-29),(0,-31),-1.5),((5,-32),(20,-32),(12,-35),(24,-35),1.5),((7,-32),(21,-32),(14,-35),(25,-35),2),((4,-30),(15,-30),(10,-34),(20,-34),1),((-9,-28),(1,-29),(8,-30),(12,-33),0),((-12,-29),(-5,-30),(10,-30),(13,-35),0)]:
  p=neutral();p.update(re=re,rw=rw,fe=fe,fw=fw,chest=(lean,-32),head=(lean*.5,0),open=True);poses['cast'].append(p)
 poses['rise']=[]
 for h,k,w in [(7,(10,-24),(10,-27)),(8,(8,-27),(7,-32)),(4,(10,-29),(9,-39)),(0,(8,-42),(10,-51)),(-1,(7,-43),(10,-53)),(0,(8,-38),(10,-48)),(1,(9,-32),(11,-39)),(2,(10,-30),(13,-35))]:
  p=neutral();p.update(hip=(0,-24.5+h),chest=(0,-32+h),head=(0,h),fe=k,fw=w,rk=(-8,-14),ra=(-14,-3),fk=(10,-19),fa=(15,-11));poses['rise'].append(p)
 poses['rush']=[]
 for lean,feet in [(0,(-18,-2)),(2,(-21,-2)),(5,(-24,-3)),(6,(-25,-5)),(5,(-23,-4)),(3,(-21,-2)),(1,(-19,-2)),(0,(-18,-2))]:
  p=neutral();p.update(chest=(lean,-31),head=(lean*.6,1),re=(-5,-28),rw=(6,-31),fe=(12+lean,-32),fw=(20+lean,-34),ra=feet,fk=(14,-13),fa=(21,-2));poses['rush'].append(p)
 poses['throw']=[]
 for fw,rw,hip in [((13,-35),(-5,-30),0),((17,-34),(10,-31),0),((20,-34),(15,-30),0),((17,-31),(16,-30),2),((11,-28),(8,-28),4),((17,-26),(13,-27),2),((14,-31),(4,-29),1),((13,-35),(-5,-30),0)]:
  p=neutral();p.update(fw=fw,rw=rw,fe=(10,-30),re=(2,-29),hip=(hip,-24.5),chest=(hip,-32),head=(hip*.5,0),open=True);poses['throw'].append(p)
 poses['head']=[];poses['body']=[]
 for lean,drop in [(-3,0),(-4,1),(-2,.5),(0,0)]:
  p=neutral();p.update(chest=(lean,-32+drop),head=(lean*1.4,drop),fw=(15,-32),rw=(-8,-28));poses['head'].append(p)
  q=neutral();q.update(chest=(-lean*.8,-30+drop),head=(-lean*.6,2+drop),hip=(-1,-24),fe=(7,-26),fw=(2,-28),rw=(-2,-28));poses['body'].append(q)
 poses['fall']=[]
 for angle in [10,28,46,64,78,88]:
  p=neutral();p.update(angle=angle,fe=(14,-30),fw=(19,-34),rk=(-10,-16),ra=(-18,-8),fk=(11,-17),fa=(18,-7));poses['fall'].append(p)
 poses['getup']=[copy.deepcopy(p) for p in reversed(poses['fall'])]
 return poses

def draw(cid,p):
 b=Brush();pal=PALETTES[cid];hip=p['hip'];cx,cy=p['chest'];skin=pal['skin'];cloth=pal['cloth'];out=pal['out'];wide=cid=='tank';slim=cid=='mei'
 # Rear ribbons / coat tails, each polygon is painted in the listed pose.
 tail=p['cloth']
 if cid in ['ryu','volt']:
  col=pal['trim'];b.poly([(cx-2,cy-5),(cx-10,cy-7),(cx-20+tail,cy-5),(cx-26+tail,cy+2),(cx-16+tail,cy),(cx-9,cy+1)],col,out)
  b.line([(cx-6,cy-5),(cx-18+tail,cy-3),(cx-23+tail,cy+1)],'#6b253b' if cid=='ryu' else '#197092',1)
  b.surface((cx-3,cy-4),(cx-24+tail,cy-1),8,['#52182e',col,'#cc4261'] if cid=='ryu' else ['#136078',col,'#85d9df'],True,[(cx-2,cy-5),(cx-10,cy-7),(cx-20+tail,cy-5),(cx-26+tail,cy+2),(cx-16+tail,cy),(cx-9,cy+1)])
 if cid in ['mei','kaze','sage']:
  b.poly([(hip[0]-5,hip[1]-1),(hip[0]-9,hip[1]+4),(hip[0]-22+tail,hip[1]+13),(hip[0]-13+tail,hip[1]+15),(hip[0]-5,hip[1]+9)],pal['top'][1],out)
  b.line([(hip[0]-6,hip[1]+1),(hip[0]-16+tail,hip[1]+12)],pal['trim'],1)
  if cid=='sage':b.poly([(hip[0]+4,hip[1]),(hip[0]+10,hip[1]+7),(hip[0]+16-tail,hip[1]+18),(hip[0]+7,hip[1]+15),(hip[0]+2,hip[1]+5)],'#6f264c',out)
 # Each leg has a separately painted thigh, bent knee, shin and solid boot.
 for side,k,a in [(-1,p['rk'],p['ra']),(1,p['fk'],p['fa'])]:
  root=add(hip,(side*3,1));thick=12.5 if wide else 9 if slim else 12
  # The trouser cuff ends inside the boot, above the sole. A broad diagonal
  # shin must never paint through the floor or change the contact silhouette.
  b.limb(root,k,thick,cloth,out);b.limb(k,add(a,(0,-1.5)),thick*.67,cloth,out)
  if cid in ['kaze','sage']:
   panel=cloth
   b.poly([(root[0]-5,root[1]-2),(root[0]+5,root[1]-2),(k[0]+5,k[1]+4),(k[0]-5,k[1]+3)],panel[1],out)
   b.line([(root[0]-3,root[1]),(k[0]-2,k[1]+3)],panel[2],1)
   b.line([(k[0]-4,k[1]+3),(k[0]+4,k[1]+4)],pal['trim'],1)
  b.poly([(k[0]-thick*.42,k[1]-2),(k[0]+thick*.4,k[1]-2),(k[0]+thick*.35,k[1]+2),(k[0]-thick*.35,k[1]+2)],cloth[1])
  b.line([(k[0]-2,k[1]),(k[0]+1,k[1]+1.5)],cloth[2])
  b.surface(root,k,thick,cloth,True,[(root[0]-thick*.6,root[1]-2),(root[0]+thick*.6,root[1]-2),(k[0]+thick*.6,k[1]+3),(k[0]-thick*.6,k[1]+3)])
  if cid=='ryu':b.limb(add(a,(0,-3)),a,4,[pal['wrap'],'#d9d9e1','#f1eef1'],out)
  if cid in ['kaze','sage']:b.line([add(k,(-2,1)),add(k,(2,1))],pal['trim'])
  b.boot(a,side,pal,a[1]<-2)
 # Rear upper arm, torso, front upper arm. Hands are painted last over the guard.
 ls=(cx-7-(1 if wide else 0),cy-3);rs=(cx+5+(1 if wide else 0),cy-3)
 ar=6.4 if wide else 3.8 if slim else 4.5
 b.limb(ls,p['re'],ar,skin,out);b.limb(p['re'],p['rw'],ar*.82,skin,out)
 # Rigid costume panels and angular folds replace the stretched torso bitmap.
 top=pal['top'];sh=10 if wide else 7.5
 b.poly([(cx-sh,cy-4),(cx-3,cy-7),(cx+5,cy-5),(cx+sh,cy-1),(hip[0]+6,hip[1]),(hip[0]-7,hip[1]),(cx-sh-1,cy+1)],top[1],out)
 b.poly([(cx-sh,cy-3),(cx-3,cy-5),(cx-1,cy+2),(hip[0]-3,hip[1]),(hip[0]-7,hip[1])],top[0])
 b.poly([(cx+1,cy-5),(cx+5,cy-4),(cx+sh-1,cy),(hip[0]+4,hip[1]-2),(cx+2,cy+1)],top[2])
 b.line([(cx-5,cy+1),(hip[0]-2,hip[1]-2)],top[2],.75)
 b.line([(cx+1,cy),(hip[0]+3,hip[1]-2)],top[0],.75)
 if wide:
  b.line([(cx-7,cy-2),(cx-2,cy),(cx+1,cy-1)],skin[0],1)
  b.line([(cx+2,cy-2),(cx+7,cy-1)],skin[0],1)
  for y in [cy+2,cy+4]:b.line([(cx-2,y),(cx,y+.4),(cx+2,y)],skin[0],.5)
 if cid=='mei':
  b.line([(cx-1,cy-5),(cx+1,cy+4)],pal['trim'],.7)
  b.dot(cx+1,cy-2,pal['trim'],.4);b.dot(cx+1,cy+1,pal['trim'],.4)
 if cid in ['kaze','sage']:
  b.poly([(cx-3,cy-5),(cx,cy+2),(hip[0]-3,hip[1]),(cx-6,cy-1)],pal['top'][2],out)
  b.line([(cx+3,cy-4),(cx,cy+2),(hip[0]+1,hip[1])],pal['trim'],1)
 if cid=='volt':b.line([(cx+3,cy-4),(hip[0]+1,hip[1])],pal['out'],.75)
 b.surface((cx-1,cy-6),(hip[0],hip[1]),sh*2,top,not wide,[(cx-sh,cy-4),(cx-3,cy-7),(cx+5,cy-5),(cx+sh,cy-1),(hip[0]+6,hip[1]),(hip[0]-7,hip[1]),(cx-sh-1,cy+1)])
 if wide:
  # Pectorals, ribs and abdominal planes share the face's warm stepped light.
  b.detail([(cx-8,cy-3),(cx-4,cy-4),(cx-.5,cy-2),(cx-1,cy-.5),(cx-5,cy-1)],skin[2],fill=True)
  b.detail([(cx+2,cy-3.5),(cx+6,cy-2.5),(cx+8,cy-.5),(cx+3,cy-.5)],'#d58b4c',fill=True)
  b.detail([(cx-8,cy-1),(cx-5,cy+1),(cx-1,cy+1.5),(cx+.5,cy-.5)],'#824020',.5)
  b.detail([(cx+2,cy+1),(cx+5,cy+1.8),(cx+8,cy+.5)],'#824020',.5)
  b.detail([(cx+1,cy+.5),(cx+.7,cy+5)],'#824020',.5)
  for y in [cy+3,cy+5]:
   b.detail([(cx-3,y-.7),(cx-1,y-.8),(cx-.5,y+.3),(cx-3,y+.5)],'#d18b50',fill=True)
   b.detail([(cx+2,y-.5),(cx+4,y-.2),(cx+3.5,y+.8),(cx+2,y+.5)],'#d18b50',fill=True)
 elif cid not in ['kaze','sage']:
  # Sparse tapered creases and a curved seam; small clusters, no flat stripes.
  b.detail([(cx-sh+1,cy-2.5),(cx-sh+2,cy),(cx-4,cy+2)],top[0],.5)
  b.detail([(cx-3,cy-3),(cx-2.5,cy-1),(cx-.5,cy+.3)],top[2],.5)
  b.detail([(cx+1,cy+1),(cx+4,cy+2),(hip[0]+4,hip[1]-2)],top[0],.5)
  b.detail([(hip[0]-4,hip[1]-2),(hip[0]-1,hip[1]-2.5),(hip[0]+1,hip[1]-1.5)],top[2],.5)
 else:
  b.detail([(cx-5,cy-4),(cx-3,cy-2),(cx,cy+2)],top[0],.5)
  b.detail([(cx-4,cy-5),(cx-1,cy-1),(cx+1,cy+1)],top[2],.5)
  b.detail([(cx+4,cy-3),(cx+3,cy),(hip[0]+2,hip[1]-2)],top[0],.5)
  b.detail([(hip[0]-5,hip[1]-2),(hip[0]-2,hip[1]-3),(hip[0],hip[1]-2)],top[2],.5)
 # Belt / sash, neck, then the retained original face and hair pixels.
 b.poly([(hip[0]-7,hip[1]-2),(hip[0]+6,hip[1]-2),(hip[0]+6,hip[1]+.5),(hip[0]-7,hip[1]+.5)],pal['trim'],out)
 if cid=='tank':b.poly([(hip[0]-2,hip[1]-2),(hip[0]+2,hip[1]-2),(hip[0]+2,hip[1]+1),(hip[0]-2,hip[1]+1)],'#e6c353',out)
 if cid in ['ryu','volt']:b.poly([(cx-3,cy-6),(cx+5,cy-6),(cx+3,cy-2),(cx-3,cy-3)],pal['trim'],out)
 b.poly([(cx-1,cy-6),(cx+3,cy-6),(cx+3,cy-9),(cx-1,cy-10)],skin[1],out)
 hd=p['head'];b.im.alpha_composite(HEADS[cid],(OX-80+round(hd[0]*2),OY-124+round(hd[1]*2)))
 # Front arm. Gloves, wraps and their outlines remain solid painted shapes.
 b.limb(rs,p['fe'],ar,skin,out);b.limb(p['fe'],p['fw'],ar*.82,skin,out)
 for el,wr in [(p['re'],p['rw']),(p['fe'],p['fw'])]:
  dx,dy=wr[0]-el[0],wr[1]-el[1];q=(wr[0]-dx*.46,wr[1]-dy*.46)
  if cid!='tank':b.limb(q,wr,ar*.93,[pal['out'],pal['wrap'], '#e0e2e4' if cid in ['ryu','mei'] else pal['boot'][1]],out)
  b.fist(wr,pal,p['open'] and cid!='tank')
  # Wrap bands and knuckles use the same fine pixel scale as the portrait.
  if cid in ['ryu','mei']:
   for t in [.25,.38]:
    q=(wr[0]-dx*t,wr[1]-dy*t);length=math.hypot(dx,dy) or 1;nx,ny=-dy/length,dx/length
    b.detail([(q[0]-nx,q[1]-ny),(q[0]+nx,q[1]+ny)],'#6f6d80',.5)
  b.detail([(wr[0]-.7,wr[1]-.8),(wr[0]+.6,wr[1]-.6)],'#ffd3aa' if cid!='tank' else '#ff7564',.5)
 if cid=='kaze' and 'bladeTip' in p:
  wr=p['rw'];end=p['bladeTip'];dx,dy=end[0]-wr[0],end[1]-wr[1];l=math.hypot(dx,dy) or 1;nx,ny=-dy/l,dx/l
  b.poly([(wr[0]+nx,wr[1]+ny),(end[0],end[1]),(wr[0]-nx,wr[1]-ny)],'#bfcbd4',out)
  b.line([wr,end],'#eef5f5',.5);b.line([(wr[0]-nx*2,wr[1]-ny*2),(wr[0]+nx*2,wr[1]+ny*2)],'#c2a957',1)
 b.soften_seams(out,HEADS[cid],(OX-80+round(hd[0]*2),OY-124+round(hd[1]*2)))
 if p['angle']:
  b.im=b.im.rotate(p['angle'],resample=Image.Resampling.NEAREST,center=(OX,OY-35),expand=False)
  box=b.im.getbbox()
  if box:b.im=Image.new('RGBA',(W,H));rot=draw(cid,{**p,'angle':0}).rotate(p['angle'],resample=Image.Resampling.NEAREST,center=(OX,OY-35));box=rot.getbbox();b.im.alpha_composite(rot,(0,OY-box[3]+1))
 return b.im

def main():
 manifest={'version':8,'identityVersion':IDENT['version'],'mode':'fixed pixel drawings; explicitly authored poses; no interpolation','characters':{}}
 authored={};preview=Image.new('RGBA',(6*192,3*160),(30,42,58,255))
 for ci,cid in enumerate(PALETTES):
  poses=build_poses(cid);authored[cid]=poses;clips={}
  for name,frames in poses.items():
   stopVariants=None
   if name in ['walk','backwalk']:
    originals=list(frames);stopVariants=[]
    for i,start in enumerate(originals):
     first='f' if start['fa'][1]<start['ra'][1] else 'r' if start['ra'][1]<start['fa'][1] else ('f' if name=='walk' else 'r')
     support='r' if first=='f' else 'f';a=neutral();b=neutral()
     a[support+'a']=start[support+'a'];a[support+'k']=start[support+'k']
     a[first+'a']=(14,-4) if first=='f' else (-18,-4);a[first+'k']=(15,-16) if first=='f' else (-13,-16)
     b[support+'a']=(start[support+'a'][0],-4);b[support+'k']=(15,-16) if support=='f' else (-13,-16)
     stopVariants.append([i,len(frames),len(frames)+1,48]);frames.extend([a,b])
    frames.append(neutral())
   sheet=Image.new('RGBA',(W*4,H*math.ceil(len(frames)/4)));metas=[]
   for i,pose in enumerate(frames):
    frame=draw(cid,pose);box=frame.getbbox()
    if not box:raise ValueError(f'Empty {cid}/{name}/{i}')
    x,y=i%4*W,i//4*H;sheet.alpha_composite(frame,(x,y))
    # Each frame is independently drawn, with an invariant world origin.
    seed=next(yy*sheet.width+xx for yy in range(y+box[1],y+box[3]) for xx in range(x+box[0],x+box[2]) if sheet.getpixel((xx,yy))[3]>128)
    metas.append(dict(rect=[x+box[0],y+box[1],box[2]-box[0],box[3]-box[1]],root=x+OX,ground=y+OY,seed=seed,slot=i))
   stem=f'{cid}-{name.lower()}-drawn';file=OUT/f'{stem}.png';sheet.save(file)
   clips[name]=dict(sheet=stem,scale=.5,size=list(sheet.size),frames=metas,owner=cid,identity=IDENT['characters'][cid]['identity'],revision=hashlib.sha256(file.read_bytes()).hexdigest()[:16],authored=True,palette=cid)
   if name in ['jab','heavy','kick','lowKick']:clips[name]['timeline']=TIMELINE;clips[name]['contactFrames']=[4,5]
   if stopVariants is not None:clips[name].update(cycleFrames=16,stopVariants=stopVariants)
   if name in ['walk','backwalk']:clips[name]['feet']=[{'rear':list(p['ra']),'front':list(p['fa'])} for p in frames];clips[name]['direction']=1 if name=='walk' else -1
   if name in ['idle','walk','heavy']:preview.alpha_composite(draw(cid,frames[0 if name=='idle' else 4]),(ci*W,['idle','walk','heavy'].index(name)*H))
  manifest['characters'][cid]=clips
 (OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (OUT/'drawings.json').write_text(json.dumps(dict(method='explicit pixel brush drawings',palettes=PALETTES,poses=authored),ensure_ascii=False,indent=2))
 preview.resize((1728,720),Image.Resampling.NEAREST).save(OUT/'review.png')
 print(json.dumps(dict(characters=6,clips=sum(len(x) for x in manifest['characters'].values()),frames=sum(len(c['frames']) for x in manifest['characters'].values() for c in x.values()))))
if __name__=='__main__':main()
