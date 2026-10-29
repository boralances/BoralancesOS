'use strict';
labels.chat=['BORALANCES CHATTING','Stay close to your people.'];
let chatProfile=null,chatResizing;
function chatBounds(){const b=$('chat-host').getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height)};}
async function openChat(){await api('chat-show',chatBounds());$('chat-view-status').textContent='Saved chat sign-ins are restored automatically and shared with your in-game chat.';await api('chat-account').catch(e=>{$('chat-view-status').textContent=e.message;});}
new ResizeObserver(()=>{clearTimeout(chatResizing);chatResizing=setTimeout(()=>{if(page==='chat')api('chat-bounds',chatBounds()).catch(()=>{});},80);}).observe($('chat-host'));
document.querySelector('main').addEventListener('scroll',()=>{if(page==='chat')api('chat-bounds',chatBounds()).catch(()=>{});},{passive:true});
function showChatAccount(profile){chatProfile=profile;$('chat-login-status').textContent=profile?'Signed in as '+profile.name+' · Saved on this PC and shared with in-game chat. Firebase cloud sync uses the account below.':'Sign in here once to share your chat account with the launcher and in-game chat.';$('chat-signout').classList.toggle('hidden',!profile);$('chat-login').textContent=profile?'Open BoralancesChatting':'Login with BoralancesChatting';}
$('chat-login').addEventListener('click',()=>action(()=>navigate('chat')));
$('chat-verify').addEventListener('click',()=>action(async()=>{const p=await api('chat-account');if(!p)throw Error('Sign in to BoralancesChatting in this panel first.');showChatAccount(p);await navigate('account');toast('Signed in with BoralancesChatting as '+p.name+'.');}));
$('chat-signout').addEventListener('click',()=>action(async()=>{await api('chat-signout');showChatAccount(null);toast('Chat account signed out.');}));
$('chat-refresh').addEventListener('click',()=>action(()=>api('chat-reload')));
window.launcher.on('chat-account',showChatAccount);
let chatAccountChecking=false;
setInterval(async()=>{if(document.hidden||chatAccountChecking||state.busy)return;chatAccountChecking=true;try{await api('chat-account');}catch(e){if(page==='chat')$('chat-view-status').textContent=e.message;}finally{chatAccountChecking=false;}},5000);
