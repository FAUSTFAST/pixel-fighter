// Cached optical depth for the existing panoramas. Architecture and the
// fighting floor stay on one rigid plane; only weather has camera parallax.
(function(){
  const profiles={
    dojo:{x:710,y:150,rx:350,ry:210,blur:1.8,haze:'#9bbbd7'},
    city:{x:735,y:145,rx:245,ry:220,blur:2.0,haze:'#a296d8'},
    beach:{x:795,y:145,rx:410,ry:240,blur:1.6,haze:'#ffd29a'},
    volcano:{x:735,y:160,rx:330,ry:245,blur:1.8,haze:'#dc895f'},
    station:{x:730,y:130,rx:310,ry:235,blur:1.8,haze:'#91b8d4'},
    snow:{x:735,y:140,rx:365,ry:215,blur:1.6,haze:'#c5dcef'},
    garden:{x:740,y:135,rx:360,ry:225,blur:1.6,haze:'#efd8ae'}
  };
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function soften(ctx,source,radius){
    if(typeof ctx.filter==='string'){
      ctx.filter='blur('+radius+'px)';ctx.drawImage(source,0,0);ctx.filter='none';
      return 'canvas-filter';
    }
    // Canvas filter is optional in browsers. A cached smooth reduction keeps
    // the same depth effect available without filtering the fighters or floor.
    const factor=Math.max(2,Math.ceil(radius*2)),small=canvas(Math.ceil(source.width/factor),Math.ceil(source.height/factor));
    const c=small.getContext('2d');c.imageSmoothingEnabled=true;c.drawImage(source,0,0,small.width,small.height);
    ctx.imageSmoothingEnabled=true;ctx.drawImage(small,0,0,source.width,source.height);ctx.imageSmoothingEnabled=false;
    return 'smooth-downsample';
  }
  function prepare(id,panorama){
    const p=profiles[id];if(!p)return null;
    const far=canvas(panorama.width,panorama.height),ctx=far.getContext('2d');
    const optics=soften(ctx,panorama,p.blur);
    ctx.globalAlpha=.09;ctx.fillStyle=p.haze;ctx.fillRect(0,0,far.width,far.height);ctx.globalAlpha=1;
    // Soft elliptical focus mask: near side architecture and the entire combat
    // floor retain their original sharp pixels. Never translate image bands.
    const mask=canvas(far.width,far.height),m=mask.getContext('2d');
    m.save();m.translate(p.x,p.y);m.scale(p.rx,p.ry);
    const g=m.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'#fff');g.addColorStop(.48,'#fff');g.addColorStop(1,'#ffffff00');
    m.fillStyle=g;m.fillRect(-1,-1,2,2);m.restore();
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
    const foreground=canvas(far.width,far.height),f=foreground.getContext('2d');
    soften(f,panorama,.8);
    f.globalCompositeOperation='destination-in';
    const near=f.createLinearGradient(0,505,0,540);near.addColorStop(0,'#ffffff00');near.addColorStop(1,'#fff');
    f.fillStyle=near;f.fillRect(0,0,foreground.width,foreground.height);f.globalCompositeOperation='source-over';
    return {far,foreground,profile:p,optics};
  }
  function draw(ctx,layers,camera){
    if(!layers)return;
    ctx.save();ctx.imageSmoothingEnabled=false;
    const x=Math.round(240+camera);
    for(const layer of [layers.far,layers.foreground])ctx.drawImage(layer,x,0,960,540,0,0,960,540);
    ctx.restore();
  }
  function foreground(ctx){
    ctx.save();
    const edge=ctx.createLinearGradient(0,0,960,0);
    edge.addColorStop(0,'#04091330');edge.addColorStop(.16,'#04091300');edge.addColorStop(.84,'#04091300');edge.addColorStop(1,'#04091330');
    // No overlay on the central silhouettes, HUD or the contact area.
    ctx.fillStyle=edge;ctx.fillRect(0,110,960,430);
    const bottom=ctx.createLinearGradient(0,500,0,540);bottom.addColorStop(0,'#04091300');bottom.addColorStop(1,'#04091325');
    ctx.fillStyle=bottom;ctx.fillRect(0,500,960,40);ctx.restore();
  }
  window.StageDepth={prepare,draw,foreground,profiles};
})();
