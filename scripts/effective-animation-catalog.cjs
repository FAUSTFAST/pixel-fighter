// Native regression tools inspect the complete historical overlay used by the game.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function effectiveCatalog(){
 const base=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/animation-v8/manifest.json')));
 const restored=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/art-restoration/manifest.json')));
 if(restored.sourceCommit!=='aadfccb3140210730936c185ad2fc82647404dd1'||
  Object.keys(restored.characters).sort().join(',')!==Object.keys(base.characters).sort().join(','))throw Error('Unexpected restoration scope');
 for(const [id,clips] of Object.entries(restored.characters)){
  if(Object.keys(clips).sort().join(',')!==Object.keys(base.characters[id]).sort().join(','))throw Error('Incomplete restoration '+id);
  Object.assign(base.characters[id],clips);
 }
 return base;
}
module.exports={effectiveCatalog};
