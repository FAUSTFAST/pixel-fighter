// DOM / controller lifecycle checks. Combat and original-art coverage lives in
// check-move-demo.cjs; these mocks deliberately exercise only parent-window UI.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test');
const root=path.resolve(__dirname,'..');

function environment(){
  let document;
  class UIEvent{
    constructor(type,options={}){this.type=type;Object.assign(this,options);}
    preventDefault(){this.defaultPrevented=true;}
  }
  class Element{
    constructor(tag){this.tagName=tag.toLowerCase();this.children=[];this.attributes={};this.listeners={};this.disabled=false;this.checked=false;this.open=false;this._value=null;}
    setAttribute(name,value){this.attributes[name]=String(value);if(['id','type'].includes(name))this[name]=String(value);if(['disabled','checked'].includes(name))this[name]=true;if(name==='value')this.value=value;}
    getAttribute(name){return this.attributes[name]??null;}
    get options(){return this.children.filter(child=>child.tagName==='option');}
    get selectedOptions(){return this.options.filter(option=>option.value===this.value);}
    get value(){return this.tagName==='select'?(this.options.find(option=>option.value===this._value)||this.options[0])?.value??'':this._value??'';}
    set value(value){this._value=String(value);}
    get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
    appendChild(child){child.remove();child.parentElement=this;this.children.push(child);return child;}
    append(...children){children.forEach(child=>this.appendChild(child));}
    prepend(child){child.remove();child.parentElement=this;this.children.unshift(child);}
    replaceChildren(...children){for(const child of [...this.children])child.remove();this._value=null;this.append(...children);}
    remove(){if(this.parentElement)this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}
    addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
    dispatchEvent(event){event.currentTarget=this;event.target=this;for(const listener of this.listeners[event.type]||[])listener(event);return !event.defaultPrevented;}
    click(){this.dispatchEvent(new UIEvent('click'));}
    focus(){document.activeElement=this;}
    scrollIntoView(){}
    getClientRects(){return this.isConnected?[{}]:[];}
    matches(selector){return selector.split(',').some(part=>{const match=part.trim().match(/^([\w-]+)?(?:\[([\w-]+)(?:=([^\]]+))?\])?$/);return match&&(!match[1]||match[1]===this.tagName)&&(!match[2]||(match[2]==='open'?this.open:match[2]==='hidden'?this.hidden:match[3]?this[match[2]]===match[3]:match[2] in this.attributes));});}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){const result=[];for(const child of this.children){if(selector.startsWith('#')?child.id===selector.slice(1):child.matches(selector))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    showModal(){this.open=true;(this.querySelector('[autofocus]')||this.querySelector('button'))?.focus();}
    close(){this.open=false;}
    set innerHTML(html){
      this.replaceChildren();const stack=[this];
      for(const token of html.matchAll(/<\/?([\w-]+)([^>]*)>/g)){
        if(token[0].startsWith('</')){stack.pop();continue;}
        const element=new Element(token[1]);
        for(const attribute of token[2].matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)'|=([^\s"'>]+))?/g))element.setAttribute(attribute[1],attribute[2]??attribute[3]??attribute[4]??'');
        stack[stack.length-1].appendChild(element);
        if(!['input','br','img','meta','link'].includes(element.tagName))stack.push(element);
      }
    }
  }
  document={hidden:false,activeElement:null,createElement:tag=>new Element(tag),hasFocus:()=>true};
  document.body=new Element('body');document.getElementById=id=>document.body.querySelector('#'+id);
  const bar=new Element('header');bar.id='app-bar';const nav=new Element('nav');bar.appendChild(nav);document.body.appendChild(bar);
  document.querySelector=selector=>selector==='#app-bar nav'?nav:document.body.querySelector(selector);
  const guide=new Element('dialog');guide.id='guide-dialog';guide.open=true;
  const trigger=new Element('button');trigger.id='guide-demo-trigger';guide.appendChild(trigger);document.body.appendChild(guide);trigger.focus();
  const keys=['special','uppercut','rush','tech','skill','super1','super2','super'];
  const characters=['ryu','mei'].map(id=>({id,name:id,moves:Object.fromEntries(keys.map(key=>[key,{name:id+' '+key,command:'↓→ + 拳',startup:12,active:5,recovery:22}]))}));
  const pressed=new Set(),pad={index:0,id:'Simulated standard controller',mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:16},(_,index)=>({get pressed(){return pressed.has(index);},get value(){return pressed.has(index)?1:0;}}))};
  const inputHistory=[],counts={guideClosed:0,guideClicked:0};trigger.addEventListener('click',()=>counts.guideClicked++);
  const context={document,URL,URLSearchParams,Event:UIEvent,CHARACTERS:characters,location:{href:'http://127.0.0.1:8765/?v=move-demo-ui-test',search:''},
    CombatRules:{specials:keys.slice(0,5),supers:keys.slice(5),isSpecial:key=>keys.slice(0,5).includes(key)},
    Input:{MODES:{p1:'classic',p2:'classic'},MAP:{p1:{},p2:{}},setGamepadKeys:keys=>inputHistory.push([...keys]),clearMotions(){},clear(){}},
    GAME:{scene:'fight',paused:true,pve:false,f1:null,f2:null},Settings:{isOpen:false},
    AppPanels:{isOpen:true,closeGuide(){counts.guideClosed++;guide.close();this.isOpen=false;}},
    localStorage:{getItem:()=>null},navigator:{getGamepads:()=>[pad]}};
  context.window=context;context.parent=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'js/move-demo.js'),'utf8'),context,{filename:'move-demo.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'js/gamepad.js'),'utf8'),context,{filename:'gamepad.js'});
  const byId=id=>document.getElementById(id);
  const frames=()=>document.body.querySelectorAll('iframe');
  function load(frame=frames()[0]){
    const selected=[],session={speed:1,playing:true,select(...args){selected.push(args);},restart(){},snapshot:()=>({ready:true,phase:'出招',hits:1,blocks:0,damage:10})};
    frame.contentWindow={MoveDemoSession:session};frame.dispatchEvent(new UIEvent('load'));return {session,selected};
  }
  function poll(...buttons){pressed.clear();buttons.forEach(button=>pressed.add(button));context.Gamepads.poll();}
  return {context,document,guide,trigger,counts,inputHistory,byId,frames,load,poll,UIEvent};
}

