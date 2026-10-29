'use strict';
const $=id=>document.getElementById(id);
const api=(channel,payload)=>window.launcher.call(channel,payload);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={home:['LET’S BUILD SOMETHING','Your next adventure.'],discover:['MADE BY THE COMMUNITY','Find your next favorite.'],installed:['EVERYTHING IN ITS PLACE','Your collection.'],tweaks:['A CLIENT THAT FEELS LIKE YOU','Play your way.'],'sponsored-packs':['CURATED WORLDS','Sponsored modpacks.'],'sponsored-mods':['CURATED CONTENT','Sponsored mods.'],'featured-shaders':['LIGHT UP YOUR WORLD','Featured shaders.'],cosmetics:['MADE FOR YOUR PLAYER','Wear your own story.'],settings:['THE DETAILS MATTER','Make yourself at home.']};
const loaderIcons={vanilla:'◈',fabric:'▧',forge:'⚒',neoforge:'✦',quilt:'▦'};
let state={instances:[],account:null,settings:{},busy:'',game:{running:false}};
let selectedId=localStorage.getItem('selected-instance'),page='home',versions=[],provider='modrinth',type='mod',offset=0,total=0,searchSequence=0,loaderSequence=0;
let toastTimer,pendingContent=null,contentSequence=0,loaderReady=false;
let launcherAccess={authenticated:false,required:true};
let lastPlayMode=null;
function setupRequired(){return launcherAccess.onboarding?.required===true;}
const instanceRunning=id=>(state.game.sessions||[]).some(s=>s.instanceId===id)||(state.game.running&&state.game.instanceId===id);
const selected=()=>state.instances.find(x=>x.id===selectedId);
function toast(message,error=false){
  $('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').classList.remove('hidden');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),error?12000:6000);
}
async function action(fn){try{return await fn();}catch(e){if(e.message.startsWith('Import unavailable.')){$('pack-report-title').textContent='Some content is unavailable';$('pack-report-body').textContent=e.message;$('pack-report-dialog').showModal();toast('Import stopped. See the unavailable content list.',true);}else toast(e.message,true);}}
function showPackReport(instance){const items=instance.importReport?.replacements;if(!items?.length)return;$('pack-report-title').textContent='Installed from Modrinth';$('pack-report-body').textContent=items.map(r=>r.name+' → '+r.projectName+' · '+r.version+'\n'+r.file+'\n'+(r.match==='exact-file'?'Exact file verified by SHA-1.':r.match==='matching-release'?'Matching compatible release.':'Compatible release selected; the original file was not matched.')).join('\n\n');$('pack-report-dialog').showModal();}
function empty(title,description,button=''){return '<div class="empty"><h3>'+escape(title)+'</h3><p>'+escape(description)+'</p>'+button+'</div>';}
function loading(text){return '<div class="loading">'+escape(text)+'</div>';}
function short(number){return new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(number||0);}
function activeBusy(){
  for(const id of ['hero-play','install-game','import-pack','new-vanilla','new-instance','import-local','content-confirm','sign-out','theme-picker']){
    const el=$(id);if(el)el.disabled=!!state.busy;
  }
  $('hero-play').disabled=!!state.busy||instanceRunning(selectedId);
  $('install-game').disabled=!!state.busy||!selected()||instanceRunning(selectedId);
  $('open-folder').disabled=!selected();
  $('create-submit').disabled=!!state.busy||!loaderReady;
  if(pendingContent)$('content-confirm').disabled=!!state.busy||!pendingContent.canInstall;
  document.querySelectorAll('[data-mutation]').forEach(b=>b.disabled=!!state.busy);
  for(const id of ['admin-publish','admin-create-voucher','admin-import-texture'])if($(id))$(id).disabled=!!state.busy||!cloudAccount?.admin;
  document.querySelectorAll('[data-client-install]').forEach(b=>{const f=clientFeatures.find(x=>x.id===b.dataset.clientInstall);b.disabled=!!state.busy||!f?.available;});
  document.querySelectorAll('[data-client-preset]').forEach(b=>b.disabled=!!state.busy||!clientFeatures.some(f=>f.available));
  if($('install-client-selection'))$('install-client-selection').disabled=!!state.busy||!clientSelection.size;
  if($('native-client-install'))$('native-client-install').disabled=!!state.busy||instanceRunning(selectedId)||!nativeClientState?.supported;
  if($('emote-remove'))$('emote-remove').disabled=!!state.busy||cosmeticCatalog.find(p=>p.id===selectedCosmetic)?.type!=='Emote';
  if($('cosmetic-claim'))$('cosmetic-claim').disabled=!!state.busy||claimedCosmetics.includes(selectedCosmetic);
  $('stop-game').classList.toggle('hidden',!instanceRunning(selectedId));
  $('hero-play').textContent=instanceRunning(selectedId)?'Minecraft is running':'▶  Play Minecraft';
}
function drawState(){
  document.body.classList.toggle('window-acrylic',state.hardware?.windowMaterial==='acrylic');
  if(!selected()&&state.instances.length)selectedId=state.instances[0].id;
  if(selectedId&&state.settings.tools?.rememberInstance!==false)localStorage.setItem('selected-instance',selectedId);
  if(typeof applyToolPrefs==='function')applyToolPrefs();
  applyTheme(state.settings.theme||'glass');
  $('offline-name').value=state.settings.offlineName||'Player';
  const mode=launcherAccess.onboarding?.mode||state.settings.playMode||'both';
  if(mode==='offline')$('offline').checked=true;
  else if(mode==='online')$('offline').checked=false;
  else if(lastPlayMode!==mode)$('offline').checked=!state.account;
  if(!state.account)$('offline').checked=true;
  lastPlayMode=mode;$('offline').disabled=mode!=='both'||!state.account;
  $('offline-name').classList.toggle('hidden',!$('offline').checked);
  $('account-name').textContent=(!$('offline').checked?state.account?.name:null)||('Offline · '+(state.settings.offlineName||'Player'));
  $('account-note').textContent=state.account&&!$('offline').checked?'Microsoft account connected':'Local profile · no sign-in';
  $('instance-count').textContent=state.instances.length;
  const instance=selected();
  $('hero-meta').textContent=instance?instance.name+' · Minecraft '+instance.minecraft+' · '+instance.loader+(instance.loaderVersion?' '+instance.loaderVersion:''):'Create an instance to get started';
  $('selected-name').textContent=instance?.name||'No instance selected';
  $('selected-meta').textContent=instance?instance.minecraft+' · '+instance.loader:'';
  const options=state.instances.length?state.instances.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.name)+' · '+escape(x.minecraft)+'</option>').join(''):'<option value="">No instances yet</option>';
  document.querySelectorAll('.instance-select').forEach(s=>{s.innerHTML=options;s.value=selectedId||'';});
  const visibleInstances=typeof toolInstances==='function'?toolInstances():state.instances;
  $('instances-grid').innerHTML=visibleInstances.length?visibleInstances.map(x=>'<button class="instance-card '+(x.id===selectedId?'selected':'')+'" data-instance="'+escape(x.id)+'"><div class="instance-top"><span class="instance-icon '+escape(x.loader)+'">'+loaderIcons[x.loader]+'</span><div><strong>'+escape((x.favorite?'★ ':'')+x.name)+'</strong><small>Minecraft '+escape(x.minecraft)+'</small></div></div><div class="instance-bottom"><span>'+escape(x.loader.toUpperCase())+(x.loaderVersion?' · '+escape(x.loaderVersion):'')+'</span><span>'+(instanceRunning(x.id)?'RUNNING':x.installedVersion?'READY TO PLAY':'NOT INSTALLED')+'</span></div></button>').join(''):state.instances.length?empty('No matching instances.','Turn off the favorite filter in Launcher tools to show all instances.'):empty('Your first world starts here.','Create a vanilla or modded instance, or import a modpack.','<button class="button primary" id="empty-create">＋ Create instance</button>');
  $('instances-grid').querySelectorAll('[data-instance]').forEach(b=>b.addEventListener('click',()=>selectInstance(b.dataset.instance)));
  $('empty-create')?.addEventListener('click',()=>action(openCreate));
  activeBusy();
}
async function refresh(){
  const previous=state.settings;
  state=await api('state');if(!Object.keys(previous).length&&state.settings.tools?.rememberInstance===false)selectedId=null;drawState();
  if(!Object.keys(previous).length)fillSettings();
}
async function selectInstance(id){
  selectedId=id;drawState();
  if(page==='discover')await action(()=>searchCatalog(true));
  if(page==='installed')await action(loadInstalled);
  if(page==='tweaks'){drawTweaks();await action(loadClientFeatures);}
}
async function navigate(next){
  if(setupRequired()&&next!=='chat')next='welcome';
  else if(!launcherAccess.authenticated&&!['account','chat'].includes(next))next='account';
  if(next!=='chat')await api('chat-hide');
  page=next;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+next));
  document.querySelectorAll('.nav').forEach(p=>p.classList.toggle('active',p.dataset.page===next));
  $('page-eyebrow').textContent=labels[next][0];$('page-title').textContent=labels[next][1];
  if(next==='welcome'&&typeof drawWelcome==='function')drawWelcome();
  if(next==='discover')await action(()=>searchCatalog(true));
  if(next==='installed')await action(loadInstalled);
  if(next==='tweaks'){drawTweaks();await action(loadClientFeatures);}
  if(collectionPages[next])await action(()=>loadCollection(next));
  if(next==='cosmetics'){await action(loadCosmetics);if(typeof loadOutfit==='function')await action(loadOutfit);await action(loadMinecraftAccounts);loadPlayerSkin().catch(e=>{$('skin-source').textContent=e.message;});}
  if(next==='ready'){ $('ready-profile').value=state.settings.tools?.readyProfile||'balanced';await action(loadReadyInstances);}
  if(next==='chat')await action(openChat);
  if(next==='tools')await action(loadLauncherTools);
  if(next==='servers')await action(loadFeaturedServers);
  if(next==='friends')await action(loadMultiplayer);
  if(next==='creators')await action(loadFeaturedCreators);
  if(next==='account'||next==='admin')await action(loadLauncherAccount);
}
async function loadVersions(){
  versions=await api('versions');
  fillMinecraftVersions();
}
function fillMinecraftVersions(){
  const old=$('create-version').value;
  const category=$('create-version-category')?.value||(state.settings.snapshots?'all':'release');const available=versions.filter(x=>category==='all'||category==='release'&&x.type==='release'||category==='snapshot'&&x.type==='snapshot'||category==='legacy'&&['old_alpha','old_beta'].includes(x.type));
  $('create-version').innerHTML=available.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.id)+(x.type!=='release'?' ('+escape(x.type)+')':'')+'</option>').join('');
  if(available.some(x=>x.id===old))$('create-version').value=old;
}
async function openCreate(){
  if(state.busy)return;
  $('create-dialog').showModal();if(window.CreateWizard)window.CreateWizard.open();
  if(!versions.length){
    $('create-version').innerHTML='<option>Loading Minecraft versions…</option>';
    await loadVersions();
  }
  await loadBuilds();
}
async function loadBuilds(){
  const seq=++loaderSequence,loader=$('create-loader').value,minecraft=$('create-version').value;
  loaderReady=false;activeBusy();$('loader-field').classList.toggle('hidden',loader==='vanilla');
  $('create-build').required=loader!=='vanilla';
  if(loader==='vanilla'){loaderReady=true;$('loader-note').textContent='Official releases, snapshots, alpha and beta versions are available.';activeBusy();return;}
  $('create-build').innerHTML='<option value="">Loading builds…</option>';
  $('loader-note').textContent='Checking loader compatibility…';
  try{
    const builds=await api('loaders',{loader,minecraft});
    if(seq!==loaderSequence)return;
    $('create-build').innerHTML=builds.length?builds.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join(''):'<option value="">No supported builds</option>';
    loaderReady=builds.length>0;
    $('loader-note').textContent=builds.length?builds.length+' builds available. Includes development builds; choose the version your mods require.':loader+' does not offer a build for Minecraft '+minecraft+'. Choose another version or loader.';
  }catch(e){if(seq===loaderSequence){$('create-build').innerHTML='<option value="">Could not load builds</option>';$('loader-note').textContent=e.message;}}
  if(seq===loaderSequence)activeBusy();
}
async function searchCatalog(reset=false){
  if(reset)offset=0;
  const seq=++searchSequence;
  const target=selected(),instance=$('catalog-compatible').checked&&!(type==='mod'&&target?.loader==='vanilla')?target:null;
  $('catalog-context').textContent=instance&&type!=='modpack'?'Matching Minecraft '+instance.minecraft+(type==='mod'?' · '+instance.loader:''):'Browsing all versions. Installation checks compatibility.';
  $('results-grid').innerHTML=loading('Searching '+(provider==='modrinth'?'Modrinth':'CurseForge')+'…');
  $('results-label').textContent='Loading community projects…';
  try{
    const result=await api('search',{provider,type,query:$('search').value.trim(),instance,offset});
    if(seq!==searchSequence)return;
    total=result.total;$('results-label').textContent=total.toLocaleString()+' projects'+(instance&&type!=='modpack'?' for Minecraft '+instance.minecraft:'');
    const hits=result.hits;
    $('results-grid').classList.toggle('catalog-list',type!=='modpack');$('results-grid').classList.toggle('catalog-packs',type==='modpack');
    $('results-grid').innerHTML=hits.length?hits.map((x,i)=>'<article class="content-card catalog-project">'+(type==='modpack'?'<div class="catalog-cover">'+(x.cover||x.icon?'<img src="'+escape(x.cover||x.icon)+'" alt="" loading="lazy">':'<span>✦</span>')+'</div>':'')+'<div class="content-top"><div class="content-icon">'+(x.icon?'<img src="'+escape(x.icon)+'" alt="" loading="lazy">':'◈')+'</div><div><h3>'+escape(x.name)+'</h3><div class="content-author">'+escape(x.author)+'</div></div></div><p>'+escape(x.description)+'</p><div class="content-foot"><span>↓ '+short(x.downloads)+' downloads</span><button class="button primary" data-project="'+i+'">↓ Install</button></div></article>').join(''):empty('No matches for these filters.',instance?'Turn off “Match selected instance” to search all versions, or try a different query.':'Try another project name or category.');
    $('results-grid').querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>action(()=>openProject(hits[Number(b.dataset.project)],provider,type))));
    drawPagination();
  }catch(e){if(seq!==searchSequence)return;total=0;$('results-grid').innerHTML=empty('Catalog unavailable',e.message);$('results-label').textContent='Could not load projects';drawPagination();}
}
function drawPagination(){
  $('previous').disabled=offset===0;$('next').disabled=offset+24>=total;
  $('pagination-label').textContent=total?'Page '+(Math.floor(offset/24)+1)+' of '+Math.ceil(total/24):'';
}
async function openProject(project,source,contentType){
  const instance=selected();
  const seq=++contentSequence;
  pendingContent={project,provider:source,type:contentType,instanceId:instance?.id,versions:[]};
  $('content-title').textContent=project.name;
  $('content-description').textContent=project.description||'';
  $('content-source').textContent=source.toUpperCase();
  $('content-target').textContent=contentType==='modpack'?'This pack will create a new instance with its required Minecraft version and loader.':instance?'Install into '+instance.name+' · '+instance.minecraft+' · '+instance.loader:'Browsing versions. Select an instance in Discover before installing.';
  $('content-version').innerHTML='<option>Loading compatible versions…</option>';
  $('content-confirm').disabled=true;
  $('world-field').classList.toggle('hidden',contentType!=='datapack');
  $('optional-field').classList.toggle('hidden',contentType!=='modpack');
  $('pack-optional').checked=false;
  $('content-note').textContent=contentType==='shader'?'Install a compatible shader engine from Client tweaks, then select this pack inside Minecraft.':contentType==='mod'?'Required dependencies are downloaded automatically.':'';
  $('project-page').disabled=!project.url;
  $('content-dialog').showModal();
  try{
    const available=await api('content-versions',{provider:source,projectId:project.id,instanceId:instance?.id,type:contentType});
    if(seq!==contentSequence || !$('content-dialog').open)return;
    pendingContent.versions=available;
    $('content-version').innerHTML=available.length?available.map((x,i)=>'<option value="'+i+'">'+escape(x.name)+' · '+escape(x.channel)+(x.date?' · '+escape(x.date.slice(0,10)):'')+'</option>').join(''):'<option value="">No compatible versions</option>';
    let canInstall=available.length>0&&(contentType==='modpack'||!!instance&&!(contentType==='mod'&&instance.loader==='vanilla'));
    if(contentType==='datapack'&&instance){
      const worlds=await api('worlds',{instanceId:instance.id});
      if(seq!==contentSequence)return;
      $('content-world').innerHTML=worlds.length?worlds.map(x=>'<option>'+escape(x)+'</option>').join(''):'<option value="">No singleplayer worlds yet</option>';
      canInstall=canInstall&&worlds.length>0;
      $('content-note').textContent=worlds.length?'This datapack installs only into the world you choose. Enable it in the world’s datapack menu or use /reload.':'Create a singleplayer world in this instance first, then return here.';
    }
    $('content-confirm').disabled=!canInstall||!!state.busy;
    pendingContent.canInstall=canInstall;
    if(!instance&&contentType!=='modpack')$('content-note').textContent='Select an instance before installing this content.';
    else if(contentType==='mod'&&instance?.loader==='vanilla')$('content-note').textContent='Mods need Fabric, Quilt, Forge or NeoForge. Choose an instance with a mod loader.';
    else if(!available.length)$('content-note').textContent='No release supports this Minecraft version and loader. Try another instance.';
  }catch(e){if(seq!==contentSequence||!$('content-dialog').open)return;$('content-version').innerHTML='<option value="">Could not load versions</option>';$('content-note').textContent=e.message;$('content-confirm').disabled=true;}
}
async function confirmContent(){
  const p=pendingContent;
  if(!p?.canInstall)throw new Error('Choose a compatible instance and release before installing.');
  const version=p?.versions[Number($('content-version').value)];
  if(!version)throw new Error('Select a compatible version.');
  const payload={provider:p.provider,projectId:version.projectId||p.project.id,versionId:version.id,type:p.type,instanceId:p.instanceId,world:$('content-world').value,optional:$('pack-optional').checked};
  $('content-confirm').disabled=true;
  try{
    if(p.type==='modpack'){
      const instance=await api('pack-download',payload);selectedId=instance.id;toast('Modpack imported. Install / repair downloads its game and loader.');await refresh();await navigate('home');showPackReport(instance);
    }else{
      await api('content-install',payload);toast(p.project.name+' installed with its required dependencies.');await refresh();
      if(page==='installed')await loadInstalled();
    }
    $('content-dialog').close();
  }finally{$('content-confirm').disabled=!!state.busy||!p.canInstall;}
}
async function loadInstalled(){
  const instance=selected();
  $('view-pack-report').classList.toggle('hidden',!instance?.importReport?.replacements?.length);
  if(!instance){$('installed-list').innerHTML=empty('No instance selected.','Create an instance to manage installed content.');return;}
  const id=instance.id;
  $('installed-list').innerHTML=loading('Reading installed files…');
  const allRecords=await api('content-list',{instanceId:id});const records=state.settings.tools?.showDisabled===false?allRecords.filter(x=>!x.disabled):allRecords;
  if(selectedId!==id)return;
  $('installed-list').innerHTML=records.length?records.map((x,i)=>'<div class="file-row '+(x.disabled?'disabled':'')+'"><span class="file-tag">'+escape(x.type)+'</span><div class="file-info"><div class="file-name" title="'+escape(x.name)+'">'+escape(x.name)+'</div><div class="file-meta">'+escape(x.provider||'Imported file')+(x.replaced?' · Replaced '+escape(x.replaced.name)+' from CurseForge':'')+(x.world?' · world: '+escape(x.world):'')+(x.requires?.length?' · '+x.requires.length+' dependencies':'')+'</div></div><button class="button tiny" data-toggle="'+i+'" data-mutation>'+ (x.disabled?'Enable':'Disable')+'</button><button class="button tiny danger" data-remove="'+i+'" data-mutation>Remove</button></div>').join(''):empty('A clean slate.','Install from Discover or import a local JAR or ZIP file.');
  const change=async(index,kind)=>{
    const record=records[index];
    if(kind==='remove'&&!window.confirm('Remove '+record.name+' from this instance?'))return;
    await api('content-action',{instanceId:id,key:record.key,world:record.world,action:kind});
    await loadInstalled();
  };
  $('installed-list').querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>action(()=>change(Number(b.dataset.toggle),'toggle'))));
  $('installed-list').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>action(()=>change(Number(b.dataset.remove),'remove'))));
  activeBusy();
  await localWorlds();
}
async function localWorlds(){
  const isData=$('local-type').value==='datapack';
  $('local-world').classList.toggle('hidden',!isData);
  if(isData&&selected()){
    const worlds=await api('worlds',{instanceId:selectedId});
    $('local-world').innerHTML=worlds.length?worlds.map(x=>'<option>'+escape(x)+'</option>').join(''):'<option value="">Create a world first</option>';
  }
}
const tweaks=[
  {id:'sodium',name:'Sodium',icon:'⚡',group:'PERFORMANCE',description:'A faster rendering engine for smoother frames and better GPU efficiency.'},
  {id:'embeddium',name:'Embeddium',icon:'▣',group:'PERFORMANCE',description:'Rendering optimizations for compatible Forge and NeoForge releases. Use one renderer per instance.'},
  {id:'lithium',name:'Lithium',icon:'✦',group:'PERFORMANCE',description:'Optimizes game logic, physics, and other systems without changing gameplay.'},
  {id:'ferrite-core',name:'FerriteCore',icon:'◈',group:'MEMORY',description:'Reduces memory usage in Minecraft. Especially useful with large mod collections.'},
  {id:'entityculling',name:'Entity Culling',icon:'◉',group:'PERFORMANCE',description:'Skips rendering entities and block entities hidden behind walls.'},
  {id:'immediatelyfast',name:'ImmediatelyFast',icon:'↗',group:'PERFORMANCE',description:'Speeds up immediate-mode rendering, including HUD elements and particles.'},
  {id:'iris',name:'Iris Shaders',icon:'☀',group:'VISUALS',description:'Adds shader-pack support to compatible versions. Pair with a shader pack from Discover.'},
  {id:'zoomify',name:'Zoomify',icon:'⌕',group:'QUALITY OF LIFE',description:'Configurable zoom controls with smooth transitions and camera options.'},
  {id:'betterf3',name:'BetterF3',icon:'▤',group:'HUD',description:'A clearer, customizable debug display for coordinates, FPS, and system information.'},
  {id:'appleskin',name:'AppleSkin',icon:'♡',group:'HUD',description:'Shows food saturation and hunger values in your inventory and hotbar.'},
  {id:'dynamic-fps',name:'Dynamic FPS',icon:'◷',group:'PERFORMANCE',description:'Reduces resource usage when Minecraft is in the background or unfocused.'},
  {id:'modmenu',name:'Mod Menu',icon:'☷',group:'QUALITY OF LIFE',description:'An in-game list of installed mods and shortcuts to their configuration screens.'},
  {id:'lambdynamiclights',name:'Dynamic Lights',icon:'✺',group:'VISUALS',description:'Held light sources illuminate your surroundings on compatible releases.'},
  {id:'continuity',name:'Continuity',icon:'▦',group:'VISUALS',description:'Connected-texture support for compatible resource packs and rendering setups.'}
];
function drawTweaks(){
  $('tweaks-grid').innerHTML=tweaks.map((x,i)=>'<article class="content-card"><div class="content-top"><div class="content-icon">'+x.icon+'</div><div><h3>'+escape(x.name)+'</h3><div class="content-author">'+x.group+'</div></div></div><p>'+escape(x.description)+'</p><div class="content-foot"><span>Modrinth</span><button class="button subtle" data-tweak="'+i+'" '+(!selected()||selected().loader==='vanilla'?'disabled':'')+'>Check &amp; install</button></div></article>').join('');
  $('tweaks-grid').querySelectorAll('[data-tweak]').forEach(b=>b.addEventListener('click',()=>action(()=>{
    const x=tweaks[Number(b.dataset.tweak)];
    return openProject({...x,url:'https://modrinth.com/mod/'+x.id},'modrinth','mod');
  })));
}
function applyTheme(theme){
  document.body.dataset.theme=theme;if(typeof applyGlassAppearance==='function')applyGlassAppearance();
  $('theme-picker').value=theme;
  document.querySelectorAll('[data-theme-choice]').forEach(b=>{b.classList.toggle('chosen',b.dataset.themeChoice===theme);b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme));});
}
async function changeTheme(theme){
  const old=state.settings.theme||'glass';applyTheme(theme);
  try{const value=await api('preferences',{theme,offlineName:state.settings.offlineName||'Player'});Object.assign(state.settings,value);applyTheme(value.theme);}
  catch(e){applyTheme(old);throw e;}
}
function fillSettings(){
  const s=state.settings;if(typeof fillGlassSettings==='function')fillGlassSettings();
  for(const [id,key] of [['setting-memory','memory'],['setting-width','width'],['setting-height','height'],['setting-java','java'],['setting-curseforge','curseforgeKey'],['setting-offline-name','offlineName']])$(id).value=s[key]??'';
  if(typeof syncMemoryControl==='function')syncMemoryControl();
  $('setting-snapshots').checked=!!s.snapshots;
}
async function saveSettings(showToast=true){
  if(!$('settings-form').reportValidity())throw new Error('Check the settings fields.');
  const settings={theme:state.settings.theme||'glass',offlineName:$('setting-offline-name').value,memory:Number($('setting-memory').value),width:Number($('setting-width').value),height:Number($('setting-height').value),java:$('setting-java').value,curseforgeKey:$('setting-curseforge').value,snapshots:$('setting-snapshots').checked,glass:typeof glassValues==='function'?glassValues():state.settings.glass};
  await api('settings',settings);state.settings={...settings,tools:state.settings.tools||{},curseforgeKey:settings.curseforgeKey?'saved':''};fillMinecraftVersions();fillSettings();drawState();
  $('save-note').textContent='Settings saved.';
  if(showToast)toast('Settings saved.');
}
async function play(){
  if(!selected()){await openCreate();return;}
  const offline=$('offline').checked||!state.account;
  if(state.settings.tools?.confirmLaunch&&!window.confirm('Launch '+selected().name+' using '+(offline?'an offline profile':'your Microsoft account')+'?'))return;
  const username=$('offline-name').value.trim();
  if(offline&&!/^[A-Za-z0-9_]{3,16}$/.test(username))throw new Error('Offline names must have 3–16 letters, numbers or underscores.');
  await api('launch',{instanceId:selectedId,offline,username});await refresh();
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
document.querySelectorAll('.instance-select').forEach(s=>s.addEventListener('change',()=>action(async()=>{await selectInstance(s.value);if(page==='tweaks')drawTweaks();})));
document.querySelectorAll('.dialog-close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
for(const [id,value] of [['minimize','minimize'],['maximize','maximize'],['close','close']])$(id).addEventListener('click',()=>api('window',{action:value}));
$('new-instance').addEventListener('click',()=>action(openCreate));
$('theme-picker').addEventListener('change',()=>action(()=>changeTheme($('theme-picker').value)));
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>action(()=>changeTheme(b.dataset.themeChoice))));
$('offline').addEventListener('change',()=>$('offline-name').classList.toggle('hidden',!$('offline').checked));
$('offline-name').addEventListener('change',()=>action(async()=>{const value=await api('preferences',{theme:state.settings.theme||'glass',offlineName:$('offline-name').value.trim()});Object.assign(state.settings,value);$('setting-offline-name').value=value.offlineName;drawState();}));
$('hero-play').addEventListener('click',()=>action(play));
$('hero-discover').addEventListener('click',()=>navigate('discover'));
$('create-version').addEventListener('change',loadBuilds);
$('create-loader').addEventListener('change',loadBuilds);
$('create-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  if(!loaderReady)throw new Error('Select a supported loader build.');
  const instance=await api('create',{name:$('create-name').value,minecraft:$('create-version').value,loader:$('create-loader').value,loaderVersion:$('create-build').value});
  selectedId=instance.id;$('create-dialog').close();$('create-name').value='';await refresh();toast('Instance created. Play or Install / repair will download the game.');
});});
$('import-pack').addEventListener('click',()=>action(async()=>{const instance=await api('pack-import',{optional:false});if(instance){selectedId=instance.id;await refresh();toast('Modpack imported into a new instance.');showPackReport(instance);}}));
$('install-game').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('install',{instanceId:selectedId});await refresh();toast('Minecraft and its loader are installed.');}));
$('open-folder').addEventListener('click',()=>action(()=>api('folder',{instanceId:selectedId})));
$('stop-game').addEventListener('click',()=>action(()=>api('stop',{instanceId:selectedId})));
$('account-button').addEventListener('click',()=>navigate('account'));
document.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>{provider=b.dataset.provider;document.querySelectorAll('.provider').forEach(x=>x.classList.toggle('active',x===b));action(()=>searchCatalog(true));}));
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.type;document.querySelectorAll('.type').forEach(x=>x.classList.toggle('active',x===b));action(()=>searchCatalog(true));}));
$('search-button').addEventListener('click',()=>action(()=>searchCatalog(true)));
$('catalog-compatible').addEventListener('change',()=>action(()=>searchCatalog(true)));
$('search').addEventListener('keydown',e=>{if(e.key==='Enter')action(()=>searchCatalog(true));});
$('previous').addEventListener('click',()=>action(()=>{offset=Math.max(0,offset-24);return searchCatalog();}));
$('next').addEventListener('click',()=>action(()=>{offset+=24;return searchCatalog();}));
$('content-confirm').addEventListener('click',()=>action(confirmContent));
$('project-page').addEventListener('click',()=>action(()=>api('external',{url:pendingContent.project.url})));
$('refresh-installed').addEventListener('click',()=>action(loadInstalled));
$('view-pack-report').addEventListener('click',()=>showPackReport(selected()));
$('local-type').addEventListener('change',()=>action(localWorlds));
$('import-local').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('local-import',{instanceId:selectedId,type:$('local-type').value,world:$('local-world').value});await loadInstalled();}));
$('settings-form').addEventListener('submit',e=>{e.preventDefault();action(saveSettings);});
$('choose-java').addEventListener('click',()=>action(async()=>{const java=await api('java-select');if(java)$('setting-java').value=java;}));
$('sign-in').addEventListener('click',()=>action(async()=>{await saveSettings(false);await api('auth');toast('Complete sign-in in your browser.');}));
$('sign-out').addEventListener('click',()=>action(async()=>{await api('logout');await refresh();toast('Signed out.');}));
$('curseforge-docs').addEventListener('click',()=>api('external',{url:'https://docs.curseforge.com/rest-api/'}));
$('show-logs').addEventListener('click',()=>action(async()=>{$('logs-output').textContent=selected()?await api('logs',{instanceId:selectedId}):'Select an instance to see game logs.';$('logs-dialog').showModal();}));
window.launcher.on('busy',value=>{state.busy=value;activeBusy();$('status-dot').classList.toggle('working',!!value);if(!value)$('progress-fill').style.width='0%';});
let progressMax=0;
window.launcher.on('progress',p=>{
  if(p.status)$('status-text').textContent=p.status;
  if(p.total!=null)progressMax=p.total;
  if(p.current!=null&&progressMax>0)$('progress-fill').style.width=Math.min(100,p.current/progressMax*100)+'%';
});
window.launcher.on('game',value=>{state.game=value;if(capePreview)capePreview.gameRunning=!!value.running;drawState();if(value.closedInstanceId&&value.code!==0)toast('Minecraft closed unexpectedly. Check Logs for details.',true);});
window.launcher.on('account',value=>{state.account=value;drawState();});
window.launcher.on('auth-error',message=>toast(message,true));
window.launcher.on('log',entry=>{if(typeof entry==='object'&&entry.instanceId!==selectedId)return;const text=typeof entry==='object'?entry.text:entry;if($('logs-dialog').open){$('logs-output').textContent=($('logs-output').textContent+text).slice(-120000);$('logs-output').scrollTop=$('logs-output').scrollHeight;}});

