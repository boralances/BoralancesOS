const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const AdmZip = require('adm-zip');

const UA = 'BoralancesLauncher/1.7.8 (desktop Minecraft launcher)';
const HOSTS = new Set(['cdn.modrinth.com','github.com','raw.githubusercontent.com','objects.githubusercontent.com','release-assets.githubusercontent.com','gitlab.com','edge.forgecdn.net','mediafilez.forgecdn.net','media.forgecdn.net','www.forgecdn.net']);
const LOADERS = new Set(['vanilla','fabric','quilt','forge','neoforge']);
const TYPES = new Set(['mod','modpack','shader','resourcepack','datapack']);
const CF_LOADERS = {forge:1,fabric:4,quilt:5,neoforge:6};
const CF_SLUGS = {mod:['mc-mods'],modpack:['modpacks'],resourcepack:['texture-packs','resource-packs'],shader:['shaders'],datapack:['data-packs','datapacks']};

function offlineProfile(name) {
  assert(typeof name==='string' && /^[A-Za-z0-9_]{3,16}$/.test(name),'Offline names must have 3–16 letters, numbers or underscores.');
  const bytes=crypto.createHash('md5').update('OfflinePlayer:'+name,'utf8').digest();
  bytes[6]=(bytes[6]&15)|48;bytes[8]=(bytes[8]&63)|128;
  return {name,id:bytes.toString('hex'),access_token:'0',offline:true};
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function safeRelative(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length < 500, 'Invalid file path.');
  const normalized = value.replace(/\\/g,'/');
  assert(!normalized.startsWith('/') && !normalized.includes(':') && !normalized.includes('\0'), 'Unsafe file path.');
  const pieces = normalized.split('/');
  assert(pieces.every(p => p && p !== '.' && p !== '..' && !/[<>:"|?*\x00-\x1f]/.test(p) && !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p)), 'Unsafe file path.');
  return pieces.join('/');
}
async function contained(root, relative) {
  const rel = safeRelative(relative), dest = path.resolve(root, rel);
  const rootReal = await fs.realpath(root);
  let parent = dest;
  while (true) {
    try {
      const real = await fs.realpath(parent);
      const check = path.relative(rootReal, real);
      assert(check === '' || (!check.startsWith('..') && !path.isAbsolute(check)), 'A symbolic link escapes the instance.');
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      const next = path.dirname(parent);
      assert(next !== parent, 'Unsafe destination.');
      parent = next;
    }
  }
  return dest;
}
function checkURL(value) {
  const u = new URL(value);
  assert(u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && HOSTS.has(u.hostname), 'This download host is not supported: ' + u.hostname);
  return u;
}
async function download(url, dest, hashes = {}, onProgress = ()=>{}) {
  let u = checkURL(url), response;
  for (let count=0; count<6; count++) {
    response = await fetch(u, {headers:{'User-Agent':UA},redirect:'manual',signal:AbortSignal.timeout(120000)});
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      u = checkURL(new URL(response.headers.get('location'),u).href);
      response = null;
      continue;
    }
    break;
  }
  assert(response?.ok, 'Download failed. Retry later.');
  const limit = 512 * 1024 * 1024;
  const total = Number(response.headers.get('content-length')) || 0;
  assert(total <= limit, 'This download exceeds the 512 MB per-file limit.');
  await fs.mkdir(path.dirname(dest), {recursive:true});
  const temporary = dest + '.part-' + crypto.randomUUID();
  const handle = await fs.open(temporary,'wx');
  let count=0, last=0;
  const hashers = Object.entries(hashes).filter(([a])=>['sha1','sha512','md5'].includes(a)).map(([a,v])=>[crypto.createHash(a),v]);
  try {
    for await (const chunk of response.body) {
      count += chunk.length;
      assert(count <= limit, 'Download size limit exceeded.');
      await handle.write(chunk);
      for (const [h] of hashers) h.update(chunk);
      if (Date.now()-last>200) { onProgress({status:'Downloading ' + path.basename(dest),current:count,total}); last=Date.now(); }
    }
    assert(!total || count === total, 'The download is incomplete.');
    for (const [h,expected] of hashers) assert(h.digest('hex').toLowerCase() === expected.toLowerCase(), 'Download checksum mismatch.');
    await handle.close();
    await fs.rename(temporary,dest);
  } catch(e) {
    await handle.close().catch(()=>{});
    await fs.rm(temporary,{force:true});
    throw e;
  }
}
async function json(url, headers={}, options={}) {
  const {fetch:request=global.fetch,...requestOptions}=options;
  for(let attempt=0;attempt<3;attempt++){
    let r;
    try{r=await request(url,{...requestOptions,headers:{'User-Agent':UA,...headers},signal:AbortSignal.timeout(30000)});}
    catch{if(attempt===2)throw new Error('Catalog network request failed. Check connectivity and retry.');}
    if(r?.ok)return r.json();
    if(r&&![429,500,502,503,504].includes(r.status)){const error=new Error(r.status===403?'Access denied. Check your API key and provider permissions.':'Catalog request failed (HTTP '+r.status+').');error.status=r.status;throw error;}
    if(attempt===2)throw new Error('Catalog temporarily unavailable. Retry later.');
    await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
}
async function readJSON(file,fallback) { try {return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;} }
async function atomicJSON(file,value) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.tmp';
  await fs.writeFile(temp,JSON.stringify(value,null,2));
  await fs.rename(temp,file);
}
function compatibleMR(v,instance,type) {
  return v.game_versions.includes(instance.minecraft) && (type !== 'mod' || v.loaders.includes(instance.loader)) && (type !== 'datapack' || v.loaders.includes('datapack'));
}
class Catalog {
  constructor(key='',progress=()=>{},options={}) {this.key=key;this.progress=progress;this.json=(url,headers={},init={})=>json(url,headers,{...init,...(options.fetch?{fetch:options.fetch}:{})});}
  cf(route,query={}) {
    assert(this.key,'Add a CurseForge API key in Settings.');
    return this.json('https://api.curseforge.com/v1/'+route+'?'+new URLSearchParams(query),{'x-api-key':this.key});
  }
  async cfClass(type) {
    const {data}=await this.cf('categories',{gameId:432,classesOnly:true});
    const c=data.find(x=>CF_SLUGS[type].includes(x.slug));
    assert(c,'This content category is not available from CurseForge.');
    return c.id;
  }
  async search({provider,type,query='',instance,offset=0}) {
    assert(TYPES.has(type),'Unknown content type.');
    if(provider==='modrinth'){
      // Datapacks now have their own project type. Older multi-type projects
      // remain discoverable through all_project_types, without the stale category.
      const facets=[[(type==='datapack'?'all_project_types:':'project_type:')+type]];
      if(instance && type!=='modpack'){
        facets.push(['versions:'+instance.minecraft]);
        if(type==='mod'&&instance.loader!=='vanilla')facets.push(['categories:'+instance.loader]);
      }
      const result=await this.json('https://api.modrinth.com/v2/search?'+new URLSearchParams({query,facets:JSON.stringify(facets),limit:24,offset,index:query.trim()?'relevance':'downloads'}));
      return {total:result.total_hits,hits:result.hits.map(x=>({id:x.project_id,name:x.title,description:x.description,icon:x.icon_url,cover:x.featured_gallery||x.gallery?.[0]||null,downloads:x.downloads,author:x.author,url:'https://modrinth.com/'+x.project_type+'/'+x.slug}))};
    }
    assert(provider==='curseforge','Unknown catalog.');
    const params={gameId:432,classId:await this.cfClass(type),searchFilter:query,pageSize:24,index:offset,sortField:6,sortOrder:'desc'};
    if(instance && type!=='modpack'){
      params.gameVersion=instance.minecraft;
      if(type==='mod' && CF_LOADERS[instance.loader])params.modLoaderType=CF_LOADERS[instance.loader];
    }
    const result=await this.cf('mods/search',params);
    return {total:result.pagination.totalCount,hits:result.data.map(x=>({id:String(x.id),name:x.name,description:x.summary,icon:x.logo?.thumbnailUrl,cover:x.screenshots?.[0]?.thumbnailUrl||null,downloads:x.downloadCount,author:x.authors.map(a=>a.name).join(', '),url:x.links.websiteUrl}))};
  }
  async versions(provider,id,instance,type) {
    if(provider==='modrinth'){
      const query = type==='modpack'||!instance?{}:{game_versions:JSON.stringify([instance.minecraft])};
      if(type==='mod'&&instance&&instance.loader!=='vanilla')query.loaders=JSON.stringify([instance.loader]);
      if(type==='datapack')query.loaders=JSON.stringify(['datapack']);
      const versions=await this.json('https://api.modrinth.com/v2/project/'+encodeURIComponent(id)+'/version?'+new URLSearchParams(query));
      return versions.filter(v=>type==='modpack'||!instance||compatibleMR(v,instance,type)).map(v=>({id:v.id,name:v.name,number:v.version_number,channel:v.version_type,date:v.date_published,projectId:v.project_id,raw:v}));
    }
    const params={pageSize:50};
    if(type!=='modpack'){
      if(instance)params.gameVersion=instance.minecraft;
      if(type==='mod' && CF_LOADERS[instance?.loader])params.modLoaderType=CF_LOADERS[instance.loader];
    }
    // Read every page so old compatible builds are not silently hidden.
    const files=[];
    for(let index=0;index<10000;index+=50){
      const r=await this.cf('mods/'+id+'/files',{...params,index});
      files.push(...r.data);
      if(index+50>=r.pagination.totalCount)break;
    }
    return files.filter(v=>type==='modpack'||!instance||(v.gameVersions.includes(instance.minecraft) && (type!=='mod'||v.gameVersions.some(a=>a.toLowerCase()===instance.loader)))).sort((a,b)=>b.id-a.id).map(v=>({id:String(v.id),name:v.displayName,number:v.fileName,channel:['','release','beta','alpha'][v.releaseType],date:v.fileDate,raw:v}));
  }
  async file(provider,projectId,versionId) {
    if(provider==='modrinth'){
      const v=await this.json('https://api.modrinth.com/v2/version/'+encodeURIComponent(versionId));
      assert(!projectId || v.project_id===projectId,'Version belongs to another project.');
      const f=v.files.find(x=>x.primary)||v.files[0];
      assert(f,'No downloadable file found.');
      return {name:f.filename,url:f.url,hashes:f.hashes,version:v,projectId:v.project_id,versionId:v.id};
    }
    const {data:v}=await this.cf('mods/'+projectId+'/files/'+versionId);
    // Restricted files may be resolved only through a separate authorized provider.
    if(!v.downloadUrl){const error=new Error('The author disabled this third-party download. Download it on CurseForge and use Import file.');error.code='CF_THIRD_PARTY_DISABLED';error.version=v;throw error;}
    return {name:v.fileName,url:v.downloadUrl,hashes:Object.fromEntries(v.hashes.filter(h=>[1,2].includes(h.algo)).map(h=>[h.algo===1?'sha1':'md5',h.value])),version:v,projectId:String(projectId),versionId:String(v.id)};
  }
  modrinthFallback(project,version,instance,type){return require('./pack-fallback.cjs').resolve(this,project,version,instance,type);}
  async plan(provider,projectId,versionId,instance,type,seen=new Map(),visiting=new Set()) {
    const key=provider+':'+projectId;
    if(seen.has(key)){
      assert(seen.get(key).versionId===String(versionId),'Conflicting versions of a required dependency.');
      return seen;
    }
    assert(!visiting.has(key),'Circular dependency detected.');
    visiting.add(key);
    const f=await this.file(provider,projectId,versionId);
    if(provider==='modrinth')assert(compatibleMR(f.version,instance,type),'The selected file is incompatible with this instance.');
    else {
      assert(f.version.gameVersions.includes(instance.minecraft),'The selected file targets another Minecraft version.');
      if(type==='mod')assert(f.version.gameVersions.some(x=>x.toLowerCase()===instance.loader),'The selected mod targets another loader.');
    }
    const requires=[],requiredVersions=[],incompatible=[];
    assert(visiting.size<128 && seen.size<1024,'Dependency graph is too large.');
    if(type==='mod'){
      for(const d of f.version.dependencies || []){
        if(provider==='modrinth' && d.dependency_type==='required'){
          let depId=d.project_id,depVersion=d.version_id;
          if(depVersion && !depId)depId=(await this.file(provider,null,depVersion)).projectId;
          assert(depId,'This mod has an unresolved external dependency. Install it manually first.');
          if(!depVersion)depVersion=seen.get(provider+':'+depId)?.versionId||(await this.versions(provider,depId,instance,'mod'))[0]?.id;
          assert(depVersion,'No compatible required dependency is available.');
          await this.plan(provider,depId,depVersion,instance,'mod',seen,visiting);
          requires.push(provider+':'+depId);
          if(d.version_id)requiredVersions.push({key:provider+':'+depId,versionId:String(depVersion)});
        }else if(provider==='modrinth' && d.dependency_type==='incompatible'){
          let depId=d.project_id;
          if(!depId&&d.version_id)depId=(await this.file(provider,null,d.version_id)).projectId;
          if(depId)incompatible.push({key:provider+':'+depId,versionId:d.version_id||null});
        }else if(provider==='curseforge' && d.relationType===3){
          const depId=String(d.modId),depVersion=(await this.versions(provider,depId,instance,'mod'))[0]?.id;
          assert(depVersion,'No compatible required dependency is available.');
          await this.plan(provider,depId,depVersion,instance,'mod',seen,visiting);
          requires.push(provider+':'+depId);
        }
      }
    }
    const filename=safeRelative(f.name);
    assert(!filename.includes('/'),'Invalid catalog filename.');
    const folder={mod:'mods',shader:'shaderpacks',resourcepack:'resourcepacks',datapack:'datapacks'}[type];
    assert(folder,'Use the pack importer to install modpacks.');
    assert(type!=='mod'||filename.toLowerCase().endsWith('.jar'),'This mod is not a JAR.');
    assert(type==='mod'||filename.toLowerCase().endsWith('.zip'),'This pack is not a ZIP.');
    seen.set(key,{...f,key,type,requires,requiredVersions,incompatible,path:folder+'/'+filename});
    visiting.delete(key);
    return seen;
  }
}
async function installContent(catalog,selection,instance,directory,world='') {
  const {provider,projectId,versionId,type}=selection;
  assert(type!=='mod'||instance.loader!=='vanilla','Create a modded instance to install mods.');
  const plan=[...(await catalog.plan(provider,projectId,versionId,instance,type)).values()];
  return commitPlan(catalog,plan,directory,type,world);
}
async function installBatch(catalog,selections,instance,directory){
  const seen=new Map();
  for(const selection of selections){
    assert(selection.provider==='modrinth'&&selection.type==='mod','Client presets contain Modrinth mods only.');
    await catalog.plan(selection.provider,selection.projectId,selection.versionId,instance,'mod',seen);
  }
  return commitPlan(catalog,[...seen.values()],directory,'mod','');
}
async function commitPlan(catalog,plan,directory,type,world){
  const records=await readJSON(path.join(directory,'content.json'),[]);
  if(type==='datapack'){
    safeRelative(world);
    assert(!world.includes('/') && !world.includes('\\'),'Select a single world.');
    const target=await contained(directory,'saves/'+world);
    assert((await fs.stat(target)).isDirectory() && (await fs.stat(path.join(target,'level.dat'))).isFile(),'Select an existing Minecraft world.');
    for(const f of plan)f.path='saves/'+world+'/'+f.path;
  }
  assert(new Set(plan.map(f=>f.path)).size===plan.length,'Two selected projects use the same filename.');
  const proposed=records.filter(r=>!plan.some(f=>f.key===r.key)).concat(plan);
  for(const item of proposed.filter(r=>!r.disabled)){
    for(const dep of item.requiredVersions||[]){
      const actual=proposed.find(r=>r.key===dep.key&&!r.disabled);
      assert(actual&&actual.versionId===dep.versionId,'Updating this dependency would break an installed mod.');
    }
    for(const conflict of item.incompatible||[]){
      assert(!proposed.some(r=>!r.disabled&&r.key===conflict.key&&(!conflict.versionId||r.versionId===conflict.versionId)),'An installed mod conflicts with this selection.');
    }
  }
  const stage=await contained(directory,'.staging/'+crypto.randomUUID());
  await fs.mkdir(stage,{recursive:true});
  const backups=[],placed=[];
  const next=[...records];
  try {
    for(const f of plan){
      const dest=await contained(directory,f.path);
      const old=records.find(r=>r.key===f.key && (type!=='datapack'||r.world===world));
      const existing=records.find(r=>r.path===f.path && r.key!==f.key);
      assert(!existing,'Another installed project uses this filename.');
      if(!old || old.path!==f.path || old.disabled){
        const exists=await fs.stat(dest).then(()=>true).catch(e=>{if(e.code==='ENOENT')return false;throw e;});
        assert(!exists,'A local file already exists with this name. Rename it before installing.');
      }
      await download(f.url,path.join(stage,'downloads',f.path),f.hashes,catalog.progress);
    }
    for(const f of plan){
      const oldIndex=next.findIndex(r=>r.key===f.key && (type!=='datapack'||r.world===world));
      const old=next[oldIndex];
      if(old){
        const oldPath=await contained(directory,old.path+(old.disabled?'.disabled':''));
        const backup=path.join(stage,'backups',crypto.randomUUID());
        if(await fs.stat(oldPath).then(()=>true).catch(()=>false)){await fs.mkdir(path.dirname(backup),{recursive:true});await fs.rename(oldPath,backup);backups.push([backup,oldPath]);}
      }
      const dest=await contained(directory,f.path);
      await fs.mkdir(path.dirname(dest),{recursive:true});
      await fs.rename(path.join(stage,'downloads',f.path),dest);
      placed.push(dest);
      const record={key:f.key,provider:f.key.split(':')[0],projectId:f.projectId,versionId:f.versionId,name:f.name,type:f.type,path:f.path,requires:f.requires,requiredVersions:f.requiredVersions||[],incompatible:f.incompatible||[],disabled:false,...(type==='datapack'?{world}:{})};
      if(oldIndex<0)next.push(record);else next[oldIndex]=record;
    }
    await atomicJSON(path.join(directory,'content.json'),next);
    return next;
  } catch(e){
    for(const file of placed.reverse())await fs.rm(file,{force:true});
    for(const [backup,dest] of backups.reverse())await fs.rename(backup,dest);
    throw e;
  } finally{await fs.rm(stage,{recursive:true,force:true});}
}
function inspectPack(file) {
  const zip=new AdmZip(file);
  let expanded=0;
  for(const e of zip.getEntries()){
    safeRelative(e.entryName.replace(/\/$/,''));
    assert(((e.header.attr>>>16)&0o170000)!==0o120000,'Pack contains a symbolic link.');
    expanded+=e.header.size;
    assert(expanded<=2*1024*1024*1024 && e.header.size<=512*1024*1024,'Pack exceeds extraction limits.');
  }
  const mr=zip.getEntry('modrinth.index.json'),cf=zip.getEntry('manifest.json');
  assert(mr||cf,'Not a Modrinth or CurseForge modpack.');
  const metadata=JSON.parse(zip.readAsText(mr||cf));
  let minecraft,loader='vanilla',loaderVersion='';
  if(mr){
    assert(metadata.formatVersion===1 && metadata.game==='minecraft','Unsupported Modrinth pack format.');
    const deps=metadata.dependencies;
    minecraft=deps.minecraft;
    const keys={'fabric-loader':'fabric','quilt-loader':'quilt',forge:'forge',neoforge:'neoforge'};
    assert(Object.keys(deps).every(k=>k==='minecraft'||keys[k]),'Pack requires an unsupported loader.');
    assert(Object.keys(deps).filter(k=>keys[k]).length<=1,'Pack specifies multiple loaders.');
    for(const [key,value] of Object.entries(deps))if(keys[key]){loader=keys[key];loaderVersion=value;}
  }else{
    assert(metadata.manifestType==='minecraftModpack' && metadata.manifestVersion===1,'Unsupported CurseForge pack format.');
    minecraft=metadata.minecraft.version;
    const loaders=metadata.minecraft.modLoaders||[];
    assert(loaders.length<=1,'Pack specifies multiple loaders.');
    const l=loaders.find(x=>x.primary)||loaders[0];
    if(l){
      const match=/^(forge|neoforge|fabric|quilt)-(.+)$/.exec(l.id);
      assert(match,'Unsupported pack loader.');
      [,loader,loaderVersion]=match;
    }
  }
  assert(typeof minecraft==='string' && minecraft.length<60,'Pack has no Minecraft version.');
  assert(!safeRelative(minecraft).includes('/'),'Invalid pack Minecraft version.');
  if(loader!=='vanilla')assert(typeof loaderVersion==='string'&&!safeRelative(loaderVersion).includes('/'),'Invalid pack loader build.');
  return {zip,metadata,provider:mr?'modrinth':'curseforge',minecraft,loader,loaderVersion,name:String(metadata.name||'Imported pack').slice(0,80)};
}
async function extractOverrides(pack,directory){
  const prefixes=pack.provider==='modrinth'?['overrides/','client-overrides/']:[safeRelative(pack.metadata.overrides||'overrides')+'/'];
  for(const prefix of prefixes){
    for(const entry of pack.zip.getEntries()){
      if(entry.isDirectory || !entry.entryName.startsWith(prefix))continue;
      const relative=safeRelative(entry.entryName.slice(prefix.length));
      assert(!['instance.json','content.json'].includes(relative.split('/')[0]) && !relative.startsWith('.'),'Pack cannot overwrite launcher metadata.');
      const dest=await contained(directory,relative);
      await fs.mkdir(path.dirname(dest),{recursive:true});
      await fs.writeFile(dest,entry.getData());
    }
  }
}
async function unpack(catalog,pack,directory,includeOptional=false){
  const records=[];
  if(pack.provider==='modrinth'){
    for(const f of pack.metadata.files){
      if(f.env?.client==='unsupported' || (f.env?.client==='optional'&&!includeOptional))continue;
      const rel=safeRelative(f.path);
      assert(!rel.startsWith('.') && !['instance.json','content.json'].includes(rel.split('/')[0]),'Pack cannot overwrite launcher metadata.');
      assert(f.hashes?.sha1 && f.hashes?.sha512,'Pack file is missing checksums.');
      const dest=await contained(directory,rel);
      let success=false,issue;
      for(const url of f.downloads||[]){
        try{await download(url,dest,f.hashes,catalog.progress);success=true;break;}catch(e){issue=e;}
      }
      assert(success,issue?.message||'Pack file has no download URLs.');
      records.push({key:'pack:'+rel,name:path.basename(rel),path:rel,type:rel.startsWith('mods/')?'mod':'packfile',requires:[],disabled:false});
    }
  }else{
    const queue=[],projects=new Map(),destinations=new Set(),replacements=[],issues=[];
    for(const f of pack.metadata.files){
      if(f.required===false&&!includeOptional)continue;
      const id=String(f.projectID);
      if(!projects.has(id)){const {data:p}=await catalog.cf('mods/'+id);assert(p.gameId===432,'Pack references another game.');projects.set(id,p);}
      const project=projects.get(id),type={6:'mod',12:'resourcepack',6552:'shader'}[project.classId];
      assert(type,'Pack file '+project.name+' uses an unsupported category. Import world/datapack files into an existing world manually.');
      let file;try{file=await catalog.file('curseforge',id,String(f.fileID));if(project.allowModDistribution===false){const error=new Error('The author disabled this third-party download.');error.code='CF_THIRD_PARTY_DISABLED';error.version=file.version;throw error;}}catch(e){
        if(e.code==='CF_THIRD_PARTY_DISABLED'&&typeof catalog.modrinthFallback==='function'){
          try{catalog.progress?.({status:'Searching Modrinth for '+project.name});const replacement=await catalog.modrinthFallback(project,e.version,{minecraft:pack.minecraft,loader:pack.loader},type);for(const node of replacement.plan.values())queue.push({...node,rel:node.path,provider:'modrinth',root:node.key===replacement.key,origin:node.key===replacement.key?{provider:'curseforge',projectId:id,versionId:String(f.fileID),name:project.name}:null});replacements.push({...replacement.report,originalProjectId:id,originalFileId:String(f.fileID)});continue;}
          catch(missing){issues.push(project.name+': '+missing.message);continue;}
        }
        throw new Error(project.name+': '+e.message);
      }
      const name=safeRelative(file.name);assert(!name.includes('/'),'Invalid pack filename.');
      assert(name.toLowerCase().endsWith(type==='mod'?'.jar':'.zip'),'Invalid pack file type.');
      const rel={mod:'mods/',resourcepack:'resourcepacks/',shader:'shaderpacks/'}[type]+name;
      assert(!destinations.has(rel),'Duplicate file in modpack.');destinations.add(rel);queue.push({...file,key:'curseforge:'+id,provider:'curseforge',projectId:id,versionId:String(f.fileID),rel,type,requires:[],requiredVersions:[],incompatible:[],root:true});
    }
    assert(!issues.length,'Import unavailable. No mod files were installed.\n'+issues.join('\n'));
    let resolved;try{resolved=await require('./pack-fallback.cjs').merge(queue,catalog);}catch(error){throw new Error('Import unavailable. No mod files were installed.\n'+error.message);}
    for(const file of resolved){
      await download(file.url,await contained(directory,file.rel),file.hashes,catalog.progress);
      records.push({key:file.key,provider:file.provider,projectId:file.projectId,versionId:file.versionId,name:file.name,path:file.rel,type:file.type,requires:file.requires||[],requiredVersions:file.requiredVersions||[],incompatible:file.incompatible||[],disabled:false,...(file.origin?{replaced:file.origin}:{})});
    }
    pack.importReport={replacements};
  }
  await extractOverrides(pack,directory);
  await atomicJSON(path.join(directory,'content.json'),records);
  return pack.importReport||{replacements:[]};
}
module.exports={offlineProfile,assert,safeRelative,contained,download,json,readJSON,atomicJSON,LOADERS,TYPES,Catalog,compatibleMR,installContent,installBatch,inspectPack,unpack};
