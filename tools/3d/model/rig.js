/* Runs in a headless page with three.js r147: skins the Tripo nurse to the Mixamo skeleton, turns the
   Mixamo clips into an in-place idle and an in-place walking loop, and exports one GLB. */
async function buildNurse() {
  const T = THREE, log = [];
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
  const torsoSegs = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'].map(SG);
  const armSegs = sd => ['Shoulder', 'Arm', 'ForeArm', 'Hand'].map(n => SG((sd > 0 ? 'Left' : 'Right') + n));
  const legSegs = sd => ['UpLeg', 'Leg', 'Foot', 'ToeBase'].map(n => SG((sd > 0 ? 'Left' : 'Right') + n));
  // the texture tells hair, cap, face and skin apart from the scrubs
  const img = m0.map.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx2 = cv.getContext('2d'); cx2.drawImage(img, 0, 0); const px = cx2.getImageData(0, 0, cv.width, cv.height).data, uv = geo.attributes.uv;
  const colorAt = i => { let u = uv.getX(i) % 1, v = uv.getY(i) % 1; if (u < 0) u++; if (v < 0) v++;
    const o = ((Math.min(cv.height - 1, v * cv.height | 0)) * cv.width + Math.min(cv.width - 1, u * cv.width | 0)) * 4; return [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255]; };
  const invW = list => { const w = list.map(([b, d]) => [b, 1 / Math.pow(d + .6, 4)]); return w; };
  const near = (p, list, n) => invW(list.map(s => [s.bone, pd(p, s)]).sort((a, b) => a[1] - b[1]).slice(0, n));
  const W = new Array(N), isHead = new Uint8Array(N), p = new T.Vector3(), counts = {}, cls = new Float32Array(N * 3), sums = [[], [], []];
  const addTo = (m, list, f) => { const tot = list.reduce((s, c) => s + c[1], 0) || 1; for (const [b, w] of list) { const k = bIndex.get(b); m.set(k, (m.get(k) || 0) + f * w / tot); } };
  for (let i = 0; i < N; i++) {
    p.fromBufferAttribute(pos, i); const [r, g, b] = colorAt(i), lum = .3 * r + .59 * g + .11 * b, ax = Math.abs(p.x), sd = p.x >= 0 ? 1 : -1;
    const blue = b > r + .12, white = r > .72 && g > .72 && b > .72 && Math.abs(r - b) < .12, skin = r > .55 && r > b + .1 && !white && lum >= .3;
    const m = new Map(); W[i] = m;
    // recolor classes for the Locker: scrubs (blue or dark-blue cloth), skin, hair (not the eyes)
    const headish = (!blue || p.y > 72) && p.y > 65.5 && ax < 16 && (ax < 13.5 || p.y > 70) && p.distanceTo(headC) < 25 && (!skin || ax < 12);
    const dark = lum < .3 && !blue, eye = p.z > 6 && ax < 7 && p.y < 81 && p.y > 70;
    const chin = p.y < 72.5 && p.z > -1 && ax < 7.5;
    const k3 = !headish && (blue || (dark && b >= r)) ? 0 : skin ? 1 : headish && !white && !blue && !eye && !chin && (dark || (r < .62 && r > g && g > b)) ? 2 : -1;
    if (k3 >= 0) { cls[i * 3 + k3] = 1; sums[k3].push([r, g, b, lum]); }
    if ((!blue || p.y > 72) && p.y > 65.5 && ax < 16 && (ax < 13.5 || p.y > 70) && p.distanceTo(headC) < 25 && (!skin || ax < 12)) {
      // hair, cap, face and ears ride on the head; the neck skin blends down into the neck
      const k = skin ? sm(65, 70, p.y) : 1; m.set(bIndex.get(B('Head')), k); if (k < 1) m.set(bIndex.get(B('Neck')), 1 - k); isHead[i] = 1; continue;
    }
    const torso = torsoSegs.concat(p.y > 62 ? [armSegs(sd)[0]] : []);
    if (p.y > 50) {
      // upper body: arms start past the armpit line, the rest follows the spine
      const mArm = sm(-1.5, 1.5, ax - 10 + (p.y - 61) * .5);
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
  geo.setAttribute('color', new T.Float32BufferAttribute(cls, 3));
  // reference = the lit half of each class (a flat Locker color reads as the lit tone)
  const mean = sums.map(list => { const lit = list.slice().sort((a, b) => b[3] - a[3]).slice(0, Math.max(1, list.length >> 1));
    return [0, 1, 2].map(c => +(lit.reduce((s, v) => s + v[c], 0) / lit.length).toFixed(4)); });
  log.push('recolor classes (scrub, skin, hair) ' + sums.map(s => s.length).join(', ') + ' lit mean ' + JSON.stringify(mean));

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
  for (let t0 = .45; t0 < wclip.duration - .6; t0 += 1 / 60) for (let L = .7; t0 + L <= wclip.duration - .01 && L <= 1.3; L += 1 / 60) {
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
  const stride = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / best.L;
  log.push('walk loop ' + best.t0.toFixed(2) + 's +' + best.L.toFixed(2) + 's, mismatch ' + best.d.toFixed(4) + ', speed ' + stride.toFixed(1) + ' cm/s');
  root.userData.walkSpeed = stride; root.userData.height = geo.boundingBox.max.y; root.userData.mean = { scrub: mean[0], skin: mean[1], hair: mean[2] };

  const glb = await new Promise((res, rej) => new T.GLTFExporter().parse(root, res, rej, { binary: true, animations: [idle, walk], onlyVisible: true }));
  const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { log, glb: btoa(s), walkSpeed: stride, height: geo.boundingBox.max.y };
}
