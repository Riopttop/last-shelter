'use strict';

/* ============================================================
   ENTITIES / STATE
============================================================ */
let player, zombies, bullets, floatingTexts, particles, killCount, survivalTime, totalLoot;
let spawnTimer, camera, shakeTime, shakeMag, muzzleFlash;
let thrown = [], fires = [], blasts = []; // grenades in flight, burning ground, explosion flashes
let tracers = [];                         // the flash of a turret shot
let hazards = [], eshots = [];            // boss telegraphs / pools / shock rings, enemy projectiles (see boss.js)
let worldTime, day, flowTimer, toastTimer, craftRefresh;
let buildMode=false, buildSel=0, buildCd=0, craftOpen=false;
let invOpen=false, invChest=null, invSlotSel=0; // inventory panel, the chest it is showing, slot the next weapon goes into
let craftStation='workbench'; // structure the craft panel was opened at: workbench | stove
let linkedChests=[];          // chests within CHEST_LINK of the player; their contents count for building and crafting
let bossDay = 0; // last day a boss was spawned
let mapOpen=false, markerSel=0, markers=[];
let checkpoint = -1; // cell of the active outpost flag, -1 if none
let gameState = 'start'; // start | playing | paused | gameover

function resetGame(){
  genWorld();
  player = {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, r: PLAYER_R, angle: 0,
    hp: 100, maxHp: 100, hunger: 100,
    level: 1, xp: 0, points: 0,
    stats: {vit:0, str:0, aim:0, agi:0, sur:0, eng:0},
    inv: {}, mags: {},
    weapon: 'knife', melee: 'knife', // melee = the melee weapon F / right click swings while a gun is out
    slots: ['knife', null, null],    // equipped weapons; only these can be drawn
    bagLvl: 0,
    dur: {knife:WEAPONS.knife.dur}, // durability left on each slotted weapon
    spares: [],                     // weapons carried in the bag: {id, dur, mag}
    gear: {},
    reload: 0, reloadMax: 1,
    moveAngle: 0, // legs follow the walk direction; `angle` is the mouse aim
    bodyAngle: 0, // eased facing of the torso
    swingDir: 1, recoil: 0, draw: 0, gest: '', gestT: 0, gestMax: 1, // animation state
    fireCd: 0, meleeCd: 0, hurtFlash: 0, swing: 0, walk: 0, moving:false,
    slow: 0, // seconds left of being webbed
  };
  for(const k in ITEMS) player.inv[k] = 0;
  player.inv.food = 1;
  WEAPON_ORDER.forEach(id=>{ if(!WEAPONS[id].melee) player.mags[id] = 0; });
  zombies = []; bullets = []; floatingTexts = []; particles = [];
  thrown = []; fires = []; blasts = []; hazards = []; eshots = []; tracers = [];
  killCount = 0; survivalTime = 0; totalLoot = 0;
  worldTime = DAY_LEN*0.085; day = 1;
  spawnTimer = GRACE_TIME/diff().spawn; // quiet opening so the player can scavenge
  bossDay = 0;
  markers = []; checkpoint = -1; linkedChests = []; setMapOpen(false);
  flowTimer = 0; toastTimer = 0; craftRefresh = 0;
  camera = {x:0, y:0};
  snapCamera();
  shakeTime = 0; shakeMag = 0; muzzleFlash = 0;
  setBuildMode(false); setCraftOpen(false); setInvOpen(false);
  computeFlow();
}

// Floating texts and toasts translate a whole Korean string themselves (T, settings.js);
// a string built from parts has to be translated by the caller.
function spawnFloat(x,y,text,color){
  floatingTexts.push({x,y,text:T(text),color,life:1,vy:-32});
}
function spawnParticles(x,y,n,color,speed,life,size){
  if(particles.length>500) return;
  for(let i=0;i<n;i++){
    const a=rr(0,Math.PI*2), s=rr(speed*0.3,speed);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rr(life*0.5,life),max:life,color,size:rr(size*0.5,size)});
  }
}
function showToast(title,sub){
  el.toast.innerHTML = T(title) + (sub?'<small>'+T(sub)+'</small>':'');
  el.toast.classList.add('show');
  toastTimer = 3.2;
}

