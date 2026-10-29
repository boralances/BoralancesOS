'use strict';
window.CreateWizard=(()=>{
 let step=0,experience='modded',check=0;
 const names={fabric:'Fabric',neoforge:'NeoForge',forge:'Forge',quilt:'Quilt',vanilla:'Vanilla'};
 const symbols={fabric:'▧',neoforge:'✦',forge:'⚒',quilt:'▦',vanilla:'◇'};
 function draw(){
  document.querySelectorAll('[data-create-step]').forEach(s=>s.hidden=Number(s.dataset.createStep)!==step);
  document.querySelectorAll('.wizard-steps li').forEach((s,i)=>{s.classList.toggle('current',i===step);s.classList.toggle('complete',i<step);if(i===step)s.setAttribute('aria-current','step');else s.removeAttribute('aria-current');});
  document.querySelectorAll('[data-experience]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.experience===experience)));
  $('create-heading').textContent=['Start something yours.','Choose your Minecraft.','Built on your choice.','Ready for your next world.'][step];
  $('create-back').hidden=step===0;$('create-next').hidden=step===3;$('create-submit').hidden=step!==3;
  $('loader-note').hidden=step<2;
  if(step===3)$('create-review').textContent='MINECRAFT '+$('create-version').value+' / '+names[$('create-loader').value]+($('create-loader').value==='vanilla'?'':' / '+$('create-build').value);
 }
 function select(loader){$('create-loader').value=loader;$('create-loader').dispatchEvent(new Event('change'));document.querySelectorAll('[data-loader-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.loaderChoice===loader)));}
 async function cards(){const request=++check,version=$('create-version').value;
  const loaders=experience==='vanilla'?['vanilla']:['fabric','neoforge','forge','quilt'];
  $('loader-cards').innerHTML=loaders.map(id=>'<button type="button" class="loader-choice" data-loader-choice="'+id+'" aria-pressed="'+($('create-loader').value===id)+'"><span class="choice-symbol">'+symbols[id]+'</span><strong>'+names[id]+'</strong><small role="status">'+(id==='vanilla'?'Official Minecraft':'Checking…')+'</small></button>').join('');
  $('loader-cards').querySelectorAll('button').forEach(b=>{b.disabled=b.dataset.loaderChoice!=='vanilla';b.onclick=()=>select(b.dataset.loaderChoice);});
  await Promise.all(loaders.filter(id=>id!=='vanilla').map(async id=>{try{const builds=await api('loaders',{loader:id,minecraft:version});if(request!==check)return;const b=$('loader-cards').querySelector('[data-loader-choice="'+id+'"]');b.disabled=!builds.length;b.querySelector('small').textContent=builds.length?'Minecraft '+version:'Unavailable for '+version;}catch{if(request!==check)return;const b=$('loader-cards').querySelector('[data-loader-choice="'+id+'"]');b.disabled=false;b.querySelector('small').textContent='Could not check · retry';b.onclick=()=>{select(id);cards();};}}));
 }
 document.querySelectorAll('[data-experience]').forEach(b=>b.addEventListener('click',()=>{experience=b.dataset.experience;select(experience==='vanilla'?'vanilla':$('create-loader').value==='vanilla'?'fabric':$('create-loader').value);draw();}));
 $('create-back').onclick=()=>{step=Math.max(0,step-1);draw();};
 $('create-form').addEventListener('keydown',event=>{if(event.key==='Enter'&&step<3&&event.target.tagName!=='BUTTON'){event.preventDefault();$('create-next').click();}});
 $('create-next').onclick=()=>action(async()=>{if(step===1&&!$('create-version').value)throw new Error('Choose a Minecraft version.');if(step===2&&!loaderReady)throw new Error('Choose a compatible loader build before continuing.');step=Math.min(3,step+1);draw();if(step===2)await cards();if(step===3)$('create-name').focus();});
 return {open(){check++;step=0;experience=$('create-loader').value==='vanilla'?'vanilla':'modded';draw();}};
})();
