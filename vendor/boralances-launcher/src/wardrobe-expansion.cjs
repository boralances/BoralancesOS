'use strict';
const THEMES=[
 ['aether','Aether','#bfefff','#384a7a'],['blossom','Blossom','#ffc4d8','#714066'],
 ['citadel','Citadel','#ffe6a1','#565e74'],['dusk','Dusk','#d3b8ff','#343356'],
 ['evergreen','Evergreen','#c4ee9b','#305b4e'],['flare','Flare','#ffd194','#923d51'],
 ['gale','Gale','#d7f5ef','#436985'],['harbor','Harbor','#95efd9','#215768'],
 ['ion','Ion','#c9fa85','#364765'],['jewel','Jewel','#eebcfc','#5c387a']
];
const MOTIFS=[['compass','Compass'],['lotus','Lotus'],['sentinel','Sentinel'],['orbit','Orbit']];
const SHAPES=[['feather','Feather'],['dragon','Dragon'],['moth','Moth'],['crystal','Crystal']];
const EXPANSION=[];
for(const [theme,title,color,base] of THEMES){
 for(const [motif,label] of MOTIFS)EXPANSION.push({id:theme+'-'+motif+'-cape',name:title+' '+label,pattern:motif,color,base,type:'Cape',collection:'Studio 100',description:'Original '+label.toLowerCase()+' emblem, embroidered in '+title.toLowerCase()+' colors.'});
 for(const [shape,label] of SHAPES)EXPANSION.push({id:theme+'-'+shape+'-wings',name:title+' '+label+' Wings',shape,color,base,type:'Animated Wings',wingMode:1,animateWings:true,collection:'Studio 100',description:label+' shaped cosmetic wings with Ears animation. Visible without wearing elytra; uses your local player skin.'});
}
const EMOTES=[
 ['hello-wave','Hello Wave','A friendly overhead wave.',false],['victory-cheer','Victory Cheer','Raise both arms and celebrate.',false],
 ['formal-bow','Formal Bow','A courteous bow.',false],['captain-salute','Captain Salute','A crisp salute.',false],
 ['happy-clap','Happy Clap','A quick round of applause.',false],['side-step','Side Step','A looping side-to-side dance.',true],
 ['groove','Groove','A relaxed shoulder groove.',true],['star-pose','Star Pose','Strike a star-shaped pose.',false],
 ['thinking','Thinking','Pause with a hand beside your chin.',false],['shrug','Shrug','An expressive shoulder shrug.',false],
 ['arm-stretch','Arm Stretch','Stretch both arms above your head.',false],['warm-up','Warm Up','A gentle alternating warm-up.',true],
 ['air-guitar','Air Guitar','Play an imaginary guitar.',true],['robot','Robot','A mechanical arm-and-body dance.',true],
 ['shuffle','Shuffle','A quick alternating shuffle.',true],['heart-hands','Heart Hands','Bring your hands together at your chest.',false],
 ['look-around','Look Around','Scan the horizon.',false],['toe-tap','Toe Tap','Tap along to an imaginary beat.',true],
 ['deep-breath','Deep Breath','A slow breathing pose.',true],['finale','Grand Finale','Finish with a bow and a wave.',false]
].map(([id,name,description,loop],index)=>({id:'emote-'+id,name,description,type:'Emote',loop,index,collection:'Studio 100',color:THEMES[index%10][2],base:THEMES[index%10][3]}));
EXPANSION.push(...EMOTES);
for(const p of EXPANSION)Object.assign(p,{price:0,currency:'FREE',asset:'../../assets/cosmetics/'+p.id+'.png'});
module.exports={EXPANSION,EMOTES,THEMES};
