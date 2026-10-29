const path=require('node:path');
function dataDirectory({packaged,base,portable,appData}){
 return process.platform==='linux'?path.join(appData,'BoralancesLauncher','data'):packaged&&!portable?path.join(appData,'BoralancesLauncher','data'):path.join(base,'data');
}
function ownerCandidates(base,desktop){
 return [...require('./owner.cjs').nearbyOwnerDirectories(base),path.join(desktop,'BoralancesLauncher','data'),path.join(desktop,'BoralancesLauncher','release','data')];
}
module.exports={dataDirectory,ownerCandidates};
