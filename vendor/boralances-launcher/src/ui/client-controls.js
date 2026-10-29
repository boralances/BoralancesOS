'use strict';
for(const id of ['client-search','client-category','client-status-filter'])$(id).addEventListener(id==='client-search'?'input':'change',drawClientFeatures);
$('client-clear-selection').addEventListener('click',()=>{clientSelection.clear();drawClientFeatures();});
$('native-client-install').addEventListener('click',()=>action(async()=>{if(!selected())throw new Error('Select a Fabric instance.');await api('native-client-install',{instanceId:selectedId});await loadClientFeatures();toast('In-game menu installed. Launch Minecraft and press F9.');}));
