/* settings for the male nurse (nurse_m.glb): his head, face and hair sit about 1-2 cm higher than hers, no baked cap */
window.RIG_CFG = {
  head: { blueY: 73.4, minY: 66.9, ax: 16, axLow: 14.5, axLowY: 71.5, r: 25, skinAx: 13.5, neck: [66.6, 71.6] },
  eye: { z: 6, ax: 7.5, y0: 72, y1: 83 }, chin: { y1: 73.5, z: -1, ax: 7.5 },
  capY: null, hemY: 42.8, shoeY: 9.5, cross: { y0: 52, y1: 66, z: 3 }, arm: { x: 10.6, y: 62.1, shoulderY: 63.1 }, upperY: 50.8,
  hairPatch: [.748, .7832, .8809, .916], clothPatch: [.3691, .4512, .5996, .6816], 
  tuck: { c: [-.25, 84, -1], r: [9.4, 11.3, 11.6], k: .1, neck: { y: 60, h: 3, s: 1, a: [-.25, -1] }, w: [.8, 2.6] },
  long: { axis: [-.25, -1], clear: 1, headY: [74, 65], groups: [
    { mode: 'over', phi: [112, 248], n: 13, startY: [94.5, 86], tipY: [63, 65.5], w: [1.7, 2.2], d: .6, lift: .55, taper: .72 },
    { mode: 'over', phi: [118, 242], n: 10, off: .5, startY: [92, 85], tipY: [64.5, 67], w: [1.5, 1.9], d: .5, lift: .3, taper: .7 },
    { mode: 'under', phi: [70, 110], n: 5, rootY: 84, tipY: [63.5, 64.5], swing: -18, w: [1.7, 2.2], d: .55, taper: .7 },
    { mode: 'under', phi: [250, 290], n: 5, rootY: 84, tipY: [63.5, 64.5], swing: 18, w: [1.7, 2.2], d: .55, taper: .7 }] },
  pony: { cx: -.25, y: 88, out: .4, n: 9, len: 15, w: [1.0, 1.35], d: .55, tieR: 1.2, tieColor: '#3a3f4b' },
  bun: { el: 48, r: 3.0, h: 3.0, turns: 2.5, tube: .9, sink: .25 },
  curly: { tuck: true, onCap: false, minY: 72.5, el: [-55, 89], r: [1.6, 2.1], space: .8, lift: .25, squash: .85 },
  glasses: { cx: -.25, ex: 4.65, ey: 80.45, a: 2.9, b: 2.3, n: 2.6, yaw: .22, clr: .45, eyeClr: .75, rim: .17, hingeAt: .3, armEnd: .3, armRise: .3, armClr: .25, bridgeAt: .5, bridgeLift: .35, bridgeClr: .5 },
  steth: [[-3.4, 59.0, 9.0], [-4.1, 63.2, 8.3], [-4.9, 67.0, 6.6], [-5.6, 70.0, 2.8], [-4.6, 71.8, -3.4], [0, 72.2, -6.6]],
  // beard: rays from c over phi x eps (degrees); outline = below the cheek line 'top' ([|x - cx|, y] pairs), outside the smiling
  // mouth [y, half width, half height, smile], above the jaw line low [y, rise per cm, from |x|], past |x| = side[0] in front of z = side[1] + (y - side[2]) * side[3];
  // thickness t grows from cheek to chin between heights ty
  beard: { c: [-.25, 76.5, 1.5], phi: [-88, 88], eps: [-72, 40], step: 3.6, cx: -.25,
    top: [[0, 76.0], [2, 75.9], [3.6, 75.7], [5, 76.4], [6.5, 77.6], [7.8, 79.8], [8.6, 82.6], [9.3, 86], [10, 88]],
    mouth: [74.4, 3.8, .7, .075], low: [69.3, .55, 3.5], side: [7.8, 1.6, 81, .38], ty: [76.5, 71.5],
    t: { cheek: .5, chin: 1.1, chinBump: .25, lip: .45, side: .25 }, base: .08, fade: .8 },
  // scrub cap: fitted around the tucked head from center c (clear cm over the hair, smoothed), edge height edge[0] + edge[1] cos(phi) + edge[2] cos(2 phi)
  // (phi 0 = front), puffing from puff[0] at the band to puff[1] on top, gathered (fold, foldN) at a rolled band of radius band
  scrubCap: { c: [-.25, 85, -1], edge: [82.7, 4.9, -.3], clear: .3, smooth: 6, puff: [.25, .6], fold: .16, foldN: 22, band: .34 } };
