'use strict';
const crypto=require('node:crypto');
const {assert,offlineProfile}=require('./core.cjs');
const THEMES=new Set(['glass','dark','light']),MODES=new Set(['offline','online','both']);
function key(access){const owner=access.cloud?.uid?'cloud:'+access.cloud.uid:access.chat?.uid?'chat:'+access.chat.uid:null;return owner?crypto.createHash('sha256').update(owner).digest('hex'):null;}
function record(profiles,access){const id=key(access),value=id&&profiles?.[id];return value?.schema===1?value:{};}
function status(profiles,access,account){
 const saved=record(profiles,access),theme=THEMES.has(saved.theme)?saved.theme:null,mode=MODES.has(saved.mode)?saved.mode:null;
 const offlineName=typeof saved.offlineName==='string'&&/^[A-Za-z0-9_]{3,16}$/.test(saved.offlineName)?saved.offlineName:'';
 const onlineReady=!!(account?.id&&account?.name),complete=!!access.authenticated&&!!saved.completedAt&&!!theme&&!!mode&&(mode==='online'||!!offlineName)&&(mode==='offline'||onlineReady);
 return {required:!complete,profileKey:key(access),step:!access.authenticated?'account':!theme?'theme':!mode?'mode':complete?'done':'profile',theme,mode,offlineName,onlineReady,minecraftName:onlineReady?account.name:null};
}
function update(profiles,access,account,p){
 assert(access.authenticated,'Sign in to Boralances or BoralancesChatting first.');
 let saved={...record(profiles,access)};
 if(p.action==='reset')saved={schema:1};
 else if(p.action==='theme'){assert(THEMES.has(p.theme),'Choose Liquid Glass, Dark or Light.');saved={...saved,schema:1,theme:p.theme,completedAt:null};}
 else if(p.action==='mode'){assert(THEMES.has(saved.theme),'Choose a theme first.');assert(MODES.has(p.mode),'Choose Offline, Online or Both.');saved={...saved,mode:p.mode,completedAt:null};}
 else if(p.action==='finish'){
  assert(THEMES.has(saved.theme)&&MODES.has(saved.mode),'Choose your theme and play mode first.');
  if(saved.mode!=='online')saved.offlineName=offlineProfile(String(p.offlineName||'').trim()).name;
  if(saved.mode!=='offline')assert(account?.id&&account?.name,'Sign in to your Minecraft account before continuing.');
  saved.completedAt=new Date().toISOString();
 }else throw Error('Unknown setup step.');
 return {...profiles,[key(access)]:saved};
}
function offline(mode,requested,account){
 assert(MODES.has(mode),'Complete experience setup before launching Minecraft.');
 if(mode==='offline')return true;
 assert(account?.id&&account?.name,'Sign in to your Minecraft account before playing online.');
 if(mode==='online'){assert(!requested,'Choose Both in experience setup to use an offline profile.');return false;}
 return !!requested;
}
module.exports={key,status,update,offline};
