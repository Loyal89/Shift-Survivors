"""Breaks and codes that need you.
 - 2 to 4 bathroom breaks (random times) and one meal break per shift. You take them in the staff restrooms or the staff lounge,
   which are now open to walk into. Until you go, your patient tasks take longer (15% slower, growing to 45%).
 - Codes (Code Blue, Stroke Alert, Code Rescue) only move forward while you are working them. The code team and your helpers
   speed you up, but they can't finish a code without you.
 - Until you reach the code, the alarm keeps coming back: the screen flash gets stronger and more frequent, with the siren.
Usage: python3 patch_needs.py SRC OUT
"""
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:100]); s = s.replace(a, b)

# 1) the staff restrooms and the staff lounge become walkable, with their furniture blocked
GS_ANCHOR = "const GS=2,GW=Math.ceil(WW/GS),GH=Math.ceil(WH/GS)"   # (WGRID is const in the fair source, let in the source with floors)
rep(GS_ANCHOR,
    "// breaks: the staff restrooms (top and bottom) and the staff lounge open onto the halls (mirrored with the core when the map is)\n"
    "const NM=(typeof MIR!=='undefined'&&MIR)?(x,w)=>WW-x-(w||0):x=>x;\n"
    "WALK.push(...[[806,306,188,88],[870,288,52,24],[806,606,188,88],[870,688,52,26],[806,406,188,188],[988,470,20,60]].map(([x,y,w,h])=>({x:NM(x,w),y,w,h})));\n"
    + GS_ANCHOR)
rep("  for(let y=y0;y<=y1;y++)WGRID.fill(1,y*GW+x0,y*GW+x1+1)}\n",
    "  for(let y=y0;y<=y1;y++)WGRID.fill(1,y*GW+x0,y*GW+x1+1)}\n"
    "for(const [x,y,w,h] of [[950,316,26,30],[818,316,34,22],[950,656,26,30],[818,662,34,22],[812,412,112,22],[946,410,40,52],[836,452,92,44],[814,464,18,18],[934,464,18,18],[826,556,124,30]])blockRect(NM(x,w),y,w,h);\n")

# 1b) the 2D wall faces block the strip below each wall; keep the break-room doorways open through them
rep("  raiseWalls(g);ARCH=", "  raiseWalls(g);if(NEEDS)openBreakDoors();ARCH=")
rep("function blockRect(x,y,w,h){", "function openBreakDoors(){for(const [x0,y,w,h] of [[872,286,48,48],[872,684,48,52],[986,472,24,56]]){const x=NM(x0,w);for(let j=y>>1;j<=(y+h)>>1;j++)for(let i=x>>1;i<=(x+w)>>1;i++)WGRID[j*GW+i]=1}}\nfunction blockRect(x,y,w,h){")
# 2) break spots and task types
rep("reach:95,tasks:[],pt:{id:-1},state:'occ',active:true};",
    "reach:95,tasks:[],pt:{id:-1},state:'occ',active:true};\n"
    "/* your own breaks: helpers can't take these for you */\n"
    "const NEEDS=true;\n"
    "const SELF={wc:{num:'',side:'self',self:'wc',x:NM(800,200),y:300,w:200,h:400,door:{x:NM(906),y:338},bed:{x:NM(922),y:356},spots:[{x:NM(922),y:356,door:{x:NM(906),y:338}},{x:NM(922),y:646,door:{x:NM(906),y:664}}],tasks:[],pt:{id:-2},state:'occ',active:true,reach:0},\n"
    "  meal:{num:'',side:'self',self:'meal',x:NM(800,200),y:400,w:200,h:200,door:{x:NM(950),y:506},bed:{x:NM(900),y:524},spots:[{x:NM(900),y:524,door:{x:NM(950),y:506}}],tasks:[],pt:{id:-3},state:'occ',active:true,reach:0}};")
