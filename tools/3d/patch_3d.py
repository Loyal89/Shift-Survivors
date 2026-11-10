"""Add the 3D view to a Shift Survivors build.  python3 patch_3d.py SRC OUT MODE   (MODE: inline | artifact)"""
import sys, re, os
src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
here = os.path.dirname(os.path.abspath(__file__))
s = open(src, encoding='utf-8').read()
g3d = open(os.path.join(here, 'g3d.js'), encoding='utf-8').read()
LIBS = ['build/three.min.js', 'examples/js/shaders/CopyShader.js', 'examples/js/shaders/LuminosityHighPassShader.js',
        'examples/js/postprocessing/EffectComposer.js', 'examples/js/postprocessing/ShaderPass.js',
        'examples/js/postprocessing/RenderPass.js', 'examples/js/postprocessing/UnrealBloomPass.js',
        'examples/js/utils/BufferGeometryUtils.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/utils/SkeletonUtils.js']
if mode == 'inline':
    libs = ''.join('<script>/* three.js r147 (MIT) ' + p + ' */\n' + open(os.path.join(here, 'package', p), encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>\n' for p in LIBS)
else:
    libs = ''.join(f'<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/{p}"></script>\n' for p in LIBS)
def rep(a, b):
    global s
    c = s.count(a); assert c == 1, (c, a[:90]); s = s.replace(a, b)
rep("<script>\n(function(){\n'use strict';", libs + "<script>\n(function(){\n'use strict';")
wire = """
/* title screen: your 3D character beside the menu (falls back to the classic layout until the model is ready) */
function heroTitle(){const p3=G3D.preview(myLook(),'title');$('#titleHero').hidden=!p3;$('#locker3d').hidden=!p3;document.body.classList.toggle('hero',!!p3);
  $('#heroName').textContent=$('#titleNurse').textContent;$('#heroCareer').textContent=$('#titleCareer').textContent}
$('#b-heroLook').addEventListener('click',()=>$('#b-locker').click());
window.SS3D={status:()=>G3D.status(),w2s:(x,y,h)=>G3D.w2s(x,y,h)};
"""
rep("function render(dt,t){\n", "function render(dt,t){\n  if(G3D.render(dt,t))return;\n")
rep("soundLabels();show('title')}", "soundLabels();show('title');heroTitle()}")
# the title screen's 3D character goes at the end of the title section (both editions)
assert s.count('<section id="s-title"') == 1
_i = s.index('<section id="s-title"'); _j = s.index('\n</section>', _i)
s = (s[:_j] + '\n  <div class="hero3d" id="titleHero" hidden><div id="heroStage"></div>'
     '<div class="hcard"><b id="heroName"></b><span id="heroCareer"></span><button class="chip" id="b-heroLook" type="button" data-t="h_look">Change look</button></div></div>' + s[_j:])
if mode == 'artifact':
    for k in 'fm':   # artifacts serve .json, not .glb
        assert g3d.count(f"url:'nurse_{k}.glb'") == 1
        g3d = g3d.replace(f"url:'nurse_{k}.glb'", f"url:'nurse_{k}.json'")
rep("const hot=window.claude&&window.claude.hot;", g3d + wire + "const hot=window.claude&&window.claude.hot;")
rep("const b=k.room.bed;const sx=(b.x-cam.x)*ZOOM+VW/2,sy=(b.y-cam.y)*ZOOM+VH/2;",
    "const b=k.room.bed;let sx=(b.x-cam.x)*ZOOM+VW/2,sy=(b.y-cam.y)*ZOOM+VH/2;if(G3D.on()){const q=G3D.w2s(b.x,b.y,.4);sx=q.x;sy=q.y}")
rep("const hw=VW/2/ZOOM,hh=VH/2/ZOOM;mg.strokeStyle='#2de2e6';mg.lineWidth=10;mg.strokeRect(cam.x-hw,cam.y-hh,hw*2,hh*2)",
    "mg.strokeStyle='#2de2e6';mg.lineWidth=10;if(G3D.on()){const v=G3D.view;mg.strokeRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0)}else{const hw=VW/2/ZOOM,hh=VH/2/ZOOM;mg.strokeRect(cam.x-hw,cam.y-hh,hw*2,hh*2)}")
rep("@keyframes fdin{from{opacity:0}to{opacity:1}}", "@keyframes fdin{from{opacity:0}to{opacity:1}}\n/* 3D view: a bigger minimap */\nbody.g3d #mini{width:340px;height:152px}body.g3d #team{bottom:calc(env(safe-area-inset-bottom,0px) + 170px)}\n@media (max-width:720px){body.g3d #mini{width:224px;height:100px}body.g3d #team{display:none}body.g3d #ups{max-width:calc(100vw - 254px)}body.g3d #feed{width:calc(100vw - 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 122px)!important}}\n@media (max-height:520px){body.g3d #mini{width:224px;height:100px}}")
# character creator: female or male, with a turning 3D preview in the Locker
rep('<div class="preview"><canvas id="lockerSprite" width="16" height="22"></canvas>',
    '<div class="preview"><canvas id="lockerSprite" width="16" height="22"></canvas><canvas id="locker3d" width="540" height="706" hidden aria-label="Your character" title="Drag to turn"></canvas>')
rep('<div class="opt wide"><h3 data-t="o_nurse">Nurse</h3>',
    '<div class="opt wide"><h3 data-t="o_body">Character</h3><div class="styles" id="optBody"></div></div>\n        <div class="opt wide"><h3 data-t="o_nurse">Nurse</h3>')
rep("drawSpriteInto($('#lockerSprite'),myLook(),'down',0);",
    "drawSpriteInto($('#lockerSprite'),myLook(),'down',0);"
    "{const ob=$('#optBody');ob.innerHTML='';const cur=myLook().body;[['f','b_f'],['m','b_m']].forEach(([v,t])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=tr(t);"
    "b.setAttribute('aria-pressed',String(cur===v));b.addEventListener('click',()=>{L.body=v;if(v==='f')L.bd=false;persist();sfx('click');lockerScreen()});ob.appendChild(b)})}"
    "{const p3=G3D.preview(myLook());$('#locker3d').hidden=!p3;$('#lockerSprite').hidden=!!p3}")
rep('function myLook(){const L=SAVE.look;return {skin:L.skin,style:L.style,hairc:L.hairc,scrub:L.scrub,gl:!!L.gl,bd:!!L.bd,cap:!!L.cap}}',
    "function myLook(){const L=SAVE.look;return {skin:L.skin,style:L.style,hairc:L.hairc,scrub:L.scrub,gl:!!L.gl,bd:!!L.bd,cap:!!L.cap,body:L.body||(L.bd?'m':'f'),shoes:L.shoes||'',steth:L.steth!==false}}")
# Locker: shoe colors and a stethoscope switch (both show on the 3D character)
rep("const STYLES=['short','long','bun','curly','buzz','pony'];",
    "const STYLES=['short','long','bun','curly','buzz','pony'];\nconst SHOES=['#f4f6fa','#2a2c36','#8a93a6','#1e355a','#ff8fc4','#7b5cd6','#18a6c4','#e05a5a'];")
rep('<div class="styles" id="optExtra"></div>',
    '<div class="styles" id="optExtra"></div>\n          <h3 style="margin-top:12px" data-t="o_shoes">Shoes</h3><div class="swatches" id="optShoes"></div>')
rep("const ex=$('#optExtra');ex.innerHTML='';[['gl','x_gl'],['bd','x_bd'],['cap','x_cap']].forEach(([k,t])=>{",
    "if(L.steth===undefined)L.steth=true;const ex=$('#optExtra');ex.innerHTML='';[['gl','x_gl'],['steth','x_steth'],['bd','x_bd'],['cap','x_cap']].forEach(([k,t])=>{")
rep("  sw($('#optHairc'),HAIRC,L.hairc,i=>{L.hairc=i},i=>tr('o_hair')+' '+(i+1));",
    "  sw($('#optShoes'),SHOES,Math.max(0,SHOES.indexOf(L.shoes||SHOES[0])),i=>{L.shoes=SHOES[i]},i=>tr('o_shoes')+' '+(i+1));\n  sw($('#optHairc'),HAIRC,L.hairc,i=>{L.hairc=i},i=>tr('o_hair')+' '+(i+1));")
rep("@keyframes fdin{from{opacity:0}to{opacity:1}}", "@keyframes fdin{from{opacity:0}to{opacity:1}}\n"
    ".preview #locker3d{width:270px;height:353px;image-rendering:auto;touch-action:pan-y;cursor:grab}\n"
    "@media (min-width:721px){body.g3d .locker{grid-template-columns:minmax(0,310px) minmax(0,1fr)}}\n"
    "@media (max-width:720px){body.g3d .preview{flex-direction:column}.preview #locker3d{width:230px;height:300px}}")
# title screen in 3D: the menu on the left over a dark fade, your character big on the right (phones: stacked)
rep("@keyframes fdin{from{opacity:0}to{opacity:1}}", "@keyframes fdin{from{opacity:0}to{opacity:1}}\n"
    "body.hero #s-title{display:grid;grid-template-columns:minmax(0,500px) minmax(0,min(40vw,430px));column-gap:clamp(20px,7vw,140px);align-items:center;justify-content:center;"
    "background:linear-gradient(90deg,rgba(11,10,28,.96) 0%,rgba(11,10,28,.86) 36%,rgba(11,10,28,.4) 64%,rgba(11,10,28,.55) 100%)}\n"
    "body.hero #s-title .panel{background:none;border:0;box-shadow:none;padding:0;margin:0;max-width:none!important;gap:18px}\n"
    "body.hero #s-title .logo{align-items:flex-start;gap:12px}body.hero #s-title .logo span{font-size:clamp(30px,4.4vw,66px)}\n"
    "body.hero #s-title .sub,body.hero #s-title .tag,body.hero #s-title #studio{text-align:left!important}body.hero #s-title .who{display:none}\n"
    "body.hero #s-title .menu{display:flex;margin:6px 0 0;width:min(420px,100%)}body.hero #s-title .row{justify-content:flex-start}\n"
    "@media (max-height:600px){body.hero #s-title .menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}body.hero #s-title .menu .primary{grid-column:1/-1}}\n"
    ".hero3d{display:flex;flex-direction:column;align-items:center;gap:0;min-width:0;animation:fdin .5s ease-out}\n"
    "#heroStage{position:relative;width:100%;aspect-ratio:3/4.2;max-height:min(74vh,640px);background:radial-gradient(ellipse 46% 44% at 50% 48%,rgba(45,226,230,.17),rgba(155,92,255,.07) 55%,rgba(11,10,28,0) 72%)}\n"
    "#heroStage::before{content:'';position:absolute;left:16%;right:16%;bottom:2.5%;height:10%;border-radius:50%;pointer-events:none;"
    "background:radial-gradient(closest-side,rgba(45,226,230,.55),rgba(45,226,230,.16) 55%,rgba(45,226,230,0))}\n"
    "#heroStage #locker3d{position:relative;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y}#heroStage #locker3d:active{cursor:grabbing}\n"
    ".hcard{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;background:rgba(21,18,58,.86);border:2px solid var(--line);"
    "border-left:6px solid var(--cyan);padding:8px 16px 10px;box-shadow:4px 4px 0 #000;max-width:100%}\n"
    ".hcard b{font-weight:400;font-family:var(--px);font-size:clamp(11px,1.15vw,15px);letter-spacing:.06em;color:var(--ink);line-height:1.4}\n"
    ".hcard span{color:var(--muted);font-size:20px}.hcard .chip{margin-top:4px;font-size:20px;min-height:36px;padding:4px 12px}\n"
    "@media (max-width:720px){body.hero #s-title{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;"
    "background:linear-gradient(180deg,rgba(11,10,28,.92) 0%,rgba(11,10,28,.42) 26%,rgba(11,10,28,.42) 50%,rgba(11,10,28,.95) 70%)}"
    "body.hero #s-title .panel{display:contents}body.hero #s-title .panel>*{order:7}body.hero #s-title #studio{text-align:center!important}body.hero #s-title .logo{order:1;align-items:center;gap:8px}body.hero #s-title .logo span{font-size:clamp(26px,9vw,44px)}"
    "body.hero #s-title .sub{order:2;text-align:center;font-size:20px}body.hero #s-title .hero3d{order:3}"
    "body.hero #s-title .menu{order:4;margin:0;gap:8px;width:min(420px,100%)}body.hero #s-title .menu .btn{min-height:46px;padding:8px 14px;font-size:24px}"
    "body.hero #s-title .row{order:5;justify-content:center}body.hero #s-title .tag{display:none}"
    "#heroStage{width:auto;height:min(35vh,330px);aspect-ratio:3/4.2;max-height:none}"
    ".hcard{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:2px 10px;padding:6px 12px;margin-top:-4px}.hcard .chip{margin:0}}\n"
    "@media (max-width:720px) and (max-height:700px){#heroStage{height:27vh}}\n"
    "@media (max-height:520px) and (min-width:721px){body.hero #s-title .panel{gap:10px}#heroStage{max-height:80vh}.hcard{padding:4px 12px}.hcard .chip{display:none}}")
rep("fl_med:'MED ROOM',", "fl_med:'MED ROOM',o_body:'Character',b_f:'Female',b_m:'Male',h_look:'Change look',")
rep("fl_med:'MEDICAMENTOS',", "fl_med:'MEDICAMENTOS',o_body:'Personaje',b_f:'Mujer',b_m:'Hombre',h_look:'Cambiar aspecto',")
rep("x_cap:'Scrub cap'", "x_cap:'Cap',x_steth:'Stethoscope',o_shoes:'Shoes'")
rep("x_cap:'Gorro quir\\u00fargico'", "x_cap:'Gorro',x_steth:'Estetoscopio',o_shoes:'Zapatos'")
if mode == 'artifact':
    s = re.sub(r'<!DOCTYPE html>\s*', '', s, flags=re.I)
    s = re.sub(r'</?html[^>]*>\s*', '', s); s = re.sub(r'</?head>\s*', '', s); s = re.sub(r'</?body[^>]*>\s*', '', s)
    s = re.sub(r'<title>[^<]*</title>\s*', '', s, count=1)
    s = '<title>Shift Survivors 3D</title>\n' + s
open(out, 'w', encoding='utf-8').write(s)
print(mode, out, len(s))
