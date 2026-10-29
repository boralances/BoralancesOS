'use strict';
const DEFAULT={clarity:1,light:.65,quality:'balanced',pointer:true,motion:true};
function normalize(value={}){const n=(key,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value[key]))?Number(value[key]):DEFAULT[key]));return {clarity:n('clarity',.3,1.6),light:n('light',.1,1.2),quality:['low','balanced','high'].includes(value.quality)?value.quality:'balanced',pointer:value.pointer!==false,motion:value.motion!==false};}
module.exports={DEFAULT,normalize};
