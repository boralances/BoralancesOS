'use strict';
const root = document.body;
const toggle = document.getElementById('appearance');
const saved = localStorage.getItem('boralances-home-theme');
root.classList.toggle('light', saved === 'light' || (!saved && matchMedia('(prefers-color-scheme: light)').matches));
toggle.addEventListener('click', () => {
  root.classList.toggle('light');
  localStorage.setItem('boralances-home-theme', root.classList.contains('light') ? 'light' : 'dark');
});
let material;
function rebuild() {
  const element = document.getElementById('searchGlass');
  const host = document.getElementById('boralances-reference-defs');
  if (host) host.replaceChildren();
  material = window.ReferenceGlass.create(element, {w:element.offsetWidth,h:element.offsetHeight,r:24,B:18,prof:'squircle',T:28,blur:1,spec:.45,sat:1.5,refr:.55});
  if (matchMedia('(prefers-reduced-transparency: reduce)').matches) material.frost(true);
}
let timer;
window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
rebuild();
