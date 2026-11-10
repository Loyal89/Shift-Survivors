/* Runs in a headless page with three.js r147: skins the Tripo nurse to the Mixamo skeleton, turns the
   Mixamo clips into an in-place idle and an in-place walking loop, and exports one GLB.
   Numbers that depend on the character (head size, eyes, hem, where the hair pieces sit) come from a settings
   object: the female nurse below, or window.RIG_CFG from a settings file loaded first (see cfg_m.js). */
const CFG_F = {
  head: { blueY: 72, minY: 65.5, ax: 16, axLow: 13.5, axLowY: 70, r: 25, skinAx: 12, neck: [65, 70] },
  eye: { z: 6, ax: 7, y0: 70, y1: 81 }, chin: { y1: 72.5, z: -1, ax: 7.5 },
  capY: 89.5, hemY: 41.8, shoeY: 10.5, cross: { y0: 50, y1: 66, z: 3 }, arm: { x: 10, y: 61, shoulderY: 62 }, upperY: 50,
  hairPatch: [.6231, .6738, .8770, .9277], clothPatch: null, pixie: { c: [0, 82, -1], s: .74, y: 77 },
  bun: { sphere: [4.7, 0, 87.6, -13.4, 1, .93, .82], torus: [3.7, 1.35, 0, 87.6, -12.1, 0], },
  pony: { pts: [[0, 86.6, -12.2], [0, 85.4, -15.2], [0, 81, -17.3], [0, 75, -17.9], [0, 69.2, -17.1], [0, 64.4, -15.6]], w: [3.0, .7, 1.9], d: [2.7, .6, 1.4], tie: [0, 85.6, -14.6, -1.05] },
  long: { pts: [[0, 79, -9.6], [0, 72.5, -11.2], [0, 66, -10.7], [0, 59.5, -10.0], [0, 53.5, -9.7]], w: [13.4, 3.6], d: [3.6, 1.4] },
  curly: { center: [0, 81, -.5], minY: 70.5 },
  glasses: { eye: [4.4, 79.1, 10.75], r: 2.6, temple: [[7, 79.4, 10.3], [9.3, 79.6, 7.6], [10.9, 79.7, 2.4]], bridge: [[1.85, 79.7, 10.85], [0, 80.25, 11.55]] },
  steth: [[-3.4, 57.6, 9.3], [-4.1, 61.8, 8.6], [-4.9, 65.6, 6.6], [-5.6, 68.6, 2.6], [-4.4, 70.3, -2.6], [0, 70.6, -5.0]],
  beard: null, scrubCap: null };
