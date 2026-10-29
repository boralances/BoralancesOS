'use strict';
const body=document.body;
const toast=document.querySelector('.toast');
let toastTimer;
function announce(message){toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},4500);}
function theme(mode){body.classList.toggle('light',mode==='light');document.getElementById('scheme').value=mode;}
document.getElementById('theme').addEventListener('click',()=>theme(body.classList.contains('light')?'dark':'light'));
document.getElementById('scheme').addEventListener('change',event=>theme(event.target.value));
document.getElementById('settings').addEventListener('click',()=>document.getElementById('settings-dialog').showModal());
document.getElementById('done').addEventListener('click',()=>document.getElementById('settings-dialog').close());
document.getElementById('reduce').addEventListener('change',event=>body.classList.toggle('reduce',event.target.checked));
for(const button of document.querySelectorAll('[data-app]'))button.addEventListener('click',()=>announce(`${button.dataset.app} is included in the OS configuration. This page previews the design and does not start applications.`));
for(const button of document.querySelectorAll('[data-workspace]'))button.addEventListener('click',()=>{
  const selected=button.dataset.workspace;
  for(const control of document.querySelectorAll('header [data-workspace]')){const active=control.dataset.workspace===selected;control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));}
  document.getElementById('workspace-name').textContent=`0${selected} / ${['Workspace','Play','Focus'][Number(selected)-1]}`;
  document.querySelector('.workspace-sheet').hidden=true;
});
document.getElementById('overview').addEventListener('click',()=>{document.querySelector('.workspace-sheet').hidden=false;});
document.getElementById('close-overview').addEventListener('click',()=>{document.querySelector('.workspace-sheet').hidden=true;});
for(const button of document.querySelectorAll('aside button'))button.addEventListener('click',()=>{
  for(const item of document.querySelectorAll('aside button'))item.classList.toggle('selected',item===button);
  for(const app of document.querySelectorAll('.app'))app.hidden=!!button.dataset.filter&&app.dataset.category!==button.dataset.filter;
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.workspace-sheet').hidden=true;});
function clock(){document.getElementById('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}clock();setInterval(clock,60000);
