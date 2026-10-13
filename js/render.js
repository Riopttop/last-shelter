'use strict';

/* ============================================================
   RENDER
============================================================ */
function onScreen(x,y,w,h,m){
  return !(x+w+m<camera.x || y+h+m<camera.y || x-m>camera.x+canvas.width || y-m>camera.y+canvas.height);
}
function shadow(x,y,rx,ry){
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
}

function drawBuildingFloor(h){
  if(!onScreen(h.x,h.y,h.w,h.h,30)) return;
  const ox=h.x-camera.x, oy=h.y-camera.y;
  // cast shadow
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.fillRect(ox+10,oy+14,h.w,h.h);
  if(h.roofA>=0.995) return;
  const f=h.type.floor;
  if(f==='wood'){
    ctx.fillStyle='#6e563c'; ctx.fillRect(ox,oy,h.w,h.h);
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1.5;
    for(let yy=20;yy<h.h;yy+=20){ ctx.beginPath(); ctx.moveTo(ox,oy+yy); ctx.lineTo(ox+h.w,oy+yy); ctx.stroke(); }
    ctx.strokeStyle='rgba(0,0,0,0.12)';
    for(let yy=0,k=0;yy<h.h;yy+=20,k++) for(let xx=(k%2?40:90);xx<h.w;xx+=110){ ctx.beginPath(); ctx.moveTo(ox+xx,oy+yy); ctx.lineTo(ox+xx,oy+yy+20); ctx.stroke(); }
  } else if(f==='tile'){
    ctx.fillStyle='#7d7f74'; ctx.fillRect(ox,oy,h.w,h.h);
    ctx.fillStyle='rgba(0,0,0,0.1)';
    for(let cy=0;cy<h.hc;cy++) for(let cx=(cy%2);cx<h.wc;cx+=2) ctx.fillRect(ox+cx*CELL,oy+cy*CELL,CELL,CELL);
  } else {
    ctx.fillStyle='#63625a'; ctx.fillRect(ox,oy,h.w,h.h);
    ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=2;
    for(let xx=80;xx<h.w;xx+=80){ ctx.beginPath(); ctx.moveTo(ox+xx,oy); ctx.lineTo(ox+xx,oy+h.h); ctx.stroke(); }
    for(let yy=80;yy<h.h;yy+=80){ ctx.beginPath(); ctx.moveTo(ox,oy+yy); ctx.lineTo(ox+h.w,oy+yy); ctx.stroke(); }
  }
  // soft shading along the inside of the walls
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=10;
  ctx.strokeRect(ox+WALL_T+5,oy+WALL_T+5,h.w-2*WALL_T-10,h.h-2*WALL_T-10);
  h.decor.forEach(d=>drawDecor(d));
  h.crates.forEach(c=>drawCrate(c));
}
function drawDecor(d){
  ctx.save();
  ctx.translate(d.x-camera.x,d.y-camera.y);
  ctx.rotate(d.rot);
  if(d.kind==='rug'){
    ctx.fillStyle='#6a2f2a'; rrect(ctx,-34,-22,68,44,4); ctx.fill();
    ctx.strokeStyle='#c9a35a'; ctx.lineWidth=2; ctx.strokeRect(-28,-16,56,32);
  } else if(d.kind==='bed'){
    ctx.fillStyle='#4a3a2a'; rrect(ctx,-30,-18,60,36,3); ctx.fill();
    ctx.fillStyle='#8b8f7a'; rrect(ctx,-27,-15,54,30,3); ctx.fill();
    ctx.fillStyle='#cfc7a8'; rrect(ctx,-25,-11,14,22,3); ctx.fill();
    ctx.fillStyle='#5f6b4c'; ctx.fillRect(-4,-15,31,30);
  } else if(d.kind==='table'){
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-20,-12,46,32);
    ctx.fillStyle='#8a6a42'; rrect(ctx,-24,-16,48,32,3); ctx.fill();
    ctx.strokeStyle='#4a361f'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#cfc7a8'; ctx.beginPath(); ctx.arc(-8,-2,5,0,Math.PI*2); ctx.fill();
  } else if(d.kind==='counter'){
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-32,-8,70,24);
    ctx.fillStyle='#4f5a55'; rrect(ctx,-36,-12,72,24,2); ctx.fill();
    ctx.fillStyle='#9aa39b'; ctx.fillRect(-36,-12,72,5);
    ctx.fillStyle='#2a2e2b'; ctx.fillRect(14,-6,14,12);
  } else if(d.kind==='pallet'){
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-16,-14,40,36);
    ctx.fillStyle='#7a6238'; ctx.fillRect(-20,-18,40,36);
    ctx.strokeStyle='#3d2f18'; ctx.lineWidth=2;
    for(let i=-20;i<20;i+=10) ctx.strokeRect(i,-18,10,36);
    ctx.fillStyle='#5f4a2a'; ctx.fillRect(-14,-12,18,16);
    ctx.strokeRect(-14,-12,18,16);
  } else if(d.kind==='desk'){
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-26,-10,60,28);
    ctx.fillStyle='#5a5f66'; rrect(ctx,-30,-14,60,28,2); ctx.fill();
    ctx.strokeStyle='#2c3036'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#cfc7a8'; ctx.fillRect(-20,-8,14,10);
    ctx.fillStyle='#1c1f24'; ctx.fillRect(6,-9,16,12);
  }
  ctx.restore();
}
const CRATE_STYLE = {
  house:{a:'#8a6a48',b:'#3a2a1a'}, store:{a:'#6e7f78',b:'#2c3833'},
  warehouse:{a:'#84653a',b:'#2b2118'}, police:{a:'#59657a',b:'#252c38'},
  hospital:{a:'#b9bdb4',b:'#4a4e48'}, garage:{a:'#7a5a48',b:'#2e211a'},
};
function drawCrate(c){
  const sx=c.x-camera.x, sy=c.y-camera.y;
  if(sx<-60||sy<-60||sx>canvas.width+60||sy>canvas.height+60) return;
  const st=CRATE_STYLE[c.kind]||CRATE_STYLE.warehouse;
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx+4,sy+5,c.w,c.h);
  if(!c.looted){
    const pulse = 0.35+0.4*Math.abs(Math.sin(performance.now()/450));
    ctx.save();
    ctx.shadowColor = 'rgba(240,200,90,'+pulse+')';
    ctx.shadowBlur = 12;
    ctx.fillStyle = st.a;
    ctx.fillRect(sx,sy,c.w,c.h);
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(sx,sy,c.w,4);
    ctx.strokeStyle = st.b; ctx.lineWidth=2;
    ctx.strokeRect(sx,sy,c.w,c.h);
    if(c.kind==='warehouse'){
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+c.w,sy+c.h); ctx.moveTo(sx+c.w,sy); ctx.lineTo(sx,sy+c.h); ctx.stroke();
    } else if(c.kind==='hospital'){
      ctx.fillStyle='#b23a3a'; ctx.fillRect(sx+c.w/2-2,sy+6,4,c.h-12); ctx.fillRect(sx+c.w/2-8,sy+c.h/2-2,16,4);
    } else if(c.kind==='police'){
      ctx.beginPath(); ctx.moveTo(sx+c.w/2,sy); ctx.lineTo(sx+c.w/2,sy+c.h); ctx.stroke();
      ctx.fillStyle='#f0c85a'; ctx.fillRect(sx+c.w/2-5,sy+c.h/2-2,3,4); ctx.fillRect(sx+c.w/2+2,sy+c.h/2-2,3,4);
    } else if(c.kind==='store'){
      ctx.beginPath(); ctx.moveTo(sx,sy+c.h/2); ctx.lineTo(sx+c.w,sy+c.h/2); ctx.stroke();
      ['#b23a3a','#d9a528','#8fa23a','#cfc7a8'].forEach((col,i)=>{ ctx.fillStyle=col; ctx.fillRect(sx+4+i*7,sy+4,5,7); ctx.fillRect(sx+4+i*7,sy+c.h/2+3,5,7); });
    } else {
      ctx.beginPath(); ctx.moveTo(sx+c.w/2,sy); ctx.lineTo(sx+c.w/2,sy+c.h); ctx.stroke();
      ctx.fillStyle='#d9a528'; ctx.beginPath(); ctx.arc(sx+c.w/2-4,sy+c.h/2,2,0,Math.PI*2); ctx.arc(sx+c.w/2+4,sy+c.h/2,2,0,Math.PI*2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#3d382e';
    ctx.fillRect(sx,sy,c.w,c.h);
    ctx.fillStyle = '#1f1c16';
    ctx.fillRect(sx+4,sy+4,c.w-8,c.h-8);
    ctx.strokeStyle = '#231e16'; ctx.lineWidth=2;
    ctx.strokeRect(sx,sy,c.w,c.h);
  }
}
function drawHouseWalls(h){
  if(!onScreen(h.x,h.y,h.w,h.h,10)) return;
  h.walls.forEach(w=>{
    const x=w.x-camera.x, y=w.y-camera.y;
    ctx.fillStyle = h.type.wall;
    ctx.fillRect(x,y,w.w,w.h);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    if(w.w>w.h) ctx.fillRect(x,y,w.w,4); else ctx.fillRect(x,y,4,w.h);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    if(w.w>w.h) ctx.fillRect(x,y+w.h-4,w.w,4); else ctx.fillRect(x+w.w-4,y,4,w.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth=1;
    ctx.strokeRect(x+0.5,y+0.5,w.w-1,w.h-1);
  });
  h.windows.forEach(w=>{
    const x=w.x-camera.x, y=w.y-camera.y;
    ctx.fillStyle='#9fc0cc'; ctx.fillRect(x,y,w.w,w.h);
    ctx.fillStyle='rgba(255,255,255,0.35)';
    if(w.w>w.h) ctx.fillRect(x+3,y+1,w.w*0.3,2); else ctx.fillRect(x+1,y+3,2,w.h*0.3);
    ctx.strokeStyle='#22262a'; ctx.lineWidth=1.5; ctx.strokeRect(x,y,w.w,w.h);
  });
  // door frame
  ctx.fillStyle='#2a2118';
  h.doors.forEach(d=>{
    if(d.w>d.h){ ctx.fillRect(d.x-camera.x-3,d.y-camera.y,3,d.h); ctx.fillRect(d.x+d.w-camera.x,d.y-camera.y,3,d.h); }
    else { ctx.fillRect(d.x-camera.x,d.y-camera.y-3,d.w,3); ctx.fillRect(d.x-camera.x,d.y+d.h-camera.y,d.w,3); }
  });
}
function drawRoof(h){
  if(h.roofA<=0.01 || !onScreen(h.x,h.y,h.w,h.h,10)) return;
  const sx=h.x-camera.x, sy=h.y-camera.y;
  ctx.save();
  ctx.globalAlpha = h.roofA;
  const horiz = h.w>=h.h;
  ctx.fillStyle = h.type.roof;
  ctx.fillRect(sx-4,sy-4,h.w+8,h.h+8);
  // shaded far slope
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  if(horiz) ctx.fillRect(sx-4,sy+h.h/2,h.w+8,h.h/2+4); else ctx.fillRect(sx+h.w/2,sy-4,h.w/2+4,h.h+8);
  ctx.strokeStyle = h.type.roofDark; ctx.lineWidth = 2;
  if(horiz){ for(let yy=8; yy<h.h; yy+=12){ ctx.beginPath(); ctx.moveTo(sx-4, sy+yy); ctx.lineTo(sx+h.w+4, sy+yy); ctx.stroke(); } }
  else { for(let xx=8; xx<h.w; xx+=12){ ctx.beginPath(); ctx.moveTo(sx+xx, sy-4); ctx.lineTo(sx+xx, sy+h.h+4); ctx.stroke(); } }
  // ridge
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=4;
  ctx.beginPath();
  if(horiz){ ctx.moveTo(sx-4,sy+h.h/2); ctx.lineTo(sx+h.w+4,sy+h.h/2); } else { ctx.moveTo(sx+h.w/2,sy-4); ctx.lineTo(sx+h.w/2,sy+h.h+4); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth=3;
  ctx.strokeRect(sx-4,sy-4,h.w+8,h.h+8);
  if(h.typeId==='house'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx+h.w*0.72+5,sy+h.h*0.22+6,22,22);
    ctx.fillStyle='#5a4a42'; ctx.fillRect(sx+h.w*0.72,sy+h.h*0.22,22,22);
    ctx.fillStyle='#1a1512'; ctx.fillRect(sx+h.w*0.72+5,sy+h.h*0.22+5,12,12);
  } else if(h.typeId==='warehouse' || h.typeId==='garage'){
    ctx.fillStyle='#3a3a36'; ctx.beginPath(); ctx.arc(sx+h.w*0.3,sy+h.h*0.3,11,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#22221f'; ctx.lineWidth=2; ctx.stroke();
  } else if(h.typeId==='hospital'){
    ctx.fillStyle='#e8e2d0'; ctx.fillRect(sx+h.w*0.2-16,sy+h.h*0.25-16,32,32);
    ctx.fillStyle='#b23a3a'; ctx.fillRect(sx+h.w*0.2-4,sy+h.h*0.25-12,8,24); ctx.fillRect(sx+h.w*0.2-12,sy+h.h*0.25-4,24,8);
  }
  // sign
  ctx.font='bold 13px system-ui, sans-serif';
  const tw=ctx.measureText(h.type.name).width+18;
  const cx=sx+h.w/2, cy=sy+h.h/2;
  ctx.fillStyle='rgba(16,16,10,0.72)'; rrect(ctx,cx-tw/2,cy-12,tw,24,3); ctx.fill();
  ctx.strokeStyle='rgba(217,165,40,0.7)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#f0c85a'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(h.type.name,cx,cy+1);
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.restore();
}

function drawObstacle(o){
  if(!onScreen(o.x,o.y,o.w,o.h,60)) return;
  const sx=o.x-camera.x, sy=o.y-camera.y;
  ctx.save();
  if(o.type==='tree'){
    ctx.translate(sx+15,sy+15);
    shadow(4,6,12,9);
    ctx.fillStyle='#4a3824'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2a1f12'; ctx.lineWidth=2; ctx.stroke();
    if(o.res<=0){ ctx.strokeStyle='#8a6a42'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.stroke(); }
  } else if(o.type==='deadtree'){
    ctx.translate(sx+15,sy+15);
    shadow(4,6,11,8);
    if(o.res>0){
      ctx.strokeStyle='#3a2f22'; ctx.lineWidth=4; ctx.lineCap='round';
      o.branches.forEach(b=>{
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(b.a)*b.l,Math.sin(b.a)*b.l); ctx.stroke();
      });
      ctx.lineWidth=2;
      o.branches.forEach(b=>{
        const ex=Math.cos(b.a)*b.l*0.6, ey=Math.sin(b.a)*b.l*0.6;
        ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex+Math.cos(b.a+0.8)*10,ey+Math.sin(b.a+0.8)*10); ctx.stroke();
      });
    }
    ctx.fillStyle='#2b241a'; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
  } else if(o.type==='car'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; rrect(ctx,sx+5,sy+7,o.w,o.h,8); ctx.fill();
    ctx.translate(sx+o.w/2,sy+o.h/2);
    if(o.h>o.w) ctx.rotate(Math.PI/2);
    const L=Math.max(o.w,o.h), W=Math.min(o.w,o.h);
    ctx.fillStyle='#16140f';
    [[-L*0.3,-W/2-2],[L*0.22,-W/2-2],[-L*0.3,W/2-4],[L*0.22,W/2-4]].forEach(p=>ctx.fillRect(p[0],p[1],14,6));
    ctx.fillStyle = o.res>0 ? o.color : '#33302a';
    rrect(ctx,-L/2,-W/2,L,W,8); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.22)'; rrect(ctx,-L*0.22,-W/2+5,L*0.42,W-10,5); ctx.fill();
    ctx.fillStyle='#22303a'; ctx.fillRect(L*0.12,-W/2+7,L*0.1,W-14);
    ctx.fillStyle='#1c262e'; ctx.fillRect(-L*0.3,-W/2+7,L*0.08,W-14);
    ctx.fillStyle='rgba(120,60,30,0.45)'; ctx.beginPath(); ctx.ellipse(L*0.34,-W*0.2,7,5,0.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-L*0.38,W*0.25,6,4,0,0,Math.PI*2); ctx.fill();
  } else if(o.type==='rubble'){
    ctx.translate(sx+o.w/2, sy+o.h/2);
    shadow(4,6,o.w*0.48,o.h*0.42);
    const cols = o.res>0 ? ['#5a564c','#6a665a','#4a473f'] : ['#3a3832','#42403a','#34322d'];
    o.blobs.forEach(b=>{
      ctx.fillStyle=cols[b.s];
      ctx.beginPath(); ctx.ellipse(b.dx,b.dy,b.rx,b.ry,b.a,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
    });
  } else if(o.type==='rock'){
    ctx.translate(sx+o.w/2, sy+o.h/2);
    shadow(5,7,o.w*0.5,o.h*0.44);
    const spent = o.res<=0, k = spent ? 0.72 : 1; // a mined-out boulder is left as a low, dark stump
    const path = s=>{ ctx.beginPath(); o.pts.forEach((p,i)=>{ if(i) ctx.lineTo(p.x*s,p.y*s); else ctx.moveTo(p.x*s,p.y*s); }); ctx.closePath(); };
    path(k); ctx.fillStyle = spent ? '#45433d' : '#77756b'; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=2; ctx.stroke();
    ctx.save(); ctx.translate(-o.w*0.07,-o.h*0.09); path(k*0.62);
    ctx.fillStyle = spent ? '#514f48' : '#918f84'; ctx.fill(); ctx.restore();
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-o.w*0.1,o.h*0.05); ctx.lineTo(o.w*0.12,o.h*0.2); ctx.lineTo(o.w*0.2,o.h*0.02); ctx.stroke();
    if(!spent && o.vein){
      ctx.fillStyle = VEIN_COL[o.vein];
      o.spots.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
      if(o.vein!=='coal'){ ctx.fillStyle='rgba(255,255,255,0.35)'; o.spots.forEach(p=>ctx.fillRect(p.x-1,p.y-1.5,1.6,1.6)); }
    }
  } else {
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx+4,sy+5,o.w,o.h);
    ctx.fillStyle = o.res>0 ? '#6e5a36' : '#4a4030';
    ctx.fillRect(sx,sy,o.w,o.h);
    ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(sx,sy,o.w,3);
    ctx.strokeStyle='#2b2318'; ctx.lineWidth=2;
    for(let i=0;i<o.w;i+=16) ctx.strokeRect(sx+i,sy,16,o.h);
  }
  ctx.restore();
}
const CANOPY_COLS = ['#3f5228','#4a5f2e','#35471f'];
function drawCanopy(o){
  if(o.type!=='tree' || o.res<=0) return;
  if(!onScreen(o.x-30,o.y-30,90,90,10)) return;
  const cx=o.x+15-camera.x, cy=o.y+15-camera.y;
  const near = dist2(o.x+15,o.y+15,player.x,player.y) < 52*52;
  ctx.save();
  ctx.globalAlpha = near ? 0.35 : 0.93;
  ctx.fillStyle='rgba(0,0,0,0.22)';
  o.blobs.forEach(b=>{ ctx.beginPath(); ctx.arc(cx+b.dx+7,cy+b.dy+10,b.r,0,Math.PI*2); ctx.fill(); });
  o.blobs.forEach(b=>{
    ctx.fillStyle=CANOPY_COLS[b.s];
    ctx.beginPath(); ctx.arc(cx+b.dx,cy+b.dy,b.r,0,Math.PI*2); ctx.fill();
  });
  ctx.fillStyle='rgba(180,200,110,0.16)';
  o.blobs.forEach(b=>{ ctx.beginPath(); ctx.arc(cx+b.dx-b.r*0.25,cy+b.dy-b.r*0.3,b.r*0.5,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
}

function drawPickup(p,highlight){
  const sx=p.x-camera.x, sy=p.y-camera.y;
  if(sx<-30||sy<-30||sx>canvas.width+30||sy>canvas.height+30) return;
  ctx.save();
  ctx.translate(sx,sy);
  if(highlight){
    ctx.strokeStyle='rgba(240,200,90,'+(0.5+0.4*Math.sin(performance.now()/160))+')';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.stroke();
  }
  shadow(2,4,9,5);
  const glint=Math.sin(performance.now()/380+p.phase);
  ctx.rotate(p.rot);
  if(p.w){ // a dropped weapon
    ctx.drawImage(weaponIconCanvas(p.w.id),-17,-8.5,34,17);
  } else if(p.type==='wood'){
    ctx.fillStyle='#8a6238'; rrect(ctx,-11,-5,22,5,2); ctx.fill();
    ctx.fillStyle='#a67844'; rrect(ctx,-9,1,20,5,2); ctx.fill();
    ctx.fillStyle='#d6b47a'; ctx.beginPath(); ctx.arc(10,-2.5,2.3,0,Math.PI*2); ctx.arc(10,3.5,2.3,0,Math.PI*2); ctx.fill();
  } else if(p.type==='stone'){
    ctx.fillStyle='#8c8c82'; ctx.beginPath(); ctx.moveTo(-8,2); ctx.lineTo(-4,-6); ctx.lineTo(4,-7); ctx.lineTo(9,-1); ctx.lineTo(6,6); ctx.lineTo(-4,7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#4a4a44'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#b0b0a6'; ctx.beginPath(); ctx.moveTo(-3,-4); ctx.lineTo(3,-5); ctx.lineTo(1,0); ctx.closePath(); ctx.fill();
  } else if(p.type==='metal'){
    ctx.fillStyle='#75848c'; ctx.beginPath(); ctx.moveTo(-9,-4); ctx.lineTo(6,-7); ctx.lineTo(9,3); ctx.lineTo(-5,7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#343c42'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#b8c6cc'; ctx.fillRect(-4,-3,7,2);
    ctx.fillStyle='#8a4a2a'; ctx.beginPath(); ctx.arc(4,2,2,0,Math.PI*2); ctx.fill();
  } else if(p.type==='cloth'){
    ctx.fillStyle='#c9bfa0'; ctx.beginPath(); ctx.moveTo(-9,-3); ctx.quadraticCurveTo(-2,-9,8,-5); ctx.quadraticCurveTo(11,2,5,7); ctx.quadraticCurveTo(-4,4,-8,6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#7d7458'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,-2); ctx.quadraticCurveTo(1,1,5,-1); ctx.stroke();
  } else if(ITEMS[p.type].food && p.type!=='food'){
    ctx.rotate(-p.rot);
    ctx.translate(-11,-11);
    drawItemIcon(ctx,p.type,22,22);
    ctx.translate(11,11);
  } else if(p.type==='food'){
    ctx.rotate(-p.rot);
    ctx.fillStyle='#8a2f2a'; rrect(ctx,-6,-7,12,14,2); ctx.fill();
    ctx.fillStyle='#cfc7a8'; ctx.fillRect(-6,-2,12,5);
    ctx.fillStyle='#b8c6cc'; ctx.fillRect(-6,-7,12,2.5);
    ctx.strokeStyle='#2a1512'; ctx.lineWidth=1; rrect(ctx,-6,-7,12,14,2); ctx.stroke();
  } else if(p.type==='ammo'){
    ctx.fillStyle='#55602f'; rrect(ctx,-8,-6,16,12,2); ctx.fill();
    ctx.strokeStyle='#23280f'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#f0c85a'; for(let i=0;i<3;i++) ctx.fillRect(-5+i*4,-3,2.5,6);
  } else if(p.type==='medkit'){
    ctx.fillStyle='#e8e2d0'; rrect(ctx,-8,-6,16,12,2); ctx.fill();
    ctx.fillStyle='#b23a3a'; ctx.fillRect(-1.5,-4,3,8); ctx.fillRect(-4,-1.5,8,3);
  } else if(p.type==='herb'){
    ctx.strokeStyle='#3d6a2e'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,7); ctx.lineTo(0,-2); ctx.stroke();
    ctx.fillStyle='#6fbf5a';
    [[-5,-2,-0.7],[5,-2,0.7],[0,-6,0]].forEach(l=>{ ctx.beginPath(); ctx.ellipse(l[0],l[1],5.5,2.8,l[2]+Math.PI/2,0,Math.PI*2); ctx.fill(); });
    ctx.strokeStyle='#3d6a2e'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(0,-9); ctx.stroke();
  } else if(p.type==='coal' || p.type==='sulfur' || p.type==='ore'){
    ctx.fillStyle = p.type==='coal' ? '#2a2a30' : ITEMS[p.type].color;
    [[-4,1,5],[4,2,4.2],[0,-4,4.4]].forEach(l=>{ ctx.beginPath(); ctx.arc(l[0],l[1],l[2],0,Math.PI*2); ctx.fill(); });
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(-4,1,5,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(-1.5,-6,2,2); ctx.fillRect(3,0,1.6,1.6);
  } else if(p.type==='fuel'){
    ctx.rotate(-p.rot);
    ctx.fillStyle='#a8402a'; rrect(ctx,-6,-7,12,14,2); ctx.fill();
    ctx.strokeStyle='#3a140c'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#22241f'; ctx.fillRect(1,-10,4,3);
    ctx.fillStyle='#f0c85a'; ctx.fillRect(-3,-2,6,4);
  } else if(p.type==='gunpowder'){
    ctx.rotate(-p.rot);
    ctx.fillStyle='#5a4a36'; ctx.beginPath(); ctx.ellipse(0,2,8,6.5,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2a2016'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#7a6648'; ctx.fillRect(-3,-7,6,4);
    ctx.fillStyle='#22221e'; ctx.fillRect(-2.5,-0.5,5,4);
  } else if(p.type==='grenade'){
    ctx.fillStyle='#55692f'; ctx.beginPath(); ctx.ellipse(0,1,6,7,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#23280f'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#8a8f92'; ctx.fillRect(-2.5,-9,5,3.5);
  } else {
    // steel, parts, rope, molotov: a small crate in the item's colour
    ctx.fillStyle=ITEMS[p.type].color; rrect(ctx,-8,-6,16,12,2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-8,-1,16,2);
  }
  if(glint>0.85){ ctx.fillStyle='rgba(255,255,230,0.9)'; ctx.fillRect(-1,-9,2,6); ctx.fillRect(-3,-7,6,2); }
  ctx.restore();
}

function drawStructure(s){
  if(!onScreen(s.x,s.y,CELL,CELL,40)) return;
  const x=s.x-camera.x, y=s.y-camera.y, id=s.def.id, t=performance.now()/1000;
  if(id==='woodwall'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+4,y+6,CELL,CELL);
    ctx.fillStyle='#7d5c34'; ctx.fillRect(x,y,CELL,CELL);
    ctx.fillStyle='#93703f'; ctx.fillRect(x,y,CELL,5);
    ctx.strokeStyle='#3a2a16'; ctx.lineWidth=1.5;
    for(let i=10;i<CELL;i+=10){ ctx.beginPath(); ctx.moveTo(x+i,y); ctx.lineTo(x+i,y+CELL); ctx.stroke(); }
    ctx.fillStyle='#5f4526'; ctx.fillRect(x,y+15,CELL,6);
    ctx.fillStyle='#1e1a14'; [[5,17],[15,17],[25,17],[35,17]].forEach(p=>ctx.fillRect(x+p[0]-1,y+p[1],2,2));
    ctx.strokeStyle='#2b1f10'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
  } else if(id==='metalwall'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+4,y+6,CELL,CELL);
    ctx.fillStyle='#6a747a'; ctx.fillRect(x,y,CELL,CELL);
    ctx.fillStyle='#8a959b'; ctx.fillRect(x,y,CELL,5);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(x,y+CELL-6,CELL,6);
    ctx.save(); ctx.beginPath(); ctx.rect(x+4,y+15,CELL-8,10); ctx.clip();
    for(let i=-10;i<CELL+10;i+=12){ ctx.fillStyle=(i/12|0)%2?'#d9a528':'#1a1a12'; ctx.beginPath(); ctx.moveTo(x+i,y+25); ctx.lineTo(x+i+6,y+15); ctx.lineTo(x+i+12,y+15); ctx.lineTo(x+i+6,y+25); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle='#2e3438'; [[5,7],[35,7],[5,33],[35,33]].forEach(p=>{ ctx.beginPath(); ctx.arc(x+p[0],y+p[1],2,0,Math.PI*2); ctx.fill(); });
    ctx.strokeStyle='#2a3034'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
  } else if(id==='steelwall'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+4,y+6,CELL,CELL);
    ctx.fillStyle='#8c9aa4'; ctx.fillRect(x,y,CELL,CELL);
    ctx.fillStyle='#b4c2cc'; ctx.fillRect(x,y,CELL,5);
    ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(x,y+CELL-6,CELL,6);
    ctx.strokeStyle='rgba(30,38,44,0.7)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x+4,y+13); ctx.lineTo(x+CELL-4,y+13); ctx.moveTo(x+4,y+27); ctx.lineTo(x+CELL-4,y+27); ctx.moveTo(x+20,y+13); ctx.lineTo(x+20,y+27); ctx.stroke();
    ctx.fillStyle='#39434a'; [[6,7],[34,7],[6,33],[34,33],[20,7],[20,33]].forEach(p=>{ ctx.beginPath(); ctx.arc(x+p[0],y+p[1],2,0,Math.PI*2); ctx.fill(); });
    ctx.strokeStyle='#28323a'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
  } else if(id==='mine'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x+22,y+23,12,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a5234'; ctx.beginPath(); ctx.arc(x+20,y+20,11,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#23280f'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#2e3420'; ctx.beginPath(); ctx.arc(x+20,y+20,5.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = Math.sin(t*5+s.phase)>0.2 ? '#e04b4b' : '#5a1c1c';
    ctx.beginPath(); ctx.arc(x+20,y+20,2.4,0,Math.PI*2); ctx.fill();
  } else if(id==='door'){
    const near = dist2(s.x+20,s.y+20,player.x,player.y) < 60*60;
    ctx.fillStyle='#3a2a16'; ctx.fillRect(x,y,CELL,4); ctx.fillRect(x,y+CELL-4,CELL,4); ctx.fillRect(x,y,4,CELL); ctx.fillRect(x+CELL-4,y,4,CELL);
    ctx.save(); ctx.globalAlpha = near?0.35:1;
    ctx.fillStyle='#a07a46'; ctx.fillRect(x+4,y+4,CELL-8,CELL-8);
    ctx.strokeStyle='#4a361c'; ctx.lineWidth=1.5; ctx.strokeRect(x+8,y+8,CELL-16,CELL-16);
    ctx.fillStyle='#d9a528'; ctx.beginPath(); ctx.arc(x+CELL-11,y+CELL/2,2.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  } else if(id==='spikes'){
    ctx.fillStyle='rgba(30,26,18,0.75)'; ctx.fillRect(x+3,y+3,CELL-6,CELL-6);
    ctx.strokeStyle='#5f4526'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x+5,y+5); ctx.lineTo(x+CELL-5,y+CELL-5); ctx.moveTo(x+CELL-5,y+5); ctx.lineTo(x+5,y+CELL-5); ctx.stroke();
    ctx.fillStyle='#b8c6cc';
    [[10,10],[30,10],[20,20],[10,30],[30,30],[20,8],[20,32],[8,20],[32,20]].forEach(p=>{
      ctx.beginPath(); ctx.moveTo(x+p[0],y+p[1]-5); ctx.lineTo(x+p[0]+3,y+p[1]+3); ctx.lineTo(x+p[0]-3,y+p[1]+3); ctx.closePath(); ctx.fill();
    });
  } else if(id==='campfire'){
    const cx=x+20, cy=y+20, fl=Math.sin(t*11+s.phase)*0.5+Math.sin(t*17)*0.5;
    const g=ctx.createRadialGradient(cx,cy,4,cx,cy,70+fl*5);
    g.addColorStop(0,'rgba(240,160,60,0.3)'); g.addColorStop(1,'rgba(240,160,60,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,76,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6a6a62';
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*13,cy+Math.sin(a)*13,4.5,0,Math.PI*2); ctx.fill(); }
    ctx.strokeStyle='#4a361c'; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-8,cy-6); ctx.lineTo(cx+8,cy+6); ctx.moveTo(cx+8,cy-6); ctx.lineTo(cx-8,cy+6); ctx.stroke();
    ctx.lineCap='butt';
    ctx.fillStyle='#e8642a'; ctx.beginPath(); ctx.arc(cx,cy,8+fl*1.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#f0c85a'; ctx.beginPath(); ctx.arc(cx+fl,cy-1,4.5+fl,0,Math.PI*2); ctx.fill();
  } else if(id==='workbench'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+7,y+9,CELL-6,CELL-6);
    ctx.fillStyle='#8a6a42'; rrect(ctx,x+3,y+3,CELL-6,CELL-6,3); ctx.fill();
    ctx.strokeStyle='#3d2c16'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#a8854f'; ctx.fillRect(x+5,y+5,CELL-10,4);
    ctx.fillStyle='#b8c6cc'; ctx.fillRect(x+9,y+14,14,4);
    ctx.fillStyle='#4a361c'; ctx.fillRect(x+21,y+13,8,6);
    ctx.strokeStyle='#33362f'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x+10,y+30); ctx.lineTo(x+28,y+24); ctx.stroke();
    ctx.fillStyle='#d9a528'; ctx.beginPath(); ctx.arc(x+30,y+29,3,0,Math.PI*2); ctx.fill();
  } else if(id==='chest'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+7,y+9,CELL-6,CELL-6);
    ctx.fillStyle='#7a5630'; rrect(ctx,x+3,y+5,CELL-6,CELL-10,3); ctx.fill();
    ctx.strokeStyle='#33220f'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#93703f'; ctx.fillRect(x+5,y+7,CELL-10,9);
    ctx.fillStyle='#5a646a'; ctx.fillRect(x+3,y+16,CELL-6,3); ctx.fillRect(x+9,y+5,3,CELL-10); ctx.fillRect(x+CELL-12,y+5,3,CELL-10);
    ctx.fillStyle = invChest===s ? '#f0c85a' : '#d9a528'; ctx.fillRect(x+17,y+14,6,7);
    ctx.fillStyle='#1c1e18'; ctx.fillRect(x+19,y+17,2,3);
  } else if(id==='stove'){
    const fl=Math.sin(t*10+s.phase)*0.5+Math.sin(t*16)*0.5;
    const g=ctx.createRadialGradient(x+20,y+26,3,x+20,y+26,46+fl*4);
    g.addColorStop(0,'rgba(240,150,60,0.22)'); g.addColorStop(1,'rgba(240,150,60,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x+20,y+26,50,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+7,y+9,CELL-6,CELL-6);
    // stone body, iron top plate with a pot, fire door at the front
    ctx.fillStyle='#6e6e66'; rrect(ctx,x+3,y+3,CELL-6,CELL-6,3); ctx.fill();
    ctx.strokeStyle='#2e2e2a'; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+4,y+25); ctx.lineTo(x+36,y+25); ctx.moveTo(x+14,y+25); ctx.lineTo(x+14,y+36); ctx.moveTo(x+27,y+25); ctx.lineTo(x+27,y+36); ctx.stroke();
    ctx.fillStyle='#33383a'; rrect(ctx,x+6,y+6,CELL-12,16,2); ctx.fill();
    ctx.fillStyle='#565e62'; ctx.beginPath(); ctx.arc(x+20,y+14,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a8522a'; ctx.beginPath(); ctx.arc(x+20,y+14,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#565e62'; ctx.fillRect(x+10,y+13,4,2); ctx.fillRect(x+26,y+13,4,2);
    ctx.fillStyle='#1c1410'; ctx.fillRect(x+15,y+27,10,7);
    ctx.fillStyle='#e8642a'; ctx.fillRect(x+16,y+30-fl,8,4+fl);
    ctx.fillStyle='#f0c85a'; ctx.fillRect(x+18,y+31-fl,4,3+fl);
  } else if(id==='turret'){
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+6,y+8,CELL-6,CELL-6);
    ctx.fillStyle='#4e565a'; rrect(ctx,x+4,y+4,CELL-8,CELL-8,4); ctx.fill();
    ctx.strokeStyle='#22282c'; ctx.lineWidth=2; ctx.stroke();
    // the gun turns toward whatever it last shot at
    ctx.save(); ctx.translate(x+20,y+20); ctx.rotate(s.aim||0);
    ctx.fillStyle='#2a3034'; ctx.fillRect(4,-3,19,6);
    ctx.fillStyle='#7f8c92'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#22282c'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#d9a528'; ctx.fillRect(-3,-3,6,6);
    ctx.restore();
    // status lamp: loaded, or blinking red when empty
    ctx.fillStyle = s.ammo>0 ? '#8fd16a' : (Math.sin(t*6+s.phase)>0 ? '#e04b4b' : '#5a1c1c');
    ctx.beginPath(); ctx.arc(x+8,y+8,2.4,0,Math.PI*2); ctx.fill();
  } else if(id==='lamp'){
    const g=ctx.createRadialGradient(x+20,y+20,4,x+20,y+20,90);
    g.addColorStop(0,'rgba(255,240,190,0.22)'); g.addColorStop(1,'rgba(255,240,190,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x+20,y+20,90,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x+23,y+25,13,10,0,0,Math.PI*2); ctx.fill();
    // tripod, mast and the lamp head
    ctx.strokeStyle='#3a4046'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+20,y+20); ctx.lineTo(x+8,y+32); ctx.moveTo(x+20,y+20); ctx.lineTo(x+32,y+32); ctx.moveTo(x+20,y+20); ctx.lineTo(x+20,y+6); ctx.stroke();
    ctx.lineCap='butt';
    ctx.fillStyle='#5a646a'; rrect(ctx,x+11,y+10,18,13,3); ctx.fill();
    ctx.strokeStyle='#22282c'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#fff2c0'; ctx.beginPath(); ctx.arc(x+20,y+16.5,4.5,0,Math.PI*2); ctx.fill();
  } else if(id==='outpost'){
    const on = s.cell===checkpoint, wave = Math.sin(t*4+s.phase)*3;
    if(on){
      ctx.strokeStyle='rgba(143,209,106,'+(0.35+0.2*Math.sin(t*3))+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x+20,y+20,26,0,Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x+24,y+26,15,10,0,0,Math.PI*2); ctx.fill();
    // sandbag ring
    ctx.fillStyle='#8a7c58'; ctx.strokeStyle='#3d3524'; ctx.lineWidth=1.5;
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; ctx.beginPath(); ctx.ellipse(x+20+Math.cos(a)*12,y+22+Math.sin(a)*10,7,5,a,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
    // pole + flag
    ctx.strokeStyle='#2b241a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x+20,y+24); ctx.lineTo(x+20,y-14); ctx.stroke();
    ctx.fillStyle = on ? '#8fd16a' : '#a89a6a';
    ctx.beginPath(); ctx.moveTo(x+21,y-14); ctx.quadraticCurveTo(x+30,y-17+wave,x+40,y-11+wave); ctx.lineTo(x+40,y+1+wave); ctx.quadraticCurveTo(x+30,y-5+wave,x+21,y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.stroke();
  }
  const ratio=s.hp/s.maxHp;
  if(ratio<0.999 && (s.def.blockZ||id==='spikes')){
    if(s.def.blockZ && ratio<0.6){
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(x+8,y+6); ctx.lineTo(x+18,y+18); ctx.lineTo(x+13,y+30);
      if(ratio<0.3){ ctx.moveTo(x+32,y+8); ctx.lineTo(x+24,y+22); ctx.lineTo(x+30,y+34); }
      ctx.stroke();
    }
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(x+5,y-7,CELL-10,4);
    ctx.fillStyle=ratio>0.5?'#8fa23a':(ratio>0.25?'#d9a528':'#b23a3a');
    ctx.fillRect(x+5,y-7,(CELL-10)*Math.max(0,ratio),4);
  }
}

// Legs follow the walk direction, the torso eases between walking and aiming (player.bodyAngle),
// head and hands follow the mouse. Hands are placed first, then the arms bend to reach them.
function drawPlayer(){
  const sx = player.x-camera.x, sy = player.y-camera.y;
  const aim = player.angle, body = player.bodyAngle, now = performance.now()/1000;
  const wdef = WEAPONS[player.weapon];
  const gun = !wdef.melee, long = gun && wdef.len>16; // long guns get a stock and a forward grip
  const rot = (a,x,y)=>[x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a)];
  const mix = (p,q,k)=>[p[0]+(q[0]-p[0])*k, p[1]+(q[1]-p[1])*k];
  const ease = k=>1-Math.pow(1-k,3);
  const step = player.moving ? Math.sin(player.walk) : 0;
  const breathe = Math.sin(now*2.4)*(player.moving?0.3:1);

  // melee swing: strike over the first 60%, then recover to the ready stance
  const sk = player.swing>0 ? 1-player.swing/SWING_T : -1;
  const strike = sk>=0 ? ease(Math.min(1,sk/0.6)) : 0;
  const recover = sk>=0.6 ? (sk-0.6)/0.4 : 0;
  const dir = player.swingDir;
  const lunge = sk>=0 ? Math.sin(sk*Math.PI)*4 : 0;
  const twist = sk>=0 ? dir*(strike-0.5)*0.7*(1-recover) : 0;
  const torso = body + clamp(normAngle(aim-body),-1.1,1.1)*0.6 + twist;
  const dk = player.draw>0 ? ease(1-player.draw/DRAW_T) : 1; // weapon coming up after a switch
  const mw = meleeWeapon(), reach = mw.range-4;
  const armored = player.gear.armor || player.gear.steelarmor;

  // --- hands
  const shR = rot(torso,1,10), shL = rot(torso,1,-10);
  let hR, hL, wAng, back = 0, trail = null;
  if(!gun){
    const ready = rot(aim, 15+step*2+breathe*0.4, 8), readyAng = aim-0.35;
    hR = ready; wAng = readyAng;
    hL = rot(aim, 11-step*3, -9+breathe*0.5);
    if(sk>=0){
      const a0 = -dir*1.25, phi = a0+dir*2.5*strike, cutAng = aim+phi+dir*0.45;
      hR = mix(rot(aim+phi, reach*0.42+7*Math.sin(strike*Math.PI), 0), ready, recover);
      wAng = cutAng + normAngle(readyAng-cutAng)*recover;
      hL = mix(rot(aim,5,-12), hL, recover); // off hand pulls back for balance
      trail = {a0:aim+a0, a1:aim+phi};
    }
    hR = mix(rot(torso,-2,13), hR, dk); // drawn from the belt
    wAng += (1-dk)*1.4;
  } else {
    const rk = player.reload>0 ? 1-player.reload/player.reloadMax : -1;
    const dip = rk>=0 ? Math.sin(rk*Math.PI) : 0;
    wAng = aim + (1-dk)*1.2 + dip*0.35 + step*0.03;
    if(sk>=0){ // striking with the gun itself
      wAng += dir*(strike-0.5)*1.6*(1-recover);
      trail = {a0:aim-dir*0.8, a1:aim-dir*0.8+dir*1.6*strike};
    }
    back = player.recoil*player.recoil*(2+wdef.shake*0.7) + (1-dk)*6;
    hR = rot(wAng, 17-back, 2);
    hL = rot(wAng, (long?25:18)-back, long?-1:-2);
    if(rk>=0) hL = mix(hL, rot(torso,-1,-12), Math.min(1,dip*1.3)); // off hand fetches a magazine
  }
  if(player.gestT>0){
    // off hand reaches out (pick up, loot, build) or comes up to the mouth / chest (eat, heal)
    const gk = Math.sin((1-player.gestT/player.gestMax)*Math.PI);
    const to = player.gest==='reach' ? rot(aim,27,-4) : (player.gest==='eat' ? rot(aim,9,-3) : rot(torso,3,-2));
    hL = mix(hL, to, gk);
  }

  shadow(sx+3,sy+5,14,11);
  ctx.save();
  ctx.translate(sx+Math.cos(aim)*lunge, sy+Math.sin(aim)*lunge);

  // --- feet
  ctx.save();
  ctx.rotate(body);
  ctx.fillStyle='#22241c';
  ctx.beginPath(); ctx.ellipse(-1+step*5,-6,5.5,3.6,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-1-step*5,6,5.5,3.6,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // --- swing trail
  if(trail){
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(240,230,200,'+(0.55*(1-sk))+')'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.arc(0,0,reach,trail.a0,trail.a1,dir<0); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,'+(0.5*(1-sk))+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,reach+1,trail.a0+(trail.a1-trail.a0)*0.5,trail.a1,dir<0); ctx.stroke();
    ctx.lineCap='butt';
  }

  // --- weapon
  ctx.save();
  if(!gun){
    ctx.translate(hR[0],hR[1]);
    ctx.rotate(wAng);
    const wid = wdef.look||player.weapon, head = TIER_COL[wdef.tier]||'#c8d2d6';
    if(wid==='fist'){
      // bare hands: nothing to draw
    } else if(wid==='bat'){
      ctx.fillStyle='#3a2a16'; ctx.fillRect(-4,-1.6,9,3.2);
      ctx.fillStyle='#8a6238'; ctx.beginPath(); ctx.moveTo(5,-1.8); ctx.lineTo(27,-3.4); ctx.lineTo(27,3.4); ctx.lineTo(5,1.8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#3a2a16'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#c8d2d6'; [[19,-5],[23,3.6],[25,-5.2]].forEach(n=>ctx.fillRect(n[0],n[1],1.4,2.4));
    } else if(wid==='axe'){
      ctx.fillStyle='#7a5630'; ctx.fillRect(-4,-1.5,28,3);
      ctx.fillStyle=head; ctx.beginPath(); ctx.moveTo(16,-1.5); ctx.lineTo(17,-9); ctx.quadraticCurveTo(24,-10,27,-5); ctx.lineTo(24,-1.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#4a5258'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#5a646a'; ctx.fillRect(16,-1.5,8,4);
    } else if(wid==='pickaxe'){
      ctx.fillStyle='#7a5630'; ctx.fillRect(-4,-1.5,29,3);
      ctx.strokeStyle=head; ctx.lineWidth=3.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(19,-12); ctx.quadraticCurveTo(27,0,19,12); ctx.stroke();
      ctx.lineCap='butt';
      ctx.fillStyle='#5a646a'; ctx.fillRect(21,-2.5,5,5);
    } else if(wid==='spear'){
      ctx.fillStyle='#7a5630'; ctx.fillRect(-12,-1.2,44,2.4);
      ctx.fillStyle='#b89a62'; ctx.fillRect(28,-2,4,4);
      ctx.fillStyle='#c8d2d6'; ctx.beginPath(); ctx.moveTo(32,-3.2); ctx.lineTo(44,0); ctx.lineTo(32,3.2); ctx.closePath(); ctx.fill();
    } else if(wid==='machete'){
      ctx.fillStyle='#3a2a16'; ctx.fillRect(-3,-1.7,8,3.4);
      ctx.fillStyle='#c8d2d6'; ctx.beginPath(); ctx.moveTo(5,-2); ctx.lineTo(26,-4); ctx.lineTo(31,-0.5); ctx.lineTo(27,2.2); ctx.lineTo(5,2.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(7,-1.4,19,0.9);
    } else if(wid==='sledge'){
      ctx.fillStyle='#7a5630'; ctx.fillRect(-5,-1.6,27,3.2);
      ctx.fillStyle='#5a646a'; rrect(ctx,19,-7,9,14,2); ctx.fill();
      ctx.strokeStyle='#2a3034'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(20,-6,7,2);
    } else {
      ctx.fillStyle='#3a2a16'; ctx.fillRect(-3,-1.6,7,3.2);
      ctx.fillStyle='#8a8f92'; ctx.fillRect(3.4,-3,1.6,6);
      ctx.fillStyle='#c8d2d6'; ctx.beginPath(); ctx.moveTo(5,-2.4); ctx.lineTo(8+wdef.len,0.4); ctx.lineTo(5,2.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(6,-1.6,wdef.len-2,0.9);
    }
  } else {
    const tip = 16+wdef.len;
    ctx.rotate(wAng);
    ctx.translate(-back,0);
    const wid = player.weapon, thick = (wid==='launcher'||wid==='flamer') ? 7 : (wid==='lmg' ? 6 : 5);
    if(long){ ctx.fillStyle = (wid==='smg'||wid==='lmg'||wid==='flamer') ? '#2c2e2a' : '#6a4a28'; ctx.fillRect(6,-3,12,6); }
    ctx.fillStyle = wid==='revolver' ? '#8a8f92' : '#22241f'; ctx.fillRect(16,-thick/2,wdef.len,thick);
    if(wid==='sniper'){ ctx.fillStyle='#3a4046'; ctx.fillRect(22,-5,10,3); }
    if(wid==='smg'){ ctx.fillStyle='#1a1c18'; ctx.fillRect(24,2,4,6); }
    if(wid==='lmg'){ ctx.fillStyle='#55602f'; ctx.fillRect(22,3,9,7); }
    if(wid==='revolver'){ ctx.fillStyle='#5a646a'; ctx.fillRect(17,-3.5,6,7); }
    if(wid==='flamer'){ ctx.fillStyle='#a8402a'; rrect(ctx,10,3.5,13,6,2); ctx.fill(); ctx.fillStyle='#e8843a'; ctx.fillRect(tip-2,-1.5,3,3); }
    if(wid==='launcher'){ ctx.fillStyle='#55692f'; ctx.fillRect(tip-8,-4.5,8,9); }
    if(muzzleFlash>0){
      ctx.fillStyle='#fff2c0';
      ctx.beginPath(); ctx.moveTo(tip,0); ctx.lineTo(tip+16,-7); ctx.lineTo(tip+11,0); ctx.lineTo(tip+16,7); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(240,200,90,0.5)'; ctx.beginPath(); ctx.arc(tip+4,0,9,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();

  // --- arms: shoulders sit on the torso, elbows bend outward when the hand is close
  const arm = (s,h,side)=>{
    const dx=h[0]-s[0], dy=h[1]-s[1], d=Math.hypot(dx,dy)||0.01, L=23;
    const bend = d<L ? Math.sqrt(L*L-d*d)*0.6*side : 0;
    ctx.beginPath(); ctx.moveTo(s[0],s[1]);
    ctx.quadraticCurveTo((s[0]+h[0])/2-dy/d*bend, (s[1]+h[1])/2+dx/d*bend, h[0],h[1]);
    ctx.stroke();
  };
  ctx.strokeStyle = armored ? '#5a6068' : '#4f5c40'; ctx.lineWidth=5.5; ctx.lineCap='round';
  arm(shR,hR,1); arm(shL,hL,-1);
  ctx.lineCap='butt';
  ctx.fillStyle='#d2b48c';
  ctx.beginPath(); ctx.arc(hR[0],hR[1],3,0,Math.PI*2); ctx.arc(hL[0],hL[1],3,0,Math.PI*2); ctx.fill();

  // --- torso + backpack
  ctx.save();
  ctx.rotate(torso);
  ctx.fillStyle = player.hurtFlash>0 ? '#b23a3a' : (player.gear.steelarmor ? '#8c9aa4' : (armored ? '#646a72' : '#55654a'));
  ctx.beginPath(); ctx.ellipse(0,0,9+breathe*0.35,14+breathe*0.25,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#1c1e18'; ctx.lineWidth=1.8; ctx.stroke();
  if(armored){ ctx.strokeStyle='#33373c'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-3,-10); ctx.lineTo(-3,10); ctx.moveTo(4,-10); ctx.lineTo(4,10); ctx.stroke(); }
  ctx.fillStyle='#4a3d28';
  if(player.bagLvl>=2) rrect(ctx,-17,-10,12,20,4); else rrect(ctx,-14,-8,9,16,3);
  ctx.fill();
  ctx.strokeStyle='#221b10'; ctx.lineWidth=1.2; ctx.stroke();
  ctx.restore();

  // --- head looks where the weapon points and leans into a swing
  ctx.save();
  ctx.rotate(aim + twist*0.4);
  const hx = 2 + (sk>=0 ? Math.sin(sk*Math.PI)*1.5 : 0) + Math.abs(step)*0.5;
  ctx.fillStyle = '#d2b48c';
  ctx.beginPath(); ctx.arc(hx,0,7.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#33271a';
  ctx.beginPath(); ctx.arc(hx,0,7.5,Math.PI*0.5,Math.PI*1.5); ctx.fill();
  if(player.gear.helmet){
    ctx.fillStyle='#5a6068'; ctx.beginPath(); ctx.arc(hx-0.5,0,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#737a82'; ctx.beginPath(); ctx.arc(hx-1.5,0,5,0,Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle='#1c1e18'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(hx,0,player.gear.helmet?8:7.5,0,Math.PI*2); ctx.stroke();
  ctx.restore();

  ctx.restore();

  // reload progress ring
  if(player.reload>0){
    const k = 1-player.reload/player.reloadMax;
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(sx,sy,24,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#f0c85a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(sx,sy,24,-Math.PI/2,-Math.PI/2+Math.PI*2*k); ctx.stroke();
  }
}
function drawZombie(z){
  if(z.kind==='boss'){ drawBoss(z); return; }
  if(z.kind==='egg'){ drawEgg(z); return; }
  const sx = z.x-camera.x, sy = z.y-camera.y;
  if(sx<-50||sy<-50||sx>canvas.width+50||sy>canvas.height+50) return;
  const t = performance.now()/1000, R=z.r;
  const sw = Math.sin(t*(z.kind==='crawler'?14:6)+z.phase);
  shadow(sx+3,sy+5,R,R*0.8);
  ctx.save();
  ctx.translate(sx,sy);
  ctx.rotate(z.angle + sw*0.08);
  const skin = z.flash>0 ? '#e8e8d8' : z.skin;
  // arms reaching forward
  ctx.strokeStyle=skin; ctx.lineWidth=R*0.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(R*0.1,-R*0.78); ctx.lineTo(R*1.2,-R*0.42+sw*2.5);
  ctx.moveTo(R*0.1,R*0.78); ctx.lineTo(R*1.2,R*0.42-sw*2.5);
  ctx.stroke();
  ctx.lineCap='butt';
  // torso
  ctx.fillStyle = z.flash>0 ? '#d8d8c8' : z.cloth;
  ctx.beginPath(); ctx.ellipse(0,0,R*0.68,R,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
  if(settings.gore){
    ctx.fillStyle='rgba(110,20,20,0.6)';
    ctx.beginPath(); ctx.ellipse(-R*0.1,R*0.4,R*0.25,R*0.2,0.5,0,Math.PI*2); ctx.fill();
  }
  if(z.kind==='bloater'){ // swollen sac on its back, throbbing faster once the fuse is lit
    const p = 1+0.07*Math.sin(t*(z.fuse!=null?34:4)+z.phase);
    ctx.fillStyle = z.flash>0 ? '#f4f4e0' : '#b9c46a';
    ctx.beginPath(); ctx.arc(-R*0.18,0,R*0.66*p,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(60,80,20,0.6)'; ctx.lineWidth=1.2; ctx.stroke();
  }
  // head
  ctx.fillStyle=skin;
  ctx.beginPath(); ctx.arc(R*0.28,0,R*0.52,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.2; ctx.stroke();
  ctx.fillStyle='rgba(30,40,10,0.4)';
  ctx.beginPath(); ctx.arc(R*0.1,-R*0.15,R*0.16,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = z.kind==='runner' ? '#f0c85a' : (z.kind==='spewer' ? '#c8f05a' : '#d83a3a');
  ctx.beginPath(); ctx.arc(R*0.58,-R*0.2,1.7,0,Math.PI*2); ctx.arc(R*0.58,R*0.2,1.7,0,Math.PI*2); ctx.fill();
  ctx.restore();
  if(z.hp < z.maxHp){
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(sx-14,sy-R-11,28,4);
    ctx.fillStyle='#b23a3a'; ctx.fillRect(sx-14,sy-R-11,28*Math.max(0,z.hp/z.maxHp),4);
  }
}
function drawBullet(b){
  const x=b.x-camera.x, y=b.y-camera.y;
  if(b.flame){
    const k=clamp(b.life/b.max,0,1);
    ctx.globalAlpha=0.25+0.5*k;
    ctx.fillStyle = k>0.6 ? '#f0c85a' : (k>0.3 ? '#e8843a' : '#b8482a');
    ctx.beginPath(); ctx.arc(x,y,b.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    return;
  }
  if(b.ex){
    ctx.fillStyle='#3a4226'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(200,200,190,0.4)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-b.vx*0.04,y-b.vy*0.04); ctx.lineTo(x,y); ctx.stroke();
    return;
  }
  ctx.strokeStyle='rgba(240,200,90,0.45)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x-b.vx*0.03,y-b.vy*0.03); ctx.lineTo(x,y); ctx.stroke();
  ctx.fillStyle = '#fff2c0';
  ctx.beginPath(); ctx.arc(x,y,2.4,0,Math.PI*2); ctx.fill();
}
// burning ground under the entities
function drawFires(){
  const t=performance.now()/1000;
  for(const f of fires){
    const x=f.x-camera.x, y=f.y-camera.y;
    if(x<-120||y<-120||x>canvas.width+120||y>canvas.height+120) continue;
    const a=Math.min(1,f.life/0.8), fl=Math.sin(t*13+f.phase)*0.06;
    const g=ctx.createRadialGradient(x,y,4,x,y,f.r*(1+fl));
    g.addColorStop(0,'rgba(240,200,90,'+(0.55*a)+')'); g.addColorStop(0.55,'rgba(232,100,42,'+(0.4*a)+')'); g.addColorStop(1,'rgba(120,30,10,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,f.r*(1+fl),0,Math.PI*2); ctx.fill();
  }
}
// grenades / molotovs in the air, and explosion flashes
function drawThrownAndBlasts(){
  ctx.strokeStyle='rgba(255,236,170,0.85)'; ctx.lineWidth=1.5;
  for(const t of tracers){ ctx.beginPath(); ctx.moveTo(t.x1-camera.x,t.y1-camera.y); ctx.lineTo(t.x2-camera.x,t.y2-camera.y); ctx.stroke(); }
  for(const t of thrown){
    const k=Math.min(1,t.t), lift=Math.sin(k*Math.PI)*46;
    const x=t.x-camera.x, y=t.y-camera.y;
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x,y,5,3,0,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(x,y-lift); ctx.rotate(t.rot+k*9);
    if(t.type==='grenade'){
      ctx.fillStyle='#55692f'; ctx.beginPath(); ctx.ellipse(0,0,5,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#8a8f92'; ctx.fillRect(-2,-8,4,3);
    } else {
      ctx.fillStyle='#6a8a5a'; rrect(ctx,-3.5,-5,7,11,2); ctx.fill();
      ctx.fillStyle='#c9bfa0'; ctx.fillRect(-1.5,-9,3,4);
      ctx.fillStyle='#f0c85a'; ctx.beginPath(); ctx.arc(0,-10,2.6,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  for(const b of blasts){
    const k=1-b.life/b.max, x=b.x-camera.x, y=b.y-camera.y, r=b.r*(0.35+0.65*Math.sqrt(k));
    const g=ctx.createRadialGradient(x,y,r*0.1,x,y,r);
    g.addColorStop(0,'rgba(255,246,210,'+(0.95*(1-k))+')'); g.addColorStop(0.5,'rgba(240,160,60,'+(0.7*(1-k))+')'); g.addColorStop(1,'rgba(120,40,10,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,230,180,'+(0.6*(1-k))+')'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x,y,b.r*k,0,Math.PI*2); ctx.stroke();
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = clamp(p.life/p.max,0,1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x-camera.x-p.size/2,p.y-camera.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha = 1;
}
function drawFloatingTexts(){
  ctx.font = 'bold 14px Consolas, monospace';
  ctx.textAlign = 'center';
  floatingTexts.forEach(f=>{
    ctx.globalAlpha = clamp(f.life,0,1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(f.text, f.x-camera.x+1, f.y-camera.y+1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x-camera.x, f.y-camera.y);
  });
  ctx.globalAlpha = 1; ctx.textAlign='left';
}
function drawBuildGhost(){
  const {cx,cy}=mouseCell();
  if(cx<0||cy<0||cx>=GW||cy>=GH) return;
  // reachable cells
  ctx.strokeStyle='rgba(240,200,90,0.1)'; ctx.lineWidth=1;
  const pcx=Math.floor(player.x/CELL), pcy=Math.floor(player.y/CELL);
  for(let y=pcy-6;y<=pcy+6;y++) for(let x=pcx-6;x<=pcx+6;x++){
    if(x<0||y<0||x>=GW||y>=GH||!cellInRange(x,y)) continue;
    ctx.strokeRect(x*CELL-camera.x+0.5,y*CELL-camera.y+0.5,CELL-1,CELL-1);
  }
  const def=BUILD_DEFS[buildSel];
  const x=cx*CELL-camera.x, y=cy*CELL-camera.y;
  const existing=structGrid[cy*GW+cx];
  let col;
  if(existing) col = cellInRange(cx,cy) ? '120,170,230' : '178,58,58';
  else if(!canPlace(def,cx,cy)) col='178,58,58';
  else if(!canAfford(def.cost)) col='217,165,40';
  else col='143,209,106';
  ctx.fillStyle='rgba('+col+',0.28)'; ctx.fillRect(x,y,CELL,CELL);
  ctx.strokeStyle='rgba('+col+',0.95)'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
  ctx.font='bold 11px Consolas, monospace'; ctx.textAlign='center';
  ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillText(existing?existing.def.name:def.name,x+CELL/2+1,y-5);
  ctx.fillStyle='rgb('+col+')'; ctx.fillText(existing?existing.def.name:def.name,x+CELL/2,y-6);
  ctx.textAlign='left';
}

function renderLighting(dark){
  if(dark<=0.01) return;
  const w=canvas.width, h=canvas.height;
  lctx.globalCompositeOperation='source-over';
  lctx.clearRect(0,0,w,h);
  lctx.fillStyle='rgba(5,7,20,'+dark+')';
  lctx.fillRect(0,0,w,h);
  lctx.globalCompositeOperation='destination-out';
  const px=player.x-camera.x, py=player.y-camera.y;
  const hole=(x,y,r,a)=>{
    const g=lctx.createRadialGradient(x,y,r*0.15,x,y,r);
    g.addColorStop(0,'rgba(0,0,0,'+a+')'); g.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=g; lctx.beginPath(); lctx.arc(x,y,r,0,Math.PI*2); lctx.fill();
  };
  hole(px,py,150,0.85);
  // flashlight cone
  const R=player.gear.flash?560:400, half=player.gear.flash?0.5:0.4;
  const g=lctx.createRadialGradient(px,py,20,px,py,R);
  g.addColorStop(0,'rgba(0,0,0,0.95)'); g.addColorStop(0.7,'rgba(0,0,0,0.6)'); g.addColorStop(1,'rgba(0,0,0,0)');
  lctx.fillStyle=g;
  lctx.beginPath(); lctx.moveTo(px,py); lctx.arc(px,py,R,player.angle-half,player.angle+half); lctx.closePath(); lctx.fill();
  if(muzzleFlash>0) hole(px,py,260,0.8);
  for(const f of fires) hole(f.x-camera.x, f.y-camera.y, f.r*2.6, 0.9*Math.min(1,f.life));
  for(const b of blasts) hole(b.x-camera.x, b.y-camera.y, b.r*2.6, b.life/b.max);
  for(const b of bullets) if(b.flame) hole(b.x-camera.x, b.y-camera.y, 70, 0.35);
  lightBossFx(hole);
  const t=performance.now()/1000;
  for(const s of structures){
    const r = s.def.id==='campfire' ? 230+Math.sin(t*9+s.phase)*8 : (s.def.id==='lamp' ? LAMP_R : 0);
    if(!r) continue;
    const x=s.x+20-camera.x, y=s.y+20-camera.y;
    if(x<-r-30||y<-r-30||x>w+r+30||y>h+r+30) continue;
    hole(x,y,r,0.95);
  }
  ctx.drawImage(lightCanvas,0,0);
}

function render(){
  const t=timeOfDay(), dark=darknessAt(t);
  ctx.save();
  const shake = shakeTime>0 ? shakeMag*settings.shake : 0;
  if(shake>0) ctx.translate(rr(-shake,shake), rr(-shake,shake));
  // ground
  ctx.fillStyle='#0b0d07'; ctx.fillRect(-10,-10,canvas.width+20,canvas.height+20);
  drawGround();

  houses.forEach(drawBuildingFloor);
  outdoorCrates.forEach(drawCrate);
  for(const s of structures) if(!s.def.blockZ) drawStructure(s);
  const pr2=pickupRange()*pickupRange();
  for(const p of pickups) drawPickup(p, !p.taking && dist2(p.x,p.y,player.x,player.y)<pr2);
  obstacles.forEach(drawObstacle);
  houses.forEach(drawHouseWalls);
  for(const s of structures) if(s.def.blockZ) drawStructure(s);
  drawFires();
  drawHazards();

  // entities sorted by y for simple depth
  const ents = zombies.filter(z=>z.alive).map(z=>({t:'z',o:z,y:z.y}));
  ents.push({t:'p', o:player, y:player.y});
  ents.sort((a,b)=>a.y-b.y);
  ents.forEach(e=> e.t==='z' ? drawZombie(e.o) : drawPlayer());
  bullets.forEach(drawBullet);
  drawHazardsTop();
  drawThrownAndBlasts();
  drawParticles();

  obstacles.forEach(drawCanopy);
  houses.forEach(drawRoof);
  ctx.restore();

  // dusk / dawn tint, then night
  const warm = t>=0.48&&t<0.65 ? 1-Math.abs(t-0.57)/0.09 : (t>=0.93 ? 1-Math.abs(t-0.97)/0.04 : 0);
  if(warm>0){ ctx.fillStyle='rgba(230,110,40,'+(clamp(warm,0,1)*0.1)+')'; ctx.fillRect(0,0,canvas.width,canvas.height); }
  renderLighting(dark);

  if(gameState==='playing' && buildMode) drawBuildGhost();
  drawFloatingTexts();
  if(gameState==='playing' && !mapOpen) drawPointers();

  // vignette
  const vg = ctx.createRadialGradient(canvas.width/2,canvas.height/2, canvas.height*0.3, canvas.width/2,canvas.height/2, Math.max(canvas.width,canvas.height)*0.72);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if(player.hp<35 && gameState==='playing' && settings.lowHp){
    const a=(1-player.hp/35)*(0.22+0.08*Math.sin(performance.now()/200));
    const hg = ctx.createRadialGradient(canvas.width/2,canvas.height/2, canvas.height*0.35, canvas.width/2,canvas.height/2, Math.max(canvas.width,canvas.height)*0.7);
    hg.addColorStop(0,'rgba(120,0,0,0)'); hg.addColorStop(1,'rgba(150,10,10,'+a+')');
    ctx.fillStyle=hg; ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  drawBossBars();

  // reticle
  if(gameState==='playing'){
    ctx.strokeStyle = buildMode ? 'rgba(207,199,168,0.8)' : 'rgba(240,200,90,0.9)';
    ctx.lineWidth = 1.5;
    if(!buildMode){ ctx.beginPath(); ctx.arc(mouse.x,mouse.y,10,0,Math.PI*2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(mouse.x-14,mouse.y); ctx.lineTo(mouse.x-5,mouse.y); ctx.moveTo(mouse.x+5,mouse.y); ctx.lineTo(mouse.x+14,mouse.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x,mouse.y-14); ctx.lineTo(mouse.x,mouse.y-5); ctx.moveTo(mouse.x,mouse.y+5); ctx.lineTo(mouse.x,mouse.y+14); ctx.stroke();
  }

  renderMinimap();
  if(mapOpen && gameState==='playing') drawFullMap();
}
