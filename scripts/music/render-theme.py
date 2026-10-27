"""Original instrumental audition. All instruments use recorded CC0 samples.

No game files are read or changed. Sample sources are in sample-manifest.json.
"""
from pathlib import Path
from fractions import Fraction
from functools import lru_cache
import json
import re
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[2] / "output/theme-song"
ROOT.mkdir(parents=True, exist_ok=True)
SR = 44100
BPM = 152
BEAT = 60 / BPM
START = .10
END_BEAT = 200
DURATION = START + END_BEAT * BEAT + 3.0
N = int(DURATION * SR)
RNG = np.random.default_rng(26026)
stems = {name: np.zeros((N, 2), np.float32) for name in
         ['rhythm_left', 'rhythm_right', 'clean', 'lead', 'harmony', 'bass', 'drums']}
events = []
pitch_classes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
                 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}

def midi(name):
    if isinstance(name, int):
        return name
    m = re.fullmatch(r'([A-G]#?)(\d)', name)
    return 12 * (int(m[2]) + 1) + pitch_classes[m[1]]

instruments = {'guitar': [], 'bass': []}
for p in (ROOT / 'samples/guitar/samples/bridge').glob('*.flac'):
    m = re.match(r'(.+)_s\d_0(\d)\.flac', p.name)
    instruments['guitar'].append((midi(m[1]), int(m[2]), p))
for p in (ROOT / 'samples/bass/Samples').glob('*.wav'):
    m = re.search(r'pluck_([a-g])(\d)_f_rr(\d)', p.name)
    # The source's little-bass mapping is an octave above the recorded bass.
    instruments['bass'].append((midi(m[1].upper() + m[2]) - 12, int(m[3]), p))

def filt(x, freq, kind='lowpass', order=2):
    return signal.sosfilt(signal.butter(order, freq, kind, fs=SR, output='sos'), x, axis=0).astype(np.float32)

@lru_cache(maxsize=120)
def pitched(kind, target, rr):
    choices = [t for t in instruments[kind] if t[1] == rr]
    root, _, path = min(choices, key=lambda t: abs(t[0] - target))
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    x = x[:int(sr * 5)].mean(axis=1)
    onset = np.flatnonzero(np.abs(x[:int(sr * .08)]) > np.max(np.abs(x)) * .012)
    if len(onset):
        x = x[max(0, int(onset[0]) - int(sr * .001)):]
    factor = SR / sr / (2 ** ((target - root) / 12))
    ratio = Fraction(factor).limit_denominator(512)
    x = signal.resample_poly(x, ratio.numerator, ratio.denominator).astype(np.float32)
    rms = np.sqrt(np.mean(x[:int(.22 * SR)] ** 2))
    x *= .18 / max(float(rms), .015)
    return x

def add(stem, x, beat, gain=1, pan=0, jitter=.004):
    t = START + beat * BEAT + (RNG.uniform(-jitter, jitter) if jitter else 0)
    pos = max(0, int(t * SR))
    length = min(len(x), N-pos)
    if length <= 0:
        return
    if x.ndim == 1:
        angle = (pan + 1) * np.pi / 4
        stereo = x[:length, None] * np.array([np.cos(angle), np.sin(angle)], np.float32)[None, :]
    else:
        stereo = x[:length]
    stems[stem][pos:pos+length] += stereo * gain

def note(stem, name, beat, beats, gain=.5, rr=None, muted=False, pan=0, vibrato=False):
    target = midi(name)
    kind = 'bass' if stem == 'bass' else 'guitar'
    rr = int(RNG.integers(1, 3)) if rr is None else rr
    source = pitched(kind, target, rr)
    hold = beats * BEAT
    release = .045 if muted else (.075 if kind == 'bass' else .13)
    count = min(len(source), int((hold + release) * SR))
    x = source[:count].copy()
    t = np.arange(count) / SR
    if vibrato and hold > .27:
        depth = .00065 * np.clip((t - .15) / .3, 0, 1)
        position = np.arange(count) + depth * SR * np.sin(2 * np.pi * 5.1 * t)
        x = np.interp(position, np.arange(count), x).astype(np.float32)
    env = np.ones(count, np.float32)
    env[:min(60,count)] *= np.linspace(0, 1, min(60,count))
    tail = int(release * SR)
    env[-tail:] *= np.linspace(1, 0, min(tail,count)) ** 1.6
    if muted:
        env *= np.exp(-t / .085)
        x = filt(x, 2200)
    x *= env
    add(stem, x, beat, gain, pan)
    events.append({'stem': stem, 'midi': target, 'beat': beat, 'duration_beats': beats})