let clientFeatures=[],clientSequence=0,nativeClientState=null;const clientSelection=new Set();
async function loadClientFeatures(){
  const instance=selected(),seq=++clientSequence;
  clientFeatures=[];clientSelection.clear();nativeClientState=null;$('native-client-install').disabled=true;$('native-client-status').textContent='Checking the in-game menu…';$('install-client-selection').disabled=true;
  for(const b of document.querySelectorAll('[data-client-preset]'))b.disabled=true;
  if(!instance){$('native-client-status').textContent='Select a Fabric instance to install the in-game menu.';$('client-grid').innerHTML=empty('Choose your client.','Create a modded instance to add HUD displays, cosmetics and mouse controls.');$('client-summary').textContent='No instance selected.';return;}
  $('client-grid').innerHTML=loading('Checking built-in features for '+instance.minecraft+' / '+instance.loader+'…');
  $('client-summary').textContent='Checking live compatibility…';
  try{
    const [result,native]=await Promise.all([api('client-features',{instanceId:instance.id}),api('native-client-state',{instanceId:instance.id})]);
    if(seq!==clientSequence||selectedId!==instance.id)return;
    nativeClientState=native;$('native-client-key').textContent=native.menuKey;$('native-client-status').textContent=native.supported?(native.installed?'Installed · Press '+native.menuKey+' while playing. Changes are local to your client.':'Available for this instance · Install, then launch to prepare your player skin.'): 'Boralances menu: Fabric 26.3, 1.21.11, 1.21.1 and 1.20.1. Other loaders use each mod’s own controls.';$('native-client-install').textContent=native.installed?'Update in-game menu':'Install in-game menu';clientFeatures=result.features;drawClientFeatures();
  }catch(e){if(seq!==clientSequence)return;$('client-grid').innerHTML=empty('Client library unavailable',e.message);$('client-summary').textContent='Refresh to retry.';}
}
function drawClientFeatures(){
  if(!selected()){clientSelection.clear();$('client-count').textContent='0';$('client-selection-count').textContent='0 selected';return;}
  const supported=clientFeatures.filter(f=>f.available),enabled=clientFeatures.filter(f=>f.status==='enabled');
  $('client-count').textContent=clientFeatures.length;
  $('client-summary').textContent=supported.length+' compatible features · '+enabled.length+' installed · '+selected().minecraft+' / '+selected().loader;
  const query=$('client-search').value.trim().toLowerCase(),category=$('client-category').value,status=$('client-status-filter').value;const visible=clientFeatures.filter(f=>(!query||(f.name+' '+f.description+' '+(f.project||'')).toLowerCase().includes(query))&&(!category||f.group===category)&&(!status||(status==='available'?f.available:status==='unsupported'?!f.available:f.status===status)));
  $('client-count').textContent=visible.length+' / '+clientFeatures.length;$('client-selection-count').textContent=clientSelection.size+' selected';
  $('client-grid').innerHTML=visible.map(f=>'<article class="client-card '+(f.status==='enabled'?'enabled':!f.available?'unavailable':'')+'"><div class="client-card-top"><span class="client-card-icon">'+f.icon+'</span><div><h3>'+escape(f.name)+'</h3><small>'+escape(f.group)+'</small></div><input type="checkbox" aria-label="Select '+escape(f.name)+'" data-client-feature="'+escape(f.id)+'" '+(clientSelection.has(f.id)?'checked ':'')+(!f.available||f.status==='enabled'?'disabled':'')+'></div><p>'+escape(f.description)+'</p><div class="client-source">'+escape(f.project||'No compatible provider')+(f.version?' · '+escape(f.version):'')+'</div><div class="client-note">'+escape(f.note)+'</div><div class="client-card-foot"><span class="client-status">'+(f.status==='enabled'?'● Installed':f.status==='disabled'?'○ Disabled':f.status==='available'?'Compatible':f.status==='error'?'Catalog error':f.status==='external'?'Imported mod':'Unavailable')+'</span><button class="button tiny" data-client-install="'+escape(f.id)+'" data-mutation '+(!f.available?'disabled':'')+'>'+(f.status==='enabled'?'Manage':f.status==='disabled'?'Enable':'Install')+'</button></div></article>').join('');
  $('client-grid').querySelectorAll('[data-client-install]').forEach(b=>b.addEventListener('click',()=>action(async()=>{const feature=clientFeatures.find(f=>f.id===b.dataset.clientInstall);if(feature.status==='enabled'){await navigate('installed');return;}await installClientFeatures({features:[feature.id]});})));
  if(!visible.length)$('client-grid').innerHTML=empty('No matching features.','Try another category or search. Your selections are kept.');
  $('client-grid').querySelectorAll('[data-client-feature]').forEach(b=>b.addEventListener('change',()=>{if(b.checked)clientSelection.add(b.dataset.clientFeature);else clientSelection.delete(b.dataset.clientFeature);$('client-selection-count').textContent=clientSelection.size+' selected';activeBusy();}));
  activeBusy();
}
async function installClientFeatures(choice){
  const instance=selected();if(!instance)throw new Error('Select a modded instance first.');
  const payload={...choice,instanceId:instance.id,...(choice.preset==='boost'?{profile:$('boost-profile').value}:{})};
  const result=await api('client-preset',payload);
  $('client-result').classList.remove('hidden');
  const installed=result.installed;
  $('client-result').innerHTML='<strong>'+installed+' mod'+(installed===1?'':'s')+' installed'+(result.alreadyEnabled.length?' · '+result.alreadyEnabled.length+' features already enabled':'')+(result.optimization?' · '+escape(result.optimization.name)+' settings applied':'')+'. Restart Minecraft to use your changes.</strong>'+(result.skipped.length?'<ul class="client-result-list">'+result.skipped.map(f=>'<li>'+escape(f.name)+': '+escape(f.reason)+'</li>').join('')+'</ul>':'');
  toast(installed?'Client features installed. Configure your HUD and keys in-game.':result.skipped.length?'No new mods installed. Check the feature details.':'Your compatible features are already installed.');
  await refresh();if(page==='tweaks')await loadClientFeatures();
}
$('refresh-client').addEventListener('click',()=>action(loadClientFeatures));
$('install-client-selection').addEventListener('click',()=>action(()=>installClientFeatures({features:[...clientSelection]})));
document.querySelectorAll('[data-client-preset]').forEach(b=>b.addEventListener('click',()=>action(()=>installClientFeatures({preset:b.dataset.clientPreset}))));


