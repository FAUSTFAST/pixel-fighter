// Combat endpoints and small root travel retained for fixed PNG presentation.
// Sprite coordinates are local; one local pixel is 4.2 world pixels.
(function(){
  const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>(t=clamp(t))*t*(3-2*t);
  function curve(keys,p){let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;const a=keys[i],b=keys[i+1];return a[1]+(b[1]-a[1])*smooth((p-a[0])/(b[0]-a[0]));}
  function phase(m,t){
    if(t<m.startup)return .32*t/m.startup;
    if(t<m.startup+m.active)return .32+.26*(t-m.startup)/Math.max(1,m.active-1);
    return .59+.41*(t-m.startup-m.active)/Math.max(1,m.recovery);
  }
  // Keep the established combat endpoints while the body around them is
  // re-animated. Changing presentation must not break confirmed combo routes.
  function contactPose(m,p,air){
    const profile=m.physicalContact;if(!profile)return null;
    const clip=air?(profile.kick?'airKick':'airPunch'):profile.clip,points=window.STRIKE_ART?.[profile.id]?.[clip];
    if(!points)return null;
    const index=points.length===8?(['jab','heavy'].includes(clip)||p<.49?3:4):1;
    const q=Math.round(clamp(p)*59)/59,w=/heavy|sweep/i.test(profile.kind)?1.5:/light/i.test(profile.kind)?.55:1;
    const hip=air?0:curve([[0,0],[.13,-.65],[.26,.8],[.32,1.2],[.58,1.05],[.72,.15],[1,0]],q)*w;
    const shoulder=air?0:curve([[0,0],[.16,-1.15],[.27,-.4],[.32,1.8],[.58,1.35],[.72,-.2],[1,0]],q)*w;
    const [x,y]=points[index],r=row(y,{hip,shoulder});
    return {clip,index,target:[x*r.scale+r.shift,y],anchor:points[air?index:points.length===8?3:1]};
  }
  function row(y,rig){
    const shift=y<=-46?rig.shoulder*.5:y<-36?rig.shoulder*(1-.5*smooth((-36-y)/10)):y<-23?rig.hip+(rig.shoulder-rig.hip)*smooth((-23-y)/13):rig.hip*smooth(-y/23);
    const scale=1+rig.shoulder*.012*smooth((-y-20)/15);
    return {shift:Math.round(shift*2)/2,scale};
  }
  function contact(m,t=m.startup,air=false){
    if(!m.physicalContact)return null;
    const pose=contactPose(m,phase(m,t),air);if(!pose)return null;
    return {x:(pose.target[0]+.5)*4.2,y:pose.target[1]*4.2,clip:pose.clip,index:pose.index};
  }
  function stepAt(m,t){
    if(!m.stepDistance)return 0;
    const start=Math.max(0,m.startup-4),end=m.startup+m.active+Math.min(4,m.recovery);
    return m.stepDistance*smooth((t-start)/(end-start));
  }
  window.StrikeMotion={phase,contact,stepAt};
})();
