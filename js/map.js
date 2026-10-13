'use strict';

/* ============================================================
   MAP — corner minimap, full map (M), markers, outpost travel
============================================================ */
const MINI_COL = {house:'rgba(190,120,80,0.75)',store:'rgba(110,170,140,0.75)',warehouse:'rgba(190,165,80,0.75)',
                  police:'rgba(110,140,200,0.8)',hospital:'rgba(215,215,205,0.8)',garage:'rgba(170,110,90,0.8)'};
const MINI_SPAN = 3600; // world pixels across the corner minimap
let mapMsg = '', mapMsgUntil = 0;

function markerDef(id){ return MARKER_TYPES.find(t=>t.id===id) || MARKER_TYPES[0]; }
function drawMarkerIcon(c,x,y,type,r){
  const def = markerDef(type);
  c.fillStyle = def.color; c.strokeStyle = '#10100a'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x,y+r*1.5); c.lineTo(x-r*0.8,y+r*0.2); c.arc(x,y-r*0.2,r,Math.PI*0.85,Math.PI*0.15); c.closePath();
  c.fill(); c.stroke();
  if(r>=6){
    c.fillStyle = '#10100a'; c.font = 'bold '+Math.round(r*1.15)+'px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(def.name[0], x, y-r*0.15);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
}
function drawFlagIcon(c,x,y,r,color){
  c.strokeStyle = '#10100a'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x,y+r); c.lineTo(x,y-r); c.stroke();
  c.strokeStyle = '#e8e2d0'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x,y+r); c.lineTo(x,y-r); c.stroke();
  c.fillStyle = color; c.strokeStyle = '#10100a'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x+1,y-r); c.lineTo(x+r*1.3,y-r*0.5); c.lineTo(x+1,y); c.closePath(); c.fill(); c.stroke();
}

