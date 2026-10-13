'use strict';

/* ============================================================
   WORLD STATE
============================================================ */
const houses = [];
const outdoorCrates = [];
const obstacles = [];
const pickups = [];
const structures = [];
const structGrid = new Array(GW*GH).fill(null);
const staticBlock = new Uint8Array(GW*GH);
const distField = new Float32Array(GW*GH);
const PLAYER_SPAWN = {x: WORLD_W/2, y: WORLD_H/2};
// a 3x3 road grid; the player starts on the central crossroads
const ROADS = [];
[1/6,1/2,5/6].forEach(f=>{
  ROADS.push({x:0, y:Math.round(WORLD_H*f)-80, w:WORLD_W, h:160, horiz:true});
  ROADS.push({x:Math.round(WORLD_W*f)-80, y:0, w:160, h:WORLD_H, horiz:false});
});
const DENSITY = WORLD_W*WORLD_H/(4800*3600); // object counts were tuned for a 4800x3600 map
const PICKUP_TARGET = Math.round(240*DENSITY);

function cellIdx(x,y){
  const cx=Math.floor(x/CELL), cy=Math.floor(y/CELL);
  if(cx<0||cy<0||cx>=GW||cy>=GH) return -1;
  return cy*GW+cx;
}
function structBlocksZ(i){ const s=structGrid[i]; return !!(s && s.def.blockZ); }

/* ============================================================
   WORLD GENERATION
============================================================ */
function buildHouseGeometry(h){
  const t=WALL_T, x=h.x, y=h.y, w=h.w, hh=h.h, walls=[], dw=2*CELL;
  // each side is one wall run, cut wherever h.doorDefs puts an entrance
  h.doors = [];
  ['top','bottom','left','right'].forEach(side=>{
    const horiz = side==='top'||side==='bottom';
    const len = horiz ? w : hh;
    const fx = side==='right' ? x+w-t : x, fy = side==='bottom' ? y+hh-t : y;
    const gaps = h.doorDefs.filter(d=>d.side===side).map(d=>d.k*CELL).sort((a,b)=>a-b);
    let pos = 0;
    gaps.forEach(g=>{
      if(g>pos) walls.push(horiz ? {x:x+pos,y:fy,w:g-pos,h:t} : {x:fx,y:y+pos,w:t,h:g-pos});
      h.doors.push(horiz ? {x:x+g,y:fy,w:dw,h:t,side} : {x:fx,y:y+g,w:t,h:dw,side});
      pos = g+dw;
    });
    const seg = horiz ? {x:x+pos,y:fy,w:len-pos,h:t} : {x:fx,y:y+pos,w:t,h:len-pos};
    if(!gaps.length) seg.win = true;
    walls.push(seg);
  });
  // interior partition with a 2-cell opening
  if(h.wc>=9){
    const k = ri(3,h.wc-4);
    const blocksDoor = h.doorDefs.some(d=>(d.side==='top'||d.side==='bottom') && (d.k===k || d.k+1===k));
    if(!blocksDoor){
      const g = ri(1,h.hc-3), px = x+k*CELL+10;
      const y1=y+t, y2=y+g*CELL, y3=y+(g+2)*CELL, y4=y+hh-t;
      if(y2-y1>0) walls.push({x:px,y:y1,w:t,h:y2-y1,inner:true});
      if(y4-y3>0) walls.push({x:px,y:y3,w:t,h:y4-y3,inner:true});
    }
  }
  // windows on door-less outer walls
  h.windows = [];
  walls.forEach(wl=>{
    if(!wl.win) return;
    const horiz = wl.w>wl.h, len = horiz?wl.w:wl.h;
    [0.3,0.7].forEach(f=>{
      if(horiz) h.windows.push({x:wl.x+len*f-18, y:wl.y+6, w:36, h:8});
      else h.windows.push({x:wl.x+6, y:wl.y+len*f-18, w:8, h:36});
    });
  });
  h.walls = walls;
  h.interior = {x:x+t, y:y+t, w:w-2*t, h:hh-2*t};
}

