'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {assert}=require('./core.cjs'),{PROFILES}=require('./optimization.cjs');
const THEMES=[
 {id:'aurora',name:'Aurora',accent:'#8B9FFFFF',rgb:[139,159,255],game:'26.3'},
 {id:'glacier',name:'Glacier',accent:'#69DDF1FF',rgb:[105,221,241],game:'1.21.11'},
 {id:'verdant',name:'Verdant',accent:'#91E6B0FF',rgb:[145,230,176],game:'1.21.1'},
 {id:'ember',name:'Ember',accent:'#F5B27EFF',rgb:[245,178,126],game:'1.20.1'}
];
function normalize(game,value={}){
 assert(THEMES.some(t=>t.game===game),'Unknown ready version.');
 assert(value&&typeof value==='object'&&!Array.isArray(value),'Invalid pack customization.');
 const theme=value.theme??THEMES.find(t=>t.game===game).id;
 assert(THEMES.some(t=>t.id===theme),'Choose a Boralances design.');
 const name=value.name??(THEMES.find(t=>t.id===theme).name+' '+game);
 // These names are inserted into FancyMenu's line-based property format.
 assert(typeof name==='string'&&name.trim().length>0&&name.length<=40&&/^[\p{L}\p{N} ._-]+$/u.test(name),'Use up to 40 letters, numbers, spaces, dots, dashes or underscores for the pack name.');
 const profile=value.profile??'balanced';assert(Object.hasOwn(PROFILES,profile),'Unknown optimization profile.');
 return {name:name.trim(),theme,profile};
}
const local=file=>'[source:local]/config/fancymenu/assets/boralances/'+file;
function section(type,fields){return type+' {\n'+Object.entries(fields).map(([k,v])=>'    '+k+' = '+v).join('\n')+'\n}\n';}
function text(id,source,x,y,width,anchor,color='#EDF2FAFF',scale=1){return section('element',{element_type:'text_v2',instance_identifier:id,x,y,width,height:28,anchor_point:anchor,source_mode:'direct',source,base_color:color,scale,shadow:false,interactable:false,enable_scrolling:false,auto_line_wrapping:false,text_border:0});}
function layout(identifier,theme){return 'type = fancymenu_layout\n\n'+section('layout-meta',{identifier,render_custom_elements_behind_vanilla:true,is_enabled:true,layout_index:0,...(identifier==='title_screen'?{boralances_title_schema:3}:{})})+'\n'+section('menu_background',{background_type:'image',instance_identifier:'boralances_background',show_background:true,image_path:local(theme+'/background.png'),slide:false,parallax:false,repeat_texture:false})+section('customization',{action:'backgroundoptions',keepaspectratio:true});}
function hide(id){return section('vanilla_button',{element_type:'vanilla_button',instance_identifier:id,is_hidden:true});}
function titleButtons(){const primary=[['mc_titlescreen_singleplayer_button',-32,'Singleplayer'],['mc_titlescreen_multiplayer_button',-3,'Multiplayer']].map(([id,y,label])=>section('vanilla_button',{element_type:'vanilla_button',instance_identifier:id,anchor_point:'mid-centered',x:-112,y,width:224,height:24,is_hidden:false,stay_on_screen:true,label,tooltip:label})).join('');return primary+[['mc_titlescreen_language_button',-116,'Language'],['mc_titlescreen_accessibility_button',-76,'Accessibility'],['mc_titlescreen_options_button',-36,'⚙'],['modmenu_titlescreen_mods_button',4,'M'],['mc_titlescreen_realms_button',44,'R'],['mc_titlescreen_quit_button',84,'×']].map(([id,x,label])=>section('vanilla_button',{element_type:'vanilla_button',instance_identifier:id,anchor_point:'mid-centered',x,y:84,width:32,height:20,is_hidden:false,stay_on_screen:true,label,tooltip:id.includes('mods')?'Mods':id.includes('realms')?'Minecraft Realms':id.includes('quit')?'Exit':label})).join('');}
function config(groups){return '// Original Boralances ready-instance configuration. Editable in FancyMenu.\n'+Object.entries(groups).map(([group,fields])=>'\n##['+group+']\n\n'+Object.entries(fields).map(([key,[type,value]])=>type+':'+key+" = '"+value+"';").join('\n')).join('\n')+'\n';}
function configuration(game,value){
 const selected=normalize(game,value),theme=THEMES.find(t=>t.id===selected.theme),out=new Map();
 const put=(file,text)=>out.set(file,Buffer.from(text));
 put('config/fancymenu/options.txt',config({
  customization:{show_customization_overlay:['B',false],modpack_mode:['B',false]},
  window:{show_custom_window_icon:['B',true],custom_window_icon_16:['S','/config/fancymenu/assets/boralances/'+theme.id+'/icon16.png'],custom_window_icon_32:['S','/config/fancymenu/assets/boralances/'+theme.id+'/icon32.png'],custom_window_title:['S','Boralances - '+selected.name]},
  global_customizations:{global_button_background_normal:['S',local(theme.id+'/button-normal.png')],global_button_background_hover:['S',local(theme.id+'/button-hover.png')],global_button_background_inactive:['S',local(theme.id+'/button-inactive.png')],global_button_background_nine_slice:['B',true],global_button_background_nine_slice_border_top:['I',4],global_button_background_nine_slice_border_right:['I',4],global_button_background_nine_slice_border_bottom:['I',4],global_button_background_nine_slice_border_left:['I',4],global_button_label_base_color:['S','#EDF2FAFF'],global_button_label_hover_color:['S',theme.accent],global_button_label_shadow:['B',false]},
  tutorial:{show_welcome_screen:['B',false]}
 }));
 // Concrete screen names are required here; title_screen is the layout's universal identifier.
 put('config/fancymenu/customizablemenus.txt','type = customizablemenus\n\n'+section(game==='26.3'?'net.minecraft.client.gui.screens.TitleScreen':'net.minecraft.class_442',{})+'\n'+section('de.keksuccino.drippyloadingscreen.customization.DrippyOverlayScreen',{}));
 put('config/fancymenu/customization/boralances-title.txt',layout('title_screen',theme.id).replace('boralances_title_schema = 3','boralances_title_schema = 3\n    boralances_instance_name = '+selected.name)+titleButtons()+hide('minecraft_logo_widget')+hide('minecraft_splash_widget')+section('element',{element_type:'image',instance_identifier:'boralances_panel',source:local(theme.id+'/menu-panel.png'),x:-128,y:-116,width:256,height:232,anchor_point:'mid-centered',interactable:false,repeat_texture:false,nine_slice_texture:true,nine_slice_texture_border_x:10,nine_slice_texture_border_y:10})+[-116,-76].map((x,i)=>section('element',{element_type:'image',instance_identifier:'boralances_icon_plate_'+i,source:local(theme.id+'/button-normal.png'),x,y:84,width:32,height:20,anchor_point:'mid-centered',interactable:false,repeat_texture:false,nine_slice_texture:true,nine_slice_texture_border_x:4,nine_slice_texture_border_y:4})).join('')+section('element',{element_type:'image',instance_identifier:'boralances_mark',source:local(theme.id+'/mark.png'),x:-18,y:-110,width:36,height:36,anchor_point:'mid-centered',interactable:false,repeat_texture:false})+section('element',{element_type:'image',instance_identifier:'boralances_wordmark',source:local(theme.id+'/wordmark.png'),x:-84,y:-66,width:168,height:25,anchor_point:'mid-centered',interactable:false,repeat_texture:false}));
 put('essential/config.toml','[general.experience]\nessential_menu_layout = 2\n');
 put('config/modmenu.json',JSON.stringify({mods_button_style:'classic',modify_title_screen:true},null,2));
 const overlay='de.keksuccino.drippyloadingscreen.customization.DrippyOverlayScreen';
 put('config/fancymenu/customization/boralances-loading.txt',layout(overlay,theme.id)+hide('mojang_logo')+hide('progress_bar')+text('boralances_loading_title','BORALANCES',-104,-58,208,'mid-centered',theme.accent,2)+text('boralances_loading_edition',selected.name,-104,-28,240,'mid-centered')+section('element',{element_type:'progress_bar',instance_identifier:'boralances_loading_progress',x:-140,y:20,width:280,height:6,anchor_point:'mid-centered',progress_source:'{"placeholder":"game_loading_progress"}',value_mode:'percentage',direction:'right',bar_color:theme.accent,background_color:'#253346FF',smooth_filling_animation:true})+text('boralances_loading_status','Loading game resources',-140,38,280,'mid-centered','#A6B3C6FF'));
 put('config/drippyloadingscreen/options.txt',config({general:{allow_universal_layouts:['B',false],early_fade_out_elements:['B',true],wait_for_textures_in_loading:['B',true],fade_out_loading_screen:['B',true]}}));
 if(['1.21.1','1.20.1'].includes(game))put('config/early-loading-screen.properties','# Fabric early startup progress; keep ImmediatelyFast-compatible creation point.\nreuse_early_window=false\nenable_entrypoint_information=true\nenable_mixin_pretransform=false\nallow_early_window_close=true\nwindow_creation_point=mixinLoad\n');
 put('options.txt',Object.entries(PROFILES[selected.profile].options).map(([k,v])=>k+':'+v).join('\n')+'\n');
 put('BORALANCES-READ-ME.txt','Boralances '+selected.name+'\nDesign: '+theme.name+' | Performance: '+PROFILES[selected.profile].name+'\n\nIN GAME: Press F9 while playing to open Boralances Client. Choose local capes, animated Ears wings, elytra and original Emotecraft animations. Done/Escape returns to the game. Use the Client home screen for wardrobe, HUD presets and performance settings. Favourite selected cosmetics to build a personal collection. HUD presets include Minimal, Explore and Creator. F7 opens full-screen HUD placement; Widget settings opens the tools, Arrange returns to placement, Save HUD commits and Escape cancels. The editor uses the same screen coordinates as the live HUD. Accent and reduced motion are available from Client home. Rebind keys in Minecraft Controls. Tweaks change actual Minecraft video and comfort options; Restore returns this session\'s video settings.\nWINGS: Launch through Boralances Launcher once with a public player skin or a local skin imported from Cosmetics. The launcher prepares 40 skin-preserving variants for your player name. Exported packs also include the client menu, capes and emotes; wing variants need this player preparation. Another player\'s prepared skin is never applied to your name. Restore returns the original provider texture.\nVISIBILITY: Private local cosmetics affect your client; this does not publish a skin or grant official account cloaks. Compatible Emotecraft peers may see animations through its own supported networking.\n\nFancyMenu customizes the title and Drippy resource-loading screens. Vanilla menu actions and Essential controls stay intact. Use FancyMenu controls to edit your layout.\nEssential is included as its official bootstrap mod; its runtime downloads on first launch. Its online services need their own account and connection.\n'+(['1.21.1','1.20.1'].includes(game)?'Early Loading Screen shows Fabric startup progress before the branded resource screen.':'Early Loading Screen has no compatible Fabric release for '+game+' and is not included.')+'\nMinecraft and third-party mod branding belong to their respective owners.\n');
 return {selected,files:out};
}
async function overrides(game,value,assetDirectory){
 const result=configuration(game,value);
 for(const file of ['menu-panel.png','wordmark.png','mark.png','background.png','button-normal.png','button-hover.png','button-inactive.png','icon16.png','icon32.png'])result.files.set('config/fancymenu/assets/boralances/'+result.selected.theme+'/'+file,await fs.readFile(path.join(assetDirectory,result.selected.theme,file)));
 return result;
}
async function exportPack(file,game,value,assetDirectory){
 const Zip=require('adm-zip'),zip=new Zip(file),{selected,files}=await overrides(game,value,assetDirectory);
 const index=JSON.parse(zip.readAsText('modrinth.index.json'));
 assert(index.dependencies?.minecraft===game,'Ready bundle version mismatch.');
 const entry=zip.getEntry('overrides/boralances-preset.json');assert(entry,'Ready bundle metadata is missing.');
 const info=JSON.parse(entry.getData().toString());assert(info.customization,'This ready bundle needs an update.');
 for(const entry of zip.getEntries())if(entry.entryName.startsWith('overrides/config/fancymenu/assets/boralances/'))zip.deleteFile(entry.entryName);
 for(const [relative,bytes] of files)zip.addFile('overrides/'+relative,bytes);
 index.name='Boralances '+selected.name+' - Optimization + Extras';
 zip.addFile('modrinth.index.json',Buffer.from(JSON.stringify(index,null,2)));
 zip.addFile('overrides/boralances-preset.json',Buffer.from(JSON.stringify({...info,customization:selected},null,2)));
 return zip.toBuffer();
}
module.exports={THEMES,normalize,configuration,overrides,exportPack};
