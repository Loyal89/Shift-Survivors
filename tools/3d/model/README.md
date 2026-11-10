# Character models for the 3D view

Two models: `3d/nurse_f.glb` (women) and `3d/nurse_m.glb` (men). Both are made the same way; the male uses the settings in `cfg_m.js`.

Each is a textured, skinned nurse with an `idle` and an in-place `walk` clip (about 15,000 triangles, 1024 px texture, about 1.5 MB with its pieces). The game loads it next to `3d/index.html`; if it is missing, the
code-built people are used instead. Everyone on the floor is one of the two models, dressed for their role.

What the Locker changes on it (`nurse_mat.js`, also inside `g3d.js`):
- colors: each vertex carries classes in two color sets, (top, pants, skin, hair) and (shoes, cap, pocket cross, short-cut weight);
  the shader tints scrubs, pants, skin, hair and shoes, hides the pocket cross for non-nurses, and hides the cap;
- pieces on the bones (built by `rig.js`, named in the file): `hair_dome` (the head under the cap), `hair_bun`, `hair_pony` + `acc_tie`,
  `hair_long`, `hair_curly` (+ `hair_curlytop`), `acc_glasses`, `acc_steth`; the male also has `hair_beard` (a shell over his jaw)
  and `cloth_cap` (a scrub cap in his scrubs' color, since his model has no cap). Hair pieces are textured from a patch of the model's own hair;
- the short cut (`buzz`) draws the bob in toward the head in the vertex shader, using the short-cut weight.

## How it was made

Inputs: an image-to-3D character in a T-pose (FBX with an embedded texture, e.g. from Tripo) and two Mixamo clips
(FBX, "Without Skin" is fine): an idle and a walk. The character must stand like the Mixamo T-pose, about 98 cm tall, facing +Z.

```
npm install                                   # in this folder
node a_convert.js . character.fbx raw.glb     # FBX -> GLB (assimp triangulates the faces three.js would drop)
node c_optimize.mjs raw.glb simple.glb 0.16   # ~15k triangles, 2048 px texture
python3 rig.py THREE rig.js nurse_f_rigged.glb simple.glb Idle.fbx Walk.fbx   # see below
RIG_CFG=cfg_m.js python3 rig.py THREE rig.js nurse_m_rigged.glb simple_m.glb Idle_m.fbx Walking_m.fbx   # the male
node f_pack.mjs nurse_f_rigged.glb ../../../3d/nurse_f.glb q
python3 view.py THREE ../../../3d/nurse_f.glb check.png '[["idle",1,0],["walk",0.5,1.57],["idle",1,3.1,0,{"style":"pony","cap":false}],["bones",0,0]]'
```

`THREE` is an unpacked `three@0.147.0` npm package (`npm pack three@0.147.0 && tar xzf three-0.147.0.tgz`).
`rig.py` runs `rig.js` in headless Chromium (Playwright):

- binds the mesh to the Mixamo skeleton. The texture tells hair, cap and face (head) apart from the scrubs; arms start past
  the armpit line; every other vertex goes to its nearest bones, where running past the end of a bone counts triple
  (keeps sleeves and hems on the right bone), then the weights are smoothed over the surface;
- tags each vertex for the Locker (top, pants, skin, hair, shoes, cap, pocket cross) and builds the hair pieces, glasses and stethoscope;
- keeps the idle; a walk with root motion is cut to its smoothest loop (a short walking loop is used whole) and its forward travel removed;
  an "In Place" walk is used as it is, with its speed read from the planted foot.

The settings (head size, eye box, hem, armpit line, where the hair pieces, glasses and stethoscope sit) are `CFG_F` in `rig.js`
for the female and `cfg_m.js` for the male; a new character needs its own settings file and a look at the `bones` view in `view.py`. `f_pack.mjs` drops tracks for bones that move nothing (fingers), trims keys,
shrinks the textures and quantizes normals, colors and weights (KHR_mesh_quantization); positions stay in centimeters.

Mixamo animations are free to use in games. Check the license of the image-to-3D service for the character
(some free plans publish models under CC BY 4.0, which needs a credit line).
