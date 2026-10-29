'use strict';
const CAPES=[
 ['solar-herald','Solar Herald','sun','#ffca68','#542846'],
 ['lunar-eclipse','Lunar Eclipse','moon','#bdd6ff','#252347'],
 ['starlight-weave','Starlight Weave','stars','#e0caff','#343059'],
 ['void-walker','Void Walker','portal','#bf79ff','#1c1634'],
 ['crystal-heart','Crystal Heart','heart','#f8a3cc','#492657'],
 ['glacier-crest','Glacier Crest','diamond','#b1f5ff','#245173'],
 ['tidal-guardian','Tidal Guardian','trident','#73eddd','#145467'],
 ['coral-bloom','Coral Bloom','coral','#ffb9ac','#355966'],
 ['forest-spirit','Forest Spirit','tree','#bfe595','#244539'],
 ['moss-temple','Moss Temple','temple','#bbd674','#424947'],
 ['sandstorm','Sandstorm','dunes','#f0d19b','#735349'],
 ['desert-phoenix','Desert Phoenix','phoenix','#ffb068','#8e4236'],
 ['molten-forge','Molten Forge','forge','#ff9654','#512d3a'],
 ['inferno-sigil','Inferno Sigil','flame','#ffcc77','#842d45'],
 ['amethyst-order','Amethyst Order','rune','#dab4ff','#4b347a'],
 ['royal-banner','Royal Banner','crown','#f2d894','#523b78'],
 ['rose-knight','Rose Knight','rose','#ffb4bf','#602b48'],
 ['storm-strider','Storm Strider','bolt','#c8cfff','#394d80'],
 ['circuit-runner','Circuit Runner','circuit','#92ffe0','#24444f'],
 ['prismatic-trail','Prismatic Trail','rainbow','#fac8ff','#3c3b6e']
];
const WINGS=[
 ['celestial-wings','Celestial Wings','stars','#cadcff','#333c74'],
 ['phoenix-wings','Phoenix Wings','phoenix','#ffd382','#a94335'],
 ['frostbite-wings','Frostbite Wings','diamond','#c4fbff','#28647c'],
 ['dragon-scale-wings','Dragon Scale Wings','scales','#f698ba','#55384c'],
 ['sakura-wings','Sakura Wings','flower','#ffd2e9','#81576d'],
 ['raven-wings','Raven Wings','feathers','#c7b9e0','#302941'],
 ['butterfly-wings','Butterfly Wings','eyes','#fcc174','#5d3052'],
 ['cyber-wings','Cyber Wings','circuit','#85ffe9','#263d59'],
 ['opal-wings','Opal Wings','rainbow','#fff1d3','#897aa9'],
 ['sunbeam-wings','Sunbeam Wings','sun','#fff2af','#bb7646'],
 ['nebula-wings','Nebula Wings','portal','#eeafff','#4a357d'],
 ['jade-wings','Jade Wings','tree','#cced8a','#427168'],
 ['scarlet-wings','Scarlet Wings','flame','#ffb2a5','#793d52'],
 ['thunderbird-wings','Thunderbird Wings','bolt','#effaaa','#575f8d'],
 ['deepsea-wings','Deepsea Wings','coral','#7cffe8','#295a77']
];
const COLLECTION=[...CAPES.map(x=>[x,'Cape']),...WINGS.map(x=>[x,'Wings'])].map(([x,type])=>({
 id:x[0],name:x[1],pattern:x[2],color:x[3],base:x[4],type,collection:'Signature 35',
 description:type==='Cape'?x[1]+' — an original pixel emblem with a woven border.':x[1]+' — an original patterned elytra texture.',
 price:0,currency:'FREE',asset:'../../assets/cosmetics/'+x[0]+'.png'
}));
module.exports={COLLECTION};
