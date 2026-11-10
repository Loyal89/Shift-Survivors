/* ---------- textured nurse: the Locker's scrub, skin and hair colors tint the model ----------
   The model carries a class per vertex in its color attribute (scrubs, skin, hair). A texel only changes when its own
   color fits that class, so the eyes, cap, shoes and pocket cross keep their colors. Colors are worked in sRGB-like space. */
const NURSE_RECOLOR=[
'{ vec3 s=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2)); float lum=dot(s,vec3(.3,.59,.11));',
'  float tScrub=smoothstep(.02,.10,s.b-s.r);',
'  float tSkin=smoothstep(.04,.12,s.r-s.b)*smoothstep(.26,.34,lum)*(1.0-smoothstep(.80,.90,min(s.r,min(s.g,s.b))));',
'  float tHair=1.0-smoothstep(.40,.55,lum);',
'  float fh=clamp(lum/uHairLum,0.0,3.0); vec3 hair=uHair*(1.6*fh/(.6+fh));',
'  vec3 o=s;',
'  o=mix(o,uScrub*clamp(lum/uScrubLum,0.0,1.7),clamp(vCls.x,0.0,1.0)*tScrub*uOn.x);',
'  o=mix(o,s*uSkin,clamp(vCls.y,0.0,1.0)*tSkin*uOn.y);',
'  o=mix(o,hair,clamp(vCls.z,0.0,1.0)*tHair*uOn.z);',
'  diffuseColor.rgb=pow(clamp(o,0.0,1.0),vec3(2.2)); }'].join('\n');
function hex3(h){const n=parseInt(String(h).replace('#',''),16);return new T.Vector3((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)}
function nurseMaterial(src,mean){
  const lum=c=>.3*c[0]+.59*c[1]+.11*c[2];
  const u={uScrub:{value:new T.Vector3()},uSkin:{value:new T.Vector3(1,1,1)},uHair:{value:new T.Vector3()},uOn:{value:new T.Vector3()},
    uScrubLum:{value:lum(mean.scrub)},uHairLum:{value:Math.max(.05,lum(mean.hair))}};
  const m=new T.MeshStandardMaterial({map:src.map,normalMap:src.normalMap||null,roughness:.62,metalness:0});
  m.userData.u=u;m.userData.mean=mean;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 color;\nvarying vec3 vCls;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCls=color;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCls;\nuniform vec3 uScrub;\nuniform vec3 uSkin;\nuniform vec3 uHair;\nuniform vec3 uOn;\nuniform float uScrubLum;\nuniform float uHairLum;')
      .replace('#include <map_fragment>','#include <map_fragment>\n'+NURSE_RECOLOR)};
  m.customProgramCacheKey=()=>'nurse-recolor-1';
  return m}
/* colors: {scrub:'#hex', skin:'#hex', hair:'#hex'}; leave one out to keep the model's own */
function tintNurse(m,c){const u=m.userData.u,mean=m.userData.mean;
  u.uOn.value.set(c.scrub?1:0,c.skin?1:0,c.hair?1:0);
  if(c.scrub)u.uScrub.value.copy(hex3(c.scrub));
  if(c.skin){const k=hex3(c.skin);u.uSkin.value.set(k.x/Math.max(.05,mean.skin[0]),k.y/Math.max(.05,mean.skin[1]),k.z/Math.max(.05,mean.skin[2]))}
  if(c.hair)u.uHair.value.copy(hex3(c.hair))}
