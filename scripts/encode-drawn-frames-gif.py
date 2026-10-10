from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/drawn-frames'
files=sorted((out/'frames').glob('*.png'));w,h=Image.open(files[0]).size
sample=Image.new('RGB',(w,h*4))
for row,i in enumerate([20,31,77,99]):sample.paste(Image.open(files[i]).convert('RGB'),(0,h*row))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
durations=[400]+([30,30,40]*48)[:len(frames)-2]+[800]
frames[0].save(out/'drawn-frames.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=1,optimize=True)
with Image.open(out/'drawn-frames.gif') as gif:
 assert gif.n_frames==len(frames)
 for i in [0,20,31,77,99,143]:
  gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
 gif.seek(31);gif.convert('RGB').save(out/'gif-preview.png')
print(f'{len(frames)} frames, {(out/"drawn-frames.gif").stat().st_size} bytes; decoded frames checked')
