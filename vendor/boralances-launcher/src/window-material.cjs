function supportsAcrylic(platform,release){const parts=String(release).split('.').map(Number);return platform==='win32'&&parts[0]>=10&&parts[2]>=22621;}
module.exports={supportsAcrylic};