function rollLoot(bias){
  const general = ['wood','wood','metal','metal','stone','cloth','cloth','food','bread','bar','potato','ammo','ammo','herb','coal','gunpowder','parts','rope','fuel'];
  const loot = {};
  const n = ri(2,3);
  for(let i=0;i<n;i++){
    const t = (bias && rng()<0.65) ? pick(bias) : pick(general);
    let amt;
    if(t==='wood') amt=ri(4,9); else if(t==='metal') amt=ri(3,7); else if(t==='stone') amt=ri(3,6);
    else if(t==='cloth') amt=ri(2,4); else if(t==='food') amt=ri(1,3); else if(t==='ammo') amt=ri(5,12);
    else if(t==='gunpowder') amt=ri(2,5); else if(t==='coal'||t==='ore'||t==='sulfur') amt=ri(2,4);
    else if(t==='herb') amt=ri(1,3); else if(t==='parts'||t==='rope'||t==='fuel') amt=ri(1,2);
    else if(t==='bread'||t==='bar'||t==='meat') amt=ri(1,2); else if(t==='potato'||t==='rice') amt=ri(2,4);
    else amt=1;
    loot[t] = t==='medkit' ? 1 : (loot[t]||0)+Math.max(1,Math.round(amt*diff().loot));
  }
  return loot;
}

function obstacleRect(o){
  if(o.type==='tree'||o.type==='deadtree') return {x:o.x+8,y:o.y+8,w:14,h:14};
  if(o.type==='rock') return {x:o.x+5,y:o.y+5,w:o.w-10,h:o.h-10};
  return {x:o.x,y:o.y,w:o.w,h:o.h};
}

function computeStatic(){
  staticBlock.fill(0);
  const mark = r=>{
    const x0=Math.max(0,Math.floor(r.x/CELL)), x1=Math.min(GW-1,Math.floor((r.x+r.w)/CELL));
    const y0=Math.max(0,Math.floor(r.y/CELL)), y1=Math.min(GH-1,Math.floor((r.y+r.h)/CELL));
    for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){
      const sx=cx*CELL+5, sy=cy*CELL+5;
      if(r.x+r.w<=sx || r.x>=sx+30 || r.y+r.h<=sy || r.y>=sy+30) continue;
      staticBlock[cy*GW+cx]=1;
    }
  };
  houses.forEach(h=>h.walls.forEach(mark));
  obstacles.forEach(o=>{
    if(o.type==='tree'||o.type==='deadtree'){ const i=cellIdx(o.x+15,o.y+15); if(i>=0) staticBlock[i]=1; }
    else mark(o);
  });
}

function randomPickupType(){
  const r = rng();
  if(r<0.26) return 'wood';
  if(r<0.46) return 'stone';
  if(r<0.61) return 'metal';
  if(r<0.71) return 'cloth';
  if(r<0.82) return pick(['food','food','bread','bread','bar','potato']);
  if(r<0.89) return 'herb';
  if(r<0.93) return 'coal';
  if(r<0.95) return 'fuel';
  if(r<0.975) return 'gunpowder';
  return 'ammo';
}
function spawnPickupAt(x,y,type,amt){
  pickups.push({x,y,type,amt,rot:rr(0,Math.PI*2),phase:rr(0,6),taking:false});
}
function spawnRandomPickup(){
  for(let t=0;t<20;t++){
    const x=rr(50,WORLD_W-50), y=rr(50,WORLD_H-50);
    const i=cellIdx(x,y);
    if(i<0 || staticBlock[i] || structGrid[i]) continue;
    if(dist2(x,y,PLAYER_SPAWN.x,PLAYER_SPAWN.y) < 90*90) continue;
    const type=randomPickupType();
    const amt = Math.max(1,Math.round((type==='ammo' ? ri(2,5) : (ITEMS[type].food||type==='fuel') ? 1 : ri(1,3))*diff().loot));
    spawnPickupAt(x,y,type,amt);
    return;
  }
}

