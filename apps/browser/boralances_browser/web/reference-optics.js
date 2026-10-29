(function(){'use strict';if(window.ReferenceGlass)return;const N=1.5,light=-60,chromium=true,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const $=function(id){let host=document.getElementById('boralances-reference-defs');if(!host){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.style.pointerEvents='none';host=document.createElementNS(svg.namespaceURI,'defs');host.id='boralances-reference-defs';svg.appendChild(host);document.documentElement.appendChild(svg);}return host;};const chainCode=()=>'';
  const convex = t => Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
  const squircle = t => Math.pow(Math.max(0, 1 - Math.pow(1 - t, 4)), 0.25);
  const concave = t => 1 - squircle(t);
  const lip = t => { const s = t * t * t * (t * (t * 6 - 15) + 10); return squircle(t) * (1 - s) + concave(t) * s; };
  const profiles = { convex, squircle, concave, lip };
  const names = { convex: 'Convex circle', squircle: 'Convex squircle', concave: 'Concave', lip: 'Lip' };
  const slopeOf = (f, t) => { const d = 0.002, a = Math.max(0, t - d), b = Math.min(1, t + d); return (f(b) - f(a)) / (b - a); };

  /* refracted ray direction for a ray falling straight down on a surface of slope s */
  function refractDir(s){
    const nl = Math.hypot(s, 1), nx = -s / nl, ny = -1 / nl, cos1 = 1 / nl, eta = 1 / N;
    const k = Math.sqrt(1 - eta * eta * (1 - cos1 * cos1));
    const c = eta * cos1 - k;
    return { x: c * nx, y: eta + c * ny };
  }

  /* shift table along one radius */
  function table(f, B, T){
    const out = []; let mx = 0;
    for (let i = 0; i < 128; i++){
      const t = i / 127, s = slopeOf(f, t) * T / B;
      const a1 = Math.atan(Math.abs(s)), a2 = Math.asin(Math.sin(a1) / N);
      const m = (s < 0 ? -1 : 1) * f(t) * T * Math.tan(a1 - a2);
      out.push(m); if (Math.abs(m) > mx) mx = Math.abs(m);
    }
    return { out, mx: mx || 1 };
  }

  /* displacement map, highlight map, mask for a rounded rectangle */
  function buildMap(w, h, r, B, prof, T, ang){
    r = Math.min(r, h / 2, w / 2); B = Math.min(B, Math.min(w, h) / 2);
    const tb = table(profiles[prof], B, T);
    const disp = new ImageData(w, h), spec = new ImageData(w, h), mask = new Float32Array(w * h);
    const hw = w / 2, hh = h / 2, rim = Math.max(2.5, B * 0.16);
    const a = (ang == null ? light : ang) * Math.PI / 180, lx = Math.cos(a), ly = Math.sin(a);
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        const px = x + 0.5 - hw, py = y + 0.5 - hh;
        const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.hypot(ox, oy);
        const dist = -(len + Math.min(Math.max(qx, qy), 0) - r);
        let nx, ny;
        if (len > 0){ nx = ox / len * (px < 0 ? -1 : 1); ny = oy / len * (py < 0 ? -1 : 1); }
        else if (qx > qy){ nx = px < 0 ? -1 : 1; ny = 0; }
        else { nx = 0; ny = py < 0 ? -1 : 1; }
        const i = y * w + x, k = i * 4;
        mask[i] = clamp(dist + 0.5, 0, 1);
        let R = 128, G = 128;
        if (dist >= 0 && dist < B){
          const m = tb.out[Math.min(127, Math.round(dist / B * 127))] / tb.mx;
          R = 128 - nx * m * 127; G = 128 - ny * m * 127;
        }
        disp.data[k] = R; disp.data[k + 1] = G; disp.data[k + 2] = 128; disp.data[k + 3] = 255;
        let s = 0;
        if (dist >= 0 && dist < rim) s = (1 - dist / rim) * Math.pow(Math.abs(nx * lx + ny * ly), 0.9);
        spec.data[k] = 255; spec.data[k + 1] = 255; spec.data[k + 2] = 255; spec.data[k + 3] = Math.round(clamp(s * mask[i], 0, 1) * 235);
      }
    }
    return { w, h, disp, spec, mask, mx: tb.mx, table: tb };
  }
  /* zoom map: every pixel looks toward the centre, for magnification */
  function buildZoom(w, h, frac){
    const img = new ImageData(w, h), hw = w / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const k = (y * w + x) * 4, px = (x + 0.5 - w / 2) / hw, py = (y + 0.5 - h / 2) / hw;
      img.data[k] = 128 - px * 127; img.data[k + 1] = 128 - py * 127; img.data[k + 2] = 128; img.data[k + 3] = 255;
    }
    return { img, px: frac * hw };
  }
  const toURL = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); return c.toDataURL('image/png'); };

  const SVGNS = 'http://www.w3.org/2000/svg';
  const mkn = (t, a, kids, k) => ({ t, a, kids, k });
  function chainNodes(c){
    const w = c.w, h = c.h, img = (key, res) => mkn('feImage', { href: c.href[key], x: 0, y: 0, width: w, height: h, result: res });
    const n = [mkn('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(c.blur), result: 'soft' }, null, 'blur')];
    let src = 'soft';
    if (c.hasZoom){
      n.push(img('zmap', 'zoom-map'));
      n.push(mkn('feDisplacementMap', { in: 'soft', in2: 'zoom-map', scale: c.zscale.toFixed(1), xChannelSelector: 'R', yChannelSelector: 'G', result: 'zoomed' }, null, 'zoom'));
      src = 'zoomed';
    }
    n.push(img('map', 'map'));
    if (c.hasChroma){
      /* chromatic dispersion: bend red a little more and blue a little less than green, then add the three lanes back together */
      const lane = (k, f, row, key) => {
        n.push(mkn('feDisplacementMap', { in: src, in2: 'map', scale: (c.scale * f).toFixed(1), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + k }, null, key));
        n.push(mkn('feColorMatrix', { in: 'd' + k, type: 'matrix', values: row, result: 'c' + k }));
      };
      lane('R', 1 + c.chroma, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'dispR');
      lane('G', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'disp');
      lane('B', 1 - c.chroma, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'dispB');
      n.push(mkn('feBlend', { in: 'cR', in2: 'cG', mode: 'screen', result: 'cRG' }));
      n.push(mkn('feBlend', { in: 'cRG', in2: 'cB', mode: 'screen', result: 'bent' }));
    } else {
      n.push(mkn('feDisplacementMap', { in: src, in2: 'map', scale: c.scale.toFixed(1), xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }, null, 'disp'));
    }
    n.push(mkn('feColorMatrix', { in: 'bent', type: 'saturate', values: '1.3', result: 'base' }));
    n.push(mkn('feComponentTransfer', { in: 'base', result: 'lit0' }, ['feFuncR', 'feFuncG', 'feFuncB'].map(f => mkn(f, { type: 'linear', slope: '1.08', intercept: '0.03' }))));
    n.push(mkn('feColorMatrix', { in: 'lit0', type: 'saturate', values: String(c.sat), result: 'vivid' }, null, 'sat'));
    n.push(img('shine', 'shine'));
    n.push(mkn('feComposite', { in: 'vivid', in2: 'shine', operator: 'in', result: 'rim' }));
    n.push(mkn('feBlend', { in: 'rim', in2: 'lit0', mode: 'normal', result: 'lit' }));
    n.push(mkn('feComponentTransfer', { in: 'shine', result: 'glow' }, [mkn('feFuncA', { type: 'linear', slope: (c.spec * 1.6).toFixed(2) }, null, 'glow')]));
    n.push(mkn('feBlend', { in: 'glow', in2: 'lit', mode: 'screen' }));
    return n;
  }
  function toDOM(n, refs){
    const e = document.createElementNS(SVGNS, n.t);
    for (const k in n.a) e.setAttribute(k, n.a[k]);
    (n.kids || []).forEach(kid => e.appendChild(toDOM(kid, refs)));
    if (n.k) refs[n.k] = e;
    return e;
  }
  let gid = 0;
  function glassify(el, o){
    const w = o.w, h = o.h, r = o.r == null ? h / 2 : o.r;
    el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.borderRadius = r + 'px';
    if (!el.dataset.gid) el.dataset.gid = ++gid;
    const id = 'gl-' + el.dataset.gid, old = document.getElementById(id); if (old) old.remove();
    const cur = Object.assign({ blur: 0.6, spec: 0.5, sat: 3, refr: 1, zoomr: 1 }, o);
    const Bc = Math.min(o.B, Math.min(w, h) / 2);
    const mx = table(profiles[o.prof], Bc, o.T).mx, zpx = (o.zoom || 0) * w / 2;
    const info = () => ({ w, h, blur: cur.blur, sat: cur.sat, spec: cur.spec, scale: mx * 2 * cur.refr, zscale: zpx * 2 * cur.zoomr, hasZoom: !!o.zoom, hasChroma: !!o.chroma, chroma: cur.chroma || 0 });
    if (!chromium){
      el.classList.add('fallback');
      const ap = () => { el.style.backdropFilter = el.style.webkitBackdropFilter = 'blur(' + (3 + cur.blur * 5).toFixed(1) + 'px) saturate(1.6)'; };
      ap();
      return { set(p){ Object.assign(cur, p); ap(); }, frost(){}, code: () => chainCode(info(), r), mx };
    }
    const m = buildMap(w, h, r, o.B, o.prof, o.T);
    const href = { map: toURL(m.disp), shine: toURL(m.spec) };
    if (o.zoom) href.zmap = toURL(buildZoom(w, h, o.zoom).img);
    const f = document.createElementNS(SVGNS, 'filter'), refs = {};
    f.setAttribute('id', id); f.setAttribute('color-interpolation-filters', 'sRGB');
    chainNodes(Object.assign(info(), { href })).forEach(n => f.appendChild(toDOM(n, refs)));
    $('#filter-host').appendChild(f);
    const ap = () => {
      const c = info();
      refs.blur.setAttribute('stdDeviation', String(cur.blur));
      refs.disp.setAttribute('scale', c.scale.toFixed(2));
      if (refs.dispR){ refs.dispR.setAttribute('scale', (c.scale * (1 + c.chroma)).toFixed(2)); refs.dispB.setAttribute('scale', (c.scale * (1 - c.chroma)).toFixed(2)); }
      if (refs.zoom) refs.zoom.setAttribute('scale', c.zscale.toFixed(2));
      refs.sat.setAttribute('values', String(cur.sat));
      refs.glow.setAttribute('slope', (cur.spec * 1.6).toFixed(2));
    };
    ap();
    const real = 'url(#' + id + ')';
    el.style.backdropFilter = el.style.webkitBackdropFilter = real;
    return {
      set(p){ Object.assign(cur, p); ap(); },
      frost(on){ el.classList.toggle('fallback', on); el.style.backdropFilter = el.style.webkitBackdropFilter = on ? 'blur(14px) saturate(1.5)' : real; },
      code: () => chainCode(info(), r), mx, map: m
    };
  }


window.ReferenceGlass={create:glassify,table:table,profiles:profiles,source:'Bora / Liqui(1).html',version:1};})();
