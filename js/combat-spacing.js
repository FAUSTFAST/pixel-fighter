// 本作 960×540 战斗尺度下的距离配置；所有长度为世界像素，速度为像素 / 逻辑帧。
// 参考街霸式前进 / 后退、短拳 / 长脚和突进的分工，不使用未核实的 SF6 原始数值。
(function(){
  const movement={ryu:[2.55,1.9],mei:[2.9,2.2],tank:[2.1,1.55],volt:[3.1,2.35],kaze:[2.7,2.05],sage:[2.3,1.7]};
  const jumpTravel={ryu:4.37,mei:4.9875,tank:3.4675,volt:5.3675,kaze:4.655,sage:3.8475};
  // 普通冲刺：总帧数、位移帧数、距离。收招也算动作，不能提前出招。
  const dash={ryu:[19,13,136,23,15,108],mei:[17,12,148,21,14,116],tank:[22,15,118,26,17,92],volt:[16,11,158,20,13,124],kaze:[20,14,140,24,16,112],sage:[21,14,128,25,16,100]};
  const rushDistance={ryu:{rush:205,tech:155},mei:{special:230,rush:265,super1:250,super2:240,super:350},tank:{rush:220,super2:310},volt:{rush:300,super1:330,super:380},kaze:{rush:270}};
  for(const c of CHARACTERS){
    [c.walkForward,c.walkBackward]=movement[c.id];
    c.jumpTravel=jumpTravel[c.id];
    const [ff,fm,fd,bf,bm,bd]=dash[c.id];
    c.dashes={forward:{frames:ff,travelStart:0,travelEnd:fm,travelDistance:fd},back:{frames:bf,travelStart:0,travelEnd:bm,travelDistance:bd}};
    // One grounded step-and-follow cycle. Backward steps are shorter, not a
    // reversed forward run; actual travelled distance drives continuously sampled planted feet.
    c.stride=67.2;
    c.strideBackward=67.2;
    c.walkAcceleration=c.id==='tank'?.48:.65;
    for(const [kind,m] of Object.entries(c.moves)){
      m.animationFrames=60;
      if(m.category==='normal'){
        const kick=/Kick|sweep/.test(kind),low=m.level==='low';
        m.reach=Math.round(m.reach*(kick?1.26:1.32)+5);
        m.hw=Math.round(m.hw*1.16);
        // 与约 210 像素的角色身高对应：拳在胸口，低脚在小腿。
        m.hy=low?-15:kick?(kind==='lightKick'?-34:-53):-62;
        m.hh=low?20:kick?27:22;
        m.reaction=low?'low':kind==='light'?'head':kind==='medium'?'body':kind==='heavy'?'heavy':kind==='heavyKick'?'heavy':'body';
      }else if(m.grab){
        // 投技保留近身距离；增长打击范围不会把投技变为远程抓取。
        m.reaction='throw';
      }else if(!m.noHit){
        m.reach=Math.round((m.reach||65)*1.25+8);
        m.hw=Math.round((m.hw||50)*1.2);m.hh=Math.round((m.hh||55)*1.1);
        if(!m.projectile&&kind!=='uppercut'&&m.effect!=='pillar')m.hy=m.level==='low'?-18:-57;
        if(kind==='uppercut'){m.hy=-77;m.hh=Math.max(100,m.hh);}
        m.reaction=kind==='uppercut'?'launch':m.level==='low'?'low':m.effect==='slash'?'slash':m.effect==='electric'?'electric':m.effect==='flame'||m.effect==='pillar'?'burn':'heavy';
      }
      if(m.projectile){
        m.projRadius=Math.round((m.projRadius||(m.big?20:13))*1.23);
        m.projLife=Math.round((m.projLife||120)*1.16);
        if(m.projSpeed)m.projSpeed*=1.08;
        m.projReturnFrame=44;
        m.projOriginX=110;m.projOriginY=m.projGround?-24:-118;
        if(m.projSpeed===0)m.projOriginX=170;
      }
      if(m.rushSpeed){
        m.travelDistance=rushDistance[c.id]?.[kind]||Math.round(m.rushSpeed*m.active*1.9);
        m.travelStart=Math.max(1,m.startup-4);
        m.travelEnd=m.startup+m.active;
      }
      if(kind==='driveRush'){m.travelDistance=185;m.travelStart=1;m.travelEnd=15;m.moveSpeed=0;}
      if(m.category==='normal'){
        const kick=/Kick|sweep/.test(kind),clip=m.level==='low'?'lowKick':kick?'kick':kind==='light'?'jab':'heavy';
        m.physicalContact={id:c.id,kind,clip,kick};
        m.stepDistance={light:2.5,medium:6,heavy:10,lightKick:5,mediumKick:8,heavyKick:12,lowKick:3,lowMediumKick:6,sweep:9}[kind];
      }
    }
  }
  // 共享几何：判定框、动画终点、效果范围、出招表使用相同计算。
  function geometry(m,width=68,t=m.startup,air=false){
    const contact=window.StrikeMotion?.contact(m,t,air);
    if(contact){
      // A small envelope around the authored fist / toe / blade. The far edge
      // is the visible limb, never the old enlarged invisible reach rectangle.
      const w=56,h=m.level==='low'?26:30,far=contact.x;
      return {near:far-w,far,center:far-w/2,y:contact.y,w,h,physical:true};
    }
    const center=width/2+(m.reach||0),half=m.hw||0;
    return {near:center-half,far:center+half,center,y:(m.hy||0)*2,w:half*2,h:(m.hh||0)*2};
  }
  function travelAt(m,t){
    if(!m.travelDistance)return 0;
    const p=Math.max(0,Math.min(1,(t-m.travelStart)/Math.max(1,m.travelEnd-m.travelStart)));
    // 半余弦速度：蹬地加速 → 中段全速 → 落脚制动；积分精确等于配置距离。
    return m.travelDistance*(p-Math.sin(p*Math.PI*2)/(Math.PI*2));
  }
  function maxReach(m,width=68){
    if(!m.physicalContact)return geometry(m,width).far;
    let far=0;for(let t=m.startup;t<m.startup+m.active;t++)far=Math.max(far,geometry(m,width,t).far);
    return far;
  }
  window.CombatSpacing={geometry,travelAt,maxReach};
})();
