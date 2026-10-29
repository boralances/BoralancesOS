'use strict';
function drawMicrosoftDiagnostic(value){
 const card=$('microsoft-diagnostic');if(!value||typeof value!=='object'||!value.summary){card.classList.add('hidden');return;}
 card.classList.remove('hidden');$('microsoft-diagnostic-summary').textContent=value.summary;$('microsoft-diagnostic-help').textContent=value.help;
 $('microsoft-diagnostic-copy').disabled=value.code==='PENDING';
 card.style.borderColor=value.success?'var(--accent)':value.code==='PENDING'?'var(--edge)':'#b77d58';
}
async function loadMicrosoftDiagnostic(){try{drawMicrosoftDiagnostic(await api('auth-diagnostic'));}catch{}}
window.launcher.on('auth-diagnostic',drawMicrosoftDiagnostic);
window.launcher.on('launcher-access',access=>{if(access.authenticated)loadMicrosoftDiagnostic();});
$('microsoft-diagnostic-copy').addEventListener('click',()=>action(async()=>{await api('auth-diagnostic-copy');toast('Copied sign-in diagnostics. No credentials included.');}));
loadMicrosoftDiagnostic();
