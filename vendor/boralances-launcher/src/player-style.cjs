const fs=require('node:fs/promises'),path=require('node:path'),zlib=require('node:zlib');
const {assert,contained,atomicJSON,readJSON,offlineProfile}=require('./core.cjs');
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(b){let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function validatePNG(b,type='skin'){
 assert(Buffer.isBuffer(b)&&b.length<1048576&&b.subarray(0,8).equals(SIGNATURE),'Choose a PNG smaller than 1 MB.');
 let offset=8,header=null,idat=[],end=false;
 while(offset+12<=b.length){const n=b.readUInt32BE(offset);assert(n<=b.length-offset-12,'Damaged PNG.');const t=b.toString('ascii',offset+4,offset+8),body=b.subarray(offset+8,offset+8+n);assert(crc32(b.subarray(offset+4,offset+8+n))===b.readUInt32BE(offset+8+n),'Damaged PNG checksum.');if(t==='IHDR'){assert(offset===8&&n===13,'Invalid PNG header.');header={width:body.readUInt32BE(0),height:body.readUInt32BE(4),channels:body[9]===6?4:3};assert(body[8]===8&&[2,6].includes(body[9])&&body[10]===0&&body[11]===0&&body[12]===0,'Use a standard non-interlaced RGB or RGBA PNG.');assert(type==='wing'?header.width===20&&header.height===16:header.width===64&&[32,64].includes(header.height)&&(type==='skin'||header.height===32),'Use a 64×64 or 64×32 skin, 64×32 cape/elytra, or 20×16 Ears wing.');}if(t==='IDAT')idat.push(body);if(t==='IEND'){end=true;break;}offset+=n+12;}
 assert(header&&end&&idat.length,'Incomplete PNG.');try{const raw=zlib.inflateSync(Buffer.concat(idat),{maxOutputLength:100000});assert(raw.length===header.height*(header.width*header.channels+1),'Invalid pixel data.');for(let y=0;y<header.height;y++)assert(raw[y*(header.width*header.channels+1)]<=4,'Invalid PNG filter.');}catch{throw new Error('Damaged or oversized PNG pixels.');}return header;
}
function chunk(t,b){const h=Buffer.from(t),out=Buffer.alloc(b.length+12);out.writeUInt32BE(b.length);h.copy(out,4);b.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([h,b])),b.length+8);return out;}
function png(w,h,pixels){const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)pixels.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
async function equipTexture(directory,username,kind,bytes,model='default'){
 offlineProfile(username);assert(['skin','elytra','cape'].includes(kind),'Invalid texture kind.');validatePNG(bytes,kind==='skin'?'skin':'cape');assert(['default','slim'].includes(model),'Invalid skin model.');
 const relative='CustomSkinLoader/LocalSkin/'+(kind==='skin'?'skins':kind==='cape'?'capes':'elytras')+'/'+username+'.png',file=await contained(directory,relative),tracking=await contained(directory,'player-style.json'),records=await readJSON(tracking,{});
 const key=username+'_'+kind,old=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),before=records[key];
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,bytes);await atomicJSON(await contained(directory,'CustomSkinLoader/ExtraList/BoralancesTextures.json'),{name:'BoralancesTextures',type:'Legacy',skin:'LocalSkin/skins/{USERNAME}.png',cape:'LocalSkin/capes/{USERNAME}.png',elytra:'LocalSkin/elytras/{USERNAME}.png',model,checkPNG:true});records[key]={previous:before?before.previous:(old?old.toString('base64'):null),model};await atomicJSON(tracking,records);}
 catch(e){if(old)await fs.writeFile(file,old);else await fs.rm(file,{force:true});throw e;}
 return {username,kind,local:true};
}
async function removeTexture(directory,username,kind){offlineProfile(username);assert(['skin','elytra','cape'].includes(kind),'Invalid texture kind.');const file=await contained(directory,'player-style.json'),r=await readJSON(file,{}),key=username+'_'+kind;assert(r[key],'No custom texture equipped.');const target=await contained(directory,'CustomSkinLoader/LocalSkin/'+(kind==='skin'?'skins':kind==='cape'?'capes':'elytras')+'/'+username+'.png');if(r[key].previous)await fs.writeFile(target,Buffer.from(r[key].previous,'base64'));else await fs.rm(target,{force:true});delete r[key];await atomicJSON(file,r);return {removed:true};}
async function textureFromURL(url){const u=new URL(url);assert(u.protocol==='https:'&&u.hostname==='textures.minecraft.net'&&u.pathname.startsWith('/texture/')&&!u.username&&!u.password,'Unsupported Minecraft texture URL.');const r=await fetch(u,{signal:AbortSignal.timeout(15000),redirect:'error'});assert(r.ok,'Minecraft texture unavailable.');const b=Buffer.from(await r.arrayBuffer());validatePNG(b);return 'data:image/png;base64,'+b.toString('base64');}
async function playerSkin(username){
 offlineProfile(username);const r=await fetch('https://api.mojang.com/users/profiles/minecraft/'+encodeURIComponent(username),{signal:AbortSignal.timeout(15000)});assert(r.ok,'This Minecraft username has no public skin. Import a custom skin for your offline profile.');
 const p=await r.json();assert(/^[a-f0-9]{32}$/i.test(p.id),'Invalid Minecraft profile.');const s=await fetch('https://sessionserver.mojang.com/session/minecraft/profile/'+p.id,{signal:AbortSignal.timeout(15000)});assert(s.ok,'Player profile unavailable.');const j=await s.json(),property=j.properties?.find(x=>x.name==='textures');assert(property,'No public skin available.');const textures=JSON.parse(Buffer.from(property.value,'base64'));assert(textures.textures?.SKIN,'No custom skin available.');const u=new URL(textures.textures.SKIN.url);u.protocol='https:';return {name:p.name,id:p.id,skin:await textureFromURL(u.href),model:textures.textures.SKIN.metadata?.model==='slim'?'slim':'default',source:'Minecraft public profile'};
}

function createSkinCache(load=playerSkin,{ttl=600000,max=64,now=Date.now}={}){
 const entries=new Map(),pending=new Map();
 return async function lookup(username,{refresh=false}={}){
  offlineProfile(username);const key=username.toLowerCase(),entry=entries.get(key);
  if(!refresh&&entry&&now()-entry.time<ttl){entries.delete(key);entries.set(key,entry);return {...entry.value,cached:true};}
  if(pending.has(key))return {...await pending.get(key),cached:false};
  const request=(async()=>{const value={...await load(username),fetchedAt:new Date(now()).toISOString()};entries.delete(key);entries.set(key,{value,time:now()});while(entries.size>max)entries.delete(entries.keys().next().value);return value;})();
  pending.set(key,request);
  try{return {...await request,cached:false};}finally{pending.delete(key);}
 };
}

module.exports={createSkinCache,validatePNG,png,equipTexture,removeTexture,playerSkin,textureFromURL};