'use strict';
// Enforce sign-in in the main process as well as in navigation. Minecraft ownership
// and the Windows/Firebase owner check remain separate from this launcher gate.
const SIGN_IN_CHANNELS=new Set(['onboarding-state','update-state','update-check','launcher-access','state','window','stop','chat-show','chat-hide','chat-bounds','chat-reload','chat-account','chat-signout','cloud-state','cloud-auth','cloud-logout','owner-state','account-list']);
const SETUP_CHANNELS=new Set(['onboarding-update','onboarding-finish','onboarding-reset','auth','logout','auth-diagnostic','auth-diagnostic-copy','account-switch','admin-rules']);
function snapshot(cloud,chat){return {authenticated:!!(cloud?.uid||chat?.uid),cloud:cloud||null,chat:chat||null,required:true};}
function allowed(channel,access,setup){return SIGN_IN_CHANNELS.has(channel)||access.authenticated===true&&(!setup?.required||SETUP_CHANNELS.has(channel));}
module.exports={snapshot,allowed};
