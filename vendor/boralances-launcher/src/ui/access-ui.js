'use strict';
labels.creators=['THE PEOPLE BEHIND YOUR WORLDS','Featured creators.'];
function applyLauncherAccess(value){
 const finishedSetup=launcherAccess.onboarding?.required&&!value.onboarding?.required;
 launcherAccess=value;document.body.classList.toggle('launcher-locked',!value.authenticated);
 if(finishedSetup){lastPlayMode=null;drawState();}
 $('launcher-access-status').textContent=value.authenticated?'Signed in · '+(value.cloud?.name||value.chat?.name):'Sign in with Boralances or BoralancesChatting to continue. Your login is saved on this Windows account.';
 document.querySelectorAll('.nav[data-page]').forEach(b=>b.disabled=(!value.authenticated||value.onboarding?.required)&&!['account','chat'].includes(b.dataset.page));
 $('launcher-continue').disabled=!value.authenticated;
 if(typeof showChatAccount==='function')showChatAccount(value.chat);
 if(typeof drawWelcome==='function')drawWelcome();
 if(value.onboarding?.required&&page!=='chat')navigate('welcome').catch(()=>{});
 else if(!value.onboarding?.required&&page==='welcome')navigate(value.authenticated?'home':'account').catch(()=>{});
 else if(!value.authenticated&&!['account','chat'].includes(page))navigate('account').catch(()=>{});
}
async function refreshLauncherAccess(){const value=await api('launcher-access');applyLauncherAccess(value);return value;}
window.launcher.on('launcher-access',applyLauncherAccess);
$('launcher-continue').addEventListener('click',()=>action(async()=>{await refresh();await navigate(setupRequired()?'welcome':'home');if(!setupRequired()&&!versions.length)await loadVersions();}));
async function loadFeaturedCreators(){
 $('creators-grid').innerHTML=loading('Finding creators of your featured projects…');
 const result=await api('featured-creators');
 $('creators-status').textContent='Authors are listed from the projects’ provider metadata.'+(result.unavailable?' '+result.unavailable+' projects could not be checked.':'');
 $('creators-grid').innerHTML=result.creators.length?result.creators.map((c,i)=>'<article class="content-card"><span class="sponsor-badge">'+escape(c.provider.toUpperCase())+' CREATOR</span><h3>'+escape(c.name)+'</h3><p>'+c.projects.map(p=>escape(p.name)).join(' · ')+'</p><div class="content-foot"><span>'+c.projects.length+' featured projects</span><button class="button subtle" data-creator="'+i+'">Creator profile ↗</button></div></article>').join(''):empty('Creators unavailable.','Check your connection and CurseForge key, then refresh.');
 $('creators-grid').querySelectorAll('[data-creator]').forEach(b=>b.addEventListener('click',()=>action(()=>api('external',{url:result.creators[Number(b.dataset.creator)].url}))));
}
$('creators-refresh').addEventListener('click',()=>action(loadFeaturedCreators));
