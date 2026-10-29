'use strict';
// Separate selection and pointer lenses: hovering never changes the open page.
(function(){
 function mount(nav,{selector,library,enabled,supported,optical=()=>true}){
  if(!nav||nav.querySelector('.sidebar-hover-lens'))return;
  const alreadyMounted=!!nav.querySelector('.sidebar-lens');nav.dataset.sidebarLensMounted='true';nav.classList.add('glass-sidebar-host');
  const reduce=matchMedia('(prefers-reduced-transparency: reduce)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const lens=alreadyMounted?nav.querySelector('.sidebar-lens'):document.createElement('span');if(!alreadyMounted){lens.className='sidebar-lens glass-component';lens.setAttribute('aria-hidden','true');lens.hidden=true;nav.prepend(lens);}
  const glass=supported&&!alreadyMounted?new library.Glass(lens,{profile:'magnify',radius:14,bezel:10,thickness:7,zoom:1.34,zoomShape:'ellipse',strength:1.25,maxPixels:12000}):null;
  const hoverLens=document.createElement('span');hoverLens.className='sidebar-hover-lens glass-component';hoverLens.setAttribute('aria-hidden','true');hoverLens.hidden=true;nav.prepend(hoverLens);
  const pointerLight=document.createElement('span');pointerLight.className='sidebar-pointer-light';pointerLight.setAttribute('aria-hidden','true');nav.prepend(pointerLight);
  const hoverGlass=supported?new library.Glass(hoverLens,{profile:'magnify',radius:14,bezel:9,thickness:6,zoom:1.18,zoomShape:'ellipse',strength:1.15,maxPixels:14000}):null;
  const events=new AbortController();
  let pointer=null,hoverFrame=0,hoverGeometry='';
  let hovered=null,frame=0,animation=null,last=null,disposed=false;
  const valid=row=>row&&nav.contains(row)&&row.matches(selector)&&!row.hidden&&row.getClientRects().length;
  function stop(){animation?.cancel();animation=null;lens.classList.remove('sidebar-lens-moving');}
  function hide(){stop();last=null;lens.hidden=true;glass?.enable(false);}
  function hideHover(){hoverLens.hidden=true;hoverGlass?.enable(false);nav.classList.remove('glass-pointer-present');hoverLens.classList.remove('glass-pointer-held');}
  function updateHover(){
   hoverFrame=0;if(disposed)return;
   if(!pointer||!enabled()||document.body.dataset.glassPointer==='off'||document.hidden||reduce.matches){hideHover();return;}
   const a=nav.getBoundingClientRect(),px=pointer.x-a.left-nav.clientLeft,py=pointer.y-a.top-nav.clientTop;
   if(px<0||py<0||px>nav.clientWidth||py>nav.clientHeight){hideHover();return;}
   nav.classList.add('glass-pointer-present');nav.style.setProperty('--sidebar-pointer-x',px+'px');nav.style.setProperty('--sidebar-pointer-y',py+'px');
   const candidate=document.elementFromPoint(pointer.x,pointer.y)?.closest(selector),row=valid(candidate)?candidate:null;
   if(row&&row===(alreadyMounted?nav.querySelector(selector+'.active'):last?.row)){hideHover();nav.classList.add('glass-pointer-present');const b=row.getBoundingClientRect();lens.style.setProperty('--lens-light-x',(pointer.x-b.left)+'px');lens.style.setProperty('--lens-light-y',(pointer.y-b.top)+'px');return;}
   let x,y,w,h,radius,clip='none';
   if(row){const b=row.getBoundingClientRect(),scroller=row.closest('nav'),bounds=scroller?.getBoundingClientRect();
    w=b.width;h=b.height;x=b.left-a.left-nav.clientLeft;y=b.top-a.top-nav.clientTop;radius=14;
    if(bounds)clip='inset('+Math.max(0,bounds.top-b.top)+'px 0 '+Math.max(0,b.bottom-bounds.bottom)+'px 0 round 14px)';
   }else{w=Math.min(84,nav.clientWidth-12);h=Math.min(84,nav.clientHeight-12);radius=Math.min(w,h)/2;x=Math.max(6,Math.min(nav.clientWidth-w-6,px-w/2));y=Math.max(6,Math.min(nav.clientHeight-h-6,py-h/2));}
   hoverLens.hidden=false;hoverLens.style.width=w+'px';hoverLens.style.height=h+'px';hoverLens.style.borderRadius=radius+'px';hoverLens.style.clipPath=clip;
   hoverLens.style.transform='translate('+(x+nav.scrollLeft)+'px,'+(y+nav.scrollTop)+'px)';
   hoverLens.style.setProperty('--lens-light-x',(px-x)+'px');hoverLens.style.setProperty('--lens-light-y',(py-y)+'px');
   hoverLens.classList.toggle('glass-pointer-held',pointer.held);hoverGlass?.enable(optical());
   const geometry=w+':'+h+':'+radius+':'+!!row;
   if(optical()&&geometry!==hoverGeometry){hoverGeometry=geometry;hoverGlass?.update({radius,zoomShape:row?'ellipse':'circle'});}
  }
  function scheduleHover(){if(!hoverFrame&&!disposed)hoverFrame=requestAnimationFrame(updateHover);}
  function clearPointer(){pointer=null;hideHover();}
  nav.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;pointer={x:event.clientX,y:event.clientY,held:!!event.buttons};scheduleHover();},{passive:true,signal:events.signal});
  nav.addEventListener('pointerdown',event=>{if(pointer){pointer.held=true;scheduleHover();}},{passive:true,signal:events.signal});
  window.addEventListener('pointerup',()=>{if(pointer){pointer.held=false;scheduleHover();}},{passive:true,signal:events.signal});
  for(const type of ['pointerleave','pointercancel'])nav.addEventListener(type,clearPointer,{signal:events.signal});
  window.addEventListener('blur',clearPointer,{signal:events.signal});document.addEventListener('visibilitychange',clearPointer,{signal:events.signal});
  nav.addEventListener('scroll',scheduleHover,{capture:true,passive:true,signal:events.signal});window.addEventListener('resize',scheduleHover,{signal:events.signal});reduce.addEventListener('change',scheduleHover,{signal:events.signal});motion.addEventListener('change',scheduleHover,{signal:events.signal});
  const pointerThemes=new MutationObserver(()=>{hoverGlass?.update();scheduleHover();});for(const root of [document.documentElement,document.body])pointerThemes.observe(root,{attributes:true,attributeFilter:['data-theme','data-glass-effects','data-glass-pointer','data-glass-motion','data-glass-clarity','data-glass-light','data-glass-quality','class']});
  const destroyPointer=()=>{cancelAnimationFrame(hoverFrame);events.abort();pointerThemes.disconnect();hoverGlass?.destroy();hoverLens.remove();pointerLight.remove();nav.classList.remove('glass-pointer-present');};
  if(alreadyMounted){const pointerRows=new MutationObserver(records=>{if(records.some(r=>r.target!==nav&&r.target!==lens&&r.target!==hoverLens&&r.target!==pointerLight))scheduleHover();});pointerRows.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','hidden']});return {schedule:scheduleHover,lens,hoverLens,destroy(){disposed=true;pointerRows.disconnect();destroyPointer();}};}
  function update(){frame=0;if(disposed)return;if(document.body.dataset.glassMotion==='off')stop();if(!enabled()||document.hidden||reduce.matches){hide();return;}
   const focused=document.activeElement?.closest(selector),selected=nav.querySelector(selector+'.active');
   const row=valid(focused)&&focused.matches(':focus-visible')?focused:valid(selected)?selected:valid(focused)?focused:valid(hovered)?hovered:null;
   if(!valid(row)){hide();return;}glass?.enable(optical());if(optical())glass?.update();
   const a=nav.getBoundingClientRect(),b=row.getBoundingClientRect(),scroller=row.closest('nav'),clip=scroller?.getBoundingClientRect();
   if(clip&&(b.bottom<=clip.top||b.top>=clip.bottom)){hide();return;}
   const goal={row,x:b.left-a.left-nav.clientLeft+nav.scrollLeft,y:b.top-a.top-nav.clientTop+nav.scrollTop,w:b.width,h:b.height};
   const transform='translate('+goal.x+'px,'+goal.y+'px)';
   lens.style.clipPath=clip?'inset('+Math.max(0,clip.top-b.top)+'px 0 '+Math.max(0,b.bottom-clip.bottom)+'px 0 round 14px)':'none';
   if(last&&last.row===row&&Math.abs(last.x-goal.x)<.5&&Math.abs(last.y-goal.y)<.5&&Math.abs(last.w-goal.w)<.5&&Math.abs(last.h-goal.h)<.5)return;
   const previous=last,visible=!lens.hidden,start=visible?getComputedStyle(lens).transform:transform;
   stop();lens.hidden=false;lens.style.transition='none';lens.style.width=goal.w+'px';lens.style.height=goal.h+'px';lens.style.transform=transform;
   const travel=previous?Math.hypot(goal.x-previous.x,goal.y-previous.y):0;
   if(visible&&previous?.row!==row&&!motion.matches&&document.body.dataset.glassMotion!=='off'&&travel>1){
    let matrix;try{matrix=new DOMMatrixReadOnly(start);}catch{matrix={e:previous.x,f:previous.y};}
    const stretch=Math.min(.34,travel/580),mx=(matrix.e+goal.x)/2,my=(matrix.f+goal.y)/2;
    lens.classList.add('sidebar-lens-moving');
    animation=lens.animate([{transform:start,width:previous.w+'px',height:previous.h+'px'},{offset:.45,transform:'translate('+mx+'px,'+my+'px) scale('+(1+stretch*.12)+','+(1+stretch)+')',width:goal.w+'px',height:goal.h+'px'},{transform,width:goal.w+'px',height:goal.h+'px'}],{duration:Math.min(680,420+travel*.25),easing:'cubic-bezier(.22,.8,.24,1)',fill:'none'});
    const current=animation;current.finished.then(()=>{if(animation===current){animation=null;lens.classList.remove('sidebar-lens-moving');glass?.update();}},()=>{});
   }
   last=goal;if(optical())glass?.update();
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(update);scheduleHover();}
  nav.addEventListener('pointerover',e=>{const candidate=e.target.closest?.(selector);hovered=valid(candidate)?candidate:null;if(!last)schedule();});
  for(const type of ['pointerleave','pointercancel'])nav.addEventListener(type,()=>{hovered=null;schedule();});
  for(const type of ['focusin','focusout','scroll','click'])nav.addEventListener(type,schedule,true);
  const rows=new MutationObserver(records=>{if(records.some(r=>r.target!==nav&&r.target!==lens&&r.target!==hoverLens&&r.target!==pointerLight&&!lens.contains(r.target)&&!hoverLens.contains(r.target)))schedule();});rows.observe(nav,{attributes:true,childList:true,subtree:true,attributeFilter:['class','hidden']});
  const themes=new MutationObserver(schedule);themes.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-glass-effects','class']});themes.observe(document.body,{attributes:true,attributeFilter:['data-theme','data-glass-pointer','data-glass-motion','data-glass-clarity','data-glass-light','data-glass-quality','class']});
  const resize=new ResizeObserver(schedule);resize.observe(nav);for(const row of nav.querySelectorAll(selector))resize.observe(row);
  document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',schedule);reduce.addEventListener('change',schedule);motion.addEventListener('change',()=>{stop();schedule();});schedule();
  return {schedule,lens,hoverLens,destroy(){disposed=true;cancelAnimationFrame(frame);destroyPointer();stop();rows.disconnect();themes.disconnect();resize.disconnect();glass?.destroy();lens.remove();delete nav.dataset.sidebarLensMounted;}};
 }
 window.BoralancesSidebarGlass={mount};
 if(window.launcher){const instance=mount(document.querySelector('.sidebar'),{selector:'.nav',library:LiquidGlass,supported:glassSupported,enabled:()=>document.body.dataset.theme==='glass',optical:()=>!state.game?.running});if(instance)window.launcher.on('game',instance.schedule);}
 else {const active=()=>document.documentElement.dataset.theme==='liquidglass'&&document.documentElement.dataset.glassEffects!=='low'&&!document.documentElement.classList.contains('lgx-high-contrast');const supported=/Chrome\/|Chromium\/|Electron\//.test(navigator.userAgent)&&CSS.supports('backdrop-filter','url(#test)');for(const nav of document.querySelectorAll('.rail'))mount(nav,{selector:'.rail-btn',library:BoralancesRefraction,enabled:active,supported});}
})();