rep("if(CODEBLUE){TT.blue={work:9,due:22,xp:30,drain:1.8,exp:30,hit:22,cna:0,icon:'blue'};URG.blue=3}",   # (the Steam edition has no Code Blue)
    "if(CODEBLUE){TT.blue={work:9,due:22,xp:30,drain:1.8,exp:30,hit:22,cna:0,icon:'blue'};URG.blue=3}\n"
    "TT.wc={work:3,due:34,xp:2,drain:0,exp:0,hit:0,cna:0,self:1,icon:'wc'};TT.meal={work:6,due:48,xp:4,drain:0,exp:0,hit:0,cna:0,self:1,icon:'snack'};\n"
    "ICONS.wc=['..KKKK......','..KWWK......','..KWWK......','..KWWKKKKKK.','..KWWKWWWWWK','..KWWKWLLLWK','..KWWWWWWWWK','...KWWWWWWK.','....KWWWWK..','....KSSSSK..','...KSSSSSSK.','...KKKKKKKK.'];")

# 3) schedule the breaks each shift
rep("DESK.tasks=[];", "DESK.tasks=[];if(NEEDS){SELF.wc.tasks=[];SELF.meal.tasks=[]}")
rep("if(CODEBLUE)sched(rnd(420,640),()=>urgent('blue'));",
    "if(CODEBLUE)sched(rnd(420,640),()=>urgent('blue'));\n"
    "  if(NEEDS){const n=2+((Math.random()*3)|0),a=40,b=680,seg=(b-a)/n;for(let i=0;i<n;i++)sched(a+seg*i+rnd(seg*.15,seg*.85),()=>needTask('wc'));sched(rnd(270,420),()=>needTask('meal'))}")

# 4) working: break spots count only when you are inside; pending breaks slow your patient work; codes alarm until you arrive
rep("const d=hyp(P.x-k.room.bed.x,P.y-k.room.bed.y);if(d>R+(k.room.reach||0))continue;const s=prio(k)-d*.002;if(s>bs){bs=s;best=k}}",
    "const sp=k.room.spots,d=sp?Math.min(...sp.map(q=>hyp(P.x-q.x,P.y-q.y))):hyp(P.x-k.room.bed.x,P.y-k.room.bed.y);if(d>(sp?64:R+(k.room.reach||0)))continue;const s=prio(k)+(sp?5:0)-d*.002;if(s>bs){bs=s;best=k}}")
rep("P.focus=best;if(best){best.done+=dt*rate('you',best);if(best.done>=best.work)completeTask(best)}",
    "P.focus=best;if(best){best.done+=dt*rate('you',best)*needMul(best);if(best.done>=best.work)completeTask(best)}\n  codeAlerts(dt);")
