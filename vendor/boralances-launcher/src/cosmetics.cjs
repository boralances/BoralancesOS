const fs=require('node:fs/promises');
const path=require('node:path');
const {assert,contained,atomicJSON,readJSON,offlineProfile}=require('./core.cjs');
const PRODUCTS=[
  {id:'astral-crest',name:'Astral Crest',description:'A luminous star over midnight blue.',color:'#89c7ff'},
  {id:'ocean-pulse',name:'Ocean Pulse',description:'Turquoise currents and a sea-glass crest.',color:'#65e1cd'},
  {id:'ember-crown',name:'Ember Crown',description:'Copper flames beneath a golden crown.',color:'#ffbd77'},
  {id:'pastbound-relic',name:'Pastbound Relic',description:'An ancient rune in amethyst and silver.',color:'#b8a0ff'},
  {id:'aurora-veil',name:'Aurora Veil',description:'Northern lights woven into a pixel cape.',color:'#9de9a4'},
  {id:'boralances-classic',name:'Boralances Classic',description:'The original B crest in forest green.',color:'#bfed88'}
].map(p=>({...p,type:'Cape',price:0,currency:'FREE',asset:'../../assets/cosmetics/'+p.id+'.png'}));
PRODUCTS.push(...[{id:'aurora-wings',name:'Aurora Wings',description:'Mint and violet elytra wings.'},{id:'ember-wings',name:'Ember Wings',description:'Copper feathers for your elytra.'},{id:'ocean-wings',name:'Ocean Wings',description:'Sea-glass elytra wings.'}].map(p=>({...p,type:'Wings',price:0,currency:'FREE',asset:'../../assets/cosmetics/'+p.id+'.png'})),...['astral-ranger','ocean-sentinel'].map((id,i)=>({id,name:i?'Ocean Sentinel':'Astral Ranger',description:'Original full player skin, unlocked by a free voucher.',type:'Skin',voucherOnly:true,price:0,currency:'FREE',asset:'../../assets/cosmetics/'+id+'.png'})));
PRODUCTS.push(...require('./cosmetic-collection.cjs').COLLECTION,...require('./wardrobe-expansion.cjs').EXPANSION,...require('./wearables.cjs').WEARABLES);
PRODUCTS.push({id:'studio-starter',name:'Studio Starter',description:'An original free base skin for your wearable collection.',type:'Skin',price:0,currency:'FREE',voucherOnly:false,asset:'../../assets/cosmetics/studio-starter.png'});
function product(id){const p=PRODUCTS.find(p=>p.id===id);assert(p,'Unknown cosmetic.');return p;}
async function equipCape(directory,assetDirectory,id,username){
  const p=product(id);offlineProfile(username);
  const destination=await contained(directory,'CustomSkinLoader/LocalSkin/capes/'+username+'.png');
  const previous=await fs.readFile(destination).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  const tracking=await contained(directory,'cosmetics.json');
  const records=await readJSON(tracking,{players:{}});
  records.players||={};
  const old=records.players[username];
  const extra=await contained(directory,'CustomSkinLoader/ExtraList/BoralancesLocal.json');
  const extraBefore=await fs.readFile(extra).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  const asset=await fs.readFile(path.join(assetDirectory,p.id+'.png'));
  assert(asset.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Cosmetic texture is not a PNG.');
  await fs.mkdir(path.dirname(destination),{recursive:true});
  try{
    await fs.writeFile(destination,asset);
    // ExtraList prepends this local cape provider while preserving the user's skin providers.
    await atomicJSON(extra,{name:'BoralancesLocal',type:'Legacy',cape:'LocalSkin/capes/{USERNAME}.png',checkPNG:true});
    records.players[username]={id:p.id,name:p.name,previous:old?old.previous:(previous?previous.toString('base64'):null)};
    await atomicJSON(tracking,records);
  }catch(e){
    if(previous)await fs.writeFile(destination,previous);else await fs.rm(destination,{force:true});
    if(extraBefore)await fs.writeFile(extra,extraBefore);else await fs.rm(extra,{force:true});
    throw e;
  }
  return {name:p.name,username,local:true};
}
async function removeCape(directory,username){
  offlineProfile(username);
  const file=await contained(directory,'cosmetics.json');
  const records=await readJSON(file,{players:{}}),entry=records.players?.[username];
  assert(entry,'No launcher cape is equipped for this username.');
  const destination=await contained(directory,'CustomSkinLoader/LocalSkin/capes/'+username+'.png');
  const before=await fs.readFile(destination).catch(()=>null);
  try{
    if(entry.previous)await fs.writeFile(destination,Buffer.from(entry.previous,'base64'));else await fs.rm(destination,{force:true});
    delete records.players[username];await atomicJSON(file,records);
  }catch(e){if(before)await fs.writeFile(destination,before);throw e;}
  return {removed:true};
}
module.exports={PRODUCTS,product,equipCape,removeCape};
