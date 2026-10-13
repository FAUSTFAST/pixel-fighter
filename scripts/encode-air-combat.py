"""Encode actual fixed-PNG game replay and verify decoded GIF frames."""
from pathlib import Path
from PIL import Image, ImageChops

out = Path(__file__).resolve().parents[1] / 'output/air-combat/replay'
files = sorted((out / 'frames').glob('*.png'))
assert len(files) == 60
sample = Image.new('RGB', (1440, 810 * 4))
for row, index in enumerate([8, 12, 15, 21]):
    sample.paste(Image.open(files[index]).convert('RGB'), (0, 810 * row))
palette = sample.quantize(colors=255)
frames = [Image.open(file).convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE) for file in files]
durations = [600] + [60, 70, 70] * 19 + [60, 800]
frames[0].save(out / 'air-combat.gif', save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=1, optimize=False)
with Image.open(out / 'air-combat.gif') as gif:
    assert gif.n_frames == len(frames)
    for index in [0, 8, 12, 15, 21, 59]:
        gif.seek(index)
        assert ImageChops.difference(gif.convert('RGB'), frames[index].convert('RGB')).getbbox() is None
print(f'{len(frames)} frames; decoded GIF samples match the actual game raster')
