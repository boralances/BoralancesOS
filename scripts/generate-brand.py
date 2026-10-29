"""Original vector marks and icons, generated from one consistent geometry."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'assets/brand'
ICONS = ROOT / 'assets/icons'
BRAND.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

GLYPH = '<path d="M182 132v248M184 132h78c80 0 100 103 21 121 90 14 87 127-6 127h-93M185 253h89" fill="none" stroke="{color}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>'
DEFS = '''<defs>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5fcff"/><stop offset=".36" stop-color="#b9dcff"/><stop offset=".68" stop-color="#939ef5"/><stop offset="1" stop-color="#daedff"/></linearGradient>
<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></linearGradient>
<linearGradient id="rim" x2=".7" y2="1"><stop stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
<radialGradient id="shine" cx=".25" cy="0" r="1"><stop stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'''


def svg(name, content, title, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="title"><title id="title">{title}</title>{defs}{content}</svg>\n'


for name, color in [('mark', 'url(#glass)'), ('mark-white', '#f4f7ff'), ('mark-ink', '#172944')]:
    (BRAND / f'{name}.svg').write_text(svg(name, GLYPH.format(color=color), 'BoralancesOS ribbon monogram', DEFS.format(light='#9bbaf7', dark='#445bb0')), encoding='utf-8')

paths = {
 'boralances-task-manager': ('#8edacb','#236a73','<path d="M126 328h260M148 290l45-83 49 53 51-118 70 144"/><rect x="114" y="115" width="284" height="274" rx="30"/>'),
 'boralances-calendar': ('#ffb3bc','#a74367','<rect x="125" y="137" width="262" height="244" rx="30"/><path d="M125 208h262M192 120v42M320 120v42M183 263h43M288 263h43M183 321h43M288 321h43"/>'),
 'boralances-quick-settings': ('#bbc9ff','#5362a4','<path d="M136 180h240M136 256h240M136 332h240"/><circle cx="211" cy="180" r="25" fill="#c6d6ff"/><circle cx="310" cy="256" r="25" fill="#a9bdff"/><circle cx="226" cy="332" r="25" fill="#9cafff"/>'),
 'boralances-system-menu': ('#b7d9ff','#5266c3',GLYPH.format(color='white')),
 'boralances-start-menu': ('#a9c6ff','#5f59bd','<rect x="128" y="128" width="100" height="100" rx="23"/><rect x="284" y="128" width="100" height="100" rx="23"/><rect x="128" y="284" width="100" height="100" rx="23"/><rect x="284" y="284" width="100" height="100" rx="23"/>'),
 'boralances-center': ('#b5d9ef','#466c9a','<circle cx="256" cy="256" r="120"/><circle cx="256" cy="256" r="48"/><path d="M256 122v45M256 345v45M122 256h45M345 256h45"/>'),
 'boralances-widgets': ('#a9dccf','#457e87','<rect x="125" y="124" width="262" height="264" rx="34"/><path d="M125 252h262M255 252v136"/><circle cx="256" cy="186" r="34"/><path d="M256 162v25l18 12"/>'),
 'boralances-shortcuts': ('#c7c5d8','#73728f','<rect x="111" y="162" width="290" height="191" rx="29"/><path d="M155 208h19M211 208h19M267 208h19M323 208h19M155 257h19M211 257h19M267 257h19M323 257h19M173 307h169"/>'),
 'boralances-pdf': ('#ffb6ad','#b94a58','<path d="M161 114h134l65 66v218H161zM295 114v67h65M204 240h110M204 290h110M204 340h78"/>'),
 'boralances-video': ('#b8b1f6','#6653ad','<rect x="115" y="154" width="282" height="207" rx="37"/><path d="m221 203 89 54-89 54z"/>'),
 'boralances-image': ('#b5d89d','#5d8866','<rect x="118" y="128" width="276" height="256" rx="28"/><circle cx="304" cy="203" r="33"/><path d="m129 342 87-109 55 63 40-36 72 88"/>'),
 'boralances-calculator': ('#ffd3a1','#b8794a','<rect x="157" y="113" width="198" height="288" rx="32"/><path d="M192 160h128v56H192zM203 267h8M260 267h8M310 267h8M203 319h8M260 319h8M310 319h8M203 369h8M260 369h58"/>'),
 'boralances-editor': ('#abd4ff','#5274ac','<path d="M156 114h200v284H156zM195 175h122M195 228h122M195 281h78M195 334h56"/>'),
 'boralances-code': ('#a2d6f3','#3a6d9e','<path d="m210 163-92 93 92 93M302 163l92 93-92 93M285 130l-58 252"/>'),
 'boralances-passwords': ('#f3d79b','#9c7d42','<rect x="157" y="226" width="198" height="161" rx="29"/><path d="M195 226v-53a61 61 0 0 1 122 0v53"/><circle cx="256" cy="292" r="18"/><path d="M256 311v30"/>'),
 'boralances-steam': ('#9bb9db','#284d71','<path d="M148 213c-34 10-54 109-20 128 28 16 51-26 73-28h110c22 2 45 44 73 28 34-19 14-118-20-128-48-16-164-16-216 0zM165 243v52M140 269h52"/><circle cx="322" cy="249" r="9"/><circle cx="350" cy="277" r="9"/>'),
 'boralances-heroic': ('#b7a5ef','#63509c','<path d="m151 203 63 39 42-104 42 104 63-39-29 144H180zM184 380h144"/>'),
 'boralances-lutris': ('#ffc796','#a96244','<path d="M184 124h143v56l-36 52v143h49M158 375h133M158 261h81M208 124v56l-50 81v114"/>'),
 'boralances-tor': ('#d7b5ef','#79539c','<path d="M260 122c-10 68-100 92-100 168a96 96 0 0 0 192 0c0-76-88-100-92-168zM260 178c-3 58-48 71-48 125a48 48 0 0 0 96 0c0-54-45-67-48-125zM260 118l53-23M260 123l-28-42"/>'),
 'boralances-network': ('#aed6ff','#3f7fb5','<path d="M119 197a217 217 0 0 1 274 0M167 254a143 143 0 0 1 178 0M213 309a69 69 0 0 1 86 0"/><circle cx="256" cy="365" r="15"/>'),
 'boralances-bluetooth': ('#adc5ff','#4b70b8','<path d="m183 160 145 161-72 79V112l72 79-145 161"/>'),
 'boralances-trash': ('#c4d6cc','#647f76','<path d="M153 181h206M204 181v-40h104v40M174 181l14 202h136l14-202M230 226v109M282 226v109"/>'),
 'boralances-overview': ('#adc6df','#536f91','<rect x="119" y="132" width="124" height="116" rx="20"/><rect x="269" y="132" width="124" height="116" rx="20"/><rect x="119" y="274" width="124" height="116" rx="20"/><rect x="269" y="274" width="124" height="116" rx="20"/>'),
 'boralances-browser': ('#85bffa', '#424dbb', '<circle cx="256" cy="256" r="123"/><ellipse cx="256" cy="256" rx="58" ry="123"/><path d="M139 220h234M139 292h234"/><path d="m304 160 31 83-82 94 22-105z" fill="#fff" stroke="none"/>'),
 'boralances-launcher': ('#88d8bd', '#276567', '<path d="m256 119 123 70v138l-123 70-123-70V189zM133 189l123 73 123-73M256 262v135M195 155l122 73v75"/>'),
 'boralances-jarvis': ('#c0b4f6', '#6250aa', '<circle cx="256" cy="256" r="123" stroke-dasharray="12 16"/><circle cx="256" cy="256" r="77"/><path d="M213 257h86M256 214v86"/>'),
 'boralances-glass-connect': ('#b5ddf6', '#496eae', '<rect x="122" y="143" width="268" height="183" rx="20"/><path d="M256 327v42M196 375h120M149 170h213"/>'),
 'boralances-files': ('#97cfff', '#4c81d0', '<path d="M118 191v-25q0-19 19-19h91l32 32h115q19 0 19 19v141q0 19-19 19H137q-19 0-19-19V191z" fill="#ffffff18"/><path d="M120 211h272"/>'),
 'boralances-terminal': ('#687b99', '#24364e', '<path d="m157 187 73 67-73 67M258 325h99"/>'),
 'boralances-settings': ('#c5d0e2', '#62758f', '<circle cx="256" cy="256" r="61"/><circle cx="256" cy="256" r="116" stroke-dasharray="34 22" stroke-width="37"/>'),
 'boralances-installer': ('#c8deff', '#6579c4', '<rect x="137" y="280" width="238" height="91" rx="22"/><path d="M256 125v133m-57-56 57 57 57-57M168 328h6M201 328h6"/>'),
 'boralances-chat': ('#f3b6ce', '#9d5485', '<path d="M142 151h228v171H246l-71 49v-49h-33z" stroke-linejoin="round"/><path d="M190 212h131M190 258h90"/>'),
 'boralances-os': ('#b7d9ff', '#5266c3', GLYPH.format(color='white')),
}
for name, (light, dark, path) in paths.items():
    tile = '<rect x="30" y="30" width="452" height="452" rx="104" fill="url(#tile)"/><rect x="31" y="31" width="450" height="450" rx="103" fill="url(#shine)" stroke="url(#rim)" stroke-width="3"/><rect x="43" y="43" width="426" height="426" rx="93" fill="none" stroke="#ffffff1c" stroke-width="2"/>'
    art = f'<g fill="none" stroke="#f5f9ff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">{path}</g>'
    (ICONS / (name + '.svg')).write_text(svg(name, tile + art, name.replace('-', ' ').title(), DEFS.format(light=light, dark=dark)), encoding='utf-8')

manifest = {'name': 'BoralancesOS / Ribbon', 'version': 1,
 'construction': 'An original continuous B ribbon with two rounded lobes and a shared optical seam.',
 'clearSpace': 'At least one stroke width around the mark.', 'minimumSize': '24px mark / 32px detailed glass tile',
 'files': [str(p.relative_to(ROOT)).replace('\\','/') for p in sorted(BRAND.glob('*.svg'))] + [str(p.relative_to(ROOT)).replace('\\','/') for p in sorted(ICONS.glob('*.svg'))]}
(BRAND / 'identity.json').write_text(json.dumps(manifest, indent=2) + '\n')
aliases={'steam':'boralances-steam','heroic':'boralances-heroic','lutris':'boralances-lutris',
         'org.gnome.SystemMonitor':'boralances-task-manager','gnome-system-monitor':'boralances-task-manager',
         'org.gnome.Evince':'boralances-pdf','evince':'boralances-pdf','mpv':'boralances-video','imv':'boralances-image',
         'qalculate':'boralances-calculator','qalculate-gtk':'boralances-calculator','org.xfce.mousepad':'boralances-editor','mousepad':'boralances-editor',
         'org.xfce.thunar':'boralances-files','org.xfce.Thunar':'boralances-files','Thunar':'boralances-files',
         'geany':'boralances-code','keepassxc':'boralances-passwords','org.keepassxc.KeePassXC':'boralances-passwords',
         'file-roller':'boralances-files','org.gnome.FileRoller':'boralances-files','utilities-terminal':'boralances-terminal',
         'user-trash':'boralances-trash','user-trash-full':'boralances-trash','utilities-system-monitor':'boralances-task-manager',
         'network-manager':'boralances-network','blueman':'boralances-bluetooth','x-office-calendar':'boralances-calendar'}
(ROOT/'assets/icon-aliases.tsv').write_text(''.join(alias+'\t'+name+'\n' for alias,name in aliases.items()),encoding='utf-8',newline='\n')
print(f'Created {len(paths)} application icons and three original logo variants.')
