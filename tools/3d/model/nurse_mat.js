/* ---------- textured nurse: Locker colors and pieces on the model ----------
   Each vertex carries classes in two color sets: (top, pants, skin, hair) and (shoes, cap, pocket cross).
   A texel only changes when its own color fits its class, so eyes, soles and the cap's cross keep their colors.
   Colors are worked in sRGB-like space. Hair pieces, glasses and the stethoscope are meshes on the head and chest bones. */
// short cut: hair away from the face is drawn in toward the head and lifted off the neck (model centimeters)
const NURSE_PIXIE='if(uPixie>.5&&color_1.w>0.0){vec3 c=vec3(0.0,82.0,-1.0);vec3 q=transformed;vec3 d=q-c;if(q.y<77.0)d.y=(77.0-c.y)-(77.0-q.y)*.35;d.xz*=.74;transformed=mix(q,c+d,color_1.w);}';
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
function nurseMaterial(src,mean){
  const u={uTop:{value:new T.Vector3()},uPants:{value:new T.Vector3()},uSkin:{value:new T.Vector3(1,1,1)},uHair:{value:new T.Vector3()},uShoes:{value:new T.Vector3()},
    uOn:{value:new T.Vector4()},uCapOff:{value:0},uHideCross:{value:0},uPixie:{value:0},
    uClothLum:{value:lum3(mean.scrub)},uHairLum:{value:Math.max(.05,lum3(mean.hair))},uShoeLum:{value:Math.max(.2,lum3(mean.shoes||[.75,.75,.75]))}};
  const m=new T.MeshStandardMaterial({map:src.map,normalMap:src.normalMap||null,roughness:.62,metalness:0});
  m.userData.u=u;m.userData.mean=mean;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 color;\nattribute vec4 color_1;\nvarying vec4 vClsA;\nvarying vec4 vClsB;\nuniform float uPixie;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvClsA=color;vClsB=color_1;\n'+NURSE_PIXIE);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vClsA;\nvarying vec4 vClsB;\nuniform vec3 uTop;\nuniform vec3 uPants;\nuniform vec3 uSkin;\nuniform vec3 uHair;\nuniform vec3 uShoes;\nuniform vec4 uOn;\nuniform float uCapOff;\nuniform float uHideCross;\nuniform float uClothLum;\nuniform float uHairLum;\nuniform float uShoeLum;')
      .replace('#include <map_fragment>','#include <map_fragment>\n'+NURSE_RECOLOR)};
  m.customProgramCacheKey=()=>'nurse-recolor-3';
  return m}
/* d: {top, pants, skin, hair, shoes} colors ('#hex', or leave out to keep the model's own) and
      {cap, glasses, steth, cross} switches, style: short | long | bun | curly | buzz | pony */
const HAIR_PIECES={long:['hair_long'],bun:['hair_bun'],curly:['hair_curly'],pony:['hair_pony','acc_tie']};
function dressNurse(obj,m,d){const u=m.userData.u,mean=m.userData.mean;
  u.uOn.value.set(d.top?1:0,d.skin?1:0,d.hair?1:0,d.shoes?1:0);
  if(d.top){u.uTop.value.copy(hex3(d.top));u.uPants.value.copy(hex3(d.pants||d.top))}
  if(d.skin){const k=hex3(d.skin);u.uSkin.value.set(k.x/Math.max(.05,mean.skin[0]),k.y/Math.max(.05,mean.skin[1]),k.z/Math.max(.05,mean.skin[2]))}
  if(d.hair)u.uHair.value.copy(hex3(d.hair));
  if(d.shoes)u.uShoes.value.copy(hex3(d.shoes));
  u.uCapOff.value=d.cap===false?1:0;u.uHideCross.value=d.cross===false?1:0;u.uPixie.value=d.style==='buzz'?1:0;
  const show=new Set(HAIR_PIECES[d.style]||[]);if(d.cap===false)show.add('hair_dome');if(d.glasses)show.add('acc_glasses');if(d.steth)show.add('acc_steth');
  obj.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;const n=(o.name||'').replace(/_\d+$/,'');if(/^(hair|acc)_/.test(n))o.visible=show.has(n);if(/^hair_/.test(n))o.material=m})}
