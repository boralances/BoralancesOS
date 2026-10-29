const {assert,readJSON,installBatch}=require('./core.cjs');
const path=require('node:path');
const FEATURES=[
  {"id":"voicechat","name":"Proximity voice chat","icon":"♫","group":"SOCIAL","description":"Simple Voice Chat adds push-to-talk and group calls. The server needs the mod/plugin and its UDP voice port configured.","projects":["simple-voice-chat"]},
  {"id":"waypoints","name":"Minimap & waypoints","icon":"⌖","group":"EXPLORATION","description":"Xaero’s Minimap adds local waypoints, deathpoints and a movable minimap. Respect each server’s minimap rules.","projects":["xaeros-minimap"]},
  {"id":"armorstatus","name":"Armor durability HUD","icon":"◈","group":"HUD","description":"Inventory HUD+ displays equipment durability and configurable inventory information.","projects":["inventoryhudplus"]},
  {"id":"statuseffects","name":"Status effect timers","icon":"◷","group":"HUD","description":"Status Effect Bars adds readable duration bars to active effects.","projects":["status-effect-bars"]},
  {"id":"chatheads","name":"Player heads in chat","icon":"☻","group":"SOCIAL","description":"Chat Heads identifies messages with player skin portraits.","projects":["chat-heads"]},
  {"id":"perspective","name":"Flexible third-person camera","icon":"◉","group":"CONTROLS","description":"Better Third Person provides independent camera rotation. Configure it in-game for your play style.","projects":["better-third-person"]},
  {id:'sodiumextra',name:'Extra Sodium controls',icon:'⚙',group:'BOOST',description:'Sodium Extra adds particle, animation and rendering controls for finer performance tuning.',projects:['sodium-extra']},
  {id:'reeses',name:'Cleaner video settings',icon:'▣',group:'CONTROLS',description:'Reese’s Sodium Options organizes Sodium settings with search and clearer controls.',projects:['reeses-sodium-options']},
  {id:'krypton',name:'Networking optimization',icon:'⌁',group:'BOOST',description:'Krypton optimizes the networking stack. Physical server latency depends on your connection.',projects:['krypton']},
  {id:'smoothswapping',name:'Animated inventory swaps',icon:'↝',group:'CONTROLS',description:'Smooth Swapping animates inventory item movement. Configure motion in its mod settings.',projects:['smooth-swapping']},
  {id:'smoothscroll',name:'Smooth scrolling',icon:'⇅',group:'CONTROLS',description:'Smooth Scroll improves scrolling in compatible Minecraft interfaces.',projects:['smooth-scroll']},
  {id:'controlling',name:'Searchable keybindings',icon:'⌕',group:'CONTROLS',description:'Controlling adds keybinding search and conflict filtering to Minecraft Controls.',projects:['controlling']},
  {id:'shulker',name:'Shulker contents preview',icon:'▦',group:'HUD',description:'ShulkerBoxTooltip previews container contents without opening the box.',projects:['shulkerboxtooltip']},
  {id:'betterdebug',name:'Readable debug HUD',icon:'▥',group:'HUD',description:'BetterF3 replaces the debug display with configurable sections and colors.',projects:['betterf3']},
  {id:'inventoryprofiles',name:'Inventory organization',icon:'☷',group:'ADVANCED',description:'Optional Inventory Profiles Next sorting and refill controls. Review its keybindings for conflicts.',projects:['inventory-profiles-next']},
  {id:'threadtweak',name:'CPU thread scheduling',icon:'⚙',group:'ADVANCED',description:'Optional ThreadTweak scheduling controls on supported versions. Benefits depend on your CPU.',projects:['threadtweak']},
  {id:'noisium',name:'World generation optimization',icon:'✦',group:'ADVANCED',description:'Optional Noisium world generation optimizations on supported older releases.',projects:['noisium']},
  {id:'fancymenu',name:'FancyMenu',icon:'▣',group:'MENUS',description:'Customize Minecraft menu layouts, images, buttons and window branding.',projects:['fancymenu']},
  {id:'drippy',name:'Drippy Loading Screen',icon:'◌',group:'MENUS',description:'Customize the resource loading screen with FancyMenu. Ready packs include an original Boralances layout.',projects:['drippy-loading-screen']},
  {id:'earlyloading',name:'Early Loading Screen',icon:'◷',group:'MENUS',description:'Shows Fabric startup progress before the resource screen on supported versions.',projects:['early-loading-screen']},
  {id:'essential',name:'Essential Mod',icon:'◇',group:'SOCIAL',description:'Friends, shared worlds and Essential features. Its online services use their own account and connection.',projects:['essential']},
  {id:'fps',name:'FPS display',icon:'▥',group:'HUD',description:'Live frame rate in your game HUD.',projects:['widgets','fpsdisplay','fps-monitor','betterf3']},
  {id:'cps',name:'CPS display',icon:'↖',group:'HUD',description:'Left and right clicks per second while you play.',projects:['widgets','modern-keystrokes','cps-plus','cpsdisplay','keystrokes']},
  {id:'ping',name:'Ping display',icon:'⌁',group:'HUD',description:'Server latency in milliseconds. Ping is meaningful on multiplayer servers.',projects:['widgets','better-ping-display-fabric','better-ping-display','pingdisplay-mod']},
  {id:'skin3d',name:'3D skins',icon:'◈',group:'STYLE',description:'Adds depth to the outer layer of player skins.',projects:['3dskinlayers']},
  {id:'cosmetics',name:'Skin cosmetics',icon:'✧',group:'STYLE',description:'Ears, tails, wings and more from compatible Ears skins. Use an Ears-enabled skin.',projects:['ears']},
  {id:'capes',name:'Animated capes',icon:'⚑',group:'STYLE',description:'Smooth cloth motion for an existing compatible cape. Does not grant a cape.',projects:['wavey-capes']},
  {id:'emotes',name:'Emotes',icon:'☺',group:'STYLE',description:'In-game emote wheel and player animations. Other players need compatible support to see them.',projects:['emotecraft']},
  {id:'animations',name:'Player animations',icon:'↝',group:'STYLE',description:'Richer third-person animations for everyday actions.',projects:['not-enough-animations']},
  {id:'mouse',name:'Mouse tweaks',icon:'⇅',group:'CONTROLS',description:'Drag stacks, collect matching items and move inventory items with the scroll wheel.',projects:['mouse-tweaks']},
  {id:'zoom',name:'Smooth zoom',icon:'⌕',group:'CONTROLS',description:'Configurable zoom with smooth camera movement.',projects:['zoomify','ok-zoomer','logical-zoom']},
  {id:'food',name:'Food & saturation',icon:'♡',group:'HUD',description:'Hunger and saturation information in your hotbar.',projects:['appleskin']},
  {id:'modmenu',name:'Mod settings menu',icon:'☷',group:'CONTROLS',description:'Open compatible mod configuration screens from Minecraft.',projects:['modmenu']},
  {id:'renderer',name:'Fast rendering',icon:'⚡',group:'BOOST',description:'Selects one compatible renderer: Sodium or Embeddium.',projects:['sodium','embeddium']},
  {id:'logic',name:'Game logic boost',icon:'✦',group:'BOOST',description:'Optimizes physics and other game systems with Lithium.',projects:['lithium']},
  {id:'memory',name:'Memory optimization',icon:'▦',group:'BOOST',description:'Reduces memory use with FerriteCore.',projects:['ferrite-core']},
  {id:'culling',name:'Hidden entity culling',icon:'◉',group:'BOOST',description:'Avoids drawing entities hidden behind walls.',projects:['entityculling']},
  {id:'immediate',name:'HUD rendering boost',icon:'↗',group:'BOOST',description:'Speeds up immediate rendering with ImmediatelyFast.',projects:['immediatelyfast']},
  {id:'modernfix',name:'Load & memory boost',icon:'✦',group:'BOOST',description:'ModernFix reduces startup overhead and memory use on supported releases.',projects:['modernfix']},
  {id:'moreculling',name:'Extra block culling',icon:'▣',group:'ADVANCED',description:'Skips additional hidden block faces with More Culling.',projects:['moreculling']},
  {id:'badoptimizations',name:'Client CPU optimizations',icon:'⚙',group:'BOOST',description:'Small client optimizations from BadOptimizations.',projects:['badoptimizations']},
  {id:'ebe',name:'Block entity rendering',icon:'▤',group:'ADVANCED',description:'Enhanced Block Entities improves compatible block-entity rendering setups.',projects:['ebe']},
  {id:'fastquit',name:'Quick world exit',icon:'↪',group:'CONTROLS',description:'FastQuit keeps the UI responsive while a singleplayer world finishes saving.',projects:['fastquit']},
  {id:'leakfix',name:'Memory leak fixes',icon:'▦',group:'BOOST',description:'Targets known memory leaks on compatible older releases.',projects:['memoryleakfix']},
  {id:'profiler',name:'Performance profiler',icon:'⌁',group:'DIAGNOSTICS',description:'Use spark to find CPU and memory bottlenecks. This is a diagnostic tool.',projects:['spark']},
  {id:'localcosmetics',name:'Local skins & capes',icon:'◈',group:'STYLE',description:'Load your own local skin and original Boralances cape, including offline profiles.',projects:['customskinloader']},
  {id:'cosmeticsharing',name:'Shared Boralances wardrobe',icon:'♧',group:'STYLE',description:'CPM relays your outfit to nearby Boralances players on compatible servers. Turn sharing on in the F9 Tweaks menu.',projects:['custom-player-models']},
  {id:'background',name:'Background FPS saver',icon:'◷',group:'BOOST',description:'Uses fewer resources when the game is unfocused.',projects:['dynamic-fps','fps-reducer']}
];
const PRESETS={
  essentials:{name:'Client essentials',ids:['fps','cps','ping','mouse','zoom','food','modmenu']},
  boost:{name:'FPS Boost',ids:['renderer','logic','memory','culling','moreculling','immediate','background','modernfix','badoptimizations','leakfix','sodiumextra','krypton']},
  style:{name:'Skins & cosmetics',ids:['skin3d','cosmetics','capes','emotes','animations']},
  complete:{name:'Recommended client',ids:FEATURES.filter(f=>!['ADVANCED','DIAGNOSTICS','MENUS','SOCIAL'].includes(f.group)).map(f=>f.id)}
};
const hints={
  fancymenu:'Use FancyMenu’s in-game editor to customize layouts. Essential integrations can depend on the installed versions.',
  'drippy-loading-screen':'Adds the Drippy resource loading screen to FancyMenu. Boralances ready instances ship with a custom progress layout.',
  'early-loading-screen':'Shows early Fabric startup progress. Not available on every Minecraft release.',
  essential:'Official Essential bootstrap downloads its runtime on first launch. Sign in to Essential for its online services.',
  widgets:'Press Right Shift or use /widgetsmod in-game to enable FPS, CPS, ping, coordinates and armor widgets, then Edit Layout.',
  'modern-keystrokes':'Open the mod’s in-game settings to choose counters and move your HUD.',
  betterf3:'Press F3 to see the enhanced debug HUD and FPS information.',
  'better-ping-display':'Shows numerical ping in the Tab player list.',
  'better-ping-display-fabric':'Shows numerical ping in the Tab player list.',
  ears:'Equip Animated Wings in the launcher wardrobe to build an Ears-enabled skin. Cosmetic wings animate without wearing elytra.',
  '3dskinlayers':'Enable outer skin layers in Minecraft Skin Customization. This mod adds depth to those layers.',
  'wavey-capes':'Animates your existing supported cape. Configure its motion from the mod settings.',
  emotecraft:'Open Emotecraft using Minecraft Controls, select the Boralances folder and assign the installed original animations to wheel slots.',
  'mouse-tweaks':'Inventory dragging and scroll-wheel movement work in-game. Adjust the mod’s settings if needed.'
};
function publicFeature(feature){
  const {projects,...value}=feature;return value;
}
async function resolveFeature(catalog,feature,instance,records=[]){
  const value=publicFeature(feature);
  if(instance.loader==='vanilla')return {...value,available:false,status:'unsupported',note:'Choose Fabric, Quilt, Forge or NeoForge to use client mods.'};
  // Preserve an existing renderer rather than installing a competing renderer.
  const candidates=[...feature.projects];
  if(feature.id==='renderer'){
    const existing=records.find(r=>['AANobbMI','sk9rgfiA'].includes(r.projectId)||/^(sodium[-_](?:fabric|neoforge|mc|[0-9])|embeddium[-_](?:mc|[0-9]))/i.test(r.name||''));
    if(existing&&(existing.local||!existing.projectId||!existing.versionId))return {...value,available:false,status:'external',note:'An imported renderer is already present. Manage it under Installed content.'};
    if(existing?.projectId){
      const index=candidates.indexOf(existing.projectId==='AANobbMI'?'sodium':'embeddium');
      if(index>0)candidates.unshift(...candidates.splice(index,1));
    }
  }
  let lastError;
  for(const slug of candidates){
    try{
      const versions=await catalog.versions('modrinth',slug,instance,'mod');
      if(!versions.length)continue;
      const normalized=(slug==='3dskinlayers'?'skinlayers3d':slug).replace(/[^a-z0-9]/g,'');
      const imported=records.find(r=>(r.local||!r.projectId)&&String(r.name||'').toLowerCase().replace(/[^a-z0-9]/g,'').startsWith(normalized));
      if(imported)return {...value,available:false,status:'external',project:slug,note:'An imported matching mod is already present. Manage or replace it under Installed content.',url:'https://modrinth.com/mod/'+slug};
      const installed=records.find(r=>r.key==='modrinth:'+versions[0].projectId);
      const version=(installed&&versions.find(v=>v.id===installed.versionId))||versions.find(v=>v.channel==='release')||versions[0];
      return {...value,available:true,status:installed?(installed.disabled?'disabled':'enabled'):'available',project:slug,projectId:version.projectId,versionId:version.id,version:version.number,installedKey:installed?.key||null,note:hints[slug]||'Configure this feature from Minecraft Controls or the mod’s in-game settings.',url:'https://modrinth.com/mod/'+slug};
    }catch(e){lastError=e.message;}
  }
  return {...value,available:false,status:lastError?'error':'unsupported',note:lastError||'No compatible release for Minecraft '+instance.minecraft+' / '+instance.loader+'.'};
}
async function listFeatures(catalog,instance,records=[]){
  // Bound catalog concurrency; keep the UI responsive without flooding providers.
  const output=new Array(FEATURES.length);let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<FEATURES.length){const index=cursor++;output[index]=await resolveFeature(catalog,FEATURES[index],instance,records);}}));
  return {features:output,presets:PRESETS};
}
async function installFeatures(catalog,instance,directory,ids,existingRecords){
  assert(Array.isArray(ids)&&ids.length>0&&ids.length<=FEATURES.length,'Choose client features to install.');
  assert(ids.every(id=>FEATURES.some(f=>f.id===id)),'Unknown client feature.');
  assert(instance.loader!=='vanilla','Create a modded instance to install client features.');
  const records=existingRecords||await readJSON(path.join(directory,'content.json'),[]);
  const selections=[],skipped=[],enabled=[],seen=new Set();
  for(const id of [...new Set(ids)]){
    const feature=FEATURES.find(f=>f.id===id);
    catalog.progress({status:'Checking '+feature.name,current:0,total:0});
    const item=await resolveFeature(catalog,feature,instance,records);
    if(item.status==='external'){enabled.push(feature.name+' (imported)');continue;}
    if(!item.available){skipped.push({name:feature.name,reason:item.note});continue;}
    if(item.status==='enabled'){enabled.push(feature.name);continue;}
    const key=item.projectId+':'+item.versionId;
    if(seen.has(key))continue;
    seen.add(key);
    selections.push({provider:'modrinth',projectId:item.projectId,versionId:item.versionId,type:'mod'});
  }
  if(selections.length)await installBatch(catalog,selections,instance,directory);
  return {installed:selections.length,alreadyEnabled:enabled,skipped};
}
module.exports={FEATURES,PRESETS,listFeatures,resolveFeature,installFeatures};
