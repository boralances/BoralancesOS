'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const core=require('./core.cjs'),style=require('./player-style.cjs'),wings=require('./wings.cjs');
const {EXPANSION}=require('./wardrobe-expansion.cjs');
const VERSIONS=['26.3','1.21.11','1.21.1','1.20.1'],JAR='boralances-client-1.8.3.jar';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function install(directory,assets){const source=await fs.readFile(path.join(assets,'client',JAR)),target=await core.contained(directory,'mods/'+JAR);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,source);for(const name of await fs.readdir(path.dirname(target)))if(/^boralances-client-\d+\.\d+\.\d+\.jar$/.test(name)&&name!==JAR)await fs.rm(await core.contained(directory,'mods/'+name));return {installed:true,menuKey:'F9'};}
const SLOTS={Cape:'cape',Wings:'elytra','Animated Wings':'wings',Hat:'hat',Trinket:'trinket',Dress:'dress'};
async function selectCosmetic(directory,item,bytes){const slot=SLOTS[item.type];core.assert(slot,'Unknown wardrobe slot.');core.assert(/^[A-Za-z0-9_-]{1,128}$/.test(item.id),'Invalid cosmetic ID.');if(require('./wearables.cjs').TYPES[item.type])require('./wearables.cjs').validateOverlay(bytes,item.type);else style.validatePNG(bytes,item.type==='Animated Wings'?'wing':'cape');
 const file=await core.contained(directory,'config/boralances-client/client.json'),config=await core.readJSON(file,{});let id=item.id;
 if(!require('./cosmetics.cjs').PRODUCTS.some(p=>p.id===id)){id='launcher-'+slot;const customFile=await core.contained(directory,'config/boralances-client/selected-wardrobe.json');await fs.mkdir(path.dirname(customFile),{recursive:true});await fs.writeFile(await core.contained(directory,'config/boralances-client/selected-'+slot+'.png'),bytes);await core.atomicJSON(customFile,{...await core.readJSON(customFile,{}),[slot]:item.name});}
 await core.atomicJSON(file,{...config,[slot]:id,sourceSlots:{...config.sourceSlots,[slot]:item.id}});return {slot,id};
}
async function outfit(directory){const cfg=await core.readJSON(await core.contained(directory,'config/boralances-client/client.json'),{}),slots={};for(const slot of Object.values(SLOTS))slots[slot]=cfg[slot]==='launcher-'+slot?cfg.sourceSlots?.[slot]||'':cfg[slot]||'';return {slots,share:!!cfg.shareCosmetics,showOthers:cfg.showOthers!==false};}
async function configure(directory,p){const file=await core.contained(directory,'config/boralances-client/client.json'),cfg=await core.readJSON(file,{});for(const key of ['shareCosmetics','showOthers'])if(p[key]!==undefined){core.assert(typeof p[key]==='boolean','Invalid sharing setting.');cfg[key]=p[key];}if(p.clearSlot){core.assert(Object.values(SLOTS).includes(p.clearSlot),'Unknown slot.');cfg[p.clearSlot]='';}await core.atomicJSON(file,cfg);return outfit(directory);}
async function prepare(directory,assets,username,lookup=style.playerSkin){
 core.offlineProfile(username);
 const mods=await core.contained(directory,'mods'),names=await fs.readdir(mods).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 if(!names.some(name=>/^boralances-client-\d+\.\d+\.\d+\.jar$/.test(name)))return {installed:false};
 if(!names.includes(JAR))await install(directory,assets);
 await require('./ready-design.cjs').refresh(directory,assets);
 // Update the bundled client before any optional skin lookup so existing ready
 // instances receive launcher fixes even when their player has no public skin.
 const installed=await core.contained(directory,'mods/'+JAR),current=await fs.readFile(path.join(assets,'client',JAR));
 if(!current.equals(await fs.readFile(installed)))await install(directory,assets);
 const parent=await core.contained(directory,'config/boralances-client'),metadata=await core.readJSON(path.join(parent,'player.json'),{}),local=await core.contained(directory,'CustomSkinLoader/LocalSkin/skins/'+username+'.png');
 let base=await fs.readFile(local).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),model='default',source='Imported local skin';
 const records=await core.readJSON(await core.contained(directory,'player-style.json'),{});model=records[username+'_skin']?.model||'default';
 if(base){const equipped=(await core.readJSON(await core.contained(directory,'boralances-wings.json'),{}))[username];if(equipped&&equipped.hash===hash(base))base=Buffer.from(equipped.base,'base64');}
 else if(metadata.name===username&&Date.now()-metadata.preparedAt<600000){base=await fs.readFile(await core.contained(directory,'config/boralances-client/base-skin.png')).catch(()=>null);model=metadata.model||'default';source=metadata.source||'Cached player skin';}
 if(!base){const player=await lookup(username);core.assert(/^data:image\/png;base64,/.test(player.skin),'Player skin response is invalid.');base=Buffer.from(player.skin.split(',')[1],'base64');model=player.model;source=player.source;}
 const size=style.validatePNG(base);if(size.height===32)base=style.png(64,64,wings.modernSkin(base));const digest=hash(base),products=EXPANSION.filter(p=>p.type==='Animated Wings');
 const custom=await core.readJSON(await core.contained(directory,'config/boralances-client/selected-wardrobe.json'),{});if(custom.wings){const wing=await fs.readFile(await core.contained(directory,'config/boralances-client/selected-wings.png'));const output=wings.createWingSkin(base,wing,{mode:1,animated:true});await fs.mkdir(await core.contained(directory,'config/boralances-client/skins'),{recursive:true});await fs.writeFile(await core.contained(directory,'config/boralances-client/skins/launcher-wings.png'),output);}
 if(metadata.name===username&&metadata.hash===digest&&(await Promise.all(products.map(p=>fs.stat(path.join(parent,'skins',p.id+'.png')).then(s=>s.isFile()).catch(()=>false)))).every(Boolean))return {installed:true,wings:products.length,cached:true};
 // Generate before replacing the previous player's metadata. Failed lookups cannot reuse someone else's skin.
 const generated=await Promise.all(products.map(async p=>[p.id,wings.createWingSkin(base,await fs.readFile(path.join(assets,'cosmetics',p.id+'.png')),{mode:p.wingMode,animated:p.animateWings})]));
 await fs.mkdir(await core.contained(directory,'config/boralances-client/skins'),{recursive:true});
 for(const [id,bytes] of generated)await fs.writeFile(await core.contained(directory,'config/boralances-client/skins/'+id+'.png'),bytes);
 await fs.writeFile(await core.contained(directory,'config/boralances-client/base-skin.png'),base);
 await core.atomicJSON(await core.contained(directory,'config/boralances-client/player.json'),{name:username,model,source,hash:digest,preparedAt:Date.now()});return {installed:true,wings:products.length,cached:false};
}
async function restoreSlot(directory,kind,username){
 if(kind==='skin'){const file=await core.contained(directory,'config/boralances-client/player.json'),metadata=await core.readJSON(file,{});if(metadata.name?.toLowerCase()===String(username).toLowerCase())await fs.rm(file,{force:true});return;}
 core.assert(['cape','elytra','wings'].includes(kind),'Unknown restored texture slot.');
 const file=await core.contained(directory,'config/boralances-client/client.json');if(await fs.stat(file).catch(()=>null))await configure(directory,{clearSlot:kind});
}
module.exports={VERSIONS,JAR,SLOTS,install,prepare,selectCosmetic,outfit,configure,restoreSlot};
