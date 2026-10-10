from pathlib import Path
from PIL import Image, ImageChops
out=Path(__file__).resolve().parents[1]/'output/stable-walk'
files=sorted((out/'frames').glob('*.png'));w,h=Image.open(files[0]).size
sample=Image.new('RGB',(w,h*3))
for row,i in enumerate([20,45,79]):sample.paste(Image.open(files[i]).convert('RGB'),(0,h*row))
palette=sample.quantize(colors=255)
frames=[Image.open(p).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for p in files]
durations=[500]+([30,30,40]*36)[:len(frames)-2]+[900]
frames[0].save(out/'stable-walk.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=1,optimize=True)
with Image.open(out/'stable-walk.gif') as gif:
 assert gif.n_frames==len(frames)
 for i in [0,20,45,79,107]:
  gif.seek(i);assert ImageChops.difference(gif.convert('RGB'),frames[i].convert('RGB')).getbbox() is None
 gif.seek(20);gif.convert('RGB').save(out/'gif-preview.png')
print(f'{len(frames)} frames, {(out/"stable-walk.gif").stat().st_size} bytes; decoded samples match native frames')
