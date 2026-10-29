'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {contained,readJSON}=require('./core.cjs');
// Only replace exact known first-party files. Edited layouts and game options stay intact.
async function refresh(directory,assets){
 const preset=await readJSON(await contained(directory,'boralances-preset.json'),null);if(!preset?.customization)return {updated:0};
 let generated;try{generated=await require('./ready-customization.cjs').overrides(preset.minecraft,preset.customization,path.join(assets,'menu-themes'));}catch{return {updated:0};}
 const legacy=await readJSON(path.join(assets,'menu-themes/legacy-hashes.json'),{files:{}});let updated=0;const titleName='config/fancymenu/customization/boralances-title.txt',existingTitle=await fs.readFile(await contained(directory,titleName)).catch(()=>null);if(existingTitle&&(existingTitle.equals(generated.files.get(titleName))||legacy.files[titleName]?.includes(crypto.createHash('sha256').update(existingTitle).digest('hex'))))await require('./title-integration.cjs').sync(directory,preset);
 for(const [name,bytes]of generated.files){if(!name.startsWith('config/fancymenu/')&&!name.startsWith('config/drippyloadingscreen/'))continue;const file=await contained(directory,name),old=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!old){if(name.startsWith('config/fancymenu/assets/boralances/')){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes,{flag:'wx'});updated++;}continue;}if(old.equals(bytes)||!legacy.files[name]?.includes(crypto.createHash('sha256').update(old).digest('hex')))continue;
  const backup=await contained(directory,'.boralances/design-backup-1.8.3/'+name);await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,old,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});const stage=file+'.boralances-design.tmp';await fs.writeFile(stage,bytes);await fs.rename(stage,file);updated++;
 }return {updated};
}
module.exports={refresh};
