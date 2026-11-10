/* Runs in a headless page with three.js r147: skins the Tripo nurse to the Mixamo skeleton, turns the
   Mixamo clips into an in-place idle and an in-place walking loop, and exports one GLB.
   Numbers that depend on the character (head size, eyes, hem, where the hair pieces sit) come from a settings
   object: the female nurse below, or window.RIG_CFG from a settings file loaded first (see cfg_m.js). */
const CFG_F = {
  head: { blueY: 72, minY: 65.5, ax: 16, axLow: 13.5, axLowY: 70, r: 25, skinAx: 12, neck: [65, 70] },
  eye: { z: 6, ax: 7, y0: 70, y1: 81 }, chin: { y1: 72.5, z: -1, ax: 7.5, side: [3.5, 4] },
  capY: 89.5, hemY: 41.8, shoeY: 10.5, cross: { y0: 50, y1: 66, z: 3 }, arm: { x: 10, y: 61, shoulderY: 62 }, upperY: 50,
  hairPatch: [.6231, .6738, .8770, .9277], clothPatch: null,
  // short cuts (and anything worn over the hair) press the hair onto a skull-sized ellipsoid: center, radii, what is left of the
  // hair's height (k); hair below neck.y narrows into the neck (to s of its reach from axis a=[x,z] over h cm);
  // hair within w[0] cm of face skin (above faceY, in front of faceZ) stays, past w[1] it moves fully
  tuck: { c: [-.1, 82, -.5], r: [8.8, 11, 11], k: .1, neck: { y: 76, h: 3.5, s: .25, a: [-.1, -1] }, w: [.8, 2.6], faceY: 77, faceZ: 2 },
  // long: groups of clumps around phi (degrees, 0 = front, 180 = back), tips at tipY [back, sides], width w, thickness d (see acc.js);
  // clear cm off the back; skinned to the head above headY[0] and the chest below headY[1]
  long: { axis: [-.1, -1], clear: 1, headY: [72, 63], groups: [
    { mode: 'under', phi: [108, 252], n: 15, rootY: 79, tipY: [52.5, 57.5], w: [1.7, 2.3], d: .6, taper: .72 },
    { mode: 'under', phi: [112, 248], n: 12, off: .5, rootY: 79, tipY: [55, 60], w: [1.5, 2.0], d: .5, dr: -.55, taper: .7 },
    { mode: 'under', phi: [68, 104], n: 4, rootY: 79, tipY: [57, 58], swing: -35, w: [1.8, 2.3], d: .6, taper: .7 },
    { mode: 'under', phi: [256, 292], n: 4, rootY: 79, tipY: [57, 58], swing: 35, w: [1.8, 2.3], d: .6, taper: .7 }] },
  // pony: tied at height y on the back of the head (out cm behind the hair): n clumps around a bundle of length len, half width w, thickness d; scrunchie tieR
  pony: { cx: -.1, y: 84, out: .4, n: 9, len: 18, w: [1.1, 1.5], d: .6, tieR: 1.35, tieColor: '#ff8fc4' },
  // bun: on the head at elevation el (degrees up from straight back), radius r, height h, coil turns, strand tube; sunk sink x r
  bun: { el: 18, r: 3.4, h: 3.3, turns: 2.6, tube: 1.0, sink: .15 },
  // curly: puffs (radius r) spaced space x (r1 + r2) over hair above minY between elevations el; tuck: press the hair first; onCap: cover the cap too
  curly: { tuck: false, onCap: true, minY: 70.5, el: [-55, 89], r: [1.6, 2.1], space: .82, lift: .3, squash: .85 },
  // glasses: lens centers cx +/- ex at ey, half sizes a x b (superellipse n), turned out by yaw; kept clr cm off the face (eyeClr off the eye);
  // the arm leaves the rim at angle hingeAt, runs back to z = armEnd (rising armRise) armClr cm off the skin; the bridge joins the rims at bridgeAt
  glasses: { cx: -.1, ex: 4.7, ey: 78.95, a: 2.95, b: 2.35, n: 2.6, yaw: .22, clr: .45, eyeClr: .75, rim: .17, hingeAt: .3, armEnd: 1, armRise: .2, armClr: .25, bridgeAt: .5, bridgeLift: .35, bridgeClr: .5 },
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
    const chin = p.y < CFG.chin.y1 && p.z > CFG.chin.z && ax < CFG.chin.ax && (!CFG.chin.side || ax < CFG.chin.side[0] || p.z > CFG.chin.side[1]);   // (the side test lets a bob's dark inside count as hair)
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
  const idx = geo.index.array;
  // texels at the hair's edge can pick up the scrubs' blue from the atlas: a vertex mostly surrounded by hair is hair
  { const nbAll = Array.from({ length: ids.size }, () => new Set());
    for (let f = 0; f < idx.length; f += 3) for (let e = 0; e < 3; e++) { const a = idx[f + e], c = idx[f + (e + 1) % 3]; nbAll[weldId[a]].add(c); nbAll[weldId[c]].add(a); }
    const HD = bIndex.get(B('Head')); let grown = 0;
    for (let it = 0; it < 4; it++) { const add = [];
      for (let i = 0; i < N; i++) { if (hairFlag[i] || skinFlag[i] || capFlag[i] || pos.getY(i) < CFG.head.minY - 1.5) continue;
        const n = nbAll[weldId[i]]; let h = 0; for (const j of n) if (hairFlag[j]) h++; if (n.size && h * 2 >= n.size) add.push(i); }
      if (!add.length) break;
      for (const i of add) { hairFlag[i] = 1; isHead[i] = 1; clsA.fill(0, i * 4, i * 4 + 4); clsA[i * 4 + 3] = 1; W[i] = new Map([[HD, 1]]); grown++; } }
    log.push('hair grown over atlas bleed: ' + grown + ' vertices'); }
  const nb = Array.from({ length: ids.size }, () => new Set());
  for (let f = 0; f < idx.length; f += 3) for (let e = 0; e < 3; e++) { const a = idx[f + e], c = idx[f + (e + 1) % 3]; if (isHead[a] === isHead[c]) { nb[weldId[a]].add(c); nb[weldId[c]].add(a); } }
  // light hair highlights can pass the skin color test; skin that isn't part of a sizable patch (face, ears, neck) is hair
  { const comp = new Int32Array(ids.size).fill(-1), wSkin = new Uint8Array(ids.size), members = Array.from({ length: ids.size }, () => []);
    for (let i = 0; i < N; i++) { members[weldId[i]].push(i); if (isHead[i] && skinFlag[i]) wSkin[weldId[i]] = 1; }
    let fixed = 0;
    for (let s0 = 0; s0 < ids.size; s0++) { if (!wSkin[s0] || comp[s0] >= 0) continue; const list = [s0], st = [s0]; comp[s0] = s0;
      while (st.length) { const w = st.pop(); for (const j of nb[w]) { const v = weldId[j]; if (wSkin[v] && comp[v] < 0) { comp[v] = s0; list.push(v); st.push(v); } } }
      if (list.length < 20) for (const w of list) for (const i of members[w]) { if (!isHead[i]) continue; skinFlag[i] = 0; hairFlag[i] = 1; clsA[i * 4 + 2] = 0; clsA[i * 4 + 3] = 1; fixed++; } }
    log.push('skin islands in the hair relabeled: ' + fixed + ' vertices'); }
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
  { const face = [], capV = [], fy = CFG.tuck.faceY == null ? -1e9 : CFG.tuck.faceY, fz = CFG.tuck.faceZ == null ? -1e9 : CFG.tuck.faceZ; for (let i = 0; i < N; i++) { if (isHead[i] && !hairFlag[i] && !capFlag[i] && pos.getY(i) > fy && pos.getZ(i) > fz) face.push(V3c(i)); if (capFlag[i]) capV.push(V3c(i)); }
    const near = (list, q) => { let d = 1e9; for (const f of list) { const e = f.distanceToSquared(q); if (e < d) d = e; } return Math.sqrt(d); };
    const [w0, w1] = CFG.tuck.w; for (let i = 0; i < N; i++) if (hairFlag[i]) { const q = V3c(i); clsB[i * 4 + 3] = sm(w0, w1, near(face, q)); } }
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
  root.userData.tuck = { c: CFG.tuck.c, r: CFG.tuck.r, k: CFG.tuck.k, neck: CFG.tuck.neck, capY: CFG.capY }; root.userData.hasCap = CFG.capY != null; root.userData.curlyTuck = !!CFG.curly.tuck;

  buildAccessories({ T, root, mesh, geo, B, bIndex, pos, N, hairFlag, capFlag, skinFlag, isHead, weldId, log, CFG, mean, clsB });   // acc.js
  const glb = await new Promise((res, rej) => new T.GLTFExporter().parse(root, res, rej, { binary: true, animations: [idle, walk], onlyVisible: true }));
  const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { log, glb: btoa(s), walkSpeed: stride, height: geo.boundingBox.max.y };
}
