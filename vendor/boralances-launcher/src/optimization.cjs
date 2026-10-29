const fs=require('node:fs/promises');
const path=require('node:path');
const {assert,contained,atomicJSON,readJSON}=require('./core.cjs');
const PROFILES={
  battery:{name:'Cool & quiet',description:'Cap frames at 60 with a short view distance to reduce sustained GPU work.',options:{renderDistance:'6',simulationDistance:'4',particles:'1',biomeBlendRadius:'0',entityDistanceScaling:'0.75',enableVsync:'true',maxFps:'60',mipmapLevels:'2',entityShadows:'false'}},
  balanced:{name:'Balanced',description:'Keep a useful view distance while reducing costly visual work.',options:{renderDistance:'10',simulationDistance:'6',particles:'1',biomeBlendRadius:'2',entityDistanceScaling:'1.0',enableVsync:'false',maxFps:'240'}},
  low:{name:'Low-end PC',description:'Shorter view distance and fewer particles for limited hardware.',options:{renderDistance:'6',simulationDistance:'5',particles:'2',biomeBlendRadius:'0',entityDistanceScaling:'0.5',enableVsync:'false',maxFps:'120',mipmapLevels:'0',entityShadows:'false'}},
  maximum:{name:'Maximum FPS',description:'Prioritize frames over distance and visual density.',options:{renderDistance:'6',simulationDistance:'4',particles:'1',biomeBlendRadius:'0',entityDistanceScaling:'0.75',enableVsync:'false',maxFps:'260',mipmapLevels:'1',entityShadows:'false'}}
};
async function applyProfile(directory,id){
  assert(Object.hasOwn(PROFILES,id),'Unknown optimization profile.');
  const file=await contained(directory,'options.txt'),backup=await contained(directory,'.boralances-options-backup.json');
  const original=await fs.readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(!await fs.stat(backup).then(()=>true).catch(()=>false))await atomicJSON(backup,{original});
  const options=PROFILES[id].options;
  const lines=(original||'').split(/\r?\n/).filter(Boolean),seen=new Set();
  const next=lines.map(line=>{const split=line.indexOf(':');const key=line.slice(0,split);if(split>0&&Object.hasOwn(options,key)){seen.add(key);return key+':'+options[key];}return line;});
  for(const [key,value] of Object.entries(options))if(!seen.has(key))next.push(key+':'+value);
  const temp=await contained(directory,'.boralances-options.tmp');
  await fs.writeFile(temp,next.join('\n')+'\n');await fs.rename(temp,file);
  return {profile:id,name:PROFILES[id].name,backup:true};
}
async function restoreProfile(directory){
  const backup=await contained(directory,'.boralances-options-backup.json');
  const saved=await readJSON(backup,null);assert(saved,'No optimization settings backup exists.');
  const file=await contained(directory,'options.txt');
  if(saved.original===null)await fs.rm(file,{force:true});
  else{const temp=await contained(directory,'.boralances-options.tmp');await fs.writeFile(temp,saved.original);await fs.rename(temp,file);}
  await fs.rm(backup,{force:true});return {restored:true};
}
module.exports={PROFILES,applyProfile,restoreProfile};