// Draws the world at scale s (canvas pixels per world pixel); the caller has already
// translated c so that the world origin sits where it should.
function drawMapContents(c,s,big){
  c.fillStyle = 'rgba(90,88,80,0.55)';
  ROADS.forEach(r=>c.fillRect(r.x*s,r.y*s,r.w*s,r.h*s));
  houses.forEach(h=>{
    c.fillStyle = MINI_COL[h.typeId];
    c.fillRect(h.x*s, h.y*s, Math.max(2,h.w*s), Math.max(2,h.h*s));
  });
  if(big && s>0.07){
    c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(16,16,10,0.85)';
    houses.forEach(h=>{ if(c.measureText(h.type.name).width < h.w*s-2) c.fillText(h.type.name,(h.x+h.w/2)*s,(h.y+h.h/2)*s); });
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  const ss = Math.max(2.4, CELL*s);
  c.fillStyle = '#cfc7a8';
  structures.forEach(st=>{ if(st.def.id!=='outpost') c.fillRect(st.x*s, st.y*s, ss, ss); });
  c.fillStyle = '#f0c85a';
  outdoorCrates.forEach(cr=>{ if(!cr.looted) c.fillRect(cr.x*s-1, cr.y*s-1, 2.5, 2.5); });
  c.fillStyle = '#d83a3a';
  zombies.forEach(z=>{
    if(!z.alive) return;
    if(z.kind==='boss'){ c.fillStyle='#f0c85a'; c.fillRect(z.x*s-3, z.y*s-3, 6, 6); c.fillStyle='#d83a3a'; c.fillRect(z.x*s-2, z.y*s-2, 4, 4); }
    else c.fillRect(z.x*s-1, z.y*s-1, 2, 2);
  });
  markers.forEach(m=>drawMarkerIcon(c, m.x*s, m.y*s, m.type, big?8:4.5));
  const blink = Math.sin(performance.now()/120)>0;
  structures.forEach(st=>{
    if(st.def.id!=='outpost') return;
    const x=(st.x+CELL/2)*s, y=(st.y+CELL/2)*s, on = st.cell===checkpoint;
    if(on){ c.strokeStyle='rgba(143,209,106,0.8)'; c.lineWidth=1.5; c.beginPath(); c.arc(x,y,big?13:8,0,Math.PI*2); c.stroke(); }
    drawFlagIcon(c, x, y, big?8:5, st.alarm>0 && blink ? '#e04b4b' : (on ? '#8fd16a' : '#cfc7a8'));
  });
  c.save();
  c.translate(player.x*s, player.y*s);
  c.rotate(player.angle);
  c.fillStyle = '#c3d16a'; c.strokeStyle = '#10100a'; c.lineWidth = 1;
  const k = big ? 1.5 : 1;
  c.beginPath(); c.moveTo(6*k,0); c.lineTo(-4*k,-4*k); c.lineTo(-2*k,0); c.lineTo(-4*k,4*k); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

// The corner minimap shows the surroundings; the whole world is on the full map.
function renderMinimap(){
  const w = mini.width, h = mini.height, s = w/MINI_SPAN;
  mctx.clearRect(0,0,w,h);
  mctx.fillStyle = 'rgba(14,16,9,0.9)';
  mctx.fillRect(0,0,w,h);
  const vx = clamp(player.x-w/s/2, 0, WORLD_W-w/s), vy = clamp(player.y-h/s/2, 0, WORLD_H-h/s);
  mctx.save();
  mctx.translate(-vx*s, -vy*s);
  drawMapContents(mctx, s, false);
  mctx.restore();
  mctx.strokeStyle = 'rgba(217,165,40,0.6)';
  mctx.strokeRect(0.5,0.5,w-1,h-1);
}

function mapView(){
  const padX = 40, padTop = 66, padBot = 84;
  const s = Math.min((canvas.width-padX*2)/WORLD_W, (canvas.height-padTop-padBot)/WORLD_H);
  const w = WORLD_W*s, h = WORLD_H*s;
  return {x:(canvas.width-w)/2, y:padTop+(canvas.height-padTop-padBot-h)/2, w, h, s};
}
function mapOutpostAt(wx,wy,r){
  return outposts().find(st=>dist2(st.x+CELL/2,st.y+CELL/2,wx,wy) < r*r);
}
function mapMarkerAt(wx,wy,r){
  let best=-1, bd=r*r;
  markers.forEach((m,i)=>{ const d=dist2(m.x,m.y,wx,wy); if(d<bd){ bd=d; best=i; } });
  return best;
}
function drawFullMap(){
  const v = mapView(), cw = canvas.width;
  ctx.fillStyle = 'rgba(8,10,5,0.9)';
  ctx.fillRect(0,0,cw,canvas.height);
  ctx.fillStyle = '#24261c';
  ctx.fillRect(v.x,v.y,v.w,v.h);
  ctx.save();
  ctx.beginPath(); ctx.rect(v.x,v.y,v.w,v.h); ctx.clip();
  ctx.translate(v.x,v.y);
  // grid, one line per 1000 world pixels
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x=1000;x<WORLD_W;x+=1000){ ctx.moveTo(x*v.s,0); ctx.lineTo(x*v.s,v.h); }
  for(let y=1000;y<WORLD_H;y+=1000){ ctx.moveTo(0,y*v.s); ctx.lineTo(v.w,y*v.s); }
  ctx.stroke();
  drawMapContents(ctx, v.s, true);
  // current screen
  ctx.strokeStyle = 'rgba(195,209,106,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(camera.x*v.s, camera.y*v.s, canvas.width*v.s, canvas.height*v.s);
  ctx.restore();
  ctx.strokeStyle = 'rgba(217,165,40,0.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(v.x-1,v.y-1,v.w+2,v.h+2);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c85a'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(T('전체 지도'), cw/2, v.y-26);
  ctx.fillStyle = '#aea583'; ctx.font = '12px Consolas, monospace';
  ctx.fillText(Tf('{d}일차 · 표시 {a} / {b} · 거점 {c} — 게임은 멈춰 있습니다',{d:day,a:markers.length,b:MAX_MARKERS,c:outposts().length}), cw/2, v.y-8);

  // marker palette
  const by = v.y+v.h+26, slotW = 128, bx = cw/2-slotW*MARKER_TYPES.length/2;
  MARKER_TYPES.forEach((t,i)=>{
    const x = bx+i*slotW;
    ctx.fillStyle = i===markerSel ? 'rgba(217,165,40,0.22)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(x+3,by-15,slotW-6,30);
    ctx.strokeStyle = i===markerSel ? '#f0c85a' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.strokeRect(x+3.5,by-14.5,slotW-7,29);
    drawMarkerIcon(ctx, x+22, by-2, t.id, 8);
    ctx.fillStyle = i===markerSel ? '#f0c85a' : '#cfc7a8'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText((i+1)+'  '+t.name, x+38, by+4);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#aea583'; ctx.font = '12px Consolas, monospace';
  ctx.fillText(Tf('좌클릭 표시 남기기 · 표시 클릭/우클릭 삭제 · 1-{n}/휠 종류 선택 · 거점 깃발 옆에서 다른 거점 클릭 → 이동 · {map}/ESC 닫기',{n:MARKER_TYPES.length}), cw/2, by+36);

  // cursor + hover hint
  const wx = (mouse.x-v.x)/v.s, wy = (mouse.y-v.y)/v.s, hitR = 13/v.s;
  const inside = wx>=0 && wy>=0 && wx<=WORLD_W && wy<=WORLD_H;
  let hint = '';
  if(inside){
    const mi = mapMarkerAt(wx,wy,hitR), op = mi<0 ? mapOutpostAt(wx,wy,hitR) : null;
    if(mi>=0) hint = Tf('{x} — 클릭하여 삭제',{x:markerDef(markers[mi].type).name});
    else if(op) hint = T(op.cell===checkpoint ? '거점 (체크포인트)' : '거점') + T(nearestOutpost(160) ? (nearestOutpost(160)===op ? ' — 현재 위치' : ' — 클릭하여 이동') : ' — 거점 깃발 옆에서만 이동 가능');
    else { ctx.globalAlpha = 0.6; drawMarkerIcon(ctx, mouse.x, mouse.y-12, MARKER_TYPES[markerSel].id, 8); ctx.globalAlpha = 1; }
  }
  if(performance.now() < mapMsgUntil) hint = mapMsg;
  if(hint){
    ctx.font = 'bold 12px system-ui, sans-serif';
    const tw = ctx.measureText(hint).width+16, tx = clamp(mouse.x, tw/2+6, cw-tw/2-6), ty = Math.max(30, mouse.y-34);
    ctx.fillStyle = 'rgba(16,16,10,0.92)'; ctx.fillRect(tx-tw/2,ty-13,tw,22);
    ctx.strokeStyle = 'rgba(217,165,40,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(tx-tw/2+0.5,ty-12.5,tw-1,21);
    ctx.fillStyle = '#f0c85a'; ctx.fillText(hint, tx, ty+3);
  }
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#f0c85a'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mouse.x-9,mouse.y); ctx.lineTo(mouse.x-3,mouse.y); ctx.moveTo(mouse.x+3,mouse.y); ctx.lineTo(mouse.x+9,mouse.y);
  ctx.moveTo(mouse.x,mouse.y-9); ctx.lineTo(mouse.x,mouse.y-3); ctx.moveTo(mouse.x,mouse.y+3); ctx.lineTo(mouse.x,mouse.y+9);
  ctx.stroke();
}

function mapSay(text){ mapMsg = T(text); mapMsgUntil = performance.now()+2200; }
function mapClick(button){
  const v = mapView(), wx = (mouse.x-v.x)/v.s, wy = (mouse.y-v.y)/v.s, hitR = 13/v.s;
  if(wx<0||wy<0||wx>WORLD_W||wy>WORLD_H) return;
  const mi = mapMarkerAt(wx,wy,hitR);
  if(mi>=0){ markers.splice(mi,1); sfx.open(); return; }
  if(button!==0) return;
  const op = mapOutpostAt(wx,wy,hitR);
  if(op){ travelToOutpost(op); return; }
  if(markers.length>=MAX_MARKERS){ sfx.deny(); mapSay(Tf('표시는 {n}개까지 남길 수 있습니다',{n:MAX_MARKERS})); return; }
  markers.push({x:Math.round(wx), y:Math.round(wy), type:MARKER_TYPES[markerSel].id});
  sfx.build();
}
// Outposts are linked: standing at one flag, the player can move to any other.
function travelToOutpost(to){
  const from = nearestOutpost(160);
  if(from===to) return;
  if(!from){ sfx.deny(); mapSay('거점 깃발 옆에 있어야 이동할 수 있습니다'); return; }
  if(zombies.some(z=>z.alive && dist2(z.x,z.y,player.x,player.y) < 380*380)){ sfx.deny(); mapSay('근처에 좀비가 있어 이동할 수 없습니다'); return; }
  player.hunger = Math.max(0, player.hunger-6);
  placeAtOutpost(to);
  setMapOpen(false);
  showToast('거점 이동', '허기 -6');
  sfx.dawn();
}

// Edge-of-screen arrows toward markers and the active checkpoint.
function drawPointers(){
  const list = markers.map(m=>({x:m.x, y:m.y, type:m.type}));
  const op = activeOutpost();
  if(op) list.push({x:op.x+CELL/2, y:op.y+CELL/2, flag:true});
  const cw = canvas.width, chh = canvas.height, pad = 46;
  ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'center';
  list.forEach(m=>{
    const sx = m.x-camera.x, sy = m.y-camera.y;
    const on = sx>pad && sy>pad && sx<cw-pad && sy<chh-pad;
    let x = sx, y = sy;
    if(!on){
      const dx = sx-cw/2, dy = sy-chh/2;
      const k = Math.min((cw/2-pad)/Math.abs(dx||1e-6), (chh/2-pad)/Math.abs(dy||1e-6));
      x = cw/2+dx*k; y = chh/2+dy*k;
      const a = Math.atan2(dy,dx);
      ctx.fillStyle = m.flag ? '#8fd16a' : markerDef(m.type).color;
      ctx.beginPath();
      ctx.moveTo(x+Math.cos(a)*20, y+Math.sin(a)*20);
      ctx.lineTo(x+Math.cos(a+2.4)*9+Math.cos(a)*10, y+Math.sin(a+2.4)*9+Math.sin(a)*10);
      ctx.lineTo(x+Math.cos(a-2.4)*9+Math.cos(a)*10, y+Math.sin(a-2.4)*9+Math.sin(a)*10);
      ctx.closePath(); ctx.fill();
      const dist = Math.round(Math.hypot(m.x-player.x, m.y-player.y)/CELL);
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(dist+'m', x+1, y+24);
      ctx.fillStyle = '#e8e2d0'; ctx.fillText(dist+'m', x, y+23);
    } else if(m.flag) return; // the flag itself is visible
    else y -= 26;
    ctx.globalAlpha = on ? 0.85 : 1;
    if(m.flag) drawFlagIcon(ctx, x-3, y, 7, '#8fd16a'); else drawMarkerIcon(ctx, x, y, m.type, 7);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
  });
  ctx.textAlign = 'left';
}
