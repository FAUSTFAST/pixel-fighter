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
  let masterVolume = .9;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = masterVolume; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = enabled?0.7:0; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = musicOn?MUSIC_LEVEL:0; musicGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  // 首次交互解锁
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['keydown', 'pointerdown'].forEach(ev =>
    window.addEventListener(ev, unlock, { capture: true }));

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

  // ---------- 舞台音乐：独立乐谱 + 音频时钟前瞻调度 ----------
  const TRACKS=window.FIGHTER_TRACKS;
  const MUSIC_LEVEL=.42;
  let curTrack=null,requestedTrack='menu',step=0,nextNoteTime=0;
  let noiseBuffer=null,reverbBuffer=null,driveCurve=null;
  const midi=n=>440*Math.pow(2,(n-69)/12);
  const PRESETS={
    shamisen:{wave:'sawtooth',cut:4800,end:850,attack:.002,release:.10,pluck:true},
    synth:{wave:'sawtooth',cut:2600,end:1200,attack:.012,release:.10,double:true},
    brass:{wave:'sawtooth',cut:2000,end:1400,attack:.028,release:.09,double:true},
    guitar:{wave:'sawtooth',cut:2700,end:1300,attack:.004,release:.07,drive:true,double:true},
    electric:{wave:'sine',cut:6000,end:3000,attack:.003,release:.20,pluck:true,fm:2},
    bell:{wave:'sine',cut:7000,end:3500,attack:.003,release:.34,pluck:true,fm:2.76},
    flute:{wave:'sine',cut:3600,end:2200,attack:.025,release:.12,double:true},
    strings:{wave:'sawtooth',cut:1250,end:750,attack:.10,release:.25,double:true},
    analog:{wave:'triangle',cut:1500,end:900,attack:.06,release:.24,double:true},
    organ:{wave:'square',cut:1800,end:1200,attack:.006,release:.07},
    power:{wave:'sawtooth',cut:1800,end:900,attack:.003,release:.06,drive:true},
    bass:{wave:'sawtooth',cut:650,end:180,attack:.004,release:.05},
    sub:{wave:'triangle',cut:800,end:350,attack:.004,release:.07}
  };
  function prepareMusicBuffers(){
    if(noiseBuffer)return;
    noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const samples=noiseBuffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    const length=Math.floor(ctx.sampleRate*1.25);
    reverbBuffer=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){
      const d=reverbBuffer.getChannelData(ch);
      for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,3.5)*.5;
    }
    driveCurve=new Float32Array(1024);
    for(let i=0;i<driveCurve.length;i++)driveCurve[i]=Math.tanh((i/1023*2-1)*2.8)/Math.tanh(2.8);
  }
  function createMusicSession(tk){
    prepareMusicBuffers();
    const bus=ctx.createGain();bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(1,ctx.currentTime+.12);
    const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.006;compressor.release.value=.15;
    bus.connect(compressor);compressor.connect(musicGain);
    const reverb=ctx.createConvolver();reverb.buffer=reverbBuffer;
    const wet=ctx.createGain();wet.gain.value=tk.space;reverb.connect(wet);wet.connect(bus);
    const delay=ctx.createDelay(1);delay.delayTime.value=60/tk.bpm*.75;
    const echoFilter=ctx.createBiquadFilter();echoFilter.frequency.value=2200;
    const echoGain=ctx.createGain();echoGain.gain.value=.14;
    const feedback=ctx.createGain();feedback.gain.value=.23;
    delay.connect(echoFilter);echoFilter.connect(echoGain);echoGain.connect(bus);echoFilter.connect(feedback);feedback.connect(delay);
    return {bus,reverb,delay,sources:new Set(),nodes:[bus,compressor,reverb,wet,delay,echoFilter,echoGain,feedback]};
  }
  function scheduleSources(session,sources,nodes,time,end){
    let remaining=sources.length;
    sources.forEach(source=>{
      session.sources.add(source);
      source.onended=()=>{
        session.sources.delete(source);source.disconnect();
        if(--remaining===0)nodes.forEach(node=>node.disconnect());
      };
      source.start(time);source.stop(end);
    });
  }
  function voice(note,time,duration,name,volume,session,spatial=false){
    const p=PRESETS[name]||PRESETS.synth,frequency=midi(note);
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=p.pluck?1.5:.7;
    filter.frequency.setValueAtTime(p.cut,time);filter.frequency.exponentialRampToValueAtTime(p.end,time+Math.max(.05,duration));
    const envelope=ctx.createGain(),end=time+duration+p.release;
    envelope.gain.setValueAtTime(.0001,time);
    envelope.gain.exponentialRampToValueAtTime(volume,time+p.attack);
    envelope.gain.exponentialRampToValueAtTime(volume*(p.pluck?.16:.7),time+Math.max(p.attack+.01,duration));
    envelope.gain.exponentialRampToValueAtTime(.0001,end);
    const nodes=[filter,envelope],sources=[];
    if(p.drive){const shaper=ctx.createWaveShaper();shaper.curve=driveCurve;shaper.oversample='2x';filter.connect(shaper);shaper.connect(envelope);nodes.push(shaper);}else filter.connect(envelope);
    envelope.connect(session.bus);
    if(spatial){envelope.connect(session.reverb);envelope.connect(session.delay);}
    const oscillator=ctx.createOscillator();oscillator.type=p.wave;oscillator.frequency.value=frequency;oscillator.connect(filter);sources.push(oscillator);
    if(p.double){
      const second=ctx.createOscillator(),blend=ctx.createGain();second.type=p.wave;second.frequency.value=frequency;second.detune.value=name==='flute'?3:7;blend.gain.value=.3;second.connect(blend);blend.connect(filter);nodes.push(blend);sources.push(second);
    }
    if(p.fm){
      const mod=ctx.createOscillator(),amount=ctx.createGain();mod.frequency.value=frequency*p.fm;
      amount.gain.setValueAtTime(frequency*(name==='bell'?.9:1.6),time);amount.gain.exponentialRampToValueAtTime(frequency*.03,time+duration+.05);
      mod.connect(amount);amount.connect(oscillator.frequency);sources.push(mod);nodes.push(amount);
    }
    scheduleSources(session,sources,nodes,time,end+.01);
  }
  function drumTone(time,start,end,duration,volume,session,type='sine'){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;
    osc.frequency.setValueAtTime(start,time);osc.frequency.exponentialRampToValueAtTime(end,time+duration);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.002);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain);gain.connect(session.bus);scheduleSources(session,[osc],[gain],time,time+duration+.01);
  }
  function drumNoise(time,duration,volume,frequency,session,type='highpass'){
    const source=ctx.createBufferSource();source.buffer=noiseBuffer;
    const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;
    const gain=ctx.createGain();gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    source.connect(filter);filter.connect(gain);gain.connect(session.bus);scheduleSources(session,[source],[filter,gain],time,time+duration+.01);
  }
  function kick(t,v,s){drumTone(t,145,43,.21,.66*v,s);drumNoise(t,.022,.085*v,3200,s);}
  function snare(t,v,s,metal=false){drumNoise(t,metal?.19:.13,.27*v,metal?1800:2400,s);drumTone(t,185,120,.095,.15*v,s,'triangle');}
  function percussion(tk,pos,t,level,s){
    switch(tk.groove){
      case 'taiko':case 'halftime':
        drumTone(t,pos%4?165:98,pos%4?92:51,.25,.23*level,s,'triangle');drumNoise(t,.055,.08*level,1700,s,'bandpass');break;
      case 'latin':
        drumTone(t,1180,920,.034,.10*level,s); // 木质 clave
        if(pos%3===0)drumTone(t+.035,360,170,.12,.13*level,s);break;
      case 'funk':
        [0,.012,.026].forEach(offset=>drumNoise(t+offset,.065,.075*level,1400,s,'bandpass'));break;
      case 'industrial':drumNoise(t,.036,.055*level,4800,s,'bandpass');break;
      case 'breakbeat':snare(t,.24*level,s);break;
      default:drumNoise(t,.06,.038*level,6500,s);break;
    }
  }
  function musicStep(t){
    const tk=curTrack,s=musicNode;if(!tk||!s)return;
    const bar=Math.floor(step/16)%32,pos=step%16,tick=60/tk.bpm/4;
    const intro=bar<4,bridge=bar>=20&&bar<24,chorus=(bar>=12&&bar<20)||bar>=24;
    const level=bridge?.65:intro?.82:1;
    const time=t+(pos%2?tk.swing*tick:0);
    const chord=tk.chords[bar%tk.chords.length],root=tk.root+chord[0];
    // 重拍、反拍和过门各有分工；车站碎拍与神社半拍保留各自的重心。
    if(tk.kick.includes(pos)&&(!bridge||pos===0||pos===8))kick(time,level,s);
    if(tk.snare.includes(pos)&&(!bridge||pos===8||pos===12))snare(time,level,s,tk.groove==='industrial');
    if(tk.hat.includes(pos)&&(!intro||bar>=2)&&!bridge){
      const open=pos===14&&bar%2===1;
      drumNoise(time,open?.13:.035,(pos%2?.025:.048)*level,6500,s);
    }
    if(tk.perc.includes(pos))percussion(tk,pos,time,level,s);
    if(tk.groove==='latin'&&[2,5,9,11,14].includes(pos))drumTone(time,260+pos*6,125+pos*4,.13,.12*level,s);
    if((bar%8===7||bar===3||bar===23)&&pos>=12&&pos%2===0){
      drumTone(time,200-(pos-12)*20,80,.15,.20,s,'triangle');
      if(pos===14)snare(time+tick,.6,s);
    }
    if(pos===0&&[4,12,24].includes(bar))drumNoise(time,.60,.12,4700,s);
    for(const [at,n,len] of tk.bass)if(pos===at&&(!bridge||pos%8===0)){
      voice(root+n,time,tick*len*.84,tk.groove==='industrial'?'power':tk.groove==='halftime'?'sub':'bass',.19*level,s);
    }
    // 同一和声使用不同奏法：切分铜管/键盘、闷音强力和弦或弦乐长音。
    const stab=['funk','latin','industrial'].includes(tk.groove);
    const chordHit=stab?(tk.groove==='industrial'?[0,3,6,8,11,14]:[2,6,10,14]).includes(pos):pos===0;
    if(chordHit&&(!intro||bar>=2)&&(!bridge||pos===0||pos===2)){
      for(const n of [0,chord[1],chord[2]])voice(root+12+n,time,stab?tick*1.2:tick*14,tk.pad,(stab?.034:.026)*(chorus?1:.75),s,!stab);
    }
    // 主题与副歌均为手写乐句，短暂留白给重击和必杀音效。
    const melody=(chorus?tk.b:tk.a)[bar%4];
    for(const [at,n,len] of melody)if(pos===at&&(!bridge||pos%4===0)){
      voice(tk.root+24+n,time,tick*len*.85,tk.lead,(tk.lead==='bell'?.14:.105)*(chorus?1.12:1),s,true);
      if(chorus&&tk.groove==='industrial')voice(tk.root+12+n,time,tick*len*.65,'guitar',.038,s);
    }
    if(chorus&&pos%2===0&&['drive','halftime','breakbeat'].includes(tk.groove)){
      const arp=[0,chord[1],chord[2],12];
      voice(root+24+arp[(pos/2)%4],time,tick*.8,tk.groove==='halftime'?'shamisen':'electric',.036,s,true);
    }
    step=(step+1)%512;
  }
  function scheduleMusic(){
    if(!musicOn||!ctx||ctx.state!=='running'||!curTrack)return;
    // 页面失焦/音频恢复时不补发已错过的音符，避免鼓点堆积。
    if(nextNoteTime<ctx.currentTime-.1)nextNoteTime=ctx.currentTime+.025;
    const tick=60/curTrack.bpm/4;
    while(nextNoteTime<ctx.currentTime+.12){musicStep(nextNoteTime);nextNoteTime+=tick;}
  }
  const Music={
    tracks:TRACKS,
    play(trackId){
      requestedTrack=TRACKS[trackId]?trackId:'menu';
      if(!musicOn)return;
      if(!ensure())return;
      const tk=TRACKS[requestedTrack];
      if(curTrack===tk&&musicTimer)return;
      this.stop();curTrack=tk;step=0;musicNode=createMusicSession(tk);nextNoteTime=ctx.currentTime+.04;
      musicTimer=setInterval(scheduleMusic,25);scheduleMusic();
    },
    stop(){
      if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
      const old=musicNode;musicNode=null;curTrack=null;
      if(!old||!ctx)return;
      const now=ctx.currentTime;
      old.bus.gain.cancelScheduledValues(now);old.bus.gain.setValueAtTime(old.bus.gain.value,now);old.bus.gain.linearRampToValueAtTime(0,now+.05);
      for(const source of old.sources){try{source.stop(now+.065);}catch(_error){}}
      setTimeout(()=>{old.nodes.forEach(node=>node.disconnect());},180);
    },
    setOn(v){Audio.setMusicOn(v);}
  };

  // ---------- 开关 ----------
  const Audio = {
    sfx: Sound,
    music: Music,
    toggleSfx() { this.setSfxOn(!enabled);return enabled; },
    toggleMusic() { this.setMusicOn(!musicOn);return musicOn; },
    isSfxOn() { return enabled; },
    isMusicOn() { return musicOn; },
    setSfxOn(v) { enabled=!!v; if(sfxGain)sfxGain.gain.value=enabled?.7:0; },
    setMusicOn(v) { musicOn=!!v; if(musicGain)musicGain.gain.setTargetAtTime(musicOn?MUSIC_LEVEL:0,ctx.currentTime,.025); if(!musicOn)Music.stop();else Music.play(requestedTrack); },
    setMasterVol(v) { masterVolume=Math.max(0,Math.min(1,Number(v)||0));if (master) master.gain.value = masterVolume; },
  };

  window.Audio2 = Audio;   // 避免与内置 window.Audio 冲突
})();
