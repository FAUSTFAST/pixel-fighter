from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/neon-sign/replay'
files=sorted((out/'frames').glob('*.png'));assert len(files)==100
w,h=Image.open(files[0]).size
sample=Image.new('RGB',(w,h*5))
for row,i in enumerate([0,20,40,60,80]):sample.paste(Image.open(files[i]).convert('RGB'),(0,row*h))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
frames[0].save(out/'neon-sign.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=1,optimize=True)
with Image.open(out/'neon-sign.gif') as gif:
    assert gif.n_frames==100
    for i in [0,20,40,60,80,99]:
        gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
print('100 original-game frames encoded and decoded successfully')
