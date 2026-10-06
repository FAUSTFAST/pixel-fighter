// 双操作体系的共同招式与连段规则。原创招式和数值，参考 SF6 的输入与取消层级。
(function(){
  const normals=['light','medium','heavy','lightKick','mediumKick','heavyKick','lowKick','lowMediumKick','sweep'];
  const specials=['special','uppercut','rush','tech','skill'];
  const supers=['super1','super2','super'];
  const base={startup:9,active:4,recovery:22,dmg:16,reach:65,hw:50,hh:55,hy:-40,kb:4,hitstun:28,blockstun:13,type:'special',meterGain:15,cost:0,groundOnly:true,pose:'special',category:'special',cancelSuper:3};
  const move=(name,detail,cfg)=>({...base,name,detail,...cfg});
  const profiles={
    ryu:{target:{medium:['heavy']},modern:['light','medium','heavy'],
      names:['岚切肘','旋身中段踢'],
      moves:{
        special:move('回旋风镖','回旋手里剑先前飞再折返；轻版起手快，重版射程远。',{startup:11,projectile:true,projShape:'shuriken',projPath:'return',projSpeed:8,projLife:95,dmg:14,pose:'weaponThrow'}),
        uppercut:move('双岚升击','两段对空；OD 版起手无敌，落空有长破绽。',{startup:5,active:12,recovery:27,dmg:10,hitFrames:[5,11],launch:true,knockdown:true,hh:95,hy:-60,pose:'uppercut'}),
        rush:move('贴地风牙','贴地滑踢打下段，可作为连段收尾。',{startup:9,active:8,recovery:22,dmg:15,level:'low',rushSpeed:7,knockdown:true,pose:'lowKick'}),
        tech:move('螺旋裂风掌','三段贴身掌击，最后一掌可取消三级超必杀。',{startup:7,active:17,recovery:19,dmg:6,kb:.8,hitFrames:[7,13,19],rushSpeed:2.8,pose:'rush'}),
        skill:move('斜空双镖','两枚向上抛出的风镖，适合封锁跳跃。',{startup:15,active:10,shots:[15,22],projectile:true,projShape:'shuriken',projPath:'arc',projVy:-6,projGravity:.16,projSpeed:6,dmg:9,pose:'weaponThrow'}),
        super1:move('岚牙穿云','一级：两枚贯穿风刃，适合普通技确认收尾。',{startup:6,active:12,projectile:true,shots:[6,13],dmg:14,projSpeed:13,projShape:'spear'}),
        super2:move('暴风结界','二级：四段近身风阵，连续封锁身前空间。',{startup:7,active:25,dmg:11,hitFrames:[7,14,21,28],hw:95,hh:110,hy:-52,kb:1,finalKb:12,pose:'heavy'}),
        super:move('极天风神','三级：五连风刃终结，最后一枚击倒。',{startup:6,active:33,projectile:true,shots:[6,13,20,27,34],projSpeed:12,dmg:13,projShape:'shuriken',knockdown:true,pose:'weaponThrow'})},
      assist:{light:['light','light','special'],medium:['medium','heavy',{kind:'tech',od:true},'super1'],heavy:['heavy','driveRush','medium','heavy',{kind:'tech',od:true},'super']}},
    mei:{target:{light:['medium'],medium:['mediumKick']},modern:['light','medium','heavyKick'],names:['绯燕肘','燕舞连踢'],
      moves:{
        special:move('蝶影穿心','三段前冲掌击，命中后可接三级超必杀。',{startup:8,active:16,recovery:18,hitFrames:[8,14,20],dmg:6,kb:.6,rushSpeed:3.8,pose:'rush'}),
        uppercut:move('飞花升膝','升膝对空；OD 版无敌并增加受击硬直。',{startup:5,active:10,recovery:26,dmg:17,launch:true,knockdown:true,hh:90,hy:-58,pose:'uppercut'}),
        rush:move('燕掠踏肩','突进中段踢，可击破蹲防，起手较慢。',{startup:18,active:6,recovery:23,dmg:18,level:'overhead',rushSpeed:6,pose:'heavyKick'}),
        tech:move('绯刃双环','前后错开的两枚弧线飞刃，牵制不同高度。',{startup:12,active:12,shots:[12,20],projectile:true,projShape:'blade',projPath:'arc',projVy:-4,projGravity:.13,projSpeed:7,dmg:8,pose:'weaponThrow'}),
        skill:move('回燕三连踢','近身三连踢，末段击倒，适合连段终结。',{startup:6,active:18,recovery:23,dmg:7,hitFrames:[6,12,18],knockdown:true,kb:.6,finalKb:9,pose:'heavyKick'}),
        super1:move('绯月追影','一级：三段短突进，可由普通技取消。',{startup:5,active:18,dmg:10,hitFrames:[5,11,17],rushSpeed:4,kb:.5,pose:'rush'}),
        super2:move('百花旋舞','二级：五段回旋踢，长持续压制。',{startup:7,active:29,dmg:10,hitFrames:[7,13,19,25,31],kb:.5,rushSpeed:2.5,pose:'heavyKick'}),
        super:move('红莲蝶葬','三级：六段高速穿击，末段击飞。',{startup:5,active:34,dmg:12,hitFrames:[5,11,17,23,29,35],kb:.4,finalKb:14,rushSpeed:4,knockdown:true,pose:'rush'})},
      assist:{light:['light','medium','skill'],medium:['medium','mediumKick',{kind:'special',od:true},'super1'],heavy:['heavyKick','driveRush','light','medium',{kind:'special',od:true},'super']}},
    tank:{target:{medium:['heavy']},modern:['light','medium','heavy'],names:['铁壁肘','破城膝'],
      moves:{
        special:move('地裂震拳','沿地面推进的冲击波，需蹲防。',{startup:17,projectile:true,projGround:true,projShape:'flame',projSpeed:5,level:'low',dmg:19,projRadius:16,pose:'heavy'}),
        uppercut:move('拔岳上勾','近身对空；起手一段霸体，可被投技破解。',{startup:8,active:8,recovery:29,dmg:22,armor:1,armorUntil:14,hh:95,hy:-58,knockdown:true,pose:'uppercut'}),
        rush:move('岩肩霸进','慢起手、两段霸体的肩撞；挥空后破绽很大。',{startup:16,active:12,recovery:29,dmg:23,armor:2,armorUntil:25,rushSpeed:5,pose:'rush'}),
        tech:move('锁岳投','近身指令投，不可格挡或拆投；不能抓硬直中的对手。',{startup:6,active:3,recovery:38,dmg:28,reach:2,hw:72,hh:80,hy:-40,grab:true,knockdown:true,pose:'throw'}),
        skill:move('碎城铁锤','蓄势砸下的中段重击，命中造成长硬直。',{startup:22,active:5,recovery:28,dmg:25,hitstun:42,level:'overhead',armor:1,armorUntil:16,pose:'heavy'}),
        super1:move('撼地怒潮','一级：高速地面震波，需蹲防。',{startup:8,projectile:true,projGround:true,projSpeed:10,projShape:'flame',projRadius:28,level:'low',dmg:29,knockdown:true,pose:'heavy'}),
        super2:move('钢壁破城','二级：三段霸体冲撞，适合重拳确认。',{startup:7,active:22,dmg:16,hitFrames:[7,15,23],kb:1,rushSpeed:5,armor:2,armorUntil:28,pose:'rush'}),
        super:move('巨岳断层摔','三级：高伤指令投；只抓自由站地对手，不能连段取消。',{startup:5,active:4,recovery:45,dmg:60,reach:4,hw:84,hh:80,hy:-40,grab:true,knockdown:true,pose:'throw'})},
      assist:{light:['light','light','special'],medium:['medium','heavy',{kind:'rush',od:true},'super1'],heavy:['heavy','driveRush','medium','heavy',{kind:'rush',od:true},'super2']}},
    volt:{target:{light:['mediumKick'],medium:['heavy']},modern:['light','mediumKick','heavy'],names:['磁暴肘','闪电中踢'],
      moves:{
        special:move('脉冲雷核','上下摆动的雷核，用轨迹变化牵制跳跃。',{startup:10,projectile:true,projPath:'wave',projShape:'electric',projAmplitude:42,projSpeed:8,dmg:14}),
        uppercut:move('逆雷升踢','快速升踢；OD 版起手无敌，落空不安全。',{startup:4,active:10,recovery:28,dmg:17,launch:true,hh:95,hy:-60,knockdown:true,pose:'uppercut'}),
        rush:move('闪隙突刺','高速长距离突刺，近距离命中可取消超必杀。',{startup:6,active:8,recovery:24,dmg:16,rushSpeed:10,reach:75,pose:'rush'}),
        tech:move('贯星电枪','高速细长雷枪；支持后蓄前拳输入。',{startup:8,projectile:true,projShape:'spear',projSpeed:15,projRadius:10,dmg:17}),
        skill:move('雷域陷阱','在身前布雷，18 帧后激活，延迟封锁地面。',{startup:13,projectile:true,projShape:'electric',projSpeed:0,projLife:140,armFrames:18,projRadius:26,dmg:17,hitstun:35}),
        super1:move('电光穿梭','一级：两段高速突刺，确认连段收尾。',{startup:4,active:13,dmg:15,hitFrames:[4,11],rushSpeed:9,kb:1,pose:'rush'}),
        super2:move('雷网封域','二级：三枚摆动电核覆盖前方。',{startup:8,active:21,dmg:17,projectile:true,shots:[8,16,24],projPath:'wave',projShape:'electric',projSpeed:9,projAmplitude:55}),
        super:move('零距雷狱','三级：五段疾速雷刺，末段击倒。',{startup:4,active:30,dmg:14,hitFrames:[4,11,18,25,31],kb:.5,rushSpeed:7,knockdown:true,pose:'rush'})},
      assist:{light:['light','mediumKick','rush'],medium:['mediumKick','driveRush','medium',{kind:'rush',od:true},'super1'],heavy:['heavy','driveRush','medium','heavy',{kind:'rush',od:true},'super']}},
    kaze:{target:{medium:['heavyKick']},modern:['light','medium','heavyKick'],names:['流月刀柄击','横云中踢'],
      moves:{
        special:move('弦月剑气','宽幅月牙剑气，速度较慢，适合占据中距离。',{startup:15,projectile:true,projShape:'crescent',projSpeed:6,projRadius:26,dmg:17}),
        uppercut:move('逆月挑斩','宽判定对空斩，OD 版起手无敌。',{startup:6,active:8,recovery:29,dmg:20,reach:88,hw:65,hh:98,hy:-58,launch:true,knockdown:true,pose:'uppercut'}),
        rush:move('踏影拔刀','前冲后拔刀横切，适合中距离确认。',{startup:10,active:7,recovery:22,dmg:19,reach:95,hw:70,rushSpeed:6,pose:'rush'}),
        tech:move('月轮二段斩','两段远距离剑斩，可取消三级超必杀。',{startup:9,active:13,recovery:24,dmg:10,hitFrames:[9,17],reach:105,hw:83,kb:1,pose:'heavy'}),
        skill:move('镜刃返式','第 3–18 帧反击近身打击；投技、飞行道具可破解。',{startup:19,active:6,recovery:25,dmg:27,reach:92,hw:90,counter:true,pose:'block'}),
        super1:move('一闪残月','一级：远距离瞬斩，普通技确认收尾。',{startup:5,active:6,dmg:29,reach:128,hw:110,hh:80,hy:-45,pose:'heavy'}),
        super2:move('月影千叠','二级：四段剑气斩，可从 OD 必杀取消。',{startup:6,active:25,dmg:12,hitFrames:[6,13,20,27],reach:110,hw:96,kb:.4,pose:'heavy'}),
        super:move('天外一剑','三级：三段大范围断空斩，末段击倒。',{startup:7,active:23,dmg:21,hitFrames:[7,16,25],reach:126,hw:115,hh:125,hy:-58,kb:.5,knockdown:true,pose:'heavy'})},
      assist:{light:['light','light','rush'],medium:['medium','heavyKick',{kind:'tech',od:true},'super1'],heavy:['heavyKick','driveRush','medium','heavyKick',{kind:'tech',od:true},'super']}},
    sage:{target:{light:['medium'],medium:['heavy']},modern:['light','medium','heavy'],names:['炽纹掌','烬火中踢'],
      moves:{
        special:move('余烬火种','抛物线火种，落地反弹一次，命中击倒。',{startup:17,projectile:true,projShape:'flame',projPath:'arc',projVy:-3,projGravity:.08,projBounce:true,projSpeed:4,dmg:18,knockdown:true}),
        uppercut:move('焚天火环','身前高位火环对空；OD 版无敌。',{startup:7,active:9,recovery:27,dmg:20,reach:60,hw:70,hh:140,hy:-70,knockdown:true,effect:'pillar',pose:'uppercut'}),
        rush:move('地走炎蛇','沿地面疾走的火焰，需要蹲防。',{startup:13,projectile:true,projGround:true,projShape:'flame',projSpeed:9,projRadius:18,level:'low',dmg:16}),
        tech:move('延时焰印','身前布置焰印，24 帧后爆发；用于压起身。',{startup:18,projectile:true,projShape:'flame',projSpeed:0,projRadius:32,projLife:100,armFrames:24,dmg:21,hitstun:36}),
        skill:move('地脉喷涌','延迟炎柱封锁中距离，近身有盲区。',{startup:21,active:9,recovery:25,dmg:24,reach:154,hw:75,hh:145,hy:-70,effect:'pillar'}),
        super1:move('赤炎贯门','一级：快速双火弹，可用于近身确认。',{startup:6,active:10,dmg:15,projectile:true,shots:[6,12],projShape:'flame',projSpeed:11}),
        super2:move('八方焰阵','二级：三段宽幅炎柱，封锁身前地面。',{startup:9,active:23,dmg:16,hitFrames:[9,18,27],reach:110,hw:125,hh:150,hy:-72,kb:.5,effect:'pillar'}),
        super:move('终焉日轮','三级：四重炎柱爆发，末段击倒。',{startup:10,active:31,dmg:17,hitFrames:[10,19,28,37],reach:118,hw:150,hh:160,hy:-75,kb:.4,knockdown:true,effect:'pillar'})},
      assist:{light:['light','medium','rush'],medium:['medium','heavy',{kind:'uppercut',od:true},'super1'],heavy:['heavy','driveRush','medium','heavy',{kind:'uppercut',od:true},'super']}}
  };
  for(const c of CHARACTERS){
    const p=profiles[c.id];
    for(const route of Object.values(p.assist))if(route.some(e=>e.od)&&route.at(-1)==='super1')route[route.length-1]='super2';
    c.targetCombos=p.target;c.assistCombos=p.assist;c.modernNormals=p.modern;
    c.moves.medium={...c.moves.heavy,name:p.names[0],startup:c.id==='tank'?8:6,active:3,recovery:10,dmg:9,hitstun:22,blockstun:11,kb:2,reach:c.moves.heavy.reach,pose:'heavy'};
    c.moves.mediumKick={...c.moves.heavyKick,name:p.names[1],startup:c.id==='tank'?9:7,active:3,recovery:13,dmg:10,hitstun:23,blockstun:12,kb:3,pose:'heavyKick'};
    c.moves.lowMediumKick={...c.moves.mediumKick,name:'下段'+p.names[1],level:'low',pose:'lowKick',hy:-15,hh:20};
    Object.assign(c.moves,p.moves);
    for(const k of normals){
      const m=c.moves[k];m.category='normal';m.cost=0;m.cancellable=k!=='sweep';m.cancelInto=p.target[k]||[];m.meterGain=14;m.groundOnly=false;
      m.pose=m.pose||(['light','heavy'].includes(k)?k:'heavy');
      if(k==='light'||k==='lightKick'||k==='lowKick'){m.hitstun=17;m.blockstun=9;m.kb=1.8;m.recovery=7;}
      if(k==='heavy'||k==='heavyKick'){m.hitstun=30;m.blockstun=16;m.kb=3;m.recovery=18;}
      m.command={light:'轻拳',medium:'中拳',heavy:'重拳',lightKick:'轻脚',mediumKick:'中脚',heavyKick:'重脚',lowKick:'↓ + 轻脚',lowMediumKick:'↓ + 中脚',sweep:'↓ + 重脚'}[k];
      m.detail=k==='sweep'?'下段击倒，不可取消。':`可取消必杀 / 超必杀 / 斗气冲刺${m.cancelInto.length?'；目标连段：'+m.cancelInto.map(n=>c.moves[n].name).join(' / '):''}。`;
    }
    for(const k of specials){
      const m=c.moves[k];m.effect=m.effect||c.moves.super.effect||{ryu:'wind',mei:'petal',tank:'impact',volt:'electric',kaze:'slash',sage:'flame'}[c.id];m.projColor=c.fxColor;
      m.command={special:'↓↘→ + 拳',uppercut:'→↓↘ + 拳',rush:'↓↘→ + 脚',tech:'↓↙← + 拳',skill:'↓↙← + 脚'}[k]+(c.id==='volt'&&k==='tech'?' / ←蓄→ + 拳':'');
      if(c.id==='tank'&&k==='tech')m.command+=' / →↘↓↙← + 拳';
    }
    supers.forEach((k,i)=>Object.assign(c.moves[k],{category:'super',cost:(i+1)*100,saLevel:i+1,meterGain:0,cancelSuper:0,invincible:k==='super'?12:5,command:['↓↘→↓↘→ + 拳','↓↙←↓↙← + 拳','↓↘→↓↘→ + 脚'][i],effect:c.moves.special.effect,projColor:c.fxColor}));
    c.moves.throw.command='轻拳＋轻脚 / 投键';c.moves.throw.category='throw';
    c.moves.driveRush=move('斗气冲刺','自由状态消耗 1 格；普通技接触后取消消耗 3 格。下一普通技 +4 帧硬直。',{category:'drive',startup:1,active:14,recovery:0,noHit:true,moveSpeed:9,pose:'rush',effect:'drive',cancellable:false,meterGain:0});
    c.moves.impact=move('斗气迸放','消耗 1 格，两段霸体，投技可破；慢起手重击。',{category:'drive',startup:26,active:3,recovery:30,dmg:22,armor:2,armorUntil:28,hitstun:55,reach:78,hw:65,kb:1,pose:'heavy',effect:'drive',driveCost:1,meterGain:0});
    c.moves.driveRush.command='→→（招架中 / 普通技接触后）或冲刺键';c.moves.impact.command='重拳＋重脚 / 迸放键';
    c.plan={ryu:'回旋风镖控场，中拳→重拳确认螺旋掌；双岚升击对空。',mei:'轻拳→中拳→中脚压制，OD 蝶影接超必杀；中段踏肩破解蹲防。',tank:'地裂震拳逼近，霸体肩撞抢回合；指令投抓防守，三级投不用于连段。',volt:'雷枪蓄力牵制，地雷封路；闪隙突刺与斗气冲刺快速确认。',kaze:'长剑中距离截击，中拳→重脚接二段斩；镜刃读近身出手。',sage:'火种、焰印与炎柱延迟控场；近身用中重掌确认火环或炎蛇。'}[c.id];
  }
  window.CombatRules={normals,specials,supers,isNormal:k=>normals.includes(k),isSpecial:k=>specials.includes(k),isSuper:k=>supers.includes(k)};
  window.ATTACK_STATES=[...normals,'throw',...specials,...supers,'driveRush','impact'];
})();
