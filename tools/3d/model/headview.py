"""Close-ups of a character GLB with Locker options, for checking hair pieces, glasses, beard and cap.
python3 -I headview.py THREE_PACKAGE_DIR model.glb out.png '[[{look}, turn, "label", [x, y, z, height]], ...]' [columns] [cell px]
Each cell is the idle pose; the camera looks at (x, y, z) in model centimeters and shows 'height' cm (default [0, 80, 0, 30]).
{look} is what dressNurse takes (style, cap, glasses, beard, steth, hair, top, ...); add "debug": "w" to color the hair-tuck
weight, or "c" to color the hair / skin / cap classes."""
import sys, os, json
from playwright.sync_api import sync_playwright
PKG, GLB, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SHOTS = json.loads(sys.argv[4])
COLS = int(sys.argv[5]) if len(sys.argv) > 5 else 4
CELL = int(sys.argv[6]) if len(sys.argv) > 6 else 400
ROWS = (len(SHOTS) + COLS - 1) // COLS
W, H = COLS * CELL, ROWS * CELL
NMAT = os.environ.get('NMAT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nurse_mat.js'))
LIBS = ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js']
html = ('<!doctype html><html><body style="margin:0;background:#1b2440">' + ''.join(f'<script src="http://local/lib/{l}"></script>' for l in LIBS)
        + f'<script>var T = THREE;</script><script src="http://local/nmat.js"></script><canvas id="c" width="{W}" height="{H}"></canvas></body></html>')
def route(r, q):
    u = q.url
    if u.startswith('http://local/lib/'): r.fulfill(path=os.path.join(PKG, u[len('http://local/lib/'):]), headers={'content-type': 'text/javascript'})
    elif u == 'http://local/m.glb': r.fulfill(path=GLB)
    elif u == 'http://local/nmat.js': r.fulfill(path=NMAT, headers={'content-type': 'text/javascript'})
    elif u == 'http://local/': r.fulfill(body=html, headers={'content-type': 'text/html'})
    else: r.fulfill(status=404, body='')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}); pg.route('http://local/**', route)
    pg.on('pageerror', lambda e: print('pageerror', e)); pg.on('console', lambda m: print('console', m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.goto('http://local/')
    info = pg.evaluate("""async ([SHOTS, COLS, CELL, ROWS]) => {
      const r = new T.WebGLRenderer({canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true});
      r.outputEncoding = T.sRGBEncoding; r.setClearColor('#2a3352'); r.setScissorTest(true);
      const out = [];
      for (let i = 0; i < SHOTS.length; i++) {
        const [dress, yaw, label, frame] = SHOTS[i];
        const sc = new T.Scene(); sc.add(new T.HemisphereLight('#ffffff', '#445', 1.0));
        const d = new T.DirectionalLight('#fff', 1.0); d.position.set(1, 2, 3); sc.add(d);
        const d2 = new T.DirectionalLight('#9ab', .35); d2.position.set(-2, 1, -2); sc.add(d2);
        const g = await new T.GLTFLoader().loadAsync('http://local/m.glb'); const m = g.scene; sc.add(m); m.rotation.y = yaw;
        m.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
        const mixer = new T.AnimationMixer(m); const clip = g.animations.find(c => c.name === 'idle'); if (clip) { mixer.clipAction(clip).play(); mixer.setTime(1.0); }
        let meta = null; m.traverse(o => { if (o.userData && o.userData.mean) meta = o.userData; });
        let mm = null; m.traverse(o => { if (o.isSkinnedMesh && !/^(hair|acc|cloth)_/.test(o.name)) mm = o.material = nurseMaterial(o.material, meta.mean, meta); });
        dressNurse(m, mm, Object.assign({cap: meta.hasCap !== false}, dress || {}));
        if (dress && dress.debug) { const ob = mm.onBeforeCompile, k = dress.debug; mm.onBeforeCompile = sh => { ob(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
            '#include <dithering_fragment>\\n' + (k === 'w' ? 'gl_FragColor=vec4(vClsB.w,vClsA.w*.35,.15,1.);' : 'gl_FragColor=vec4(vClsA.w,vClsA.z,.15+vClsB.y,1.);')); }; mm.customProgramCacheKey = () => 'dbg' + k; mm.needsUpdate = true; }
        m.updateMatrixWorld(true);
        const vis = []; m.traverse(o => { if (o.isMesh && /^(hair|acc|cloth)_/.test(o.name) && o.visible) vis.push(o.name); });
        const f = frame || [0, 80, 0, 30];   // look-at x, y, z and visible height (cm)
        const cam = new T.PerspectiveCamera(24, 1, 1, 2000); const dist = f[3] / 2 / Math.tan(12 * Math.PI / 180);
        cam.position.set(f[0], f[1] + 2, f[2] + dist); cam.lookAt(f[0], f[1], f[2]); cam.updateProjectionMatrix();
        const cx = i % COLS, cy = ROWS - 1 - Math.floor(i / COLS);
        r.setViewport(cx * CELL, cy * CELL, CELL, CELL); r.setScissor(cx * CELL, cy * CELL, CELL, CELL); r.render(sc, cam);
        out.push(label + ': ' + vis.join(','));
      }
      return out }""", [SHOTS, COLS, CELL, ROWS])
    print('\n'.join(info))
    # labels
    pg.evaluate("""([SHOTS, COLS, CELL]) => { const c = document.getElementById('c'); const ov = document.createElement('div'); ov.style.cssText = 'position:absolute;left:0;top:0';
      SHOTS.forEach((s, i) => { const l = document.createElement('div'); l.textContent = s[2]; l.style.cssText = `position:absolute;left:${(i % COLS) * CELL + 8}px;top:${Math.floor(i / COLS) * CELL + 6}px;color:#fff;font:600 15px sans-serif;text-shadow:0 1px 2px #000`; ov.appendChild(l); });
      document.body.appendChild(ov); }""", [SHOTS, COLS, CELL])
    pg.screenshot(path=OUT)
    b.close()