const collectionPages={'sponsored-packs':'packs','sponsored-mods':'mods','featured-shaders':'shaders'};
let collectionSequence=0,cosmeticCatalog=[],claimedCosmetics=[],selectedCosmetic='astral-crest',capePreview=null;
async function loadCollection(next){
  const collection=collectionPages[next],grid=$(next+'-grid'),seq=++collectionSequence;
  grid.innerHTML=loading('Loading '+(collection==='shaders'?'Modrinth':'CurseForge')+' collection…');
  const projects=await api('curated',{collection});
  const extra=await api('cloud-public').catch(()=>({featured:[]}));for(const p of extra.featured||[])if((collection==='packs'&&p.type==='modpack'||collection==='mods'&&p.type==='mod'||collection==='shaders'&&p.type==='shader')&&((collection==='shaders')===(p.provider==='modrinth')))projects.push({...p,id:p.projectId,available:true,url:p.provider==='curseforge'?'https://www.curseforge.com/minecraft':'https://modrinth.com/project/'+p.projectId});
  if(seq!==collectionSequence||page!==next)return;
  grid.innerHTML=projects.map((p,i)=>'<article class="content-card"><div class="sponsor-badge">'+(collection==='shaders'?'FEATURED · MODRINTH':'SPONSORED · CURSEFORGE')+'</div><div class="content-top"><div class="content-icon">'+(p.icon?'<img src="'+escape(p.icon)+'" alt="" loading="lazy">':'◈')+'</div><div><h3>'+escape(p.name)+'</h3><div class="content-author">'+escape(p.author||'Boralances Studios')+'</div></div></div><p>'+escape(p.description)+'</p>'+((p.sourceName&&p.sourceName.toLowerCase()!==p.name.toLowerCase()||p.note)?'<p class="source-note">'+escape(p.note||'Provider title: '+p.sourceName)+'</p>':'')+'<div class="content-foot"><span>'+(p.available?'↓ '+short(p.downloads)+' downloads':'Unavailable')+'</span><button class="button subtle" data-curated="'+i+'" '+(!p.available?'disabled':'')+'>View releases</button></div></article>').join('');
  grid.querySelectorAll('[data-curated]').forEach(b=>b.addEventListener('click',()=>action(()=>{const p=projects[Number(b.dataset.curated)];return openProject(p,p.provider,p.type);})));
}
let wardrobePrefs={};try{wardrobePrefs=JSON.parse(localStorage.getItem('wardrobe-v2')||'{}');}catch{}
const cosmeticFavorites=new Set(Array.isArray(wardrobePrefs.favorites)?wardrobePrefs.favorites:[]);
if(wardrobePrefs.selected)selectedCosmetic=wardrobePrefs.selected;
if(wardrobePrefs.source==='equipped')$('skin-preview-source').value='equipped';
async function loadCosmetics(){
  const result=await api('wardrobe');cosmeticCatalog=result.products;claimedCosmetics=result.claimed;
  if(!$('cosmetic-username').value)$('cosmetic-username').value=state.account&&!$('offline').checked?state.account.name:wardrobePrefs.username||state.settings.offlineName||'Player';
  if(!capePreview)capePreview=new window.CosmeticPreview($('cosmetic-canvas'));
  if(!cosmeticCatalog.some(p=>p.id===selectedCosmetic))selectedCosmetic=cosmeticCatalog[0]?.id;
  drawCosmetics();selectCosmetic(selectedCosmetic);
}
function saveWardrobePrefs(){wardrobePrefs={...wardrobePrefs,selected:selectedCosmetic,username:$('cosmetic-username').value.trim(),source:$('skin-preview-source').value,favorites:[...cosmeticFavorites]};localStorage.setItem('wardrobe-v2',JSON.stringify(wardrobePrefs));}
function drawCosmetics(){
 const query=$('cosmetic-search').value.trim().toLowerCase(),type=$('cosmetic-type').value,scope=$('cosmetic-scope').value;
 const list=cosmeticCatalog.filter(p=>(type==='all'||p.type===type)&&(!query||(p.name+' '+p.description).toLowerCase().includes(query))&&(scope==='all'||scope==='library'&&claimedCosmetics.includes(p.id)||scope==='favorites'&&cosmeticFavorites.has(p.id)));
 $('cosmetics-grid').innerHTML=list.length?list.map(p=>'<button class="cosmetic-card'+(p.id===selectedCosmetic?' selected':'')+'" data-cosmetic="'+escape(p.id)+'"><span class="cosmetic-badges">'+(p.collection?'NEW':'')+(cosmeticFavorites.has(p.id)?' ★':'')+'</span><canvas width="80" height="128" aria-label="'+escape(p.name)+' texture"></canvas><strong>'+escape(p.name)+'</strong><small>'+escape(p.type.toUpperCase())+' · '+(claimedCosmetics.includes(p.id)?'IN YOUR LIBRARY':p.voucherOnly?'VOUCHER':'FREE')+'</small></button>').join(''):empty('No styles found.','Try another search or filter.');
 for(const p of list){const card=document.querySelector('[data-cosmetic="'+p.id+'"]'),image=new Image();image.onload=()=>{const c=card.querySelector('canvas').getContext('2d');c.imageSmoothingEnabled=false;if(p.type==='Hat')c.drawImage(image,40,8,8,8,0,20,80,80);else if(p.type==='Trinket'||p.type==='Dress')c.drawImage(image,16,32,24,32,10,8,60,112);else if(p.type==='Skin')c.drawImage(image,8,8,8,8,0,20,80,80);else if(p.type==='Emote')c.drawImage(image,0,0,64,64,0,20,80,80);else if(p.type==='Animated Wings'){c.drawImage(image,0,0,20,16,1,26,38,64);c.save();c.translate(80,0);c.scale(-1,1);c.drawImage(image,0,0,20,16,1,26,38,64);c.restore();}else if(p.type==='Wings'){c.drawImage(image,36,2,10,20,2,0,36,128);c.save();c.translate(80,0);c.scale(-1,1);c.drawImage(image,36,2,10,20,2,0,36,128);c.restore();}else c.drawImage(image,12,1,10,16,0,0,80,128);};image.src=p.asset;card.addEventListener('click',()=>selectCosmetic(p.id));}
 $('cosmetic-library-note').textContent=list.length+' shown · '+cosmeticCatalog.length+' styles · '+claimedCosmetics.length+' in your library';
}
function selectCosmetic(id){
 const p=cosmeticCatalog.find(p=>p.id===id);if(!p)return;
 selectedCosmetic=id;capePreview?.setTexture(p.asset,p.type,p.animation).catch(e=>toast(e.message,true));
 $('cosmetic-equip').textContent=p.type==='Emote'?'Install emote':'Equip '+p.type.toLowerCase();$('cosmetic-download').textContent=p.type==='Emote'?'Download emote JSON':'Download PNG';$('emote-remove').disabled=p.type!=='Emote';$('cosmetic-selected-name').textContent=p.name;$('cosmetic-selected-description').textContent=p.description;
 $('cosmetic-claim').textContent=claimedCosmetics.includes(id)?'✓ In your library':p.voucherOnly?'Redeem voucher to unlock':'Add to library · Free';
 $('cosmetic-favorite').textContent=cosmeticFavorites.has(id)?'★ Saved favorite':'☆ Favorite';$('cosmetic-favorite').setAttribute('aria-pressed',String(cosmeticFavorites.has(id)));
 $('skin-display-mode').classList.toggle('hidden',p.type!=='Skin');$('preview-replay').classList.toggle('hidden',p.type!=='Emote');
 $('skin-display-mode').value=capePreview?.showPlayer?'player':'product';
 document.querySelectorAll('[data-cosmetic]').forEach(b=>b.classList.toggle('selected',b.dataset.cosmetic===id));saveWardrobePrefs();activeBusy();
}
for(const id of ['cosmetic-search','cosmetic-type','cosmetic-scope'])$(id).addEventListener(id==='cosmetic-search'?'input':'change',drawCosmetics);
$('cosmetic-favorite').addEventListener('click',()=>{cosmeticFavorites.has(selectedCosmetic)?cosmeticFavorites.delete(selectedCosmetic):cosmeticFavorites.add(selectedCosmetic);saveWardrobePrefs();drawCosmetics();selectCosmetic(selectedCosmetic);});
$('cosmetic-random').addEventListener('click',()=>{const eligible=cosmeticCatalog.filter(p=>!p.voucherOnly||claimedCosmetics.includes(p.id));if(eligible.length)selectCosmetic(eligible[Math.floor(Math.random()*eligible.length)].id);});
for(const direction of ['front','back'])$('preview-'+direction).addEventListener('click',()=>{capePreview?.view(direction);$('preview-rotate').setAttribute('aria-pressed','false');});
$('preview-rotate').addEventListener('click',()=>{if(capePreview){capePreview.autoRotate=!capePreview.autoRotate;$('preview-rotate').setAttribute('aria-pressed',String(capePreview.autoRotate));}});
$('skin-display-mode').addEventListener('change',()=>capePreview?.setPlayerMode($('skin-display-mode').value==='player'));
$('cosmetic-claim').addEventListener('click',()=>action(async()=>{if(cosmeticCatalog.find(p=>p.id===selectedCosmetic)?.voucherOnly&&!claimedCosmetics.includes(selectedCosmetic)){$('voucher-code').focus();throw new Error('Enter your free voucher below to unlock this skin.');}claimedCosmetics=await api('wardrobe-claim',{id:selectedCosmetic});await loadCosmetics();toast('Added to your free cosmetic library.');}));
$('cosmetic-equip').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select a modded instance.');if(!claimedCosmetics.includes(selectedCosmetic))claimedCosmetics=await api('wardrobe-claim',{id:selectedCosmetic});const result=await api('wardrobe-equip',{instanceId:selectedId,id:selectedCosmetic,username:$('cosmetic-username').value.trim(),model:$('skin-model').value});toast(result.instructions||result.name+' equipped for '+result.username+'. Restart Minecraft.');if(['Skin','Animated Wings'].includes(result.type)){$('skin-preview-source').value='equipped';await loadPlayerSkin();}drawCosmetics();selectCosmetic(selectedCosmetic);if(typeof loadOutfit==='function')await loadOutfit();}));
$('cosmetic-remove').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('wardrobe-remove',{instanceId:selectedId,username:$('cosmetic-username').value.trim(),kind:'cape'});toast('Cape removed. Restart Minecraft.');}));
$('cosmetic-download').addEventListener('click',()=>action(async()=>{if(await api('wardrobe-download',{id:selectedCosmetic}))toast('Cosmetic texture saved.');}));
$('apply-boost-settings').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');const r=await api('optimization',{instanceId:selectedId,profile:$('boost-profile').value});toast(r.name+' settings applied. Previous settings are backed up.');}));
$('restore-boost-settings').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select an instance.');await api('optimization',{instanceId:selectedId,restore:true});toast('Previous Minecraft settings restored.');}));

document.addEventListener('DOMContentLoaded',()=>action(async()=>{await refresh();drawTweaks();await refreshLauncherAccess();await navigate(setupRequired()?'welcome':launcherAccess.authenticated?'home':'account');if(launcherAccess.authenticated&&!setupRequired())loadVersions().catch(e=>{versions=[];toast('Version catalog unavailable: '+e.message,true);});}));

$('preview-replay').addEventListener('click',()=>{if(capePreview)capePreview.animationStart=performance.now();});
