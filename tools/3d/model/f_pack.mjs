// game-ready pack: smaller textures, drop tracks for bones nothing is skinned to (fingers, end bones), trim keys, quantize
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';
import { resample, prune, dedup, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
const [src, out, q] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src), root = doc.getRoot();
// joints that move vertices, plus their parents
const used = new Set();
for (const skin of root.listSkins()) {
  const joints = skin.listJoints();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'); if (!J || !W) continue;
    const j = [], w = [];
    for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); for (let k = 0; k < 4; k++) if (w[k] > 1e-4) used.add(joints[j[k]]); }
  }
}
const parentOf = new Map(); for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
for (const n of [...used]) { let p = parentOf.get(n); while (p) { used.add(p); p = parentOf.get(p); } }
let dropped = 0;
for (const anim of root.listAnimations()) for (const ch of anim.listChannels()) { const n = ch.getTargetNode(); if (n && !used.has(n)) { const s = ch.getSampler(); ch.dispose(); if (s && !s.listParents().some(p => p !== anim)) s.dispose(); dropped++; } }
console.log('joints used', used.size, 'channels dropped', dropped);
const steps = [
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 86, slots: /^baseColorTexture$/ }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [512, 512], quality: 90, slots: /^normalTexture$/ }),
  resample({ tolerance: 2e-4 }), prune({ keepAttributes: true }), dedup()];   // keep COLOR_1 (Locker classes)
// positions stay float (the game places hair pieces and accessories in the model's own centimeters); the rest is quantized
if (q === 'q') steps.push(quantize({ pattern: /^(NORMAL|TEXCOORD|COLOR|JOINTS|WEIGHTS)/, quantizeNormal: 8, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8 }));
await doc.transform(...steps);
if (q === 'q') doc.createExtension(KHRMeshQuantization).setRequired(true);   // quantized normals, colors, weights
await io.write(out, doc);
for (const a of root.listAnimations()) console.log('anim', a.getName(), a.listChannels().length, 'channels');
for (const t of root.listTextures()) console.log('texture', t.getMimeType(), t.getSize(), t.getImage().byteLength);
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) console.log('attrs', p.listSemantics().map(s => s + ':' + p.getAttribute(s).getComponentType() + (p.getAttribute(s).getNormalized() ? 'n' : '')).join(' '));
console.log('extensions', root.listExtensionsUsed().map(e => e.extensionName));
