'use strict';
(() => {
  const status=document.getElementById('release-status');
  const isoButton=document.getElementById('get-iso');
  const vboxButton=document.getElementById('get-vbox');
  const dialog=document.getElementById('download-dialog');
  const copyStatus=document.getElementById('copy-status');
  async function copy(text,button){
    try{await navigator.clipboard.writeText(text);const before=button.textContent;button.textContent='Copied';copyStatus.textContent='Command copied.';setTimeout(()=>{button.textContent=before;},1800);}
    catch(_){copyStatus.textContent='Select the command text and copy it manually.';}
  }
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',()=>copy(button.dataset.copy,button)));
  function safeURL(value){const url=new URL(value,document.baseURI);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid download URL');return url.href;}
  function formatSize(size){return (size/1024**3).toFixed(2)+' GiB';}
  async function loadRelease(){
    const response=await fetch('downloads/boralancesos-v1.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('Release manifest unavailable');
    const release=await response.json();
    const iso=release.artifacts?.find(artifact=>artifact.id==='iso');
    const kit=release.artifacts?.find(artifact=>artifact.id==='virtualbox');
    if(kit?.ready&&kit.url){vboxButton.href=safeURL(kit.url);vboxButton.setAttribute('download','');vboxButton.removeAttribute('aria-disabled');vboxButton.textContent='Download VirtualBox kit ↓';}
    if(!iso?.ready||!Array.isArray(iso.parts)||!iso.parts.length){status.textContent='V1 is being prepared. Downloads are not published yet.';return;}
    document.getElementById('iso-size').textContent=formatSize(iso.bytes)+' · '+iso.parts.length+' verified parts';
    document.getElementById('full-checksum').textContent='ISO SHA-256: '+iso.sha256;
    const list=document.getElementById('part-list');list.replaceChildren();
    for(const part of iso.parts){const li=document.createElement('li');const a=document.createElement('a');a.href=safeURL(part.url);a.textContent=part.name+' · '+(part.bytes/1e6).toFixed(1)+' MB';a.rel='noopener noreferrer';li.append(a);list.append(li);}
    const manifestURL=new URL('downloads/boralancesos-v1.json',document.baseURI).href;
    const command='.\\Get-BoralancesOS.ps1 -ManifestUri "'+manifestURL+'" -Artifact iso';
    document.getElementById('download-command').textContent=command;
    document.getElementById('copy-download-command').addEventListener('click',event=>copy(command,event.currentTarget));
    isoButton.disabled=false;isoButton.textContent=release.published?'Download V1 ISO ↓':'View prepared ISO files';isoButton.addEventListener('click',()=>dialog.showModal());
    status.textContent=release.published?'V1 downloads are available.':'V1 files are built. Publication is pending.';
    document.getElementById('release-note').textContent=release.published?'Each part is verified by the download helper. After assembly, verify the ISO checksum before writing it to USB. See the included release notes for tested scope.':'The local release files are prepared, but the remote download assets have not been published. Publish the release assets before sharing these download URLs.';
  }
  loadRelease().catch(()=>{status.textContent='Download information is unavailable. No release files are assumed to exist.';});
})();