// Boulders to mine: stone from any of them, coal / sulfur / iron ore from the veined ones.
// `avoid` lists extra rects to keep clear (used when adding rocks to an older save).
function addRocks(avoid){
  const spawnBox = {x:PLAYER_SPAWN.x-220,y:PLAYER_SPAWN.y-220,w:440,h:440};
  const target = Math.round(60*DENSITY);
  let placed = 0, attempts = 0;
  while(placed < target && attempts < 40000){
    attempts++;
    const w=ri(38,52), h=ri(34,46);
    const x=ri(60,WORLD_W-60-w), y=ri(60,WORLD_H-60-h);
    const box={x,y,w,h};
    if(rectsOverlap(box,spawnBox)) continue;
    if(ROADS.some(r=>rectsOverlap(box,r,10))) continue;
    if(houses.some(hs=>rectsOverlap(box,hs,60))) continue;
    if(obstacles.some(o=>rectsOverlap(box,o,34))) continue;
    if(avoid && avoid.some(a=>rectsOverlap(box,a,50))) continue;
    const r=rng();
    const o = {x,y,w,h,type:'rock',rot:0,res:RES_MAX.rock, vein: r<0.28?null:(r<0.54?'coal':(r<0.76?'sulfur':'ore'))};
    // irregular outline + a few vein flecks, as offsets from the centre
    o.pts=[]; for(let i=0;i<9;i++){ const a=i/9*Math.PI*2, k=rr(0.78,1); o.pts.push({x:Math.cos(a)*w/2*k, y:Math.sin(a)*h/2*k}); }
    o.spots=[]; for(let i=0;i<5;i++) o.spots.push({x:rr(-w*0.28,w*0.28), y:rr(-h*0.28,h*0.28), r:rr(2.2,4.2)});
    obstacles.push(o);
    placed++;
  }
}

