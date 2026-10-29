'use strict';
(function(global){
 const tracks=new WeakMap();
 function compiled(e){let cache=tracks.get(e);if(cache?.moves===e.moves)return cache.parts;const parts={};for(const part of ['head','torso','rightArm','leftArm','rightLeg','leftLeg']){parts[part]={};for(const axis of ['x','y','z','pitch','yaw','roll','bend'])parts[part][axis]=e.moves.filter(f=>typeof f[part]?.[axis]==='number');}tracks.set(e,{moves:e.moves,parts});return parts;}
 function sample(animation,seconds){
  const e=animation?.emote;if(!e)return {};let tick=Math.max(0,seconds*20);
  if(e.isLoop&&tick>e.endTick)tick=e.returnTick+(tick-e.returnTick)%(e.endTick-e.returnTick);
  else tick=Math.min(e.endTick,tick);
  const parts={},framesByPart=compiled(e);
  for(const part of ['head','torso','rightArm','leftArm','rightLeg','leftLeg']){
   const pose={};for(const axis of ['x','y','z','pitch','yaw','roll','bend']){
    const frames=framesByPart[part][axis];if(!frames.length)continue;
    let prev=frames[0],next=frames.at(-1);for(const f of frames){if(f.tick<=tick)prev=f;if(f.tick>=tick){next=f;break;}}
    let t=next.tick===prev.tick?0:Math.max(0,Math.min(1,(tick-prev.tick)/(next.tick-prev.tick)));const easing=String(prev.easing||'linear').toLowerCase();if(easing==='constant')t=0;else if(easing.includes('sine'))t=(1-Math.cos(t*Math.PI))/2;
    pose[axis]=prev[part][axis]+(next[part][axis]-prev[part][axis])*t;
   }parts[part]=pose;
  }return parts;
 }
 global.BoralancesAnimations={sample};if(typeof module!=='undefined')module.exports={sample};
})(globalThis);
