'use strict';
const glassControls = BoralancesGlassControls.mount({
 host: document.body, library: LiquidGlass, flat: true,
 active: () => document.body.dataset.theme === 'glass',
 optical: () => !state.game?.running
});
window.launcher.on('game', () => { glassControls.end(); glassControls.refresh(); });
function syncMemoryControl() { glassControls.refresh(); memoryAdvice(); }

function memoryAdvice() {
 const input=$('setting-memory'),total=state.hardware?.memoryMB;
 const recommended=total?Math.max(1024,Math.floor(Math.min(8192,total/2,total-2048)/256)*256):4096;
 const note=$('memory-advice');
 note.textContent=total?'System RAM: '+(total/1024).toFixed(1)+' GB · Suggested: '+(recommended/1024)+' GB'+(Number(input.value)>total-2048?' · Lower the allocation to leave memory for Windows.':''):'Choose a preset or drag the slider. Leave memory available for Windows.';
 for(const button of document.querySelectorAll('[data-memory-preset]')) { button.disabled=!!total&&Number(button.dataset.memoryPreset)>total;button.setAttribute('aria-pressed',String(Number(button.dataset.memoryPreset)===Number(input.value))); }
 return recommended;
}
function setMemory(value) { $('setting-memory').value=String(value);$('setting-memory').dispatchEvent(new Event('input',{bubbles:true}));syncMemoryControl();memoryAdvice(); }
for(const button of document.querySelectorAll('[data-memory-preset]'))button.addEventListener('click',()=>setMemory(Number(button.dataset.memoryPreset)));
$('memory-reset').addEventListener('click',()=>setMemory(4096));
$('memory-recommended').addEventListener('click',()=>setMemory(memoryAdvice()));
$('setting-memory').addEventListener('input',memoryAdvice);
