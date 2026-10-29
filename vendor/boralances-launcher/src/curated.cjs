const {assert,json}=require('./core.cjs');
const COLLECTIONS={
  packs:[
    {name:'BoralancesCraft',id:'1324682',type:'modpack'},
    {name:'BoralancesCraft2',id:'1588692',type:'modpack'},
    {name:'BoralancesAddoned',id:'1434970',type:'modpack'},
    {name:'HarderBoralancesCraft2',id:'1596395',type:'modpack'},
    {name:'BoralancesVr',id:'1423129',type:'modpack'},
    {name:'BoralancesOceanSurvival',id:'1726208',type:'modpack'}
  ],
  mods:[
    {name:'BoralancesContent',id:'1389696',type:'mod'},
    {name:'BoralancesStar',id:'1600964',type:'mod'},
    {name:'Pastbound',id:'1668226',type:'mod'},
    {name:'BoralancesOceanSurvival',id:'1726179',type:'mod',note:'CurseForge project: BoralancesOceanSurvivalCore. The full pack is under Sponsored modpacks.'}
  ],
  shaders:[{name:'BoralancesShaders',id:'quyQHxX7',type:'shader',provider:'modrinth'}]
};
async function curated(catalog,collection){
  assert(Object.hasOwn(COLLECTIONS,collection),'Unknown featured collection.');
  return Promise.all(COLLECTIONS[collection].map(async entry=>{
    const provider=entry.provider||'curseforge';
    try{
      if(provider==='curseforge'){
        const {data:p}=await catalog.cf('mods/'+entry.id);
        assert(p.gameId===432&&p.classId===(entry.type==='modpack'?4471:6),'Featured project category changed.');
        return {...entry,provider,available:true,sourceName:p.name,description:p.summary,icon:p.logo?.thumbnailUrl,downloads:p.downloadCount,author:p.authors.map(a=>a.name).join(', '),creators:p.authors.map(a=>({id:'curseforge-'+a.id,name:a.name,url:a.url||p.links.websiteUrl})),url:p.links.websiteUrl,versions:[...new Set(p.latestFiles.flatMap(f=>f.gameVersions||[]))].slice(0,8)};
      }
      const p=await json('https://api.modrinth.com/v2/project/'+entry.id);
      assert(p.project_type==='shader','Featured project category changed.');
      const members=await json('https://api.modrinth.com/v2/team/'+p.team+'/members').catch(()=>[]);
      const creators=members.filter(m=>m.user?.username).map(m=>({id:'modrinth-'+m.user.id,name:m.user.username,url:'https://modrinth.com/user/'+encodeURIComponent(m.user.username)}));
      return {...entry,provider,available:true,sourceName:p.title,description:p.description,icon:p.icon_url,downloads:p.downloads,author:creators.map(a=>a.name).join(', ')||'Modrinth creator',creators,url:'https://modrinth.com/shader/'+p.slug,versions:p.game_versions.slice(-8)};
    }catch(e){return {...entry,provider,available:false,description:e.message};}
  }));
}
module.exports={COLLECTIONS,curated};
