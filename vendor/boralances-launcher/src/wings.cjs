'use strict';
// Ears v1 feature pixels + Alfalfa v1 payload. Protocol references are in design/STUDIO100.md.
const fs=require('node:fs/promises'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {assert,contained,atomicJSON,readJSON,offlineProfile}=require('./core.cjs');
const {validatePNG,png,equipTexture,removeTexture}=require('./player-style.cjs');
const REGIONS=[[8,0,24,8],[0,8,8,16],[16,8,32,16],[4,16,12,20],[20,16,36,20],[44,16,52,20],[0,20,56,32],[20,48,28,52],[36,48,44,52],[16,52,48,64]];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function decodePNG(bytes,type='skin'){
 const {width,height,channels}=validatePNG(bytes,type),parts=[];let offset=8;
 while(offset<bytes.length){const n=bytes.readUInt32BE(offset),t=bytes.toString('ascii',offset+4,offset+8);if(t==='IDAT')parts.push(bytes.subarray(offset+8,offset+8+n));offset+=12+n;if(t==='IEND')break;}
 const raw=zlib.inflateSync(Buffer.concat(parts),{maxOutputLength:100000}),stride=width*channels,decoded=Buffer.alloc(height*stride),pixels=Buffer.alloc(width*height*4);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=channels?decoded[at-channels]:0,b=y?decoded[at-stride]:0,c=y&&x>=channels?decoded[at-stride-channels]:0,v=raw[y*(stride+1)+1+x];decoded[at]=(v+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}}
 for(let i=0;i<width*height;i++){decoded.copy(pixels,i*4,i*channels,i*channels+3);pixels[i*4+3]=channels===4?decoded[i*channels+3]:255;}
 return {width,height,pixels};
}
function modernSkin(bytes){
 const image=decodePNG(bytes),pixels=Buffer.alloc(64*64*4);image.pixels.copy(pixels);
 if(image.height===32){
  const cube=(sx,sy,tx,ty)=>{const w=4,h=12,d=4;const faces=[[d,0,w,d],[d+w,0,w,d],[0,d,d,h],[d,d,w,h],[d+w,d,d,h],[d+w+d,d,w,h]];
   for(let i=0;i<faces.length;i++){const [dx,dy,ww,hh]=faces[i],source=faces[i===2?4:i===4?2:i];for(let y=0;y<hh;y++)for(let x=0;x<ww;x++)pixels.set(image.pixels.subarray(((sy+source[1]+y)*64+sx+source[0]+ww-1-x)*4,((sy+source[1]+y)*64+sx+source[0]+ww-1-x)*4+4),((ty+dy+y)*64+tx+dx+x)*4);}};
  cube(0,16,16,48);cube(40,16,32,48);
  let opaqueHat=true;for(let y=0;y<16;y++)for(let x=32;x<64;x++)if(pixels[(y*64+x)*4+3]<128)opaqueHat=false;
  if(opaqueHat)for(let y=0;y<16;y++)for(let x=32;x<64;x++)pixels[(y*64+x)*4+3]=0;
 }
 return pixels;
}
function readAlfalfa(pixels){
 let value=0n,index=0n;for(const [x1,y1,x2,y2] of REGIONS)for(let x=x1;x<x2;x++)for(let y=y1;y<y2;y++){const alpha=pixels[(y*64+x)*4+3];if(!alpha)continue;value|=BigInt(127-(alpha&127))<<(index++*7n);}
 if(!value)return new Map();let hex=value.toString(16);if(hex.length%2)hex='0'+hex;const bytes=Buffer.from(hex,'hex');if(bytes.length<6||bytes.readUInt32BE(0)!==0xea1fa1fa)return new Map();
 assert(bytes[4]===1,'This skin uses an unsupported Ears payload version.');let at=5;const entries=new Map(),names=['END','wing','erase','cape'];
 while(at<bytes.length){const keyByte=bytes[at++];if(keyByte===0)return entries;let key;
  if(keyByte<64)key=names[keyByte]||'!unk'+keyByte;else{const out=[keyByte];while(at<bytes.length){const n=bytes[at++];out.push(n&127);if(n&128)break;}key=Buffer.from(out).toString('ascii');}
  const data=[];let len;do{assert(at<bytes.length,'Damaged Ears payload.');len=bytes[at++];assert(at+len<=bytes.length,'Damaged Ears payload.');data.push(bytes.subarray(at,at+len));at+=len;}while(len===255);entries.set(key,Buffer.concat(data));
 }
 throw new Error('Damaged Ears payload.');
}
function writeAlfalfa(pixels,entries){
 const chunks=[Buffer.from([0xea,0x1f,0xa1,0xfa,1])],names=['END','wing','erase','cape'];
 for(const [key,value] of entries){let keyBytes;const ix=names.indexOf(key);if(ix>0)keyBytes=Buffer.from([ix]);else if(/^!unk\d+$/.test(key))keyBytes=Buffer.from([Number(key.slice(4))]);else{assert(/^[\x40-\x7f][\x00-\x7f]{0,63}$/.test(key),'Unsupported Ears payload key.');keyBytes=Buffer.from(key,'ascii');keyBytes[keyBytes.length-1]|=128;}chunks.push(keyBytes);
  for(let at=0;at<value.length;at+=255){const piece=value.subarray(at,at+255);chunks.push(Buffer.from([piece.length]),piece);}
  if(value.length%255===0)chunks.push(Buffer.from([0]));
 }
 chunks.push(Buffer.from([0]));const bytes=Buffer.concat(chunks);assert(bytes.length<=1428,'Wing texture and existing Ears data exceed the skin payload limit. Choose a smaller wing.');
 const value=BigInt('0x'+bytes.toString('hex'));let index=0n;
 for(const [x1,y1,x2,y2] of REGIONS)for(let x=x1;x<x2;x++)for(let y=y1;y<y2;y++){const at=(y*64+x)*4;if(!pixels[at+3])pixels.fill(0,at,at+3);pixels[at+3]=(127-Number((value>>(index++*7n))&127n))|128;}
}
function writeFeatures(pixels,mode=1,animated=true){
 const magic=(32*64)*4;const present=pixels[magic]===0xea&&pixels[magic+1]===0x25&&pixels[magic+2]===1;
 assert(!(pixels[magic]===0x3f&&pixels[magic+1]===0x23&&pixels[magic+2]===0xd8),'Upgrade this older Ears skin in the Ears skin editor before adding wings.');
 const bytes=[];if(present)for(let y=32;y<36;y++)for(let x=0;x<4;x++)if(x||y!==32){const at=(y*64+x)*4;bytes.push(...pixels.subarray(at,at+3));}
 let bits=present?bytes.flatMap(n=>Array.from({length:8},(_,i)=>(n>>(7-i))&1)):Array(360).fill(0),cursor=16;
 const read=n=>{let v=0;for(let i=0;i<n;i++)v=(v<<1)|(bits[cursor++]||0);return v;};
 const tail=read(3);if(tail){const segments=read(2)+1;cursor+=segments*7;}const snout=read(3);if(snout)cursor+=8;cursor+=5;
 const wingStart=cursor,oldMode=read(3);if(oldMode)cursor++;
 const wingBits=[(mode>>2)&1,(mode>>1)&1,mode&1,animated?1:0];bits=[...bits.slice(0,wingStart),...wingBits,...bits.slice(cursor)].slice(0,360);
 const data=Buffer.alloc(45);bits.forEach((n,i)=>data[i>>3]|=n<<(7-(i&7)));
 let at=0;for(let y=32;y<36;y++)for(let x=0;x<4;x++){const offset=(y*64+x)*4;if(!x&&y===32)pixels.set([0xea,0x25,1,255],offset);else pixels.set([data[at++]||0,data[at++]||0,data[at++]||0,255],offset);}
}
function createWingSkin(skinBytes,wingBytes,{mode=1,animated=true}={}){
 assert(Number.isInteger(mode)&&mode>=1&&mode<=6,'Invalid Ears wing mode.');decodePNG(wingBytes,'wing');const pixels=modernSkin(skinBytes),entries=readAlfalfa(pixels);entries.set('wing',wingBytes);writeFeatures(pixels,mode,animated);writeAlfalfa(pixels,entries);return png(64,64,pixels);
}
async function equip(directory,username,skinBytes,wingBytes,options={}){
 offlineProfile(username);const tracking=await contained(directory,'boralances-wings.json'),records=await readJSON(tracking,{}),local=await contained(directory,'CustomSkinLoader/LocalSkin/skins/'+username+'.png'),previous=await fs.readFile(local).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),old=records[username];
 if(old)assert(previous&&hash(previous)===old.hash,'Your local skin changed after equipping wings. Restore or export that skin before changing wings.');
 const base=old?Buffer.from(old.base,'base64'):skinBytes,combined=createWingSkin(base,wingBytes,options);
 await equipTexture(directory,username,'skin',combined,options.model||'default');
 try{records[username]={base:base.toString('base64'),previous:old?old.previous:(previous?previous.toString('base64'):null),hash:hash(combined),id:options.id};await atomicJSON(tracking,records);}
 catch(e){if(previous)await fs.writeFile(local,previous);else await fs.rm(local,{force:true});throw e;}
 return {username,kind:'animated-wings'};
}
async function remove(directory,username){
 offlineProfile(username);const tracking=await contained(directory,'boralances-wings.json'),records=await readJSON(tracking,{}),old=records[username];assert(old,'No animated cosmetic wings are equipped for this player.');
 const file=await contained(directory,'CustomSkinLoader/LocalSkin/skins/'+username+'.png'),current=await fs.readFile(file);assert(hash(current)===old.hash,'Your skin changed after equipping wings. Export it before restoring the previous skin.');
 if(old.previous)await fs.writeFile(file,Buffer.from(old.previous,'base64'));else await removeTexture(directory,username,'skin');
 delete records[username];await atomicJSON(tracking,records);return {removed:true};
}
module.exports={REGIONS,decodePNG,modernSkin,readAlfalfa,writeAlfalfa,writeFeatures,createWingSkin,equip,remove};