function timeOfDay(){ return (worldTime % DAY_LEN)/DAY_LEN; }
function darknessAt(t){
  if(t<0.55) return 0;
  if(t<0.65) return (t-0.55)/0.10*0.86;
  if(t<0.93) return 0.86;
  return (1-t)/0.07*0.86;
}
function isNight(){ const t=timeOfDay(); return t>=0.6 && t<0.95; }

// No type: the boss this night calls for, cycling through BOSS_ORDER. near (admin): right in front of the player.
function spawnBoss(type,near){
  if(!type){
    bossDay = day;
    type = BOSS_ORDER[(Math.max(1, Math.floor(day/BOSS_EVERY))-1) % BOSS_ORDER.length];
  }
  spawnZombie(700,'boss',type);
  const z = zombies[zombies.length-1];
  if(near){
    for(let i=0;i<12;i++){
      const a = player.angle+(i%2?-1:1)*Math.ceil(i/2)*0.5;
      const x = clamp(player.x+Math.cos(a)*360,60,WORLD_W-60), y = clamp(player.y+Math.sin(a)*360,60,WORLD_H-60), ci = cellIdx(x,y);
      if(staticBlock[ci] || structGrid[ci]) continue;
      z.x = x; z.y = y;
      break;
    }
  }
  showToast(Tf('보스 출현 — {x}',{x:BOSSES[type].name}), BOSSES[type].sub);
  sfx.roar();
  shakeTime = 0.5; shakeMag = 5;
  return z;
}
// A reachable spot just beyond the screen; the map is far too big to walk in from the edge.
function findSpawnSpot(minDist){
  const near = Math.max(minDist||0, Math.hypot(canvas.width,canvas.height)/2+80);
  let x=player.x, y=player.y;
  for(let t=0;t<30;t++){
    const a=rr(0,Math.PI*2), d=rr(near,near+420);
    x=clamp(player.x+Math.cos(a)*d,30,WORLD_W-30); y=clamp(player.y+Math.sin(a)*d,30,WORLD_H-30);
    if(dist2(x,y,player.x,player.y) < near*near*0.8) continue; // clamped back toward the player
    const ci=cellIdx(x,y);
    if(!staticBlock[ci] && !structGrid[ci] && isFinite(distField[ci])) break;
  }
  return {x,y};
}
function spawnZombie(minDist,kind,type){
  const {x,y} = findSpawnSpot(minDist);
  const scale = (1 + 0.12*(day-1))*diff().zHp;
  const r = rng();
  const bruteP = day>=3 ? Math.min(0.15,0.03*(day-2)) : 0;
  const runnerP = day>=2 ? Math.min(0.3,0.06*day) : 0;
  const spewP = day>=3 ? Math.min(0.14,0.035*(day-2)) : 0;  // spits acid from a distance
  const bloatP = day>=4 ? Math.min(0.1,0.025*(day-3)) : 0;  // bursts next to the player or a wall (dmg / sdmg = the burst)
  let z;
  if(kind==='boss') z=makeBoss(type,scale);
  else if(r<bruteP) z={kind:'brute',r:21,hp:150*scale,speed:rr(48,60),dmg:18,sdmg:28,skin:'#5d7044',cloth:'#4a3030'};
  else if(r<bruteP+runnerP) z={kind:'runner',r:13,hp:26*scale,speed:rr(135,165),dmg:6,sdmg:6,skin:'#9aa878',cloth:'#3a4452'};
  else if(r<bruteP+runnerP+spewP) z={kind:'spewer',r:14,hp:34*scale,speed:rr(62,78),dmg:7,sdmg:8,skin:'#8fb04a',cloth:'#44522a',shotCd:rr(1,2)};
  else if(r<bruteP+runnerP+spewP+bloatP) z={kind:'bloater',r:19,hp:64*scale,speed:rr(78,92),dmg:22,sdmg:45,skin:'#a8b07a',cloth:'#5a5236'};
  else z={kind:'walker',r:15,hp:40*scale,speed:rr(60,105),dmg:9,sdmg:10,skin:pick(['#7f9650','#748a4a','#8a9a5c']),cloth:pick(['#4d4a3a','#3f4a4f','#5a4436','#44503a'])};
  z.dmg=Math.max(1,Math.round(z.dmg*diff().zDmg));
  z.x=x; z.y=y; z.maxHp=z.hp; z.alive=true; z.atkCd=0; z.spikeCd=0; z.phase=rr(0,10);
  z.angle=0; z.flash=0; z.nc=-1; z.ox=rr(-7,7); z.oy=rr(-7,7);
  zombies.push(z);
}

