// weld, simplify to a phone-friendly size, shrink the 8K textures, drop what is unused
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [src, out, ratio] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.01 }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [2048, 2048], quality: 86, slots: /^baseColorTexture$/ }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 90, slots: /^normalTexture$/ }),
  prune(), dedup()
);
await io.write(out, doc);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) console.log('verts', p.getAttribute('POSITION').getCount(), 'tris', p.getIndices().getCount() / 3);
for (const t of doc.getRoot().listTextures()) console.log('texture', t.getMimeType(), t.getSize(), t.getImage().byteLength);