def power(root, beat, length, muted=False, accent=1):
    root = midi(root)
    for stem, rr, timing in [('rhythm_left', 1, 0), ('rhythm_right', 2, .015)]:
        for i, interval in enumerate([0, 7, 12]):
            note(stem, root+interval, beat+timing+i*.012, length,
                 gain=.43 * accent * (1 if i < 2 else .7), rr=rr, muted=muted)

drum_dirs = {
    'kick': 'kick_24/kick/kick', 'snare': 'snare_14/center/top',
    'rim': 'snare_14/rimshot/top', 'hat': 'hihat_14/cl/oh',
    'open': 'hihat_14/open/oh', 'crash': 'crash_17/cr/oh',
    'tom_hi': 'tom_14/center/oh', 'tom_lo': 'tom_18/center/oh',
}
drums = {}
for kind, directory in drum_dirs.items():
    drums[kind] = []
    for p in sorted((ROOT/'samples/drums/Samples'/directory).glob('*.flac')):
        x, sr = sf.read(p, dtype='float32', always_2d=True)
        if sr != SR:
            x = signal.resample_poly(x, SR, sr, axis=0)
        if x.shape[1] == 1:
            x = x[:,0]
        # Keep individual hits' transient shape; balance close and overhead mics.
        x = x / max(float(np.max(np.abs(x))), .01)
        drums[kind].append(x.astype(np.float32))

drum_levels = {'kick': .78, 'snare': .62, 'rim': .62, 'hat': .16,
               'open': .19, 'crash': .29, 'tom_hi': .48, 'tom_lo': .55}
drum_pans = {'kick': 0, 'snare': -.05, 'rim': -.05, 'hat': -.28,
             'open': -.28, 'crash': .3, 'tom_hi': -.35, 'tom_lo': .4}

def drum(kind, beat, velocity=1, choke=None):
    arr = drums[kind][int(RNG.integers(len(drums[kind])))].copy()
    if choke:
        length = min(len(arr), int(choke * BEAT * SR))
        arr = arr[:length]
        tail = min(length, int(.06 * SR))
        arr[-tail:] *= np.linspace(1, 0, tail).reshape((-1,) + (1,) * (arr.ndim-1))
    add('drums', arr, beat, drum_levels[kind]*velocity*RNG.uniform(.94,1.03), drum_pans[kind], jitter=.003)

# Two bars of guitar introduction, with a short pickup into the band.
for bar, chord in enumerate([['E3','B3','E4','G4','B4','G4','E4','B3'],
                             ['C3','G3','D4','E4','G4','E4','D4','G3']]):
    for i, p in enumerate(chord):
        note('clean', p, bar*4+i*.5, .68, gain=.45, pan=-.24 if i%2 else .20)
for b in [4, 5, 6]:
    drum('hat', b, .55)
for b,v in [(7,.65),(7.5,.75),(7.75,.85)]:
    drum('snare', b, v)
note('lead','B4',6.5,.45,.5)
note('lead','D5',7,.45,.6)
note('lead','E5',7.5,.45,.65)

# Sixteen bars of a new melody, with repeated motifs and an answering phrase.
progression = ['C3','D3','E2','G2', 'C3','D3','B2','E2',
               'C3','D3','B2','E2', 'A2','B2','E2','E2']
