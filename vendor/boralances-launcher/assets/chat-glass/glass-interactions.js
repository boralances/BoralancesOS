(function (global) {
  'use strict';
  // Native inputs keep their focus, form values, validation and event listeners.
  function mount(options) {
    const host = options.host || document.documentElement;
    const api = options.library || global.LiquidGlass;
    const materials = new Map();
    const resizedFrames = new Set();
    const reduced = matchMedia('(prefers-reduced-transparency: reduce)');
    const supported = /Chrome\/|Chromium\/|Electron\/|Edg\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url(#test)');
    let timer, held = null, disposed = false, suppressClick = null;
    const active = () => !!options.active() && !document.hidden;
    const optical = () => active() && !reduced.matches && options.optical?.() !== false;
    const interactive = () => (active() || options.flat) && !document.hidden;
    function rangeValue(input) {
      const value = Number(input.value);
      return input.dataset.glassUnit === 'ram' ? (value / 1024).toLocaleString(undefined, {maximumFractionDigits: 2}) + ' GB · ' + value + ' MB' : input.value + (input.dataset.glassUnit || '');
    }
    function sync(input) {
      if (options.decorate === false) return;
      if (input.type === 'checkbox') {
        const frame = input.closest('.glass-switch-frame');
        if (frame && !frame.classList.contains('glass-control-dragging')) {
          frame.style.setProperty('--glass-switch-progress', input.checked ? 1 : 0);
          const travel = frame.clientWidth - frame.querySelector('.glass-switch-thumb').offsetWidth;
          const rtl = getComputedStyle(input).direction === 'rtl';
          frame.style.setProperty('--glass-switch-x', ((input.checked !== rtl) ? travel : 0) + 'px');
        }
        return;
      }
      if (input.type !== 'range') return;
      const frame = input.closest('.glass-range-frame');
      if (!frame) return;
      const min = Number(input.min || 0), max = Number(input.max || 100);
      const ratio = Math.max(0, Math.min(1, max > min ? (Number(input.value) - min) / (max - min) : 0));
      const rtl = getComputedStyle(input).direction === 'rtl';
      const position = rtl ? 1 - ratio : ratio;
      frame.style.setProperty('--glass-range-progress', (ratio * 100) + '%');
      frame.style.setProperty('--glass-range-direction', rtl ? '270deg' : '90deg');
      const thumb = frame.querySelector('.glass-range-thumb');
      thumb.style.left = (position * Math.max(0, frame.clientWidth - thumb.offsetWidth)) + 'px';
      frame.style.setProperty('--glass-thumb-center', (position * Math.max(0, frame.clientWidth - thumb.offsetWidth) + thumb.offsetWidth / 2) + 'px');
      const valueLabel = frame.querySelector('.glass-range-value');
      const text = rangeValue(input);
      if (valueLabel && valueLabel.textContent !== text) valueLabel.textContent = text;
      input.setAttribute('aria-valuetext', text);
      if (input.dataset.glassUnit === 'ram') {
        const output = document.getElementById('setting-memory-value');
        if (output) output.textContent = rangeValue(input);
        input.setAttribute('aria-valuetext', rangeValue(input));
      }
      if (held?.input === input) positionLens();
    }
    function wrap(input) {
      if (input.closest('.glass-switch-frame,.glass-range-frame')) return;
      const frame = document.createElement('span');
      const range = input.type === 'range';
      frame.className = range ? 'glass-range-frame' : 'glass-switch-frame';
      input.before(frame); frame.append(input);
      const track = document.createElement('span');
      track.className = range ? 'glass-range-track glass-component' : 'glass-switch-track glass-component';
      track.setAttribute('aria-hidden', 'true');
      const thumb = document.createElement('span');
      thumb.className = range ? 'glass-range-thumb glass-component' : 'glass-switch-thumb glass-component';
      thumb.setAttribute('aria-hidden', 'true');
      const solid = document.createElement('span');
      solid.className = 'glass-thumb-solid'; thumb.append(solid);
      if (range) {
        const valueLabel = document.createElement('span');
        valueLabel.className = 'glass-range-value'; valueLabel.setAttribute('aria-hidden', 'true');
        frame.append(track, thumb, valueLabel);
      } else { input.setAttribute('role', 'switch'); frame.append(track, thumb); }
      resizeObserver?.observe(frame);
      resizedFrames.add(frame);
    }
    function end() {
      const previous = held; held = null;
      if (previous?.pointerId !== undefined && previous.input.hasPointerCapture?.(previous.pointerId)) previous.input.releasePointerCapture(previous.pointerId);
      if (previous) { previous.thumb.classList.remove('glass-thumb-held'); previous.input.closest('.glass-switch-frame,.glass-range-frame')?.classList.remove('glass-control-held','glass-control-dragging'); previous.glass?.update({zoom: 1, blur: .2}); sync(previous.input); }
    }
    function positionLens() {
      if (!held || !held.input.isConnected || held.input.disabled || !interactive()) { end(); return; }
      // The thumb is the lens: its existing layout follows native slider/switch movement.
      held.glass?.update({zoom: optical() ? 2.5 : 1, blur: held.input.type === 'range' ? 1 : .2});
    }
    function begin(input, pointerId) {
      if (!interactive() || input.disabled) return;
      end(); refresh();
      const thumb = input.closest('.glass-switch-frame,.glass-range-frame')?.querySelector('.glass-switch-thumb,.glass-range-thumb');
      if (!thumb) return;
      held = {input, pointerId, thumb, glass: materials.get(thumb) || options.material?.(thumb)};
      thumb.classList.add('glass-thumb-held'); positionLens();
      input.closest('.glass-switch-frame,.glass-range-frame').classList.add('glass-control-held');
      if (pointerId !== undefined && input.type !== 'range') { try { input.setPointerCapture(pointerId); } catch (_) {} }
    }
    function refresh() {
      if (disposed) return;
      const on = active();
      if (options.decorate === false) { if (held) { positionLens(); } return; }
      if (on || options.flat) host.dataset.boralancesGlassControls = on ? 'active' : 'flat'; else delete host.dataset.boralancesGlassControls;
      if (on || options.flat) for (const input of document.querySelectorAll('input[type=checkbox],input[type=range]')) wrap(input);
      for (const frame of resizedFrames) if (!frame.isConnected) { resizeObserver?.unobserve(frame); resizedFrames.delete(frame); }
      for (const input of document.querySelectorAll('.glass-range-frame input,.glass-switch-frame input')) sync(input);
      const nodes = [...document.querySelectorAll('.glass-switch-track,.glass-switch-thumb,.glass-range-track,.glass-range-thumb,input[type=search]')];
      for (const [element, glass] of materials) if (!element.isConnected || !on || reduced.matches) { glass.destroy(); materials.delete(element); }
      if (on && supported && !reduced.matches) for (const element of nodes) {
        const box = element.getBoundingClientRect();
        if (box.width < 1 || box.height < 1 || box.bottom < 0 || box.top > innerHeight || getComputedStyle(element).visibility === 'hidden') continue;
        if (!materials.has(element) && materials.size < 48) {
          const lip = element.classList.contains('glass-switch-thumb'), thumb = /thumb/.test(element.className);
          // Lab presets: the switch THUMB has a convex lip / concave interior;
          // slider pills combine a squircle bevel with an elliptical center lens.
          materials.set(element, new api.Glass(element, {profile: lip ? 'lip' : thumb ? 'magnify' : 'convex', centerZoom: thumb, zoomShape: 'ellipse', lipDepth: 1, zoom: 1, radius: thumb ? 24 : 12, bezel: lip ? 24 : thumb ? 12 : 10, thickness: lip ? 30 : thumb ? 40 : 7, blur: .2, maxPixels: 16000}));
        }
      }
      for (const glass of materials.values()) glass.enable(optical());
      if (held) { positionLens(); }
      options.refreshed?.();
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 100); }
    function inputTarget(event) { const input = event.target; return input?.matches?.('.glass-switch-frame input,.glass-range-frame input') ? input : null; }
    function pointerDown(event) {
      const input = inputTarget(event); if (!input || event.button !== 0) return;
      suppressClick = null; begin(input, event.pointerId);
      if (held && input.type === 'checkbox') {
        const frame = input.closest('.glass-switch-frame');
        Object.assign(held, {startX:event.clientX, initial:input.checked, progress:input.checked ? 1 : 0, travel:Math.max(1,frame.clientWidth-held.thumb.offsetWidth), rtl:getComputedStyle(input).direction==='rtl'});
      }
    }
    function pointerMove(event) {
      if (!held || held.pointerId !== event.pointerId || held.input.type !== 'checkbox' || held.startX === undefined) return;
      if (held.input.disabled || !interactive()) { end(); return; }
      const dx = event.clientX - held.startX;
      if (Math.abs(dx) > 3) held.moved = true;
      if (!held.moved) return;
      held.progress = Math.max(0,Math.min(1,(held.initial ? 1 : 0) + dx / held.travel * (held.rtl ? -1 : 1)));
      const frame = held.input.closest('.glass-switch-frame'); frame.classList.add('glass-control-dragging');
      frame.style.setProperty('--glass-switch-progress',held.progress);
      frame.style.setProperty('--glass-switch-x',((held.rtl ? 1-held.progress : held.progress)*held.travel)+'px');
    }
    function pointerEnd(event) {
      if (event.type === 'lostpointercapture' && event.buttons) return;
      if (held?.pointerId !== event.pointerId) return;
      const previous = held;
      if (previous.moved && event.type === 'pointerup' && !previous.input.disabled && interactive()) {
        const input = previous.input, next = previous.progress > .5;
        // Suppress only the synthetic click after this drag. Native clicks and
        // Space keep their built-in activation and emit exactly one change.
        suppressClick = input;
        input.checked = next;
        end();
        if (next !== previous.initial) { input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); }
      } else end();
    }
    function click(event) { if (event.detail > 0 && event.target === suppressClick) { suppressClick = null; event.preventDefault(); event.stopImmediatePropagation(); } }
    function keyDown(event) { const input = inputTarget(event); if (input && !event.repeat && (input.type === 'checkbox' ? event.key === ' ' : ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))) begin(input); }
    function keyUp(event) { if (held?.input === event.target && held.pointerId === undefined) end(); }
    function inputChanged(event) { const input = inputTarget(event); if (input) { sync(input); if (held?.input === input) { positionLens(); if (options.decorate === false) requestAnimationFrame(positionLens); } } }
    function lostFocus(event) { if (held?.input === event.target) end(); }
    function scroll() { if (held) positionLens(); schedule(); }
    function windowBlur(event) { if (event.target === window) end(); }
    function changed() { if (!active() || reduced.matches || options.optical?.() === false) end(); schedule(); }
    const listeners = [[document,'pointerdown',pointerDown],[document,'pointermove',pointerMove],[document,'pointerup',pointerEnd],[document,'pointercancel',pointerEnd],[document,'lostpointercapture',pointerEnd],[document,'click',click],[document,'keydown',keyDown],[document,'keyup',keyUp],[document,'input',inputChanged],[document,'change',inputChanged],[document,'focusout',lostFocus],[document,'visibilitychange',changed],[document,'scroll',scroll],[window,'resize',scroll],[window,'blur',windowBlur]];
    for (const [target,type,handler] of listeners) target.addEventListener(type,handler,true);
    reduced.addEventListener('change',changed);
    const observer = new MutationObserver(records => {
      if (records.some(r => r.type === 'attributes' && r.target === host && !active())) end();
      if (records.some(r => !r.target.closest?.('.glass-filter-definitions') && !(r.type === 'childList' && [...r.addedNodes,...r.removedNodes].every(n => n.nodeType !== 1 || n.matches?.('.glass-filter-definitions'))))) schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','open','data-theme','data-glass-effects','data-glass-enhanced','class','min','max','step','value','dir']});
    if (host !== document.body) observer.observe(host,{attributes:true,attributeFilter:['data-theme','data-glass-effects','data-glass-enhanced','class']});
      const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => { for (const {target} of entries) { const input = target.querySelector('input'); if (input) sync(input); } }) : null;
    refresh();
    return {refresh, end, destroy() { disposed = true; clearTimeout(timer); end(); observer.disconnect(); resizeObserver?.disconnect(); resizedFrames.clear(); reduced.removeEventListener('change',changed); for (const [target,type,handler] of listeners) target.removeEventListener(type,handler,true); for (const glass of materials.values()) glass.destroy(); materials.clear(); delete host.dataset.boralancesGlassControls; }};
  }
  global.BoralancesGlassControls = {mount};
})(typeof window === 'undefined' ? globalThis : window);
