'use strict';
labels.welcome=['MAKE IT YOUR WORLD','Let’s customize your experience.'];
let welcomeStep=null,welcomeProfile=null,welcomeBusy=false,welcomeAuthPending=false;
const welcomeMoves=[];
function moveSetupControls(active){
 if(active&&!welcomeMoves.length){for(const [node,target] of [[$('cloud-form'),'welcome-login-slot'],[document.querySelector('.chat-login'),'welcome-login-slot'],[$('microsoft-diagnostic'),'welcome-diagnostic-slot']]){const marker=document.createComment('Setup control home');node.before(marker);welcomeMoves.push({node,marker});$(target).append(node);}}
 if(!active){for(const {node,marker} of welcomeMoves){marker.replaceWith(node);}welcomeMoves.length=0;}
}
function drawWelcome(){
 const setup=launcherAccess.onboarding;if(!setup){moveSetupControls(false);document.body.classList.remove('onboarding-active');return;}
 moveSetupControls(setup.required);document.body.classList.toggle('onboarding-active',setup.required);
 if(!setup.required){welcomeStep=null;welcomeProfile=null;return;}
 if(welcomeProfile!==setup.profileKey){welcomeProfile=setup.profileKey;welcomeStep=null;$('welcome-name').value=setup.offlineName||'';$('welcome-theme-choice').value='';$('welcome-mode').value='';}
 if(!welcomeStep||welcomeStep==='account'&&launcherAccess.authenticated)welcomeStep=setup.step;
 const steps=['account','theme','mode','profile'],index=steps.indexOf(welcomeStep);
 document.querySelectorAll('[data-welcome-panel]').forEach(el=>el.classList.toggle('hidden',el.dataset.welcomePanel!==welcomeStep));
 document.querySelectorAll('[data-welcome-step]').forEach((el,i)=>{el.classList.toggle('current',i===index);el.classList.toggle('complete',i<index);if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 $('welcome-step-label').textContent='Step '+(index+1)+' of 4';
 $('welcome-signed-in').textContent=launcherAccess.authenticated?'Connected as '+(launcherAccess.cloud?.name||launcherAccess.chat?.name||'your Boralances account'):'Your launcher login is saved securely on this Windows account.';
 $('welcome-account-next').classList.toggle('hidden',!launcherAccess.authenticated);
 $('welcome-account-next').disabled=welcomeBusy;$('welcome-theme-next').disabled=welcomeBusy;
 $('cloud-form').classList.toggle('hidden',launcherAccess.authenticated);
 const theme=setup.theme||state.settings.theme||'glass';
 document.querySelectorAll('[data-welcome-theme]').forEach(b=>{const active=b.dataset.welcomeTheme===($('welcome-theme-choice').value||theme);b.classList.toggle('chosen',active);b.setAttribute('aria-pressed',String(active));});
 if(!$('welcome-theme-choice').value)$('welcome-theme-choice').value=theme;
 const mode=$('welcome-mode').value||setup.mode;
 if(!$('welcome-mode').value&&setup.mode)$('welcome-mode').value=setup.mode;
 document.querySelectorAll('[data-welcome-mode]').forEach(b=>{const active=b.dataset.welcomeMode===mode;b.classList.toggle('chosen',active);b.setAttribute('aria-pressed',String(active));});
 $('welcome-mode-next').disabled=!mode||welcomeBusy;
 const offline=setup.mode!=='online',online=setup.mode!=='offline';
 $('welcome-offline-fields').classList.toggle('hidden',!offline);$('welcome-online-fields').classList.toggle('hidden',!online);
 $('welcome-name').required=offline;$('welcome-name').disabled=!offline;
 $('welcome-mc-status').textContent=setup.onlineReady?'Connected as '+setup.minecraftName:welcomeAuthPending?'Waiting for Microsoft sign-in…':'Connect your Microsoft account with Minecraft Java Edition access.';
 $('welcome-microsoft').textContent=setup.onlineReady?'Use another Minecraft account ↗':'Sign in with Microsoft ↗';
 $('welcome-microsoft').disabled=welcomeBusy||welcomeAuthPending;
 $('welcome-profile-description').textContent=setup.mode==='both'?'Choose your offline name and connect your Minecraft account. Both are required.':setup.mode==='online'?'Connect your Minecraft account to finish.':'Choose the name you’ll use for your offline profile.';
 $('welcome-finish').disabled=welcomeBusy||online&&!setup.onlineReady||offline&&!/^[A-Za-z0-9_]{3,16}$/.test($('welcome-name').value.trim());
 $('welcome-back').classList.toggle('hidden',welcomeStep==='account');$('welcome-back').disabled=welcomeBusy;
}
async function welcomeAction(fn){if(welcomeBusy)return;welcomeBusy=true;$('welcome-error').textContent='';drawWelcome();try{await fn();}catch(e){$('welcome-error').textContent=e.message;if(page!=='welcome')toast(e.message,true);}finally{welcomeBusy=false;drawWelcome();}}
function welcomeAccess(){drawWelcome();}
$('welcome-account-next').addEventListener('click',()=>{welcomeStep='theme';drawWelcome();});
document.querySelectorAll('[data-welcome-theme]').forEach(b=>b.addEventListener('click',()=>{$('welcome-theme-choice').value=b.dataset.welcomeTheme;applyTheme(b.dataset.welcomeTheme);drawWelcome();}));
$('welcome-theme-next').addEventListener('click',()=>welcomeAction(async()=>{await api('onboarding-update',{action:'theme',theme:$('welcome-theme-choice').value});await refresh();await refreshLauncherAccess();welcomeStep='mode';drawWelcome();}));
document.querySelectorAll('[data-welcome-mode]').forEach(b=>b.addEventListener('click',()=>{$('welcome-mode').value=b.dataset.welcomeMode;drawWelcome();}));
$('welcome-mode-next').addEventListener('click',()=>welcomeAction(async()=>{await api('onboarding-update',{action:'mode',mode:$('welcome-mode').value});await refreshLauncherAccess();welcomeStep='profile';drawWelcome();$('welcome-name').value=launcherAccess.onboarding.offlineName||$('welcome-name').value;}));
$('welcome-back').addEventListener('click',()=>{welcomeStep=({theme:'account',mode:'theme',profile:'mode'})[welcomeStep]||'account';drawWelcome();});
$('welcome-name').addEventListener('input',drawWelcome);
$('welcome-profile-form').addEventListener('submit',e=>{e.preventDefault();welcomeAction(async()=>{await api('onboarding-finish',{offlineName:$('welcome-name').value.trim()});await refresh();fillSettings();await refreshLauncherAccess();await navigate('home');if(!versions.length)loadVersions().catch(e=>toast(e.message,true));});});
$('welcome-microsoft').addEventListener('click',()=>welcomeAction(async()=>{await api('auth');welcomeAuthPending=true;drawWelcome();}));
$('setup-again').addEventListener('click',()=>welcomeAction(async()=>{await api('onboarding-reset');$('welcome-theme-choice').value='';$('welcome-mode').value='';await refreshLauncherAccess();welcomeStep='theme';await navigate('welcome');}));
window.launcher.on('account',()=>{welcomeAuthPending=false;refreshLauncherAccess().catch(()=>{});});
window.launcher.on('auth-error',message=>{welcomeAuthPending=false;$('welcome-error').textContent=message;drawWelcome();});
window.launcher.on('auth-diagnostic',value=>{if(value?.code==='PENDING')welcomeAuthPending=true;else welcomeAuthPending=false;drawWelcome();});
