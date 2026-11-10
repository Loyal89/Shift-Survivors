/* ================= 3D view =================
   Draws the same unit with three.js: the real floor plan as 3D walls and floor, furniture, patients, staff and effects.
   The game's own task rings, tags and numbers are drawn on top, so the rules and timing are untouched.
   Falls back to the 2D view if WebGL or the 3D engine is missing, or when the player picks 2D on the title screen. */
const G3D=(function(){
const T=window.THREE;
const HAS=!!(T&&T.EffectComposer&&T.RenderPass&&T.UnrealBloomPass&&T.ShaderPass&&T.BufferGeometryUtils);
let want=true;try{if(localStorage.getItem('ss_gfx')==='2d')want=false}catch(e){}
let ready=false,dead=!HAS,canvas3=null;
const S=.01,WALL=.56,PITCH=.9,COARSE=matchMedia('(pointer: coarse)').matches;
const rr=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
let R,scene,camera,composer,bloom,outPass,hemi,sun,ecgTex,winMat,floorCanvas,floorTex,archCanvas,lastLang=null,lastW=0,lastH=0;
const lampPool=[],callPool=[],codeLights=[],LAMPS=[],FURN=[];
const view={x0:0,y0:0,x1:WW,y1:WH};
if(HAS)T.ColorManagement.legacyMode=false;

function on(){return want&&!dead}
function setWant(v){want=!!v;try{localStorage.setItem('ss_gfx',want?'3d':'2d')}catch(e){}if(canvas3)canvas3.style.display=on()?'block':'none'}

/* ---------- helpers ---------- */
function canvasTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),c);
  const t=new T.CanvasTexture(c);if(srgb)t.encoding=T.sRGBEncoding;t.anisotropy=4;return t}
const matCache=new Map();
function mat(hex,extra){const k=hex+(extra?JSON.stringify(extra):'');let m=matCache.get(k);
  if(!m){m=new T.MeshStandardMaterial(Object.assign({color:hex,roughness:.58},extra||{}));matCache.set(k,m)}return m}
const glowCache=new Map();
function glowMat(hex,mul){const k=hex+'|'+mul;let m=glowCache.get(k);if(!m){m=new T.MeshBasicMaterial({toneMapped:false});m.color.set(hex).multiplyScalar(mul);glowCache.set(k,m)}return m}
function tone(hex,f){const c=new T.Color(hex);c.offsetHSL(0,0,f);return '#'+c.getHexString()}
function tint(geo,hex){const c=new T.Color(hex),n=geo.attributes.position.count,a=new Float32Array(n*3);
  for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}geo.setAttribute('color',new T.BufferAttribute(a,3));return geo}
const _m=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_v=new T.Vector3(),_s=new T.Vector3();
function place(geo,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){_e.set(rx,ry,rz);_q.setFromEuler(_e);_m.compose(_v.set(x,y,z),_q,_s.set(sx,sy,sz));geo.applyMatrix4(_m);return geo}
let STATIC=[],GLOW={ecg:[],chart:[],win:[],red:[]};
function box(gx,gz,gw,gd,y,h,hex){STATIC.push(tint(place(new T.BoxGeometry(gw*S,h,gd*S),(gx+gw/2)*S,y+h/2,(gz+gd/2)*S),hex))}
function cyl(gx,gz,r,y,h,hex){STATIC.push(tint(place(new T.CylinderGeometry(r,r,h,10),gx*S,y+h/2,gz*S),hex))}
function ball(gx,gz,r,y,hex,sx=1,sy=1,sz=1){STATIC.push(tint(place(new T.SphereGeometry(r,14,10),gx*S,y,gz*S,0,0,0,sx,sy,sz),hex))}
function screenAt(list,gx,gz,y,w,h){list.push(place(new T.PlaneGeometry(w,h),gx*S,y,gz*S,-(Math.PI/2-PITCH)*.85,0,0))}
function mergeAdd(list,material,shadow){if(!list.length)return null;const m=new T.Mesh(T.BufferGeometryUtils.mergeBufferGeometries(list),material);
  if(shadow){m.castShadow=true;m.receiveShadow=true}scene.add(m);return m}

/* ---------- build the world ---------- */
function architecture(){
  // the same floor plan the 2D view draws, before its walls get their 2.5D faces
  const c=document.createElement('canvas');c.width=WW;c.height=WH;const g=c.getContext('2d');
  g.fillStyle=WALLC;g.fillRect(0,0,WW,WH);tiles(g,HALLS.slice(0,4),'#cfd8e4','#c2ccda');drawCoreFloor(g);
  for(const r of ROOMS){if(!/^(top|bot|left|right)$/.test(r.side))continue;
    const ix=r.side==='left'?10:r.side==='right'?WW-162:r.x+10,iy=r.side==='top'?10:r.side==='bot'?WH-162:r.y+10;
    const iw=(r.side==='left'||r.side==='right')?152:120,ih=(r.side==='left'||r.side==='right')?180:152;
    g.fillStyle='#ece2cf';g.fillRect(ix,iy,iw,ih);g.fillStyle='#e2d6c0';for(let k=iy+12;k<iy+ih;k+=16)g.fillRect(ix,k,iw,1);
    g.fillStyle='#ece2cf';if(r.side==='top')g.fillRect(r.x+40,150,60,20+FACE_H);if(r.side==='bot')g.fillRect(r.x+40,WH-180,60,30);
    if(r.side==='left')g.fillRect(150,r.y+70,30,60);if(r.side==='right')g.fillRect(WW-180,r.y+70,30,60)}
  archCanvas=c;
  // walls = pixels still in the wall color, merged into rectangles (the med room's counter is furniture, not wall)
  const d=g.getImageData(0,0,WW,WH).data,mw=WW>>1,mh=WH>>1;
  const raw=parseInt(WALLC.slice(1),16),R0=(raw>>16)&255,G0=(raw>>8)&255,B0=raw&255;
  const m=new Uint8Array(mw*mh);
  for(let j=0;j<mh;j++)for(let i=0;i<mw;i++){const x=i*2,y=j*2;if(x>=ISL.x&&x<ISL.x+ISL.w&&y>=ISL.y&&y<ISL.y+ISL.h)continue;
    const k=(y*WW+x)*4;if(d[k]===R0&&d[k+1]===G0&&d[k+2]===B0)m[j*mw+i]=1}
  const used=new Uint8Array(mw*mh),rects=[];
  for(let j=0;j<mh;j++)for(let i=0;i<mw;i++){const o=j*mw+i;if(!m[o]||used[o])continue;
    let w=1;while(i+w<mw&&m[o+w]&&!used[o+w])w++;
    let h=1;outer:while(j+h<mh){for(let q=0;q<w;q++){const p=(j+h)*mw+i+q;if(!m[p]||used[p])break outer}h++}
    for(let jj=j;jj<j+h;jj++)for(let ii=i;ii<i+w;ii++)used[jj*mw+ii]=1;rects.push([i*2,j*2,w*2,h*2])}
  return rects}
function paintFloor(walls){
  const g=floorCanvas.getContext('2d');g.drawImage(archCanvas,0,0);
  const half=document.createElement('canvas');half.width=WW/2;half.height=WH/2;half.getContext('2d').drawImage(floorCanvas,0,0,WW/2,WH/2);
  g.imageSmoothingEnabled=true;g.drawImage(half,0,0,WW,WH);
  const id=g.getImageData(0,0,WW,WH),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*9;d[i]+=n;d[i+1]+=n;d[i+2]+=n}g.putImageData(id,0,0);
  for(const [k,a] of [[6,.36],[16,.28]]){const c=document.createElement('canvas');c.width=Math.ceil(WW/k);c.height=Math.ceil(WH/k);const s=c.getContext('2d');s.fillStyle='#000';
    for(const [x,y,w,h] of walls)s.fillRect(x/k,y/k,w/k,h/k);for(const [x,y,w,h] of FURN)s.fillRect(x/k,y/k,w/k,h/k);
    g.save();g.globalAlpha=a;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(c,0,0,WW,WH);g.restore()}
  g.save();g.globalCompositeOperation='lighter';
  for(const [x,y] of LAMPS){const q=g.createRadialGradient(x,y,0,x,y,120);q.addColorStop(0,'rgba(255,214,160,.1)');q.addColorStop(1,'rgba(255,214,160,0)');g.fillStyle=q;g.fillRect(x-120,y-120,240,240)}
  g.restore();
  // the same floor signs as the 2D view, in the current language
  const I=ISL;floorLabel(g,tr('fl_mgr'),390,590,16);floorLabel(g,tr('fl_uc'),660,452,16);floorLabel(g,tr('fl_sup'),640,664,16);
  floorLabel(g,tr('fl_wc'),900,376,15);floorLabel(g,tr('fl_wc'),900,646,15);floorLabel(g,tr('fl_lounge'),900,526,16);floorLabel(g,tr('fl_edu'),1858,670,15);
  floorLabel(g,tr('fl_med'),I.x+I.w/2,I.y+122,15);floorLabel(g,tr('fl_elev'),WW-80,292,15);
  floorTex.needsUpdate=true;lastLang=LANG}

