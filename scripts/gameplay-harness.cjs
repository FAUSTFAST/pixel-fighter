// Shared sandbox for the production 60 Hz game loop.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function harness(seed=1,extras={}){
  let now=0,frame;const events={};
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const math=Object.create(Math);math.random=random;
  const ctx=extras.context||new Proxy({}, {get:(_,key)=>()=>key.includes('Gradient')?{addColorStop(){}}:undefined});
  const addEventListener=(type,fn)=>(events[type]??=[]).push(fn);
  const s={...extras.globals,console,Math:math,performance:{now:()=>now},addEventListener,
    document:{...extras.document,hidden:false,addEventListener,getElementById:()=>({getContext:()=>ctx})},requestAnimationFrame:fn=>{frame=fn;},
    Audio2:{sfx:new Proxy({}, {get:()=>()=>{}}),music:{play(){},stop(){}},isMusicOn:()=>false,isSfxOn:()=>false}};
  s.window=s;vm.createContext(s);
  for(const file of ['input','utils','characters','styles','stages','combat-rules','strike-art','strike-motion','combat-spacing',...(extras.art?['arcade-animation']:[]),'motion60','controls','fighter','ai','ui','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),s,{filename:file+'.js'});
  const g=s.GAME;
  function fight(index=0,diff=.85,distance=600){
    Object.assign(g,{scene:'fight',roundState:'fight',pve:true,paused:false,training:false,roundTime:99,hitstop:0,stage:s.STAGES[0],projectiles:[],effects:[]});
    g.f1=new s.Fighter(s.CHARACTERS[0],100,1,'P1');g.f2=new s.Fighter(s.CHARACTERS[index],100+distance,-1,'P2');
    g.f1.foe=g.f2;g.f2.foe=g.f1;g.f1.maxHp=g.f1.hp=10000;g.f2.maxHp=g.f2.hp=10000;
    g.ai=new s.AI(g.f2,diff);return g;
  }
  return {s,g,fight,tick(n=1,refreshRate=60){for(let i=0;i<n;i++){now+=1000/refreshRate;frame(now);}},key(k,down=true){for(const fn of events[down?'keydown':'keyup']||[])fn({key:k,preventDefault(){}});}};
}
module.exports={harness};
