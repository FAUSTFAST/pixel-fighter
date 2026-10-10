// Load the same original PNG resources as the browser for native replay / tests.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {harness}=require('./gameplay-harness.cjs'),root=path.resolve(__dirname,'..');
class LocalImage extends Image{set src(v){super.src=path.resolve(root,v.split('?')[0]);}get src(){return super.src;}}
function nativeHarness(seed=1,art=true){
 const canvas=createCanvas(960,540),h=harness(seed,{art,context:canvas.getContext('2d'),globals:{Image:LocalImage,setTimeout,fetch:async v=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,v.split('?')[0])))})},document:{createElement:()=>createCanvas(1,1)}});
 return {...h,canvas};
}
function fonts(){GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Fight CJK');GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Courier New');}
module.exports={nativeHarness,createCanvas,fonts,root};
