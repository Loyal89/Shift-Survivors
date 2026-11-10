import sys, os, json, base64
from playwright.sync_api import sync_playwright
PKG, RIG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; files = sys.argv[4:]
LIBS = ['build/three.min.js', 'examples/js/libs/fflate.min.js', 'examples/js/curves/NURBSUtils.js', 'examples/js/curves/NURBSCurve.js',
        'examples/js/loaders/FBXLoader.js', 'examples/js/utils/BufferGeometryUtils.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/exporters/GLTFExporter.js']
CFG = os.environ.get('RIG_CFG')   # optional settings file for a character other than the female nurse
html = '<!doctype html><html><body>' + ''.join(f'<script src="http://local/lib/{l}"></script>' for l in LIBS) + ('<script src="http://local/cfg.js"></script>' if CFG else '') + '<script src="http://local/rig.js"></script><script src="http://local/acc.js"></script></body></html>'
def route(r, q):
    u = q.url
    if u.startswith('http://local/lib/'): r.fulfill(path=os.path.join(PKG, u[len('http://local/lib/'):]), headers={'content-type': 'text/javascript'})
    elif u == 'http://local/rig.js': r.fulfill(path=RIG, headers={'content-type': 'text/javascript'})
    elif u == 'http://local/acc.js': r.fulfill(path=os.path.join(os.path.dirname(os.path.abspath(RIG)), 'acc.js'), headers={'content-type': 'text/javascript'})
    elif u == 'http://local/cfg.js' and CFG: r.fulfill(path=CFG, headers={'content-type': 'text/javascript'})
    elif u.startswith('http://local/file/'): r.fulfill(path=files[int(u.split('/')[-1])])
    elif u == 'http://local/': r.fulfill(body=html, headers={'content-type': 'text/html'})
    else: r.fulfill(status=404, body='')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.route('http://local/**', route)
    pg.on('console', lambda m: print('  [console]', m.text[:200]) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: print('  [pageerror]', e))
    pg.goto('http://local/')
    res = pg.evaluate('buildNurse()')
    open(OUT, 'wb').write(base64.b64decode(res['glb']))
    print('\n'.join(res['log'])); print('written', OUT, os.path.getsize(OUT), 'height', res['height'], 'walk speed', res['walkSpeed'])
    b.close()
