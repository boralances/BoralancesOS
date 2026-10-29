const fs=require('node:fs/promises'),path=require('node:path');
const core=require('./core.cjs'),style=require('./player-style.cjs'),cosmetics=require('./cosmetics.cjs'),ready=require('./ready.cjs'),client=require('./features.cjs'),optimize=require('./optimization.cjs'),{Firebase,validatePublication}=require('./firebase.cjs');
const {assert,readJSON,atomicJSON,offlineProfile}=core;
const wings=require('./wings.cjs'),emotes=require('./emotes.cjs');
async function registerSuite(ctx){
 const {handle,data,task,catalog,worker,getInstance,listContent,editable,createInstance,installGame,listInstances,settings,account,accounts,saveAccounts,encrypt,decrypt,dialog,win,assets,clipboard}=ctx;
 let saved=await readJSON(path.join(data,'cloud-session.json'),null),session=null;
 if(saved)try{session=decrypt(saved.value);}catch{}
 let owner=ctx.owner||{ownerPC:false,uid:null,email:null,bootstrap:null};
 const importedBootstrap=!session&&owner.ownerPC&&owner.bootstrap;
 if(importedBootstrap)session=owner.bootstrap;
 const cloud=new Firebase(session,fetch,owner.ownerPC?owner.uid:null);
 const publicSkin=style.createSkinCache();
 const persist=async()=>{if(cloud.session)await atomicJSON(path.join(data,'cloud-session.json'),{value:encrypt(cloud.session)});else await fs.rm(path.join(data,'cloud-session.json'),{force:true});};
 if(importedBootstrap)await persist();
 if(owner.ownerPC&&owner.bootstrap)await require('./owner.cjs').consumeBootstrap(data);
 const saveLibrary=ids=>atomicJSON(path.join(data,'cosmetic-library.json'),ids);
 const library=()=>readJSON(path.join(data,'cosmetic-library.json'),[]);
 async function cloudProducts(){try{const all=await cloud.db('public/cosmetics')||{};return Object.values(all).slice(0,100).map(p=>{const v=validatePublication('cosmetics',p);return {...v,asset:'data:image/png;base64,'+v.texture,currency:'FREE'};});}catch{return [];}}
 async function product(id){const builtin=cosmetics.PRODUCTS.find(p=>p.id===id);return builtin||(await cloudProducts()).find(p=>p.id===id);}
 async function entitled(p){assert(p,'Unknown cosmetic.');if(p.voucherOnly){assert(cloud.session,'Sign in and redeem a voucher for this skin.');const owned=await cloud.db('entitlements/'+cloud.session.uid+'/'+p.id);assert(typeof owned?.voucher==='string','Redeem a voucher to unlock this cosmetic.');}return p;}
 async function texture(p){return p.texture?Buffer.from(p.texture,'base64'):fs.readFile(path.join(assets,p.id+'.png'));}
 async function loader(p){const {instance,directory}=await getInstance(p.instanceId);editable(p.instanceId);const r=await client.installFeatures(catalog(),instance,directory,['localcosmetics'],await listContent(p.instanceId));assert(!r.skipped.length,'CustomSkinLoader has no compatible release for this instance.');return directory;}
 async function readyBundles(){
  const list=await ready.presets(await worker('versions'),p=>worker('loaders',p));
  for(const p of list){const bundle=await readJSON(path.join(assets,'../presets',p.id+'.json'),null);if(bundle){p.bundle=bundle;p.loaderVersion=bundle.loaderVersion;p.customization=bundle.customization;p.themes=require('./ready-customization.cjs').THEMES.map(({id,name})=>({id,name}));p.description=bundle.modFiles+' pinned mod files, FancyMenu, Drippy loading, Essential, animated wings and '+bundle.emotes+' original emotes.';p.available=p.available&&!!bundle.file;}}
  return list;
 }
 handle('ready-list',readyBundles);
 handle('native-client-state',async p=>{const {instance,directory}=await getInstance(p.instanceId),native=require('./native-client.cjs');return {supported:instance.loader==='fabric'&&native.VERSIONS.includes(instance.minecraft),installed:await fs.stat(await core.contained(directory,'mods/'+native.JAR)).then(s=>s.isFile()).catch(()=>false),menuKey:(await readJSON(await core.contained(directory,'config/boralances-client/client.json'),{})).menuKey||'F9'};});
 handle('native-client-install',p=>task('Installing in-game client menu',async()=>{const {instance,directory}=await getInstance(p.instanceId),native=require('./native-client.cjs');editable(instance.id);assert(instance.loader==='fabric'&&native.VERSIONS.includes(instance.minecraft),'The Boralances menu supports Fabric on the four ready-pack versions.');const providers=await client.installFeatures(catalog(),instance,directory,['cosmetics','emotes'],await listContent(instance.id));assert(!providers.skipped.length,'Compatible Ears and Emotecraft providers are required: '+providers.skipped.map(s=>s.reason).join('; '));for(const item of require('./wardrobe-expansion.cjs').EMOTES)await emotes.install(directory,item.id,assets);return native.install(directory,path.join(assets,'..'));}));
 handle('ready-download',async p=>{
  const item=ready.selectPreset(await readyBundles(),p.id);assert(item.bundle,'The ready bundle is missing. Repair the launcher.');
  const custom=require('./ready-customization.cjs'),selected=custom.normalize(p.id,p.customization),bytes=await custom.exportPack(path.join(assets,'../presets',item.bundle.file),p.id,selected,path.join(assets,'../menu-themes'));
  const chosen=await dialog.showSaveDialog(win(),{defaultPath:'Boralances-'+selected.name.replaceAll(' ','-')+'.mrpack',filters:[{name:'Modrinth ready instance',extensions:['mrpack']}]});if(chosen.canceled)return null;
  await fs.writeFile(chosen.filePath,bytes);return {file:chosen.filePath,minecraft:item.minecraft};
 });
 handle('ready-install',p=>task('Installing Optimization + Extras',async()=>{
  const preset=ready.selectPreset(await readyBundles(),p.id);assert(preset.bundle,'The ready bundle is missing. Repair the launcher.');
  const file=path.join(assets,'../presets',preset.bundle.file),pack=core.inspectPack(file);assert(pack.minecraft===preset.minecraft&&pack.loader==='fabric'&&pack.loaderVersion===preset.bundle.loaderVersion,'Ready bundle does not match its selected version.');
  const selected=require('./ready-customization.cjs').normalize(p.id,{...p.customization,profile:p.profile||p.customization?.profile||'balanced'});
  let instance=await createInstance({name:selected.name,minecraft:preset.minecraft,loader:preset.loader,loaderVersion:preset.loaderVersion});
  const {directory}=await getInstance(instance.id);
  try{
   await atomicJSON(path.join(directory,'instance.json'),{...instance,presetId:preset.id,presetVersion:'1.6.0',presetPrepared:false,performanceProfile:selected.profile,readyCustomization:selected});instance=await installGame(instance.id);
   return {instance,result:{installed:preset.bundle.modFiles,alreadyEnabled:[],skipped:preset.bundle.skipped,emotes:preset.bundle.emotes}};
  }catch(e){throw new Error(instance.name+' was created. '+e.message+' Select it in Play and use Install / repair to continue.');}
 }));
 handle('owner-state',async()=>{if(ctx.resolveOwner){owner=await ctx.resolveOwner();cloud.ownerUID=owner.ownerPC?owner.uid:null;}return {ownerPC:owner.ownerPC,uid:owner.ownerPC?owner.uid:null,email:owner.ownerPC?owner.email:null,status:owner.status|| (owner.ownerPC?'verified':'missing'),accountUID:require('./owner-account.cjs').uid,scope:'boralanceslauncher'};});
 handle('admin-rules',()=>{assert(owner.ownerPC,'Rule generation is available only on the enrolled owner PC.');const fragment=JSON.stringify(require('./cloud-rules.cjs').launcherRules(owner.uid),null,2);return {fragment,uid:owner.uid,scope:'boralanceslauncher',mergeOnly:true};});
 handle('admin-rules-copy',()=>{assert(owner.ownerPC,'Use your enrolled owner PC.');const fragment=JSON.stringify(require('./cloud-rules.cjs').launcherRules(owner.uid),null,2);clipboard.writeText(fragment);return {copied:true,scope:'boralanceslauncher'};});
 handle('cloud-state',()=>cloud.public());
 handle('cloud-auth',p=>task('Signing in to Boralances',async()=>{await cloud.authenticate(p);await persist();ctx.authChanged?.();return cloud.public();}));
 handle('cloud-logout',()=>task('Signing out of Boralances',async()=>{cloud.session=null;await persist();ctx.authChanged?.();return null;}));
 handle('cloud-sync',()=>task('Syncing launcher profile',async()=>{
  const s=settings();const profile={profile:{name:cloud.public()?.name,email:cloud.public()?.email,updatedAt:Date.now()},preferences:{theme:s.theme,glass:s.glass,offlineName:s.offlineName,memory:s.memory,width:s.width,height:s.height},library:(await library()).filter(id=>!cosmetics.PRODUCTS.find(p=>p.id===id)?.voucherOnly),instances:(await listInstances()).map(i=>({name:i.name,minecraft:i.minecraft,loader:i.loader,loaderVersion:i.loaderVersion}))};
  await cloud.sync(profile);await persist();return {synced:true,path:'boralanceslauncher/main/name/'+cloud.public().uid};
 }));
 handle('cloud-restore',()=>task('Restoring cloud preferences',async()=>{const p=await cloud.data();assert(p,'No cloud profile has been saved yet.');const s=p.preferences||{};if(s.glass)settings().glass=require('./glass-settings.cjs').normalize(s.glass);if(['glass','dark','light'].includes(s.theme))settings().theme=s.theme;if(s.offlineName)settings().offlineName=offlineProfile(s.offlineName).name;await ctx.saveSettings();const ids=await library();for(const id of Array.isArray(p.library)?p.library:[])if((await product(id))&&!ids.includes(id))ids.push(id);await saveLibrary(ids);await persist();return {restored:true};}));
 handle('cloud-public',async()=>({servers:Object.values(await cloud.db('public/servers')||{}).map(p=>validatePublication('servers',p)),featured:Object.values(await cloud.db('public/featured')||{}).map(p=>validatePublication('featured',p))}));
 handle('admin-publish',p=>task('Publishing featured content',async()=>cloud.publish(p.kind,p.item)));
 handle('voucher-redeem',p=>task('Redeeming free voucher',async()=>{const id=await cloud.redeem(p.code);const item=await entitled(await product(id));const ids=await library();if(!ids.includes(item.id))ids.push(item.id);await saveLibrary(ids);await persist();return {id:item.id,name:item.name};}));
 handle('wardrobe',async()=>{const products=[...await Promise.all(cosmetics.PRODUCTS.map(async p=>({...p,...(p.type==='Emote'?{animation:emotes.animation(p.id)}:{}),asset:'data:image/png;base64,'+(await fs.readFile(path.join(assets,p.id+'.png'))).toString('base64')}))),...await cloudProducts()];return {products,claimed:await library()};});
 handle('wardrobe-claim',p=>task('Adding cosmetic',async()=>{const item=await entitled(await product(p.id)),ids=await library();if(!ids.includes(item.id))ids.push(item.id);await saveLibrary(ids);return ids;}));
 handle('wardrobe-equip',p=>task('Equipping player style',async()=>{
  const username=offlineProfile(p.username||settings().offlineName).name,item=await entitled(await product(p.id));assert((await library()).includes(item.id),'Add this cosmetic to your library first.');
  const {instance,directory}=await getInstance(p.instanceId);editable(p.instanceId);
  if(require('./wearables.cjs').TYPES[item.type])return require('./expansion.cjs').equipWearable(ctx,{...p,username},item,await texture(item));
  const ids=item.type==='Emote'?['emotes']:item.type==='Animated Wings'?['localcosmetics','cosmetics']:['localcosmetics'];
  const installed=await client.installFeatures(catalog(),instance,directory,ids,await listContent(p.instanceId));assert(!installed.skipped.length,installed.skipped.map(x=>x.reason).join(' '));
  if(item.type==='Emote'){await emotes.install(directory,item.id,assets);return {name:item.name,username,type:item.type,instructions:'Restart Minecraft, open the Emotecraft menu, select the Boralances folder and assign an emote wheel slot.'};}
  const bytes=await texture(item);
  if(item.type==='Animated Wings'){
   let base=await fs.readFile(await core.contained(directory,'CustomSkinLoader/LocalSkin/skins/'+username+'.png')).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),model=p.model||'default';
   if(!base){let player;try{player=await publicSkin(username);}catch{throw new Error('Import your custom player skin first, or enter a Minecraft username with a public skin, then equip animated wings.');}base=Buffer.from(player.skin.split(',')[1],'base64');model=player.model;}
   await wings.equip(directory,username,base,bytes,{mode:item.wingMode||1,animated:true,model,id:item.id});
  }else await style.equipTexture(directory,username,item.type==='Skin'?'skin':item.type==='Wings'?'elytra':'cape',bytes,p.model||'default');
  if(instance.loader==='fabric'&&require('./native-client.cjs').VERSIONS.includes(instance.minecraft)&&item.type!=='Skin')await require('./native-client.cjs').selectCosmetic(directory,item,bytes);
  return {name:item.name,username,type:item.type};
 }));
 handle('animated-wings-remove',p=>task('Restoring skin before cosmetic wings',async()=>{editable(p.instanceId);const {directory}=await getInstance(p.instanceId);const result=await wings.remove(directory,p.username);await require('./native-client.cjs').restoreSlot(directory,'wings',p.username);return result;}));
 handle('emote-remove',p=>task('Removing original emote',async()=>{editable(p.instanceId);const {directory}=await getInstance(p.instanceId);return emotes.remove(directory,p.id);}));
 handle('wardrobe-remove',p=>task('Restoring previous cosmetic',async()=>{editable(p.instanceId);const {directory}=await getInstance(p.instanceId);let result;const kind=p.kind||'cape';try{result=await style.removeTexture(directory,p.username,kind);}catch(e){if(kind==='cape')result=await cosmetics.removeCape(directory,p.username);else throw e;}await require('./native-client.cjs').restoreSlot(directory,kind,p.username);return result;}));
 handle('admin-texture',async p=>{assert(cloud.public()?.admin,'Admin privileges are required.');const r=await dialog.showOpenDialog(win(),{properties:['openFile'],filters:[{name:'Cosmetic texture',extensions:['png']}]});if(r.canceled)return null;const b=await fs.readFile(r.filePaths[0]);if(require('./wearables.cjs').TYPES[p.type])require('./wearables.cjs').validateOverlay(b,p.type);else style.validatePNG(b,p.type==='Skin'?'skin':p.type==='Animated Wings'?'wing':'cape');return 'data:image/png;base64,'+b.toString('base64');});
 handle('admin-voucher',p=>task('Creating free voucher',async()=>{assert(cloud.public()?.admin,'Admin privileges are required.');const item=await product(p.id);assert(item,'Cosmetic not found.');const crypto=require('node:crypto'),code=crypto.randomBytes(12).toString('hex').toUpperCase(),hash=crypto.createHash('sha256').update(code).digest('hex');await cloud.db('vouchers/'+hash,'PUT',{product:item.id,expires:Date.now()+365*86400000});return {code:code.match(/.{1,4}/g).join('-'),product:item.name};}));
 handle('wardrobe-download',async p=>{const item=await entitled(await product(p.id)),emote=item.type==='Emote',chosen=await dialog.showSaveDialog(win(),{defaultPath:item.id+(emote?'.json':'.png'),filters:[{name:emote?'Emotecraft animation':'Player texture',extensions:[emote?'json':'png']}]});if(chosen.canceled)return null;await fs.writeFile(chosen.filePath,emote?JSON.stringify(emotes.animation(item.id),null,2)+'\n':await texture(item));return true;});
 handle('skin-import',p=>task('Importing custom player skin',async()=>{
  const username=offlineProfile(p.username||settings().offlineName).name,chosen=await dialog.showOpenDialog(win(),{properties:['openFile'],filters:[{name:'Minecraft skin',extensions:['png']}]});if(chosen.canceled)return null;const bytes=await fs.readFile(chosen.filePaths[0]);style.validatePNG(bytes);
  const directory=await loader(p);assert(!(await readJSON(path.join(directory,'boralances-wings.json'),{}))[username],'Restore animated wings before importing another skin.');await style.equipTexture(directory,username,'skin',bytes,p.model||'default');return {name:username,skin:'data:image/png;base64,'+bytes.toString('base64'),model:p.model||'default',source:'Custom local skin'};
 }));
 handle('skin-remove',p=>task('Removing custom texture',async()=>{editable(p.instanceId);const {directory}=await getInstance(p.instanceId);if((p.kind||'skin')==='skin')assert(!(await readJSON(path.join(directory,'boralances-wings.json'),{}))[p.username],'Restore animated wings before restoring the skin.');const kind=p.kind||'skin',result=await style.removeTexture(directory,p.username,kind);await require('./native-client.cjs').restoreSlot(directory,kind,p.username);return result;}));
 handle('skin-preview',async p=>{const username=offlineProfile(p.username||settings().offlineName).name;if(p.source!=='public'&&p.instanceId){const {directory}=await getInstance(p.instanceId),file=await core.contained(directory,'CustomSkinLoader/LocalSkin/skins/'+username+'.png');const bytes=await fs.readFile(file).catch(()=>null);if(bytes){style.validatePNG(bytes);return {name:username,skin:'data:image/png;base64,'+bytes.toString('base64'),model:(await readJSON(path.join(directory,'player-style.json'),{}))[username+'_skin']?.model||'default',source:'Custom local skin'};}}return publicSkin(username,{refresh:!!p.refresh});});
 handle('account-list',()=>accounts().map(a=>({id:a.id,name:a.name,active:a.id===account()?.id})));
 handle('account-switch',p=>task('Switching Minecraft account',async()=>{const a=accounts().find(a=>a.id===p.id);assert(a,'Account not found.');ctx.setAccount(a);await saveAccounts();return {id:a.id,name:a.name};}));
 async function mcProfile(){assert(account(),'Sign in with Microsoft to manage your owned Minecraft cloaks.');const a=await worker('refresh',{clientId:settings().clientId,refreshToken:account().refresh_token});ctx.setAccount(a);const all=accounts(),index=all.findIndex(x=>x.id===a.id);if(index>=0)all[index]=a;await saveAccounts();const r=await fetch('https://api.minecraftservices.com/minecraft/profile',{headers:{Authorization:'Bearer '+a.access_token},signal:AbortSignal.timeout(15000)});assert(r.ok,'Minecraft wardrobe is unavailable.');return r.json();}
 handle('minecraft-wardrobe',async()=>{const p=await mcProfile();return {name:p.name,skins:p.skins||[],capes:p.capes||[]};});
 handle('minecraft-cape',p=>task('Selecting owned Minecraft cloak',async()=>{const profile=await mcProfile();assert(p.id===null||profile.capes.some(c=>c.id===p.id),'This account does not own that cloak.');const r=await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active',{method:p.id===null?'DELETE':'PUT',headers:{Authorization:'Bearer '+account().access_token,'Content-Type':'application/json'},...(p.id?{body:JSON.stringify({capeId:p.id})}:{}),signal:AbortSignal.timeout(15000)});assert(r.ok,'Minecraft did not accept the cloak change.');return true;}));
 handle('server-copy',p=>{const item=validatePublication('servers',{id:'copy',name:'Server',address:p.address});clipboard.writeText(item.address);return true;});
 await require('./expansion.cjs').registerExpansion({...ctx,cloud,product,entitled,texture});
 return {account:()=>cloud.public()};
}
module.exports={registerSuite};
