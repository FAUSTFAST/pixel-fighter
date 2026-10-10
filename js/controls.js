(function(){
  const attacks=['light','medium','heavy','lightKick','mediumKick','heavyKick'];
  const label=k=>({' ':'空格',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[k]||k.toUpperCase());
  function describe(who){
    const k=Input.MAP[who],key=a=>label(k[a]);
    return Input.MODES[who]==='modern'
      ?`${who.toUpperCase()} 现代：${key('light')}/${key('medium')}/${key('heavy')} 轻中重 · ${key('special')} SP · ${key('assist')} 辅助 · ${key('throw')} 投`
      :`${who.toUpperCase()} 经典：${key('light')}/${key('medium')}/${key('heavy')} 拳 · ${key('lightKick')}/${key('mediumKick')}/${key('heavyKick')} 脚 · ${key('throw')} 投`;
  }
  function read(who,f){
    const m=Input.MAP[who],held=a=>Input.isDown(m[a]);
    const it={move:Number(held('right'))-Number(held('left')),up:Input.justPressed(m.up),down:held('down'),block:false,held:{},modern:Input.MODES[who]==='modern'};
    for(const a of [...attacks,'special','throw','assist','impact','parry','driveRush']){it[a]=Input.justPressed(m[a]);it.held[a]=held(a);}
    it.assisting=it.held.assist;
    const chord=(a,b)=>(it[a]||it[b])&&it.held[a]&&it.held[b];
    it.throw=it.throw||(!it.assisting&&chord('light',it.modern?'medium':'lightKick'));
    if(!it.modern)it.impact=it.impact||chord('heavy','heavyKick');
    it.parryPressed=it.parry||(!it.modern&&chord('medium','mediumKick'));
    it.parryHeld=it.held.parry||(!it.modern&&it.held.medium&&it.held.mediumKick);
    if(it.move===-f.facing&&!attacks.some(a=>it[a])&&!it.special&&!it.throw&&!it.up)it.block=true;
    if(it.throw||it.impact){it.parryHeld=false;it.parryPressed=false;}
    return it;
  }
  function motion(f,it,who){
    const punches=['light','medium','heavy'],kicks=['lightKick','mediumKick','heavyKick'];
    const punch=punches.some(k=>it[k]),kick=!it.modern&&kicks.some(k=>it[k]);
    if(!punch&&!kick)return null;
    const forward=['d','df','f'],back=['d','db','b'];
    const double=(name,seq)=>[{name,dirs:[...seq,...seq],window:44},{name,dirs:[...seq,seq[1],...seq],window:44}];
    const patterns=[...(punch?double(it.modern&&it.heavy?'super':'super1',forward):double('super',forward)),...(punch?double('super2',back):[]),
      ...(punch&&f.def.id==='tank'?[{name:'tech',dirs:['f','df','d','db','b'],window:32}]:[]),
      ...(punch?[{name:'uppercut',dirs:['f','d','df'],window:24},{name:'uppercut',dirs:['f','df','d'],window:24},{name:'uppercut',dirs:['df','d','df'],window:24}]:[]),
      {name:punch?'special':'rush',dirs:forward,window:26},{name:punch?'tech':'skill',dirs:back,window:26}];
    let kind=Input.checkMotion(who,f.facing,patterns);
    if(!kind&&punch&&f.def.id==='volt'&&Input.checkCharge(who,f.facing))kind='tech';
    if(!kind)return null;
    const family=punch?punches:kicks;
    return {kind,opts:{motion:true,strength:family.findLastIndex(k=>it[k])+1,od:!it.modern&&family.filter(k=>it.held[k]).length>=2}};
  }
  function collect(f,it,who){
    Input.recordMotion(who);
    if(!it.modern||!it.assisting){if(f.bufferedAttack?.opts.assist)f.bufferedAttack=null;f.assistRoute=null;}
    let request=null,claimed=false;
    if(it.throw){f.throwInputFrames=8;if(f.grabbedBy)f.grabbedBy.escapeThrow(window.GAME);else f.queueAttack('throw',{back:it.move===-f.facing});Input.clearMotions(who);}
    else if(it.impact){f.queueAttack('impact');claimed=true;}
    else if(it.driveRush||(f.attackContact&&f.attack?.category==='normal'&&it.parryPressed)||((it.parryHeld||f.attackContact&&f.attack?.category==='normal')&&Input.checkMotion(who,f.facing,[{name:'driveRush',dirs:['f','n','f'],window:20}]))){f.queueAttack('driveRush');it.parryHeld=false;claimed=true;Input.clearMotions(who);}
    else if(it.modern&&(it.special||it.heavy)&&it.held.special&&it.held.heavy){
      request={kind:it.down?'super':it.move===-f.facing?'super2':'super1',opts:{shortcut:true}};
    }else if(it.modern&&it.special){
      request={kind:it.down&&it.move===-f.facing?'skill':it.down?'tech':it.move===f.facing?'uppercut':it.move===-f.facing?'rush':'special',opts:{shortcut:true,od:it.assisting,strength:2}};
    }else if(it.modern&&it.assisting&&['light','medium','heavy'].some(k=>it[k])){
      claimed=true;
      f.queueAssist(['heavy','medium','light'].find(k=>it[k]));
    }else if(!it.parryHeld){
      request=motion(f,it,who);
      if(!request){
        const key=(it.modern?['heavy','medium','light']:['heavyKick','mediumKick','lightKick','heavy','medium','light']).find(k=>it[k]);
        if(key){
          let kind=it.modern?f.def.modernNormals[['light','medium','heavy'].indexOf(key)]:key;
          if(it.down)kind=({lightKick:'lowKick',mediumKick:'lowMediumKick',heavyKick:'sweep'})[kind]||kind;
          request={kind,opts:{}};
        }
      }
    }
    if(request){f.assistRoute=null;f.queueAttack(request.kind,request.opts);}
    const dash=Input.checkDoubleTap(who,f.facing);
    if(dash&&!claimed&&!request&&!it.throw&&!it.parryHeld&&!it.up&&!it.down)f.queueDash(dash);
    for(const key of [...attacks,'special','throw','impact','driveRush'])it[key]=false;
    // 交给角色处理移动 / 跳跃 / 招架，攻击已经进入同一预输入队列。
    return it;
  }
  window.CombatControls={read,collect,describe,label};
})();
