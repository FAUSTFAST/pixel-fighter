from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/stage-depth/replay'
files=sorted((out/'frames').glob('*.png'));assert len(files)==252
w,h=Image.open(files[0]).size
sample=Image.new('RGB',(w,h*7))
for row,i in enumerate([12,48,84,120,156,192,228]):sample.paste(Image.open(files[i]).convert('RGB'),(0,row*h))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
frames[0].save(out/'stage-depth.gif',save_all=True,append_images=frames[1:],duration=[30 if i%3<2 else 40 for i in range(len(frames))],loop=0,disposal=1,optimize=True)
with Image.open(out/'stage-depth.gif') as gif:
    assert gif.n_frames==252
    for i in [0,12,48,84,120,156,192,228,251]:
        gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
print('252 actual game replay frames encoded and decoded successfully')