rep("function prio(k){return (URG[k.type]||0)+k.age/k.due+(k.over?1:0)}",
    "function prio(k){return (URG[k.type]||0)+k.age/k.due+(k.over?1:0)}\n"
    "/* a pending bathroom or meal break slows your patient work: 15% at first, up to 45% if you keep putting it off */\n"
    "function needMul(k){if(!NEEDS||TT[k.type].self)return 1;let m=1;for(const t of ['wc','meal']){const q=SELF[t].tasks[0];if(q)m*=1-(.15+.3*Math.min(1,q.age/q.due))}return Math.max(.45,m)}\n"
    "function needTask(type){if(!RUN||RUN.over)return;const r=SELF[type];if(r.tasks.length)return;const k=addTask(r,type,{force:true});if(k){toast(tr('t_'+type));sfx('click')}}\n"
    "function selfDone(k){const r=k.room;floater(r.bed.x,r.bed.y-40,tr('f_'+k.type),'#7be3a0');hearts(r.bed.x,r.bed.y-20,2);\n"
    "  if(k.type==='meal'){RUN.buffT=Math.max(RUN.buffT||0,14);RUN.safety=Math.min(RUN.safetyMax,RUN.safety+6);toast(tr('t_meal_done'),'good')}}\n"
    "/* codes need you: until you get there the alarm keeps coming back, stronger and more often */\n"
    "function codeAlerts(dt){const G=RUN;let waiting=false;\n"
    "  for(const k of G.tasks){const cd=CODE[k.type];if(!cd)continue;\n"
    "    if(P.focus===k){if(!k.here){k.here=true;floater(P.x,P.y-56,tr('f_here'),cd.hex)}k.wait=0;continue}if(typeof mine==='function'&&!mine(k)&&k.claim)continue;\n"
    "    waiting=true;k.here=false;k.wait=(k.wait||0)+dt;k.nag=(k.nag==null?2.5:k.nag)-dt;\n"
    "    if(k.nag<=0){const lvl=Math.min(1,k.wait/24);k.nag=3.2-2.2*lvl;G.flash=1.5;G.flashC=cd.rgb;G.flashAmp=1+1.6*lvl;sfx(lvl>.5?'siren':'alarm');buzz(lvl>.5?[120,60,120]:80);\n"
    "      ring(k.room.bed.x,k.room.bed.y,cd.hex,120+80*lvl,k.room.fl);k.nags=(k.nags||0)+1;if(k.nags%2===0)toast(tr('t_codewait',{k:tr('k_'+k.type),r:k.room.num}),cd.toast)}}\n"
    "  if(!waiting)G.flashAmp=1}\n"
    "function needIcons(x,y,ts){if(!NEEDS||!RUN)return;let i=0;for(const t of ['wc','meal']){const k=SELF[t].tasks[0];if(!k)continue;\n"
    "  ctx.globalAlpha=.6+.4*Math.sin(ts*(k.over?10:5));ctx.fillStyle='rgba(11,10,28,.85)';ctx.fillRect(x-17+i*18,y-8,16,16);ctx.drawImage(iconCanvas(TT[t].icon),x-16+i*18,y-7,14,14);i++}ctx.globalAlpha=1}")

# 4b) a break happens at the restroom you are in (or nearest to): stars, the ring and the arrow appear there, not at the other one
rep("  // you\n", "  if(NEEDS)aimSelf();\n  // you\n")
rep("function needTask(type){", "function aimSelf(){for(const t in SELF){const r=SELF[t];let b=r.spots[0],bd=1e9;for(const q of r.spots){const d=hyp(P.x-q.x,P.y-q.y);if(d<bd){bd=d;b=q}}if(r.bed.x!==b.x||r.bed.y!==b.y){r.bed={x:b.x,y:b.y};r.door=b.door}}}\nfunction needTask(type){")
# 5) helpers can't take your breaks, and can't move a code forward unless you are there; the code team only helps you
rep("if(k.claim&&k.claim!==h)continue;if(h.kind==='cna'&&!TT[k.type].cna)continue;",
    "if(k.claim&&k.claim!==h)continue;if(TT[k.type].self)continue;if(h.kind==='cna'&&!TT[k.type].cna)continue;")
rep("if(hyp(h.x-k.room.door.x,h.y-k.room.door.y)<10){k.done+=dt*rate(h.kind,k);if(k.done>=k.work)completeTask(k)}",
    "if(hyp(h.x-k.room.door.x,h.y-k.room.door.y)<10){if(!(URG[k.type]>=3)||P.focus===k||(typeof mine==='function'&&!mine(k))){k.done+=dt*rate(h.kind,k);if(k.done>=k.work)completeTask(k)}}")
rep("n.task.done+=dt*CREW_SOLO;if(n.task.done>=n.task.work)completeTask(n.task);return}", "return}")
rep("function completeTask(k){const G=RUN,d=TT[k.type],onTime=!k.over,r=k.room;removeTask(k);",
    "function completeTask(k){const G=RUN,d=TT[k.type],onTime=!k.over,r=k.room;removeTask(k);if(d.self)selfDone(k);")

