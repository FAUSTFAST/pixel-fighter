// Actual game replay, identical input on both versions, original PNG art only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const baselineCommit='27da2e1a91f7d90086bc90ba8e7e0b632400a21a';
const sources={stages:execFileSync('git',['show',baselineCommit+':js/stages.js'],{cwd:root}).toString()};
const out=path.join(root,'output/neon-sign/replay');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();require('@napi-rs/canvas').GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','monospace');
(async()=>{
 const old=nativeHarness(91,true,sources),now=nativeHarness(91,false);await old.s.DrawnAnimation.loading;now.s.DrawnAnimation=old.s.DrawnAnimation;
 for(const h of [old,now]){const g=h.fight();g.pve=false;g.training=true;g.stage=h.s.STAGES[1];g.f1.x=350;g.f2.x=850;g.f1.hp=g.f1.maxHp=g.f2.hp=g.f2.maxHp=100;g.cameraX=0;h.s.Settings={values:{shake:false}};h.s.Input.clear();}
 const full=createCanvas(960,324),fc=full.getContext('2d'),detail=createCanvas(800,516),dc=detail.getContext('2d');let frames=0;
 for(let t=0;t<600;t++){
  for(const h of [old,now]){if(t===120)h.key('d');if(t===150)h.key('d',false);if(t===240)h.key('a');if(t===270)h.key('a',false);h.tick();}
  for(const who of ['f1','f2'])for(const field of ['x','y','state','drawnFrame','hp'])assert.equal(now.g[who][field],old.g[who][field]);
  if(t%6)continue;
  for(const [canvas,ctx] of [[full,fc],[detail,dc]]){ctx.fillStyle='#11182c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#d8cce9';ctx.font='18px "Fight CJK"';ctx.fillText('修改前',14,25);ctx.fillStyle='#9ee8ce';ctx.fillText('修改后 · 原画灯管呼吸 / 流光',canvas.width/2+14,25);ctx.imageSmoothingEnabled=false;}
  for(const [i,h] of [old,now].entries()){
   fc.drawImage(h.canvas,0,0,960,540,i*480,38,480,270);
   // Track the same building with the production camera; this is a native crop.
   const camera=Math.round(h.g.cameraX),sx=660-camera;
   dc.drawImage(h.canvas,sx,100,190,225,i*400+10,38,380,450);
  }
  dc.fillStyle='#b8bfd0';dc.font='14px "Fight CJK"';dc.fillText('原版游戏实际回放局部 · 建筑与招牌保持原画像素',14,506);
  fs.writeFileSync(path.join(out,'frames',String(frames++).padStart(3,'0')+'.png'),detail.toBuffer('image/png'));
  if(t===60){fs.writeFileSync(path.join(out,'comparison.png'),full.toBuffer('image/png'));fs.writeFileSync(path.join(out,'game-after.png'),now.canvas.toBuffer('image/png'));}
 }
 const result={passed:true,baselineCommit,gameFrames:600,replayFrames:frames,seconds:10,originalGameReplay:true,identicalKeyboardInput:true,charactersAndGameplayUnchanged:true};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
