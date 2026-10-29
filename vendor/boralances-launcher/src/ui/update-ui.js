'use strict';
let launcherUpdate=null;
function showLauncherUpdate(value){
 launcherUpdate=value;
 const busy=['checking','downloading','applying'].includes(value.phase),game=!!state.game?.running;
 $('update-version').textContent='Version '+value.currentVersion+' · '+(value.mode==='portable'?'Portable launcher':value.mode==='installed'?'Installed launcher':'Development build');
 const messages={idle:'Check for the latest launcher release.',checking:'Checking for updates…',current:'You are using the latest available launcher.',available:'Version '+value.latestVersion+' is available.',downloading:'Downloading update · '+(value.downloaded/1000000).toFixed(1)+' / '+(value.total/1000000).toFixed(1)+' MB',ready:game?'Update verified. Close Minecraft to install.':'Update verified and ready to install.',applying:'Restarting the launcher to install the update…',error:value.error};
 $('update-status').textContent=(messages[value.phase]||'Ready')+(value.lastFailure&&!busy?' '+value.lastFailure:'');
 $('update-phase').textContent=({idle:'Ready',checking:'Checking',current:'Up to date',available:'New release',downloading:'Downloading',ready:'Verified',applying:'Restarting',error:'Unavailable'})[value.phase]||'Ready';
 $('update-notes').textContent=value.latestVersion&&['available','ready'].includes(value.phase)?value.notes:'';
 $('update-auto').checked=value.autoCheck;
 $('update-check').disabled=busy||value.phase==='ready';
 $('update-download').classList.toggle('hidden',!value.supported||!['available','error'].includes(value.phase)||!value.latestVersion);$('update-download').disabled=busy;
 $('update-install').classList.toggle('hidden',value.phase!=='ready');$('update-install').disabled=game||!!state.busy;
 $('update-cancel').classList.toggle('hidden',value.phase!=='downloading');
 $('update-progress').classList.toggle('hidden',value.phase!=='downloading');$('update-progress').max=value.total||1;$('update-progress').value=value.downloaded||0;
 $('update-notice').classList.toggle('hidden',!['available','ready'].includes(value.phase));$('update-notice-text').textContent=value.phase==='ready'?'A verified launcher update is ready to install.':'Launcher '+value.latestVersion+' is available.';
}
for(const [id,channel] of [['update-check','update-check'],['update-download','update-download'],['update-cancel','update-cancel'],['update-install','update-install']])$(id).addEventListener('click',()=>action(async()=>{const result=await api(channel);if(result&&typeof result==='object')showLauncherUpdate(result);}));
$('update-auto').addEventListener('change',()=>action(async()=>showLauncherUpdate(await api('update-config',{autoCheck:$('update-auto').checked}))));
$('update-open').addEventListener('click',()=>navigate('settings'));
window.launcher.on('update',showLauncherUpdate);
for(const channel of ['game','busy'])window.launcher.on(channel,()=>{if(launcherUpdate)showLauncherUpdate(launcherUpdate);});
api('update-state').then(showLauncherUpdate).catch(e=>{$('update-status').textContent=e.message;});
