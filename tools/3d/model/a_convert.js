// FBX (Tripo, unrigged) -> GLB with assimp (triangulates the few n-gons three.js would drop). Textures handled separately.
const fs = require('fs'), path = require('path');
const NPM = process.argv[2], src = process.argv[3], out = process.argv[4];
require(path.join(NPM, 'node_modules/assimpjs'))().then(ajs => {
  const list = new ajs.FileList();
  list.AddFile(path.basename(src), new Uint8Array(fs.readFileSync(src)));
  const res = ajs.ConvertFileList(list, 'glb2');
  if (!res.IsSuccess() || res.FileCount() === 0) { console.log('failed', res.GetErrorCode()); process.exit(1); }
  const f = res.GetFile(0); fs.writeFileSync(out, Buffer.from(f.GetContent()));
  console.log('ok', f.GetPath(), fs.statSync(out).size);
});
