'use strict';
const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
const reduced=()=>document.body.classList.contains('reduced')||matchMedia('(prefers-reduced-motion: reduce)').matches;
const surfaces=new Map();
function buildSurface(element){
 if(!element.getClientRects().length)return;
 let plane=element.querySelector(':scope > .material-plane');
 if(!plane){plane=document.createElement('div');plane.className='material-plane';plane.setAttribute('aria-hidden','true');element.prepend(plane);}
 const w=element.clientWidth,h=element.clientHeight;
 if(w<5||h<5)return;
 const old=surfaces.get(element);if(old&&old.w===w&&old.h===h)return;
 const r=Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius)||0,h/2);
 const material=ReferenceGlass.create(plane,{w,h,r,B:Math.min(18,h/2),prof:'squircle',T:element.classList.contains('dock')?35:24,blur:.7,spec:.42,sat:1.4,refr:.58,chroma:.04});
 surfaces.set(element,{w,h,material});
}
let resizeTimer;
function refreshGlass(){for(const element of $$('.glass-surface'))buildSurface(element);}
new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshGlass,100);}).observe(document.body);
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshGlass,120);});
function screen(name){
 if(!['desktop','welcome','boot','install'].includes(name))name='desktop';
 for(const view of $$('[data-view]'))view.hidden=view.dataset.view!==name;
 document.body.dataset.screen=name;
 $('.screen-menu').hidden=true;closePopovers();
 if(name==='install')renderInstall();
 history.replaceState(null,'','#'+name);requestAnimationFrame(refreshGlass);
}
let toastTimer;
function announce(text){const element=$('.toast');element.textContent=text;element.hidden=false;refreshGlass();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{element.hidden=true;},4500);}
function closePopovers(){for(const element of $$('.popover'))element.hidden=true;}
function popover(selector){const element=$(selector),open=element.hidden;closePopovers();element.hidden=!open;requestAnimationFrame(()=>{refreshGlass();if(open&&selector==='.spotlight')$('#app-search').focus();});}
$('#screens').addEventListener('click',()=>{$('.screen-menu').hidden=!$('.screen-menu').hidden;refreshGlass();});
for(const button of $$('button[data-screen]'))button.addEventListener('click',()=>screen(button.dataset.screen));
$('#brand-menu').addEventListener('click',()=>screen('welcome'));
$('#open-welcome').addEventListener('click',()=>screen('welcome'));
$('#welcome-continue').addEventListener('click',()=>screen('desktop'));
$('#welcome-install').addEventListener('click',()=>screen('install'));
$('#dock-install').addEventListener('click',()=>screen('install'));
$('#control-button').addEventListener('click',()=>popover('.control-center'));
$('#dock-settings').addEventListener('click',()=>popover('.control-center'));
$('#close-control').addEventListener('click',()=>{$('.control-center').hidden=true;});
$('#search-button').addEventListener('click',()=>popover('.spotlight'));
$('#launchpad').addEventListener('click',()=>popover('.spotlight'));
$('#all-apps').addEventListener('click',()=>popover('.spotlight'));
$('#overview-button').addEventListener('click',()=>popover('.mission'));
$('#close-mission').addEventListener('click',closePopovers);
function theme(light){document.body.classList.toggle('light',light);$('#appearance-name').textContent=light?'Glacier':'Obsidian';localStorage.setItem('boralances-design-theme',light?'light':'dark');}
theme(localStorage.getItem('boralances-design-theme')==='light');
$('#light-mode').addEventListener('click',()=>theme(!document.body.classList.contains('light')));
$('#reduce-motion').addEventListener('change',event=>document.body.classList.toggle('reduced',event.target.checked));
for(const button of $$('[data-local-toggle]'))button.addEventListener('click',()=>{button.classList.toggle('active');button.setAttribute('aria-pressed',String(button.classList.contains('active')));});
$('#volume').addEventListener('input',event=>{$('#volume-readout').textContent=event.target.value+'%';});
for(const button of $$('[data-workspace]'))button.addEventListener('click',()=>{
 const value=button.dataset.workspace;
 for(const item of $$('.workspace-dots button'))item.classList.toggle('active',item.dataset.workspace===value);
 $('#space-name').textContent=['Your everyday','Time to play','Room to focus'][Number(value)-1];closePopovers();
});
for(const button of $$('.side-item[data-category]'))button.addEventListener('click',()=>{
 for(const item of $$('.side-item[data-category]'))item.classList.toggle('selected',item===button);
 for(const item of $$('.application'))item.hidden=button.dataset.category!=='all'&&button.dataset.category!==item.dataset.category;
});
function openApp(name){
 if(name==='Files'){$('.finder').classList.remove('minimized');return;}
 announce(`${name} is included in BoralancesOS. This interactive design preview does not start installed applications.`);
}
for(const button of $$('[data-demo-app]'))button.addEventListener('click',()=>openApp(button.dataset.demoApp));
for(const button of $$('[data-menu]'))button.addEventListener('click',()=>announce(`${button.dataset.menu} menu · application menu layout preview. The Linux shell shows supported application actions.`));
$('.traffic-lights .close').addEventListener('click',()=>$('.finder').classList.add('minimized'));
$('.traffic-lights .minimize').addEventListener('click',()=>$('.finder').classList.add('minimized'));
$('.traffic-lights .maximize').addEventListener('click',()=>{$('.finder').classList.toggle('expanded');setTimeout(refreshGlass,420);});
const apps=[['BoralancesBrowser','boralances-browser'],['Boralances Launcher','boralances-launcher'],['JARVIS','boralances-jarvis'],['Glass Connect','boralances-glass-connect'],['Files','boralances-files'],['Terminal','boralances-terminal'],['Control Center','boralances-settings']];
function search(){const query=$('#app-search').value.toLocaleLowerCase();const results=$('.search-results');results.replaceChildren();for(const [title,icon] of apps.filter(([name])=>name.toLocaleLowerCase().includes(query))){const button=document.createElement('button'),image=document.createElement('img'),label=document.createElement('span');image.src='../assets/icons/'+icon+'.svg';image.alt='';label.textContent=title;button.append(image,label);button.addEventListener('click',()=>{closePopovers();title==='Control Center'?popover('.control-center'):openApp(title);});results.append(button);}}
$('#app-search').addEventListener('input',search);search();
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closePopovers();$('.screen-menu').hidden=true;}if((event.metaKey||event.ctrlKey)&&event.code==='Space'){event.preventDefault();popover('.spotlight');}});
// The supplied reference uses a 112x56 track, 76x56 lip lens, k=360, d=27.
const toggle=$('#glass-toggle'),knob=$('.switch-knob'),lens=$('.optical-knob');
ReferenceGlass.create(lens,{w:76,h:56,B:28,prof:'lip',T:30,blur:.2,spec:.5,sat:6,refr:1});
let on=true,x=36,target=36,velocity=0,scaleX=1,scaleY=1,pressed=false,frameId,last=0,startX=0,startValue=0,moved=false,suppress=false;
function drawSwitch(){knob.style.setProperty('--tx',x.toFixed(2)+'px');knob.style.setProperty('--sx',scaleX.toFixed(4));knob.style.setProperty('--sy',scaleY.toFixed(4));toggle.style.setProperty('--p',Math.max(0,Math.min(1,x/36)));}
function animate(now){const dt=Math.min(.025,(now-last)/1000||.016);last=now;const aimX=pressed?1.18:1,aimY=pressed?1.1:1;velocity+=(360*(target-x)-27*velocity)*dt;x+=velocity*dt;scaleX+=(aimX-scaleX)*Math.min(1,dt*22);scaleY+=(aimY-scaleY)*Math.min(1,dt*22);drawSwitch();if(Math.abs(target-x)>.015||Math.abs(velocity)>.05||Math.abs(aimX-scaleX)>.002||Math.abs(aimY-scaleY)>.002)frameId=requestAnimationFrame(animate);else{frameId=0;x=target;drawSwitch();}}
function wake(){if(reduced()){x=target;scaleX=scaleY=1;drawSwitch();return;}if(!frameId){last=performance.now();frameId=requestAnimationFrame(animate);}}
function setSwitch(value){on=value;toggle.setAttribute('aria-checked',String(on));document.body.classList.toggle('plain',!on);target=on?36:0;wake();}
toggle.addEventListener('pointerdown',event=>{pressed=true;moved=false;startX=event.clientX;startValue=target;toggle.classList.add('pressed');toggle.setPointerCapture(event.pointerId);wake();});
toggle.addEventListener('pointermove',event=>{if(!pressed)return;const delta=(event.clientX-startX)/.66;if(Math.abs(delta)>3)moved=true;if(moved){target=Math.max(-5,Math.min(41,startValue+delta));wake();}});
function end(){if(!pressed)return;pressed=false;toggle.classList.remove('pressed');if(moved){setSwitch(Math.abs(velocity)>350?velocity>0:target>18);suppress=true;}wake();}
toggle.addEventListener('pointerup',end);toggle.addEventListener('pointercancel',end);
toggle.addEventListener('click',()=>{if(suppress){suppress=false;return;}setSwitch(!on);});
toggle.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setSwitch(event.key==='ArrowRight');}});drawSwitch();
let installStep=0;
const preferences={zone:'Europe/Istanbul',theme:'dark',effects:'Balanced'};
const headings=['Make yourself<br>at home.','A little more you.','Room to<br>put down roots.','One last look.','Good things<br>are taking shape.','Welcome home.'];
function renderInstall(){
 const content=$('#install-content');$('#install-eyebrow').textContent=`0${installStep+1} / ${['WELCOME','MAKE IT YOURS','DESTINATION','REVIEW','INSTALLATION','READY'][installStep]}`;$('#install-title').innerHTML=headings[installStep];
 for(const [index,item]of $$('.installer-sidebar li').entries())item.classList.toggle('active',index===installStep);
 $('#install-back').hidden=installStep===0;$('#install-next').innerHTML=(installStep===3?'Preview installation':installStep===4?'View completion':installStep===5?'Explore desktop':'Continue')+' <span>→</span>';
 if(installStep===0)content.innerHTML='<p>A considered desktop for work and play.<br>Everything you need to get into your flow.</p><div class="install-benefits"><div><img src="../assets/icons/boralances-browser.svg" alt="">Your own browser and applications</div><div><img src="../assets/icons/boralances-launcher.svg" alt="">A workspace that makes room for play</div><div><img src="../assets/icons/boralances-settings.svg" alt="">A lighter touch on your hardware</div></div>';
 if(installStep===1){content.innerHTML='<p>Start with what feels right. You can change these later.</p><label class="preference-row">Region<select id="preview-zone"><option>Europe/Istanbul</option><option>UTC</option><option>Europe/London</option><option>America/New_York</option></select></label><label class="preference-row">Appearance<select id="preview-theme"><option value="dark">Obsidian</option><option value="light">Glacier</option></select></label><label class="preference-row">Desktop effects<select id="preview-effects"><option>Balanced</option><option>Liquid Glass</option><option>Performance</option><option>Reduce motion</option></select></label>';for(const key of ['zone','theme','effects']){const select=$('#preview-'+key);select.value=preferences[key];select.addEventListener('change',()=>{preferences[key]=select.value;if(key==='theme')theme(select.value==='light');});}}
 if(installStep===2)content.innerHTML='<p>Choose a home for your new workspace.</p><div class="destination-card"><img src="../assets/icons/boralances-os.svg" alt=""><div><b>Prepared destination</b><span>Root filesystem + EFI System Partition</span><span>Illustrative target · design preview</span></div></div><p class="install-disclaimer">The real installer displays your mounted destination devices and checks them again before it begins. This preview has no disk access.</p>';
 if(installStep===3){content.replaceChildren();const box=document.createElement('div');box.className='review-lines';for(const [label,value]of [['Destination','Prepared partitions'],['Region',preferences.zone],['Appearance',preferences.theme==='dark'?'Obsidian':'Glacier'],['Effects',preferences.effects],['Account','bora']]){const line=document.createElement('div'),name=document.createElement('span'),detail=document.createElement('b');name.textContent=label;detail.textContent=value;line.append(name,detail);box.append(line);}content.append(box);const note=document.createElement('p');note.className='install-disclaimer';note.textContent='Interface preview only. In the actual installer, you review and approve the displayed target partitions before installation.';content.append(note);}
 if(installStep===4)content.innerHTML='<div class="installation-state"><img src="../assets/icons/boralances-installer.svg" alt=""><h2>Preparing your new workspace…</h2><div class="boot-progress"><span></span></div><p>Configuration · System packages · Finishing touches</p><p class="install-disclaimer">Installation screen preview. No installation is running.<br>The native installer follows actual process output.</p></div>';
 if(installStep===5)content.innerHTML='<div class="complete-check">✓</div><p>A fresh perspective is waiting for you.</p><p class="install-disclaimer">The actual installer prompts you to restart and choose your account password on first boot. No system was installed by this preview.</p>';
 requestAnimationFrame(refreshGlass);
}
$('#install-next').addEventListener('click',()=>{if(installStep===5){installStep=0;screen('desktop');return;}installStep++;renderInstall();});
$('#install-back').addEventListener('click',()=>{installStep=Math.max(0,installStep-1);renderInstall();});
function clock(){$('#clock').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'  '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}clock();setInterval(clock,60000);
screen(new URLSearchParams(location.search).get('screen')||location.hash.slice(1)||'desktop');
window.BoralancesPreview={refreshGlass,screen,reference:{source:'Liqui(1).html',switch:{track:[112,56],thumb:[76,56],stiffness:360,damping:27}},surfaceCount:()=>surfaces.size};
