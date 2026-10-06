// 招式行为与出招表共用一份数据。方向始终相对面向。
(function(){
  const base={startup:9,active:8,recovery:20,dmg:16,reach:58,hw:44,hh:38,hy:-34,kb:6,hitstun:25,type:'special',meterGain:5,cost:0,groundOnly:true,pose:'special'};
  const move=(name,command,detail,cfg)=>Object.assign({},base,{name,command,detail},cfg);
  const styles={
    ryu:{style:'均衡 · 风术牵制',plan:'风刃逼迫跳跃，升龙对空；旋风掌近身连打，退步诱敌挥空。',color:'#68dbff',
      tech:move('旋风连掌','↓↙← + 拳','三段近身打击，末段击退。',{startup:7,active:19,recovery:19,dmg:7,kb:1,finalKb:9,hitstun:19,hitFrames:[7,13,19],rushSpeed:2.1,pose:'rush',effect:'wind'}),
      skill:move('风隐退步','↓↓ + 拳','向后撤离；起手短暂无敌，无攻击判定。',{startup:2,active:10,recovery:12,noHit:true,invincible:7,moveSpeed:-7,effect:'wind',pose:'block'}),
      super:move('天岚三连波','↓↘→↓↘→ + 拳','100 气：连续三枚高速风刃。',{cost:100,startup:8,active:19,recovery:24,projectile:true,shots:[8,15,22],dmg:16,kb:3,hitstun:26,projSpeed:10,projColor:'#68dbff',effect:'wind'}),names:['风刃','升风拳','疾风冲拳']},
    mei:{style:'压制 · 连段突进',plan:'用低后摇轻拳贴身，连舞命中后追接升龙；燕返躲开反击。',color:'#ff78b5',
      tech:move('绯影三连舞','↓↙← + 拳','三段突进；命中可取消接升龙或超必杀。',{startup:5,active:19,recovery:15,dmg:6,kb:.7,finalKb:2,hitstun:26,hitFrames:[5,11,17],rushSpeed:3.8,cancelInto:['uppercut','super'],pose:'rush',effect:'petal'}),
      skill:move('燕返','↓↓ + 拳','后撤闪避，前 6 帧无敌；收招可被追击。',{startup:2,active:9,recovery:10,noHit:true,invincible:6,moveSpeed:-8,pose:'jump',effect:'petal'}),
      super:move('绯红六连闪','↓↘→↓↘→ + 拳','100 气：六段高速压制，末段击飞。',{cost:100,startup:5,active:32,recovery:25,dmg:10,kb:.4,finalKb:12,hitstun:26,hitFrames:[5,11,17,23,29,35],rushSpeed:4,pose:'rush',effect:'petal'}),names:['绯影冲刺','飞燕升拳','追影步']},
    tank:{style:'力量 · 投技与霸体',plan:'逼近后用投技破站防；霸体冲拳扛一次打击，挥空后破绽很大。',color:'#ffb568',
      tech:move('铁锁抱摔','↓↙← + 拳 / →↘↓↙← + 拳','近身投：不可格挡；跳跃、无敌、受击硬直可躲。',{startup:6,active:3,recovery:34,dmg:29,reach:4,hw:72,hh:72,hy:-38,kb:12,hitstun:35,grab:true,pose:'heavy',effect:'impact'}),
      skill:move('钢躯冲拳','↓↓ + 拳','起手承受一次打击仍能出招；仍受伤，投技可破。',{startup:17,active:8,recovery:30,dmg:24,armor:1,armorUntil:24,rushSpeed:4.5,pose:'heavy',effect:'impact'}),
      super:move('崩山终结摔','↓↘→↓↘→ + 拳','100 气：近身强力投，挥空也消耗能量。',{cost:100,startup:5,active:4,recovery:42,dmg:52,reach:6,hw:80,hh:80,hy:-40,kb:16,hitstun:44,grab:true,pose:'heavy',effect:'impact'}),names:['崩山重拳','破空上勾','铁肩冲撞']},
    volt:{style:'速攻 · 蓄力与位移',plan:'后撤蓄力发雷枪，闪步抢位；速度快但生命低，避免硬拼。',color:'#a6faff',
      tech:move('贯穿雷枪','↓↙← + 拳 / ←蓄→ + 拳','快弹牵制；后方向蓄 0.5 秒也可释放。',{startup:6,active:3,recovery:17,projectile:true,projSpeed:13,dmg:14,projColor:'#a6faff',effect:'electric'}),
      skill:move('电光闪步','↓↓ + 拳','快速前移，起手 5 帧无敌，无攻击判定。',{startup:1,active:8,recovery:13,noHit:true,invincible:5,moveSpeed:10,pose:'rush',effect:'electric'}),
      super:move('雷霆四连刺','↓↘→↓↘→ + 拳','100 气：高速突刺四连击。',{cost:100,startup:4,active:25,recovery:24,dmg:13,kb:.6,finalKb:13,hitstun:24,hitFrames:[4,11,18,25],rushSpeed:6.5,pose:'rush',effect:'electric'}),names:['雷球','雷鸣升击','电光突刺']},
    kaze:{style:'剑术 · 距离与反击',plan:'利用剑距截击接近的敌人，读准近身出手用架势反击；反击不挡飞行道具。',color:'#c7b7ff',
      tech:move('月轮横斩','↓↙← + 拳','长距离横斩；起手慢，贴身被压时不宜乱用。',{startup:13,active:6,recovery:25,dmg:23,reach:104,hw:82,hh:44,hy:-39,kb:10,pose:'heavy',effect:'slash'}),
      skill:move('镜月架势','↓↓ + 拳','第 3–18 帧反击一次近身打击；投技和飞行道具可破。',{startup:19,active:6,recovery:25,dmg:27,reach:92,hw:92,counter:true,pose:'block',effect:'slash'}),
      super:move('三日月断空','↓↘→↓↘→ + 拳','100 气：三段远距离剑气斩。',{cost:100,startup:9,active:21,recovery:30,dmg:18,reach:110,hw:96,hh:65,hy:-43,kb:.5,finalKb:13,hitstun:28,hitFrames:[9,17,25],pose:'heavy',effect:'slash'}),names:['拔刀突斩','升月斩','流云突斩']},
    sage:{style:'术法 · 延迟控场',plan:'慢速火种压住前路，定点炎柱封锁中距离；起手长，需要提前布置。',color:'#ffa361',
      tech:move('追焰火种','↓↙← + 拳','慢速长寿命火球；最多同时保留两枚自己的飞行道具。',{startup:18,active:4,recovery:24,dmg:18,projectile:true,projSpeed:2.4,projLife:160,big:true,projColor:'#ff9955',effect:'flame'}),
      skill:move('地脉炎柱','↓↓ + 拳','在身前约 200 像素处爆发；有预兆，可近身打断。',{startup:24,active:10,recovery:26,dmg:24,reach:166,hw:60,hh:140,hy:-70,kb:8,effect:'pillar'}),
      super:move('炼狱三重门','↓↘→↓↘→ + 拳','100 气：三次宽范围炎柱爆发。',{cost:100,startup:18,active:27,recovery:32,dmg:19,reach:130,hw:150,hh:155,hy:-77,kb:.4,finalKb:10,hitstun:30,hitFrames:[18,28,38],effect:'pillar'}),names:['烈焰火球','炎龙升腾','烈焰冲击']}
  };
  for(const c of CHARACTERS){
    const s=styles[c.id];c.style=s.style;c.plan=s.plan;c.fxColor=s.color;c.desc=s.style+'。';
    Object.assign(c.moves,{tech:s.tech,skill:s.skill,super:s.super});c.moves.super.meterGain=0;
    ['special','uppercut','rush'].forEach((k,i)=>{c.moves[k].name=s.names[i];c.moves[k].pose=k;c.moves[k].effect=s.tech.effect;});
    Object.assign(c.moves.special,{command:'↓↘→ + 拳 / H或L',detail:'50 气全力版；搓招无气可放弱化版。'});
    Object.assign(c.moves.uppercut,{command:'→↓↘ + 重拳 / ↓+重拳',detail:'对空技，起手短暂无敌，落空收招长。'});
    Object.assign(c.moves.rush,{command:'→→ + 轻拳',detail:'向前冲击，用于接近或连招。'});
  }
  Object.assign(CHARACTERS[1].moves.light,{startup:2,recovery:5});
  Object.assign(CHARACTERS[1].moves.special,{active:19,dmg:8,kb:1,finalKb:8,hitFrames:[12,18,24]});
  Object.assign(CHARACTERS[2].moves.rush,{startup:11,dmg:20,armor:1,armorUntil:16,rushSpeed:4.8});
  Object.assign(CHARACTERS[3].moves.rush,{startup:3,rushSpeed:9,dmg:12});
  Object.assign(CHARACTERS[4].moves.uppercut,{reach:82,hw:58,startup:6});
  Object.assign(CHARACTERS[5].moves.special,{projSpeed:4.2,projLife:150});
  const normals={
    ryu:['忍拳','踏步肘','胫踢','疾风侧踢','回身肩投',4,9,7,13,65,8],
    mei:['绯影掌','转身肘','点踢','飞燕回旋踢','燕返绊投',3,7,6,12,72,6],
    tank:['拳王刺拳','碎岩摆拳','铁膝','破门蹬','钢躯抱摔',6,14,10,20,52,14],
    volt:['电光刺拳','雷鸣肘','闪踢','疾电长踢','电光绊摔',3,8,5,11,78,5],
    kaze:['刀柄击','拔刀横斩','截步膝','流云推踢','流云背摔',5,11,7,14,82,10],
    sage:['焰掌','爆炎掌','试探踢','焰纹蹬','封焰拘投',6,12,6,13,68,11]
  };
  for(const c of CHARACTERS){
    const [lp,hp,lk,hk,th,ls,hs,ld,hd,reach,recovery]=normals[c.id];
    Object.assign(c.moves.light,{name:lp,command:'轻拳 F / J',detail:'快速近身确认，可接重拳、重脚或指令技。',effect:c.id==='sage'?'flame':undefined});
    Object.assign(c.moves.heavy,{name:hp,command:'重拳 G / K',detail:'更强击退；命中可接指令技。',effect:c.id==='kaze'?'slash':c.id==='tank'?'impact':undefined});
    c.moves.lightKick=move(lk,'轻脚 V / U','比轻拳更长；命中可接重拳、重脚或指令技。',{startup:ls,active:4,recovery,dmg:ld,reach:reach-14,hw:30,hh:22,hy:-25,kb:3,hitstun:16,type:'light',pose:'lightKick',groundOnly:false,effect:undefined});
    c.moves.heavyKick=move(hk,'重脚 B / I','长距离牵制；挥空后收招较长。',{startup:hs,active:5,recovery:recovery+10,dmg:hd,reach,hw:40,hh:28,hy:-40,kb:8,hitstun:25,type:'heavy',pose:'heavyKick',groundOnly:false,effect:c.id==='volt'?'electric':undefined});
    c.moves.lowKick=move('下段'+lk,'↓ + 轻脚','下段需蹲防；可命中确认接重脚或指令技。',{startup:ls+1,active:4,recovery:recovery+2,dmg:ld,reach,hw:35,hh:18,hy:-12,kb:2,hitstun:17,type:'light',pose:'lowKick',level:'low'});
    c.moves.sweep=move('扫腿','↓ + 重脚','下段击倒；不能取消，挥空或被挡有明显破绽。',{startup:hs+3,active:5,recovery:recovery+20,dmg:hd,reach:reach+12,hw:45,hh:20,hy:-10,kb:7,hitstun:38,type:'heavy',pose:'lowKick',level:'low',knockdown:true});
    c.moves.throw=move(th,'轻拳+轻脚 / R或O','近身前投；按住后方向后投。被抓后7帧内同键拆投；跳跃可躲。',{startup:5,active:3,recovery:30,dmg:c.id==='tank'?23:17,reach:0,hw:c.id==='tank'?72:56,hh:65,hy:-38,kb:9,hitstun:40,type:'heavy',pose:'throw',grab:true,normalThrow:true,knockdown:true,throwStyle:c.id,effect:undefined});
  }
  Object.assign(CHARACTERS[0].moves.special,{name:'风遁手里剑',projShape:'shuriken',projPath:'straight',projSpeed:10,projRadius:12,detail:'直线高速手里剑；体积小，适合牵制，跳跃可躲。'});
  Object.assign(CHARACTERS[0].moves.super,{projShape:'shuriken',projPath:'straight'});
  Object.assign(CHARACTERS[1].moves.skill,{name:'绯燕飞刃',noHit:false,moveSpeed:0,invincible:0,projectile:true,startup:10,active:3,recovery:19,dmg:13,projShape:'blade',projPath:'arc',projVy:-5,projGravity:.13,projSpeed:7,projLife:75,projColor:'#ff78b5',pose:'special',detail:'弧线投掷飞刃，改变高低轨迹；近身起手可被打断。'});
  Object.assign(CHARACTERS[3].moves.special,{name:'跃动雷核',projShape:'electric',projPath:'wave',projAmplitude:38,projSpeed:8,detail:'雷核上下摆动前进；低血量速攻角色的变轨牵制。'});
  Object.assign(CHARACTERS[3].moves.tech,{projShape:'spear',projPath:'straight',projRadius:10});
  Object.assign(CHARACTERS[4].moves.special,{name:'残月剑气',projectile:true,rush:false,rushSpeed:0,projShape:'crescent',projPath:'straight',projSpeed:6.8,projRadius:23,projColor:'#c7b7ff',detail:'竖向月牙剑气，体积较大、速度中等；与长剑牵制配合。'});
  Object.assign(CHARACTERS[5].moves.special,{name:'坠焰火种',projShape:'flame',projPath:'arc',projVy:-3,projGravity:.08,projBounce:true,knockdown:true,detail:'慢速抛物线火种；落地反弹一次，命中击倒，起手较慢。'});
  Object.assign(CHARACTERS[5].moves.tech,{projShape:'flame',projPath:'straight'});
  const punchProfiles={ryu:[3,6,40,8,12,46],mei:[2,5,43,6,10,48],tank:[5,9,38,12,18,50],volt:[2,5,42,5,10,53],kaze:[4,7,62,10,14,88],sage:[5,8,56,11,14,70]};
  for(const c of CHARACTERS){
    const [ls,ld,lr,hs,hd,hr]=punchProfiles[c.id];
    Object.assign(c.moves.light,{startup:ls,dmg:ld,reach:lr});
    Object.assign(c.moves.heavy,{startup:hs,dmg:hd,reach:hr});
  }
  CHARACTERS[0].moves.special.pose='weaponThrow';
  CHARACTERS[0].moves.super.pose='weaponThrow';
  CHARACTERS[1].moves.skill.pose='weaponThrow';
  CHARACTERS[0].plan='高速手里剑牵制，侧踢控制距离；升风拳对空，旋风连掌近身确认。';
  CHARACTERS[1].plan='快速拳脚接连舞压制；弧线飞刃改变远程节奏，燕返绊投破解防守。';
  CHARACTERS[4].plan='刀柄与长剑截击，月牙剑气封路；架势反击近身打击。';
  window.ATTACK_STATES=['light','heavy','lightKick','heavyKick','lowKick','sweep','throw','special','uppercut','rush','tech','skill','super'];
})();
