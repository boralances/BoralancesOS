(function(){
 'use strict';
 if(window.__boralancesPhysicalGlassScan||(document.getElementById('boralances-physical-glass')&&!window.__boralancesPhysicalGlassManaged))return;
 window.__boralancesPhysicalGlassScan=true;
 const materials=new Map(),reduced=matchMedia('(prefers-reduced-transparency: reduce)');
 const supported=/Chrome\/|Chromium\/|Electron\//.test(navigator.userAgent)&&CSS.supports('backdrop-filter','url(#test)');
 let timer;
 function scan(){
  const active=document.documentElement.dataset.theme==='liquidglass'&&!document.hidden&&!reduced.matches&&document.documentElement.dataset.glassEffects!=='low'&&!document.documentElement.classList.contains('lgx-high-contrast');
  const selected=[];
  // Bound GPU layers and map memory; chat messages and small buttons keep blur.
  if(active)for(const selector of ['.auth-card','.modal','.bottom-sheet','.call-overlay-card','.topbar','.composer','.panel','.sidebar','.rail'])for(const element of document.querySelectorAll(selector)){
   const box=element.getBoundingClientRect();
   if(selected.length>=12||box.width<24||box.height<20||box.bottom<0||box.top>innerHeight||box.right<0||box.left>innerWidth||getComputedStyle(element).visibility==='hidden'||selected.some(e=>e===element||e.contains(element)||element.contains(e)))continue;
   selected.push(element);
  }
  for(const [element,glass]of materials)if(!selected.includes(element)){glass?.destroy();element.classList.remove('boralances-physical-glass');materials.delete(element);}
  for(const element of selected){
   element.classList.add('boralances-physical-glass');
   if(!supported)continue;
   const style=getComputedStyle(element),options={radius:parseFloat(style.borderTopLeftRadius)||18,maxPixels:90000};
   for(const [key,name]of Object.entries({bezel:'--glass-bezel',thickness:'--glass-thickness',index:'--glass-index',strength:'--glass-strength'})){const value=parseFloat(style.getPropertyValue(name));if(Number.isFinite(value))options[key]=value;}
   if(!materials.has(element)){const glass=new BoralancesRefraction.Glass(element,options);materials.set(element,glass);glass.enable(true);}else materials.get(element).update(options);
  }
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(scan,220);}
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-glass-effects','class','style']});
 new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.glass-filter-definitions')&&!r.target.classList?.contains('boralances-physical-glass')))schedule();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 document.addEventListener('visibilitychange',schedule);document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);reduced.addEventListener('change',schedule);scan();
})();

(function(){
 if(window.__boralancesGlassControls)return;
 window.__boralancesGlassControls=BoralancesGlassControls.mount({host:document.documentElement,library:BoralancesRefraction,
 active:()=>document.documentElement.dataset.theme==='liquidglass',
 optical:()=>document.documentElement.dataset.glassEffects!=='low'&&!document.documentElement.classList.contains('lgx-high-contrast')
 });
})();