# 6) the autopilot (tests) walks all the way into the break room
rep("const s=prio(k)*12-d/90+(k===P.focus?4:0);", "const s=(prio(k)+(TT[k.type].self?.7:0))*12-d/90+(k===P.focus?4:0);")
rep("if(best&&hyp(P.x-best.room.bed.x,P.y-best.room.bed.y)<careR()*.95)autoPath=[];",
    "if(best&&hyp(P.x-best.room.bed.x,P.y-best.room.bed.y)<(best.room.spots?40:careR()*.95))autoPath=[];")

# 7) drawing (2D): break tasks at the restrooms and lounge, icons over your head, minimap squares, edge arrows, stronger code flash
rep("  // stars\n  if(RUN)for(const it of RUN.items)",
    "  if(RUN&&NEEDS)for(const t in SELF){const r=SELF[t];for(const k of r.tasks)drawTask(k,r.bed.x,r.bed.y-30,ts)}\n  // stars\n  if(RUN)for(const it of RUN.items)")
rep("if(RUN.buffT>0){ctx.globalAlpha=.55+.45*Math.sin(ts*8);ctx.drawImage(iconCanvas('coffee'),P.x+12,P.y-46,14,14);ctx.globalAlpha=1}",
    "if(RUN.buffT>0){ctx.globalAlpha=.55+.45*Math.sin(ts*8);ctx.drawImage(iconCanvas('coffee'),P.x+12,P.y-46,14,14);ctx.globalAlpha=1}needIcons(P.x,P.y-74,ts);")
rep("mg.fillStyle='#ffffff';mg.fillRect(P.x-30,P.y-30,60,60);",
    "if(NEEDS)for(const t in SELF){const r=SELF[t];if(r.tasks.length){mg.fillStyle='#ffd23f';for(const q of r.spots)mg.fillRect(q.x-34,q.y-34,68,68)}}\n  mg.fillStyle='#ffffff';mg.fillRect(P.x-30,P.y-30,60,60);")
rep("const list=RUN.tasks.filter(k=>URG[k.type]>=2||k.over||k.type==='adm'||k.type==='dc'||k.type==='report')",
    "const list=RUN.tasks.filter(k=>URG[k.type]>=2||k.over||k.type==='adm'||k.type==='dc'||k.type==='report'||TT[k.type].self)")
rep("ctx.fillStyle='rgba('+c+','+(.16*a)+')';ctx.fillRect(0,0,VW,VH);ctx.lineWidth=14;ctx.strokeStyle='rgba('+c+','+(.6*a)+')';ctx.strokeRect(0,0,VW,VH)",
    "const am=RUN.flashAmp||1;ctx.fillStyle='rgba('+c+','+Math.min(.42,.16*a*am)+')';ctx.fillRect(0,0,VW,VH);ctx.lineWidth=14*am;ctx.strokeStyle='rgba('+c+','+Math.min(1,.6*a*am)+')';ctx.strokeRect(0,0,VW,VH)")

# 8) the unit feed names the place for breaks
rep("r.desk?tr('fd_desk'):tr('fd_room',{r:r.num})", "r.desk?tr('fd_desk'):r.self?tr('fd_at_'+r.self):tr('fd_room',{r:r.num})")

# 9) How to play
rep("['heart','h2'],['siren','h3'],", "['heart','h2'],['siren','h3'],['wc','h10'],[CODEBLUE?'blue':'siren','h11'],")

# 10) words (English, Spanish)
rep("fl_med:'MED ROOM',",
    "fl_med:'MED ROOM',k_wc:'Bathroom break',k_meal:'Meal break',fd_at_wc:'Staff restroom',fd_at_meal:'Staff lounge',"
    "fd_wc:'Until you go, your tasks take longer',fd_meal:'Until you eat, your tasks take longer',"
    "t_wc:'Bathroom break! Go to a staff restroom. Your tasks take longer until you go.',t_meal:'Meal break! Eat in the staff lounge. Your tasks take longer until you do.',"
    "t_meal_done:'Break done: you move faster for a bit',f_wc:'Relief!',f_meal:'Recharged!',f_here:'Team, I\\u2019m here!',"
    "t_codewait:'{k} \\u00b7 {r}: the team needs you there!',"
    "h10:'Take your breaks: 2 to 4 bathroom breaks and one meal break. Until you go to a staff restroom or the lounge, your tasks take longer.',"
    "h11:'Codes need you there. The code team waits for you, and the alarm gets stronger until you arrive.',")
