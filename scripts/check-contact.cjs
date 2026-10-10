// Validate visible contact against independently rasterized production sprites.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
const {harness}=require('./gameplay-harness.cjs');
const neutral=()=>({move:0,up:false,down:false,block:false});
const contract=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/art-restoration/contact-contract.json')));
const preservedHits=new Set(contract.hits.map(c=>JSON.stringify(c)));
function pixels(f,box,art){
 const c=createCanvas(Math.ceil(box.w)+6,Math.ceil(box.h)+6),x=c.getContext('2d');
 x.translate(f.x-Math.floor(box.x)+3,f.y-Math.floor(box.y)+3);x.scale(f.facing*4.2,4.2);art.draw(x,f.def,f.sampleAnimation().animation);
 return c.getContext('2d').getImageData(0,0,c.width,c.height);
}
function renderedContact(a,b,box,art){
 const one=pixels(a,box,art),two=pixels(b,box,art),w=one.width;
 for(let y=0;y<one.height;y++)for(let x=1;x<w-1;x++)if(one.data[(y*w+x)*4+3]>96)
  for(const dx of [-1,0,1])if(two.data[(y*w+x+dx)*4+3]>96)return true;
 return false;
}
(async()=>{
 const native=nativeHarness();await native.s.DrawnAnimation.loading;const art=native.s.DrawnAnimation;
 assert.equal(art.status,'ready');const h=harness(53);h.s.DrawnAnimation=art;h.s.CombatControls.collect=(f,intent)=>intent;h.s.CombatControls.read=neutral;
 const summary=[];let matches=0,hits=0,whiffs=0,preserved=0,additional=0;
 for(let character=0;character<6;character++)for(const kind of h.s.CombatRules.normals)for(const facing of [1,-1])for(const airborne of [false,true])for(const distance of [68,95,125,160,200,300]){
  const g=h.fight(character,.85,distance);g.pve=false;g.training=true;
  g.f1=new h.s.Fighter(h.s.CHARACTERS[character],400,facing,'P1');g.f2=new h.s.Fighter(h.s.CHARACTERS[(character+1)%6],400+facing*distance,-facing,'P2');
  g.f1.foe=g.f2;g.f2.foe=g.f1;const a=g.f1,b=g.f2;let count=0;
  if(airborne){for(const f of [a,b]){f.onGround=false;f.y=h.s.FIGHT_GROUND-70;f.vy=0;}};
  const take=b.takeHit.bind(b);b.takeHit=(box,...args)=>{
   assert.ok(renderedContact(a,b,box,art),`${a.def.id}/${kind}/${facing}/${distance}: hit without visible contact`);
   count++;return take(box,...args);
  };
  assert.ok(Number.isFinite(a.y)&&Number.isFinite(b.y));
  assert.equal(a.startAttack(kind),true);const duration=a.attack.startup+a.attack.active+2;
  for(let frame=0;frame<duration+12;frame++)h.tick();
  assert.ok(count<=1,'one damage event per normal');if(distance===300)assert.equal(count,0,'out-of-range strikes always whiff');
  const wasHit=preservedHits.has(JSON.stringify([a.def.id,kind,facing,airborne,distance]));
  if(wasHit){assert.equal(count,1,`${a.def.id}/${kind}/${facing}/${distance}: lost checkpoint hit`);preserved++;}
  else if(count)additional++;
  if(count)hits++;else whiffs++;matches++;
  summary.push({character:a.def.id,kind,facing,airborne,distance,hits:count});
 }
 // Exact root travel, feet registration, stopped movement and cycle counts.
 let trajectories=0;
 for(const c of h.s.CHARACTERS)for(const kind of h.s.CombatRules.normals)for(const facing of [1,-1]){
  const f=new h.s.Fighter(c,400,facing,'P1');f.startAttack(kind);const m=f.attack,g={projectiles:[],effects:[]};
  for(let t=0;t<m.startup+m.active+m.recovery+1;t++)f.update(g);
  assert.ok(Math.abs((f.x-400)*facing-m.stepDistance)<1e-7,'root motion equals authored small step');trajectories++;
 }
 const manifest=require('./effective-animation-catalog.cjs').effectiveCatalog();
 for(const [id,clips] of Object.entries(manifest.characters))for(const name of ['walk','backwalk']){
  assert.equal(clips[name].cycleFrames,16);assert.equal(clips[name].authored,true);
  for(const meta of clips[name].frames){assert.equal(meta.ground%160,144);assert.equal(meta.root%192,96);}
 }
 const result={passed:true,matches,hits,whiffs,preservedHitCases:preserved,additionalVisibleHitCases:additional,trajectories,walkPoses:Object.values(manifest.characters).reduce((n,c)=>n+c.walk.frames.length+c.backwalk.frames.length,0)};
 fs.mkdirSync(path.join(root,'output/contact'),{recursive:true});fs.writeFileSync(path.join(root,'output/contact/check-results.json'),JSON.stringify({...result,cases:summary},null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
