/* Accessories that fit this model: glasses, beard, scrub cap, hair pieces and the stethoscope.
   Every piece is a skinned mesh in the model's own centimeters on the body's skeleton (most ride the head), so the game's
   hair tuck (a vertex shader that presses the hair onto the skull) can act on pieces too. Pieces are fitted to the head's
   real surface: rays from in front of the face, from the side and from inside the head find where things sit.
   Hair pieces use their own strand texture (material 'hairpiece') with the hair class, so the Locker's hair color tints them;
   the scrub cap uses the scrubs' fabric with the top class. Numbers that depend on the character come from CFG. */
function buildAccessories(X) {
  const { T, root, mesh, geo, B, bIndex, pos, N, hairFlag, capFlag, skinFlag, isHead, log, CFG, mean, clsB } = X;
  const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), idx = geo.index.array, nrm = geo.attributes.normal;
  const sm = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t, D2R = Math.PI / 180;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const HEAD = bIndex.get(B('Head')), CHEST = bIndex.get(B('Spine2'));
  const t0 = performance.now();
  // smooth value noise in 0..1 (features about 1 unit)
  const hash = (x, y, z) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), s = t => t * t * (3 - 2 * t), u = s(x - xi), v = s(y - yi), w = s(z - zi); let r = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) r += hash(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w); return r; };

  // ---------- rays against the head (triangles with all three corners on the head) ----------
  const headTri = []; for (let f = 0; f < idx.length; f += 3) if (isHead[idx[f]] && isHead[idx[f + 1]] && isHead[idx[f + 2]]) headTri.push(f);
  const makeCaster = (tris, P) => {
    const n = tris.length, A = new Float32Array(n * 9), bb = new Float32Array(n * 6);
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const p = P(idx[tris[t] + k]); A[t * 9 + k * 3] = p[0]; A[t * 9 + k * 3 + 1] = p[1]; A[t * 9 + k * 3 + 2] = p[2]; }
    for (let t = 0; t < n; t++) for (let a = 0; a < 3; a++) { const v0 = A[t * 9 + a], v1 = A[t * 9 + 3 + a], v2 = A[t * 9 + 6 + a]; bb[t * 6 + a] = Math.min(v0, v1, v2) - 1e-3; bb[t * 6 + 3 + a] = Math.max(v0, v1, v2) + 1e-3; }
    // every hit along the ray, nearest first: {t, k (triangle number), u, v (barycentric)}
    return (o, d) => {
      const ox = o.x, oy = o.y, oz = o.z, dx = d.x || 1e-12, dy = d.y || 1e-12, dz = d.z || 1e-12, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, hits = [];
      for (let t = 0; t < n; t++) {
        const b = t * 6; let a0 = (bb[b] - ox) * ix, a1 = (bb[b + 3] - ox) * ix; if (a0 > a1) { const s = a0; a0 = a1; a1 = s; }
        let c0 = (bb[b + 1] - oy) * iy, c1 = (bb[b + 4] - oy) * iy; if (c0 > c1) { const s = c0; c0 = c1; c1 = s; }
        if (a0 > c1 || c0 > a1) continue; if (c0 > a0) a0 = c0; if (c1 < a1) a1 = c1;
        let e0 = (bb[b + 2] - oz) * iz, e1 = (bb[b + 5] - oz) * iz; if (e0 > e1) { const s = e0; e0 = e1; e1 = s; }
        if (a0 > e1 || e0 > a1) continue; if (e1 < a1) a1 = e1; if (a1 < 0) continue;
        const q = t * 9, ax = A[q], ay = A[q + 1], az = A[q + 2], p1x = A[q + 3] - ax, p1y = A[q + 4] - ay, p1z = A[q + 5] - az, p2x = A[q + 6] - ax, p2y = A[q + 7] - ay, p2z = A[q + 8] - az;
        const px = dy * p2z - dz * p2y, py = dz * p2x - dx * p2z, pz = dx * p2y - dy * p2x, det = p1x * px + p1y * py + p1z * pz;
        if (Math.abs(det) < 1e-12) continue; const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue; const qx = sy * p1z - sz * p1y, qy = sz * p1x - sx * p1z, qz = sx * p1y - sy * p1x, v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue; const tt = (p2x * qx + p2y * qy + p2z * qz) * inv; if (tt < 0) continue;
        hits.push({ t: tt, k: t, u, v });
      }
      return hits.sort((a, b) => a.t - b.t);
    };
  };
  const P0 = i => [pos.getX(i), pos.getY(i), pos.getZ(i)], cast = makeCaster(headTri, P0);
  const cnt = (F, f) => F[idx[f]] + F[idx[f + 1]] + F[idx[f + 2]];
  const info = (h, o, d) => { const f = headTri[h.k], n = V3();
    [[0, 1 - h.u - h.v], [1, h.u], [2, h.v]].forEach(([c, w]) => n.addScaledVector(V3().fromBufferAttribute(nrm, idx[f + c]), w));
    return { p: o.clone().addScaledVector(d, h.t), n: n.normalize(), t: h.t, hair: cnt(hairFlag, f) >= 2, skin: cnt(skinFlag, f) >= 2, cap: cnt(capFlag, f) > 0 }; };
  const first = (o, d) => { const hs = cast(o, d); return hs.length ? info(hs[0], o, d) : null; };
  const last = (o, d) => { const hs = cast(o, d); return hs.length ? info(hs[hs.length - 1], o, d) : null; };
  const faceZ = (x, y) => { const h = first(V3(x, y, 60), V3(0, 0, -1)); return h ? h.p.z : -1e9; };
  const dirAt = (phi, al) => V3(Math.sin(phi) * Math.cos(al), Math.sin(al), Math.cos(phi) * Math.cos(al));   // phi 0 = front, al = elevation

  // the game's hair tuck (nurse_mat.js NURSE_PIXIE), on the CPU, so pieces can sit on tucked hair
  const TK = CFG.tuck, NK = TK.neck;
  const tuck = (x, y, z, w, capOn) => {
    if (!(w > 0)) return [x, y, z];
    const ww = w * (CFG.capY == null || !capOn ? 1 : 1 - sm(CFG.capY - 6, CFG.capY - 1.5, y)), c = TK.c, r = TK.r;
    const ex = (x - c[0]) / r[0], ey = (y - c[1]) / r[1], ez = (z - c[2]) / r[2], rr = Math.max(Math.hypot(ex, ey, ez), 1e-4), f = (rr > 1 ? 1 + TK.k * (rr - 1) : rr) / rr;
    let tx = c[0] + (x - c[0]) * f; const ty = c[1] + (y - c[1]) * f; let tz = c[2] + (z - c[2]) * f;
    const s = lerp(1, NK.s, 1 - sm(NK.y - NK.h, NK.y, y)); tx = NK.a[0] + (tx - NK.a[0]) * s; tz = NK.a[1] + (tz - NK.a[1]) * s;
    return [x + (tx - x) * ww, y + (ty - y) * ww, z + (tz - z) * ww];
  };
  const tuckedCaster = capOn => { const tp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) tp.set(tuck(pos.getX(i), pos.getY(i), pos.getZ(i), clsB[i * 4 + 3], capOn), i * 3);
    return makeCaster(headTri, i => [tp[i * 3], tp[i * 3 + 1], tp[i * 3 + 2]]); };

  // ---------- materials ----------
  // strands for hair pieces: streaks along v (tiles both ways), every streak darker than the recolor's hair cutoff
  const strands = () => {
    const S = 256, rgb = mean.hair, L = .3 * rgb[0] + .59 * rgb[1] + .11 * rgb[2], top = Math.min(1.3, .36 / Math.max(.03, L));
    const col = k => 'rgb(' + rgb.map(v => Math.round(Math.min(1, v * k) * 255)).join(',') + ')';
    const cv = document.createElement('canvas'); cv.width = S * 3; cv.height = S; const g = cv.getContext('2d');
    const hv = document.createElement('canvas'); hv.width = S * 3; hv.height = S; const h = hv.getContext('2d');
    g.fillStyle = col(.78); g.fillRect(0, 0, S * 3, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S * 3, S);
    let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    g.filter = 'blur(1.1px)'; h.filter = 'blur(1.6px)'; g.lineCap = h.lineCap = 'butt';
    for (let i = 0; i < 110; i++) { const x = r() * S, w = 1.5 + r() * 6, k = .5 + r() * (top - .5), a = .3 + r() * .5, amp = r() * 3, ph = r() * 6.28, per = 1 + Math.floor(r() * 2);
      for (const ctx of [g, h]) { ctx.globalAlpha = a; ctx.strokeStyle = ctx === g ? col(k) : (k > .8 ? '#fff' : '#000'); ctx.lineWidth = w;
        for (const o of [0, S, 2 * S]) { ctx.beginPath(); for (let y = -4; y <= S + 4; y += 4) { const xx = o + x + amp * Math.sin(ph + y / S * 6.2832 * per); y < 0 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); } ctx.stroke(); } } }
    const crop = src => { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(src, S, 0, S, S, 0, 0, S, S); return c; };
    const map = crop(cv), hm = crop(hv).getContext('2d').getImageData(0, 0, S, S).data, nc = document.createElement('canvas'); nc.width = nc.height = S;
    const nx = nc.getContext('2d'), out = nx.createImageData(S, S), H = (x, y) => hm[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const gx = (H(x + 1, y) - H(x - 1, y)) * 2.2, gy = (H(x, y + 1) - H(x, y - 1)) * 1.2, l = Math.hypot(gx, gy, 1), o = (y * S + x) * 4;
      out.data[o] = (-gx / l * .5 + .5) * 255; out.data[o + 1] = (gy / l * .5 + .5) * 255; out.data[o + 2] = (1 / l * .5 + .5) * 255; out.data[o + 3] = 255; }
    nx.putImageData(out, 0, 0);
    const tex = c => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    const m = tex(map); m.encoding = T.sRGBEncoding; return { map: m, normalMap: tex(nc) };
  };
  const st = strands(), hairMat = new T.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: .55, metalness: 0, name: 'hairpiece' });
  const bodyMat = mesh.material;
  const accMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .15, name: 'accessory' });
  const lensMat = new T.MeshStandardMaterial({ color: '#e4f2ff', roughness: .06, metalness: .1, transparent: true, opacity: .2, side: T.DoubleSide, name: 'lens' });

  // ---------- piece helpers ----------
  const merge = list => T.BufferGeometryUtils.mergeBufferGeometries(list);
  const keep = (g, names) => { for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k); return g; };
  const classes = (g, cls, w = 0) => { const n = g.attributes.position.count, a = new Float32Array(n * 4), b = new Float32Array(n * 4), uv = g.attributes.uv;
    if (uv) for (let i = 0; i < n; i++) uv.setXY(i, Math.min(1, Math.max(0, uv.getX(i))), Math.min(1, Math.max(0, uv.getY(i))));   // in 0..1 so it packs into 16 bits
    for (let i = 0; i < n; i++) { a[i * 4 + (cls === 'top' ? 0 : 3)] = 1; b[i * 4 + 3] = typeof w === 'function' ? w(i) : w; }
    g.setAttribute('color', new T.BufferAttribute(a, 4)); g.setAttribute('color_1', new T.BufferAttribute(b, 4)); return g; };
  const paint = (g, hex) => { const c = new T.Color(hex).convertSRGBToLinear(), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
  const onHead = () => [[HEAD, 1]], onChest = () => [[CHEST, 1]];
  const hangs = (y0, y1) => (x, y) => { const k = sm(y1, y0, y); return k >= 1 ? [[HEAD, 1]] : k <= 0 ? [[CHEST, 1]] : [[HEAD, k], [CHEST, 1 - k]]; };
  const add = (g, mat, name, wfn = onHead) => {
    const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) wfn(p.getX(i), p.getY(i), p.getZ(i)).forEach(([b, w], j) => { si[i * 4 + j] = b; sw[i * 4 + j] = w; });
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = new T.SkinnedMesh(g, mat); m.name = name; m.castShadow = true; m.frustumCulled = false; root.add(m); m.bind(mesh.skeleton, mesh.bindMatrix);
    log.push(name + ' ' + (g.index ? g.index.count / 3 : n / 3) + ' triangles'); return m; };
  const outward = (g, inside) => { g.computeVertexNormals(); const p = g.attributes.position, nn = g.attributes.normal; let s = 0;   // flip the winding if most normals point at 'inside'
    for (let i = 0; i < p.count; i++) s += (p.getX(i) - inside.x) * nn.getX(i) + (p.getY(i) - inside.y) * nn.getY(i) + (p.getZ(i) - inside.z) * nn.getZ(i);
    if (s < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); } return g; };
  // a strand clump along a curve: width w(t) across 'side', thickness d(t) across the other way, lens-shaped section, pointed tip
  const clump = (pts, w, d, o = {}) => {
    // uv stays inside 0..1 (u0 picks where across the strands), so it packs small
    const segs = o.segs || 18, radial = o.radial || 10, curve = new T.CatmullRomCurve3(pts, false, 'centripetal'), L = curve.getLength(), P = [], UV = [], I = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs, c = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const sd = (typeof o.side === 'function' ? o.side(t, c) : (o.side || V3(1, 0, 0))).clone(); sd.addScaledVector(tg, -sd.dot(tg)).normalize();
      const nm = V3().crossVectors(sd, tg).normalize(), a1 = w(t), a2 = d(t);
      for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const p = c.clone().addScaledVector(sd, ca * a1).addScaledVector(nm, Math.sign(sa) * Math.pow(Math.abs(sa), .75) * a2);
        P.push(p.x, p.y, p.z); UV.push((o.u0 || 0) * (1 - (o.uSpan || .45)) + j / radial * (o.uSpan || .45), t * Math.min(1, L / (o.vLen || 10))); } }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
  const tubeAlong = (pts, r, closed = false, segs = 64, radial = 8) => keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts, closed, 'centripetal'), segs, r, radial, closed), ['position', 'normal']);
  const ball = (c, r, ws = 8, hs = 6) => keep(new T.SphereGeometry(r, ws, hs).translate(c.x, c.y, c.z), ['position', 'normal']);

  // ======================= glasses =======================
  { const G = CFG.glasses, frame = [], lenses = [], se = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), 2 / e);
    const lensAt = sd => { const ps = G.yaw, ux = V3(sd * Math.cos(ps), 0, -Math.sin(ps)), uy = V3(0, 1, 0), uz = V3(sd * Math.sin(ps), 0, Math.cos(ps)), ex = G.cx + sd * G.ex;
      const at = (z0, th, k = 1) => V3(ex, G.ey, z0).addScaledVector(ux, G.a * k * se(Math.cos(th), G.n)).addScaledVector(uy, G.b * k * se(Math.sin(th), G.n));
      // as close to the face as brow, cheeks and eye allow
      let z0 = faceZ(ex, G.ey) + G.eyeClr;
      for (const k of [1, .8, .55, .3]) for (let j = 0; j < 40; j++) { const p = at(0, j / 40 * Math.PI * 2, k), fz = faceZ(p.x, p.y); if (fz > -1e8) z0 = Math.max(z0, fz + G.clr * (k === 1 ? 1 : .8) - p.z); }
      return { ux, uy, uz, at: (th, k) => at(z0, th, k), c: V3(ex, G.ey, z0) }; };
    const L = { 1: lensAt(1), '-1': lensAt(-1) };
    for (const sd of [1, -1]) { const Ls = L[sd], M = 72, rim = [];
      for (let j = 0; j < M; j++) rim.push(Ls.at(j / M * Math.PI * 2, 1));
      frame.push(tubeAlong(rim, G.rim, true, 64, 6));
      // lens: a shallow dome just inside the rim
      const P = [Ls.c.clone().addScaledVector(Ls.uz, .12)], I = [];
      for (let j = 0; j < M; j++) { P.push(Ls.at(j / M * Math.PI * 2, .97)); I.push(0, 1 + j, 1 + (j + 1) % M); }
      const lg = new T.BufferGeometry().setFromPoints(P); lg.setIndex(I); lenses.push(outward(lg, Ls.c.clone().addScaledVector(Ls.uz, -3)));
      // hinge and arm: back from the outer top of the rim, hugging the side of the head, slipping into hair where hair covers it
      const hinge = Ls.at(G.hingeAt, 1).addScaledVector(Ls.ux, G.rim * .6), arm = [hinge.clone()];
      frame.push(ball(hinge, G.rim * 1.6, 8, 6));
      let ax = hinge.x * sd, y = hinge.y; const zs = []; for (let z = hinge.z - .5; z > G.armEnd; z -= .5) zs.push(z); zs.push(G.armEnd);
      zs.forEach((z, i) => { y = lerp(hinge.y, hinge.y + G.armRise, (i + 1) / zs.length);
        const h = first(V3(sd * 30, y, z), V3(-sd, 0, 0)), xs = h ? h.p.x * sd : 0;
        ax = h && !h.hair ? Math.max(ax + .05, xs + G.armClr) : ax + .12;   // over skin keep clear of it; inside hair just carry on
        arm.push(V3(sd * ax, y, z)); });
      for (let it = 0; it < 3; it++) for (let i = 1; i < arm.length - 1; i++) arm[i].x = (arm[i - 1].x + 2 * arm[i].x + arm[i + 1].x) / 4;
      frame.push(tubeAlong(arm, G.rim * .85, false, Math.ceil(arm.length * 1.5), 6), ball(arm[arm.length - 1], G.rim * .85, 6, 4)); }
    // bridge over the nose
    const a = L[1].at(Math.PI - G.bridgeAt, 1), b = L[-1].at(Math.PI - G.bridgeAt, 1), my = (a.y + b.y) / 2 + G.bridgeLift;
    const mid = V3(G.cx, my, Math.max(faceZ(G.cx, my) + G.bridgeClr, (a.z + b.z) / 2 + .3));
    frame.push(tubeAlong([a, a.clone().lerp(mid, .55).setY(my - .05), mid, b.clone().lerp(mid, .55).setY(my - .05), b], G.rim * .85, false, 24, 6));
    add(paint(merge(frame), G.color || '#262833'), accMat, 'acc_glasses');
    add(keep(merge(lenses.map(g => keep(g, ['position', 'normal']))), ['position', 'normal']), lensMat, 'acc_lens'); }

  // a shell over the head's surface: rays from inside (center c) on a grid of directions (phi, elevation); field(p) gives
  // m (cm inside the outline, < 0 outside) and t (thickness); the outline is cut smoothly where m crosses 0
  const shell = (c, phis, els, field, base, fade, uvOf) => {
    const nu = phis.length, nv = els.length, G = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const h = first(c, dirAt(phis[i], els[j]));
      if (!h) { G.push(null); continue; } const f = field(h.p, h);
      G.push({ p: h.p.clone().addScaledVector(h.n, base + f.t * sm(0, fade, f.m)), m: f.m, uv: uvOf(h.p, phis[i], els[j]) }); }
    const P = [], UV = [], I = [], vid = new Map(), cuts = new Map();
    const put = (p, uv) => { P.push(p.x, p.y, p.z); UV.push(uv[0], uv[1]); return P.length / 3 - 1; };
    const vOf = k => { if (!vid.has(k)) vid.set(k, put(G[k].p, G[k].uv)); return vid.get(k); };
    const cut = (a, b) => { const key = a < b ? a + '_' + b : b + '_' + a; if (!cuts.has(key)) { const A = G[a], Bq = G[b], s = A.m / (A.m - Bq.m);
      cuts.set(key, put(A.p.clone().lerp(Bq.p, s), [lerp(A.uv[0], Bq.uv[0], s), lerp(A.uv[1], Bq.uv[1], s)])); } return cuts.get(key); };
    const tri = ks => { if (ks.some(k => !G[k])) return; const n = ks.filter(k => G[k].m > 0).length; if (!n) return;
      if (n === 3) { I.push(vOf(ks[0]), vOf(ks[1]), vOf(ks[2])); return; }
      const poly = []; for (let e = 0; e < 3; e++) { const p = ks[e], q = ks[(e + 1) % 3]; if (G[p].m > 0) poly.push(vOf(p)); if ((G[p].m > 0) !== (G[q].m > 0)) poly.push(cut(p, q)); }
      for (let e = 1; e < poly.length - 1; e++) I.push(poly[0], poly[e], poly[e + 1]); };
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; tri([a, a + 1, a + nu + 1]); tri([a, a + nu + 1, a + nu]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    return outward(g, c); };
  const range = (a, b, step) => { const o = []; for (let v = a; v <= b + 1e-6; v += step) o.push(v * D2R); return o; };

  // ======================= beard: chin, jaw, mustache and sideburns, cut cleanly around the mouth =======================
  if (CFG.beard) { const Bd = CFG.beard, [my, max, may, smile] = Bd.mouth;
    const yTop = dx => { const t = Bd.top; if (dx <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (dx <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (dx - t[i - 1][0]) / (t[i][0] - t[i - 1][0])); return t[t.length - 1][1]; };
    const field = (p, h) => { const x = p.x - Bd.cx, dx = Math.abs(x);
      const dT = yTop(dx) - p.y, dM = (Math.hypot(x / max, (p.y - my - smile * x * x) / may) - 1) * may * 1.4;
      const dL = p.y - (Bd.low[0] + Math.max(0, dx - Bd.low[2]) * Bd.low[1]), dS = dx > Bd.side[0] ? (p.z - (Bd.side[1] + (p.y - Bd.side[2]) * Bd.side[3])) * .8 : 9;   // back edge: down the front of the ear to the jaw
      let t = lerp(Bd.t.cheek, Bd.t.chin, sm(Bd.ty[0], Bd.ty[1], p.y)) + Bd.t.chinBump * Math.exp(-(x * x / 9 + (p.y - Bd.ty[1]) ** 2 / 4));
      t = lerp(t, Bd.t.lip, (1 - sm(max - .6, max + 1.2, dx)) * sm(my + .2, my + .9, p.y));
      t = lerp(t, Bd.t.side, sm(Bd.side[0] - 1.8, Bd.side[0], dx)) * (.78 + .44 * noise(p.x * .8, p.y * .55, p.z * .8));   // clumpy, not a smooth mask
      return { m: Math.min(dT, dM, dL, dS, h.hair ? -.6 : 9), t }; };   // stops where the head's own hair starts (sideburns meet it)
    const g = shell(V3(...Bd.c), range(Bd.phi[0], Bd.phi[1], Bd.step), range(Bd.eps[0], Bd.eps[1], Bd.step * .75), field, Bd.base, Bd.fade,
      (p, ph) => [Math.min(1, Math.max(0, (ph / D2R + 90) / 180)), Math.min(1, Math.max(0, (84 - p.y) / 16))]);
    add(classes(g, 'hair'), hairMat, 'hair_beard'); }

  // uv inside an atlas patch [u0, u1, v0, v1], kept off its edges so smaller mip levels don't pick up the neighbors
  const inPatch = (P, u, v) => [lerp(P[0], P[1], .18 + .64 * u), lerp(P[2], P[3], .18 + .64 * v)];
  const fabric = (g, uvs) => { const n = g.attributes.position.count, a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const q = uvs(i); a[i * 2] = q[0]; a[i * 2 + 1] = q[1]; }
    g.setAttribute('uv', new T.BufferAttribute(a, 2)); return classes(g, 'top'); };

  // ======================= scrub cap: fitted over the tucked hair, a rolled band, a tie at the back =======================
  if (CFG.scrubCap) { const S = CFG.scrubCap, Cc = V3(...S.c), castT = tuckedCaster(true), NP = 56, NA = 40, a0 = -55 * D2R, a1 = 89.5 * D2R;
    const env = []; for (let i = 0; i < NP; i++) { const row = []; for (let j = 0; j <= NA; j++) { const hs = castT(Cc, dirAt(i / NP * Math.PI * 2, lerp(a0, a1, j / NA))); row.push(hs.length ? hs[hs.length - 1].t : 0); } env.push(row); }
    // smooth the envelope, never letting it sink below the hair (+ clear)
    let E = env.map(r => r.map(v => v + S.clear)); const K = [[0, 0, 4], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 1], [1, -1, 1], [-1, 1, 1], [-1, -1, 1]];
    for (let it = 0; it < S.smooth; it++) E = E.map((r, i) => r.map((_, j) => { let s = 0, w = 0; for (const [di, dj, k] of K) { const jj = j + dj; if (jj < 0 || jj > NA) continue; s += E[(i + di + NP) % NP][jj] * k; w += k; }
      return Math.max(s / w, env[i][j] + S.clear); }));
    const Rat = (i, al) => { const f = Math.max(0, Math.min(NA, (al - a0) / (a1 - a0) * NA)), j = Math.min(NA - 1, Math.floor(f)), t = f - j; return lerp(E[i][j], E[i][j + 1], t); };
    const edgeY = ph => S.edge[0] + S.edge[1] * Math.cos(ph) + S.edge[2] * Math.cos(2 * ph);
    const NS = 12, rows = [], ring = [];
    for (let i = 0; i < NP; i++) { const ph = i / NP * Math.PI * 2;
      let lo = a0, hi = a1; for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; (Cc.y + Math.sin(mid) * (Rat(i, mid) + S.puff[0]) < edgeY(ph)) ? lo = mid : hi = mid; }
      const col = []; for (let k = 0; k <= NS; k++) { const s = k / NS, al = lerp(lo, a1, Math.pow(s, .9));
        const r = Rat(i, al) + lerp(S.puff[0], S.puff[1], sm(0, .8, s)) + S.fold * (.5 + .5 * Math.sin(ph * S.foldN)) * sm(.35, 0, s);   // puffs up on top, gathered at the band
        col.push(Cc.clone().addScaledVector(dirAt(ph, al), r)); }
      rows.push(col); ring.push(Cc.clone().addScaledVector(dirAt(ph, lo), Rat(i, lo) + S.puff[0] + S.band * .55)); }
    const P = [], UV = [], I = [], top = V3(0, 0, 0); rows.forEach(c => top.add(c[NS])); top.multiplyScalar(1 / NP).y += .15;
    for (let i = 0; i < NP; i++) for (let k = 0; k <= NS; k++) { const p = rows[i][k]; P.push(p.x, p.y, p.z); UV.push(...inPatch(CFG.clothPatch, Math.abs(((i / NP) * 2 + 1) % 2 - 1), k / NS)); }
    const ap = P.length / 3; P.push(top.x, top.y, top.z); UV.push(...inPatch(CFG.clothPatch, .5, 1));
    for (let i = 0; i < NP; i++) { const i2 = (i + 1) % NP; for (let k = 0; k < NS; k++) { const a = i * (NS + 1) + k, b = i2 * (NS + 1) + k; I.push(a, b, a + 1, b, b + 1, a + 1); } I.push(i * (NS + 1) + NS, i2 * (NS + 1) + NS, ap); }
    const cap = new T.BufferGeometry(); cap.setAttribute('position', new T.Float32BufferAttribute(P, 3)); cap.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); cap.setIndex(I); outward(cap, Cc);
    classes(cap, 'top');
    const band = fabric(new T.TubeGeometry(new T.CatmullRomCurve3(ring, true, 'centripetal'), 96, S.band, 6, true), i => inPatch(CFG.clothPatch, (i % 7) / 6, .1));
    // the tie: a knot and two short tails at the back of the band
    const back = ring[NP >> 1], out = V3(0, -.15, -1).normalize(), tie = [ball(back.clone().addScaledVector(out, .45), .62, 10, 8)];
    for (const sd of [-1, 1]) tie.push(keep(clump([back.clone().addScaledVector(out, .5), back.clone().add(V3(sd * .9, -1.6, -.7)), back.clone().add(V3(sd * 1.5, -4.2, -.9))],
      t => .55 * (1 - .35 * t) * (t > .9 ? (1 - t) / .1 : 1) + .05, () => .13, { segs: 10, radial: 8, side: V3(1, 0, 0) }), ['position', 'normal']));
    const tieG = fabric(merge(tie), () => inPatch(CFG.clothPatch, .5, .5));
    add(merge([cap, keep(band, ['position', 'normal', 'uv', 'color', 'color_1']), tieG]), bodyMat, 'cloth_cap'); }

  // ======================= dome: fills the opening of a baked cap when the cap is hidden =======================
  let dome = null;
  if (CFG.capY != null) { const wpos = new Map(), edges = new Map(), weldId = X.weldId;
    for (let i = 0; i < N; i++) if (!wpos.has(weldId[i])) wpos.set(weldId[i], V3().fromBufferAttribute(pos, i));
    for (let f = 0; f < idx.length; f += 3) { if (!(capFlag[idx[f]] || capFlag[idx[f + 1]] || capFlag[idx[f + 2]])) continue;
      for (let e = 0; e < 3; e++) { const a = weldId[idx[f + e]], b = weldId[idx[f + (e + 1) % 3]], k = a < b ? a + '_' + b : b + '_' + a; edges.set(k, (edges.get(k) || 0) + 1); } }
    const nb = new Map(); for (const [k, c] of edges) if (c === 1) { const [a, b] = k.split('_').map(Number); (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
    const seen = new Set(); let best = [];
    for (const s0 of nb.keys()) { if (seen.has(s0)) continue; const loop = [s0]; seen.add(s0); let prev = -1, cur = s0;
      for (;;) { const nx = (nb.get(cur) || []).find(v => v !== prev && !seen.has(v)); if (nx === undefined) break; loop.push(nx); seen.add(nx); prev = cur; cur = nx; }
      if (loop.length > best.length) best = loop; }
    const ring0 = best.map(id => wpos.get(id)), c = ring0.reduce((a, p) => a.clone().add(p), V3()).multiplyScalar(1 / ring0.length), K = 7, H = 3.8, P = [], UV = [], I = [], n = ring0.length;
    const ring = ring0.map(b => { const o = b.clone().sub(c); o.y = 0; return b.clone().addScaledVector(o.normalize(), .15).add(V3(0, -.08, 0)); });   // overlaps the opening's edge a little (no light seam)
    for (let k = 0; k < K; k++) { const t = k / K, s = Math.cos(t * Math.PI / 2), h = Math.sin(t * Math.PI / 2) * H;
      for (const b of ring) { const p = V3(c.x + (b.x - c.x) * s, b.y + (c.y - b.y) * (1 - s) + h, c.z + (b.z - c.z) * s); P.push(p.x, p.y, p.z); UV.push(...inPatch(CFG.hairPatch, (p.x + 12) / 24, (p.z + 12) / 24)); } }
    const apex = P.length / 3; P.push(c.x, c.y + H, c.z); UV.push(...inPatch(CFG.hairPatch, (c.x + 12) / 24, (c.z + 12) / 24));
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n; I.push(a, b, a + n, b, b + n, a + n); }
    for (let i = 0; i < n; i++) I.push((K - 1) * n + i, (K - 1) * n + (i + 1) % n, apex);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); outward(g, c.clone().setY(c.y - 4));
    dome = g.clone(); add(classes(g, 'hair', 1), bodyMat, 'hair_dome');   // tucks with the hair around it (weight 1)
    log.push('cap opening ' + n + ' edges, center ' + c.toArray().map(v => v.toFixed(1)).join(',')); }

  // ======================= the body (torso only) for hair that falls onto the back =======================
  const si = geo.attributes.skinIndex, torsoBones = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder'].map(n => bIndex.get(B(n))));
  const torsoTri = []; for (let f = 0; f < idx.length; f += 3) { let ok = true; for (let k = 0; k < 3; k++) { const v = idx[f + k]; if (isHead[v] || !torsoBones.has(si.getX(v))) ok = false; } if (ok) torsoTri.push(f); }
  const castBody = makeCaster(torsoTri, P0);
  const radial = (castF, ax, az, y, ph) => { const o = V3(ax, y, az), hs = castF(o, V3(Math.sin(ph), 0, Math.cos(ph))); return hs.length ? hs[hs.length - 1].t : 0; };
  const headR = (ax, az, y, ph) => { const o = V3(ax, y, az), d = V3(Math.sin(ph), 0, Math.cos(ph)), h = last(o, d); return h ? { r: h.t, hair: h.hair } : { r: 0, hair: false }; };
  const at = (ax, az, y, ph, r) => V3(ax + Math.sin(ph) * r, y, az + Math.cos(ph) * r);

  // ======================= long hair: groups of strand clumps =======================
  // 'under' clumps root inside the hair and come out from under its edge; 'over' clumps lie on the hair from startY down;
  // below the hair they fall no closer than 'clear' to the back and shoulders; 'swing' (degrees) turns a group toward the front as it falls
  { const Lg = CFG.long, [ax, az] = Lg.axis, list = [];
    const hairBottom = (ph, y0) => { let yb = y0; for (let y = y0; y > 55; y -= .5) { const h = headR(ax, az, y, ph); if (h.r && h.hair) yb = y; else if (y < y0 - 3) break; } return yb; };
    for (const G of Lg.groups) for (let k = 0; k < G.n; k++) {
      const ph0 = lerp(G.phi[0], G.phi[1], (k + (G.off || 0) + .5) / G.n) * D2R + (rnd() - .5) * .05, dr = G.dr || 0, lift = G.lift || 0;
      const sideK = Math.pow(Math.abs(Math.sin(ph0)), 1.5), yTip = lerp(G.tipY[0], G.tipY[1], sideK) + (rnd() - .5) * 2.2, pts = [];
      let yb;
      if (G.mode === 'over') { const y0 = lerp(G.startY[0], G.startY[1], sideK) + (rnd() - .5); yb = hairBottom(ph0, y0); const rs = [];
        for (let y = y0; y > yb + .6; y -= 1.2) rs.push([y, headR(ax, az, y, ph0).r]);
        rs.forEach((q, i) => pts.push(at(ax, az, q[0], ph0, Math.max(q[1], ((rs[i - 1] || q)[1] + 2 * q[1] + (rs[i + 1] || q)[1]) / 4) + lift + dr)));   // over the lumps, never into them
      } else { yb = hairBottom(ph0, G.rootY);
        pts.push(at(ax, az, G.rootY, ph0, headR(ax, az, G.rootY, ph0).r - 1.6 + dr), at(ax, az, yb + 2, ph0, headR(ax, az, yb + 2, ph0).r - .35 + dr)); }
      let r = headR(ax, az, yb + .5, ph0).r - .15 + dr + lift;
      const phAt = y => ph0 + (G.swing || 0) * D2R * sm(yb, yTip, y);
      for (let y = yb - 1.5; y > yTip + 1; y -= 2.5) { const ph = phAt(y); r = Math.max(r - .35, radial(castBody, ax, az, y, ph) + Lg.clear + dr * .5); pts.push(at(ax, az, y, ph, r)); }
      pts.push(at(ax, az, yTip, phAt(yTip), Math.max(r - .4, radial(castBody, ax, az, yTip, phAt(yTip)) + Lg.clear * .8)));
      const W = lerp(G.w[0], G.w[1], rnd()), Dd = G.d * (.85 + rnd() * .3), tp = G.taper || .72;
      const prof = t => (t < .15 ? lerp(.5, 1, t / .15) : t > tp ? Math.pow(Math.max(0, (1 - t) / (1 - tp)), .8) : 1);
      const side = (t, c) => { const ph = Math.atan2(c.x - ax, c.z - az); return V3(Math.cos(ph), 0, -Math.sin(ph)); };
      const g = keep(clump(pts, t => W * prof(t) + .02, t => Dd * prof(t) + .02, { side, segs: 12, radial: 6, u0: rnd(), vLen: 9 }), ['position', 'normal', 'uv']), gp = g.attributes.position;
      // the part on the head tucks with the hair (under a scrub cap); what hangs below the hair doesn't
      g.setAttribute('tw', new T.Float32BufferAttribute(Array.from({ length: gp.count }, (_, i) => sm(yb - 1.5, yb + 1, gp.getY(i))), 1)); list.push(g); }
    const g = merge(list), tw = g.attributes.tw; classes(g, 'hair', i => tw.getX(i)); g.deleteAttribute('tw');
    add(g, hairMat, 'hair_long', hangs(Lg.headY[0], Lg.headY[1])); }

  // ======================= ponytail: a round bundle of clumps gathered in a scrunchie at the back of the head =======================
  { const Pn = CFG.pony, hb = last(V3(Pn.cx, Pn.y, 0), V3(0, 0, -1)), base = hb.p.clone().add(V3(0, 0, -Pn.out)), list = [], L = Pn.len;
    const axis = new T.CatmullRomCurve3([base.clone().add(V3(0, .2, .7)), base.clone().add(V3(0, -.6, -1.8)), base.clone().add(V3(0, -3.6, -3.6)), base.clone().add(V3(0, -L * .55, -3.7)),
      base.clone().add(V3(0, -L * .85, -3.1)), base.clone().add(V3(0, -L, -2.5))], false, 'centripetal');
    const X1 = V3(1, 0, 0), spread = s => (s < .3 ? lerp(.45, 1.35, sm(0, .3, s)) : lerp(1.35, .3, sm(.3, 1, s)));
    for (let k = 0; k < Pn.n; k++) { const a = k / Pn.n * Math.PI * 2 + (rnd() - .5) * .5, len = .82 + rnd() * .18, pts = [], sides = [];
      for (let i = 0; i <= 8; i++) { const s = i / 8 * len, c = axis.getPointAt(s), A = axis.getTangentAt(s), e2 = V3().crossVectors(A, X1).normalize();
        pts.push(c.clone().addScaledVector(X1, Math.cos(a) * spread(s)).addScaledVector(e2, Math.sin(a) * spread(s))); }
      const W = lerp(Pn.w[0], Pn.w[1], rnd()), Dd = Pn.d * (.85 + rnd() * .3), prof = t => (t < .1 ? lerp(.6, 1, t / .1) : t > .6 ? Math.pow(Math.max(0, (1 - t) / .4), .85) : 1);
      const side = (t, c) => { const s = axis.getUtoTmapping(0, 0) * 0 + Math.min(1, t * len), A = axis.getTangentAt(s), e2 = V3().crossVectors(A, X1).normalize(); return X1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a)); };
      list.push(keep(clump(pts, t => W * prof(t) + .02, t => Dd * prof(t) + .02, { side, segs: 16, radial: 7, u0: rnd(), vLen: 8 }), ['position', 'normal', 'uv'])); }
    add(classes(merge(list), 'hair'), hairMat, 'hair_pony');
    const A0 = axis.getTangentAt(.06), tie = new T.TorusGeometry(Pn.tieR, Pn.tieR * .45, 8, 22), q = new T.Quaternion().setFromUnitVectors(V3(0, 0, 1), A0);
    tie.applyQuaternion(q); const tc = axis.getPointAt(.06); tie.translate(tc.x, tc.y, tc.z);
    add(paint(keep(tie, ['position', 'normal']), Pn.tieColor), accMat, 'acc_tie'); }

  // ======================= bun: a coiled knot of hair on the head =======================
  { const Bn = CFG.bun, Cb = V3(...TK.c), dd = dirAt(Math.PI, Bn.el * D2R), hb = last(Cb, dd), up = hb.p.clone().sub(Cb).normalize(), c = hb.p.clone().addScaledVector(up, -Bn.r * Bn.sink);
    const u = V3().crossVectors(up, V3(0, 1, 0)).normalize(), v = V3().crossVectors(up, u).normalize(), pts = [], M = Math.round(Bn.turns * 26);
    for (let i = 0; i <= M; i++) { const t = i / M, th = t * Bn.turns * Math.PI * 2, rho = Bn.r * (1 - .78 * t), h = Bn.h * (1 - Math.pow(1 - t, 2.2));
      pts.push(c.clone().addScaledVector(u, rho * Math.cos(th)).addScaledVector(v, rho * Math.sin(th)).addScaledVector(up, h)); }
    const coil = clump(pts, t => Bn.tube * (1 - .4 * t) * (t > .96 ? Math.max(.15, (1 - t) / .04) : 1), t => Bn.tube * .85 * (1 - .4 * t), { side: up, segs: M, radial: 8, vLen: 6, uSpan: .35 });
    const knot = keep(new T.SphereGeometry(Bn.r * .42, 10, 8), ['position', 'normal', 'uv']).translate(0, 0, 0);
    knot.applyMatrix4(new T.Matrix4().makeBasis(u, v, up).setPosition(c.clone().addScaledVector(up, Bn.h * .62)));
    add(classes(merge([keep(coil, ['position', 'normal', 'uv']), knot]), 'hair'), hairMat, 'hair_bun'); }

  // ======================= curls: puffs of hair over the head (on tucked hair when the cut is pressed down) =======================
  { const Cu = CFG.curly, cc = V3(...TK.c), castC = Cu.tuck ? tuckedCaster(false) : cast, cand = [], low = [], high = [];
    const edgeY = CFG.scrubCap ? (ph => CFG.scrubCap.edge[0] + CFG.scrubCap.edge[1] * Math.cos(ph) + CFG.scrubCap.edge[2] * Math.cos(2 * ph)) : null;
    for (let j = 0; j < 46; j++) for (let i = 0; i < 90; i++) { const ph = i / 90 * Math.PI * 2, al = lerp(Cu.el[0], Cu.el[1], j / 45) * D2R, d = dirAt(ph, al), hs = castC(cc, d); if (!hs.length) continue;
      const h = hs[hs.length - 1], f = headTri[h.k]; if (cnt(hairFlag, f) < 2 && !(Cu.onCap && cnt(capFlag, f))) continue;
      const w = (clsB[idx[f] * 4 + 3] + clsB[idx[f + 1] * 4 + 3] + clsB[idx[f + 2] * 4 + 3]) / 3, p = cc.clone().addScaledVector(d, h.t);
      if (p.y < Cu.minY || w < .35) continue; cand.push({ p, n: d, w, ph, cap: cnt(capFlag, f) > 0 }); }
    if (dome) { const dp = dome.attributes.position, dn = dome.attributes.normal; for (let i = 0; i < dp.count; i += 2) cand.push({ p: V3().fromBufferAttribute(dp, i), n: V3().fromBufferAttribute(dn, i), w: 1, ph: 0, cap: true }); }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const kept = []; for (const q of cand) { const r = (q.w < .6 ? Cu.r[0] * .75 : lerp(Cu.r[0], Cu.r[1], rnd())); if (kept.every(k => k.p.distanceTo(q.p) > (k.r + r) * Cu.space)) kept.push(Object.assign(q, { r })); }
    for (const q of kept) { const g = new T.SphereGeometry(q.r, 8, 5), uv = g.attributes.uv, tw = rnd() * 2 + 1;
      for (let i = 0; i < uv.count; i++) uv.setX(i, Math.min(1, (uv.getX(i) * .5 + uv.getY(i) * tw * .5) / (.5 + tw * .5)));   // strands spiral into the puff's crown: reads as a curl
      g.scale(1, Cu.squash, 1).applyMatrix4(new T.Matrix4().makeBasis(...(() => { const y = q.n.clone().normalize(), x = V3().crossVectors(y, V3(.3, .1, 1)).normalize(); return [x, y, V3().crossVectors(x, y)]; })())
        .setPosition(q.p.clone().addScaledVector(q.n, q.r * Cu.lift)));
      const top = q.cap || (edgeY && q.p.y > edgeY(q.ph) - .5); (top ? high : low).push(keep(g, ['position', 'normal', 'uv'])); }
    if (low.length) add(classes(merge(low), 'hair'), hairMat, 'hair_curly'); if (high.length) add(classes(merge(high), 'hair'), hairMat, 'hair_curlytop');
    log.push('curls ' + low.length + ' + ' + high.length + ' on top'); }

  // ======================= stethoscope around the neck, kept a centimeter off the body =======================
  { const body = []; for (let i = 0; i < N; i++) if (!isHead[i]) body.push(V3().fromBufferAttribute(pos, i));
    const clear = (p, d0) => { for (let it = 0; it < 10; it++) { let best = null, bd = 1e9; for (const q of body) { const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = q; } }
        bd = Math.sqrt(bd); if (bd >= d0) break; p.add(p.clone().sub(best).normalize().multiplyScalar(d0 - bd + .05)); } return p; };
    const half = CFG.steth.map(q => V3(...q)), path = half.concat(half.slice(0, -1).reverse().map(q => V3(-q.x, q.y, q.z))).map(p => clear(p, 1.05));
    const place = (g, p, e) => g.applyMatrix4(new T.Matrix4().compose(p, new T.Quaternion().setFromEuler(new T.Euler(...e)), V3(1, 1, 1)));
    const tubeG = paint(tubeAlong(path, .42, false, 60, 8), '#2e3442'), end = path[path.length - 1], s = path[0];
    const bell = paint(place(keep(new T.CylinderGeometry(1.45, 1.45, .75, 20), ['position', 'normal']), V3(end.x + .1, end.y - 1.3, end.z + .45), [Math.PI / 2 - .25, 0, 0]), '#c9ced8');
    const rim = paint(place(keep(new T.TorusGeometry(1.45, .22, 6, 20), ['position', 'normal']), V3(end.x + .1, end.y - 1.3, end.z + .85), [-.25, 0, 0]), '#8e95a3');
    const tips = [-1, 1].map(k => paint(ball(V3(s.x + k * .75, s.y - .9, s.z + .25), .55, 10, 8), '#8e95a3'));
    add(merge([tubeG, bell, rim, ...tips]), accMat, 'acc_steth', onChest); }

  log.push('accessories built in ' + Math.round(performance.now() - t0) + ' ms');
}
