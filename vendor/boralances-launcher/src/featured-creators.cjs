'use strict';
const {curated}=require('./curated.cjs');
let cached=null,cacheKey='',updated=0;
function group(projects){
 const creators=new Map();
 for(const project of projects.filter(p=>p.available))for(const author of project.creators||[]){
  const key=author.id;if(!creators.has(key))creators.set(key,{...author,provider:project.provider,projects:[]});
  const record=creators.get(key);if(!record.projects.some(p=>p.id===project.id&&p.provider===project.provider))record.projects.push({id:project.id,name:project.name,type:project.type,provider:project.provider,url:project.url});
 }
 return [...creators.values()].sort((a,b)=>b.projects.length-a.projects.length||a.name.localeCompare(b.name));
}
async function creators(catalog){
 if(cached&&cacheKey===catalog.key&&Date.now()-updated<120000)return cached;
 const projects=(await Promise.all(['packs','mods','shaders'].map(c=>curated(catalog,c)))).flat();
 cached={creators:group(projects),unavailable:projects.filter(p=>!p.available).length};cacheKey=catalog.key;updated=Date.now();return cached;
}
module.exports={creators,group};
