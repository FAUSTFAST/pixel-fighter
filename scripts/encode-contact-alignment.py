from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/contact-alignment/replay'
files=sorted((out/'frames').glob('*.png'));assert len(files)==90
sample=Image.new('RGB',(1080,760*8))
for row,i in enumerate([0,8,14,20,28,36,50,75]):sample.paste(Image.open(files[i]).convert('RGB'),(0,row*760))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
frames[0].save(out/'contact-before-after.gif',save_all=True,append_images=frames[1:],duration=[350]+[100]*88+[700],loop=0,disposal=1,optimize=True)
with Image.open(out/'contact-before-after.gif') as gif:
    assert gif.n_frames==90
    for i in [0,8,14,20,28,36,50,75,89]:
        gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
print('90 production game frames encoded and decoded successfully')