function furniture(){
  for(const r of ROOMS){if(!r.bed||!r.mon)continue;
    const b=r.bed,v=r.orient==='vt'||r.orient==='vb',bw=v?48:84,bd=v?84:48;FURN.push([b.x-bw/2,b.y-bd/2,bw,bd]);
    box(b.x-bw/2,b.y-bd/2,bw,bd,.03,.1,'#8b95aa');box(b.x-bw/2+2,b.y-bd/2+2,bw-4,bd-4,.13,.07,'#f2f5fb');
    const hd={vt:[0,-1],vb:[0,1],hl:[-1,0],hr:[1,0]}[r.orient];r.hd=hd;
    const hx=b.x+hd[0]*(bw/2-2),hz=b.y+hd[1]*(bd/2-2);
    if(v){box(b.x-bw/2,hz-2,bw,4,.03,.26,'#5f6c88');box(b.x-bw/2,b.y-hd[1]*(bd/2-2)-2,bw,4,.03,.17,'#5f6c88')}
    else{box(hx-2,b.y-bd/2,4,bd,.03,.26,'#5f6c88');box(b.x-hd[0]*(bw/2-2)-2,b.y-bd/2,4,bd,.03,.17,'#5f6c88')}
    const px=b.x+hd[0]*(v?0:28),pz=b.y+hd[1]*(v?28:0);r.pillow={x:px,y:pz};
    if(v)box(px-15,pz-7,30,14,.2,.05,'#ffffff');else box(px-7,pz-15,14,30,.2,.05,'#ffffff');
    const mn=r.mon,mx=mn.x+mn.w/2,mz=mn.y+mn.h/2;box(mx-2,mz-2,4,4,0,.42,'#3b4252');box(mn.x-2,mn.y-1,mn.w+4,mn.h+2,.42,.16,'#1a1f2b');
    if(r.orient==='vb'){GLOW.ecg.push(place(new T.PlaneGeometry(.21,.12),mx*S,.585,mz*S,-Math.PI/2+.35,0,0));r.alarmAt=[mx,mz,.588,-Math.PI/2+.35]}
    else{screenAt(GLOW.ecg,mx,mn.y+mn.h+3,.5,.21,.13);r.alarmAt=[mx,mn.y+mn.h+4,.5,-(Math.PI/2-PITCH)*.85]}
    cyl(r.iv.x,r.iv.y,.008,0,.62,'#b9c2d3');box(r.iv.x-4,r.iv.y-3,8,6,.36,.1,'#e7ecf5');box(r.iv.x-3,r.iv.y-1,6,2,.5,.11,'#cfe8ff');
    const o=r.orient;
    const st=o==='vt'?[b.x+30,b.y-40]:o==='vb'?[b.x+30,b.y+20]:o==='hl'?[b.x-40,b.y+30]:[b.x+20,b.y+30];
    const ch=o==='vt'?[r.x+18,r.y+108]:o==='vb'?[r.x+18,r.y+40]:o==='hl'?[r.x+110,r.y+150]:[r.x+38,r.y+150];
    const sk=o==='vt'?[r.x+104,r.y+126]:o==='vb'?[r.x+104,r.y+24]:o==='hl'?[r.x+126,r.y+24]:[r.x+24,r.y+24];
    box(st[0],st[1],20,20,0,.2,'#b38a5e');FURN.push([st[0],st[1],20,20]);
    box(ch[0],ch[1],22,22,0,.12,'#5d76b5');box(ch[0],ch[1],22,5,.12,.14,'#4a62a0');
    box(sk[0],sk[1],20,20,0,.2,'#e9eef6');box(sk[0]+4,sk[1]+4,12,12,.2,.012,'#9fb4c8');
    const w=r.win;GLOW.win.push(place(new T.PlaneGeometry(w.w*S,w.h*S),(w.x+w.w/2)*S,WALL+.004,(w.y+w.h/2)*S,-Math.PI/2));
    if(r.side==='top'||r.side==='bot'){const z=r.side==='top'?171:826;box(r.x+4,z,32,3,.3,.025,'#a5785a');box(r.x+104,z,32,3,.3,.025,'#a5785a')}}
  // station: a counter ring around the med room, drawers and the med dispenser inside
  const I=ISL,t=22;FURN.push([I.x,I.y,I.w,I.h]);
  for(const [x,y,w,h] of [[I.x,I.y,I.w,t],[I.x,I.y+I.h-t,I.w,t],[I.x,I.y,t,I.h],[I.x+I.w-t,I.y,t,I.h]]){box(x,y,w,h,0,.24,'#e0e6f0');box(x-2,y-2,w+4,h+4,.24,.035,'#9a6a45')}
  for(const x of [I.x+60,I.x+150,I.x+240]){box(x-16,I.y+3,32,6,.275,.13,'#1b2233');screenAt(GLOW.chart,x,I.y+10,.345,.27,.15)}
  for(let k=0;k<3;k++){box(I.x+40+k*58,I.y+34,44,62,0,.3,'#7c8aa8');for(let q=0;q<4;q++)box(I.x+44+k*58,I.y+40+q*14,36,9,.3,.01,'#5f6b86')}
  box(I.x+222,I.y+34,34,52,0,.42,'#f4f6fb');screenAt(GLOW.chart,I.x+239,I.y+88,.36,.13,.06);
  // the core: offices, supplies, restrooms, lounge, educator (same spots as the 2D view)
  const wood='#8b5e3c',top='#a2734d',white='#f4f6fb';
  const desk=(x,y,w,h)=>{box(x,y,w,h,0,.2,wood);box(x-2,y-2,w+4,h+4,.2,.025,top);FURN.push([x,y,w,h])};
  const chair=(x,y,c='#4b5a8a')=>{box(x,y,18,18,0,.11,c);box(x,y,18,4,.11,.12,tone(c,-.08))};
  const monitor=(x,y)=>{box(x-14,y,28,4,.225,.15,'#1b2233');screenAt(GLOW.chart,x,y+6,.3,.25,.14)};
  const plant=(x,y)=>{box(x-7,y-7,14,14,0,.1,'#8a5a2b');ball(x,y,.09,.19,'#2fae5e');ball(x-4,y-3,.06,.26,'#4cc777')};
  const bins=(x,y,n)=>{const cs=['#8fd0ff','#ffc2d6','#c2f0c8','#ffe39b','#d7c8f2'];for(let k=0;k<n;k++)box(x+k*22,y,16,14,.4,.07,cs[k%5])};
  desk(326,340,120,42);monitor(386,344);chair(377,394);chair(336,452,'#7c6aa8');chair(410,452,'#7c6aa8');
  box(452,520,18,150,0,.44,wood);FURN.push([452,520,18,150]);for(let k=0;k<6;k++)box(455,526+k*24,12,18,.44,.05,['#ff8fc4','#8fd0ff','#ffe39b','#c2f0c8','#d7c8f2','#ffb27a'][k]);
  plant(332,668);
  desk(596,322,186,34);monitor(626,326);monitor(682,326);box(730,332,16,12,.225,.08,'#ff4d5e');chair(624,366);chair(680,366);
  box(500,414,52,40,0,.18,'#c9ced8');FURN.push([500,414,52,40]);
  for(let k=0;k<3;k++){box(500,506+k*42,278,22,0,.4,'#9aa6b8');FURN.push([500,506+k*42,278,22]);bins(504,510+k*42,12)}
  for(const [ty,sy] of [[316,316],[656,662]]){box(950,ty,26,30,0,.16,white);box(950,ty+(ty<500?0:22),26,8,0,.26,white);box(818,sy,34,22,0,.2,white);box(826,sy+5,18,12,.2,.012,'#9fb4c8')}
  box(812,412,112,22,0,.24,'#a5a9b8');box(820,414,26,16,.24,.1,'#3b4252');box(858,414,16,18,.24,.13,'#14121f');GLOW.red.push(place(new T.BoxGeometry(.03,.03,.01),866*S,.33,431*S));
  box(946,410,40,52,0,.5,white);FURN.push([946,410,40,52]);
  box(836,452,92,44,0,.17,'#b78b5b');FURN.push([836,452,92,44]);chair(814,464,'#c78b5b');chair(934,464,'#c78b5b');
  box(826,556,124,30,0,.14,'#5d76b5');box(826,556,124,9,.14,.14,'#4a62a0');FURN.push([826,556,124,30]);
  desk(1700,608,96,34);monitor(1748,612);chair(1738,650);box(1814,600,108,6,0,.36,'#f6f8fb');desk(1700,668,70,16);
  // elevators at the east end of the top hallway
  box(WW-16,184,14,48,0,.5,'#9aa6b8');box(WW-16,236,14,48,0,.5,'#9aa6b8');box(WW-17,232,16,4,0,.5,'#5d6678');
  mergeAdd(STATIC,new T.MeshStandardMaterial({vertexColors:true,roughness:.6}),true);
  const ecgMat=new T.MeshBasicMaterial({map:ecgTex,toneMapped:false});ecgMat.color.setRGB(2.4,2.4,2.4);mergeAdd(GLOW.ecg,ecgMat);
  const chartTex=canvasTex(128,80,g=>{g.fillStyle='#071526';g.fillRect(0,0,128,80);g.fillStyle='#2de2e6';g.fillRect(6,6,116,10);g.fillStyle='rgba(45,226,230,.55)';
    for(let k=0;k<6;k++)g.fillRect(8,24+k*9,30+((k*37)%70),4);g.fillStyle='#ffd23f';g.fillRect(96,26,22,6)});
  const cm=new T.MeshBasicMaterial({map:chartTex,toneMapped:false});cm.color.setRGB(2,2,2);mergeAdd(GLOW.chart,cm);
  winMat=new T.MeshBasicMaterial({toneMapped:false});mergeAdd(GLOW.win,winMat);
  mergeAdd(GLOW.red,glowMat('#ff4d5e',4));
  STATIC=[];GLOW={ecg:[],chart:[],win:[],red:[]}}

function walls(rects){
  const pos=[],col=[],nor=[],C=h=>new T.Color(h),top=C('#262a47');
  const BANDS=[[0,.06,C('#30364d'),C('#3a4159')],[.06,.3,C('#8c97ad'),C('#b9c3d6')],[.3,.345,C('#1f9c96'),C('#2bb5ad')],[.345,WALL,C('#c7cfdf'),C('#dde3ee')]];
  const quad=(a,b,c,d,n,ca,cb,cc,cd)=>{for(const [p,q] of [[a,ca],[b,cb],[c,cc],[a,ca],[c,cc],[d,cd]]){pos.push(...p);col.push(q.r,q.g,q.b);nor.push(...n)}};
  for(const [x,y,w,h] of rects){const x0=x*S,x1=(x+w)*S,z0=y*S,z1=(y+h)*S;
    quad([x0,WALL,z0],[x0,WALL,z1],[x1,WALL,z1],[x1,WALL,z0],[0,1,0],top,top,top,top);
    for(const [[ax,az],[bx,bz],n] of [[[x0,z1],[x1,z1],[0,0,1]],[[x1,z0],[x0,z0],[0,0,-1]],[[x1,z1],[x1,z0],[1,0,0]],[[x0,z0],[x0,z1],[-1,0,0]]])
      for(const [y0,y1,c0,c1] of BANDS)quad([ax,y0,az],[bx,y0,bz],[bx,y1,bz],[ax,y1,az],n,c0,c0,c1,c1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.88}));m.castShadow=true;m.receiveShadow=true;scene.add(m)}

