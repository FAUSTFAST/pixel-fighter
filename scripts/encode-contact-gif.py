"""Encode native game playback and verify decoded GIF images."""
from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/contact'
files=sorted((out/'frames').glob('*.png'))
first=Image.open(files[0]).convert('RGB');w,h=first.size
sample=Image.new('RGB',(w,h*4))
for row,i in enumerate([17,23,67,96]):sample.paste(Image.open(files[i]).convert('RGB'),(0,h*row))
palette=sample.quantize(colors=255)
frames=[Image.open(f).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in files]
frames[0].save(out/'contact.gif',save_all=True,append_images=frames[1:],duration=[500]+[30,30,40]*36+[900],loop=0,disposal=1,optimize=True)
with Image.open(out/'contact.gif') as gif:
 assert gif.n_frames==len(frames)
 for i in [0,17,23,67,109]:
  gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
 gif.seek(23);gif.convert('RGB').save(out/'gif-preview.png')
print(f'{len(frames)} frames, {(out/"contact.gif").stat().st_size} bytes; decoded samples match native frames')