function genWorld(){
  houses.length=0; outdoorCrates.length=0; obstacles.length=0; pickups.length=0;
  structures.length=0; structGrid.fill(null);
  const spawnBox = {x:PLAYER_SPAWN.x-220,y:PLAYER_SPAWN.y-220,w:440,h:440};

  // Buildings, grid-aligned so doors and pathing line up with build cells
  let attempts = 0;
  while(houses.length < Math.round(18*DENSITY) && attempts < 30000){
    attempts++;
    const wc=ri(7,10), hc=ri(6,8);
    const gx=ri(2,GW-2-wc), gy=ri(2,GH-2-hc);
    const box={x:gx*CELL,y:gy*CELL,w:wc*CELL,h:hc*CELL};
    if(ROADS.some(r=>rectsOverlap(box,r,40))) continue;
    if(houses.some(o=>rectsOverlap(box,o,120))) continue;
    // at least two entrances, each on a different side
    const sides = shuffle(['top','bottom','left','right']).slice(0, rng()<0.3 ? 3 : 2);
    const typeId = BUILDING_ORDER[houses.length % BUILDING_ORDER.length];
    const house = {
      x:box.x,y:box.y,w:box.w,h:box.h, gx,gy,wc,hc,
      doorDefs: sides.map(side=>({side, k:(side==='top'||side==='bottom') ? ri(1,wc-3) : ri(1,hc-3)})),
      typeId, type:BUILDING_TYPES[typeId],
      playerInside:false, roofA:1, crates:[], decor:[],
    };
    buildHouseGeometry(house);
    houses.push(house);
  }

  // Obstacles
  const types = [];
  [['tree',50],['deadtree',20],['car',16],['rubble',26],['barricade',10]].forEach(t=>{
    for(let i=0;i<Math.round(t[1]*DENSITY);i++) types.push(t[0]);
  });
  attempts = 0;
  let placed = 0;
  while(placed < types.length && attempts < 60000){
    attempts++;
    const type = types[placed];
    let w,h,x,y;
    if(type==='tree'||type==='deadtree'){ w=30;h=30; }
    else if(type==='rubble'){ w=rr(40,62);h=rr(32,50); }
    else if(type==='barricade'){ w=64;h=20; }
    if(type==='car'){
      const road = pick(ROADS);
      if(road.horiz){ w=84;h=46; x=ri(60,WORLD_W-150); y=ri(road.y+8,road.y+road.h-54); }
      else { w=46;h=84; x=ri(road.x+8,road.x+road.w-54); y=ri(60,WORLD_H-150); }
    } else {
      x=ri(60,WORLD_W-60-w); y=ri(60,WORLD_H-60-h);
    }
    const box={x,y,w,h};
    if(rectsOverlap(box,spawnBox)) continue;
    if(type!=='car' && ROADS.some(r=>rectsOverlap(box,r,10))) continue;
    if(houses.some(hs=>rectsOverlap(box,hs,60))) continue;
    if(obstacles.some(o=>rectsOverlap(box,o,34))) continue;
    const o = {x,y,w,h,type, rot:rr(-0.12,0.12)};
    if(type==='tree'){
      o.res=RES_MAX.tree;
      o.blobs=[]; for(let i=0;i<5;i++) o.blobs.push({dx:rr(-16,16),dy:rr(-16,16),r:rr(18,27),s:ri(0,2)});
    } else if(type==='deadtree'){
      o.res=3;
      o.branches=[]; for(let i=0;i<5;i++) o.branches.push({a:rr(0,Math.PI*2),l:rr(16,30)});
    } else if(type==='car'){
      o.res=6; o.color=pick(['#5a3a30','#3d4a52','#55513a','#4a4040','#3a4a3c']);
    } else if(type==='rubble'){
      o.res=5;
      o.blobs=[]; for(let i=0;i<7;i++) o.blobs.push({dx:rr(-w/3,w/3),dy:rr(-h/3,h/3),rx:rr(7,15),ry:rr(6,11),a:rr(0,3),s:ri(0,2)});
    } else { o.res=3; }
    obstacles.push(o);
    placed++;
  }
  addRocks();

  computeStatic();

  // Containers + decor inside buildings
  houses.forEach(h=>{
    const cells=[];
    for(let cy=1;cy<=h.hc-2;cy++) for(let cx=1;cx<=h.wc-2;cx++){
      if(staticBlock[(h.gy+cy)*GW+h.gx+cx]) continue;
      const px=h.x+cx*CELL+CELL/2, py=h.y+cy*CELL+CELL/2;
      if(h.doors.some(d=>dist2(px,py,d.x+d.w/2,d.y+d.h/2) < 80*80)) continue;
      cells.push({px,py,edge:cx===1||cx===h.wc-2||cy===1||cy===h.hc-2});
    }
    shuffle(cells);
    const edge=cells.filter(c=>c.edge), mid=cells.filter(c=>!c.edge);
    const n=ri(3,4);
    edge.slice(0,n).forEach(c=>{
      h.crates.push({x:c.px-16,y:c.py-14,w:32,h:28,looted:false,loot:rollLoot(h.type.bias),kind:h.typeId,label:h.type.container,bias:h.type.bias});
    });
    const decorKinds = {house:['rug','bed','table'],store:['counter','rug'],warehouse:['pallet','pallet','pallet'],police:['desk','desk'],
                        hospital:['bed','bed','desk'],garage:['pallet','desk','pallet']}[h.typeId];
    mid.slice(0,decorKinds.length).forEach((c,i)=>{ h.decor.push({kind:decorKinds[i],x:c.px,y:c.py,rot:pick([0,Math.PI/2])}); });
  });

  // Outdoor crates
  attempts = 0;
  while(outdoorCrates.length < Math.round(13*DENSITY) && attempts < 9000){
    attempts++;
    const x=ri(100,WORLD_W-130), y=ri(100,WORLD_H-130);
    const box={x,y,w:32,h:28};
    if(rectsOverlap(box,spawnBox,40)) continue;
    if(houses.some(hs=>rectsOverlap(box,hs,90))) continue;
    if(outdoorCrates.some(c=>rectsOverlap(box,c,160))) continue;
    if(obstacles.some(o=>rectsOverlap(box,o,20))) continue;
    outdoorCrates.push({x,y,w:32,h:28,looted:false,loot:rollLoot(null),kind:'warehouse',label:'보급 상자',bias:null});
  }

  for(let i=0;i<Math.round(210*DENSITY);i++) spawnRandomPickup();
  resetGround(rng()*4294967296);
}