/* per-room pieces that change during the shift */
function roomBits(){
  const plaqueTex=num=>canvasTex(128,48,g=>{g.fillStyle='rgba(16,22,44,.92)';g.beginPath();g.roundRect?g.roundRect(4,4,120,40,9):g.rect(4,4,120,40);g.fill();
    g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=2;g.stroke();g.fillStyle='#fff';g.font='26px VT, monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(String(num),64,25)});
  const coverGeo=new T.PlaneGeometry(1,1),coverMat=new T.MeshBasicMaterial({color:'#05040f',transparent:true,opacity:.6,depthWrite:false});
  const offDome=mat('#5a4630',{roughness:.5}),domeGeo=new T.SphereGeometry(.032,12,8),signGeo=new T.ConeGeometry(.06,.16,4),cartGeo=new T.BoxGeometry(.16,.18,.12);
  const alarmGeo=new T.PlaneGeometry(.22,.14),alarmMat=glowMat('#ff2a3d',2.2);
  for(const r of ROOMS){if(!r.bed||!r.mon)continue;
    const b=r.bed,v=r.orient==='vt'||r.orient==='vb',g=new T.Group();
    const body=new T.Mesh(new T.CapsuleGeometry(.1,.36,4,12),new T.MeshStandardMaterial({color:'#8fc4ff',roughness:.7}));
    const fx=b.x-r.hd[0]*(v?0:10),fz=b.y-r.hd[1]*(v?10:0);body.position.set(fx*S,.215,fz*S);body.rotation.set(v?Math.PI/2:0,0,v?0:Math.PI/2);body.scale.set(1,1,.55);
    const head=new T.Mesh(new T.SphereGeometry(.072,16,12),new T.MeshStandardMaterial({color:'#eabd94',roughness:.6}));
    head.position.set((r.pillow.x-r.hd[0]*2)*S,.29,(r.pillow.y-r.hd[1]*2)*S);
    const hair=new T.Mesh(new T.SphereGeometry(.075,16,12),new T.MeshStandardMaterial({color:'#3a2416',roughness:.5}));
    hair.position.set((r.pillow.x+r.hd[0]*4)*S,.3,(r.pillow.y+r.hd[1]*4)*S);hair.scale.set(1,.8,1);
    const fall=new T.Mesh(new T.BoxGeometry(v?.44:.05,.02,v?.05:.44),glowMat('#ffd23f',1.6));fall.position.set((b.x-r.hd[0]*(v?0:30))*S,.27,(b.y-r.hd[1]*(v?30:0))*S);
    g.add(body,head,hair,fall);g.traverse(o=>{if(o.isMesh)o.castShadow=true});g.visible=false;scene.add(g);
    const dome=new T.Mesh(domeGeo,offDome);dome.userData.off=offDome;dome.position.set(r.dome.x*S,WALL+.03,r.dome.y*S);scene.add(dome);
    const cover=new T.Mesh(coverGeo,coverMat);cover.rotation.x=-Math.PI/2;cover.scale.set(r.w*S,r.h*S,1);cover.position.set((r.x+r.w/2)*S,WALL+.006,(r.y+r.h/2)*S);cover.renderOrder=2;scene.add(cover);
    const sx=r.side==='left'?r.door.x-34:r.side==='right'?r.door.x+34:r.door.x+34,sy=r.side==='top'?r.door.y-30:r.side==='bot'?r.door.y+30:r.door.y+26;
    const sign=new T.Mesh(signGeo,mat('#ffd23f'));sign.position.set(sx*S,.08,sy*S);sign.rotation.y=Math.PI/4;sign.castShadow=true;sign.visible=false;scene.add(sign);
    const cart=new T.Group(),cb=new T.Mesh(cartGeo,mat('#e0a400'));cb.position.y=.09;const ct=new T.Mesh(new T.BoxGeometry(.15,.02,.11),mat('#ffffff'));ct.position.y=.19;
    cart.add(cb,ct);cart.position.set((r.ppe.x+8)*S,0,(r.ppe.y+6)*S);cart.visible=false;scene.add(cart);
    const fr=new T.Group(),fm=new T.MeshBasicMaterial({transparent:true,opacity:.8,toneMapped:false,depthWrite:false});fm.color.set('#2de2e6').multiplyScalar(2.2);
    const w=(v?56:92)*S,h=(v?92:56)*S;for(const [x,z,a,c] of [[0,-h/2,w,.012],[0,h/2,w,.012],[-w/2,0,.012,h],[w/2,0,.012,h]]){const e=new T.Mesh(new T.BoxGeometry(a,.012,c),fm);e.position.set(x,.32,z);fr.add(e)}
    fr.position.set(b.x*S,0,b.y*S);fr.visible=false;scene.add(fr);
    const al=new T.Mesh(alarmGeo,alarmMat);const [ax,az,ay,arx]=r.alarmAt;al.position.set(ax*S,ay+.002,az*S);al.rotation.x=arx;al.visible=false;scene.add(al);
    const pq=new T.Sprite(new T.SpriteMaterial({map:plaqueTex(r.num),transparent:true,depthWrite:false}));pq.scale.set(.3,.1125,1);
    const d=r.door,side=r.side;pq.position.set((d.x+(side==='top'||side==='bot'?48:side==='left'?-4:4))*S,WALL+.1,(d.y+(side==='left'||side==='right'?46:side==='top'?-4:4))*S);scene.add(pq);
    const into=side==='top'?[0,-1]:side==='bot'?[0,1]:side==='left'?[-1,0]:[1,0];
    r.g3={g,body,head,hair,fall,dome,cover,sign,cart,fr,fm,al,pq,ptId:null,front:{x:d.x-into[0]*34,y:d.y-into[1]*34}}}}

/* ---------- people: soft cartoon style (big expressive eyes, rosy cheeks, full hair), female or male ----------
   Each look is built once into a handful of merged meshes (legs, torso, arms, head with face, hair, eye shine), so a busy unit stays light. */
const GEO={};let blobMat,glintMat,skinMat;
function geos(){GEO.blob=new T.PlaneGeometry(.5,.5);skinMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.62})}
const EYES=['#3b2416','#2b1a12','#2d4f73','#35603f','#4a2f1d'];
function lookHash(L){return ((L.skin|0)*7+(L.style|0)*13+(L.hairc|0)*17+(L.gl?5:0)+(L.bd?11:0)+(L.cap?3:0))>>>0}
function chibiOf(L,role){
  const skin=SKINS[L.skin]||SKINS[1],hair=HAIRC[L.hairc]||HAIRC[1],style=STYLES[L.style]||'short',h=lookHash(L);
  let scrub=L.scrubC||scrubById(L.scrub).c,top=scrub,pants=tone(scrub,-.07),shoe='#f4f6fa',steth=true,badge='#ffffff';
  const r=L.role||role;
  if(r==='md'){top='#f6f7fb';pants='#3d4a66';shoe='#2a2c36'}
  if(r==='cna')steth=false;
  if(r==='res')badge='#ffd23f';
  if(r==='evs'){top=scrub='#2f8f8a';pants='#26605d';steth=false;shoe='#3b4252'}
  if(r==='vis'){top=scrub=L.shirt||'#e05a5a';pants='#3d5a8a';steth=false;badge=null}
  const body=L.body||(L.bd?'m':/^(long|bun|pony)$/.test(style)?'f':(h%3===0?'f':'m'));
  return {skin,hair,style,scrub,top,pants,shoe,steth,badge,coat:r==='md',gl:!!L.gl,bd:!!L.bd&&body==='m',cap:!!L.cap,body,eye:EYES[h%EYES.length]}}
