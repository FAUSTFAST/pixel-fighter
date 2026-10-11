from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/walk-rate/replay'
files=sorted((out/'frames').glob('*.png'));assert len(files)==130
w,h=Image.open(files[0]).size
sample=Image.new('RGB',(w,h*8))
for row,i in enumerate([0,8,16,30,42,54,68,110]):sample.paste(Image.open(files[i]).convert('RGB'),(0,row*h))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
frames[0].save(out/'walk-075.gif',save_all=True,append_images=frames[1:],duration=[350]+[50]*128+[650],loop=0,disposal=1,optimize=True)
with Image.open(out/'walk-075.gif') as gif:
    assert gif.n_frames==130
    for i in [0,8,16,30,42,54,68,110,129]:
        gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
print('130 actual game replay frames encoded and decoded successfully')