/* ============================================================
   GROUND TEXTURE — baked per chunk on demand. One canvas for the
   whole world would be far too large, so only the chunks near the
   camera are kept.
============================================================ */
const CHUNK = 1000, CHUNKS_X = Math.ceil(WORLD_W/CHUNK), CHUNKS_Y = Math.ceil(WORLD_H/CHUNK);
const CHUNK_K = CHUNK*CHUNK/(3200*2400); // ground-detail counts were tuned for a 3200x2400 map
const GROUND_CACHE = 24;
const groundChunks = new Map(); // chunk index -> {c:canvas, g:context, cx, cy, used}
const decals = [];              // blood stains, repainted when a chunk is baked again
let groundSeed = 1, groundFrame = 0;

function resetGround(seed){
  groundSeed = seed>>>0;
  groundChunks.clear();
  decals.length = 0;
}
function chunkHash(a,b,layer){
  let h = (groundSeed ^ Math.imul(a+7,374761393) ^ Math.imul(b+13,668265263) ^ Math.imul(layer+1,2246822519))>>>0;
  h = Math.imul(h^(h>>>15),2246822519)>>>0;
  return (h^(h>>>13))>>>0;
}
// Calls fn for the chunk and its neighbours, each with that chunk's own seeded random stream,
// so details that spill over a chunk edge come out identical on both sides.
function eachNeighbour(cx,cy,layer,fn){
  for(let ny=cy-1;ny<=cy+1;ny++) for(let nx=cx-1;nx<=cx+1;nx++){
    const R = makeRng(chunkHash(nx,ny,layer));
    const f = (a,b)=>a+R()*(b-a);
    fn(nx*CHUNK, ny*CHUNK, f, (a,b)=>Math.floor(f(a,b+1)), R);
  }
}