const charGeo=new Map();
function P_(geo,hex,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){return tint(place(geo,x,y,z,rx,ry,rz,sx,sy,sz),hex)}
const MG=list=>T.BufferGeometryUtils.mergeBufferGeometries(list);
function charSet(o){
  const key=JSON.stringify(o);let s=charGeo.get(key);if(s)return s;
  const F=o.body==='f',HR=.13,ax=F?.09:.104,Sph=(r,w=16,h=12)=>new T.SphereGeometry(r,w,h),Cap=(r,l,c=4,rs=10)=>new T.CapsuleGeometry(r,l,c,rs);
  // legs: pants and white sneakers (pivot at the hip)
  const leg=MG([P_(Cap(F?.037:.04,.17,6,12),o.pants,0,-.12,0),P_(Sph(.046,16,12),o.shoe,0,-.247,.02,0,0,0,.82,.5,1.45),P_(Sph(.044,14,10),tone(o.shoe,-.12),0,-.257,.022,0,0,0,.84,.22,1.47)]);
  // torso: a soft lathed shape, V-neck, pocket, badge, stethoscope
  const prof=(F?[[0,.24],[.086,.24],[.09,.27],[.08,.31],[.072,.34],[.079,.385],[.084,.415],[.073,.44],[.045,.462],[.03,.472],[0,.472]]
                :[[0,.24],[.088,.24],[.091,.275],[.086,.32],[.088,.37],[.098,.415],[.094,.442],[.06,.465],[.034,.474],[0,.474]]).map(([x,y])=>new T.Vector2(x,y));
  const tor=[P_(new T.LatheGeometry(prof,26),o.top,0,0,0,0,0,0,1,1,.78)];
  if(o.coat){const cp=prof.map(v=>new T.Vector2(v.x+.01,v.y));cp.unshift(new T.Vector2(0,.15),new T.Vector2(.096,.15));tor.length=0;tor.push(P_(new T.LatheGeometry(cp,26),o.top,0,0,0,0,0,0,1,1,.8));
    tor.push(P_(Sph(.05,14,10),o.scrub,0,.385,.066,0,0,0,.62,1.3,.3));for(const sd of [-1,1])tor.push(P_(new T.BoxGeometry(.012,.11,.006),'#e3e7ef',sd*.03,.39,.077,0,0,sd*.25))}
  tor.push(P_(new T.ConeGeometry(.03,.06,3),o.skin,0,.445,.058,Math.PI,0,0,1,1,.3));
  if(!o.coat)tor.push(P_(new T.BoxGeometry(.042,.036,.006),tone(o.top,-.05),.046,.378,.066));
  if(o.badge)tor.push(P_(new T.BoxGeometry(.026,.034,.007),o.badge,-.044,.398,.066));
  if(o.steth){tor.push(P_(new T.TorusGeometry(.058,.0062,6,22,Math.PI*1.15),'#3d4352',0,.452,.008,Math.PI/2-.3,0,Math.PI*.93));
    for(const sd of [-1,1])tor.push(P_(Cap(.0058,.06,2,6),'#3d4352',sd*.034,.405,.07,.1,0,0));tor.push(P_(Sph(.015,10,8),'#c9ced8',.034,.358,.074,0,0,0,1,1,.6))}
  // arms: short sleeves, then skin (long white sleeves for the doctor's coat)
  const arm=o.coat?MG([P_(Cap(.031,.145,4,10),o.top,0,-.088,0),P_(Sph(.027,12,10),o.skin,0,-.19,0)])
                  :MG([P_(Cap(.032,.042,4,10),o.top,0,-.036,0),P_(Cap(.023,.1,4,10),o.skin,0,-.122,0),P_(Sph(.027,12,10),o.skin,0,-.19,0)]);
  // head: skull, ears, nose, big eyes, lashes or lids, brows, smile, rosy cheeks, glasses
  const hp=[P_(Sph(HR,32,24),o.skin,0,0,0,0,0,0,F?1:1.03,.97,.95)];
  for(const sd of [-1,1])hp.push(P_(Sph(.026,12,10),o.skin,sd*HR*.98,-.012,-.005,0,0,0,.5,1,.75));
  hp.push(P_(Sph(.011,10,8),tone(o.skin,-.05),0,-.022,.124));
  const glint=[];
  for(const sd of [-1,1]){const ex=sd*.05,ez=.112;
    hp.push(P_(Sph(.034,18,14),'#ffffff',ex,-.005,ez,0,0,0,1,1.2,.5));
    hp.push(P_(Sph(.026,16,12),o.eye,ex,-.01,ez+.012,0,0,0,1,1.15,.45));
    hp.push(P_(Sph(.014,12,10),'#120c0a',ex,-.012,ez+.02,0,0,0,1,1.1,.4));
    glint.push(P_(Sph(.008,8,6),'#ffffff',ex-sd*.006,.006,ez+.025),P_(Sph(.0042,6,5),'#ffffff',ex+sd*.008,-.022,ez+.024));
    hp.push(P_(new T.TorusGeometry(.0355,F?.0068:.0042,4,14,Math.PI*.92),'#1b1418',ex,-.004,ez+.004,0,0,Math.PI*.04));
    if(F)for(const k of [0,1])hp.push(P_(Cap(.0035,.014,2,4),'#1b1418',ex+sd*(.033+k*.004),.012+k*.01,ez+.002,0,0,sd*-(1+k*.35)));
    hp.push(P_(Cap(F?.0052:.0085,.026,3,6),tone(o.hair,-.08),ex,.06,.103,0,0,Math.PI/2+sd*(F?.16:.06)));
    hp.push(P_(Sph(.023,12,8),'#ff9aa8',sd*.071,-.042,.1,0,0,0,1,.58,.3));
    if(o.gl)hp.push(P_(new T.TorusGeometry(.04,.0052,6,20),'#1b1b25',ex,-.004,ez+.02))}
  if(o.gl)hp.push(P_(new T.BoxGeometry(.028,.0055,.006),'#1b1b25',0,.004,.134));
  hp.push(P_(new T.TorusGeometry(.019,.0055,6,14,Math.PI),'#8c2f3c',0,-.054,o.bd?.124:.112,0,0,Math.PI));
  // hair: a cap that leaves the forehead, plus bangs and the chosen style; the classic white nurse cap with a blue cross
  const hc=o.hair,HC=HR*1.09,hr=[];
  hr.push(P_(new T.SphereGeometry(HC,30,20,0,Math.PI*2,0,Math.PI*.55),hc,0,.008,-.01,-.42,0,0,1,o.style==='buzz'?.95:1,1));
  if(o.style!=='buzz'){
    if(F||/^(long|bun|pony|curly)$/.test(o.style)){for(const [x,y,z] of [[-.062,.074,.088],[0,.086,.098],[.062,.074,.088]])hr.push(P_(Sph(.05,14,10),hc,x,y,z,0,0,0,1.05,.55,.55));
      for(const sd of [-1,1])hr.push(P_(Sph(.06,14,10),hc,sd*.112,-.03,.012,0,0,0,.72,1.25,.9));hr.push(P_(Sph(.12,20,14),hc,0,-.035,-.058,0,0,0,1.06,1,.82))}
    else hr.push(P_(Sph(.06,14,10),hc,.03,.09,.085,0,0,-.2,1.45,.5,.6),P_(Sph(.05,14,10),hc,-.06,.082,.08,0,0,.25,1,.5,.55))}
  if(o.style==='long'){hr.push(P_(Cap(.115,.13,8,16),hc,0,-.1,-.06,0,0,0,1.1,1,.7));for(const sd of [-1,1])hr.push(P_(Cap(.038,.13,4,10),hc,sd*.118,-.085,.03))}
  if(o.style==='bun')hr.push(P_(Sph(.062,16,12),hc,0,.14,-.07));
  if(o.style==='pony'){hr.push(P_(Sph(.022,10,8),'#ff8fc4',0,.05,-.148),P_(Cap(.04,.13,6,10),hc,0,-.04,-.185,.5,0,0))}
  if(o.style==='curly')for(let k=0;k<12;k++){const a=k/12*Math.PI*2;hr.push(P_(Sph(.05,10,8),hc,Math.cos(a)*.118,.03+Math.sin(k*1.9)*.035,Math.sin(a)*.104-.02))}
  if(o.bd)hr.push(P_(new T.SphereGeometry(HR*1.02,24,14,0,Math.PI*2,Math.PI*.64,Math.PI*.36),tone(hc,.03),0,-.004,.004));
  if(o.cap){hr.push(P_(Sph(.1,24,16),'#ffffff',0,.118,.036,-.42,0,0,1.28,.5,.86),P_(Sph(.098,24,16),'#e9eef6',0,.098,.03,-.42,0,0,1.3,.2,.88));
    hr.push(P_(new T.BoxGeometry(.044,.013,.006),'#5d9de0',0,.128,.112,-.42,0,0),P_(new T.BoxGeometry(.013,.044,.006),'#5d9de0',0,.128,.112,-.42,0,0))}
  s={leg,tor:MG(tor),arm,head:MG(hp),hair:MG(hr),glint:MG(glint),ax};charGeo.set(key,s);return s}
function makeChibi(o,scale,parent){
  const s=charSet(o),root=new T.Group(),body=new T.Group();root.add(body);const P2={};
  const mesh=g=>{const m=new T.Mesh(g,skinMat);m.castShadow=true;return m};
  for(const sd of [-1,1]){const hip=new T.Group();hip.position.set(sd*.046,.27,0);hip.add(mesh(s.leg));body.add(hip);P2[sd<0?'legL':'legR']=hip}
  body.add(mesh(s.tor));
  for(const sd of [-1,1]){const sh=new T.Group();sh.position.set(sd*s.ax,.432,0);sh.add(mesh(s.arm));sh.rotation.z=sd*.13;body.add(sh);P2[sd<0?'armL':'armR']=sh}
  const head=new T.Group();head.position.y=.585;body.add(head);P2.head=head;head.add(mesh(s.head),mesh(s.hair),new T.Mesh(s.glint,glintMat));
  const blob=new T.Mesh(GEO.blob,blobMat);blob.rotation.x=-Math.PI/2;blob.position.y=.004;root.add(blob);
  root.scale.setScalar(scale||1.1);(parent||scene).add(root);
  return {root,body,P:P2,ph:Math.random()*6,lx:null,ly:null,mv:0}}
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

/* the female player is the textured nurse model (nurse_f.glb next to the page); the code-built nurse stands in until it loads */
const NURSE_URL='nurse_f.glb';let NURSE=null,nurseState=0;   // 0 not asked, 1 loading, 2 ready, 3 unavailable
function bodyOf(L){return chibiOf(L,'').body}
function loadNurse(){if(nurseState||!T.GLTFLoader||!T.SkeletonUtils)return;nurseState=1;
  try{new T.GLTFLoader().load(NURSE_URL,g=>{let meta=null,mesh=null;g.scene.traverse(o=>{if(o.userData&&o.userData.mean)meta=o.userData;if(o.isSkinnedMesh)mesh=o});
      const idle=g.animations.find(a=>a.name==='idle'),walk=g.animations.find(a=>a.name==='walk');
      if(!mesh||!meta||!idle||!walk){nurseState=3;console.warn('nurse model: missing parts');return}
      NURSE={scene:g.scene,idle,walk,h:meta.height||97.9,speed:meta.walkSpeed||55,mean:meta.mean};nurseState=2;
      const me=people.get('me');if(me)me.lk='';if(pv&&pv.L){pv.lk='';preview(pv.L)}},
    undefined,e=>{nurseState=3;console.warn('nurse model unavailable',e)})}catch(e){nurseState=3;console.warn(e)}}
function nurseColors(L){return {scrub:L.scrubC||scrubById(L.scrub).c,skin:SKINS[L.skin]||SKINS[1],hair:HAIRC[L.hairc]||HAIRC[1]}}
const NURSE_H=.86;   // the player's height in world units, like the code-built nurse
function makeNurse(L,scale,parent){
  const root=new T.Group(),body=T.SkeletonUtils.clone(NURSE.scene);root.add(body);
  const k=NURSE_H/NURSE.h*(scale||1.18)/1.18;body.scale.setScalar(k);
  let m=null;body.traverse(o=>{if(o.isSkinnedMesh){o.material=m=nurseMaterial(o.material,NURSE.mean);o.castShadow=true;o.frustumCulled=false}});
  tintNurse(m,nurseColors(L));
  const mixer=new T.AnimationMixer(body),idle=mixer.clipAction(NURSE.idle),walk=mixer.clipAction(NURSE.walk);
  idle.play();walk.play();walk.setEffectiveWeight(0);idle.time=Math.random()*NURSE.idle.duration;
  const blob=new T.Mesh(GEO.blob,blobMat);blob.rotation.x=-Math.PI/2;blob.position.y=.004;blob.scale.setScalar(scale||1.18);root.add(blob);
  (parent||scene).add(root);
  return {root,body,model:true,mixer,idle,walk,w:0,spS:0,natural:NURSE.speed*k/S,ph:0,lx:null,ly:null,mv:0,blob}}