async function buildNurse() {
  const T = THREE, log = [], CFG = window.RIG_CFG || CFG_F;
  const gltf = await new T.GLTFLoader().loadAsync('http://local/file/0');
  let src = null; gltf.scene.traverse(n => { if (n.isMesh && !src) src = n; });
  const geo = src.geometry.clone(), m0 = [].concat(src.material)[0];
  // the raw mesh is already Y-up; make it face +Z like the Mixamo rig (toes forward)
  const pos = geo.attributes.position, N = pos.count;
  let toeZ = 0, toeN = 0; for (let i = 0; i < N; i++) if (pos.getY(i) < 3) { toeZ += pos.getZ(i); toeN++; }
  if (toeN && toeZ / toeN < 0) { geo.rotateY(Math.PI); log.push('turned to face +Z'); }
  geo.computeBoundingBox(); log.push('mesh box ' + JSON.stringify(geo.boundingBox));

  const idleFbx = await new T.FBXLoader().loadAsync('http://local/file/1');
  const walkFbx = await new T.FBXLoader().loadAsync('http://local/file/2');
  const root = idleFbx; root.updateMatrixWorld(true);
  const bones = []; root.traverse(n => { if (n.isBone) bones.push(n); });
  const B = name => bones.find(b => b.name === 'mixamorig' + name);
  const P = name => { const b = B(name); return b ? new T.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };

  // bone segments used for weighting; fingers follow the hand
  const segs = [];
  const seg = (bone, a, b, side) => { const A = P(a), Bp = typeof b === 'string' ? P(b) : b; if (A && Bp) segs.push({ bone: B(bone), a: A, b: Bp, side }); };
  seg('Hips', 'Hips', 'Spine', 0); seg('Spine', 'Spine', 'Spine1', 0); seg('Spine1', 'Spine1', 'Spine2', 0); seg('Spine2', 'Spine2', 'Neck', 0);
  seg('Neck', 'Neck', 'Head', 0); seg('Head', 'Head', 'HeadTop_End', 0);
  for (const [S, sd] of [['Left', 1], ['Right', -1]]) {
    seg(S + 'Shoulder', S + 'Shoulder', S + 'Arm', sd); seg(S + 'Arm', S + 'Arm', S + 'ForeArm', sd); seg(S + 'ForeArm', S + 'ForeArm', S + 'Hand', sd);
    const h = P(S + 'Hand'); seg(S + 'Hand', S + 'Hand', h.clone().add(new T.Vector3(sd * 12, 0, 0)), sd);
    seg(S + 'UpLeg', S + 'UpLeg', S + 'Leg', sd); seg(S + 'Leg', S + 'Leg', S + 'Foot', sd); seg(S + 'Foot', S + 'Foot', S + 'ToeBase', sd); seg(S + 'ToeBase', S + 'ToeBase', S + 'Toe_End', sd);
  }
  const headSeg = segs.find(s => s.bone === B('Head')), headC = headSeg.a.clone().lerp(headSeg.b, .45);
  const tmp = new T.Vector3(), ab = new T.Vector3(), ap = new T.Vector3();
  // distance to a bone, with running past either end of the bone counting 3x (keeps thick sleeves and hems on their own bone)
  const pd = (p, s) => { ab.subVectors(s.b, s.a); ap.subVectors(p, s.a); const L2 = ab.lengthSq(), t = ap.dot(ab) / L2;
    const perp = tmp.copy(s.a).addScaledVector(ab, t).distanceTo(p), ax = (t < 0 ? -t : t > 1 ? t - 1 : 0) * Math.sqrt(L2); return Math.hypot(perp, 3 * ax); };
  const sm = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const bIndex = new Map(bones.map((b, i) => [b, i]));
  const SG = n => segs.find(s => s.bone === B(n));
  const torsoSegs = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'].map(SG).filter(Boolean);
  const armSegs = sd => ['Shoulder', 'Arm', 'ForeArm', 'Hand'].map(n => SG((sd > 0 ? 'Left' : 'Right') + n));
  const legSegs = sd => ['UpLeg', 'Leg', 'Foot', 'ToeBase'].map(n => SG((sd > 0 ? 'Left' : 'Right') + n));
  // the texture tells hair, cap, face and skin apart from the scrubs
  const img = m0.map.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx2 = cv.getContext('2d'); cx2.drawImage(img, 0, 0); const px = cx2.getImageData(0, 0, cv.width, cv.height).data, uv = geo.attributes.uv;
  const colorAt = i => { let u = uv.getX(i) % 1, v = uv.getY(i) % 1; if (u < 0) u++; if (v < 0) v++;
    const o = ((Math.min(cv.height - 1, v * cv.height | 0)) * cv.width + Math.min(cv.width - 1, u * cv.width | 0)) * 4; return [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255]; };
  const invW = list => { const w = list.map(([b, d]) => [b, 1 / Math.pow(d + .6, 4)]); return w; };
  const near = (p, list, n) => invW(list.map(s => [s.bone, pd(p, s)]).sort((a, b) => a[1] - b[1]).slice(0, n));
  const hairFlag = new Uint8Array(N), capFlag = new Uint8Array(N), skinFlag = new Uint8Array(N), V3c = i => new T.Vector3().fromBufferAttribute(pos, i); const W = new Array(N), isHead = new Uint8Array(N), p = new T.Vector3(), counts = {}, clsA = new Float32Array(N * 4), clsB = new Float32Array(N * 4), sums = { scrub: [], skin: [], hair: [], shoes: [] };
  const addTo = (m, list, f) => { const tot = list.reduce((s, c) => s + c[1], 0) || 1; for (const [b, w] of list) { const k = bIndex.get(b); m.set(k, (m.get(k) || 0) + f * w / tot); } };
  for (let i = 0; i < N; i++) {
    p.fromBufferAttribute(pos, i); const [r, g, b] = colorAt(i), lum = .3 * r + .59 * g + .11 * b, ax = Math.abs(p.x), sd = p.x >= 0 ? 1 : -1;
    const blue = b > r + .12, white = r > .72 && g > .72 && b > .72 && Math.abs(r - b) < .12, skin = r > .55 && r > b + .1 && !white && lum >= .3;
    const m = new Map(); W[i] = m;
    // recolor classes for the Locker: scrubs (blue or dark-blue cloth), skin, hair (not the eyes)
    const H = CFG.head, headish = (!blue || p.y > H.blueY) && p.y > H.minY && ax < H.ax && (ax < H.axLow || p.y > H.axLowY) && p.distanceTo(headC) < H.r && (!skin || ax < H.skinAx);
    const dark = lum < .3 && !blue, eye = p.z > CFG.eye.z && ax < CFG.eye.ax && p.y < CFG.eye.y1 && p.y > CFG.eye.y0;
    const chin = p.y < CFG.chin.y1 && p.z > CFG.chin.z && ax < CFG.chin.ax;
    const hairish = dark || (r < .62 && r > g && g > b);
    const cap = CFG.capY != null && headish && p.y > CFG.capY && !hairish;
    const hairC = headish && !cap && !white && !blue && !eye && !chin && hairish;
    const cloth = !headish && (blue || (dark && b >= r)), shoe = p.y < CFG.shoeY && (white || (lum > .55 && Math.abs(r - b) < .15)) && !headish;
    const cross = !headish && white && p.y > CFG.cross.y0 && p.y < CFG.cross.y1 && p.z > CFG.cross.z;
    const c4 = i * 4, v = [r, g, b, lum];
    if (cloth) { clsA[c4 + (p.y > CFG.hemY ? 0 : 1)] = 1; sums.scrub.push(v); }
    else if (skin && p.y > CFG.shoeY) { clsA[c4 + 2] = 1; sums.skin.push(v); }
    else if (hairC) { clsA[c4 + 3] = 1; sums.hair.push(v); }
    if (shoe) { clsB[c4] = 1; sums.shoes.push(v); }
    if (cap) clsB[c4 + 1] = 1;
    if (cross) clsB[c4 + 2] = 1;
    hairFlag[i] = hairC ? 1 : 0; capFlag[i] = cap ? 1 : 0; skinFlag[i] = skin ? 1 : 0;
    if (headish) {
      // hair, cap, face and ears ride on the head; the neck skin blends down into the neck
      const k = skin ? sm(H.neck[0], H.neck[1], p.y) : 1; m.set(bIndex.get(B('Head')), k); if (k < 1) m.set(bIndex.get(B('Neck')), 1 - k); isHead[i] = 1; continue;
    }
    const torso = torsoSegs.concat(p.y > CFG.arm.shoulderY ? [armSegs(sd)[0]] : []);
    if (p.y > CFG.upperY) {
      // upper body: arms start past the armpit line, the rest follows the spine
      const mArm = sm(-1.5, 1.5, ax - CFG.arm.x + (p.y - CFG.arm.y) * .5);
      if (mArm > 0) addTo(m, near(p, armSegs(sd), 3), mArm);
      if (mArm < 1) addTo(m, near(p, torso, 3), 1 - mArm);
    } else {
      const legs = ax < 1.5 ? legSegs(1).concat(legSegs(-1)) : legSegs(sd);
      addTo(m, near(p, legs.concat(torsoSegs.slice(0, 2)), 3), 1);
    }
  }
  // smooth the weights a little over the surface (UV seams welded by position), never across head and body
  const key = i => Math.round(pos.getX(i) * 50) + ',' + Math.round(pos.getY(i) * 50) + ',' + Math.round(pos.getZ(i) * 50);
  const weldId = new Int32Array(N), ids = new Map(); for (let i = 0; i < N; i++) { const k = key(i); if (!ids.has(k)) ids.set(k, ids.size); weldId[i] = ids.get(k); }
  const nb = Array.from({ length: ids.size }, () => new Set()), idx = geo.index.array;
  for (let f = 0; f < idx.length; f += 3) for (let e = 0; e < 3; e++) { const a = idx[f + e], c = idx[f + (e + 1) % 3]; if (isHead[a] === isHead[c]) { nb[weldId[a]].add(c); nb[weldId[c]].add(a); } }
  for (let it = 0; it < 3; it++) {
    const next = new Array(N);
    for (let i = 0; i < N; i++) { const n = nb[weldId[i]]; if (!n.size || isHead[i]) { next[i] = W[i]; continue; }
      const m = new Map(); for (const [k, w] of W[i]) m.set(k, w * .5); const f = .5 / n.size; for (const j of n) for (const [k, w] of W[j]) m.set(k, (m.get(k) || 0) + w * f); next[i] = m; }
    for (let i = 0; i < N; i++) W[i] = next[i];
  }
  const si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const top = [...W[i]].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, c) => s + c[1], 0) || 1;
    top.forEach(([k, w], j) => { si[i * 4 + j] = k; sw[i * 4 + j] = w / tot; });
    const nm = bones[top[0][0]].name.replace('mixamorig', ''); counts[nm] = (counts[nm] || 0) + 1;
  }
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  log.push('vertices per main bone ' + JSON.stringify(counts));
  geo.setAttribute('color', new T.Float32BufferAttribute(clsA, 4));     // top, pants, skin, hair
  // the short cut leaves the hairline at the face and at the cap opening where they are, so the face and the dome still meet the hair
  { const face = [], capV = []; for (let i = 0; i < N; i++) { if (isHead[i] && !hairFlag[i] && !capFlag[i]) face.push(V3c(i)); if (capFlag[i]) capV.push(V3c(i)); }
    const near = (list, q) => { let d = 1e9; for (const f of list) { const e = f.distanceToSquared(q); if (e < d) d = e; } return Math.sqrt(d); };
    for (let i = 0; i < N; i++) if (hairFlag[i]) { const q = V3c(i); clsB[i * 4 + 3] = sm(1.2, 5.5, near(face, q)) * sm(1.5, 6, near(capV, q)); } }
  geo.setAttribute('color_1', new T.Float32BufferAttribute(clsB, 4));   // shoes, cap, pocket cross, short-cut weight
  // reference = the lit half of each class (a flat Locker color reads as the lit tone)
  const mean = {}; for (const k in sums) { const list = sums[k], lit = list.slice().sort((a, b) => b[3] - a[3]).slice(0, Math.max(1, list.length >> 1));
    mean[k] = [0, 1, 2].map(c => +(lit.reduce((s, v) => s + v[c], 0) / lit.length).toFixed(4)); }
  log.push('recolor classes ' + Object.keys(sums).map(k => k + ' ' + sums[k].length).join(', ') + ' lit mean ' + JSON.stringify(mean));

  const mat = new T.MeshStandardMaterial({ map: m0.map, normalMap: m0.normalMap, roughness: .62, metalness: 0, name: 'nurse' });
  const mesh = new T.SkinnedMesh(geo, mat); mesh.name = 'nurse_body';
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones), mesh.matrixWorld);

  // idle as-is, in place
  const idle = idleFbx.animations[0].clone(); idle.name = 'idle';
  // walking: find the smoothest loop inside "start walking", then remove the forward travel so it plays in place
  const wclip = walkFbx.animations[0];
  const keyBones = ['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'LeftArm', 'RightArm', 'Spine', 'LeftFoot', 'RightFoot'];
  const qTracks = wclip.tracks.filter(t => /\.quaternion$/.test(t.name) && keyBones.some(k => t.name === 'mixamorig' + k + '.quaternion'));
  const sampleQ = (t, time) => { const it = t.createInterpolant(); return it.evaluate(time).slice(0, 4); };
  const hipsPos = wclip.tracks.find(t => t.name === 'mixamorigHips.position');
  const sampleP = time => Array.from(hipsPos.createInterpolant().evaluate(time).slice(0, 3));
  let best = null;
  const travel = (() => { const a = sampleP(0), b = sampleP(wclip.duration); return Math.hypot(b[0] - a[0], b[2] - a[2]); })();
  log.push('walk clip ' + wclip.duration.toFixed(2) + 's, hips travel ' + travel.toFixed(1) + ' cm');
  if (travel < 8) best = { t0: 0, L: wclip.duration, d: 0, inPlace: true };   // Mixamo "In Place": already a loop
  else if (wclip.duration < 1.7) best = { t0: 0, L: wclip.duration, d: 0 };   // a plain walking loop: use it whole, minus the travel
  else for (let t0 = .45; t0 < wclip.duration - .6; t0 += 1 / 60) for (let L = .7; t0 + L <= wclip.duration - .01 && L <= 1.3; L += 1 / 60) {
    let d = 0; for (const tr of qTracks) { const a = sampleQ(tr, t0), b = sampleQ(tr, t0 + L); d += 1 - Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); }
    const pa = sampleP(t0), pb = sampleP(t0 + L); d += Math.abs(pa[1] - pb[1]) * .002;
    if (!best || d < best.d) best = { t0, L, d };
  }
  const fps = 30, F = Math.round(best.L * fps), times = new Float32Array(F + 1).map((_, i) => i / fps);
  const p0 = sampleP(best.t0), p1 = sampleP(best.t0 + best.L);
  const tracks = wclip.tracks.map(tr => {
    const it = tr.createInterpolant(), sz = tr.getValueSize(), vals = new Float32Array((F + 1) * sz);
    for (let i = 0; i <= F; i++) { const tt = best.t0 + Math.min(best.L, i / fps); const v = it.evaluate(tt); for (let k = 0; k < sz; k++) vals[i * sz + k] = v[k]; }
    if (tr.name === 'mixamorigHips.position') for (let i = 0; i <= F; i++) { const f = i / F; for (const k of [0, 1, 2]) vals[i * 3 + k] -= (p0[k] + (p1[k] - p0[k]) * f) - p0[k] * (k === 1 ? 1 : 0); }
    // close the loop: ease the last frames into the first pose
    const blendN = Math.min(5, F >> 2);
    for (let i = F - blendN; i <= F; i++) { const f = (i - (F - blendN)) / blendN; for (let k = 0; k < sz; k++) vals[i * sz + k] = vals[i * sz + k] * (1 - f) + vals[k] * f; }
    const C = tr.constructor; const out = new C(tr.name, times, vals); return out;
  });
  const walk = new T.AnimationClip('walk', best.L, tracks);
  let stride = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / best.L;
  if (best.inPlace) {
    // no travel to measure: a planted foot slides back under the hips at walking speed
    walkFbx.updateMatrixWorld(true); const mx = new T.AnimationMixer(walkFbx); mx.clipAction(wclip).play(); const fb = [], n = 120;
    const bone = nm => { let o = null; walkFbx.traverse(q => { if (q.name === 'mixamorig' + nm) o = q; }); return o; }, feet = [bone('LeftFoot'), bone('RightFoot')], hips = bone('Hips');
    const at = o => new T.Vector3().setFromMatrixPosition(o.matrixWorld);
    for (let i = 0; i <= n; i++) { mx.setTime(wclip.duration * i / n); walkFbx.updateMatrixWorld(true); const h = at(hips); fb.push(feet.map(f => at(f).sub(h))); }
    const v = []; for (const k of [0, 1]) { const ys = fb.map(f => f[k].y), lo = Math.min(...ys);
      for (let i = 1; i < fb.length; i++) if (fb[i][k].y < lo + 1.5 && fb[i - 1][k].y < lo + 1.5) v.push(-(fb[i][k].z - fb[i - 1][k].z) / (wclip.duration / n)); }
    v.sort((a, b) => a - b); stride = v.length ? v[v.length >> 1] : 50; log.push('in-place walk, planted-foot speed ' + stride.toFixed(1) + ' cm/s from ' + v.length + ' samples');
  }
  log.push('walk loop ' + best.t0.toFixed(2) + 's +' + best.L.toFixed(2) + 's, mismatch ' + best.d.toFixed(4) + ', speed ' + stride.toFixed(1) + ' cm/s');
  root.userData.walkSpeed = stride; root.userData.height = geo.boundingBox.max.y; root.userData.mean = mean; root.userData.version = 3;
  root.userData.pixie = CFG.pixie; root.userData.hasCap = CFG.capY != null;

  buildAccessories({ T, root, mesh, geo, B, pos, N, hairFlag, capFlag, skinFlag, isHead, weldId, log, CFG });
  const glb = await new Promise((res, rej) => new T.GLTFExporter().parse(root, res, rej, { binary: true, animations: [idle, walk], onlyVisible: true }));
  const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { log, glb: btoa(s), walkSpeed: stride, height: geo.boundingBox.max.y };
}

