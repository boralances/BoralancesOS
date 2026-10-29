'use strict';
// Cross-provider imports use public Modrinth releases, never guessed CurseForge URLs.
const {assert,json,compatibleMR,safeRelative}=require('./core.cjs');
const sha1=file=>file?.hashes?.sha1||file?.hashes?.find?.(h=>h.algo===1)?.value;
async function fromHash(hash){if(!/^[a-f0-9]{40}$/i.test(hash||''))return null;try{return await json('https://api.modrinth.com/v2/version_file/'+hash.toLowerCase()+'?algorithm=sha1');}catch(e){if(e.status===404)return null;throw e;}}
function clientCompatible(value){const environments=Array.isArray(value.environment)?value.environment:typeof value.environment==='string'?[value.environment]:[];return value.client_side!=='unsupported'&&!(environments.length&&environments.every(v=>['server_only','dedicated_server_only'].includes(v)));}
async function hashBatch(nodes){const hashes=[...new Set(nodes.map(sha1).filter(h=>/^[a-f0-9]{40}$/i.test(h||'')).map(h=>h.toLowerCase()))],versions=new Map();for(let i=0;i<hashes.length;i+=100){const result=await json('https://api.modrinth.com/v2/version_files',{'Content-Type':'application/json'},{method:'POST',body:JSON.stringify({hashes:hashes.slice(i,i+100),algorithm:'sha1'})});for(const [hash,version]of Object.entries(result))if(version.files?.some(f=>sha1(f)?.toLowerCase()===hash.toLowerCase()))versions.set(hash.toLowerCase(),version);}return versions;}
function repository(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!['github.com','gitlab.com','codeberg.org'].includes(u.hostname))return '';let parts=u.pathname.replace(/\.git\/?$/,'').split('/').filter(Boolean);if(u.hostname==='github.com'||u.hostname==='codeberg.org')parts=parts.slice(0,2);else{const i=parts.indexOf('-');if(i>=0)parts=parts.slice(0,i);}return parts.length>=2?u.hostname+'/'+parts.join('/').toLowerCase():'';}catch{return '';}}
function backlink(body,project){const slug=project.slug||String(project.links?.websiteUrl||'').split('/').filter(Boolean).at(-1);if(!slug)return false;for(const raw of String(body||'').match(/https:\/\/[^\s<>"')\]]+/g)||[])try{const u=new URL(raw);if(['www.curseforge.com','curseforge.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')==='/minecraft/'+({6:'mc-mods',12:'texture-packs',6552:'shaders'}[project.classId])+'/'+slug)return true;}catch{}return false;}
function sameName(cf,mr){const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\b(minecraft|fabric|forge|neoforge|quilt)\b/g,'').replace(/[^a-z0-9]/g,'');const names=[cf.name,cf.slug].map(normalize).filter(Boolean);return [mr.title,mr.slug].map(normalize).some(n=>names.includes(n));}
async function projectFor(id,type,candidate=false){let project;try{project=await json('https://api.modrinth.com/v2/project/'+encodeURIComponent(id));}catch(error){if(candidate&&error.status===404)return null;throw error;}if(candidate&&(!project.id||project.project_type!==type||!clientCompatible(project)))return null;assert(project.id&&project.project_type===type,'The Modrinth project is in a different content category.');assert(clientCompatible(project),'The Modrinth project cannot run on clients.');return project;}
function valid(version,instance,type){return compatibleMR(version,instance,type)&&clientCompatible(version);}
async function resolve(catalog,project,original,instance,type){
 assert(original&&instance.minecraft&&instance.loader,'The restricted file has no usable compatibility metadata.');
 const hash=sha1(original),exact=await fromHash(hash);let chosen,identity,match;
 if(exact&&exact.files.some(f=>sha1(f)?.toLowerCase()===hash.toLowerCase())){identity=await projectFor(exact.project_id,type);if(valid(exact,instance,type)){chosen=exact;match='exact-file';}}
 if(!chosen){
  const candidates=new Map();if(!identity)for(const query of [...new Set([project.slug,project.name].filter(Boolean))]){const results=await catalog.search({provider:'modrinth',type,query,instance});for(const hit of results.hits.slice(0,24))candidates.set(hit.id,hit);}
  const verified=identity?[identity]:[],source=repository(project.links?.sourceUrl);
  for(const hit of candidates.values()){const p=await projectFor(hit.id,type,true);if(p&&sameName(project,p)&&(source&&repository(p.source_url)===source||backlink(p.body,project)))verified.push(p);}
  assert(verified.length,'No verified Modrinth alternative is available for '+instance.minecraft+' / '+instance.loader+'.');
  assert(verified.length===1,'Several Modrinth projects match; the replacement could not be identified safely.');identity=verified[0];
  const versions=(await catalog.versions('modrinth',identity.id,instance,type)).filter(v=>valid(v.raw,instance,type));
  assert(versions.length,'The verified Modrinth project has no client release for '+instance.minecraft+' / '+instance.loader+'.');
  const originalNames=new Set([original.fileName,original.displayName].filter(Boolean).map(s=>s.toLowerCase()));
  const same=versions.find(v=>originalNames.has(v.raw.name?.toLowerCase())||v.raw.files.some(f=>originalNames.has(f.filename.toLowerCase())));
  chosen=(same||versions.find(v=>v.channel==='release')||versions[0]).raw;match=same?'matching-release':'compatible-release';
 }
 const plan=await catalog.plan('modrinth',identity.id,chosen.id,instance,type),key='modrinth:'+identity.id;
 // A hash lookup can match a secondary file; use precisely those bytes when found.
 if(match==='exact-file'){const file=chosen.files.find(f=>sha1(f)?.toLowerCase()===hash.toLowerCase()),node=plan.get(key);assert(file&&node,'Missing exact replacement file.');const folder={mod:'mods',shader:'shaderpacks',resourcepack:'resourcepacks'}[type];assert(file.filename&&!/[\\/]/.test(file.filename),'Invalid Modrinth filename.');node.name=file.filename;node.path=folder+'/'+file.filename;node.url=file.url;node.hashes=file.hashes;}
 return {key,plan,report:{name:project.name,projectId:identity.id,projectName:identity.title,versionId:chosen.id,version:chosen.version_number,originalFile:original.fileName||original.displayName||'',file:plan.get(key).name,match,url:'https://modrinth.com/'+type+'/'+identity.slug}};
}
async function merge(queue,catalog){
 const direct=queue.filter(n=>n.provider==='curseforge'),mr=new Map(),aliases=new Map();
 for(const node of queue.filter(n=>n.provider==='modrinth')){const old=mr.get(node.key);if(old){assert(old.versionId===node.versionId,'Conflicting Modrinth releases are required by this pack.');if(node.root){old.root=true;old.origin=node.origin;}}else mr.set(node.key,{...node});}
 // Keep the pack's pinned CurseForge dependency when its exact bytes identify the
 // same Modrinth project. Rewrite dependency edges instead of installing duplicates.
 const dependencyKeys=new Set([...mr.values()].flatMap(n=>[...(n.requires||[]),...(n.incompatible||[]).map(c=>c.key)]));
 const identified=dependencyKeys.size?await hashBatch(direct):new Map();
 for(const node of direct){const version=identified.get(sha1(node)?.toLowerCase());if(version&&mr.has('modrinth:'+version.project_id)){const key='modrinth:'+version.project_id;assert(!aliases.has(key),'Duplicate project in the CurseForge manifest.');aliases.set(key,{key:node.key,versionId:node.versionId,modrinthVersion:version.id});}}
 const result=[...direct,...[...mr.values()].filter(node=>!aliases.has(node.key))],keys=new Map(result.map(n=>[n.key,n]));assert(keys.size===result.length,'The pack contains multiple files from the same project.');
 for(const node of result){safeRelative(node.rel);assert(node.rel.toLowerCase().endsWith(node.type==='mod'?'.jar':'.zip'),'Invalid replacement filename.');node.requires=(node.requires||[]).map(key=>aliases.get(key)?.key||key);node.requiredVersions=(node.requiredVersions||[]).map(pin=>{const alias=aliases.get(pin.key);if(!alias)return pin;assert(alias.modrinthVersion===pin.versionId,'A pinned Modrinth dependency conflicts with the pack’s CurseForge file.');return {key:alias.key,versionId:alias.versionId};});node.incompatible=(node.incompatible||[]).map(conflict=>{const alias=aliases.get(conflict.key);if(!alias)return conflict;return {key:alias.key,versionId:conflict.versionId?(conflict.versionId===alias.modrinthVersion?alias.versionId:'unmatched-modrinth-version'):null};});
  for(const key of node.requires)assert(keys.has(key),'A Modrinth dependency is missing from the import.');for(const pin of node.requiredVersions)assert(keys.get(pin.key)?.versionId===pin.versionId,'A pinned dependency conflicts with another pack file.');for(const c of node.incompatible)assert(!keys.has(c.key)||c.versionId&&keys.get(c.key).versionId!==c.versionId,'A replacement conflicts with another mod in this pack.');
 }
 assert(new Set(result.map(n=>n.rel)).size===result.length,'Two pack projects use the same destination filename.');return result;
}
module.exports={resolve,merge,fromHash,repository};
