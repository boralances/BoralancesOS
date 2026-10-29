'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
// Keep the helper outside the installation being replaced. Do not close the
// launcher until PowerShell has loaded it and validated the update executable.
async function startUpdate({helper,jobFile,powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),timeout=15000,spawnProcess=spawn,terminate=pid=>process.kill(pid)}){
 const folder=path.dirname(jobFile),ready=path.join(folder,'helper-ready.json'),copy=path.join(folder,'apply-update.ps1'),bootstrap=path.join(folder,'start-update.ps1');
 await fs.rm(ready,{force:true});await fs.copyFile(helper,copy);await fs.copyFile(path.join(path.dirname(helper),'start-update.ps1'),bootstrap);
 const child=spawnProcess(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',bootstrap,'-HelperPath',copy,'-JobPath',jobFile],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let failed=false,output='',helperPid=null;child.once('error',()=>{failed=true;});
 child.stdout.on('data',chunk=>{if(output.length<4096)output+=chunk.toString();else failed=true;});
 child.stderr.on('data',()=>{}); // Report static guidance, never host output.
 child.once('close',code=>{try{const value=JSON.parse(output.replace(/^\uFEFF/,'').trim());if(code!==0||!Number.isSafeInteger(value.pid)||value.pid<=0)throw Error();helperPid=value.pid;}catch{failed=true;}});
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(failed)throw Error('The Windows update helper could not start. The launcher has stayed open. Retry or use the offline installer.');
  const value=await fs.readFile(ready,'utf8').then(text=>JSON.parse(text.replace(/^\uFEFF/,''))).catch(()=>null);
  if(value?.ready===true&&value.pid===helperPid){child.unref();return;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(helperPid)try{terminate(helperPid);}catch{}child.kill();throw Error('Windows did not confirm the update handoff. The launcher has stayed open. Retry or use the offline installer.');
}
module.exports={startUpdate};