function bakeChunk(cx,cy){
  let ch;
  if(groundChunks.size >= GROUND_CACHE){
    let oldKey=-1, old=null;
    groundChunks.forEach((v,k)=>{ if(!old || v.used<old.used){ old=v; oldKey=k; } });
    groundChunks.delete(oldKey);
    ch = old;
  } else {
    const c = document.createElement('canvas');
    c.width = CHUNK; c.height = CHUNK;
    ch = {c, g:c.getContext('2d')};
  }
  ch.cx = cx; ch.cy = cy;
  groundChunks.set(cy*CHUNKS_X+cx, ch);
  const g = ch.g, x0 = cx*CHUNK, y0 = cy*CHUNK;
  g.setTransform(1,0,0,1,-x0,-y0); // draw in world coordinates
  g.globalAlpha = 1;
  g.fillStyle = '#3d3725';
  g.fillRect(x0,y0,CHUNK,CHUNK);
  // dirt patches
  eachNeighbour(cx,cy,0,(ox,oy,f,i)=>{
    for(let n=0;n<Math.round(520*CHUNK_K);n++){
      g.fillStyle = `rgba(${44+i(-8,18)},${38+i(-8,14)},${24+i(-6,10)},${f(0.25,0.55)})`;
      const x=ox+f(0,CHUNK), y=oy+f(0,CHUNK), r=f(18,64);
      g.beginPath(); g.ellipse(x,y,r,r*f(0.5,0.9),f(0,Math.PI),0,Math.PI*2); g.fill();
    }
  });
  // overgrown grass fields
  eachNeighbour(cx,cy,1,(ox,oy,f,i)=>{
    for(let n=0;n<Math.round(70*CHUNK_K);n++){
      const fx=ox+f(0,CHUNK), fy=oy+f(0,CHUNK);
      for(let j=0;j<26;j++){
        g.fillStyle = `rgba(${58+i(-8,14)},${78+i(-10,18)},${36+i(-6,10)},${f(0.16,0.34)})`;
        const r=f(14,44);
        g.beginPath(); g.ellipse(fx+f(-120,120),fy+f(-90,90),r,r*f(0.5,0.9),f(0,Math.PI),0,Math.PI*2); g.fill();
      }
    }
  });
  // grass blades
  g.lineWidth = 1.2;
  eachNeighbour(cx,cy,2,(ox,oy,f,i)=>{
    for(let n=0;n<Math.round(4200*CHUNK_K);n++){
      const x=ox+f(0,CHUNK), y=oy+f(0,CHUNK), l=f(3,7);
      g.strokeStyle = `rgba(${92+i(-14,26)},${112+i(-14,26)},${52+i(-8,14)},${f(0.25,0.6)})`;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+f(-2,2),y-l); g.stroke();
    }
  });
  // grit
  eachNeighbour(cx,cy,3,(ox,oy,f,i)=>{
    for(let n=0;n<Math.round(1400*CHUNK_K);n++){
      g.fillStyle = `rgba(${20+i(0,20)},${18+i(0,18)},${14+i(0,14)},${f(0.3,0.7)})`;
      g.fillRect(ox+f(0,CHUNK),oy+f(0,CHUNK),f(1.5,3.5),f(1.5,3.5));
    }
  });

  // roads
  ROADS.forEach(r=>{ g.fillStyle = '#2c2a26'; g.fillRect(r.x-6,r.y-6,r.w+12,r.h+12); });
  ROADS.forEach(r=>{ g.fillStyle = '#383734'; g.fillRect(r.x,r.y,r.w,r.h); });
  ROADS.forEach((r,ri_)=>{
    const ix=Math.max(r.x,x0), iy=Math.max(r.y,y0);
    const iw=Math.min(r.x+r.w,x0+CHUNK)-ix, ih=Math.min(r.y+r.h,y0+CHUNK)-iy;
    if(iw<=0 || ih<=0) return;
    const R = makeRng(chunkHash(cx,cy,10+ri_)), f=(a,b)=>a+R()*(b-a);
    for(let n=0;n<Math.round(iw*ih*0.0025);n++){
      g.fillStyle = `rgba(${R()<0.5?20:80},${R()<0.5?20:78},${R()<0.5?18:72},${f(0.08,0.25)})`;
      const s=f(2,7);
      g.fillRect(ix+f(0,iw),iy+f(0,ih),s,s*f(0.5,1));
    }
  });
  // lane markings, broken up at the crossroads
  g.fillStyle = 'rgba(207,199,168,0.5)';
  ROADS.forEach((r,ri_)=>{
    const from = r.horiz ? x0 : y0;
    for(let p=20+Math.max(0,Math.floor((from-70)/90))*90; p<from+CHUNK; p+=90){
      if(ROADS.some(o=>o.horiz!==r.horiz && Math.abs(p+25-(o.horiz?o.y:o.x)-80)<130)) continue;
      if(chunkHash(p,ri_,9)%100 < 15) continue;
      if(r.horiz) g.fillRect(p,r.y+r.h/2-3,50,6); else g.fillRect(r.x+r.w/2-3,p,6,50);
    }
  });
  // crosswalks
  g.fillStyle = 'rgba(207,199,168,0.32)';
  ROADS.forEach(H=>{ if(H.horiz) ROADS.forEach(V=>{
    if(V.horiz) return;
    for(let i=0;i<7;i++){
      g.fillRect(V.x-34, H.y+12+i*20, 22, 10);
      g.fillRect(V.x+V.w+12, H.y+12+i*20, 22, 10);
      g.fillRect(V.x+12+i*20, H.y-34, 10, 22);
      g.fillRect(V.x+12+i*20, H.y+H.h+12, 10, 22);
    }
  }); });
  // cracks
  g.strokeStyle='rgba(10,8,4,0.4)';
  eachNeighbour(cx,cy,4,(ox,oy,f,i)=>{
    for(let n=0;n<Math.round(260*CHUNK_K);n++){
      g.lineWidth = f(1,2.4);
      let x=ox+f(0,CHUNK), y=oy+f(0,CHUNK);
      g.beginPath(); g.moveTo(x,y);
      const segs = i(2,5);
      for(let s=0;s<segs;s++){ x += f(-36,36); y += f(-36,36); g.lineTo(x,y); }
      g.stroke();
    }
  });
  // building foundations
  const here = {x:x0,y:y0,w:CHUNK,h:CHUNK};
  houses.forEach(h=>{
    if(!rectsOverlap(h,here,16)) return;
    g.fillStyle = 'rgba(88,84,72,0.9)';
    g.fillRect(h.x-12,h.y-12,h.w+24,h.h+24);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    g.strokeRect(h.x-12,h.y-12,h.w+24,h.h+24);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
    for(let x=h.x-12;x<h.x+h.w+12;x+=24){ g.beginPath(); g.moveTo(x,h.y-12); g.lineTo(x,h.y+h.h+12); g.stroke(); }
    // doormat
    g.fillStyle = 'rgba(120,70,40,0.7)';
    h.doors.forEach(d=>{
      if(d.side==='top') g.fillRect(d.x+14,d.y-12,d.w-28,10);
      else if(d.side==='bottom') g.fillRect(d.x+14,d.y+d.h+2,d.w-28,10);
      else if(d.side==='left') g.fillRect(d.x-12,d.y+14,10,d.h-28);
      else g.fillRect(d.x+d.w+2,d.y+14,10,d.h-28);
    });
  });
  // darker toward the world edge
  const grad = g.createRadialGradient(WORLD_W/2,WORLD_H/2,Math.min(WORLD_W,WORLD_H)*0.4,WORLD_W/2,WORLD_H/2,Math.max(WORLD_W,WORLD_H)*0.66);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,0.4)');
  g.fillStyle = grad;
  g.fillRect(x0,y0,CHUNK,CHUNK);

  if(settings.gore) decals.forEach(d=>{ if(decalTouches(d,ch)) paintDecal(g,d); }); // switching blood off re-bakes the ground without them
  return ch;
}

