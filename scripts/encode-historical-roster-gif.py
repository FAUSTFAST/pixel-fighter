from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/art-restoration/full'
files=sorted((out/'frames').glob('*.png'));assert len(files)==240
sample=Image.new('RGB',(1080,470*12))
for row,i in enumerate([0,8,25,50,60,75,97,104,142,157,177,215]):
    sample.paste(Image.open(files[i]).convert('RGB'),(0,470*row))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
frames[0].save(out/'roster-B-restored.gif',save_all=True,append_images=frames[1:],duration=[400]+[100]*238+[700],loop=0,disposal=1,optimize=True)
with Image.open(out/'roster-B-restored.gif') as gif:
    assert gif.n_frames==240
    for i in [0,25,60,97,142,215,239]:
        gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
    gif.seek(60);gif.convert('RGB').save(out/'gif-preview.png')
print(f'240 actual game frames encoded and decoded; {(out/"roster-B-restored.gif").stat().st_size} bytes')
