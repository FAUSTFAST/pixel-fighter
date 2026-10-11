// Same real game and keyboard movement, all seven panoramas before / after.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const baselineCommit='17923fd97387b39d0da1f050894d0d626f5adf31';
const sources={stages:execFileSync('git',['show',baselineCommit+':js/stages.js'],{cwd:root}).toString()};
const out=path.join(root,'output/stage-depth/replay');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
require('@napi-rs/canvas').GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','monospace');
(async()=>{
 const old=nativeHarness(91,true,sources),current=nativeHarness(91,false);await old.s.DrawnAnimation.loading;current.s.DrawnAnimation=old.s.DrawnAnimation;
 const runs=[old,current],canvas=createCanvas(960,382),ctx=canvas.getContext('2d');let frameCount=0;
 for(let stage=0;stage<7;stage++){
  for(const h of runs){const g=h.fight();g.pve=false;g.stage=h.s.STAGES[stage];g.cameraX=0;g.f1.x=240;g.f2.x=620;h.s.Settings={values:{shake:false}};h.s.Input.clear();h.key('d');h.key('ArrowRight');}
  for(let t=0;t<72;t++){
   for(const h of runs){if(t===48){h.key('d',false);h.key('ArrowRight',false);}h.tick();}
   for(const who of ['f1','f2']){assert.equal(old.g[who].x,current.g[who].x);assert.equal(old.g[who].y,current.g[who].y);assert.equal(old.g[who].drawnFrame,current.g[who].drawnFrame);}
   if(t%2)continue;
   ctx.fillStyle='#101b2a';ctx.fillRect(0,0,960,382);ctx.fillStyle='#f6d8a0';ctx.font='bold 22px "Fight CJK"';ctx.fillText('地图景深 · '+current.g.stage.name,16,30);
   ctx.fillStyle='#bed3e5';ctx.font='14px "Fight CJK"';ctx.fillText('左：原版  /  右：远景轻度失焦、空气透视与环境视差 · 同一输入、角色和地图',16,55);
   for(const [i,h] of runs.entries()){ctx.drawImage(h.canvas,0,0,960,540,i*480,72,480,270);ctx.fillStyle=i?'#8ce2b6':'#c2d3e5';ctx.fillText(i?'景深开启 · 角色 / 战斗区域保持清晰':'原版完整全景',i*480+16,365);}
   fs.writeFileSync(path.join(out,'frames',String(frameCount++).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
   if(t===24)fs.writeFileSync(path.join(out,current.g.stage.id+'-game.png'),current.canvas.toBuffer('image/png'));
  }
 }
 const result={passed:true,baselineCommit,stages:7,gameFrames:504,replayFrames:frameCount,keyboardMovement:true,characterFramesAndPositionsUnchanged:true};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
