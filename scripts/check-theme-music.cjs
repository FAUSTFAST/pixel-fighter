// Real browser / decoded MP3 checks. Run against a local source or staged server.
// Requires Playwright and Chrome; it does not modify the game or the user's profile.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:8766/';
const output = path.resolve(__dirname,'../output/theme-song');
fs.mkdirSync(output,{recursive:true});
const report={url:base,checks:[],errors:[]};
let browser;

function probeAudio(){
  const Native=window.AudioContext;
  window.__audioProbe={sources:[]};
  window.AudioContext=function(...args){
    const ctx=new Native(...args),p=window.__audioProbe;p.ctx=ctx;
    const gain=ctx.createGain.bind(ctx),buffer=ctx.createBufferSource.bind(ctx);
    let first=true;
    ctx.createGain=()=>{const node=gain();if(first){first=false;p.master=node;p.analyser=ctx.createAnalyser();node.connect(p.analyser);}return node;};
    ctx.createBufferSource=()=>{
      const source=buffer(),start=source.start.bind(source),stop=source.stop.bind(source);
      source.start=(...a)=>{if(source.loop)p.sources.push({source,started:ctx.currentTime,stopAt:Infinity});return start(...a);};
      source.stop=(...a)=>{const item=p.sources.find(x=>x.source===source);if(item)item.stopAt=a[0]??ctx.currentTime;return stop(...a);};
      return source;
    };
    return ctx;
  };
}

async function newPage(options={}){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(probeAudio);
  if(options.muted)await context.addInitScript(()=>localStorage.setItem('pixel-fighter-settings-v1',JSON.stringify({music:false,sfx:true,volume:90})));
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  return {page,context};
}
const active=page=>page.evaluate(()=>__audioProbe.sources.filter(s=>s.stopAt>__audioProbe.ctx.currentTime).length);
const waitStatus=(page,status)=>page.waitForFunction(s=>window.Audio2?.music.status===s,status,{timeout:20000});

