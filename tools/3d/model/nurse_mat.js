/* ---------- textured nurse: Locker colors and pieces on the model ----------
   Each vertex carries classes in two color sets: (top, pants, skin, hair) and (shoes, cap, pocket cross).
   A texel only changes when its own color fits its class, so eyes, soles and the cap's cross keep their colors.
   Colors are worked in sRGB-like space. Hair pieces, glasses, the scrub cap and the stethoscope are skinned meshes on the same skeleton. */
// short cuts, caps and curls press the hair onto a skull-sized ellipsoid (model centimeters): whatever stands out past it keeps
// uSkK of its height, and hair below the skull (uNeckY) narrows into the neck so it ends up inside it; color_1.w is how freely
// each hair vertex moves (0 at the hairline); under a baked cap (uCapY) the hair near the cap stays put so the cap still sits on it
const NURSE_PIXIE='if(uPixie>.5&&color_1.w>0.0){vec3 q=transformed;float w=color_1.w*(uCapOff>.5?1.0:1.0-smoothstep(uCapY-6.0,uCapY-1.5,q.y));'+
  'vec3 e=(q-uSkC)/uSkR;float r=max(length(e),1e-4);float r2=r>1.0?1.0+uSkK*(r-1.0):r;vec3 t=uSkC+(q-uSkC)*(r2/r);'+
  't.xz=uNeckA+(t.xz-uNeckA)*mix(1.0,uNeckS,1.0-smoothstep(uNeckY-uNeckH,uNeckY,q.y));transformed=mix(transformed,t,w);}';
const NURSE_RECOLOR=[
'{ if(uCapOff>.5&&vClsB.y>.002) discard;',
'  vec3 s=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2)); float lum=dot(s,vec3(.3,.59,.11));',
'  float tCloth=smoothstep(.02,.10,s.b-s.r);',
'  float tSkin=smoothstep(.04,.12,s.r-s.b)*smoothstep(.26,.34,lum)*(1.0-smoothstep(.80,.90,min(s.r,min(s.g,s.b))));',
'  float tHair=1.0-smoothstep(.40,.55,lum);',
'  float tShoe=smoothstep(.30,.45,lum)*(1.0-smoothstep(.07,.16,abs(s.r-s.b)));',
'  float fc=clamp(lum/uClothLum,0.0,1.7), fh=clamp(lum/uHairLum,0.0,3.0);',
'  vec3 o=s;',
'  o=mix(o,uTop*fc,clamp(vClsA.x,0.0,1.0)*tCloth*uOn.x);',
'  o=mix(o,uPants*fc,clamp(vClsA.y,0.0,1.0)*tCloth*uOn.x);',
'  o=mix(o,uTop*1.04,clamp(vClsB.z,0.0,1.0)*uHideCross);',
'  o=mix(o,s*uSkin,clamp(vClsA.z,0.0,1.0)*tSkin*uOn.y);',
'  o=mix(o,uHair*(1.6*fh/(.6+fh)),clamp(vClsA.w,0.0,1.0)*tHair*uOn.z);',
'  o=mix(o,uShoes*clamp(lum/uShoeLum,0.0,1.25),clamp(vClsB.x,0.0,1.0)*tShoe*uOn.w);',
'  diffuseColor.rgb=pow(clamp(o,0.0,1.0),vec3(2.2)); }'].join('\n');
function hex3(h){const n=parseInt(String(h).replace('#',''),16);return new T.Vector3((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)}
const lum3=c=>.3*c[0]+.59*c[1]+.11*c[2];
function nurseMaterial(src,mean,meta,shared){const tk=(meta&&meta.tuck)||{c:[0,82,-1],r:[8.8,11,11],k:.1},nk=tk.neck||{y:-1e4,h:1,s:1,a:[0,0]};
  const u=shared||{uTop:{value:new T.Vector3()},uPants:{value:new T.Vector3()},uSkin:{value:new T.Vector3(1,1,1)},uHair:{value:new T.Vector3()},uShoes:{value:new T.Vector3()},
    uOn:{value:new T.Vector4()},uCapOff:{value:0},uHideCross:{value:0},uPixie:{value:0},uSkC:{value:new T.Vector3(...tk.c)},uSkR:{value:new T.Vector3(...tk.r)},uSkK:{value:tk.k},uNeckY:{value:nk.y},uNeckH:{value:nk.h},uNeckS:{value:nk.s},uNeckA:{value:new T.Vector2(...nk.a)},uCapY:{value:tk.capY==null?1e4:tk.capY},
    uClothLum:{value:lum3(mean.scrub)},uHairLum:{value:Math.max(.05,lum3(mean.hair))},uShoeLum:{value:Math.max(.2,lum3(mean.shoes||[.75,.75,.75]))}};
  const m=new T.MeshStandardMaterial({map:src.map,normalMap:src.normalMap||null,roughness:.62,metalness:0});
  m.userData.u=u;m.userData.mean=mean;m.userData.meta=meta;m.userData.bakedCap=!meta||meta.hasCap!==false;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 color;\nattribute vec4 color_1;\nvarying vec4 vClsA;\nvarying vec4 vClsB;\nuniform float uPixie;\nuniform vec3 uSkC;\nuniform vec3 uSkR;\nuniform float uSkK;\nuniform float uNeckY;\nuniform float uNeckH;\nuniform float uNeckS;\nuniform vec2 uNeckA;\nuniform float uCapY;\nuniform float uCapOff;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvClsA=color;vClsB=color_1;\n'+NURSE_PIXIE);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vClsA;\nvarying vec4 vClsB;\nuniform vec3 uTop;\nuniform vec3 uPants;\nuniform vec3 uSkin;\nuniform vec3 uHair;\nuniform vec3 uShoes;\nuniform vec4 uOn;\nuniform float uCapOff;\nuniform float uHideCross;\nuniform float uClothLum;\nuniform float uHairLum;\nuniform float uShoeLum;')
      .replace('#include <map_fragment>','#include <map_fragment>\n'+NURSE_RECOLOR)};
  m.customProgramCacheKey=()=>'nurse-recolor-5';
  return m}
