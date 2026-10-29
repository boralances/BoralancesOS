'use strict';
// Chromium is gated explicitly: SVG backdrop filters are not supported everywhere.
const glassSupported=/Chrome\/|Chromium\/|Electron\/|Edg\//.test(navigator.userAgent)&&CSS.supports('backdrop-filter','url(#test)');
const glassPanels=new Map();let glassScanTimer;
function updateGlass(){
 const enabled=document.body.dataset.theme==='glass'&&!state.game?.running&&!document.hidden&&!matchMedia('(prefers-reduced-transparency: reduce)').matches;
 document.body.classList.toggle('glass-performance-mode',!!state.game?.running);
 for(const [element,material]of glassPanels){const box=element.getBoundingClientRect();if(!element.isConnected||!element.getClientRects().length||box.bottom<0||box.top>innerHeight){material.destroy();glassPanels.delete(element);}else material.enable(enabled);if(enabled)material.update();}
 if(enabled&&glassSupported)for(const element of document.querySelectorAll('.context-bar,.native-client-panel,.chat-welcome,.settings-section,.content-card')){
  const box=element.getBoundingClientRect();if(!box.width||!box.height||box.bottom<0||box.top>innerHeight||glassPanels.has(element)||glassPanels.size>=24)continue;
  const material=new LiquidGlass.Glass(element,{radius:parseFloat(getComputedStyle(element).borderTopLeftRadius)||14,bezel:20,thickness:10,strength:1.15,maxPixels:120000});glassPanels.set(element,material);material.enable(true);
 }
}
function scheduleGlass(){clearTimeout(glassScanTimer);glassScanTimer=setTimeout(updateGlass,120);}
new MutationObserver(updateGlass).observe(document.body,{attributes:true,attributeFilter:['data-theme','data-glass-clarity','data-glass-light','data-glass-quality']});
new MutationObserver(records=>{if(records.some(record=>record.type==='attributes'?record.target.classList.contains('page'):[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&!node.matches('.glass-filter-definitions'))))scheduleGlass();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('scroll',scheduleGlass,true);window.addEventListener('resize',scheduleGlass);
document.addEventListener('visibilitychange',updateGlass);window.launcher.on('game',updateGlass);updateGlass();
