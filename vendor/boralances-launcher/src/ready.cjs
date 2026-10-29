
const {assert}=require('./core.cjs');
const VERSIONS=['26.3','1.21.11','1.21.1','1.20.1'];
const FEATURES=['renderer','logic','memory','culling','moreculling','immediate','background','modernfix','badoptimizations','sodiumextra','reeses','krypton','fastquit','smoothswapping','smoothscroll','controlling','shulker','betterdebug','fps','cps','ping','mouse','zoom','food','modmenu','skin3d','localcosmetics','cosmetics','capes','emotes','animations','fancymenu','drippy','earlyloading','essential'];
async function presets(versions,loaders){return Promise.all(VERSIONS.map(async minecraft=>{const exists=versions.some(v=>v.id===minecraft);let builds=[];if(exists)try{builds=await loaders({minecraft,loader:'fabric'});}catch{}return {id:minecraft,minecraft,name:require('./ready-customization.cjs').normalize(minecraft).name,loader:'fabric',loaderVersion:builds[0]||null,available:exists&&builds.length>0,description:'Custom FancyMenu and Drippy loading screens, Essential, performance mods, HUD, animated wings and 20 original Emotecraft animations.'};}));}
function selectPreset(list,id){assert(VERSIONS.includes(id),'Unknown ready instance.');const p=list.find(p=>p.id===id);assert(p?.available,'This version does not currently have a Fabric build.');return p;}

async function prepare(directory,presetDirectory,id,catalog,customization){
 assert(VERSIONS.includes(id),'Unknown ready instance.');
 const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),core=require('./core.cjs');
 const info=JSON.parse(await fs.readFile(path.join(presetDirectory,id+'.json'),'utf8')),file=path.join(presetDirectory,core.safeRelative(info.file)),pack=core.inspectPack(file);
 assert(pack.minecraft===id&&pack.loader==='fabric'&&pack.loaderVersion===info.loaderVersion,'Ready bundle does not match its pinned version.');
 const selected=customization===undefined?null:require('./ready-customization.cjs').normalize(id,customization);
 const stage=await core.contained(directory,'.ready-'+crypto.randomUUID());await fs.mkdir(stage);
 async function copy(dir,prefix=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const relative=prefix+e.name;if(e.isDirectory())await copy(path.join(dir,e.name),relative+'/');else{assert(e.isFile(),'Unexpected ready archive entry.');const destination=await core.contained(directory,relative);await fs.mkdir(path.dirname(destination),{recursive:true});if(relative==='essential/config.toml'){const old=await fs.readFile(destination,'utf8').catch(()=>null);await fs.writeFile(destination,old===null?await fs.readFile(path.join(dir,e.name)):require('./title-integration.cjs').patchEssential(old));}else if(relative==='config/modmenu.json'){const old=await core.readJSON(destination,{});await core.atomicJSON(destination,{...old,...JSON.parse(await fs.readFile(path.join(dir,e.name),'utf8'))});}else await fs.copyFile(path.join(dir,e.name),destination);}}}
 try{await core.unpack(catalog,pack,stage,false);
  if(selected){const generated=await require('./ready-customization.cjs').overrides(id,selected,path.join(presetDirectory,'../menu-themes'));for(const [relative,bytes] of generated.files){const target=await core.contained(stage,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}info.customization=selected;await core.atomicJSON(await core.contained(stage,'boralances-preset.json'),info);}
  await copy(stage);return info;}
 finally{const target=path.resolve(stage),base=path.resolve(directory);assert(path.dirname(target)===base&&path.basename(target).startsWith('.ready-'),'Unsafe ready staging path.');await fs.rm(target,{recursive:true,force:true});}
}

module.exports={VERSIONS,FEATURES,presets,selectPreset,prepare};