rep("fl_med:'MEDICAMENTOS',",
    "fl_med:'MEDICAMENTOS',k_wc:'Ir al ba\\u00f1o',k_meal:'Pausa para comer',fd_at_wc:'Ba\\u00f1o del personal',fd_at_meal:'Sala del personal',"
    "fd_wc:'Hasta que vayas, tus tareas tardan m\\u00e1s',fd_meal:'Hasta que comas, tus tareas tardan m\\u00e1s',"
    "t_wc:'\\u00a1Necesitas ir al ba\\u00f1o! Ve al ba\\u00f1o del personal. Tus tareas tardan m\\u00e1s hasta que vayas.',t_meal:'\\u00a1Pausa para comer! Come en la sala del personal. Tus tareas tardan m\\u00e1s hasta que lo hagas.',"
    "t_meal_done:'Pausa lista: te mueves m\\u00e1s r\\u00e1pido por un rato',f_wc:'\\u00a1Alivio!',f_meal:'\\u00a1Con energ\\u00eda!',f_here:'\\u00a1Equipo, ya llegu\\u00e9!',"
    "t_codewait:'{k} \\u00b7 {r}: \\u00a1el equipo te necesita ah\\u00ed!',"
    "h10:'Toma tus pausas: de 2 a 4 idas al ba\\u00f1o y una pausa para comer. Hasta que vayas al ba\\u00f1o o a la sala del personal, tus tareas tardan m\\u00e1s.',"
    "h11:'Los c\\u00f3digos te necesitan ah\\u00ed. El equipo te espera y la alarma sube hasta que llegues.',")

# 11) test hooks
rep("const hot=window.claude&&window.claude.hot;",
    "if(window.SS){SS.needs=()=>NEEDS&&RUN?{wc:SELF.wc.tasks.map(k=>({age:k.age,due:k.due,done:k.done})),meal:SELF.meal.tasks.map(k=>({age:k.age,due:k.due,done:k.done}))}:null;\n"
    "  SS.codes=()=>RUN?RUN.tasks.filter(k=>CODE[k.type]).map(k=>({type:k.type,room:k.room.num,done:k.done,work:k.work,wait:k.wait||0,here:!!k.here,age:k.age})):[];\n"
    "  SS.code=t=>urgent(t||'blue');SS.need=t=>needTask(t||'wc');SS.goto=(x,y)=>{P.x=x;P.y=y};SS.gotoRoom=n=>{const r=ROOMS.find(q=>q.num===n);if(r){P.x=r.door.x+(r.side==='left'?8:r.side==='right'?-8:0);P.y=r.door.y+(r.side==='top'?8:r.side==='bot'?-8:0)}};SS.amp=()=>RUN&&(RUN.flashAmp||1);SS.orbPos=()=>RUN.orbs.map(o=>[Math.round(o.x),Math.round(o.y)]);SS.selfAt=()=>({wc:SELF.wc.bed,meal:SELF.meal.bed});SS.pos=()=>({x:Math.round(P.x),y:Math.round(P.y),goal:autoGoal&&autoGoal.type,path:autoPath.slice(0,6).map(q=>q.map(Math.round)),focus:P.focus&&P.focus.type});SS.can=(x,y)=>canStand(x,y);SS.mul=()=>needMul({type:'call'})}\n"
    "const hot=window.claude&&window.claude.hot;")
open(out, 'w', encoding='utf-8').write(s)
print('needs + codes patched ->', out, len(s))
