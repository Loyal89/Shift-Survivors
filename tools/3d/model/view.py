"""Render a character GLB in a row of poses: python3 view.py THREE_PACKAGE_DIR model.glb out.png ['[["idle",1,0],["walk",.5,1.57],["bones",0,0]]']
   Each shot is [clip or "bones", time, turn, close-up?, {scrub, skin, hair}]."""
import sys, os, base64
from playwright.sync_api import sync_playwright
import json
PKG, GLB, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SHOTS = json.loads(sys.argv[4]) if len(sys.argv)>4 else [['idle', 1.0, 0], ['idle', 1.0, 0.9], ['walk', .2, 0.9], ['walk', .55, 0.9], ['walk', .85, -1.2]]
LIBS = ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js']
html = '<!doctype html><html><body style="margin:0;background:#1b2440">' + ''.join(f'<script src="http://local/lib/{l}"></script>' for l in LIBS) + '<script>var T = THREE;</script><script src="http://local/nmat.js"></script><canvas id="c" width="1200" height="500"></canvas></body></html>'
def route(r, q):
    u = q.url
    if u.startswith('http://local/lib/'): r.fulfill(path=os.path.join(PKG, u[len('http://local/lib/'):]), headers={'content-type': 'text/javascript'})
    elif u == 'http://local/m.glb': r.fulfill(path=GLB)
    elif u == 'http://local/nmat.js': r.fulfill(path=os.environ.get('NMAT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nurse_mat.js')), headers={'content-type': 'text/javascript'})
    elif u == 'http://local/': r.fulfill(body=html, headers={'content-type': 'text/html'})
    else: r.fulfill(status=404, body='')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1200, 'height': 500}); pg.route('http://local/**', route)
    pg.on('pageerror', lambda e: print('pageerror', e)); pg.on('console', lambda m: print('console', m.text[:200]) if m.type == 'error' else None)
    pg.goto('http://local/')
    info = pg.evaluate("""async (SHOTS) => {
      const T = THREE, g = await new T.GLTFLoader().loadAsync('http://local/m.glb');
      const r = new T.WebGLRenderer({canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true}); r.outputEncoding = T.sRGBEncoding; r.setClearColor('#1b2440');
      const shots = SHOTS;
      const W = Math.floor(1200 / SHOTS.length); r.setScissorTest(true);
      const clips = g.animations.map(a => a.name + ' ' + a.duration.toFixed(2) + 's ' + a.tracks.length + ' tracks');
      for (let i = 0; i < shots.length; i++) {
        const [name, t, yaw] = shots[i];
        const sc = new T.Scene(); sc.add(new T.HemisphereLight('#ffffff', '#445', 1.1)); const d = new T.DirectionalLight('#fff', .9); d.position.set(1, 2, 3); sc.add(d);
        const g2 = await new T.GLTFLoader().loadAsync('http://local/m.glb'); const m = g2.scene; sc.add(m); m.rotation.y = yaw;
        m.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });   // quantized meshes carry a tiny bounding sphere
        if (name === 'bones') { m.traverse(o => { if (o.isSkinnedMesh) { const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, col = new Float32Array(n * 3);
            const pal = k => { const h = (k * 0.6180339) % 1; return new T.Color().setHSL(h, .75, .5); };
            for (let i = 0; i < n; i++) { const c = new T.Color(0, 0, 0); for (let j = 0; j < 4; j++) { const gx = ['getX','getY','getZ','getW'][j], w = sw[gx](i); if (w > 0) c.add(pal(si[gx](i)).multiplyScalar(w)); } col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
            g.setAttribute('color', new T.BufferAttribute(col, 3)); o.material = new T.MeshBasicMaterial({ vertexColors: true }); } }); }
        else { const mixer = new T.AnimationMixer(m); const a = mixer.clipAction(g2.animations.find(c => c.name === name)); a.play(); mixer.setTime(t); }
        const zoom = SHOTS[i][3] || 0, tint = SHOTS[i][4];
        if (name !== 'bones' && typeof nurseMaterial === 'function') { let meta = null; m.traverse(o => { if (o.userData && o.userData.mean) meta = o.userData; });
          m.traverse(o => { if (o.isSkinnedMesh) { o.material = nurseMaterial(o.material, meta.mean); tintNurse(o.material, tint || {}); } }); }
        const cam = new T.PerspectiveCamera(30, W / 500, 1, 1000); if (zoom) { cam.position.set(0, 64, 110); cam.lookAt(0, 64, 0); cam.fov = 26; cam.aspect = W / 500; cam.updateProjectionMatrix(); } else { cam.position.set(0, 55, 260); cam.lookAt(0, 50, 0); }
        r.setViewport(i * W, 0, W, 500); r.setScissor(i * W, 0, W, 500); r.render(sc, cam);
      }
      return clips }""", SHOTS)
    print(info)
    pg.screenshot(path=OUT)
    b.close()
