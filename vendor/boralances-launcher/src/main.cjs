const {app,BrowserWindow,ipcMain,shell,dialog,safeStorage,clipboard,net} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const {spawn} = require('node:child_process');
const readline = require('node:readline');
const {pathToFileURL} = require('node:url');
const core = require('./core.cjs');
const client = require('./features.cjs');
const {curated}=require('./curated.cjs');
const optimize=require('./optimization.cjs');
const cosmetics=require('./cosmetics.cjs');
const {protectCredential}=require('./credentials.cjs');
const {registerSuite}=require('./suite.cjs');
const {assert,readJSON,atomicJSON,Catalog,LOADERS,TYPES} = core;

const nativeAcrylic=require('./window-material.cjs').supportsAcrylic(process.platform,os.release());
let win, busy='', pendingLogin=null,embeddedChat=null,cloudIdentity=()=>null,updater=null,multiplayer=null;
const accessPolicy=require('./launcher-access.cjs');
const onboarding=require('./onboarding.cjs');let setupProfiles={};
const launcherAccess=()=>{const access=accessPolicy.snapshot(cloudIdentity(),embeddedChat?.public());return {...access,onboarding:onboarding.status(setupProfiles,access,account)};};
const notifyAccess=()=>emit('launcher-access',launcherAccess());
const games=new (require('./game-sessions.cjs').GameSessions)();
const base = app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'))) : path.join(__dirname,'..');
const data = require('./data-path.cjs').dataDirectory({packaged:app.isPackaged,base,portable:!!process.env.PORTABLE_EXECUTABLE_DIR,appData:app.getPath('appData')});
const instances = path.join(data,'instances');
require('node:fs').mkdirSync(path.join(data,'profile'),{recursive:true});
app.setPath('userData',path.join(data,'profile'));
app.setAppLogsPath(path.join(data,'system-logs'));
const microsoftConfig=require('./microsoft-config.cjs');
const defaults = {memory:4096,width:1280,height:720,java:'',clientId:microsoftConfig.CLIENT_ID,redirectUri:microsoftConfig.REDIRECT_URI,curseforgeKey:'',snapshots:false,theme:'glass',glass:require('./glass-settings.cjs').DEFAULT,offlineName:'Player'};
let settings = {...defaults}, account=null,mcAccounts=[];
const indexURL=pathToFileURL(path.join(__dirname,'ui/index.html')).href;
const emit=(channel,value)=>{if(win&&!win.isDestroyed()){if(channel==='game'&&nativeAcrylic)try{win.setBackgroundMaterial(value.running?'none':'acrylic');}catch{}win.webContents.send(channel,value);}};
function progress(p){emit('progress',p);}
async function authDiagnostic(value){const diagnostic=require('./auth-diagnostics.cjs').normalize(value);if(!diagnostic)return;await atomicJSON(path.join(data,'auth-diagnostic.json'),diagnostic).catch(()=>{});emit('auth-diagnostic',require('./auth-diagnostics.cjs').present(diagnostic));}
function encrypt(value) {assert(safeStorage.isEncryptionAvailable() && (process.platform==='win32' || safeStorage.getSelectedStorageBackend()!=='basic_text'),'A secure credential store is unavailable. Unlock the login keyring first.');return safeStorage.encryptString(JSON.stringify(value)).toString('base64');}
function decrypt(value) {return JSON.parse(safeStorage.decryptString(Buffer.from(value,'base64')));}
const credentialScript=()=>app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/backend/credentials.ps1'):path.join(base,'backend/credentials.ps1');
async function load(){
  await fs.mkdir(instances,{recursive:true});
  settings={...defaults,...await readJSON(path.join(data,'settings.json'),{})};
  settings.clientId=microsoftConfig.clientId(settings.clientId);
  settings.redirectUri=microsoftConfig.REDIRECT_URI;
  setupProfiles=await readJSON(path.join(data,'onboarding.json'),{});
  const secrets=await readJSON(path.join(data,'secrets.json'),null);
  if(secrets){try{const s=decrypt(secrets.value);account=s.account;mcAccounts=s.accounts|| (account?[account]:[]);settings.curseforgeKey=s.curseforgeKey||'';}catch{progress({status:'Saved credentials could not be decrypted. Sign in again.'});}}
  if(!settings.curseforgeKey){const seed=await fs.readFile(path.join(data,'curseforge.dpapi'),'utf8').catch(()=>null);if(seed)try{settings.curseforgeKey=await protectCredential('unprotect',seed,credentialScript());}catch{progress({status:'Re-enter the CurseForge key in Settings on this Windows account.'});}}
}
async function saveSecrets(){if(account){const index=mcAccounts.findIndex(a=>a.id===account.id);if(index>=0)mcAccounts[index]=account;else mcAccounts.push(account);}if(!settings.curseforgeKey)await fs.rm(path.join(data,'curseforge.dpapi'),{force:true});if(!account&&!mcAccounts.length&&!settings.curseforgeKey){await fs.rm(path.join(data,'secrets.json'),{force:true});return;}await atomicJSON(path.join(data,'secrets.json'),{value:encrypt({account,accounts:mcAccounts,curseforgeKey:settings.curseforgeKey})});}
async function saveSettings(){const {curseforgeKey,...publicSettings}=settings;await atomicJSON(path.join(data,'settings.json'),publicSettings);await saveSecrets();}
function accountPublic(){return account?{name:account.name,id:account.id}:null;}
async function pythonPath(){
  if(process.platform==='linux' && process.env.BORALANCES_PYTHON)return process.env.BORALANCES_PYTHON;
  const candidates=[app.isPackaged?path.join(process.resourcesPath,'python/python.exe'):path.join(base,'.runtime/python/python.exe'),process.env.BORALANCES_PYTHON,path.join(os.homedir(),'AppData/Local/Programs/Python/Python314/python.exe'),path.join(os.homedir(),'AppData/Local/Programs/Python/Python313/python.exe')].filter(Boolean);
  for(const p of candidates)if(await fs.stat(p).then(s=>s.isFile()).catch(()=>false))return p;
  throw new Error('Python runtime missing. Run npm run runtime, then restart the launcher.');
}
async function worker(method,params={}){
  const executable=await pythonPath();
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,['-X','utf8','-u',app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/backend/worker.py'):path.join(__dirname,'../backend/worker.py')],{cwd:base,windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'},stdio:['pipe','pipe','pipe']});
    let result,error,diagnostic=null,finished=false;
    const lines=readline.createInterface({input:child.stdout});
    lines.on('line',line=>{try{const v=JSON.parse(line);if(v.event==='progress')progress(v);else if(v.error){error=v.error;diagnostic=v.diagnostic;}else if(Object.hasOwn(v,'result')){result=v.result;finished=true;}}catch{error='Installer returned an invalid response.';}});
    child.stderr.on('data',()=>{}); // Third-party HTTP exceptions may include secrets.
    child.on('error',e=>reject(new Error('Could not start the game backend: '+e.code)));
    child.on('close',async code=>{lines.close();if(error||!finished||code!==0){if(method==='authComplete'||method==='refresh')await authDiagnostic(diagnostic||{stage:'callback',code:'UNEXPECTED_AUTH_ERROR'});reject(new Error(error||'Game backend failed. Run npm run runtime to repair its dependencies.'));}else resolve(result);});
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify({method,params})+'\n');
  });
}
async function listInstances(){
  const names=await fs.readdir(instances,{withFileTypes:true});
  const result=[];
  for(const n of names)if(n.isDirectory()&&!n.name.startsWith('.')){
    const v=await readJSON(path.join(instances,n.name,'instance.json'),null);
    if(v)result.push(v);
  }
  return result.sort((a,b)=>b.created-a.created);
}
async function getInstance(id){
  assert(typeof id==='string' && /^[a-f0-9-]{36}$/.test(id),'Invalid instance ID.');
  const directory=await core.contained(instances,id);
  const instance=await readJSON(path.join(directory,'instance.json'),null);
  assert(instance,'Instance not found.');
  return {instance,directory};
}
async function task(label,fn){
  assert(!busy,'Wait for the current operation to finish.');
  busy=label;emit('busy',label);progress({status:label,current:0,total:0});
  try{return await fn();}finally{busy='';emit('busy','');}
}
// Chromium's transport follows Windows proxy and network settings, unlike a
// separate Node connection that can fail on otherwise working managed networks.
function catalog(){return new Catalog(settings.curseforgeKey||require('./provider-defaults.cjs').curseforgeKey,progress,{fetch:(url,options)=>net.fetch(url,options)});}
function editable(id){assert(!games.has(id),'Close this game before changing its files.');}
async function createInstance(p){
  const name=String(p.name||'').trim();
  assert(name.length>0 && name.length<=80,'Enter an instance name (1–80 characters).');
  assert(LOADERS.has(p.loader),'Unknown loader.');
  const versions=await worker('versions');
  assert(versions.some(v=>v.id===p.minecraft),'Unknown Minecraft version.');
  if(p.loader!=='vanilla'){
    const loaders=await worker('loaders',p);
    assert(loaders.includes(p.loaderVersion),'Select a loader build supported by this Minecraft version.');
  }
  const id=crypto.randomUUID(),directory=path.join(instances,id);
  const instance={id,name,minecraft:p.minecraft,loader:p.loader,loaderVersion:p.loader==='vanilla'?'':p.loaderVersion,created:Date.now(),installedVersion:null};
  await fs.mkdir(directory,{recursive:true});
  await atomicJSON(path.join(directory,'instance.json'),instance);
  return instance;
}
async function installGame(id){
  const {instance,directory}=await getInstance(id);
  editable(id);
  if(instance.presetId&&!instance.presetPrepared){const info=await require('./ready.cjs').prepare(directory,path.join(__dirname,'../assets/presets'),instance.presetId,catalog(),instance.readyCustomization);await optimize.applyProfile(directory,instance.performanceProfile||'balanced');Object.assign(instance,{presetPrepared:true,loaderVersion:info.loaderVersion});await atomicJSON(path.join(directory,'instance.json'),instance);}
  const result=await worker('install',{...instance,directory,java:settings.java});
  Object.assign(instance,result,{javaRelative:(settings.java||process.platform==='linux')?null:path.relative(directory,result.java).replace(/\\/g,'/')});
  await atomicJSON(path.join(directory,'instance.json'),instance);
  return instance;
}
async function importPackFile(file,optional=false){
  const pack=core.inspectPack(file);
  const id=crypto.randomUUID(),stage=path.join(instances,'.import-'+id),directory=path.join(instances,id);
  await fs.mkdir(stage,{recursive:true});
  try{
      const importReport=await core.unpack(catalog(),pack,stage,optional);
      const instance={id,name:pack.name,minecraft:pack.minecraft,loader:pack.loader,loaderVersion:pack.loaderVersion,created:Date.now(),installedVersion:null,pack:true,...(importReport.replacements.length?{importReport}:{})};
      if(importReport.replacements.length)await atomicJSON(path.join(stage,'pack-import-report.json'),importReport);
    await atomicJSON(path.join(stage,'instance.json'),instance);
    await fs.rename(stage,directory);
    return instance;
  }finally{await fs.rm(stage,{recursive:true,force:true});}
}
async function listContent(id){
  const {directory}=await getInstance(id);
  const records=await readJSON(path.join(directory,'content.json'),[]);
  const known=new Set(records.map(x=>x.path+(x.disabled?'.disabled':'')));
  const result=[...records];
  for(const [folder,type] of [['mods','mod'],['shaderpacks','shader'],['resourcepacks','resourcepack']]){
    const dir=await core.contained(directory,folder);
    const files=await fs.readdir(dir,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    for(const f of files)if(f.isFile()&&!known.has(folder+'/'+f.name)){
      const disabled=f.name.endsWith('.disabled'),relative=folder+'/'+(disabled?f.name.slice(0,-9):f.name);
      result.push({key:'local:'+relative,name:f.name.replace(/\.disabled$/,''),path:relative,type,disabled,requires:[],local:true});
    }
  }
  const saves=await core.contained(directory,'saves');
  const worlds=await fs.readdir(saves,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  for(const w of worlds)if(w.isDirectory()){
    const rel='saves/'+core.safeRelative(w.name)+'/datapacks';
    const files=await fs.readdir(await core.contained(directory,rel),{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    for(const f of files)if(f.isFile()&&!known.has(rel+'/'+f.name)){
      const disabled=f.name.endsWith('.disabled'),relative=rel+'/'+(disabled?f.name.slice(0,-9):f.name);
      result.push({key:'local:'+relative,name:f.name.replace(/\.disabled$/,''),path:relative,type:'datapack',world:w.name,disabled,requires:[],local:true});
    }
  }
  return result;
}
async function contentAction(p){
  editable(p.instanceId);
  const {directory}=await getInstance(p.instanceId);
  const all=await listContent(p.instanceId);
  const item=all.find(x=>x.key===p.key&&(!p.world||x.world===p.world));
  assert(item,'Installed file not found.');
  if(p.action==='remove'||(p.action==='toggle'&&!item.disabled))assert(!all.some(x=>!x.disabled && x.requires?.includes(item.key)),'Another enabled mod requires this dependency.');
  const file=await core.contained(directory,item.path+(item.disabled?'.disabled':''));
  const records=await readJSON(path.join(directory,'content.json'),[]);
  const record=records.find(x=>x.key===item.key&&x.path===item.path);
  if(p.action==='remove'){
    const backup=file+'.removing';
    await fs.rename(file,backup);
    try{await atomicJSON(path.join(directory,'content.json'),records.filter(x=>x.path!==item.path));}
    catch(e){await fs.rename(backup,file);throw e;}
    await fs.rm(backup,{force:true});
  }else{
    assert(p.action==='toggle','Unknown file action.');
    if(item.disabled)assert(!(item.requires||[]).some(key=>!all.some(r=>r.key===key&&!r.disabled)),'Enable this mod’s required dependencies first.');
    const next=await core.contained(directory,item.path+(item.disabled?'':'.disabled'));
    assert(!await fs.stat(next).then(()=>true).catch(()=>false),'The destination file already exists.');
    await fs.rename(file,next);
    if(record)record.disabled=!item.disabled;
    else records.push({...item,disabled:!item.disabled});
    try{await atomicJSON(path.join(directory,'content.json'),records);}
    catch(e){await fs.rename(next,file);throw e;}
  }
  return listContent(p.instanceId);
}
async function launch(p){
  assert(!games.has(p.instanceId),'This instance is already running.');
  const setup=launcherAccess().onboarding;
  assert(!setup.required,'Complete your experience setup before playing.');
  const offline=onboarding.offline(setup.mode,p.offline,account);
  let launchAccount;
  if(offline){launchAccount=core.offlineProfile(p.username||settings.offlineName);settings.offlineName=launchAccount.name;await saveSettings();}
  else{
    const refreshed=await worker('refresh',{clientId:microsoftConfig.CLIENT_ID,refreshToken:account.refresh_token});
    account=refreshed;launchAccount=account;await saveSecrets();await authDiagnostic({stage:'complete',code:'SUCCESS'});
  }
  let {instance,directory}=await getInstance(p.instanceId);
  if(!instance.installedVersion){
    instance=await installGame(p.instanceId);
  }
  const java=settings.java||(process.platform==='linux'&&instance.javaMajor&&process.env['BORALANCES_JAVA_'+instance.javaMajor])||(instance.javaRelative?await core.contained(directory,instance.javaRelative):instance.java);
  assert(java,'Select a Java executable or reinstall this instance.');
  let gameChat=null;
  if(instance.loader==='fabric'&&require('./native-client.cjs').VERSIONS.includes(instance.minecraft))try{
    gameChat=await embeddedChat.createGameSession();
    await core.atomicJSON(await core.contained(directory,'config/boralances-client/chat-bridge.json'),gameChat.bridge);
    const prepared=await require('./native-client.cjs').prepare(directory,path.join(__dirname,'../assets'),launchAccount.name);
    if(prepared.installed)progress({status:'F9 client menu ready · '+prepared.wings+' animated wings prepared for '+launchAccount.name});
  }catch(e){progress({status:'Animated wings need a valid public or imported skin: '+e.message});}
  let command;try{command=await worker('command',{...instance,directory,java,account:launchAccount,offline,memory:instance.launchOverrides?.memory||settings.memory,width:instance.launchOverrides?.width||settings.width,height:instance.launchOverrides?.height||settings.height});}catch(e){gameChat?.dispose();throw e;}
  if(p.quickJoin){const target=require('./multiplayer.cjs').address(p.quickJoin.host+':'+p.quickJoin.port);assert(require('./multiplayer.cjs').GAMES.has(instance.minecraft),'Quick joining needs a supported modern Minecraft instance.');command.push('--quickPlayMultiplayer',target.host+':'+target.port);}
  const token=offline?null:launchAccount.access_token;
  const redact=s=>(token?s.replaceAll(token,'[redacted]'):s).replace(/(access[_ -]?token["=:\s]+)[^\s",]+/gi,'$1[redacted]');
  const logfile=path.join(directory,'launcher-latest.log');
  let child;try{await fs.writeFile(logfile,'Boralances — '+new Date().toISOString()+'\n');
  if(process.platform==='linux'&&process.env.BORALANCES_GAMEMODERUN)command=[process.env.BORALANCES_GAMEMODERUN,...command];
  child=spawn(command[0],command.slice(1),{cwd:directory,windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(e){gameChat?.dispose();throw e;}
  games.add(instance.id,child,gameChat);
  child.once('spawn',()=>{instance.lastPlayed=Date.now();atomicJSON(path.join(directory,'instance.json'),instance).catch(()=>progress({status:'Game started; last played time could not be saved.'}));});
  emit('game',games.snapshot({startedInstanceId:instance.id}));
  let writes=Promise.resolve();
  const output=chunk=>{const s=redact(chunk.toString());emit('log',{instanceId:instance.id,text:s});writes=writes.then(()=>fs.appendFile(logfile,s)).catch(()=>{});};
  readline.createInterface({input:child.stdout}).on('line',line=>output(line+'\n'));
  readline.createInterface({input:child.stderr}).on('line',line=>output(line+'\n'));
  child.on('error',e=>{progress({status:'Game could not start: '+e.code});});
  child.on('close',code=>{games.finish(instance.id,child);multiplayer?.closeJoin(instance.id);emit('game',games.snapshot({closedInstanceId:instance.id,code}));progress({status:code===0?'Minecraft closed.':'Minecraft exited with code '+code+'. Open Logs for details.'});});
  return {started:true};
}
async function auth(){
  assert(!busy,'Wait for the current operation to finish.');
  assert(!pendingLogin,'A sign-in is already pending.');
  const redirect=new URL(microsoftConfig.REDIRECT_URI);
  assert(redirect.protocol==='http:' && ['localhost','127.0.0.1'].includes(redirect.hostname) && !redirect.username && !redirect.password && redirect.port,'Use a local HTTP redirect URL with a port, such as http://localhost:53682/callback.');
  const clientId=microsoftConfig.CLIENT_ID,redirectUri=microsoftConfig.REDIRECT_URI;
  const info=await worker('authStart',{clientId,redirectUri});
  const server=http.createServer(async(req,res)=>{
    const returned=new URL(req.url,redirect);
    if(returned.pathname!==redirect.pathname){res.writeHead(404).end();return;}
    if(returned.searchParams.get('state')!==info.state){res.writeHead(400).end('Invalid sign-in state.');return;}
    res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Microsoft returned to Boralances Launcher. Sign-in is still being checked. Return to the launcher for the result.');
    clearTimeout(pendingLogin.timer);server.close();pendingLogin=null;
    try{
      account=await worker('authComplete',{clientId,redirectUri,url:returned.href,state:info.state,verifier:info.verifier});
      await saveSecrets();await authDiagnostic({stage:'complete',code:'SUCCESS'});emit('account',accountPublic());notifyAccess();progress({status:'Signed in as '+account.name});
    }catch(e){emit('auth-error',e.message);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(redirect.port),'127.0.0.1',resolve);});
  const timer=setTimeout(()=>{server.close();pendingLogin=null;authDiagnostic({stage:'callback',code:'MS_CODE_EXPIRED'});emit('auth-error','Sign-in timed out. Start Sign in with Microsoft again.');},300000);
  pendingLogin={server,timer};
  try{await authDiagnostic({stage:'callback',code:'PENDING'});await shell.openExternal(info.url);}catch(e){clearTimeout(timer);server.close();pendingLogin=null;throw e;}
  return {pending:true};
}
function handle(channel,fn){
  ipcMain.handle(channel,async(event,p)=>{
    if(event.sender!==win.webContents || event.senderFrame.url!==indexURL)return {ok:false,error:'Untrusted request.'};
    try{const access=launcherAccess();assert(accessPolicy.allowed(channel,access,access.onboarding),access.authenticated?'Finish customizing your experience to continue.':'Sign in to Boralances or BoralancesChatting to use the launcher.');return {ok:true,data:await fn(p||{})};}catch(e){return {ok:false,error:e.message};}
  });
}
function register(){
  handle('onboarding-state',()=>launcherAccess().onboarding);
  const setupAction=(p,action)=>task('Customizing your experience',async()=>{
    assert(!games.snapshot().running,'Close Minecraft before changing experience setup.');
    const access=launcherAccess(),next=onboarding.update(setupProfiles,access,account,{...p,action});
    const value=onboarding.status(next,access,account);
    if(p.action==='theme')settings.theme=value.theme;
    if(action==='finish'){settings.playMode=value.mode;if(value.offlineName)settings.offlineName=value.offlineName;}
    await saveSettings();await atomicJSON(path.join(data,'onboarding.json'),next);setupProfiles=next;notifyAccess();return value;
  });
  handle('onboarding-update',p=>{assert(['theme','mode'].includes(p.action),'Unknown setup step.');return setupAction(p,p.action);});
  handle('onboarding-finish',p=>setupAction(p,'finish'));
  handle('onboarding-reset',p=>setupAction(p,'reset'));
  handle('auth-diagnostic',async()=>require('./auth-diagnostics.cjs').present(await readJSON(path.join(data,'auth-diagnostic.json'),null)));
  handle('auth-diagnostic-copy',async()=>{const diagnostic=require('./auth-diagnostics.cjs').normalize(await readJSON(path.join(data,'auth-diagnostic.json'),null));assert(diagnostic,'No Microsoft sign-in diagnostics yet.');clipboard.writeText(JSON.stringify({version:app.getVersion(),...diagnostic},null,2));return true;});
  handle('update-state',()=>updater.public());
  handle('update-check',()=>updater.check());
  handle('update-download',()=>updater.download());
  handle('update-cancel',()=>updater.cancel());
  handle('update-config',p=>updater.preferences(p.autoCheck));
  handle('update-install',async()=>{
    // Reserve the launcher while the helper is started; it waits for this PID to exit.
    await task('Restarting for launcher update',async()=>{
      assert(!games.snapshot().running,'Close all Minecraft instances before installing an update.');
      assert(!pendingLogin,'Finish signing in before installing an update.');
      const prepared=await updater.prepare({pid:process.pid,portableTarget:process.env.PORTABLE_EXECUTABLE_FILE,restartTarget:app.getPath('exe'),gameRunning:games.snapshot().running,busy:pendingLogin});
      const helper=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/backend/apply-update.ps1'):path.join(base,'backend/apply-update.ps1');
      await require('./update-handoff.cjs').startUpdate({helper,jobFile:prepared.file});
      updater.set({phase:'applying'});
    });
    setTimeout(()=>app.quit(),250);return true;
  });
  handle('launcher-access',async()=>{if(launcherAccess().authenticated){embeddedChat?.restore().catch(()=>{});return launcherAccess();}await embeddedChat?.restore();return launcherAccess();});
  handle('featured-creators',()=>require('./featured-creators.cjs').creators(catalog()));
  handle('state',async()=>({hardware:{memoryMB:Math.floor(os.totalmem()/1048576),freeMemoryMB:Math.floor(os.freemem()/1048576),windowMaterial:nativeAcrylic?'acrylic':'solid'},settings:{...settings,curseforgeKey:settings.curseforgeKey?'saved':''},account:accountPublic(),instances:await listInstances(),busy,game:games.snapshot()}));
  handle('versions',async()=>{try{const v=await worker('versions');await atomicJSON(path.join(data,'versions-cache.json'),v);return v;}catch(e){const cached=await readJSON(path.join(data,'versions-cache.json'),null);if(cached)return cached;throw e;}});
  handle('loaders',p=>worker('loaders',p));
  handle('create',p=>task('Creating instance',()=>createInstance(p)));
  handle('install',p=>task('Installing game and loader',()=>installGame(p.instanceId)));
  handle('launch',p=>task(p.offline?'Starting offline profile':'Preparing Minecraft',()=>launch(p)));
  handle('stop',p=>games.stop(p?.instanceId));
  handle('search',p=>catalog().search(p));
  handle('content-versions',async p=>{const instance=p.type==='modpack'||!p.instanceId?null:(await getInstance(p.instanceId)).instance;return (await catalog().versions(p.provider,p.projectId,instance,p.type)).map(({raw,...v})=>v);});
  handle('content-install',p=>task('Installing content and dependencies',async()=>{
    editable(p.instanceId);
    const {instance,directory}=await getInstance(p.instanceId);
    return core.installContent(catalog(),p,instance,directory,p.world);
  }));
  handle('pack-download',p=>task('Installing modpack into a new instance',async()=>{
    assert(['modrinth','curseforge'].includes(p.provider),'Unknown provider.');
    const temp=path.join(data,'downloads',crypto.randomUUID()+'.zip');
    try{const f=await catalog().file(p.provider,p.projectId,p.versionId);await core.download(f.url,temp,f.hashes,progress);return await importPackFile(temp,p.optional);}
    finally{await fs.rm(temp,{force:true});}
  }));
  handle('pack-import',p=>task('Importing modpack into a new instance',async()=>{
    const selected=await dialog.showOpenDialog(win,{title:'Import Modrinth or CurseForge modpack',properties:['openFile'],filters:[{name:'Modpacks',extensions:['mrpack','zip']}]});
    if(selected.canceled)return null;
    return importPackFile(selected.filePaths[0],p.optional);
  }));
  handle('curated',p=>curated(catalog(),p.collection));
  handle('optimization',p=>task('Updating game performance settings',async()=>{editable(p.instanceId);const {directory}=await getInstance(p.instanceId);return p.restore?optimize.restoreProfile(directory):optimize.applyProfile(directory,p.profile);}));
  handle('client-features',async p=>{const {instance}=await getInstance(p.instanceId);return client.listFeatures(catalog(),instance,await listContent(p.instanceId));});
  handle('client-preset',p=>task('Installing client features',async()=>{
    editable(p.instanceId);const {instance,directory}=await getInstance(p.instanceId);
    assert(!p.preset||Object.hasOwn(client.PRESETS,p.preset),'Unknown client preset.');
    const ids=p.preset?client.PRESETS[p.preset].ids:p.features;
    const result=await client.installFeatures(catalog(),instance,directory,ids,await listContent(p.instanceId));
    if(p.preset==='boost')result.optimization=await optimize.applyProfile(directory,p.profile||'balanced');
    return result;
  }));
  handle('content-list',p=>listContent(p.instanceId));
  handle('content-action',p=>task('Updating installed content',()=>contentAction(p)));
  handle('worlds',async p=>{
    const {directory}=await getInstance(p.instanceId);
    const saves=await core.contained(directory,'saves');
    const names=await fs.readdir(saves,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    const result=[];
    for(const n of names)if(n.isDirectory() && await fs.stat(await core.contained(directory,'saves/'+n.name+'/level.dat')).then(s=>s.isFile()).catch(()=>false))result.push(n.name);
    return result;
  });
  handle('local-import',p=>task('Importing local content',async()=>{
    editable(p.instanceId);
    assert(['mod','shader','resourcepack','datapack'].includes(p.type),'Choose a content type.');
    const {instance,directory}=await getInstance(p.instanceId);
    assert(p.type!=='mod'||instance.loader!=='vanilla','Mods need a modded instance.');
    const selected=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Minecraft content',extensions:p.type==='mod'?['jar']:['zip']}]});
    if(selected.canceled)return null;
    let folder={mod:'mods',shader:'shaderpacks',resourcepack:'resourcepacks',datapack:'datapacks'}[p.type];
    if(p.type==='datapack'){
      assert(p.world && !p.world.includes('/') && !p.world.includes('\\'),'Select a world.');
      assert((await fs.stat(await core.contained(directory,'saves/'+p.world+'/level.dat'))).isFile(),'Select an existing world.');
      folder='saves/'+p.world+'/datapacks';
    }
    const destinations=[];
    for(const source of selected.filePaths){
      const name=core.safeRelative(path.basename(source)),dest=await core.contained(directory,folder+'/'+name);
      assert(!await fs.stat(dest).then(()=>true).catch(()=>false),'A file with this name is already installed.');
      destinations.push([source,dest]);
    }
    const copied=[];
    try{for(const [source,dest] of destinations){await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(source,dest,require('node:fs').constants.COPYFILE_EXCL);copied.push(dest);}}
    catch(e){for(const dest of copied)await fs.rm(dest,{force:true});throw e;}
    return listContent(p.instanceId);
  }));
  handle('folder',async p=>{const {directory}=await getInstance(p.instanceId);const error=await shell.openPath(directory);assert(!error,error);});
  handle('logs',async p=>{const {directory}=await getInstance(p.instanceId);return fs.readFile(path.join(directory,'launcher-latest.log'),'utf8').then(t=>t.slice(-120000)).catch(e=>{if(e.code==='ENOENT')return 'No game logs yet.';throw e;});});
  handle('external',p=>{const u=new URL(p.url);assert(u.protocol==='https:'&&['modrinth.com','www.curseforge.com','curseforge.com','learn.microsoft.com','support.modrinth.com','docs.curseforge.com'].includes(u.hostname),'Unsupported external link.');return shell.openExternal(u.href);});
  handle('preferences',p=>task('Saving preferences',async()=>{
    assert(['glass','dark','light'].includes(p.theme),'Unknown theme.');
    const offline=core.offlineProfile(p.offlineName||settings.offlineName);
    settings={...settings,theme:p.theme,offlineName:offline.name};await saveSettings();return {theme:settings.theme,offlineName:settings.offlineName};
  }));
  handle('settings',p=>task('Saving settings',async()=>{
    assert(!pendingLogin,'Complete or wait for the current sign-in before changing settings.');
    const memory=Number(p.memory),width=Number(p.width),height=Number(p.height);
    assert(Number.isInteger(memory)&&memory>=1024&&memory<=65536,'Memory must be 1024–65536 MB.');
    assert(Number.isInteger(width)&&width>=640&&width<=7680&&Number.isInteger(height)&&height>=480&&height<=4320,'Invalid window dimensions.');
    assert(['glass','dark','light'].includes(p.theme||settings.theme),'Unknown theme.');
    const offline=core.offlineProfile(p.offlineName||settings.offlineName);
    settings={...defaults,playMode:settings.playMode,tools:settings.tools||{},theme:p.theme||settings.theme,offlineName:offline.name,memory,width,height,java:String(p.java||''),clientId:microsoftConfig.CLIENT_ID,redirectUri:microsoftConfig.REDIRECT_URI,snapshots:!!p.snapshots,glass:require('./glass-settings.cjs').normalize(p.glass||settings.glass),curseforgeKey:p.curseforgeKey==='saved'?settings.curseforgeKey:String(p.curseforgeKey||'').trim()};
    await saveSettings();return true;
  }));
  handle('java-select',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Java executable',extensions:['*']}]});return r.canceled?null:r.filePaths[0];});
  handle('auth',()=>auth());
  handle('logout',()=>task('Signing out',async()=>{assert(!games.snapshot().running,'Close the games before signing out.');if(pendingLogin){clearTimeout(pendingLogin.timer);pendingLogin.server.close();pendingLogin=null;}account=null;await saveSecrets();emit('account',null);notifyAccess();}));
  handle('window',p=>{if(p.action==='minimize')win.minimize();else if(p.action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize();}else if(p.action==='close')win.close();});
}
app.whenReady().then(async()=>{
  await load();
  updater=new (require('./updater.cjs').Updater)({data,currentVersion:app.getVersion(),mode:!app.isPackaged?'development':process.env.PORTABLE_EXECUTABLE_DIR?'portable':'installed',emit:value=>emit('update',value)});
  await updater.init();
  if(process.platform==='linux')updater.set({autoCheck:false,supported:false,notes:'Updates are provided by BoralancesOS.'});
  win=new BrowserWindow({width:1380,height:920,minWidth:1080,minHeight:760,frame:false,icon:path.join(__dirname,'../assets/launcher.png'),backgroundColor:nativeAcrylic?'#00000000':'#0b100e',...(nativeAcrylic?{backgroundMaterial:'acrylic'}:{}),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==indexURL)event.preventDefault();});
  register();
  embeddedChat=await require('./chat.cjs').createChat({win:()=>win,handle,emit,data,encrypt,decrypt,onIdentity:notifyAccess});
  require('./credentials.cjs').configureFallback({python:await pythonPath(),script:app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/backend/credentials.py'):path.join(base,'backend/credentials.py')});
  const ownerTools=require('./owner.cjs'),resolveOwner=()=>process.platform==='linux'?Promise.resolve({ownerPC:false,uid:null,email:null,bootstrap:null}):ownerTools.loadOwnerNearby(data,credentialScript(),require('./data-path.cjs').ownerCandidates(base,app.getPath('desktop')));
  const suite=await registerSuite({authChanged:notifyAccess,owner:await resolveOwner(),resolveOwner,handle,data,task,catalog,worker,getInstance,listContent,editable,createInstance,installGame,listInstances,settings:()=>settings,account:()=>account,accounts:()=>mcAccounts,setAccount:a=>{account=a;notifyAccess();},game:()=>games.snapshot().running,saveAccounts:saveSecrets,saveSettings,encrypt,decrypt,dialog,win:()=>win,assets:path.join(__dirname,'../assets/cosmetics'),clipboard});
  cloudIdentity=suite.account;
  await require('./tools.cjs').registerTools({handle,task,getInstance,listContent,editable,settings:()=>settings,saveSettings,dialog,win:()=>win,data,shell,assets:path.join(__dirname,'../assets/presets')});
  multiplayer=await require('./multiplayer.cjs').registerMultiplayer({handle,data,assets:path.join(__dirname,'../assets'),getInstance,launch,fetcher:(url,options)=>net.fetch(url,options),encrypt,decrypt,emit});
  handle('playit-open',p=>{const url=p.url&&/^https:\/\/playit\.gg\/claim\/[a-z0-9]{6}$/.test(p.url)?p.url:'https://playit.gg/account/tunnels';const panel=new BrowserWindow({parent:win,width:960,height:800,title:'Playit · Boralances Launcher',webPreferences:{partition:'persist:playit',nodeIntegration:false,contextIsolation:true,sandbox:true}});panel.webContents.on('will-navigate',(event,target)=>{if(!target.startsWith('https://'))event.preventDefault();});panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));panel.loadURL(url);return true;});
  handle('aternos-open',()=>{const panel=new BrowserWindow({parent:win,width:1120,height:800,title:'Aternos · Boralances Launcher',webPreferences:{partition:'persist:aternos',nodeIntegration:false,contextIsolation:true,sandbox:true}});panel.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('https://'))event.preventDefault();});panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));panel.loadURL('https://aternos.org/servers/');return true;});
  await win.loadURL(indexURL);
  win.show();
  if(updater.public().autoCheck&&updater.public().phase!=='ready')setTimeout(()=>updater.check(),2000);
  win.on('closed',()=>{embeddedChat?.dispose();app.quit();});
  win.on('close',event=>{
    if(multiplayer?.running.size){event.preventDefault();dialog.showMessageBoxSync(win,{type:'info',message:'Stop your hosted servers from Friends before closing the launcher. This lets Minecraft save their worlds.',buttons:['Keep launcher open']});return;}
    if(busy || games.snapshot().running){
      const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Keep launcher open','Close launcher'],defaultId:0,cancelId:0,message:busy?'An installation is running. Closing may interrupt it.':'Minecraft is running. Closing the launcher leaves the game running.'});
      if(choice===0)event.preventDefault();
    }
  });
});
app.on('window-all-closed',()=>{embeddedChat?.dispose();if(pendingLogin){clearTimeout(pendingLogin.timer);pendingLogin.server.close();}app.quit();});
app.on('before-quit',()=>updater?.cancel());
