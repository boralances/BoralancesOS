'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {assert,contained,readJSON,atomicJSON}=require('./core.cjs');
const {EMOTES}=require('./wardrobe-expansion.cjs');
function animation(id){
 const product=EMOTES.find(p=>p.id===id);assert(product,'Unknown original emote.');
 const f=(tick,pose,easing='easeInOutSine')=>({tick,easing,...pose});
 const A=(pitch=0,roll=0,yaw=0)=>({pitch,roll,yaw}),body=pose=>({torso:pose}),arms=(r,l)=>({rightArm:r,leftArm:l});
 const tracks={
 'hello-wave':[f(8,arms(A(-150,-15),A())),f(16,arms(A(-150,-40),A())),f(24,arms(A(-150,5),A())),f(32,arms(A(-150,-40),A())),f(40,arms(A(-150,5),A()))],
 'victory-cheer':[f(8,{...arms(A(-170,-20),A(-170,20)),...body({y:2})}),f(16,body({y:0})),f(24,body({y:2})),f(32,body({y:0}))],
 'formal-bow':[f(14,{...body({pitch:35}),head:A(15),...arms(A(10),A(10))}),f(32,body({pitch:35}))],
 'captain-salute':[f(12,{rightArm:{pitch:-100,roll:-25,bend:95}}),f(30,{rightArm:{pitch:-100,roll:-25,bend:95}})],
 'happy-clap':[8,14,20,26,32,38].map((tick,i)=>f(tick,arms(A(-80,i%2?-8:-40,i%2?-25:-5),A(-80,i%2?8:40,i%2?25:5)))),
 'side-step':[f(10,{...body({x:2,roll:8}),rightLeg:A(0,-12),leftLeg:A(0,-8),...arms(A(0,-20),A(0,20))}),f(30,{...body({x:-2,roll:-8}),rightLeg:A(0,8),leftLeg:A(0,12),...arms(A(0,-35),A(0,35))}),f(50,{...body({x:2,roll:8}),rightLeg:A(0,-12),leftLeg:A(0,-8),...arms(A(0,-20),A(0,20))})],
 'groove':[f(10,{...body({roll:12}),head:A(0,-10),...arms(A(-35,-35),A(20,25))}),f(30,{...body({roll:-12}),head:A(0,10),...arms(A(20,-25),A(-35,35))}),f(50,{...body({roll:12}),head:A(0,-10),...arms(A(-35,-35),A(20,25))})],
 'star-pose':[f(14,{...arms(A(0,-90),A(0,90)),rightLeg:A(0,-30),leftLeg:A(0,30)}),f(36,{...arms(A(0,-90),A(0,90))})],
 'thinking':[f(12,{rightArm:{pitch:-70,roll:-30,bend:100},head:A(12,0,-12)}),f(36,{head:A(12,0,12)})],
 'shrug':[f(12,{...arms({pitch:-30,roll:-45,y:1,bend:80},{pitch:-30,roll:45,y:1,bend:80}),head:A(0,12)}),f(32,{head:A(0,-12)})],
 'arm-stretch':[f(16,{...arms(A(-180,-8),A(-180,8)),...body({y:1})}),f(36,body({y:1}))],
 'warm-up':[f(10,{...arms(A(-150),A(30)),rightLeg:A(12),leftLeg:A(-12)}),f(30,{...arms(A(30),A(-150)),rightLeg:A(-12),leftLeg:A(12)}),f(50,{...arms(A(-150),A(30)),rightLeg:A(12),leftLeg:A(-12)})],
 'air-guitar':[f(10,{...arms({pitch:-50,roll:-30,bend:65},{pitch:-65,roll:35,bend:90}),...body({roll:8})}),f(20,{rightArm:{pitch:-35,roll:-10,bend:40}}),f(30,{rightArm:{pitch:-50,roll:-30,bend:65}}),f(40,{rightArm:{pitch:-35,roll:-10,bend:40}}),f(50,{rightArm:{pitch:-50,roll:-30,bend:65}})],
 'robot':[f(10,{...arms(A(-90,0),A(0,90)),head:A(0,0,-25)},'constant'),f(22,{...arms(A(0,-90),A(-90,0)),head:A(0,0,25)},'constant'),f(34,{...arms(A(-90,0),A(0,90)),head:A(0,0,-25)},'constant'),f(50,{...arms(A(-90,0),A(0,90)),head:A(0,0,-25)})],
 'shuffle':[f(10,{rightLeg:A(-35),leftLeg:A(25),...arms(A(30,-10),A(-30,10)),...body({yaw:15})}),f(30,{rightLeg:A(25),leftLeg:A(-35),...arms(A(-30,-10),A(30,10)),...body({yaw:-15})}),f(50,{rightLeg:A(-35),leftLeg:A(25),...arms(A(30,-10),A(-30,10)),...body({yaw:15})})],
 'heart-hands':[f(14,arms({pitch:-70,roll:-25,yaw:-25,bend:100},{pitch:-70,roll:25,yaw:25,bend:100})),f(36,body({y:1}))],
 'look-around':[f(12,{head:A(0,0,-55)}),f(30,{head:A(0,0,55)}),f(42,{head:A(-20)})],
 'toe-tap':[f(10,{rightLeg:A(-22),...body({roll:4})}),f(20,{rightLeg:A(8)}),f(30,{rightLeg:A(-22)}),f(40,{rightLeg:A(8)}),f(50,{rightLeg:A(-22)})],
 'deep-breath':[f(10,{...body({y:0}),...arms(A(0,-8),A(0,8)),head:A(5)}),f(30,{...body({y:1}),...arms(A(0,-15),A(0,15)),head:A(-5)}),f(50,{...body({y:0}),...arms(A(0,-8),A(0,8)),head:A(5)})],
 'finale':[f(12,body({pitch:35})),f(24,body({pitch:0})),f(34,arms(A(-160,-20),A())),f(42,arms(A(-160,10),A()))]
 };
 const neutral={head:A(),torso:{x:0,y:0,z:0,pitch:0,yaw:0,roll:0},...arms({pitch:0,yaw:0,roll:0,bend:0,y:0},{pitch:0,yaw:0,roll:0,bend:0,y:0}),rightLeg:A(),leftLeg:A()};
 const moves=[f(0,neutral),...tracks[id.replace(/^emote-/,'')]];
 if(!product.loop)moves.push(f(52,neutral));
 const hex=crypto.createHash('sha256').update('boralances-emote:'+id).digest('hex');
 const uuid=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
 return {version:2,name:product.name,author:'Boralances Studios',description:product.description,uuid,emote:{beginTick:0,endTick:product.loop?50:52,stopTick:60,isLoop:product.loop,returnTick:product.loop?10:0,degrees:true,easeBeforeKeyframe:false,moves}};
}
function validateAnimation(value){
 assert(value?.version===2&&typeof value.name==='string'&&value.emote?.moves?.length>1,'Invalid Emotecraft animation.');
 const e=value.emote;assert(Number.isInteger(e.endTick)&&e.endTick>0&&e.endTick<=2400&&e.stopTick>e.endTick,'Invalid animation duration.');
 assert(!e.isLoop||e.returnTick>=0&&e.returnTick<e.endTick,'Invalid animation loop.');
 let last=-1;
 for(const frame of e.moves){assert(Number.isInteger(frame.tick)&&frame.tick>=last&&frame.tick<=e.endTick,'Invalid animation timeline.');last=frame.tick;for(const [part,pose] of Object.entries(frame)){if(['tick','easing','turn'].includes(part))continue;assert(['head','torso','rightArm','leftArm','rightLeg','leftLeg'].includes(part),'Invalid animation bone.');for(const [axis,n] of Object.entries(pose))assert(['x','y','z','pitch','yaw','roll','bend','axis'].includes(axis)&&typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=720,'Invalid bone transform.');}}
 return value;
}
async function install(directory,id,assetDirectory){
 const a=validateAnimation(animation(id)),file=await contained(directory,'emotes/boralances/'+id+'.json'),icon=file.slice(0,-5)+'.png',tracking=await contained(directory,'boralances-emotes.json'),records=await readJSON(tracking,{});
 const prior=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),priorIcon=await fs.readFile(icon).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),before=records[id],bytes=Buffer.from(JSON.stringify(a,null,2)+'\n');
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
 if(before){assert(!prior||digest(prior)===before.hash,'This emote was edited in Minecraft. Export it before replacing it.');if(before.iconHash)assert(!priorIcon||digest(priorIcon)===before.iconHash,'The emote icon was edited. Export it before replacing it.');}
 const iconBytes=assetDirectory?await fs.readFile(path.join(assetDirectory,id+'.png')):null;
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{
  await fs.writeFile(file,bytes);if(iconBytes)await fs.writeFile(icon,iconBytes);
  records[id]={previous:before?before.previous:(prior?prior.toString('base64'):null),hash:digest(bytes),iconPrevious:before?before.iconPrevious:(priorIcon?priorIcon.toString('base64'):null),iconHash:iconBytes?digest(iconBytes):before?.iconHash||null};
  await atomicJSON(tracking,records);
 }catch(e){if(prior)await fs.writeFile(file,prior);else await fs.rm(file,{force:true});if(iconBytes){if(priorIcon)await fs.writeFile(icon,priorIcon);else await fs.rm(icon,{force:true});}throw e;}
 return {id,name:a.name,type:'Emote',path:'emotes/boralances/'+id+'.json'};
}
async function remove(directory,id){
 assert(EMOTES.some(p=>p.id===id),'Unknown original emote.');const file=await contained(directory,'emotes/boralances/'+id+'.json'),icon=file.slice(0,-5)+'.png',tracking=await contained(directory,'boralances-emotes.json'),records=await readJSON(tracking,{}),record=records[id];assert(record,'This emote was not installed by the launcher.');
 const current=await fs.readFile(file),digest=b=>crypto.createHash('sha256').update(b).digest('hex');assert(digest(current)===record.hash,'This emote has been edited. Keep or export your changes before removing it.');
 if(record.iconHash){const currentIcon=await fs.readFile(icon).catch(()=>null);assert(!currentIcon||digest(currentIcon)===record.iconHash,'This emote icon has been edited. Export it before removing it.');}
 if(record.previous)await fs.writeFile(file,Buffer.from(record.previous,'base64'));else await fs.rm(file,{force:true});
 if(record.iconHash){if(record.iconPrevious)await fs.writeFile(icon,Buffer.from(record.iconPrevious,'base64'));else await fs.rm(icon,{force:true});}
 delete records[id];await atomicJSON(tracking,records);return {removed:true};
}
module.exports={animation,validateAnimation,install,remove};
