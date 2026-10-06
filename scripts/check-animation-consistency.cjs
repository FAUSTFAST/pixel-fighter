// Focused metadata and animation-selection regression checks; no browser required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('assets/characters/animation-v7/manifest.json'));
const lock = JSON.parse(read('assets/characters/animation-v7/identity-lock.json'));
const context = vm.createContext({console, document: {}, __manifest: manifest});
context.window = context;
for (const file of ['utils', 'characters', 'styles', 'combat-rules', 'combat-spacing', 'motion60']) {
  vm.runInContext(read(`js/${file}.js`), context, {filename: `${file}.js`});
}
// Exercise the production selector with catalog metadata. PNG decoding is
// independently handled by the asset catalog; fake sprites avoid a DOM dependency.
const renderer = read('js/arcade-animation.js');
new vm.Script(renderer);
vm.runInContext(renderer.slice(0, renderer.indexOf('  const loading=fetch(')) + `
  for(const [id,clips] of Object.entries(__manifest.characters)){
    for(const clip of Object.values(clips))clip.sprites=clip.frames.map(()=>({}));
    ready.set(id,clips);
  }
  window.DrawnAnimation={selection};
})();`, context);
for (const file of ['fighter', 'game', 'motion-gallery']) new vm.Script(read(`js/${file}.js`));
const gameSource=read('js/game.js');
vm.runInContext(gameSource.slice(gameSource.indexOf('  function faceEachOther('),
  gameSource.indexOf('  // 检测本帧新进入的动作')),context);
const left={x:600,facing:1,onGround:false,state:'jump'};
const right={x:500,facing:-1,onGround:true,state:'idle'};
context.faceEachOther(left,right);
assert.equal(left.facing,1,'Crossing in the air must not mirror the jump pose');
left.onGround=true;left.state='idle';context.faceEachOther(left,right);
assert.equal(left.facing,-1,'Restore facing after landing');
let selections = 0;
for (const def of context.CHARACTERS) {
  const clips = manifest.characters[def.id];
  assert.equal(Object.keys(clips).length, 22);
  const approved = lock.characters[def.id];
  const stance = clips.idle;
  const base = stance.frames[0];
  const target = [(approved.standingHip[0]-base.root)*stance.scale,
    (approved.standingHip[1]-base.ground)*stance.scale];
  for (const name of ['jump', 'backjump', 'airPunch', 'airKick']) {
    const clip = clips[name];
    assert.equal(clip.scale, stance.scale);
    for (const f of clip.frames) {
      const hip = approved.sheets.air.hips[f.slot];
      assert.ok(Math.abs((hip[0]-f.root)*clip.scale-target[0]) < .002);
      assert.ok(Math.abs((hip[1]-f.ground)*clip.scale-target[1]) < .002);
    }
  }
  const names = ['idle','walk','backwalk','jump','backjump','airPunch','airKick','landing',
    'crouch','block','parry','ko','getup', ...Object.keys(def.moves),
    ...['head','body','heavy','low','slash','electric','burn','launch','air','sweep',
      'knockdown','throw','guard','guardLow'].map(n=>'react:'+n)];
  for (const name of names) for (let frame=0;frame<60;frame++) {
    const anim = context.Motion60.preview(def,name,frame);
    const selected = context.DrawnAnimation.selection(def,anim);
    assert.ok(selected, `${def.id}/${name}/${frame} missing`);
    assert.equal(selected.data.owner,def.id);
    assert.equal(selected.data.identity,approved.identity);
    assert.ok(Number.isInteger(selected.index)&&selected.index>=0&&selected.index<selected.count);
    if(name==='jump'||name==='backjump')assert.ok(selected.index>0,'Ground crouch during jump');
    if(name==='landing')assert.ok(selected.index<=1,'Deep squat on ordinary landing');
    selections++;
  }
  for (const [vy,expected] of [[-def.jump,1],[0,2],[def.jump*.8,3]]) {
    const anim=context.Motion60.sample(def,'jump',0,{air:true,vy,jumpDirection:1});
    assert.equal(context.DrawnAnimation.selection(def,anim).index,expected);
  }
  for(const name of context.CombatRules.normals){
    const m=def.moves[name];
    const anim=context.Motion60.sample(def,name,0,{attack:m,kind:name,
      attackT:m.startup,fighter:{onGround:false}});
    assert.match(context.DrawnAnimation.selection(def,anim).clip,/^air(Punch|Kick)$/);
  }
  const cast=context.DrawnAnimation.selection(def,{name:'special',attack:{projectile:true},phase:.4});
  assert.equal(cast.clip,'cast');assert.equal(cast.index,2);
  const airCast=context.DrawnAnimation.selection(def,{name:'special',attack:{projectile:true},airborne:true,phase:.4});
  assert.equal(airCast.clip,'airPunch');
}
console.log(JSON.stringify({characters:6,clips:132,selections,
  checks:['syntax','identity','aerial hip registration','jump phases','landing','air normals','projectile release'],
  result:'passed',limitation:'Does not verify browser rendering or image aesthetics.'}));
