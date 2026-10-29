(function(global){
  'use strict';
  const DEFAULTS={bezel:28,thickness:16,index:1.5,strength:1,radius:18,maxPixels:180000,profile:'convex',zoom:2,lipDepth:.72,zoomShape:'circle',curve:'squircle',lightAngle:-60,blur:.35};
  const imageCache=new Map();let cachedPixels=0,cacheHits=0,cacheMisses=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  function normalize(input={}){const o={};for(const [k,v]of Object.entries(DEFAULTS))o[k]=typeof v==='number'?finite(input[k],v):(k==='curve'?(input[k]==='circle'?'circle':'squircle'):k==='zoomShape'?(input[k]==='ellipse'?'ellipse':'circle'):['convex','lip','magnify'].includes(input[k])?input[k]:v);o.bezel=clamp(o.bezel,1,160);o.thickness=clamp(o.thickness,0,100);o.index=clamp(o.index,1,3);o.strength=clamp(o.strength,0,5);o.radius=clamp(o.radius,0,300);o.maxPixels=clamp(o.maxPixels,100,180000);o.zoom=clamp(o.zoom,1,4);o.lipDepth=clamp(o.lipDepth,0,1);return o;}
  // A quarter-ellipse bevel joins the flat glass interior with zero slope.
  // d is distance inside the rounded edge, in CSS pixels.
  function surface(d,bezel,thickness,curve='circle'){const q=1-clamp(d/bezel,0,1),power=curve==='squircle'?4:2,base=Math.max(.000001,1-q**power);return {height:thickness*Math.max(0,1-q**power)**(1/power),slope:thickness*q**(power-1)/(bezel*base**(1-1/power))};}
  // Liquid Glass Lab's lip: smootherstep blends a convex squircle into its
  // concave inverse. Controls use depth=1; existing shallow materials may use less.
  function lipSurface(d,bezel,thickness,depth=.72){
    const t=clamp(d/bezel,0,1),height=q=>{const convex=Math.max(0,1-(1-q)**4)**.25,s=q*q*q*(q*(q*6-15)+10)*depth;return convex*(1-s)+(1-convex)*s;};
    const a=Math.max(0,t-.002),b=Math.min(1,t+.002);
    return {height:thickness*height(t),slope:t===1?0:thickness*(height(b)-height(a))/((b-a)*bezel)};
  }
  function sample(x,y,width,height,options={}){return sampleNormalized(x,y,width,height,normalize(options));}
  function sampleNormalized(x,y,width,height,o){
    const r=clamp(o.radius,0,Math.min(width,height)/2),qx=Math.abs(x-width/2)-(width/2-r),qy=Math.abs(y-height/2)-(height/2-r),ox=Math.max(qx,0),oy=Math.max(qy,0),outside=Math.hypot(ox,oy),d=r-outside-Math.min(Math.max(qx,qy),0);
    if(d<0||d>=o.bezel)return {dx:0,dy:0,rim:0,height:d<0?0:o.thickness*(o.profile==='lip'?1-o.lipDepth:1)};
    let nx=0,ny=0;if(outside>0){nx=ox/outside*Math.sign(x-width/2);ny=oy/outside*Math.sign(y-height/2);}else if(qx>qy)nx=Math.sign(x-width/2);else ny=Math.sign(y-height/2);
    const s=o.profile==='lip'?lipSurface(d,o.bezel,o.thickness,o.lipDepth):surface(d,o.bezel,o.thickness,o.curve),normalLength=Math.hypot(s.slope,1),cosI=1/normalLength,eta=1/o.index,cosT=Math.sqrt(1-eta*eta*(1-cosI*cosI)),factor=eta*cosI-cosT;
    // Snell–Descartes: sin(theta_t)=sin(theta_i)/n. I=(0,0,-1).
    const tx=factor*nx*s.slope/normalLength,ty=factor*ny*s.slope/normalLength,tz=-eta+factor*cosI,travel=s.height/Math.max(0.01,-tz)*Math.max(0,o.strength);
    return {dx:tx*travel,dy:ty*travel,rim:Math.pow(Math.max(0,1-d/o.bezel),3)*(0.22+0.78*Math.max(0,nx*Math.cos(o.lightAngle*Math.PI/180)+ny*Math.sin(o.lightAngle*Math.PI/180))),height:s.height};
  }
  function generate(width,height,options={}){
    const o=normalize(options);width=clamp(finite(width,1),1,16384);height=clamp(finite(height,1),1,16384);
    const ratio=Math.min(1,Math.sqrt(o.maxPixels/(width*height))),w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio)),vectors=new Float32Array(w*h*3);let maximum=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=sampleNormalized((x+.5)*width/w,(y+.5)*height/h,width,height,o),i=(y*w+x)*3;vectors[i]=s.dx;vectors[i+1]=s.dy;vectors[i+2]=s.rim;maximum=Math.max(maximum,Math.abs(s.dx),Math.abs(s.dy));}
    const scale=maximum*2,data=new Uint8ClampedArray(w*h*4),rim=new Uint8ClampedArray(data.length);
    for(let i=0,j=0;i<vectors.length;i+=3,j+=4){data[j]=scale?Math.round(128+vectors[i]/maximum*127):128;data[j+1]=scale?Math.round(128+vectors[i+1]/maximum*127):128;data[j+2]=128;data[j+3]=255;const vertical=Math.floor(j/4/w)/h;rim[j]=Math.round(255-vertical*18);rim[j+1]=251;rim[j+2]=Math.round(243+vertical*12);rim[j+3]=Math.round(vectors[i+2]*110);}
    return {width:w,height:h,data,rim,scale};
  }
  function zoomMap(width,height,options={}){const o=normalize(options);width=clamp(finite(width,1),1,16384);height=clamp(finite(height,1),1,16384);const ratio=Math.min(1,Math.sqrt(o.maxPixels/(width*height))),w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio)),r=Math.max(1,Math.min(width,height)/2-o.bezel*.35),rx=o.zoomShape==='ellipse'?Math.max(1,width/2-o.bezel*.35):r,ry=o.zoomShape==='ellipse'?Math.max(1,height/2-o.bezel*.35):r,v=new Float32Array(w*h*2),mask=new Uint8ClampedArray(w*h*4);let max=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const px=(x+.5)*width/w-width/2,py=(y+.5)*height/h-height/2,q=Math.hypot(px/rx,py/ry),weight=Math.sqrt(Math.max(0,1-q*q)),gain=(1-1/o.zoom)*weight,i=(y*w+x)*2,j=(y*w+x)*4;v[i]=-px*gain;v[i+1]=-py*gain;max=Math.max(max,Math.abs(v[i]),Math.abs(v[i+1]));const t=clamp((1-q)/.18,0,1);mask[j]=mask[j+1]=mask[j+2]=255;mask[j+3]=Math.round(255*t*t*(3-2*t));}
    const data=new Uint8ClampedArray(w*h*4);for(let i=0,j=0;i<v.length;i+=2,j+=4){data[j]=max?128+v[i]/max*127:128;data[j+1]=max?128+v[i+1]/max*127:128;data[j+2]=128;data[j+3]=255;}return {width:w,height:h,data,mask,scale:2*max};}
  // Identical card/control geometry shares immutable data URLs. Bound both entry
  // count and total pixels; no canvases, DOM nodes or raw pixel buffers are kept.
  function opticalImages(key,width,height,options,magnify){
    if(imageCache.has(key)){const entry=imageCache.get(key);imageCache.delete(key);imageCache.set(key,entry);cacheHits++;return entry;}
    cacheMisses++;const map=generate(width,height,options),canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;const ctx=canvas.getContext('2d'),buffers={refraction:map.data,rim:map.rim};let zoomScale=0;
    if(magnify){const zoom=zoomMap(width,height,options);buffers.zoomMap=zoom.data;buffers.zoomMask=zoom.mask;zoomScale=zoom.scale;}
    const images={};for(const [name,bytes]of Object.entries(buffers)){ctx.putImageData(new ImageData(bytes,map.width,map.height),0,0);images[name]=canvas.toDataURL();}
    const entry={images,scale:map.scale,zoomScale,pixels:map.width*map.height};imageCache.set(key,entry);cachedPixels+=entry.pixels;
    while(imageCache.size>16||cachedPixels>1_500_000){const oldest=imageCache.keys().next().value;cachedPixels-=imageCache.get(oldest).pixels;imageCache.delete(oldest);}return entry;
  }
  class Glass {
    constructor(element,options={}){this.element=element;this.options={...DEFAULTS,...options};this.enabled=false;this.id='boralances-glass-'+(global.__boralancesRefractionSequence=(global.__boralancesRefractionSequence||0)+1);const ns='http://www.w3.org/2000/svg';this.svg=document.createElementNS(ns,'svg');this.svg.setAttribute('width','0');this.svg.setAttribute('height','0');this.svg.setAttribute('aria-hidden','true');this.svg.classList.add('glass-filter-definitions');
      const magnify=this.options.profile==='magnify'||!!this.options.centerZoom;this.svg.innerHTML='<defs><filter id="'+this.id+'" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage result="refraction" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="refraction" xChannelSelector="R" yChannelSelector="G" result="refracted"/><feGaussianBlur in="refracted" stdDeviation=".35" edgeMode="duplicate" result="edgeGlass"/>'+(magnify?'<feImage result="zoomMap" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="zoomMap" xChannelSelector="R" yChannelSelector="G" result="zoomed"/><feImage result="zoomMask" preserveAspectRatio="none"/><feComposite in="zoomed" in2="zoomMask" operator="in" result="zoomCenter"/><feComposite in="edgeGlass" in2="zoomMask" operator="out" result="edgeOnly"/><feComposite in="edgeOnly" in2="zoomCenter" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lens"/>':'')+'<feImage result="rim" preserveAspectRatio="none"/><feColorMatrix in="rim" type="matrix" result="highlight"/><feGaussianBlur in="highlight" stdDeviation=".8" result="rimBloom"/><feComponentTransfer in="rimBloom" result="softRim"><feFuncA type="linear" slope=".28"/></feComponentTransfer><feBlend in="'+(magnify?'lens':'edgeGlass')+'" in2="softRim" mode="screen" result="litGlass"/><feBlend in="litGlass" in2="highlight" mode="screen"/></filter></defs>';document.body.append(this.svg);this.filter=this.svg.querySelector('filter');this.images=this.svg.querySelectorAll('feImage');this.displacement=this.svg.querySelector('feDisplacementMap');this.highlight=this.svg.querySelector('[result="highlight"]');this.zoomDisplacement=this.svg.querySelector('[result="zoomed"]');
      this.resize=new ResizeObserver(()=>this.schedule());this.resize.observe(element);this.visibility=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.schedule();});this.visibility.observe(element);this.schedule();}
    schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.update(),140);}
    update(options){
      if(options)Object.assign(this.options,options);if(!this.enabled||!this.visible||document.hidden)return;
      const rect=this.element.getBoundingClientRect(),box={width:this.element.offsetWidth||rect.width,height:this.element.offsetHeight||rect.height};if(box.width<1||box.height<1)return;
      const root=document.body.dataset,quality=root.glassQuality||'balanced',clarity=clamp(finite(root.glassClarity,1),.3,1.6),light=clamp(finite(root.glassLight,.65),.1,1.2);
      this.highlight.setAttribute('values','1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 '+light+' 0');this.filter.querySelector('[result="edgeGlass"]').setAttribute('stdDeviation',clamp(finite(this.options.blur,.35),0,2));
      if(this.baseScale!==undefined)this.displacement.setAttribute('scale',(this.baseScale*clarity).toFixed(3));
      const optics=normalize({...this.options,maxPixels:Math.min(this.options.maxPixels,quality==='low'?18000:quality==='high'?180000:62000)});delete optics.blur;
      const key=Math.round(box.width)+':'+Math.round(box.height)+':'+!!this.zoomDisplacement+':'+JSON.stringify(optics);if(this.key===key)return;
      const maps=opticalImages(key,box.width,box.height,optics,!!this.zoomDisplacement);this.key=key;
      if(this.zoomDisplacement)this.zoomDisplacement.setAttribute('scale',maps.zoomScale.toFixed(3));
      for(const img of this.images){img.setAttribute('href',maps.images[img.getAttribute('result')]);for(const [a,v]of Object.entries({x:0,y:0,width:box.width,height:box.height}))img.setAttribute(a,v);}
      for(const [a,v]of Object.entries({x:0,y:0,width:box.width,height:box.height}))this.filter.setAttribute(a,v);this.baseScale=maps.scale;this.displacement.setAttribute('scale',(maps.scale*clarity).toFixed(3));this.element.style.setProperty('--glass-filter','url(#'+this.id+')');this.element.classList.add('glass-refracted');
    }
    enable(value){if(this.enabled===!!value)return;this.enabled=!!value;this.element.classList.toggle('glass-refracted',this.enabled);if(value)this.schedule();}
    destroy(){clearTimeout(this.timer);this.resize.disconnect();this.visibility.disconnect();this.svg.remove();this.element.classList.remove('glass-refracted');this.element.style.removeProperty('--glass-filter');}
  }
  Glass.sequence=0;
  const api={DEFAULTS,surface,lipSurface,sample,generate,zoomMap,Glass,cacheInfo:()=>({entries:imageCache.size,pixels:cachedPixels,hits:cacheHits,misses:cacheMisses})};if(typeof module==='object'&&module.exports)module.exports=api;else global.BoralancesRefraction=api;
})(typeof window==='undefined'?globalThis:window);