melodies = [
    [(0,'G4',.65),(.75,'B4',.2),(1,'E5',.7),(2,'D5',.45),(2.5,'B4',.95),(3.5,'G4',.4)],
    [(0,'A4',.7),(.75,'B4',.2),(1,'D5',.7),(2,'F#5',.7),(3,'E5',.45),(3.5,'D5',.4)],
    [(0,'B4',.45),(.5,'G4',.4),(1,'E5',1.15),(2.5,'D5',.4),(3,'B4',.85)],
    [(0,'G4',.7),(1,'A4',.45),(1.5,'B4',.7),(2.5,'D5',.4),(3,'B4',.9)],
    [(0,'E5',.7),(.75,'D5',.2),(1,'B4',.7),(2,'G4',.45),(2.5,'B4',.4),(3,'E5',.9)],
    [(0,'F#5',.7),(1,'E5',.45),(1.5,'D5',.7),(2.5,'A4',.4),(3,'D5',.9)],
    [(0,'F#5',.7),(1,'D5',.45),(1.5,'B4',.95),(2.5,'A4',.4),(3,'F#4',.8)],
    [(0,'G4',.45),(.5,'B4',.45),(1,'E5',1.4),(2.75,'D5',.2),(3,'B4',.7)],
    [(0,'G5',.65),(.75,'F#5',.2),(1,'E5',.7),(2,'D5',.45),(2.5,'E5',.95),(3.5,'G5',.4)],
    [(0,'F#5',.7),(.75,'E5',.2),(1,'D5',.7),(2,'A4',.45),(2.5,'D5',.45),(3,'F#5',.9)],
    [(0,'F#5',.45),(.5,'D5',.4),(1,'B4',.9),(2,'D5',.45),(2.5,'F#5',.4),(3,'A5',.9)],
    [(0,'G5',.9),(1.25,'F#5',.2),(1.5,'E5',.8),(2.5,'D5',.4),(3,'B4',.9)],
    [(0,'A4',.7),(1,'C5',.45),(1.5,'E5',.9),(2.5,'G5',.4),(3,'E5',.9)],
    [(0,'F#5',.65),(.75,'D#5',.2),(1,'B4',.7),(2,'A4',.45),(2.5,'B4',.4),(3,'D#5',.9)],
    [(0,'E5',1.3),(1.5,'B4',.4),(2,'G4',.45),(2.5,'B4',.45),(3,'D5',.45),(3.5,'D#5',.4)],
    [(0,'E5',3.8)],
]

# A full theme keeps the audition's motifs, adds a quieter guitar break,
# rebuilds the band, and returns to the chorus before the final cadence.
arrangement = [(i, 'theme') for i in range(16)] + [(i, 'break') for i in range(8)] + [(i, 'build') for i in range(8)] + [(i, 'chorus') for i in range(16)]
for songbar, (bar, role) in enumerate(arrangement):
    root = progression[bar]
    base = 8 + songbar*4
    final = songbar == len(arrangement)-1
    if role == 'break':
        chord_tones = {'C3':['C3','G3','B3','E4'], 'D3':['D3','A3','D4','F#4'],
                       'E2':['E3','B3','E4','G4'], 'G2':['G3','B3','D4','G4'],
                       'B2':['B2','F#3','B3','D4']}[root]
        for step_index, voice_index in enumerate([0,1,2,3,2,1,3,2]):
            note('clean',chord_tones[voice_index],base+step_index*.5,.8,.48,pan=-.25 if step_index%2 else .25)
        bass_root=midi(root)
        while bass_root>35: bass_root-=12
        for offset in [0,2]: note('bass',bass_root,base+offset,1.7,.57)
        for offset in [0,1,2,3]: drum('hat',base+offset,.52)
        drum('kick',base,.6)
        drum('snare',base+2,.38)
        if bar in [3,7]:
            for offset,kind in [(3,'snare'),(3.5,'tom_hi'),(3.75,'tom_lo')]: drum(kind,base+offset,.6)
        for offset,p,duration in melodies[bar][:2]:
            note('clean',p,base+offset+.1,max(.7,duration),.35,pan=.15)
        continue
    if final:
        power(root,base,3.8,accent=1.05)
    elif bar < 8:
        for offset,length,mute,accent in [(0,.43,False,1.1),(.5,.28,True,.8),(1,.32,True,.9),
                                          (1.5,.65,False,1),(2.5,.3,True,.9),(3,.35,True,.85),(3.5,.4,False,1)]:
            power(root,base+offset,length,mute,accent)
    else:
        for k in range(8):
            power(root,base+k*.5,.4,muted=(k in [1,5] and bar%2==0),accent=1.05 if k%2==0 else .82)
    bass_root = midi(root)
    while bass_root > 35:
        bass_root -= 12
    if final:
        note('bass',bass_root,base,3.6,.85)
    else:
        for k in range(8):
            offset = 7 if k==5 else (12 if k==6 and bar%2 else 0)
            if k == 7 and bar in [3,7,11]:
                offset = 10
            note('bass',bass_root+offset,base+k*.5,.40,.72 if k%2==0 else .62)
    # Lead sustains and small natural vibrato, with a few harmonized peaks.
    for offset,p,duration in melodies[bar]:
        note('lead',p,base+offset,duration,.65 if bar<8 else .71,vibrato=True)
        if 8 <= bar <= 11 and offset == 0:
            harmony = {'G5':'E5','F#5':'D5'}[p]
            note('harmony',harmony,base+offset+.015,duration,.30,pan=.3,vibrato=True)
    if bar in [0,4,8,12,15]:
        drum('crash',base,1)
    if final:
        drum('kick',base,1)
        drum('rim',base,.85)
        continue
    for offset in ([0,1.5,2,2.75] if bar%2==0 else [0,.75,2,3.5]):
        drum('kick',base+offset,1 if offset%1==0 else .85)
    drum('rim' if bar>=8 else 'snare',base+1,1)
    drum('rim' if bar>=8 else 'snare',base+3,1)
    for k in range(8):
        if k == 7 and bar%2:
            drum('open',base+k*.5,.85,choke=.47)
        else:
            drum('hat',base+k*.5,1 if k%2==0 else .63)
    if bar%4==3:
        for offset,kind,v in [(2.75,'snare',.38),(3.25,'snare',.68),(3.5,'tom_hi',.85),(3.75,'tom_lo',.95)]:
            drum(kind,base+offset,v)

