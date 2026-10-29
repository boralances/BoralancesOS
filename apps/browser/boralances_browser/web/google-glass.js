/* A local visual theme on Google's real page; no replacement results or native host bridge. */
(function(){'use strict';
 if(!/^(www\.)?google\.(com|com\.tr)$/.test(location.hostname)||!/^\/(?:search)?$/.test(location.pathname))return;
 if(document.querySelector('iframe[src*=recaptcha],.g-recaptcha,form[action*=\"/sorry/\"]')){document.documentElement.classList.remove('boralances-google','boralances-google-dark');return;}var config=window.__boralancesSettings||{};
 if(window.__boralancesGoogleGlass){window.__boralancesGoogleGlass.update(config);return;}
 var style=document.createElement('style');style.id='boralances-google-style';document.head.appendChild(style);
 var shapes=document.createElement('div');shapes.id='boralances-google-backdrop';shapes.setAttribute('aria-hidden','true');document.body.prepend(shapes);
 var badge=document.createElement('div');badge.id='boralances-google-badge';badge.textContent='b.  Liquid Glass · Google Search';badge.setAttribute('aria-hidden','true');document.body.appendChild(badge);
 var materials=new Map(),timer;
 function scan(){materials.forEach(function(m,el){if(!el.isConnected){var f=document.getElementById('gl-'+el.dataset.gid);if(f)f.remove();materials.delete(el);}});if(!config.enabled)return;document.querySelectorAll('#search h3').forEach(function(h){var block=h.closest('.MjjYud')||h.closest('.g')||h.closest('.tF2Cxc');if(block)block.classList.add('boralances-google-result');});
  var search=document.querySelector('.RNNXgb');if(search){var w=search.offsetWidth,h=search.offsetHeight,old=materials.get(search);if(w>50&&h>15&&(!old||old.w!==w||old.h!==h)){var width=search.style.width,height=search.style.height;var optic=ReferenceGlass.create(search,{w:w,h:h,r:h/2,B:20,prof:'squircle',T:50,blur:.35,spec:.22,sat:1.7,refr:(config.depth||0)/75,chroma:.14});search.style.width=width;search.style.height=height;materials.set(search,{w:w,h:h,optic:optic});}}
 }
 function queue(){clearTimeout(timer);timer=setTimeout(scan,180);}
 function update(c){config=c;document.documentElement.dataset.boralancesGoogleBackdrop=c.backdrop||'prism';document.documentElement.classList.toggle('boralances-google',!!c.enabled);document.documentElement.classList.toggle('boralances-google-dark',!!c.dark);document.documentElement.classList.toggle('boralances-google-still',!!c.reduced);
  style.textContent=window.__boralancesGoogleCss||'';
  document.documentElement.style.setProperty('--boralances-glass-strength',String((c.depth||0)/100));
  materials.forEach(function(m,el){if(!c.enabled){el.style.backdropFilter='';el.style.webkitBackdropFilter='';}else{m.optic.set({refr:(c.depth||0)/75});el.style.backdropFilter='url(#gl-'+el.dataset.gid+')';el.style.webkitBackdropFilter=el.style.backdropFilter;}});
  shapes.hidden=badge.hidden=!c.enabled;scan();
 }
 var observer=new MutationObserver(function(records){if(records.some(function(r){return r.addedNodes.length&&r.target!==style;}))queue();});observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',queue);window.__boralancesGoogleGlass={update:update,health:function(){return{enabled:!!config.enabled,depth:config.depth,results:document.querySelectorAll('.boralances-google-result').length,filters:materials.size};}};update(config);
})();