/* idle and walk blend by speed; the walk plays faster when she hurries (capped, so feet slide a little at full speed) */
function stepNurse(c,dt,sp){c.spS+=(sp-c.spS)*Math.min(1,dt*8);const tw=c.mv>.5?1:0;c.w+=(tw-c.w)*Math.min(1,dt*9);
  c.walk.setEffectiveWeight(c.w);c.idle.setEffectiveWeight(1-c.w);c.walk.timeScale=cl(c.spS/c.natural,.9,2.3);c.mixer.update(dt)}
const people=new Map();let stamp=0;
function person(key,L,role,x,y,dir,scale){
  const useM=key==='me'&&nurseState===2&&bodyOf(L)==='f';
  const lk=lookKey(L)+'|'+(L.body||'')+'|'+(role||'')+'|'+(scale||1.1)+(useM?'|model':'');let c=people.get(key);
  if(c&&c.lk!==lk){scene.remove(c.root);people.delete(key);c=null}
  if(!c){c=useM?makeNurse(L,scale):makeChibi(chibiOf(L,role),scale);c.lk=lk;people.set(key,c);c.root.rotation.y={down:0,up:Math.PI,left:-Math.PI/2,right:Math.PI/2}[dir]||0}
  c.seen=stamp;c.x=x;c.y=y;c.dir=dir;c.root.visible=true;return c}
function stepPeople(dt){
  for(const [k,c] of people){if(c.seen!==stamp){c.root.visible=false;if(stamp-c.seen>240){scene.remove(c.root);people.delete(k)}continue}
    const dx=c.lx==null?0:c.x-c.lx,dy=c.ly==null?0:c.y-c.ly,sp=Math.hypot(dx,dy)/Math.max(dt,1e-3);c.lx=c.x;c.ly=c.y;
    c.mv=c.mv*.7+(sp>12?1:0)*.3;const moving=c.mv>.5;
    if(c.model)stepNurse(c,dt,sp);else{
    c.ph+=dt*(moving?11:2);const s=Math.sin(c.ph),amp=moving?.5:0;
    c.P.legL.rotation.x=s*amp;c.P.legR.rotation.x=-s*amp;c.P.armL.rotation.x=-s*amp*.9;c.P.armR.rotation.x=s*amp*.9;
    c.body.position.y=moving?Math.abs(Math.cos(c.ph))*.016:Math.sin(c.ph)*.003;c.P.head.rotation.z=moving?Math.sin(c.ph)*.04:Math.sin(c.ph*.5)*.02}
    c.root.position.set(c.x*S,0,c.y*S);
    const face=sp>12?Math.atan2(dx,dy):({down:0,up:Math.PI,left:-Math.PI/2,right:Math.PI/2}[c.dir]);
    if(face!=null){let d=face-c.root.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));c.root.rotation.y+=d*Math.min(1,dt*14)}}}
/* stretchers and wheelchairs */
const rides=new Map();
function ride(tp){let o=rides.get(tp);
  if(!o){const g=new T.Group();
    if(tp.kind==='stretcher'){const f=new T.Mesh(new T.BoxGeometry(.24,.08,.4),mat('#c4ccda'));f.position.y=.2;const m2=new T.Mesh(new T.BoxGeometry(.21,.04,.37),mat('#ffffff'));m2.position.y=.26;
      const bl=new T.Mesh(new T.BoxGeometry(.21,.035,.22),mat('#a9d1f5'));bl.position.set(0,.29,.07);const hd=new T.Mesh(new T.SphereGeometry(.055,14,10),mat(SKINS[tp.look.skin]||SKINS[1]));hd.position.set(0,.31,-.12);
      g.add(f,m2,bl,hd);for(const x of [-.1,.1])for(const z of [-.17,.17]){const w=new T.Mesh(new T.CylinderGeometry(.018,.018,.16,8),mat('#3b4252'));w.position.set(x,.08,z);g.add(w)}}
    else{const seat=new T.Mesh(new T.BoxGeometry(.2,.06,.18),mat('#3b4252'));seat.position.y=.17;const back=new T.Mesh(new T.BoxGeometry(.2,.18,.03),mat('#5d6782'));back.position.set(0,.26,-.09);
      const hd=new T.Mesh(new T.SphereGeometry(.06,14,10),mat(SKINS[tp.look.skin]||SKINS[1]));hd.position.set(0,.37,-.02);const bd=new T.Mesh(new T.CapsuleGeometry(.07,.08,4,10),mat('#a9d1f5'));bd.position.set(0,.25,0);
      g.add(seat,back,hd,bd);for(const s of [-1,1]){const w=new T.Mesh(new T.TorusGeometry(.085,.014,6,16),mat('#14121f'));w.rotation.y=Math.PI/2;w.position.set(s*.11,.09,0);g.add(w)}}
    g.traverse(m=>{if(m.isMesh)m.castShadow=true});g.scale.setScalar(1.25);scene.add(g);o={g};rides.set(tp,o)}
  o.seen=stamp;o.g.visible=true;o.g.position.set(tp.x*S,0,tp.y*S);o.g.rotation.y={down:0,up:Math.PI,left:-Math.PI/2,right:Math.PI/2}[tp.dir]||0;return o}
const carts=new Map();
function evsCart(n){let g=carts.get(n);if(!g){g=new T.Group();const b=new T.Mesh(new T.BoxGeometry(.16,.12,.12),mat('#5a6178'));b.position.y=.1;
    const k=new T.Mesh(new T.BoxGeometry(.07,.07,.07),mat('#ffd23f'));k.position.set(-.03,.2,0);const mop=new T.Mesh(new T.CylinderGeometry(.006,.006,.3,6),mat('#c9ced8'));mop.position.set(.05,.28,0);
    g.add(b,k,mop);g.traverse(m=>{if(m.isMesh)m.castShadow=true});g.scale.setScalar(1.3);scene.add(g);carts.set(n,g)}
  g.seen=stamp;g.visible=true;g.position.set((n.x+(n.dir==='left'?-22:22))*S,0,(n.y-4)*S)}

/* ---------- items, orbs, rings, particles, codes ---------- */
let dotTex,ringTex,starMat;const iconTex=new Map();
function iconT(name){let t=iconTex.get(name);if(!t){t=new T.CanvasTexture(iconCanvas(name));t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;t.encoding=T.sRGBEncoding;iconTex.set(name,t)}return t}
const pool={items:[],orbs:[],rings:[]};
function sprite(list,i,make){if(!list[i]){list[i]=make();scene.add(list[i])}list[i].visible=true;return list[i]}
let pts,pPos,pCol,PMAX=700;const anchors=new WeakMap();
const boltSets=[],colCache=new Map();
function colorOf(hex){let c=colCache.get(hex);if(!c){c=new T.Color(hex);colCache.set(hex,c)}return c}
function boltMesh(width,m){const g=new T.BufferGeometry(),n=12;g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*6),3));
  const idx=[];for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}g.setIndex(idx);const me=new T.Mesh(g,m);me.frustumCulled=false;me.renderOrder=5;scene.add(me);return {m:me,n,width}}