/* d: {top, pants, skin, hair, shoes} colors ('#hex', or leave out to keep the model's own) and
      {cap, glasses, steth, cross, beard} switches, style: short | long | bun | curly | buzz | pony.
   cap: the female's nurse cap is part of her model (hidden in the shader, with a hair dome);
   the male's is a scrub cap piece in his scrubs' color, worn over tucked hair.
   Pieces are skinned meshes named hair_*, acc_*, cloth_*; hair pieces with their own strand texture get a second
   material that shares this one's settings (one set of Locker colors per person). */
const HAIR_PIECES={long:['hair_long'],bun:['hair_bun'],curly:['hair_curly','hair_curlytop'],pony:['hair_pony','acc_tie']};
const PIECE_MAT=new WeakMap();
function pieceMaterial(o,m){let k=PIECE_MAT.get(o);if(!k){k=o.material&&o.material.name==='hairpiece'?(m.userData.hairMat||(m.userData.hairMat=nurseMaterial(o.material,m.userData.mean,m.userData.meta,m.userData.u))):m;PIECE_MAT.set(o,k)}return k}
function dressNurse(obj,m,d){const u=m.userData.u,mean=m.userData.mean,meta=m.userData.meta||{};
  u.uOn.value.set(d.top?1:0,d.skin?1:0,d.hair?1:0,d.shoes?1:0);
  if(d.top){u.uTop.value.copy(hex3(d.top));u.uPants.value.copy(hex3(d.pants||d.top))}
  if(d.skin){const k=hex3(d.skin);u.uSkin.value.set(k.x/Math.max(.05,mean.skin[0]),k.y/Math.max(.05,mean.skin[1]),k.z/Math.max(.05,mean.skin[2]))}
  if(d.hair)u.uHair.value.copy(hex3(d.hair));
  if(d.shoes)u.uShoes.value.copy(hex3(d.shoes));
  const scrubCap=!m.userData.bakedCap&&!!d.cap;
  u.uCapOff.value=d.cap===false?1:0;u.uHideCross.value=d.cross===false?1:0;
  u.uPixie.value=d.style==='buzz'||(d.style==='curly'&&meta.curlyTuck)||scrubCap?1:0;   // hair pressed to the skull under short cuts, curls and the scrub cap
  const show=new Set(HAIR_PIECES[d.style]||[]);if(d.glasses){show.add('acc_glasses');show.add('acc_lens')}if(d.steth)show.add('acc_steth');if(d.beard)show.add('hair_beard');
  if(d.cap)show.delete('hair_curlytop');
  if(m.userData.bakedCap){if(d.cap===false)show.add('hair_dome')}else if(d.cap){show.add('cloth_cap');for(const k of ['hair_bun','hair_pony','acc_tie'])show.delete(k)}   // a scrub cap covers the top (and what is tied up there)
  obj.traverse(o=>{if(!o.isMesh)return;const n=(o.name||'').replace(/_\d+$/,'');if(!/^(hair|acc|cloth)_/.test(n))return;o.visible=show.has(n);if(/^(hair|cloth)_/.test(n))o.material=pieceMaterial(o,m)})}
