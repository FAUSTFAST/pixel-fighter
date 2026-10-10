from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/art-restoration/replay'
files=sorted((out/'frames').glob('*.png'))
assert len(files)==160
sample=Image.new('RGB',(1120,460*8))
for row,index in enumerate([0,13,20,39,46,67,100,150]):
    sample.paste(Image.open(files[index]).convert('RGB'),(0,460*row))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
# Each image spans two production 60-Hz frames, played at half speed.
durations=[400]+[60 if i%3==0 else 70 for i in range(1,159)]+[600]
frames[0].save(out/'ryu-B-restored.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=1,optimize=True)
with Image.open(out/'ryu-B-restored.gif') as gif:
    assert gif.n_frames==160
    for i in [0,20,39,67,100,150,159]:
        gif.seek(i)
        assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
    gif.seek(20);gif.convert('RGB').save(out/'gif-preview.png')
print(f'160 game replay frames; GIF decode checks passed; {(out/"ryu-B-restored.gif").stat().st_size} bytes')