test('iframe load keeps controls selected during loading and ignores detached-frame callbacks',()=>{
  const h=environment(),{MoveDemo}=h.context;
  MoveDemo.open('ryu','special',h.trigger);
  const first=h.frames()[0];assert.equal(first.inert,true);assert.equal(first.tabIndex,-1);
  assert.equal(new URL(first.src).origin,new URL(h.context.location.href).origin);
  h.byId('demo-speed').value='0.5';h.byId('demo-speed').dispatchEvent(new h.UIEvent('change'));
  h.byId('demo-opponent').value='guard';h.byId('demo-opponent').dispatchEvent(new h.UIEvent('change'));
  const old=h.load(first);assert.equal(old.session.speed,.5,'asynchronous iframe load applies the currently selected speed');
  assert.equal(old.selected.at(-1)[2].guard,true,'loading preserves chosen opponent response');
  MoveDemo.open('mei','uppercut',h.trigger);const second=h.frames()[0];
  assert.equal(first.isConnected,false,'replacement removes the previous iframe');assert.notEqual(second,first);assert.equal(h.frames().length,1);
  const oldCalls=old.selected.length;first.dispatchEvent(new h.UIEvent('load'));
  assert.equal(old.selected.length,oldCalls,'stale frame callback must not reselect a detached session');
  h.byId('demo-speed').value='0.25';const current=h.load(second);assert.equal(current.session.speed,.25);
  assert.equal(current.selected.at(-1)[0],'mei');assert.equal(current.selected.at(-1)[1],'uppercut');
  MoveDemo.close();assert.equal(h.frames().length,0);assert.equal(h.document.activeElement,h.trigger);
});

test('controller A and directional input target the preview above an open guide',()=>{
  const h=environment();h.context.MoveDemo.open('ryu','special',h.trigger);const {session}=h.load();
  assert.equal(h.document.querySelector('dialog[open]'),h.guide,'fixture keeps the guide first in DOM order');
  h.poll();h.byId('demo-play').focus();h.poll(0);
  assert.equal(session.playing,false,'A operates the preview pause button');assert.equal(h.counts.guideClicked,0,'A never activates an underlying guide button');
  h.poll();h.poll(13);assert.equal(h.document.activeElement.id,'demo-restart','D-pad down focuses the next preview control');
  h.poll();h.byId('demo-speed').focus();h.poll(15);assert.equal(session.speed,.5,'D-pad right changes preview speed');
  assert.ok(h.inputHistory.every(keys=>keys.length===0),'dialog controller input never reaches combat');
  assert.equal(h.context.GAME.paused,true,'parent fight stays paused');assert.equal(h.guide.open,true);
});

test('controller return buttons close only the preview, then require a fresh press for the guide',()=>{
  for(const button of [1,8,9]){
    const h=environment();h.context.MoveDemo.open('ryu','special',h.trigger);h.load();h.poll();h.poll(button);
    assert.equal(h.context.MoveDemo.isOpen,false,`button ${button} closes preview`);assert.equal(h.frames().length,0);
    assert.equal(h.guide.open,true,`button ${button} preserves guide`);assert.equal(h.counts.guideClosed,0);
    assert.equal(h.document.activeElement,h.trigger,'close restores focus to the launching move');
    h.poll(button);assert.equal(h.counts.guideClosed,0,'held return cannot cascade to the underlying guide');
    h.poll();h.poll(button);assert.equal(h.counts.guideClosed,1,'a fresh return press closes the guide normally');
    assert.equal(h.context.GAME.paused,true,'UI return never resumes the fight');
  }
});

test('repeated modal opening keeps one live iframe and releases it on close',()=>{
  const h=environment(),old=[];
  for(let i=0;i<30;i++){
    h.context.MoveDemo.open(i%2?'mei':'ryu',i%2?'super':'special',h.trigger);h.load();
    assert.equal(h.frames().length,1);assert.ok(old.every(frame=>!frame.isConnected),'previous preview frames stay detached');
    old.push(h.frames()[0]);
  }
  h.context.MoveDemo.close();h.context.MoveDemo.close();assert.equal(h.frames().length,0);
  assert.ok(old.every(frame=>!frame.isConnected));assert.equal(h.document.activeElement,h.trigger);
});
