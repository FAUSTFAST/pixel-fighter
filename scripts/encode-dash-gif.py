"""One palette, delta frames, with decoded samples checked against the game."""
from pathlib import Path
from PIL import Image, ImageChops

out = Path(__file__).resolve().parents[1] / 'output/dash'
files = sorted((out / 'frames').glob('*.png'))
sample = Image.new('RGB', (960, 478 * 3))
for row, frame in enumerate([0, 18, 38]):
    sample.paste(Image.open(files[frame]).convert('RGB'), (0, 478 * row))
palette = sample.quantize(colors=255)
frames = [Image.open(p).convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE) for p in files]
frames[0].save(out / 'dash.gif', save_all=True, append_images=frames[1:],
               duration=[500] + [67] * (len(frames) - 2) + [1100], loop=0,
               optimize=True, disposal=1)
with Image.open(out / 'dash.gif') as gif:
    assert gif.n_frames == len(frames)
    for frame in [0, 10, 18, 35, 59]:
        gif.seek(frame)
        assert ImageChops.difference(gif.convert('RGB'), frames[frame].convert('RGB')).getbbox() is None
    gif.seek(18)
    gif.convert('RGB').save(out / 'gif-preview.png')
print(f'{len(frames)} frames; {(out / "dash.gif").stat().st_size} bytes; decoded samples match original frames')
