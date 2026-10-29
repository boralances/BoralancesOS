'use strict';
const {BrowserWindow,WebContentsView,session}=require('electron');
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const URL_CHAT='https://boralances.boranil400.workers.dev/chat',ORIGIN=new URL(URL_CHAT).origin,PROXY='https://api-proxy.boranil400.workers.dev';
const PARTITION='persist:boralanceschatting';
const policy=require('./chat-policy.cjs');
const sessionCode=require('./chat-session.cjs');
async function createChat({win,handle,emit,data,encrypt,decrypt,onIdentity=()=>{}}){
 let view,viewReady,profile=null,verifiedAt=0,verifiedToken='',visible=false,disposed=false;
 let savedSession=null,restored=false,restoring=null,checking=null,identityGeneration=0;
 const storedFile=data?path.join(data,'chat-session.json'):null;
 if(storedFile)try{savedSession=decrypt(JSON.parse(await fs.readFile(storedFile,'utf8')).value);if(savedSession.expires>Date.now()){profile=policy.publicProfile(savedSession.profile);verifiedToken=savedSession.token;}}catch{}
 const announce=()=>{emit('chat-account',profile);onIdentity();};
 const persist=async()=>{if(!storedFile)return;if(profile&&verifiedToken){const value={token:verifiedToken,profile,expires:sessionCode.expiry(verifiedToken)};await require('./core.cjs').atomicJSON(storedFile,{value:encrypt(value)});savedSession=value;}else{savedSession=null;await fs.rm(storedFile,{force:true});}};
 const theme=await Promise.all(['liquid-glass-theme.css','physical-glass.js','liquid-glass-theme.js','glass-components.css','glass-interactions.js','sidebar-glass.js','sidebar-pointer-glass.css'].map(file=>fs.readFile(path.join(__dirname,'../assets/chat-glass',file),'utf8')));
 const decorate=async contents=>{if(new URL(contents.getURL()).origin!==ORIGIN)return;await contents.insertCSS(theme[0]+"\n"+theme[3]+"\n"+theme[6]);await contents.executeJavaScript('if(!window.__boralancesGlassInstalled){if(!document.getElementById("boralances-physical-glass"))window.__boralancesPhysicalGlassManaged=true;'+theme[1]+'\n'+theme[4]+'\n'+theme[2]+'\nwindow.__boralancesGlassInstalled=true;}\n'+theme[5]);};
 const privacy=session.fromPartition(PARTITION);privacy.setPermissionRequestHandler((contents,permission,callback)=>callback(false));privacy.setPermissionCheckHandler(()=>false);
 const trusted=contents=>{try{return new URL(contents.getURL()).origin===ORIGIN;}catch{return false;}};
 const applyToken=async(contents,token)=>{if(trusted(contents))await contents.executeJavaScript(sessionCode.apply(token,profile?.uid));};
 const secure=contents=>{
  contents.on('did-finish-load',()=>{decorate(contents).catch(()=>{});});
  contents.on('will-navigate',(event,url)=>{if(!policy.allowedNavigation(url))event.preventDefault();});
  contents.setWindowOpenHandler(({url})=>{if(!policy.allowedNavigation(url))return {action:'deny'};return {action:'allow',overrideBrowserWindowOptions:{parent:win(),width:660,height:760,webPreferences:{partition:PARTITION,nodeIntegration:false,contextIsolation:true,sandbox:true}}};});
  contents.on('will-attach-webview',event=>event.preventDefault());
 };
 async function ensureView(){if(!view){view=new WebContentsView({webPreferences:{partition:PARTITION,nodeIntegration:false,contextIsolation:true,sandbox:true}});secure(view.webContents);viewReady=view.webContents.loadURL(URL_CHAT).catch(e=>{view.webContents.close();view=null;throw e;});}await viewReady;return view;}
 const gameSessions=new Set();
 async function clearIdentity(){identityGeneration++;profile=null;verifiedAt=0;verifiedToken='';await persist();announce();}
 async function verifyAccount(){
  const v=await ensureView();if(!trusted(v.webContents))throw Error('Return to BoralancesChatting to finish signing in.');
  let state=await v.webContents.executeJavaScript(sessionCode.READ);
  if(!state.token&&!state.signedOut&&savedSession?.expires>Date.now()){await applyToken(v.webContents,savedSession.token);state=await v.webContents.executeJavaScript(sessionCode.READ);}
  const saved=state.token;
  if(!saved){await clearIdentity();return null;}
  if(profile&&verifiedToken===saved&&Date.now()-verifiedAt<30000)return profile;
  const generation=identityGeneration;
  const response=await fetch(PROXY+'/session',{headers:{Authorization:'Bearer '+saved,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(generation!==identityGeneration)return profile;
  if(!response.ok){if(response.status===401||response.status===403){await signOut();throw Error('Your chat session expired. Sign in inside Chat.');}throw Error('Chat verification is unavailable. Your saved login is kept.');}
  const result=await response.json();if(generation!==identityGeneration)return profile;
  const current=await v.webContents.executeJavaScript(sessionCode.READ);if(!current.token||current.signedOut){await clearIdentity();return null;}if(current.token!==saved)return profile;
  profile=policy.publicProfile(result.user);verifiedAt=Date.now();verifiedToken=typeof result.token==='string'&&result.token?result.token:saved;
  await persist();await applyToken(v.webContents,verifiedToken);
  await Promise.allSettled([...gameSessions].map(s=>s.sync(verifiedToken)));announce();return profile;
 }
 const account=()=>{if(!checking)checking=verifyAccount().finally(()=>{checking=null;});return checking;};
 async function restore(){if(restored)return profile;if(!restoring)restoring=account().catch(()=>profile).finally(()=>{restored=true;restoring=null;});return restoring;}
 async function signOut(){await clearIdentity();await Promise.allSettled([view?.webContents,...[...gameSessions].map(s=>s.contents())].filter(Boolean).map(c=>trusted(c)?c.executeJavaScript(sessionCode.CLEAR):null));privacy.flushStorageData?.();return true;}
 const hide=()=>{if(view&&visible){win().contentView.removeChildView(view);visible=false;}};
 handle('chat-show',async p=>{const v=await ensureView();if(!visible){win().contentView.addChildView(v);visible=true;}v.setBounds(policy.bounds(p,win().getContentBounds()));v.webContents.focus();return {url:URL_CHAT};});
 handle('chat-bounds',p=>{if(view&&visible)view.setBounds(policy.bounds(p,win().getContentBounds()));return true;});
 handle('chat-hide',()=>{hide();return true;});
 handle('chat-reload',async()=>{const v=await ensureView();v.webContents.reload();return true;});
 handle('chat-account',account);
 handle('chat-signout',signOut);
 // Each running instance owns its token, frames and input queue.
 async function createGameSession(){
  let offscreen,png=null,active=false,ended=false;const token=crypto.randomBytes(32).toString('hex');
 async function ensureOffscreen(){if(!offscreen){offscreen=new BrowserWindow({show:false,width:1280,height:720,useContentSize:true,webPreferences:{partition:PARTITION,nodeIntegration:false,contextIsolation:true,sandbox:true,offscreen:true,backgroundThrottling:false}});secure(offscreen.webContents);offscreen.webContents.setFrameRate(10);offscreen.webContents.on('paint',(_,dirty,image)=>{if(active)png=image.toPNG();});await offscreen.loadURL(URL_CHAT);}offscreen.webContents.startPainting();return offscreen;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.authorization!=='Bearer '+token||req.headers.origin){res.writeHead(403).end();return;}
  try{
   if(req.url==='/frame'&&req.method==='GET'){if(!active||!png){res.writeHead(204).end();return;}res.writeHead(200,{'Content-Type':'image/png'}).end(png);return;}
   if(req.method!=='POST'){res.writeHead(405).end();return;}
   let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>16384){res.writeHead(413).end();return;}chunks.push(chunk);}
   if(req.url==='/open'){active=true;await account().catch(e=>{if(!profile)throw e;});const target=await ensureOffscreen();if(verifiedToken)await applyToken(target.webContents,verifiedToken);res.writeHead(204).end();return;}
   if(req.url==='/close'){active=false;png=null;offscreen?.webContents.stopPainting();res.writeHead(204).end();return;}
   if(req.url==='/input'){if(!active||!offscreen){res.writeHead(409).end();return;}const events=policy.inputEvents(JSON.parse(Buffer.concat(chunks).toString()));for(const event of events)offscreen.webContents.sendInputEvent(event);res.writeHead(204).end();return;}
   res.writeHead(404).end();
  }catch{if(!res.headersSent)res.writeHead(400);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const session={bridge:{url:'http://127.0.0.1:'+server.address().port,token,width:1280,height:720},contents:()=>offscreen?.webContents,sync:token=>offscreen?applyToken(offscreen.webContents,token):Promise.resolve(),dispose(){if(ended)return;ended=true;active=false;png=null;server.close();if(offscreen&&!offscreen.isDestroyed())offscreen.destroy();gameSessions.delete(session);}};gameSessions.add(session);return session;
 }
 return {createGameSession,restore,public:()=>profile,dispose(){if(disposed)return;disposed=true;for(const session of gameSessions)session.dispose();if(view&&visible&&win()&&!win().isDestroyed())hide();view?.webContents.close();}};
}
module.exports={createChat,URL_CHAT};