/* ---------- animation helpers ---------- */
function gesture(type,dur){
  if(player.gestT>0 && player.gest===type) return;
  player.gest=type; player.gestT=player.gestMax=dur;
}

/* ---------- outposts / checkpoint ---------- */
function outposts(){ return structures.filter(s=>s.def.id==='outpost'); }
function activeOutpost(){
  const s = checkpoint>=0 ? structGrid[checkpoint] : null;
  return s && s.def.id==='outpost' ? s : null;
}
function nearestOutpost(range){
  let best=null, bd=range*range;
  for(const s of structures){
    if(s.def.id!=='outpost') continue;
    const d=dist2(s.x+CELL/2,s.y+CELL/2,player.x,player.y);
    if(d<bd){ bd=d; best=s; }
  }
  return best;
}
function activateOutpost(s){
  checkpoint = s.cell;
  spawnParticles(s.x+CELL/2,s.y+CELL/2,14,'#8fd16a',140,0.7,4);
  const saved = saveGame();
  showToast('체크포인트 설정', T('쓰러지면 이 거점에서 다시 일어납니다')+(saved?T(' · 저장됨'):''));
  sfx.craft();
}
// The flag fell: fall back to another outpost if one is still standing.
function onOutpostLost(s){
  if(checkpoint!==s.cell) return;
  const rest = outposts();
  checkpoint = rest.length ? rest[rest.length-1].cell : -1;
  showToast('거점 파괴!', rest.length ? '체크포인트가 다른 거점으로 옮겨졌습니다' : '체크포인트가 사라졌습니다');
}
// Put the player on a free cell next to an outpost flag.
function placeAtOutpost(s){
  for(const n of [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const cx=s.cx+n[0], cy=s.cy+n[1];
    if(cx<0||cy<0||cx>=GW||cy>=GH) continue;
    const i=cy*GW+cx;
    if(staticBlock[i] || (structGrid[i] && structGrid[i].def.blockP)) continue;
    player.x=cx*CELL+CELL/2; player.y=cy*CELL+CELL/2;
    break;
  }
  snapCamera();
  flowTimer=0; computeFlow();
}
function snapCamera(){
  camera.x = clamp(player.x - canvas.width/2, 0, Math.max(0, WORLD_W-canvas.width));
  camera.y = clamp(player.y - canvas.height/2, 0, Math.max(0, WORLD_H-canvas.height));
}
function respawnAtCheckpoint(){
  const s = activeOutpost();
  if(!s || gameState!=='gameover') return;
  // half of the carried materials are lost on the way back
  let lost=0;
  const keep = 2;
  for(const k in player.inv){ if(k==='medkit') continue; const n=Math.floor(player.inv[k]/keep); player.inv[k]-=n; lost+=n; }
  thrown = []; fires = []; hazards = []; eshots = [];
  player.slow = 0;
  player.hp = Math.round(player.maxHp*0.6);
  player.hunger = Math.max(player.hunger, 50);
  player.reload = 0; player.hurtFlash = 0; player.swing = 0;
  placeAtOutpost(s);
  zombies = zombies.filter(z=>z.alive && (z.kind==='boss' || dist2(z.x,z.y,player.x,player.y) > 800*800));
  spawnTimer = Math.max(spawnTimer, 6);
  gameState = 'playing';
  document.getElementById('overOverlay').classList.add('hidden');
  showToast('거점에서 부활', Tf('가진 물자의 절반({n})을 잃었습니다',{n:lost}));
  sfx.heal();
  updateHUD();
}
function setMapOpen(on){
  mapOpen = on;
  document.getElementById('hud').classList.toggle('map-open', on);
  if(on){ setCraftOpen(false); setInvOpen(false); for(const k in keys) keys[k]=false; mouse.down=false; mouse.rdown=false; }
}