function drawGround(){
  groundFrame++;
  const cx0=Math.max(0,Math.floor(camera.x/CHUNK)), cx1=Math.min(CHUNKS_X-1,Math.floor((camera.x+canvas.width)/CHUNK));
  const cy0=Math.max(0,Math.floor(camera.y/CHUNK)), cy1=Math.min(CHUNKS_Y-1,Math.floor((camera.y+canvas.height)/CHUNK));
  const ox=Math.round(camera.x), oy=Math.round(camera.y); // whole pixels, so chunk seams never show
  for(let cy=cy0;cy<=cy1;cy++) for(let cx=cx0;cx<=cx1;cx++){
    const ch = groundChunks.get(cy*CHUNKS_X+cx) || bakeChunk(cx,cy);
    ch.used = groundFrame;
    ctx.drawImage(ch.c, cx*CHUNK-ox, cy*CHUNK-oy);
  }
}

function decalTouches(d,ch){
  const m = 34*d.scale;
  return d.x+m>ch.cx*CHUNK && d.x-m<(ch.cx+1)*CHUNK && d.y+m>ch.cy*CHUNK && d.y-m<(ch.cy+1)*CHUNK;
}
function paintDecal(g,d){
  const R = makeRng(d.seed), f=(a,b)=>a+R()*(b-a);
  g.save();
  g.translate(d.x,d.y);
  g.rotate(f(0,Math.PI*2));
  g.fillStyle = 'rgba(86,16,16,0.5)';
  for(let i=0;i<6;i++){
    const r = f(4,15)*d.scale;
    g.beginPath();
    g.ellipse(f(-16,16),f(-16,16),r,r*f(0.6,1),0,0,Math.PI*2);
    g.fill();
  }
  g.restore();
}
function drawBloodDecal(x,y,scale){
  if(!settings.gore) return;
  const d = {x,y,scale:scale||1,seed:(rng()*4294967296)>>>0};
  decals.push(d);
  if(decals.length>500) decals.shift();
  groundChunks.forEach(ch=>{ if(decalTouches(d,ch)) paintDecal(ch.g,d); });
}