function makeBolts(){const core=new T.MeshBasicMaterial({transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const halo=new T.MeshBasicMaterial({transparent:true,opacity:.62,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const set=[];for(let k=0;k<6;k++)set.push([boltMesh(.016,core),boltMesh(.07,halo)]);return {set,core,halo,t:0,room:null}}
function shapeBolt(b,x0,y0,z0,x1,y1,z1,side,w){const p=b.m.geometry.attributes.position.array,n=b.n,dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1,nx=side?1:-dz/L,nz=side?0:dx/L;
  for(let i=0;i<n;i++){const t=i/(n-1),j=(i===0||i===n-1)?0:rr(-1,1)*.1,x=x0+dx*t+nx*j,z=z0+dz*t+nz*j,y=y0+(y1-y0)*t+(side?0:Math.sin(t*Math.PI)*.14),ww=w*(1-t*.6);
    p.set([x+nx*ww,y,z+nz*ww,x-nx*ww,y,z-nz*ww],i*6)}b.m.geometry.attributes.position.needsUpdate=true}

/* ---------- init ---------- */
function init(){
  canvas3=document.getElementById('g3d');
  if(!canvas3){canvas3=document.createElement('canvas');canvas3.id='g3d';canvas3.setAttribute('aria-hidden','true');cv.parentNode.insertBefore(canvas3,cv)}
  R=new T.WebGLRenderer({canvas:canvas3,antialias:false,powerPreference:'high-performance'});
  R.setPixelRatio(Math.min(window.devicePixelRatio||1,COARSE?1.5:2));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.toneMapping=T.NoToneMapping;
  scene=new T.Scene();scene.background=new T.Color('#05080f');scene.fog=new T.Fog('#05080f',12,26);
  camera=new T.PerspectiveCamera(36,1,.8,60);
  const canFloat=R.capabilities.isWebGL2&&(R.extensions.has('EXT_color_buffer_float')||R.extensions.has('EXT_color_buffer_half_float'));
  composer=new T.EffectComposer(R,new T.WebGLRenderTarget(4,4,{type:canFloat?T.HalfFloatType:T.UnsignedByteType}));composer.addPass(new T.RenderPass(scene,camera));
  bloom=new T.UnrealBloomPass(new T.Vector2(256,256),.85,.55,canFloat?1:.86);composer.addPass(bloom);
  outPass=new T.ShaderPass({uniforms:{tDiffuse:{value:null},exposure:{value:1.3},vig:{value:.9}},
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:['uniform sampler2D tDiffuse; uniform float exposure; uniform float vig; varying vec2 vUv;',
      'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }',
      'vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c)); }',
      'void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb*exposure; vec2 q=vUv-0.5; c=aces(c); c*=clamp(1.0-vig*dot(q,q)*1.45,0.0,1.0); gl_FragColor=vec4(toSRGB(c),1.0); }'].join('\n')});
  composer.addPass(outPass);
  hemi=new T.HemisphereLight('#6d8de0','#100d1a',.36);scene.add(hemi);
  sun=new T.DirectionalLight('#ffe2c4',.55);sun.castShadow=true;sun.shadow.mapSize.set(COARSE?1024:2048,COARSE?1024:2048);
  Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.5,far:30});sun.shadow.bias=-.0025;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  for(let x=120;x<WW;x+=280)LAMPS.push([x,235],[x,765]);for(const x of [235,1060,2005])LAMPS.push([x,410],[x,600]);LAMPS.push([1250,345],[1780,345],[1250,640],[1800,470]);
  for(let i=0;i<(COARSE?5:7);i++){const l=new T.PointLight('#ffcf95',0,4.4,2);l.position.y=1.55;scene.add(l);lampPool.push(l)}
  for(let i=0;i<3;i++){const l=new T.PointLight('#ffae3d',0,1.7,2);scene.add(l);callPool.push(l)}
  for(let i=0;i<2;i++){const l=new T.PointLight('#3d7bff',0,3.2,2);scene.add(l);codeLights.push(l)}
  dotTex=canvasTex(64,64,g=>{const q=g.createRadialGradient(32,32,0,32,32,32);q.addColorStop(0,'rgba(255,255,255,1)');q.addColorStop(.25,'rgba(255,255,255,.75)');q.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=q;g.fillRect(0,0,64,64)},false);
  ringTex=canvasTex(128,128,g=>{g.strokeStyle='#fff';g.lineWidth=7;g.beginPath();g.arc(64,64,58,0,7);g.stroke()},false);
  const blobTex=canvasTex(64,64,g=>{const q=g.createRadialGradient(32,32,0,32,32,32);q.addColorStop(0,'rgba(0,0,0,.75)');q.addColorStop(.6,'rgba(0,0,0,.35)');q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(0,0,64,64)},false);
  blobMat=new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.65});glintMat=new T.MeshBasicMaterial({color:'#ffffff'});
  const starTex=canvasTex(64,64,g=>{const q=g.createRadialGradient(32,32,2,32,32,32);q.addColorStop(0,'rgba(255,240,170,.9)');q.addColorStop(1,'rgba(255,200,60,0)');g.fillStyle=q;g.fillRect(0,0,64,64);
    g.fillStyle='#ffd23f';g.strokeStyle='#fff6c8';g.lineWidth=2;g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?9:20;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.closePath();g.fill();g.stroke()});
  starMat=new T.SpriteMaterial({map:starTex,transparent:true,depthWrite:false});starMat.color.setRGB(1.8,1.6,1.1);
  ecgTex=canvasTex(256,64,g=>{g.fillStyle='#04140c';g.fillRect(0,0,256,64);g.strokeStyle='rgba(80,255,150,.18)';g.lineWidth=1;for(let x=0;x<256;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,64);g.stroke()}
    g.strokeStyle='#6dffb0';g.lineWidth=3;g.beginPath();for(let x=0;x<=256;x++){const p=x%64;let y=40;if(p>20&&p<24)y=40-(p-20)*2;else if(p>=24&&p<27)y=32+(p-24)*3;else if(p>=30&&p<33)y=40-(p-30)*9;
      else if(p>=33&&p<36)y=13+(p-33)*12;else if(p>=36&&p<38)y=49-(p-36)*4.5;else if(p>44&&p<52)y=40-Math.sin((p-44)/8*Math.PI)*6;x?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()});
  ecgTex.wrapS=T.RepeatWrapping;
  geos();loadNurse();
  furniture();
  const rects=architecture();walls(rects);
  floorCanvas=document.createElement('canvas');floorCanvas.width=WW;floorCanvas.height=WH;floorTex=new T.CanvasTexture(floorCanvas);floorTex.encoding=T.sRGBEncoding;
  floorTex.anisotropy=R.capabilities.getMaxAnisotropy();paintFloor.rects=rects;paintFloor(rects);
  const floor=new T.Mesh(new T.PlaneGeometry(WW*S,WH*S),new T.MeshStandardMaterial({map:floorTex,color:'#8195ae',roughness:.36}));floor.rotation.x=-Math.PI/2;floor.position.set(WW*S/2,0,WH*S/2);floor.receiveShadow=true;scene.add(floor);
  const ground=new T.Mesh(new T.PlaneGeometry(80,60),new T.MeshStandardMaterial({color:'#0b0f1c',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(WW*S/2,-.4,WH*S/2);scene.add(ground);
  roomBits();
  const pg=new T.BufferGeometry();pPos=new Float32Array(PMAX*3);pCol=new Float32Array(PMAX*3);pg.setAttribute('position',new T.BufferAttribute(pPos,3));pg.setAttribute('color',new T.BufferAttribute(pCol,3));
  pts=new T.Points(pg,new T.PointsMaterial({size:.07,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));pts.frustumCulled=false;scene.add(pts);
  const careM=new T.MeshBasicMaterial({map:ringTex,transparent:true,opacity:.35,depthWrite:false,toneMapped:false});careM.color.set('#2de2e6').multiplyScalar(1.4);
  init.care=new T.Mesh(new T.PlaneGeometry(2,2),careM);init.care.rotation.x=-Math.PI/2;init.care.position.y=.012;scene.add(init.care);
  const beamM=new T.MeshBasicMaterial({transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});beamM.color.set('#ffd23f').multiplyScalar(2.2);
  init.beam=new T.Mesh(new T.CylinderGeometry(.008,.008,1,6),beamM);init.beam.visible=false;scene.add(init.beam);
  for(let i=0;i<2;i++)boltSets.push(makeBolts());
  canvas3.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block';
  ready=true;return true}

/* ---------- per-frame sync ---------- */
function fit(){const w=VW,h=VH;if(w===lastW&&h===lastH)return;lastW=w;lastH=h;R.setSize(w,h,false);composer.setPixelRatio(R.getPixelRatio());composer.setSize(w,h);
  camera.aspect=w/h;const hf=2*Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov)/2)*camera.aspect);
  const span=camera.aspect<1?7.4:Math.min(16,7.4+(camera.aspect-1)*8.5);camera.userData.span=span;const dist=cl(span/(2*Math.tan(hf/2)),5,32);camera.userData.dist=dist;
  scene.fog.near=dist+3;scene.fog.far=dist*1.6+14;camera.far=dist*2.4+20;camera.updateProjectionMatrix()}
const tgt=new T.Vector3(cam.x*S,0,cam.y*S);
/* upright phone: place the unit so it sits in the middle of the space between the top bar and the bottom panels */
function centerZ(d,h0){const want=(70+(VH-120))/2/VH*2-1;let lo=-6,hi=WH*S+6;
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;camera.position.set(0,h0,mid+Math.cos(PITCH)*d);camera.lookAt(0,0,mid);camera.updateMatrixWorld();
    _c1.set(0,0,0).project(camera);_c2.set(0,0,WH*S).project(camera);const m=-(_c1.y+_c2.y)/2;
    if(m>want)lo=mid;else hi=mid}
  return (lo+hi)/2}
const _c1=new T.Vector3(),_c2=new T.Vector3();
function placeCamera(dt,snap){
  const d=camera.userData.dist,h0=Math.sin(PITCH)*d,vf=T.MathUtils.degToRad(camera.fov)/2;
  const topOff=h0/Math.tan(PITCH-vf)-Math.cos(PITCH)*d,botOff=Math.cos(PITCH)*d-h0/Math.tan(PITCH+vf);
  let tz=cam.y*S-.25,tx=cam.x*S;const fitA=-.3+topOff,fitB=WH*S+.3-botOff;
  // the whole unit fits top to bottom (phones held upright): center it; otherwise follow the player
  tz=fitA>=fitB?centerZ(d,h0):cl(tz,-1.2+topOff,WH*S+.8-botOff);
  const hw=camera.userData.span/2,xMin=hw-.25,xMax=WW*S-hw+.25;tx=xMin<xMax?cl(tx,xMin,xMax):WW*S/2;
  const k=snap?1:Math.min(1,dt*8);tgt.x+=(tx-tgt.x)*k;tgt.z+=(tz-tgt.z)*k;
  camera.position.set(tgt.x,h0,tgt.z+Math.cos(PITCH)*d);camera.lookAt(tgt.x,0,tgt.z);camera.updateMatrixWorld();
  const near=LAMPS.map(([x,y])=>[Math.hypot(x*S-tgt.x,y*S-tgt.z),x,y]).sort((a,b)=>a[0]-b[0]);
  lampPool.forEach((l,i)=>{const o=near[i];l.position.x=o[1]*S;l.position.z=o[2]*S;l.userData.k=cl(1.5-o[0]/6,0,1)});
  // the floor area on screen, for the minimap frame
  const ray=placeCamera.ray||(placeCamera.ray=new T.Raycaster()),pl=placeCamera.pl||(placeCamera.pl=new T.Plane(new T.Vector3(0,1,0),0)),hit=placeCamera.hit||(placeCamera.hit=new T.Vector3());let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ray.setFromCamera({x:u,y:v},camera);if(ray.ray.intersectPlane(pl,hit)){x0=Math.min(x0,hit.x/S);x1=Math.max(x1,hit.x/S);y0=Math.min(y0,hit.z/S);y1=Math.max(y1,hit.z/S)}}
  Object.assign(view,{x0,x1,y0,y1});
  const cx=(x0+x1)/2*S,cz=(y0+y1)/2*S,half=cl(Math.max(x1-x0,y1-y0)*S/2+.8,6,12.5),sc=sun.shadow.camera;
  if(Math.abs(sc.right-half)>.3){sc.left=-half;sc.right=half;sc.top=half;sc.bottom=-half;sc.updateProjectionMatrix()}
  sun.position.set(cx-3.2,9,cz+1.6);sun.target.position.set(cx,0,cz)}
function lighting(){const hr=7+(RUN?gmNow():180)/60,eve=cl((hr-15.5)/3.5,0,1),morn=cl((8.5-hr)/1.5,0,1);
  hemi.intensity=.42-.12*eve-.05*morn;sun.intensity=.58-.25*eve;sun.color.set(eve>.3?'#ffc49a':'#ffe8cf');
  const lamp=1.25+.5*eve+.2*morn;for(const l of lampPool)l.intensity=lamp*l.userData.k;
  winMat.color.set(lerpKeys(SKY,hr,hexMix)).multiplyScalar(1.5-.4*eve)}