def amp(x, drive, highpass, lowpass):
    x = filt(x, highpass, 'highpass')
    x = np.tanh(x * drive)
    x = filt(x, lowpass, 'lowpass', 3)
    return x

def delay(x, taps):
    out = x.copy()
    for seconds, gain, swap in taps:
        shift = int(seconds * SR)
        src = x[:-shift, ::-1] if swap else x[:-shift]
        out[shift:] += src * gain
    return out

# Amp/cabinet coloration acts on real string recordings, not generated oscillators.
for name,pan in [('rhythm_left',-.80),('rhythm_right',.80)]:
    mono = stems[name].sum(axis=1) * .707
    mono = amp(mono,3.6,100,5100)
    theta = (pan+1)*np.pi/4
    stems[name] = mono[:,None] * np.array([np.cos(theta),np.sin(theta)])[None,:] * .34
stems['lead'] = amp(stems['lead'],3.0,165,6000) * .43
stems['lead'] = delay(stems['lead'],[(BEAT*.75,.19,True),(BEAT*1.5,.085,False)])
stems['harmony'] = amp(stems['harmony'],2.4,230,5300)*.24
stems['clean'] = delay(filt(stems['clean'],7000),[(.053,.12,True),(BEAT*.75,.21,True),(BEAT*1.5,.10,False)])*.90
stems['bass'] = amp(stems['bass'],1.65,33,2500)*.65
stems['drums'] = filt(stems['drums'],30,'highpass')
stems['drums'] = delay(stems['drums'],[(.019,.10,True),(.041,.065,False),(.079,.035,True)])

mix = sum(stems.values())
mix = filt(mix,27,'highpass')
mix *= .77
mix = np.tanh(mix*.95)/.95
mix *= .90 / max(float(np.max(np.abs(mix))), .01)
# Fade only the tail of the final ringing chord, not the groove.
fade = int(2.1*SR)
mix[-fade:] *= np.linspace(1,0,fade)[:,None]**1.3
mix[:int(.015*SR)] *= np.linspace(0,1,int(.015*SR))[:,None]
assert np.isfinite(mix).all()
assert np.max(np.abs(mix)) < .99
# Make the loop boundary return to the first full-band downbeat without a click.
loop_end = int((START + END_BEAT * BEAT) * SR)
edge = int(.012 * SR)
mix[loop_end-edge:loop_end] *= np.linspace(1,0,edge)[:,None]
sf.write(ROOT/'Pixel-Fighter-Break-of-Dawn-premaster.wav',mix,SR,subtype='PCM_24')
report = {'title':'再战黎明 / Break of Dawn', 'original_composition':True,
          'bpm':BPM,'duration_seconds':len(mix)/SR,'sample_rate':SR,'channels':2,
          'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),
          'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),
          'note_events':len(events),'sample_files':sum(len(v) for v in instruments.values())+sum(len(v) for v in drums.values()),
          'performance':'Original sequenced arrangement using recorded guitar, bass and acoustic drum samples; not a live band recording.',
          'loop_start_seconds':START+8*BEAT,'loop_end_seconds':START+END_BEAT*BEAT,'sections':['intro','theme','guitar break','rebuild','chorus','cadence']}
(ROOT/'full-render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(ROOT/'full-score-events.json').write_text(json.dumps(events,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
