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
/* 3D / 2D switch on the title screen */
function gfxLabel(){const b=$('#b-gfx');if(!b)return;if(!G3D.available()){b.hidden=true;return}b.textContent=G3D.isOn()?'3D':'2D';b.setAttribute('aria-pressed',String(G3D.isOn()))}
{const b=$('#b-gfx');if(b)b.addEventListener('click',()=>{G3D.setWant(!G3D.isOn());G3D.snap();gfxLabel()});gfxLabel()}
window.SS3D={status:()=>G3D.status(),w2s:(x,y,h)=>G3D.w2s(x,y,h)};
"""
rep("function render(dt,t){\n", "function render(dt,t){\n  if(G3D.render(dt,t))return;\n")
if mode == 'artifact':
    g3d = g3d.replace("const NURSE_URL='nurse_f.glb'", "const NURSE_URL='nurse_f.json'")   # artifacts serve .json, not .glb
rep("const hot=window.claude&&window.claude.hot;", g3d + wire + "const hot=window.claude&&window.claude.hot;")
rep("const b=k.room.bed;const sx=(b.x-cam.x)*ZOOM+VW/2,sy=(b.y-cam.y)*ZOOM+VH/2;",
    "const b=k.room.bed;let sx=(b.x-cam.x)*ZOOM+VW/2,sy=(b.y-cam.y)*ZOOM+VH/2;if(G3D.on()){const q=G3D.w2s(b.x,b.y,.4);sx=q.x;sy=q.y}")
rep("const hw=VW/2/ZOOM,hh=VH/2/ZOOM;mg.strokeStyle='#2de2e6';mg.lineWidth=10;mg.strokeRect(cam.x-hw,cam.y-hh,hw*2,hh*2)",
    "mg.strokeStyle='#2de2e6';mg.lineWidth=10;if(G3D.on()){const v=G3D.view;mg.strokeRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0)}else{const hw=VW/2/ZOOM,hh=VH/2/ZOOM;mg.strokeRect(cam.x-hw,cam.y-hh,hw*2,hh*2)}")
rep("@keyframes fdin{from{opacity:0}to{opacity:1}}", "@keyframes fdin{from{opacity:0}to{opacity:1}}\n/* 3D view: a bigger minimap */\nbody.g3d #mini{width:340px;height:152px}body.g3d #team{bottom:calc(env(safe-area-inset-bottom,0px) + 170px)}\n@media (max-width:720px){body.g3d #mini{width:224px;height:100px}body.g3d #team{display:none}body.g3d #ups{max-width:calc(100vw - 254px)}body.g3d #feed{width:calc(100vw - 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 122px)!important}}\n@media (max-height:520px){body.g3d #mini{width:224px;height:100px}}")
rep('<button class="chip" id="b-es" type="button">Español</button>',
    '<button class="chip" id="b-es" type="button">Español</button>\n      <button class="chip" id="b-gfx" type="button" aria-pressed="true" title="3D or classic 2D graphics">3D</button>')
# character creator: female or male, with a turning 3D preview in the Locker
rep('<div class="preview"><canvas id="lockerSprite" width="16" height="22"></canvas>',
    '<div class="preview"><canvas id="lockerSprite" width="16" height="22"></canvas><canvas id="locker3d" width="300" height="380" hidden aria-label="Your character"></canvas>')
rep('<div class="opt wide"><h3 data-t="o_nurse">Nurse</h3>',
    '<div class="opt wide"><h3 data-t="o_body">Character</h3><div class="styles" id="optBody"></div></div>\n        <div class="opt wide"><h3 data-t="o_nurse">Nurse</h3>')
rep("drawSpriteInto($('#lockerSprite'),myLook(),'down',0);",
    "drawSpriteInto($('#lockerSprite'),myLook(),'down',0);"
    "{const ob=$('#optBody');ob.innerHTML='';const cur=myLook().body;[['f','b_f'],['m','b_m']].forEach(([v,t])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=tr(t);"
    "b.setAttribute('aria-pressed',String(cur===v));b.addEventListener('click',()=>{L.body=v;if(v==='f')L.bd=false;persist();sfx('click');lockerScreen()});ob.appendChild(b)})}"
    "{const p3=G3D.preview(myLook());$('#locker3d').hidden=!p3;$('#lockerSprite').hidden=!!p3}")
rep('function myLook(){const L=SAVE.look;return {skin:L.skin,style:L.style,hairc:L.hairc,scrub:L.scrub,gl:!!L.gl,bd:!!L.bd,cap:!!L.cap}}',
    "function myLook(){const L=SAVE.look;return {skin:L.skin,style:L.style,hairc:L.hairc,scrub:L.scrub,gl:!!L.gl,bd:!!L.bd,cap:!!L.cap,body:L.body||(L.bd?'m':'f')}}")
rep("@keyframes fdin{from{opacity:0}to{opacity:1}}", "@keyframes fdin{from{opacity:0}to{opacity:1}}\n.preview #locker3d{width:150px;height:190px;image-rendering:auto}")
rep("fl_med:'MED ROOM',", "fl_med:'MED ROOM',o_body:'Character',b_f:'Female',b_m:'Male',")
rep("fl_med:'MEDICAMENTOS',", "fl_med:'MEDICAMENTOS',o_body:'Personaje',b_f:'Mujer',b_m:'Hombre',")
rep("x_cap:'Scrub cap'", "x_cap:'Nurse cap'")
rep("x_cap:'Gorro quir\\u00fargico'", "x_cap:'Gorro de enfermera'")
if mode == 'artifact':
    s = re.sub(r'<!DOCTYPE html>\s*', '', s, flags=re.I)
    s = re.sub(r'</?html[^>]*>\s*', '', s); s = re.sub(r'</?head>\s*', '', s); s = re.sub(r'</?body[^>]*>\s*', '', s)
    s = re.sub(r'<title>[^<]*</title>\s*', '', s, count=1)
    s = '<title>Shift Survivors 3D</title>\n' + s
open(out, 'w', encoding='utf-8').write(s)
print(mode, out, len(s))