/* Accessories that fit this model, each riding on its bone; the game shows the ones a look asks for.
   Hair pieces use the body material with the hair class, textured from a patch of the model's own hair,
   so the Locker's hair color tints them too. The dome covers the head when the cap is hidden. */
function buildAccessories({ T, root, mesh, geo, B, pos, N, hairFlag, capFlag, skinFlag, isHead, weldId, log, CFG }) {
  root.updateMatrixWorld(true);
  const HEAD = B('Head'), CHEST = B('Spine2'), bodyMat = mesh.material, V3 = (x, y, z) => new T.Vector3(x, y, z);
  const [U0, U1, V0, V1] = CFG.hairPatch;                                     // a patch of hair in the texture atlas
  const accMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .15, name: 'accessory' });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const toBone = (bone, g) => g.applyMatrix4(new T.Matrix4().copy(bone.matrixWorld).invert().multiply(root.matrixWorld));
  const place = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(new T.Matrix4().compose(V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), V3(sx, sy, sz)));
  const paint = (g, hex) => { const c = new T.Color(hex).convertSRGBToLinear(), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
  const hairify = g => { const n = g.attributes.position.count, uv = g.attributes.uv, a = new Float32Array(n * 4);
    // kept well inside the patch so the smaller mip levels don't pick up the neighbors in the atlas
    for (let i = 0; i < n; i++) { const u = .18 + .64 * (((uv.getX(i) % 1) + 1) % 1), v = .18 + .64 * (((uv.getY(i) % 1) + 1) % 1); uv.setXY(i, U0 + u * (U1 - U0), V0 + v * (V1 - V0)); a[i * 4 + 3] = 1; }
    g.setAttribute('color', new T.BufferAttribute(a, 4)); g.setAttribute('color_1', new T.BufferAttribute(new Float32Array(n * 4), 4)); return g; };
  const merge = list => T.BufferGeometryUtils.mergeBufferGeometries(list.map(g => g.index ? g : g));
  const add = (bone, g, mat, name) => { const m = new T.Mesh(toBone(bone, g), mat); m.name = name; m.castShadow = true; bone.add(m); return m; };
  // a tube along a curve, width rx(t) across (binormal) and depth rz(t) (normal), closed at both ends
  const tube = (pts, rx, rz, segs = 24, radial = 14, side = null) => {
    const curve = new T.CatmullRomCurve3(pts), fr = curve.computeFrenetFrames(segs, false), P = [], UV = [], I = [];
    if (side) for (let i = 0; i <= segs; i++) { const t = curve.getTangentAt(i / segs), b = side.clone().addScaledVector(t, -side.dot(t)).normalize();
      fr.binormals[i].copy(b); fr.normals[i].crossVectors(t, b).normalize(); }
    for (let i = 0; i <= segs; i++) { const t = i / segs, c = curve.getPointAt(t), a1 = rx(t), a2 = rz(t);
      for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2;
        const p = c.clone().addScaledVector(fr.binormals[i], Math.cos(a) * a1).addScaledVector(fr.normals[i], Math.sin(a) * a2); P.push(p.x, p.y, p.z); UV.push(j / radial, t); } }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    for (const [i, out] of [[0, -1], [segs, 1]]) { const c = curve.getPointAt(i / segs), k = P.length / 3, tg = curve.getTangentAt(i / segs).multiplyScalar(out); P.push(c.x, c.y, c.z); UV.push(.5, i / segs);
      const v = n => V3(P[n * 3], P[n * 3 + 1], P[n * 3 + 2]), a0 = i * (radial + 1), nrm = v(a0).sub(c).cross(v(a0 + 1).sub(c));
      const flip = nrm.dot(tg) < 0;   // (k, a, a+1) faces along the tube when its normal agrees with the outward tangent
      for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j; flip ? I.push(k, a + 1, a) : I.push(k, a, a + 1); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };

  // --- hair pieces ---
  { const [r, x, y, z, sx, sy, sz] = CFG.bun.sphere, [tr, tt, tx, ty, tz, trx] = CFG.bun.torus;
    add(HEAD, hairify(merge([place(new T.SphereGeometry(r, 22, 16), x, y, z, 0, 0, 0, sx, sy, sz), place(new T.TorusGeometry(tr, tt, 10, 26), tx, ty, tz, trx, 0, 0, 1, .95, 1)])), bodyMat, 'hair_bun'); }
  { const P = CFG.pony, [w0, w1, w2] = P.w, [d0, d1, d2] = P.d;
    add(HEAD, hairify(tube(P.pts.map(q => V3(...q)), t => w0 * (1 - t) + w1 * t + Math.sin(t * Math.PI) * w2, t => d0 * (1 - t) + d1 * t + Math.sin(t * Math.PI) * d2, 26, 14, V3(1, 0, 0))), bodyMat, 'hair_pony');
    add(HEAD, paint(place(new T.TorusGeometry(1.75, .62, 8, 18), P.tie[0], P.tie[1], P.tie[2], P.tie[3], 0, 0), '#ff8fc4'), accMat, 'acc_tie'); }
  { const Lg = CFG.long;
    add(HEAD, hairify(tube(Lg.pts.map(q => V3(...q)), t => (Lg.w[0] - Lg.w[1] * t) * (t > .86 ? Math.sqrt(Math.max(.05, 1 - ((t - .86) / .14) ** 2)) : 1), t => Lg.d[0] - Lg.d[1] * t, 24, 20, V3(1, 0, 0))), bodyMat, 'hair_long'); }
  // curls: small balls of hair over the bob, spaced out
  { const center = V3(...CFG.curly.center), nrm = geo.attributes.normal, pts = [], kept = [];
    for (let i = 0; i < N; i++) if (hairFlag[i]) { const p = V3().fromBufferAttribute(pos, i), n = V3().fromBufferAttribute(nrm, i), d = p.clone().sub(center);
      if (p.y > CFG.curly.minY && n.dot(d) > .35 * d.length()) pts.push([p, n]); }
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const [p, n] of pts) if (kept.every(([q]) => q.distanceTo(p) > 3.9)) kept.push([p, n]);
    const capEdge = CFG.scrubCap ? CFG.scrubCap.c[1] + CFG.scrubCap.r[1] * Math.cos(CFG.scrubCap.theta) - .8 : 1e9, low = [], high = [];
    for (const [p, n] of kept) { const r = 2.25 + rnd() * .55, c = p.clone().addScaledVector(n, .55); (c.y > capEdge ? high : low).push(place(new T.SphereGeometry(r, 9, 7), c.x, c.y, c.z, rnd() * 3, rnd() * 3, 0)); }
    add(HEAD, hairify(merge(low)), bodyMat, 'hair_curly'); if (high.length) add(HEAD, hairify(merge(high)), bodyMat, 'hair_curlytop');
    log.push('curls ' + kept.length + (high.length ? ' (' + high.length + ' under the cap)' : '')); }
  // dome: fills the opening left when the cap is hidden (every triangle that touches the cap is hidden in the shader)
  if (CFG.capY != null) { const idx = geo.index.array, wpos = new Map(), edges = new Map();
    for (let i = 0; i < N; i++) if (!wpos.has(weldId[i])) wpos.set(weldId[i], V3().fromBufferAttribute(pos, i));
    for (let f = 0; f < idx.length; f += 3) { if (!(capFlag[idx[f]] || capFlag[idx[f + 1]] || capFlag[idx[f + 2]])) continue;
      for (let e = 0; e < 3; e++) { const a = weldId[idx[f + e]], b = weldId[idx[f + (e + 1) % 3]], k = a < b ? a + '_' + b : b + '_' + a; edges.set(k, (edges.get(k) || 0) + 1); } }
    const nb = new Map(); for (const [k, c] of edges) if (c === 1) { const [a, b] = k.split('_').map(Number); (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
    const seen = new Set(); let best = [];
    for (const s0 of nb.keys()) { if (seen.has(s0)) continue; const loop = [s0]; seen.add(s0); let prev = -1, cur = s0;
      for (;;) { const nx = (nb.get(cur) || []).find(v => v !== prev && !seen.has(v)); if (nx === undefined) break; loop.push(nx); seen.add(nx); prev = cur; cur = nx; }
      if (loop.length > best.length) best = loop; }
    const ring = best.map(id => wpos.get(id)), c = ring.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / ring.length), K = 7, H = 3.8, P = [], UV = [], I = [], n = ring.length;
    for (let k = 0; k < K; k++) { const t = k / K, s = Math.cos(t * Math.PI / 2), h = Math.sin(t * Math.PI / 2) * H;
      for (const b of ring) { const p = V3(c.x + (b.x - c.x) * s, b.y + (c.y - b.y) * (1 - s) + h, c.z + (b.z - c.z) * s); P.push(p.x, p.y, p.z); UV.push((p.x + 12) / 24, (p.z + 12) / 24); } }
    const apex = P.length / 3; P.push(c.x, c.y + H, c.z); UV.push((c.x + 12) / 24, (c.z + 12) / 24);
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n; I.push(a, b, a + n, b, b + n, a + n); }
    for (let i = 0; i < n; i++) I.push((K - 1) * n + i, (K - 1) * n + (i + 1) % n, apex);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
    if (g.attributes.normal.getY(apex) < 0) { g.setIndex(I.map((v, i) => I[i - i % 3 + (2 - i % 3)])); g.computeVertexNormals(); }
    add(HEAD, hairify(g), bodyMat, 'hair_dome'); log.push('cap opening ' + n + ' edges, center ' + c.toArray().map(v => v.toFixed(1)).join(',')); }

  // --- glasses ---
  { const L = [];
    const G = CFG.glasses, [ex, ey, ez] = G.eye, mir = (q, sd) => V3(sd * q[0], q[1], q[2]);
    for (const sd of [-1, 1]) { L.push(place(new T.TorusGeometry(G.r, .3, 8, 30), sd * ex, ey, ez, 0, sd * -.12, 0));
      L.push(tube(G.temple.map(q => mir(q, sd)), () => .26, () => .26, 8, 6)); }
    L.push(tube([mir(G.bridge[0], -1), V3(...G.bridge[1]), mir(G.bridge[0], 1)], () => .27, () => .27, 8, 6));
    for (const g of L) { if (!g.attributes.uv) continue; } 
    add(HEAD, paint(merge(L.map(g => { g.deleteAttribute('uv'); return g; })), '#1d1c26'), accMat, 'acc_glasses'); }

  // --- stethoscope around the neck, kept a centimeter off the body ---
  { const body = []; for (let i = 0; i < N; i++) if (!isHead[i]) body.push(V3().fromBufferAttribute(pos, i));
    const clear = (p, d0) => { for (let it = 0; it < 10; it++) { let best = null, bd = 1e9; for (const q of body) { const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = q; } }
        bd = Math.sqrt(bd); if (bd >= d0) break; p.add(p.clone().sub(best).normalize().multiplyScalar(d0 - bd + .05)); } return p; };
    const half = CFG.steth.map(q => V3(...q)), path = half.concat(half.slice(0, -1).reverse().map(q => V3(-q.x, q.y, q.z))).map(p => clear(p, 1.05));
    const tubeG = paint(tube(path, () => .42, () => .42, 60, 8), '#2e3442');
    const end = path[path.length - 1], bell = paint(place(new T.CylinderGeometry(1.45, 1.45, .75, 20), end.x + .1, end.y - 1.3, end.z + .45, Math.PI / 2 - .25, 0, 0), '#c9ced8');
    const rim = paint(place(new T.TorusGeometry(1.45, .22, 6, 20), end.x + .1, end.y - 1.3, end.z + .85, -.25, 0, 0), '#8e95a3');
    const s = path[0], tips = [-1, 1].map(k => paint(place(new T.SphereGeometry(.55, 10, 8), s.x + k * .75, s.y - .9, s.z + .25), '#8e95a3'));
    for (const g of [bell, rim, ...tips]) g.deleteAttribute('uv'); tubeG.deleteAttribute('uv');
    add(CHEST, merge([tubeG, bell, rim, ...tips]), accMat, 'acc_steth'); log.push('stethoscope path ' + path.map(p => p.toArray().map(v => v.toFixed(1)).join(',')).join(' | ')); }

  // --- beard: a thin shell over the jaw, chin and upper lip, textured and tinted like the hair ---
  if (CFG.beard) { const Bd = CFG.beard, nrm = geo.attributes.normal, idx = geo.index.array, keep = new Uint8Array(N);
    for (let i = 0; i < N; i++) { if (!isHead[i] || !skinFlag[i]) continue; const p = V3().fromBufferAttribute(pos, i), ax = Math.abs(p.x);
      const face = p.y > Bd.y0 && p.y < Bd.y1 && p.z > Bd.z && ax < Bd.ax, side = ax > Bd.side[0] && p.y > Bd.y0 && p.y < Bd.side[1] && p.z > Bd.side[2] && p.z < Bd.side[3];
      const mouth = ax < Bd.mouth[0] && p.y > Bd.mouth[1] && p.y < Bd.mouth[2] && p.z > Bd.mouth[3], nose = ax < Bd.nose[0] && p.y > Bd.nose[1] && p.z > Bd.nose[2];
      keep[i] = (face || side) && !mouth && !nose ? 1 : 0; }
    const P = [], UV = [], I = [], map = new Map();
    const vid = i => { if (!map.has(i)) { const p = V3().fromBufferAttribute(pos, i).addScaledVector(V3().fromBufferAttribute(nrm, i), Bd.off); map.set(i, P.length / 3); P.push(p.x, p.y, p.z); UV.push((p.x + 12) / 24, (p.y - 66) / 16); } return map.get(i); };
    for (let f = 0; f < idx.length; f += 3) if (keep[idx[f]] && keep[idx[f + 1]] && keep[idx[f + 2]]) I.push(vid(idx[f]), vid(idx[f + 1]), vid(idx[f + 2]));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
    add(HEAD, hairify(g), bodyMat, 'hair_beard'); log.push('beard ' + I.length / 3 + ' triangles'); }

  // --- scrub cap: a cloth dome over the hair, in the scrubs' fabric and color ---
  if (CFG.scrubCap) { const S = CFG.scrubCap, [C0, C1, D0, D1] = CFG.clothPatch, g = new T.SphereGeometry(1, 30, 16, 0, Math.PI * 2, 0, S.theta);
    place(g, S.c[0], S.c[1], S.c[2], S.tilt || 0, 0, 0, S.r[0], S.r[1], S.r[2]);
    const n = g.attributes.position.count, uv = g.attributes.uv, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { uv.setXY(i, C0 + uv.getX(i) * (C1 - C0), D0 + uv.getY(i) * (D1 - D0)); a[i * 4] = 1; }
    g.setAttribute('color', new T.BufferAttribute(a, 4)); g.setAttribute('color_1', new T.BufferAttribute(new Float32Array(n * 4), 4));
    // a band around the bottom edge
    add(HEAD, g, bodyMat, 'cloth_cap'); log.push('scrub cap'); }
}
