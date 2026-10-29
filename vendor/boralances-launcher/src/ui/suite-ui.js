'use strict';
Object.assign(labels,{ready:['READY TO MAKE YOURS','Optimization + Extras.'],servers:['COMMUNITIES & CREATORS','Featured servers.'],account:['BORALANCES ACCOUNT','Your launcher, connected.'],admin:['CREATOR TOOLS','Admin studio.']});
let ownerState={ownerPC:false},cloudAccount=null,cloudSignup=false,ownedCloaks=[],adminPainting=false;
async function loadReadyInstances(){
 if(typeof loadVanillaInstances==='function')await loadVanillaInstances();
 $('ready-grid').innerHTML=loading('Loading four downloadable instances…');const items=await api('ready-list');
 $('ready-grid').innerHTML=items.map(p=>{
  const bundle=p.bundle,features=bundle?.features||[],skipped=bundle?.skipped||[],custom=p.customization||bundle?.customization||{name:p.name,theme:'aurora'},themes=p.themes||[{id:custom.theme,name:custom.theme}];
  const saved=state.instances.find(i=>i.presetId===p.id);
  return '<article class="content-card ready-card"><div class="ready-cover"><img class="ready-art" data-ready-preview="'+escape(p.id)+'" src="../../assets/menu-themes/'+escape(custom.theme)+'/background.png" alt="'+escape(custom.theme)+' landscape" loading="lazy"><span class="sponsor-badge">BORALANCES / '+escape(custom.theme.toUpperCase())+'</span><span class="ready-version">'+escape(p.minecraft)+'</span></div><div class="ready-card-body"><div class="ready-meta">FABRIC'+(saved?' · IN YOUR LIBRARY':' · OPTIMIZATION + EXTRAS')+'</div><h3>'+escape(p.name)+'</h3><p>'+escape(p.description)+'</p><div class="hud-tags"><span>Widgets</span><span>Wardrobe</span><span>Custom menus</span></div><details class="ready-details"><summary>Customize &amp; included mods</summary><div class="ready-customize"><label>Instance name<input data-ready-name="'+escape(p.id)+'" maxlength="40" value="'+escape(custom.name)+'" spellcheck="false"></label><label>Menu design<select data-ready-theme="'+escape(p.id)+'">'+themes.map(t=>'<option value="'+escape(t.id)+'" '+(t.id===custom.theme?'selected':'')+'>'+escape(t.name)+'</option>').join('')+'</select></label></div><p>'+features.map(x=>escape(x.name)).join(' · ')+'</p>'+(skipped.length?'<p class="small">Skipped: '+skipped.map(x=>escape(x.name+' — '+x.reason)).join('; ')+'</p>':'<p class="small">All selected features have compatible dependencies.</p>')+'</details><div class="ready-files">'+escape(bundle?bundle.modFiles+' verified mod files':'Pinned ready instance')+'</div><div class="settings-actions">'+(saved?'<button data-ready-open="'+escape(saved.id)+'" class="button primary">Open instance →</button>':'')+'<button data-ready="'+escape(p.id)+'" class="button '+(saved?'subtle':'primary')+'" '+(!p.available?'disabled':'')+' data-mutation>'+(saved?'Create another':'↓ Install instance')+'</button><button data-ready-download="'+escape(p.id)+'" class="button subtle" aria-label="Download '+escape(p.name)+' as mrpack">.mrpack ↓</button></div></div></article>';

 }).join('');
 $('ready-grid').querySelectorAll('[data-ready-open]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.readyOpen;localStorage.setItem('selected-instance',selectedId);navigate('home');});
 const customize=id=>({name:$('ready-grid').querySelector('[data-ready-name="'+id+'"]').value,theme:$('ready-grid').querySelector('[data-ready-theme="'+id+'"]').value,profile:$('ready-profile').value});
 $('ready-grid').querySelectorAll('[data-ready-theme]').forEach(select=>select.addEventListener('change',()=>{$('ready-grid').querySelector('[data-ready-preview="'+select.dataset.readyTheme+'"]').src='../../assets/menu-themes/'+select.value+'/background.png';}));
 $('ready-grid').querySelectorAll('[data-ready]').forEach(b=>b.addEventListener('click',()=>action(async()=>{
  const r=await api('ready-install',{id:b.dataset.ready,customization:customize(b.dataset.ready)});selectedId=r.instance.id;await refresh();$('ready-result').classList.remove('hidden');
  $('ready-result').textContent=r.instance.name+' installed. '+r.result.installed+' pinned mod files and '+(r.result.emotes||20)+' original animations.'+(r.result.skipped.length?' Skipped: '+r.result.skipped.map(x=>x.name).join(', ')+'.':'');toast('Ready instance installed. Select it from Play.');
 })));
 $('ready-grid').querySelectorAll('[data-ready-download]').forEach(b=>b.addEventListener('click',()=>action(async()=>{const r=await api('ready-download',{id:b.dataset.readyDownload,customization:customize(b.dataset.readyDownload)});if(r)toast(r.minecraft+' .mrpack saved. Import it into a compatible launcher.');})));
}
async function loadFeaturedServers(){
 $('servers-grid').innerHTML=loading('Loading featured servers…');const p=await api('cloud-public');
 $('servers-grid').innerHTML=p.servers.length?p.servers.map((s,i)=>'<article class="content-card"><span class="sponsor-badge">FEATURED SERVER</span><h3>'+escape(s.name)+'</h3><p>'+escape(s.description)+'</p><code>'+escape(s.address)+'</code><div class="content-foot"><span>'+escape(s.version||'Check server versions')+'</span><button data-server="'+i+'" class="button subtle">Copy address</button></div></article>').join(''):empty('The next community belongs here.','An admin can publish servers from Admin studio.');
 $('servers-grid').querySelectorAll('[data-server]').forEach(b=>b.addEventListener('click',()=>action(async()=>{await api('server-copy',{address:p.servers[Number(b.dataset.server)].address});toast('Server address copied. Join from Minecraft Multiplayer.');})));
 $('cloud-featured-grid').innerHTML=p.featured.length?p.featured.map((x,i)=>'<article class="content-card"><span class="sponsor-badge">'+escape(x.provider.toUpperCase())+' · '+escape(x.type.toUpperCase())+'</span><h3>'+escape(x.name)+'</h3><p>'+escape(x.description)+'</p><button data-cloud-project="'+i+'" class="button subtle">View releases</button></article>').join(''):empty('Curated by Boralances.','Admin-published projects will appear here and in their matching collection.');
 $('cloud-featured-grid').querySelectorAll('[data-cloud-project]').forEach(b=>b.addEventListener('click',()=>action(()=>{const x=p.featured[Number(b.dataset.cloudProject)];return openProject({...x,id:x.projectId,url:x.provider==='curseforge'?'https://www.curseforge.com/minecraft':'https://modrinth.com/project/'+x.projectId},x.provider,x.type);})));
}
async function loadLauncherAccount(){
 ownerState=await api('owner-state');cloudAccount=await api('cloud-state');
 $('cloud-heading').textContent=cloudAccount?'Welcome, '+cloudAccount.name+'.':'Your launcher, connected.';
 $('cloud-status').textContent=cloudAccount?cloudAccount.email+(cloudAccount.admin?' · Administrator on this owner PC':''):'Sign in to sync your preferences and redeem free skin vouchers.';
 $('owner-pc-note').textContent=ownerState.ownerPC?'This Windows account is the owner PC. Admin publishing is limited to '+ownerState.email+' in boralanceslauncher.':ownerState.status==='unavailable'?'Both Windows credential readers failed to read the enrollment. Retry the check on your original Windows account; do not delete your data folder.':ownerState.status==='mismatch'?'This enrollment belongs to a different Windows account or PC. Use your original owner enrollment.':'Owner enrollment was not found beside this launcher. Keep its data folder with it, then reopen Launcher account.';
 $('owner-pc-note').classList.toggle('owner-active',ownerState.ownerPC);
 $('cloud-form').classList.toggle('hidden',!!cloudAccount);$('cloud-signed-in').classList.toggle('hidden',!cloudAccount);
 $('admin-nav').classList.toggle('hidden',!ownerState.ownerPC);
 const recoveryAccount=!!cloudAccount&&(cloudAccount.admin||cloudAccount.uid===ownerState.accountUID);
 $('owner-retry').classList.toggle('hidden',!recoveryAccount);$('admin-refresh').classList.toggle('hidden',!recoveryAccount);
 $('admin-status').textContent=ownerState.ownerPC?(cloudAccount?.admin?'Owner verified · Admin signed in':cloudAccount?'Owner verified · Sign out and sign in as '+ownerState.email:'Owner verified · Sign in as '+ownerState.email):$('owner-pc-note').textContent;
 $('admin-signin').classList.toggle('hidden',!!cloudAccount?.admin);
 $('admin-lock').classList.toggle('hidden',!!cloudAccount?.admin);$('admin-publish').disabled=!cloudAccount?.admin||!!state.busy;
 $('admin-create-voucher').disabled=!cloudAccount?.admin||!!state.busy;$('admin-import-texture').disabled=!cloudAccount?.admin;
 $('admin-rules-panel').classList.toggle('hidden',!ownerState.ownerPC);
 if(page==='admin'&&typeof refreshAdminLibrary==='function')await refreshAdminLibrary();
 if(ownerState.ownerPC&&launcherAccess.authenticated){const rules=await api('admin-rules');$('admin-rules-text').value=rules.fragment;$('admin-owner-uid').textContent=rules.uid;}
 await loadMinecraftAccounts();
}
async function loadMinecraftAccounts(){
 const all=await api('account-list'),options='<option value="">Offline profile</option>'+all.map(a=>'<option value="'+escape(a.id)+'">'+escape(a.name)+(a.active?' · Active':'')+'</option>').join('');
 for(const id of ['mc-account-select','cosmetic-mc-account']){$(id).innerHTML=options;$(id).value=all.find(a=>a.active)?.id||'';}
}
function cloudMode(signup){cloudSignup=signup;$('cloud-name-label').classList.toggle('hidden',!signup);$('cloud-name').required=signup;$('cloud-submit').textContent=signup?'Create account':'Sign in';$('cloud-password').autocomplete=signup?'new-password':'current-password';$('cloud-login-mode').classList.toggle('active',!signup);$('cloud-signup-mode').classList.toggle('active',signup);}
$('cloud-login-mode').addEventListener('click',()=>cloudMode(false));$('cloud-signup-mode').addEventListener('click',()=>cloudMode(true));
$('cloud-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{await api('cloud-auth',{email:$('cloud-email').value.trim(),password:$('cloud-password').value,name:$('cloud-name').value.trim(),signup:cloudSignup});$('cloud-password').value='';await loadLauncherAccount();toast('Signed in to Boralances.');});});
$('cloud-logout').addEventListener('click',()=>action(async()=>{await api('cloud-logout');await loadLauncherAccount();toast('Launcher account signed out.');}));
$('cloud-sync').addEventListener('click',()=>action(async()=>{const r=await api('cloud-sync');$('cloud-sync-note').textContent='Saved to '+r.path;toast('Cloud profile saved.');}));
$('cloud-restore').addEventListener('click',()=>action(async()=>{await api('cloud-restore');await refresh();fillSettings();toast('Cloud preferences restored.');}));
$('mc-add-account').addEventListener('click',()=>action(async()=>{await saveSettings(false);await api('auth');toast('Complete Microsoft sign-in in your browser.');}));
for(const id of ['mc-account-select','cosmetic-mc-account'])$(id).addEventListener('change',()=>action(async()=>{if(!$(id).value){$('offline').checked=true;$('offline-name').classList.remove('hidden');if(page==='cosmetics'){$('cosmetic-username').value=state.settings.offlineName||'Player';await loadPlayerSkin();}toast('Offline profile selected.');return;}await api('account-switch',{id:$(id).value});await refresh();$('offline').checked=false;$('offline-name').classList.add('hidden');await loadMinecraftAccounts();if(page==='cosmetics'){$('cosmetic-username').value=state.account.name;await loadPlayerSkin();}toast('Minecraft account selected.');}));
let playerPreviewSequence=0;
async function loadPlayerSkin({refresh=false}={}){
 const sequence=++playerPreviewSequence,username=$('cosmetic-username').value.trim()||state.settings.offlineName;
 saveWardrobePrefs();capePreview?.clearPlayer();$('skin-avatar').getContext('2d').clearRect(0,0,32,32);
 $('skin-player-name').textContent=username;$('skin-source').textContent='Loading player texture…';$('skin-source').dataset.status='loading';
 try{
  const p=await api('skin-preview',{username,instanceId:selectedId,source:$('skin-preview-source').value,refresh});
  if(sequence!==playerPreviewSequence)return;
  await capePreview?.setSkin(p.skin,p.model);
  if(sequence!==playerPreviewSequence)return;
  $('skin-model').value=p.model;$('skin-player-name').textContent=p.name;
  $('skin-source').textContent=p.source+(p.cached?' · Cached, refresh to update':'');$('skin-source').dataset.status='ready';
  if(capePreview?.playerSkin){const image=document.createElement('canvas');image.width=64;image.height=capePreview.playerHeight;image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(capePreview.playerSkin),64,capePreview.playerHeight),0,0);const c=$('skin-avatar').getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,32,32);c.drawImage(image,8,8,8,8,0,0,32,32);c.drawImage(image,40,8,8,8,0,0,32,32);}
 }catch(e){if(sequence!==playerPreviewSequence)return;$('skin-source').textContent=e.message;$('skin-source').dataset.status='error';throw e;}
}
$('skin-preview-load').addEventListener('click',()=>action(()=>loadPlayerSkin({refresh:true})));
$('cosmetic-username').addEventListener('change',()=>action(()=>loadPlayerSkin()));
$('skin-preview-source').addEventListener('change',()=>action(()=>loadPlayerSkin()));
$('cosmetic-instance').addEventListener('change',()=>action(()=>loadPlayerSkin()));
$('skin-model').addEventListener('change',()=>{if(capePreview){capePreview.playerModel=$('skin-model').value;if(capePreview.kind!=='Skin'||capePreview.showPlayer)capePreview.usePlayer();}});
$('skin-import').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select a modded instance.');const p=await api('skin-import',{instanceId:selectedId,username:$('cosmetic-username').value.trim(),model:$('skin-model').value});if(p){$('skin-preview-source').value='equipped';await loadPlayerSkin();toast('Custom skin installed. Restart Minecraft.');}}));
$('skin-remove').addEventListener('click',()=>action(async()=>{await api('skin-remove',{instanceId:selectedId,username:$('cosmetic-username').value.trim(),kind:'skin'});await loadPlayerSkin();toast('Previous skin restored.');}));
$('animated-wings-remove').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('animated-wings-remove',{instanceId:selectedId,username:$('cosmetic-username').value.trim()});$('skin-preview-source').value='equipped';await loadPlayerSkin();toast('Skin before animated wings restored. Restart Minecraft.');}));
$('emote-remove').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('emote-remove',{instanceId:selectedId,id:selectedCosmetic});toast('Selected emote removed. Restart Minecraft.');}));
$('wings-remove').addEventListener('click',()=>action(async()=>{await api('skin-remove',{instanceId:selectedId,username:$('cosmetic-username').value.trim(),kind:'elytra'});toast('Wings removed. Restart Minecraft.');}));
$('voucher-redeem').addEventListener('click',()=>action(async()=>{const r=await api('voucher-redeem',{code:$('voucher-code').value});$('voucher-code').value='';await loadCosmetics();selectCosmetic(r.id);toast(r.name+' unlocked. Your voucher was free.');}));
$('minecraft-wardrobe-load').addEventListener('click',()=>action(async()=>{const p=await api('minecraft-wardrobe');ownedCloaks=p.capes;$('minecraft-cape-select').innerHTML='<option value="">No owned cloak</option>'+p.capes.map(c=>'<option value="'+escape(c.id)+'">'+escape(c.alias||c.id)+(c.state==='ACTIVE'?' · Active':'')+'</option>').join('');$('minecraft-cape-select').value=p.capes.find(c=>c.state==='ACTIVE')?.id||'';toast(p.capes.length+' owned Minecraft cloaks loaded.');}));
$('minecraft-cape-equip').addEventListener('click',()=>action(async()=>{if(!state.account)throw new Error('Sign in to Minecraft first.');await api('minecraft-cape',{id:$('minecraft-cape-select').value||null});toast('Owned cloak selected on your Minecraft account. Remove any local cape override to see it.');}));
function adminFields(){const kind=$('admin-kind').value;for(const [id,k] of [['admin-server-fields','servers'],['admin-project-fields','featured'],['admin-cosmetic-fields','cosmetics']])$(id).classList.toggle('hidden',kind!==k);}
$('admin-kind').addEventListener('change',adminFields);
function resetPixelDesign(){const c=$('admin-pixels');const type=$('admin-cosmetic-type').value;c.width=type==='Animated Wings'?20:64;c.height=['Skin','Hat','Trinket','Dress'].includes(type)?64:type==='Animated Wings'?16:32;const x=c.getContext('2d');if(['Hat','Trinket','Dress'].includes(type)){x.clearRect(0,0,64,64);x.fillStyle=$('admin-color').value;for(let y=0;y<64;y++)for(let px=0;px<64;px++)if(typeof wearablePixelAllowed==='function'&&wearablePixelAllowed(type,px,y)&&(px+y)%5===0)x.fillRect(px,y,1,1);return;}x.fillStyle='#17243b';x.fillRect(0,0,c.width,c.height);x.fillStyle=$('admin-color').value;for(let y=0;y<c.height;y++)for(let px=0;px<c.width;px++)if((px+y)%8===0)x.fillRect(px,y,1,1);}
function paintPixel(e){const c=$('admin-pixels'),r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*c.width),y=Math.floor((e.clientY-r.top)/r.height*c.height);const type=$('admin-cosmetic-type').value;if(['Hat','Trinket','Dress'].includes(type)&&!wearablePixelAllowed(type,x,y))return;const ctx=c.getContext('2d');if($('admin-erase')?.checked)ctx.clearRect(x,y,1,1);else{ctx.fillStyle=$('admin-color').value;ctx.fillRect(x,y,1,1);}}
$('admin-pixels').addEventListener('pointerdown',e=>{adminPainting=true;$('admin-pixels').setPointerCapture(e.pointerId);paintPixel(e);});$('admin-pixels').addEventListener('pointermove',e=>{if(adminPainting)paintPixel(e);});$('admin-pixels').addEventListener('pointerup',()=>adminPainting=false);$('admin-pixels').addEventListener('pointercancel',()=>adminPainting=false);
$('admin-reset-texture').addEventListener('click',resetPixelDesign);$('admin-cosmetic-type').addEventListener('change',()=>{$('admin-voucher-only').checked=$('admin-cosmetic-type').value==='Skin';resetPixelDesign();});
$('admin-import-texture').addEventListener('click',()=>action(async()=>{const p=await api('admin-texture',{type:$('admin-cosmetic-type').value});if(p){const im=new Image();im.onload=()=>{const c=$('admin-pixels');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);};im.src=p;}}));
$('admin-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{if(!cloudAccount?.admin)throw new Error('Use the enrolled owner PC and matching Admin account.');const kind=$('admin-kind').value,item={id:$('admin-id').value.trim(),name:$('admin-name').value.trim(),description:$('admin-description').value.trim()};if(kind==='servers')Object.assign(item,{address:$('admin-address').value.trim(),version:$('admin-version').value.trim()});if(kind==='featured')Object.assign(item,{provider:$('admin-provider').value,type:$('admin-type').value,projectId:$('admin-project-id').value.trim()});if(kind==='cosmetics')Object.assign(item,{type:$('admin-cosmetic-type').value,voucherOnly:$('admin-voucher-only').checked,texture:$('admin-pixels').toDataURL('image/png').split(',')[1]});await api('admin-publish',{kind,item});toast('Published '+item.name+'.');if(typeof refreshAdminLibrary==='function')await refreshAdminLibrary();});});
resetPixelDesign();
window.launcher.on('account',()=>action(loadMinecraftAccounts));

$('admin-create-voucher').addEventListener('click',()=>action(async()=>{const r=await api('admin-voucher',{id:$('admin-id').value.trim()});$('admin-voucher-output').value=r.code;toast('Free voucher created for '+r.product+'. Copy it now.');}));

$('admin-copy-rules').addEventListener('click',()=>action(async()=>{await api('admin-rules-copy');toast('Copied only boralanceslauncher. Merge inside the existing rules object; keep the other 24 entries.');}));
action(loadLauncherAccount);

for(const id of ['owner-retry','admin-refresh'])$(id).addEventListener('click',()=>action(async()=>{await loadLauncherAccount();toast(ownerState.ownerPC?'Windows owner enrollment verified.':$('owner-pc-note').textContent);}));
$('admin-signin').addEventListener('click',()=>action(async()=>{await navigate('account');cloudMode(false);if(!cloudAccount){$('cloud-email').value=ownerState.email||'Admin';$('cloud-password').focus();}else toast('Sign out of this launcher account, then sign in as the owner.');}));