(async()=>{
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
    const {page,context}=await newPage();
    let downloads=0;page.on('request',r=>{if(r.url().includes('break-of-dawn-v1.mp3'))downloads++;});
    const bad=[];page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))bad.push(r.url());});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.app-brand').click();
    await waitStatus(page,'playing');
    await page.waitForFunction(()=>__audioProbe.sources.length===1);
    const recording=await page.evaluate(()=>{
      const s=__audioProbe.sources[0].source;
      return {seconds:s.buffer.duration,loop:s.loop,loopStart:s.loopStart,loopEnd:s.loopEnd};
    });
    assert(recording.seconds>81&&recording.seconds<83);assert(recording.loop);
    assert.equal(await active(page),1);
    await page.waitForFunction(()=>{const p=__audioProbe,a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return a.some(x=>Math.abs(x)>.001);});
    report.recording=recording;report.checks.push('Home plays a decoded recording after interaction');

    await page.evaluate(()=>{Audio2.setSfxOn(false);Audio2.setMasterVol(0);});
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>__audioProbe.master.gain.value),0);
    assert.equal(await active(page),1);
    await page.evaluate(()=>Audio2.setMasterVol(.5));
    assert.equal(await page.evaluate(()=>__audioProbe.master.gain.value),.5);
    await page.evaluate(()=>Audio2.setMusicOn(false));await page.waitForTimeout(100);
    assert.equal(await active(page),0);
    await page.evaluate(()=>Audio2.setMusicOn(true));await waitStatus(page,'playing');
    assert.equal(await active(page),1);assert.equal(downloads,1);
    report.checks.push('Music/SFX switches are independent, master volume works, one download is reused');

    await page.evaluate(()=>{GameControl.beginMode('training');Settings.close();});
    await page.waitForTimeout(150);assert.equal(await active(page),0);
    await page.evaluate(()=>GameControl.returnHome());await waitStatus(page,'playing');
    for(let i=0;i<5;i++)await page.evaluate(()=>{Audio2.music.stop();Audio2.music.play('menu');});
    await page.waitForTimeout(150);assert.equal(await active(page),1);assert.equal(downloads,1);
    report.checks.push('Fight transition stops the theme; returning home / rapid replays leave one player');

    await page.locator('#settings-open').click();
    assert.equal(await page.locator('#music-track').inputValue(),'menu');
    assert.equal(await page.locator('#music-track option').count(),8);
    assert.match(await page.locator('#music-track-title').textContent(),/再战黎明/);
    await page.locator('#music-track').selectOption('city');
    await page.locator('#music-preview').click();await page.waitForTimeout(120);
    assert.equal(await active(page),0);
    await page.locator('#music-track').selectOption('menu');await waitStatus(page,'playing');
    await page.screenshot({path:path.join(output,'theme-settings.png')});
    await page.locator('#settings-close').click();
    report.checks.push('All eight soundtrack choices preview correctly and closing settings restores the scene');

    report.loop=await page.evaluate(async()=>{
      const original=__audioProbe.sources[0].source,rate=44100;
      const offline=new OfflineAudioContext(2,rate,rate),source=offline.createBufferSource();
      source.buffer=original.buffer;source.loop=true;source.loopStart=original.loopStart;source.loopEnd=original.loopEnd;
      source.connect(offline.destination);source.start(0,source.loopEnd-.1);
      const buffer=await offline.startRendering(),x=buffer.getChannelData(0);
      const rms=(a,b)=>Math.sqrt(x.slice(a*rate,b*rate).reduce((s,v)=>s+v*v,0)/((b-a)*rate));
      return {before:rms(.02,.08),after:rms(.12,.3),finite:[...x].every(Number.isFinite)};
    });
    assert(report.loop.finite&&report.loop.before>.001&&report.loop.after>.001);
    await context.setOffline(true);
    await page.evaluate(()=>{Audio2.music.stop();Audio2.music.play('menu');});
    await waitStatus(page,'playing');await page.waitForTimeout(100);
    assert.equal(await active(page),1);assert.equal(downloads,1);
    report.checks.push('Decoded theme keeps playing and restarts offline without a second download');
    await context.setOffline(false);
    await page.screenshot({path:path.join(output,'theme-home.png')});
    assert.deepEqual(bad,[]);
    report.checks.push('The actual decoded recording crosses its loop boundary with sound on both sides');
    await context.close();

    for(const mode of ['fight','mute']){
      const {page:p,context:c}=await newPage();let release,requested;
      const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>requested=resolve);
      await p.route('**/break-of-dawn-v1.mp3',async route=>{requested();await held;await route.continue();});
      await p.goto(base,{waitUntil:'domcontentloaded'});await seen;
      await p.locator('.app-brand').click();
      await p.evaluate(mode=>{if(mode==='fight'){GameControl.beginMode('training');Settings.close();}else Audio2.setMusicOn(false);},mode);
      release();await p.waitForLoadState('networkidle');await p.waitForTimeout(150);
      assert.equal(await active(p),0);
      await p.evaluate(mode=>{if(mode==='fight')GameControl.returnHome();else Audio2.setMusicOn(true);},mode);
      await waitStatus(p,'playing');assert.equal(await active(p),1);
      report.checks.push('Slow download cannot restart theme after '+mode);await c.close();
    }

    const {page:f,context:fc}=await newPage();
    await f.route('**/break-of-dawn-v1.mp3',route=>route.fulfill({status:503,body:'Temporary test failure'}));
    await f.goto(base,{waitUntil:'networkidle'});await waitStatus(f,'error');
    await f.unroute('**/break-of-dawn-v1.mp3');await f.locator('.app-brand').click();
    await f.evaluate(()=>{Audio2.music.stop();Audio2.music.play('menu');});await waitStatus(f,'playing');
    assert.equal(await active(f),1);report.checks.push('Failed loading is silent and can be retried');await fc.close();

    const {page:m,context:mc}=await newPage({muted:true});let mutedDownloads=0;
    m.on('request',r=>{if(r.url().includes('break-of-dawn-v1.mp3'))mutedDownloads++;});
    await m.goto(base,{waitUntil:'networkidle'});await m.locator('.app-brand').click();
    assert.equal(await active(m),0);assert.equal(mutedDownloads,0);
    await m.locator('#settings-open').click();await m.locator('#setting-music').check();
    await waitStatus(m,'playing');assert.equal(await active(m),1);
    report.checks.push('Saved music-off preference prevents playback/download until re-enabled');await mc.close();
    assert.deepEqual(report.errors,[]);report.passed=true;
  }catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
  finally{if(browser)await browser.close();fs.writeFileSync(path.join(output,'browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
