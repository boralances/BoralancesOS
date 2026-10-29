const {spawn}=require('node:child_process');
const path=require('node:path');
let fallback=null;
function configureFallback(config){fallback=config;}
function pipeCredential(executable,args,operation,value){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',finished=false;
  const timer=setTimeout(()=>{child.kill();reject(new Error('Windows credential reader timed out.'));},15000);
  child.stdout.on('data',v=>{if(output.length<1024*1024)output+=v;});child.stderr.on('data',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('Windows credential reader could not start.'));});
  child.on('close',code=>{clearTimeout(timer);try{if(code)throw Error();const result=JSON.parse(output.replace(/^\uFEFF/,''));if(typeof result.value!=='string')throw Error();finished=true;resolve(result.value);}catch{if(!finished)reject(new Error('Windows credential reader failed.'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({operation,value}));
 });
}
async function protectCredential(operation,value,script){
 const executable=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 try{return await pipeCredential(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],operation,value);}
 catch(error){if(!fallback)throw error;return pipeCredential(fallback.python,['-I',fallback.script],operation,value);}
}
module.exports={protectCredential,configureFallback,pipeCredential};
