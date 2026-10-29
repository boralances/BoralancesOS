'use strict';
// Persist only allowlisted authentication metadata, never provider response bodies.
const STAGES={callback:'Microsoft browser callback',microsoft:'Microsoft token exchange',xbox:'Xbox Live sign-in',xsts:'Xbox authorization',minecraft:'Minecraft service sign-in',profile:'Minecraft Java profile',complete:'Microsoft authentication'};
const CODES=new Set(['SUCCESS','PENDING','MS_PUBLIC_CLIENT_REQUIRED','MS_INVALID_CLIENT','MS_REDIRECT_MISMATCH','MS_SCOPE_REJECTED','MS_CODE_EXPIRED','MS_REAUTH_REQUIRED','CANCELLED','XBOX_PROFILE_REQUIRED','XBOX_TERMS_REQUIRED','XBOX_REGION_RESTRICTED','XBOX_FAMILY_REQUIRED','XBOX_AGE_VERIFICATION','XBOX_PLAYTIME_RESTRICTED','XBOX_ACCOUNT_RESTRICTED','MINECRAFT_APP_REJECTED','PROFILE_MISSING','PROVIDER_REJECTED','SERVICE_UNAVAILABLE','NETWORK_ERROR','INVALID_RESPONSE','INVALID_CALLBACK','UNEXPECTED_AUTH_ERROR']);
const HELP={
 PENDING:'Complete sign-in in your browser, then return here for the result.',
 MS_PUBLIC_CLIENT_REQUIRED:'Configure the redirect as Mobile and desktop applications and enable Allow public client flows in Microsoft Entra.',
 MS_INVALID_CLIENT:'Check the Application (client) ID and support for personal Microsoft accounts.',
 MS_REDIRECT_MISMATCH:'The registered callback must match the Local redirect URL in Settings.',
 MS_SCOPE_REJECTED:'Check the app registration and its permission to use Xbox/Minecraft authentication.',
 MS_CODE_EXPIRED:'Start a fresh sign-in. Do not refresh an old callback page.',
 MS_REAUTH_REQUIRED:'Sign in with Microsoft again to renew this session.',
 XBOX_PROFILE_REQUIRED:'Sign in at xbox.com and finish creating an Xbox profile, then retry.',
 XBOX_TERMS_REQUIRED:'Complete the account setup and terms at xbox.com, then retry.',
 XBOX_FAMILY_REQUIRED:'The Microsoft family organizer needs to review this account’s Xbox setup.',
 XBOX_ACCOUNT_RESTRICTED:'Review this account’s Xbox status and family permissions.',
 MINECRAFT_APP_REJECTED:'The app owner needs to check Minecraft API access/approval for the client ID.',
 PROFILE_MISSING:'Check this account has Java Edition access and has created its Java profile at minecraft.net.',
 NETWORK_ERROR:'Check connectivity and retry sign-in.',SERVICE_UNAVAILABLE:'Wait and try signing in again.',
 CANCELLED:'Sign in again and complete the account and consent screens.'
};
function normalize(value,now=new Date()){
 if(!value||typeof value!=='object')return null;
 const code=CODES.has(value.code)?value.code:'UNEXPECTED_AUTH_ERROR';
 const stage=code==='SUCCESS'?'complete':Object.hasOwn(STAGES,value.stage)?value.stage:'callback';
 const parsed=typeof value.at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.at)?new Date(value.at):now;
 const result={schema:1,at:Number.isFinite(parsed.getTime())?parsed.toISOString():now.toISOString(),stage,code,success:code==='SUCCESS'};
 if(Number.isInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599)result.httpStatus=value.httpStatus;
 if(Number.isInteger(value.providerCode)&&value.providerCode>=0&&value.providerCode<=9999999999)result.providerCode=value.providerCode;
 return result;
}
function present(value){const diagnostic=normalize(value);if(!diagnostic)return null;
 const details=[diagnostic.code,...(diagnostic.httpStatus?['HTTP '+diagnostic.httpStatus]:[]),...(diagnostic.providerCode!==undefined?[(diagnostic.stage==='callback'||diagnostic.stage==='microsoft'?'AADSTS':'XErr ')+diagnostic.providerCode]:[])];
 return {...diagnostic,summary:diagnostic.code==='SUCCESS'?'Microsoft authentication completed.':diagnostic.code==='PENDING'?'Waiting for Microsoft sign-in in your browser…':STAGES[diagnostic.stage]+' · '+details.join(' · '),help:HELP[diagnostic.code]||(diagnostic.success?'Your Minecraft account is available in Launcher account.':'Retry sign-in. Copy these diagnostics if you need help; they contain no account credentials.')};
}
module.exports={normalize,present,STAGES,CODES};
