// ============================================================
// audio.js — 程序化音效与背景音乐(Web Audio API,无需素材文件)。
// 首次用户交互后解锁 AudioContext(浏览器自动播放策略要求)。
// ============================================================
(function () {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let musicTimer = null;
  let musicNode = null;
  let enabled = true;
  let musicOn = true;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.25; musicGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  // 首次交互解锁
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['keydown', 'pointerdown'].forEach(ev =>
    window.addEventListener(ev, unlock, { once: false }));

  // --- 基础合成:一个带包络的振荡器 ---
  function tone(freq, dur, type, gain, opts = {}) {
    // 音乐总线不受 SFX 开关影响;SFX 才检查 enabled
    if (!opts.music && !enabled) return;
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
    const peak = gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(opts.bus || sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // --- 噪声爆发(打击/爆炸感) ---
  function noise(dur, gain, filterFreq, opts = {}) {
    if (!opts.music && !enabled) return;
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.hp ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(filterFreq || 1200, t0);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(opts.bus || sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // ---------- 具体音效 ----------
  const Sound = {
    hitLight() { noise(0.09, 0.35, 2600, { hp: false }); tone(220, 0.08, 'square', 0.25, { slideTo: 120 }); },
    hitHeavy() { noise(0.16, 0.5, 1600, {}); tone(140, 0.16, 'square', 0.35, { slideTo: 60 }); tone(90, 0.18, 'sine', 0.3, { slideTo: 40 }); },
    hitSpecial() { noise(0.28, 0.55, 2200, { sweepTo: 300 }); tone(180, 0.3, 'sawtooth', 0.35, { slideTo: 70 }); tone(320, 0.25, 'square', 0.25, { slideTo: 90 }); },
    block() { noise(0.12, 0.4, 4000, { hp: true }); tone(880, 0.06, 'square', 0.2, { slideTo: 1400 }); },
    whiff() { noise(0.13, 0.14, 900, { sweepTo: 300 }); },
    jump() { tone(300, 0.14, 'sine', 0.22, { slideTo: 620 }); },
    land() { noise(0.08, 0.2, 500); },
    special() { // 蓄力放招音
      tone(200, 0.35, 'sawtooth', 0.28, { slideTo: 520, attack: 0.06 });
      tone(400, 0.3, 'square', 0.18, { slideTo: 700 });
    },
    fireball() { tone(500, 0.35, 'sawtooth', 0.25, { slideTo: 180 }); noise(0.3, 0.2, 1800, { sweepTo: 400 }); },
    ko() {
      // 下行三音 + 低频轰
      [523, 392, 262].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'square', 0.3, { slideTo: f * 0.6 }), i * 130));
      setTimeout(() => { noise(0.5, 0.4, 800, { sweepTo: 120 }); tone(70, 0.6, 'sine', 0.35, { slideTo: 40 }); }, 60);
    },
    roundStart() { [440, 660].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.28), i * 140)); },
    fight() { tone(330, 0.12, 'square', 0.3); setTimeout(() => tone(660, 0.3, 'square', 0.32), 130); },
    menuMove() { tone(440, 0.05, 'square', 0.18, { slideTo: 560 }); },
    menuSelect() { tone(660, 0.08, 'square', 0.25, { slideTo: 990 }); setTimeout(() => tone(990, 0.1, 'square', 0.22), 60); },
    menuBack() { tone(440, 0.08, 'square', 0.2, { slideTo: 260 }); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'square', 0.28), i * 120)); },
  };

  // ---------- 背景音乐:简单的循环合成旋律 + 低音 ----------
  // 每张地图给不同调性/速度
  const TRACKS = {
    dojo:    { bpm: 96,  scale: [0, 2, 3, 5, 7, 8, 10], root: 220, bass: 55, wave: 'triangle' },
    city:    { bpm: 124, scale: [0, 3, 5, 6, 7, 10],    root: 262, bass: 65, wave: 'square' },
    beach:   { bpm: 108, scale: [0, 2, 4, 7, 9],        root: 294, bass: 73, wave: 'triangle' },
    volcano: { bpm: 132, scale: [0, 1, 4, 5, 7, 8, 11], root: 196, bass: 49, wave: 'sawtooth' },
    menu:    { bpm: 112, scale: [0, 2, 4, 5, 7, 9, 11], root: 262, bass: 65, wave: 'triangle' },
  };

  let step = 0;
  let curTrack = null;

  function midiToFreq(base, semi) { return base * Math.pow(2, semi / 12); }

  function musicStep() {
    if (!musicOn || !ctx) return;
    const tk = curTrack;
    if (!tk) return;
    const beat = 60 / tk.bpm / 2; // 八分音符
    // 旋律:伪随机但确定的走句(用 step 驱动,避免 Math.random 让节奏散)
    const idx = tk.scale[(step * 3 + Math.floor(step / 4)) % tk.scale.length];
    const oct = (step % 8 < 4) ? 0 : 12;
    const freq = midiToFreq(tk.root, idx + oct);
    if (step % 2 === 0 || (step * 7) % 5 < 3) tone(freq, beat * 1.4, tk.wave, 0.10, { bus: musicGain, music: true });
    // 低音:每拍
    if (step % 2 === 0) {
      const bidx = tk.scale[(Math.floor(step / 2)) % tk.scale.length];
      tone(midiToFreq(tk.bass, bidx), beat * 1.8, 'triangle', 0.16, { bus: musicGain, music: true });
    }
    // 简单打击(hi-hat)
    if (step % 2 === 1) noise(0.03, 0.05, 6000, { hp: true, bus: musicGain, music: true });
    if (step % 4 === 0) noise(0.06, 0.12, 200, { bus: musicGain, music: true }); // kick-ish
    step++;
  }

  const Music = {
    play(trackId) {
      if (!ensure()) return;
      const tk = TRACKS[trackId] || TRACKS.menu;
      if (curTrack === tk && musicTimer) return;
      this.stop();
      curTrack = tk; step = 0;
      const interval = 60 / tk.bpm / 2 * 1000;
      musicTimer = setInterval(musicStep, interval);
    },
    stop() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    setOn(v) { musicOn = v; if (!v) this.stop(); },
  };

  // ---------- 开关 ----------
  const Audio = {
    sfx: Sound,
    music: Music,
    toggleSfx() { enabled = !enabled; return enabled; },
    toggleMusic() { musicOn = !musicOn; if (!musicOn) Music.stop(); return musicOn; },
    isSfxOn() { return enabled; },
    isMusicOn() { return musicOn; },
    setMasterVol(v) { if (master) master.gain.value = v; },
  };

  window.Audio2 = Audio;   // 避免与内置 window.Audio 冲突
})();
