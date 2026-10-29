'use strict';
// Move the specular light without rebuilding displacement maps or painting clones.
(() => {
 let surface=null,frame=0,point=null;
 const reduced=matchMedia('(prefers-reduced-transparency: reduce)');
 function active(){return document.body.dataset.theme==='glass'&&!state.game?.running&&!reduced.matches&&!document.hidden;}
 function clear(){if(surface){surface.classList.remove('glass-lit');surface=null;}}
 document.addEventListener('pointermove',event=>{
  if(!active()){clear();return;}
  const next=event.target.closest?.('.settings-section,.content-card,.context-bar,.button,.instance-card,.client-card,.feature,.search-box,.segmented,.type-tabs');
  if(surface!==next){clear();surface=next;}
  if(!surface)return;point={x:event.clientX,y:event.clientY};
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!surface||!active())return;const box=surface.getBoundingClientRect();surface.style.setProperty('--glass-light-x',Math.max(0,Math.min(100,(point.x-box.left)/box.width*100))+'%');surface.style.setProperty('--glass-light-y',Math.max(0,Math.min(100,(point.y-box.top)/box.height*100))+'%');surface.style.setProperty('--glass-light-angle',(Math.atan2(point.y-box.top-box.height/2,point.x-box.left-box.width/2)*180/Math.PI+90)+'deg');surface.classList.add('glass-lit');});
 },{passive:true});
 document.addEventListener('pointerleave',clear);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 window.launcher.on('game',clear);reduced.addEventListener('change',clear);
})();
