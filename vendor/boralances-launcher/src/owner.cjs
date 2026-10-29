'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {protectCredential}=require('./credentials.cjs');
const {assert}=require('./core.cjs');
const ROLE='boralanceslauncher-owner-v1';
function validOwner(record,fingerprint){
 return record?.role===ROLE&&record.fingerprint===fingerprint&&typeof record.uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(record.uid);
}
async function loadOwner(data,script,protect=protectCredential){
 const missing={ownerPC:false,uid:null,email:null,bootstrap:null,status:'missing'};
 let markerRead=false;
 try{
  const encrypted=await fs.readFile(path.join(data,'owner-pc.dpapi'),'utf8');
  markerRead=true;
  const fingerprint=await protect('identity','',script);
  const record=JSON.parse(await protect('unprotect',encrypted,script));
  if(!validOwner(record,fingerprint))return {...missing,status:'mismatch'};
  let bootstrap=null;
  try{
   const file=await fs.readFile(path.join(data,'owner-session.dpapi'),'utf8');
   const saved=JSON.parse(await protect('unprotect',file,script));
   if(saved.fingerprint===fingerprint&&saved.session?.uid===record.uid)bootstrap=saved.session;
  }catch{}
  return {ownerPC:true,uid:record.uid,email:record.email||null,bootstrap,status:'verified'};
 }catch(error){return {...missing,status:markerRead?'unavailable':error.code==='ENOENT'?'missing':'unavailable'};}
}
async function enrollOwner(data,script,session,protect=protectCredential){
 assert(session?.uid&&session.idToken&&session.refreshToken,'Authenticate the Firebase owner before enrolling this PC.');
 const fingerprint=await protect('identity','',script);
 assert(typeof fingerprint==='string'&&/^[a-f0-9]{64}$/i.test(fingerprint),'Windows owner identity is unavailable.');
 const record={role:ROLE,fingerprint,uid:session.uid,email:session.email,enrolled:new Date().toISOString()};
 const old=await loadOwner(data,script,protect);
 assert(!old.ownerPC||old.uid===record.uid,'This Windows account is already enrolled for a different Firebase owner.');
 await fs.mkdir(data,{recursive:true});
 await fs.writeFile(path.join(data,'owner-pc.dpapi'),await protect('protect',JSON.stringify(record),script));
 await fs.writeFile(path.join(data,'owner-session.dpapi'),await protect('protect',JSON.stringify({fingerprint,session}),script));
 return {ownerPC:true,uid:record.uid,email:record.email};
}
async function consumeBootstrap(data){await fs.rm(path.join(data,'owner-session.dpapi'),{force:true});}
// Only inspect known nearby portable/development folders. A discovered marker must
// still decrypt for CurrentUser and match this machine's fingerprint.
function nearbyOwnerDirectories(base){
 const roots=[base,path.dirname(base),path.dirname(path.dirname(base)),path.join(base,'BoralancesLauncher')];
 return [...new Set(roots.flatMap(dir=>[path.join(dir,'data'),path.join(dir,'release','data')]).map(dir=>path.resolve(dir)))];
}
async function loadOwnerNearby(data,script,candidates=[],protect=protectCredential){
 const current=await loadOwner(data,script,protect);
 if(current.ownerPC||current.status!=='missing')return current;
 for(const candidate of candidates){
  if(path.resolve(candidate)===path.resolve(data))continue;
  const known=await loadOwner(candidate,script,protect);
  if(!known.ownerPC)continue;
  // Copy only the encrypted enrollment. Sign-in is never silently imported from
  // another folder, and copying the executable to another PC grants no role.
  await fs.mkdir(data,{recursive:true});
  await fs.copyFile(path.join(candidate,'owner-pc.dpapi'),path.join(data,'owner-pc.dpapi'),require('node:fs').constants.COPYFILE_EXCL).catch(error=>{if(error.code!=='EEXIST')throw error;});
  return loadOwner(data,script,protect);
 }
 return current;
}
module.exports={ROLE,validOwner,loadOwner,loadOwnerNearby,nearbyOwnerDirectories,enrollOwner,consumeBootstrap};
