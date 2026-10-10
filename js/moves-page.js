(function(){
  window.renderMovesRoster=function(host){
    host.replaceChildren();
    const label=window.CombatControls?.label||((key)=>key.toUpperCase());
    const pair=action=>window.Input?[Input.MAP.p1[action],Input.MAP.p2[action]].map(label).join(' / '):'';
    const modernCommands={special:'SP',uppercut:'→ + SP',rush:'← + SP',tech:'↓ + SP',skill:'↙ + SP',super1:'SP + 重攻击',super2:'← + SP + 重攻击',super:'↓ + SP + 重攻击',throw:'轻 + 中 / 投键',driveRush:'斗气冲刺键',impact:'斗气迸放键'};
    for(const c of CHARACTERS){
      const section=document.createElement('section');
      const title=document.createElement('h2');title.textContent=c.name+' · '+c.style;section.appendChild(title);
      const plan=document.createElement('p');plan.textContent=c.plan;section.appendChild(plan);
      const routes=document.createElement('div');routes.className='combo-routes';
      for(const [button,route] of Object.entries(c.assistCombos)){
        const card=document.createElement('div');card.className='combo-route';
        const heading=document.createElement('strong');heading.textContent='辅助＋'+({light:'轻',medium:'中',heavy:'重'}[button])+' 连按：';
        const text=document.createElement('span');text.textContent=route.map(e=>{const k=typeof e==='string'?e:e.kind;return (e.od?'OD ':'')+c.moves[k].name;}).join(' → ');
        let drive=0,sa=0;route.forEach(e=>{const k=typeof e==='string'?e:e.kind;if(k==='driveRush')drive+=3;if(e.od)drive+=2;sa+=c.moves[k].cost||0;});
        const detail=document.createElement('small');detail.textContent='完整路线消耗 '+drive+' 格斗气 / '+sa+' SA；每按一次推进一招，挥空或资源不足会中断。';
        card.append(heading,text,detail);routes.appendChild(card);
      }
      section.appendChild(routes);
      const wrap=document.createElement('div');wrap.className='table';const table=document.createElement('table');
      const head=document.createElement('tr');for(const text of ['招式','经典输入','现代输入','资源','发生 / 持续 / 收招','命中 / 防御帧差','特点']){const th=document.createElement('th');th.textContent=text;head.appendChild(th);}table.appendChild(head);
      for(const kind of ['forward','back']){
        const d=c.dashes[kind],row=document.createElement('tr'),command=kind==='forward'?'→→（朝对手双击）':'←←（远离对手双击）';
        for(const text of [kind==='forward'?'普通前冲':'普通后撤步',command,command,'免费',`0 / ${d.travelEnd} / ${d.frames-d.travelEnd} F`,'—',`总 ${d.frames} F，位移 ${d.travelDistance} px；收招前不能出招 / 防御。`+(kind==='back'?'动作期间避投，打击与波仍可命中。':'遇敌 / 场边停止位移。')]){
          const td=document.createElement('td');td.textContent=text;row.appendChild(td);
        }
        table.appendChild(row);
      }
      for(const key of [...CombatRules.normals,'throw',...CombatRules.specials,...CombatRules.supers,'driveRush','impact']){
        const m=c.moves[key],row=document.createElement('tr');
        let command=m.command||({driveRush:'普通技接触后 →→ / 中拳+中脚；自由时招架→→',impact:'重拳 + 重脚'})[key]||'';
        if(window.Input&&['light','medium','heavy','lightKick','mediumKick','heavyKick'].includes(key))command+=' ('+pair(key)+')';
        let modern=modernCommands[key];
        if(!modern){const crouch={lowKick:'lightKick',lowMediumKick:'mediumKick',sweep:'heavyKick'}[key],index=c.modernNormals.indexOf(crouch||key);modern=index<0?'辅助路线 / 经典专用':(crouch?'↓ + ':'')+['轻攻击','中攻击','重攻击'][index];}
        let resource=m.cost?'SA '+m.cost/100+'（'+m.cost+'）':CombatRules.isSpecial(key)?'免费 / OD 2 格':key==='driveRush'?'1 / 3 格斗气':key==='impact'?'1 格斗气':'免费';
        const signed=n=>(n>=0?'+':'')+n+'F';
        const frames=`${m.startup} / ${m.active} / ${m.recovery} F`;
        const contact=m.hitFrames?.at(-1)??m.startup;
        const advantage=m.noHit||m.grab?'—':m.projectile?'随距离变化':m.knockdown?'击倒 / '+signed(CombatRules.advantage(m,true,contact)):
          signed(CombatRules.advantage(m,false,contact))+' / '+signed(CombatRules.advantage(m,true,contact));
        const preparation=m.category==='special'?`起手：轻 ${m.startup-(key==='uppercut'?1:2)} / 中 ${m.startup} / 重 ${m.startup+2} F；OD 沿用对应强度。`:`起手约 ${Math.round(m.startup*1000/60)} ms。`;
        for(const text of [m.name,command,modern,resource,frames,advantage,(m.noHit?'':preparation)+(m.detail||'')+(window.CombatSpacing&&!m.projectile&&!m.noHit?' 最远打击 '+Math.round(CombatSpacing.maxReach(m))+' px。':'')+(m.stepDistance?' 蹬步 '+m.stepDistance+' px，拳脚需实际接触。':'')+(m.travelDistance?' 自由突进 '+m.travelDistance+' px（中版，遇敌 / 场边停止）。':'')]){const td=document.createElement('td');td.textContent=text;row.appendChild(td);}table.appendChild(row);
      }
      wrap.appendChild(table);section.appendChild(wrap);host.appendChild(section);
    }
  };
  const host=document.getElementById('roster');if(host)renderMovesRoster(host);
})();