function domeColor(r,ts){if(!RUN||!r.tasks.length)return null;let col=null,hz=1.5;
  if(r.tasks.some(k=>k.type==='blue')){col=((ts*3|0)%2)?'#3d7bff':'#f4f6fb';hz=0}
  else if(r.tasks.some(k=>k.type==='stroke'||k.type==='rapid')){col=((ts*3|0)%2)?'#b16bff':'#ff4d5e';hz=0}
  else if(r.tasks.some(k=>k.type==='alarm')){col='#ff4d5e';hz=4}else if(r.tasks.some(k=>k.type==='call'))col='#ffd23f';
  return col&&(hz===0||((ts*hz*2|0)%2===0))?col:null}
function syncRooms(ts){const lit=[];
  for(const r of ROOMS){const g3=r.g3;if(!g3)continue;const pt=r.pt;
    g3.g.visible=!!pt;
    if(pt&&g3.ptId!==pt.id){g3.ptId=pt.id;const L=pt.look||{};g3.head.material.color.set(SKINS[L.skin]||SKINS[1]);g3.hair.material.color.set(HAIRC[L.hairc]||HAIRC[1]);
      g3.hair.scale.set(1,STYLES[L.style]==='buzz'?.55:.8,1);g3.body.material.color.set(pt.blanket||'#8fc4ff')}
    if(pt)g3.fall.visible=!!pt.fall;
    const act=!RUN||r.active;g3.cover.visible=!!RUN&&!r.active;g3.pq.material.opacity=act?.88:.35;
    g3.sign.visible=r.state==='evs';g3.cart.visible=!!(pt&&pt.iso&&act);
    g3.fr.visible=r.state==='incoming';if(g3.fr.visible)g3.fm.opacity=.45+.45*Math.sin(ts*5.5);
    const alarm=pt&&act&&r.tasks.some(k=>k.type==='alarm'||URG[k.type]>=3);g3.al.visible=!!alarm&&((ts*4|0)%2===1);
    const dc=domeColor(r,ts);g3.dome.material=dc?glowMat(dc,4):g3.dome.userData.off;
    if(dc)lit.push([Math.hypot(r.dome.x-cam.x,r.dome.y-cam.y),r,dc])}
  lit.sort((a,b)=>a[0]-b[0]);callPool.forEach((l,i)=>{const o=lit[i];if(!o||o[0]>700){l.intensity=0;return}l.position.set(o[1].dome.x*S,.62,o[1].dome.y*S);l.color.set(o[2]);l.intensity=1.2})}
function syncPeople(dt,ts){stamp++;
  if(RUN){for(const tp of RUN.transports){ride(tp);const ox=tp.dir==='left'?16:tp.dir==='right'?-16:0,oy=tp.dir==='down'?-30:tp.dir==='up'?26:0;person(tp,tp.aide,'',tp.x+ox*1.4,tp.y+oy*1.4,tp.dir)}
    for(const h of RUN.helpers)person(h,h.look,h.kind==='rn'?'':h.kind,h.x,h.y,h.dir);
    for(const n of RUN.npcs){if(n.kind==='code'){if(n.phase!=='wait')person(n,n.look,'',n.x,n.y,n.dir)}else if(n.kind==='md')person(n,n.look,'md',n.x,n.y,n.dir);else{person(n,n.look,'evs',n.x,n.y,n.dir);evsCart(n)}}
    for(const r of ROOMS)if(r.active&&r.pt&&r.pt.visitor)person('vis'+r.num,r.pt.visitor,'vis',r.vis.x,r.vis.y,'down',1.02);
    person('me',myLook(),'',P.x,P.y,P.dir,1.18)}
  else idleCrew(ts).forEach((n,i)=>person('idle'+i,n.look,'',n.x,n.y,n.dir));
  stepPeople(dt);
  for(const [k,o] of rides)if(o.seen!==stamp){o.g.visible=false;if(RUN&&!RUN.transports.includes(k)){scene.remove(o.g);rides.delete(k)}}
  for(const [k,g] of carts)if(g.seen!==stamp){g.visible=false;if(RUN&&!RUN.npcs.includes(k)){scene.remove(g);carts.delete(k)}}}
function syncFx(dt,ts){
  let i=0;if(RUN)for(const it of RUN.items){const I=ITEM[it.type];if(!I)continue;
    const s=sprite(pool.items,i,()=>{const g=new T.Group();const gl=new T.Sprite(new T.SpriteMaterial({map:dotTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
      const ic=new T.Sprite(new T.SpriteMaterial({transparent:true,depthWrite:false}));g.add(gl,ic);g.gl=gl;g.ic=ic;return g});
    const b=Math.sin(ts*4+it.x*.1)*.03,sz=I.sz*S*1.5,tx=iconT(I.icon);if(s.ic.material.map!==tx){s.ic.material.map=tx;s.ic.material.needsUpdate=true}s.ic.scale.set(sz,sz,1);s.gl.material.color.set(I.glow).multiplyScalar(1.6);s.gl.scale.set(sz*2.4,sz*2.4,1);
    s.position.set(it.x*S,.24+b,it.y*S);i++}
  for(;i<pool.items.length;i++)pool.items[i].visible=false;
  i=0;if(RUN)for(const o of RUN.orbs){const s=sprite(pool.orbs,i,()=>new T.Sprite(starMat));const sz=(o.v>=10?.3:o.v>=5?.24:.18);s.scale.set(sz,sz,1);
    s.position.set(o.x*S,.16+Math.abs(Math.sin(ts*5+o.x))*.06,o.y*S);i++}
  for(;i<pool.orbs.length;i++)pool.orbs[i].visible=false;
  i=0;if(RUN)for(const q of RUN.rings){const s=sprite(pool.rings,i,()=>{const m=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:ringTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));m.rotation.x=-Math.PI/2;return m});
    const f=q.t/.6,r=Math.max(.01,q.max*f*S);s.scale.set(r,r,1);s.position.set(q.x*S,.03,(q.y+10)*S);s.material.color.set(q.c).multiplyScalar(2.2);s.material.opacity=1-f;i++}
  for(;i<pool.rings.length;i++)pool.rings[i].visible=false;
  // particles: their 2D upward drift becomes height above the spot where they started
  let n=0;if(RUN)for(const q of RUN.parts){if(q.icon||n>=PMAX)continue;let a=anchors.get(q);if(!a){a={y:q.y};anchors.set(q,a)}
    const h=cl(.32+(a.y-q.y)*S*.9,.02,2),f=cl(1-q.t/q.life,0,1),c=colorOf(q.c);
    pPos[n*3]=q.x*S;pPos[n*3+1]=h;pPos[n*3+2]=a.y*S;pCol[n*3]=c.r*2.6*f;pCol[n*3+1]=c.g*2.6*f;pCol[n*3+2]=c.b*2.6*f;n++}
  for(let k=n;k<PMAX;k++){pCol[k*3]=pCol[k*3+1]=pCol[k*3+2]=0;pPos[k*3+1]=-5}
  pts.geometry.attributes.position.needsUpdate=true;pts.geometry.attributes.color.needsUpdate=true;
  ecgTex.offset.x=(ecgTex.offset.x+dt*.35)%1;
  const care=init.care;care.visible=!!(RUN&&!RUN.over);if(care.visible){const R2=careR()*S;care.scale.set(R2,R2,1);care.position.x=P.x*S;care.position.z=(P.y-6)*S}
  const beam=init.beam;beam.visible=!!(RUN&&!RUN.over&&P.focus);
  if(beam.visible){const b=P.focus.room.bed,a=new T.Vector3(P.x*S,.5,P.y*S),c=new T.Vector3(b.x*S,.42,b.y*S),L=a.distanceTo(c);beam.position.copy(a).add(c).multiplyScalar(.5);beam.scale.set(1,L,1);
    beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),c.clone().sub(a).normalize())}}
function syncCodes(dt,ts){
  const rooms=RUN?ROOMS.filter(r=>r.active&&r.tasks.some(k=>k.type==='blue'||k.type==='stroke'||k.type==='rapid')):[];
  boltSets.forEach((B,i)=>{const r=rooms[i],L=codeLights[i];
    if(!r){B.set.forEach(([a,b])=>{a.m.visible=b.m.visible=false});L.intensity=0;return}
    const type=r.tasks.find(k=>k.type==='blue')?'blue':r.tasks.find(k=>k.type==='stroke')?'stroke':'rapid',hex=(typeof CODE!=='undefined'&&CODE[type]&&CODE[type].hex)||'#3d7bff',c=new T.Color(hex);
    B.core.color.setRGB(c.r*2.6+.7,c.g*2.6+.7,c.b*2.6+.7);B.halo.color.setRGB(c.r*3.2,c.g*3.2,c.b*3.2);
    const ck=r.tasks.find(k=>k.type===type),lvl=ck&&!ck.here?Math.min(1,(ck.wait||0)/24):0,pulse=.5+.5*Math.cos(ts*Math.PI*(3.2+4*lvl));L.color.copy(c);L.position.set(r.bed.x*S,.75,r.bed.y*S);L.intensity=2+pulse*(3+4*lvl);
    B.t-=dt;if(B.t>0)return;B.t=.05;const bx=r.bed.x*S,bz=r.bed.y*S;
    B.set.forEach(([core,halo],bi)=>{const up=bi%2===1,a=rr(0,Math.PI*2),D=up?rr(.08,.3):rr(.45,.95),y1=up?rr(.95,1.45):rr(.08,.5),x1=bx+Math.cos(a)*D,z1=bz+Math.sin(a)*D,x0=bx+rr(-.08,.08),z0=bz+rr(-.08,.08);
      shapeBolt(core,x0,.32,z0,x1,y1,z1,up,.016);halo.m.geometry.attributes.position.array.set(core.m.geometry.attributes.position.array);
      const p=halo.m.geometry.attributes.position.array;for(let k=0;k<halo.n;k++){const o=k*6,cx=(p[o]+p[o+3])/2,cz=(p[o+2]+p[o+5])/2,dx=p[o]-cx,dz=p[o+2]-cz,l=Math.hypot(dx,dz)||1,w=.07*(1-k/halo.n*.6);
        p[o]=cx+dx/l*w;p[o+2]=cz+dz/l*w;p[o+3]=cx-dx/l*w;p[o+5]=cz-dz/l*w}halo.m.geometry.attributes.position.needsUpdate=true;
      core.m.visible=halo.m.visible=Math.random()<.85})})}

/* ---------- screen overlay: the game's own rings, tags and numbers, placed on the 3D view ---------- */
const _p=new T.Vector3();
function w2s(x,y,h){_p.set(x*S,h||0,y*S).project(camera);return {x:(_p.x+1)/2*VW,y:(1-_p.y)/2*VH}}
function at(x,y,h,m,fn){const a=w2s(x,y,h),b=w2s(x+50,y,h),k=Math.hypot(b.x-a.x,b.y-a.y)/50*m;ctx.setTransform(DPR*k,0,0,DPR*k,DPR*(a.x-x*k),DPR*(a.y-y*k));fn(k)}
function tagAt(x,y,h,tag,col,icon){at(x,y,h,1.5,()=>{ctx.font='8px PS2P';const w=ctx.measureText(tag).width+8;ctx.fillStyle=col||'#2de2e6';ctx.fillRect(x-w/2,y-6,w,12);
  ctx.fillStyle='#0b0a1c';ctx.textAlign='center';ctx.fillText(tag,x,y+3);if(icon)ctx.drawImage(iconCanvas(icon),x-w/2-14,y-7,13,13)})}
function overlay(ts){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.imageSmoothingEnabled=false;
  if(RUN){
    for(const r of ROOMS){if(!r.pt||!r.active)continue;
      if(r.pt.es||r.pt.neuro)at(r.bed.x,r.bed.y,.36,1.4,()=>{if(r.pt.es){ctx.fillStyle='#ff4d5e';ctx.fillRect(r.bed.x-30,r.bed.y-4,16,10);ctx.font='6px PS2P';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('ES',r.bed.x-22,r.bed.y+4)}
        if(r.pt.neuro)ctx.drawImage(iconCanvas('brain'),r.bed.x+16,r.bed.y-4,14,14)});
      if(r.pt.iso&&r.plaque)at(r.plaque.x,r.plaque.y,WALL+.04,1,()=>isoSign(r))}
    for(const r of ROOMS){const n=r.tasks.length;if(!n)continue;at(r.bed.x,r.bed.y,.95,1.55,()=>r.tasks.forEach((k,i)=>drawTask(k,r.bed.x+(i-(n-1)/2)*38,r.bed.y,ts)))}
    if(DESK.tasks.length){const n=DESK.tasks.length;at(DESK.bed.x,DESK.bed.y,.62,1.55,()=>DESK.tasks.forEach((k,i)=>{const x=DESK.bed.x+(i-(n-1)/2)*44,y=DESK.bed.y-8;drawTask(k,x,y,ts);
      if(k.forRoom){ctx.font='8px PS2P';ctx.textAlign='center';ctx.fillStyle='#0b0a1c';ctx.fillRect(x-22,y+22,44,13);ctx.fillStyle='#2de2e6';ctx.fillText(String(k.forRoom.num),x,y+32)}}))}
    if(typeof SELF!=='undefined'&&NEEDS)for(const t in SELF){const r=SELF[t];for(const k of r.tasks)at(r.bed.x,r.bed.y,1.0,1.55,()=>drawTask(k,r.bed.x,r.bed.y,ts))}
    for(const h of RUN.helpers)tagAt(h.x,h.y,1.0,h.kind==='rn'?'RN':h.kind==='cna'?'CNA':'RES',h.kind==='rn'?'#7fb2ff':h.kind==='cna'?'#7be3a0':'#ffd23f');
    for(const n2 of RUN.npcs){if(n2.kind==='code'){if(n2.phase!=='wait')tagAt(n2.x,n2.y,1.0,n2.tag,n2.col)}else if(n2.kind==='md')tagAt(n2.x,n2.y,1.0,'MD','#e8e8f0');else tagAt(n2.x,n2.y,1.0,'EVS','#5fd3c9')}
    if(!RUN.over){tagAt(P.x,P.y,1.08,(SAVE.look.name||tr('you')).toUpperCase(),'#ffffff',SAVE.reel?reelIcon(SAVE.reel):null);
      if(RUN.buffT>0){ctx.globalAlpha=.55+.45*Math.sin(ts*8);at(P.x,P.y,1.1,1.5,()=>ctx.drawImage(iconCanvas('coffee'),P.x+30,P.y-14,14,14));ctx.globalAlpha=1}
      if(typeof needIcons==='function')at(P.x,P.y,1.08,1.5,()=>needIcons(P.x,P.y-20,ts))}
    for(const q of RUN.parts){if(!q.icon)continue;let a=anchors.get(q);if(!a){a={y:q.y};anchors.set(q,a)}ctx.globalAlpha=cl(1-q.t/q.life,0,1);
      at(q.x,a.y,cl(.4+(a.y-q.y)*S*.9,.05,2),1,()=>ctx.drawImage(iconCanvas(q.icon),q.x-q.sz/2,a.y-q.sz/2,q.sz,q.sz))}
    ctx.globalAlpha=1;
    for(const f of RUN.floaters){let a=anchors.get(f);if(!a){a={y:f.y};anchors.set(f,a)}ctx.globalAlpha=cl(1.2-f.t,0,1);
      at(f.x,a.y,cl(.75+(a.y-f.y)*S*.9,.1,2.5),1.8,()=>{ctx.textAlign='center';ctx.font='9px PS2P';ctx.fillStyle='#000';ctx.fillText(f.text,f.x+1,a.y+1);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,a.y)})}
    ctx.globalAlpha=1}
  ctx.setTransform(DPR,0,0,DPR,0,0);
  {const tn=lerpKeys(TINT,7+(RUN?gmNow():180)/60,arrMix);if(tn[3]>.005){ctx.fillStyle='rgba('+(tn[0]|0)+','+(tn[1]|0)+','+(tn[2]|0)+','+(tn[3]*.8).toFixed(3)+')';ctx.fillRect(0,0,VW,VH)}}
  if(RUN&&!RUN.over){edgeArrows();if(RUN.flash>0){const c=RUN.flashC||'155,92,255',a=Math.min(1,RUN.flash)*(.55+.45*Math.cos(RUN.flash*Math.PI*4)),am=RUN.flashAmp||1;ctx.fillStyle='rgba('+c+','+Math.min(.42,.16*a*am)+')';ctx.fillRect(0,0,VW,VH);ctx.lineWidth=14*am;ctx.strokeStyle='rgba('+c+','+Math.min(1,.6*a*am)+')';ctx.strokeRect(0,0,VW,VH)}
    if(RUN.safety<25){ctx.strokeStyle='rgba(255,77,94,'+(.35+.25*Math.sin(ts*6))+')';ctx.lineWidth=10;ctx.strokeRect(0,0,VW,VH)}}}


/* ---------- locker preview: your character, turning slowly ---------- */
let pv=null;
function preview(L){const c=document.getElementById('locker3d');if(!c||!on()||!ready)return false;
  try{if(!pv){const r=new T.WebGLRenderer({canvas:c,antialias:true,alpha:true});r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
      const sc=new T.Scene();sc.add(new T.HemisphereLight('#eef3ff','#4a4060',1.05));const d=new T.DirectionalLight('#fff3e2',1.1);d.position.set(1.4,2.6,2.4);sc.add(d);const d2=new T.DirectionalLight('#9fc8ff',.45);d2.position.set(-2,1.2,-1.5);sc.add(d2);
      const cam=new T.PerspectiveCamera(28,c.width/c.height,.1,20);cam.position.set(0,.62,2.55);cam.lookAt(0,.5,0);pv={r,sc,cam,ch:null,lk:'',t:0}}
    pv.L=L;loadNurse();const useM=nurseState===2&&bodyOf(L)==='f';
    const lk=lookKey(L)+'|'+(L.body||'')+(useM?'|model':'');if(pv.lk!==lk){if(pv.ch)pv.sc.remove(pv.ch.root);pv.ch=useM?makeNurse(L,1.25,pv.sc):makeChibi(chibiOf(L,''),1.1,pv.sc);pv.ch.root.children.forEach(m=>{if(m.geometry===GEO.blob)m.visible=false});pv.lk=lk}
    return true}catch(e){console.warn(e);return false}}
function previewTick(dt){if(!pv||!pv.ch||SCREEN!=='locker')return;pv.t+=dt;const c=pv.ch;c.root.rotation.y=Math.sin(pv.t*.6)*.65;
  if(c.model)c.mixer.update(dt);else{c.ph+=dt*2;c.body.position.y=Math.sin(c.ph)*.003;c.P.head.rotation.z=Math.sin(c.ph*.5)*.03}pv.r.render(pv.sc,pv.cam)}
/* ---------- frame ---------- */
let snapNext=true;
function render(dt,t){
  const b3=document.body.classList;if(b3.contains('g3d')!==on())b3.toggle('g3d',on());
  if(!on())return false;
  if(!ready){try{if(!init())throw new Error('init')}catch(e){console.warn('3D view unavailable, using 2D',e);dead=true;if(canvas3)canvas3.style.display='none';const gb=document.getElementById('b-gfx');if(gb)gb.hidden=true;return false}}
  if(!FLOOR)return false;
  const ts=t/1000;
  if(RUN&&!RUN.over){cam.x+=(P.x-cam.x)*Math.min(1,dt*6);cam.y+=(P.y-cam.y)*Math.min(1,dt*6)}
  else{const s=(t/1000*40)%PER;const [ax,ay]=ringPt(s);cam.x+=(ax-cam.x)*Math.min(1,dt*1.5);cam.y+=(ay-cam.y)*Math.min(1,dt*1.5)}
  fit();if(lastLang!==LANG)paintFloor(paintFloor.rects);
  placeCamera(dt,snapNext);snapNext=false;lighting();syncRooms(ts);syncPeople(dt,ts);syncFx(dt,ts);syncCodes(dt,ts);
  composer.render(dt);overlay(ts);previewTick(dt);return true}
return {on,render,setWant,isOn:()=>want,available:()=>HAS&&!dead,w2s,view,preview,snap:()=>{snapNext=true},
  status:()=>({ready,model:['none','loading','ready','unavailable'][nurseState],player:(people.get('me')||{}).model?'model':'built',preview:pv&&pv.ch?(pv.ch.model?'model':'built'):null})};
})();
