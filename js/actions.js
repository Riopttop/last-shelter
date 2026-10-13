'use strict';

/* ============================================================
   ACTIONS
============================================================ */
function fireBullet(angle,speed,dmg,life,w){
  bullets.push({
    x: player.x+Math.cos(player.angle)*24, y: player.y+Math.sin(player.angle)*24,
    vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life, max: life, dmg, r: w.flame?8:4,
    pierce: w.pierce, hit: null, ex: w.ex||0, flame: !!w.flame,
  });
}
// Rounds still available to load into this gun.
function reserveRounds(w){
  const have = player.inv[w.ammoKey||'ammo'];
  return w.magCost ? Math.floor(have/w.magCost)*w.mag : Math.floor(have/w.ammo);
}
// Left click: swing the melee weapon, or fire the equipped gun.
function attemptShoot(){
  const w = WEAPONS[player.weapon];
  if(w.melee){ attemptMelee(); return; }
  if(player.fireCd > 0 || player.reload > 0) return;
  if(player.mags[player.weapon] <= 0){
    if(!startReload()){ sfx.empty(); player.fireCd = 0.3; }
    return;
  }
  player.mags[player.weapon]--;
  player.fireCd = w.cd*fireCdMul();
  const dmg = Math.round(w.dmg*gunMul());
  for(let i=0;i<w.pellets;i++){
    const speed = (w.pellets>1 || w.flame) ? w.speed*rr(0.9,1.1) : w.speed;
    fireBullet(player.angle+rr(-w.spread,w.spread), speed, dmg, w.life, w);
  }
  sfx[w.snd]();
  if(w.shake){ shakeTime = 0.06+w.shake*0.012; shakeMag = w.shake; }
  const tip = 18+w.len;
  if(!w.flame){
    muzzleFlash = 0.06;
    player.recoil = 1;
    spawnParticles(player.x+Math.cos(player.angle)*tip, player.y+Math.sin(player.angle)*tip, 3,'#f0c85a',140,0.15,3);
  }
  const gun = player.weapon;
  wearWeapon(gun,1);
  if(player.weapon===gun && player.mags[gun] <= 0) startReload();
}
// Each gun keeps its own magazine; reloading refills it from the reserve.
function startReload(){
  const w = WEAPONS[player.weapon];
  if(w.melee || player.reload > 0) return false;
  if(player.mags[player.weapon] >= w.mag || reserveRounds(w) < 1) return false;
  player.reload = player.reloadMax = w.reload*reloadMul();
  sfx.reload();
  return true;
}
function finishReload(){
  const w = WEAPONS[player.weapon], key = w.ammoKey||'ammo';
  if(w.magCost){
    if(player.inv[key] >= w.magCost){ player.inv[key] -= w.magCost; player.mags[player.weapon] = w.mag; }
  } else {
    const n = Math.min(w.mag-player.mags[player.weapon], Math.floor(player.inv[key]/w.ammo));
    player.mags[player.weapon] += n;
    player.inv[key] -= n*w.ammo;
  }
  sfx.reloadDone();
}
function switchWeapon(id){
  if(!id || player.slots.indexOf(id)<0 || player.weapon===id) return; // only equipped weapons can be drawn
  player.weapon = id;
  if(WEAPONS[id].melee) player.melee = id;
  player.reload = 0; // an interrupted reload is lost
  player.fireCd = Math.max(player.fireCd, 0.15);
  player.draw = DRAW_T; player.swing = 0;
  sfx.swap();
}

// The melee weapon swung right now: the one in hand, or (with a gun out) the equipped melee
// weapon used last. With no melee weapon in the slots the gun itself is used as a club.
function meleeWeapon(){
  const w = WEAPONS[player.weapon];
  if(w.melee) return w;
  if(player.slots.indexOf(player.melee)>=0) return WEAPONS[player.melee];
  const id = player.slots.find(s=>s && WEAPONS[s].melee);
  return id ? WEAPONS[id] : GUN_BUTT;
}
// Nearest harvestable obstacle in front of the player.
function findHarvestTarget(){
  for(const o of obstacles){
    if(o.res<=0) continue;
    if(Math.abs(o.x-player.x)>160 || Math.abs(o.y-player.y)>160) continue;
    const r=obstacleRect(o);
    const px=clamp(player.x,r.x,r.x+r.w), py=clamp(player.y,r.y,r.y+r.h);
    if(dist2(px,py,player.x,player.y) > HARVEST_RANGE*HARVEST_RANGE) continue;
    const ang=Math.atan2(r.y+r.h/2-player.y, r.x+r.w/2-player.x);
    if(Math.abs(normAngle(ang-player.angle)) > 1.2) continue;
    return {o,px,py};
  }
  return null;
}
// Best equipped tool for chopping ('chop') or mining ('mine'), or null with no melee weapon equipped.
function bestTool(kind){
  let best = null;
  equippedWeapons().forEach(id=>{ const w=WEAPONS[id]; if(w.melee && (!best || (w[kind]||1) > (best[kind]||1))) best = w; });
  return best;
}
function attemptMelee(){
  if(player.meleeCd > 0) return;
  let w = meleeWeapon();
  const hits = zombies.filter(z=>{
    if(!z.alive) return false;
    const dx=z.x-player.x, dy=z.y-player.y;
    return Math.hypot(dx,dy) < w.range+z.r && Math.abs(normAngle(Math.atan2(dy,dx)-player.angle)) < w.arc;
  });
  // nothing to fight: reach for the right tool if there is something to harvest
  const target = hits.length ? null : findHarvestTarget();
  if(target){
    const kind = HARVEST_KIND[target.o.type];
    const tool = (kind && bestTool(kind)) || w;
    if(tool.id && (tool[kind]||1) > (w[kind]||1)){
      w = tool;
      player.melee = tool.id;
      if(WEAPONS[player.weapon].melee && player.weapon!=='fist'){ player.weapon = tool.id; sfx.swap(); }
    }
  }
  if(w.id && (hits.length || target)) wearWeapon(w.id,1); // a swing at thin air costs nothing
  player.meleeCd = w.cd*meleeCdMul();
  player.swing = SWING_T;
  player.swingDir = -player.swingDir; // alternate forehand / backhand
  sfx.melee();
  if(hits.length){
    const dmg = Math.round(w.dmg*meleeMul());
    hits.forEach(z=>damageZombie(z, dmg, w.knock));
    shakeTime = 0.06; shakeMag = w.knock>300 ? 5 : 2;
    return;
  }
  if(target) harvest(target, w);
}
// One swing at a tree, rock, wreck or rubble pile.
function harvest(t,w){
  const o=t.o;
  o.res--;
  const bonus = rng()<player.stats.str*0.1 ? 1 : 0;
  let row=0, col='#b98a4e';
  const give = (key,amt)=>{ addItem(key, amt, t.px, t.py-16, row++); };
  if(o.type==='tree' || o.type==='deadtree'){
    give('wood', Math.round(ri(1,2)*(w.chop||1))+bonus);
    if(o.type==='tree' && rng()<0.18) give('herb',1);
    if(rng() < (o.type==='deadtree' ? 0.22 : 0.08)) give('mushroom',1);
  } else if(o.type==='car'){
    col='#8fa0a8';
    give('metal', ri(1,2)+bonus);
    const r=rng();
    if(r<0.28) give('parts',1); else if(r<0.5) give('fuel',1);
  } else if(o.type==='rubble'){
    col='#9a9a90';
    give(rng()<0.3?'metal':'stone', Math.round(ri(1,2)*Math.min(2,w.mine||1))+bonus);
  } else if(o.type==='rock'){
    col='#9a9a90';
    const m = w.mine||1;
    give('stone', m>1 ? ri(2,3)+bonus : 1);
    // the vein only gives up its mineral to a pickaxe of a high enough tier
    if(o.vein && w.mine && (w.tier||0) >= VEIN_TIER[o.vein] && rng()<0.75){ give(o.vein, ri(1,2)+(w.tier>VEIN_TIER[o.vein]?1:0)); col=ITEMS[o.vein].color; }
  } else {
    give('wood', ri(1,2)+bonus);
  }
  gainXp(1);
  spawnParticles(t.px,t.py,7,col,120,0.45,4);
  sfx.chop();
  shakeTime = 0.05; shakeMag = 2;
  if(o.res<=0) spawnFloat(t.px,t.py-32-row*14,'고갈됨','#aea583');
}

/* ---------- explosives ---------- */
// Blast at x,y: hurts every zombie in radius r, and the player if standing too close.
function explode(x,y,r,dmg){
  blasts.push({x,y,r,life:0.38,max:0.38});
  spawnParticles(x,y,26,'#f0c85a',320,0.6,5);
  spawnParticles(x,y,16,'#5a564c',220,0.9,6);
  sfx.explode();
  shakeTime = 0.3; shakeMag = dist2(x,y,player.x,player.y) < 500*500 ? 8 : 3;
  for(const z of zombies){
    if(!z.alive) continue;
    const d = Math.hypot(z.x-x,z.y-y)-z.r;
    if(d < r) damageZombie(z, Math.max(1,Math.round(dmg*(1-0.6*Math.max(0,d)/r))), 0);
  }
  const pd = Math.hypot(player.x-x,player.y-y), safe = r*0.6;
  if(pd < safe && gameState==='playing') hurtPlayer(4+dmg*0.2*(1-pd/safe));
}
// G / V: lob a grenade or a molotov toward the cursor.
function throwItem(type){
  if(player.inv[type] <= 0){ sfx.deny(); spawnFloat(player.x,player.y-30,Tf('{x} 없음',{x:ITEMS[type].name}),'#e04b4b'); return; }
  if(player.fireCd > 0) return;
  const def = type==='grenade' ? GRENADE : MOLOTOV;
  const mx = mouse.x+camera.x, my = mouse.y+camera.y;
  const d = Math.min(def.range, Math.hypot(mx-player.x,my-player.y)), a = player.angle;
  player.inv[type]--;
  player.fireCd = 0.45;
  gesture('reach',0.35);
  thrown.push({type, x0:player.x, y0:player.y, x:player.x, y:player.y,
               tx:clamp(player.x+Math.cos(a)*d,10,WORLD_W-10), ty:clamp(player.y+Math.sin(a)*d,10,WORLD_H-10),
               t:0, dur:0.35+d/620, rot:rr(0,6)});
  sfx.melee();
}
function landThrown(t){
  if(t.type==='grenade') explode(t.x,t.y,GRENADE.radius,GRENADE.dmg);
  else {
    fires.push({x:t.x,y:t.y,r:MOLOTOV.radius,life:MOLOTOV.life,tick:0,phase:rr(0,6)});
    spawnParticles(t.x,t.y,18,'#e8642a',200,0.6,5);
    sfx.break();
  }
}

function damageZombie(z, dmg, knock){
  const arm = z.kind==='boss' ? bossArmor(z) : 1; // carapace / exposed weak point
  if(arm!==1) dmg = Math.max(1, Math.round(dmg*arm));
  z.hp -= dmg;
  z.flash = 0.1;
  if(settings.dmgNum) spawnFloat(z.x+rr(-6,6), z.y-z.r-8, '-'+dmg, arm<1 ? '#9aa4a8' : (arm>1 ? '#ff8a5a' : '#e8b84b'));
  spawnParticles(z.x,z.y,5,bloodCol('#7a1f1f'),130,0.4,4);
  if(knock){
    const a=Math.atan2(z.y-player.y,z.x-player.x), k=knock*(z.kind==='boss'?0.03:0.1);
    z.x+=Math.cos(a)*k; z.y+=Math.sin(a)*k;
  }
  if(z.hp <= 0 && z.alive){
    z.alive = false;
    if(z.kind!=='egg') killCount++;
    gainXp(z.kind==='boss' ? BOSSES[z.boss].xp : ({brute:40, runner:12, spewer:16, bloater:18, egg:2, crawler:4})[z.kind] || 10);
    drawBloodDecal(z.x, z.y, z.kind==='boss'?2.4:(z.kind==='brute'?1.5:(z.r<14?0.6:1)));
    spawnParticles(z.x,z.y,12,bloodCol('#8a2424'),170,0.6,5);
    sfx.death();
    if(z.kind==='bloater') bossBlast(z.x,z.y,BLOAT_R,Math.round(z.dmg*0.6),0,'acid'); // shot down, it still bursts, but weaker and without hurting walls
    if(z.kind==='boss'){
      spawnParticles(z.x,z.y,30,bloodCol('#b23a3a'),260,1,7);
      shakeTime = 0.4; shakeMag = 9;
      [['ammo',12],['ammo',12],['metal',8],['metal',8],['cloth',5],['food',3],['medkit',1],['medkit',1],
       ['gunpowder',6],['parts',4],['steel',3],['grenade',2]].forEach(d=>{
        spawnPickupAt(z.x+rr(-48,48), z.y+rr(-48,48), d[0], d[1]);
      });
      showToast(Tf('{x} 처치!',{x:BOSSES[z.boss].name}),'전리품을 챙기세요');
      bossDeath(z);
    } else if(z.kind==='egg' || z.kind==='crawler'){
      // the brood drops nothing
    } else if(rng() < (z.kind==='brute'?0.9:0.3)){
      const t=pick(['metal','cloth','cloth','ammo','food','bread','bar','metal','gunpowder','herb','parts']);
      spawnPickupAt(z.x+rr(-8,8), z.y+rr(-8,8), t, t==='ammo'?ri(2,4):(t==='parts'?1:ri(1,2)));
    }
  } else {
    sfx.hit();
  }
}
function hurtPlayer(dmg){
  if(admin.god) return;
  const d = Math.max(1, Math.round(dmg*armorMul()));
  player.hp -= d;
  player.hurtFlash = 0.25;
  shakeTime = 0.18; shakeMag = 6;
  sfx.hurt();
  if(settings.dmgNum) spawnFloat(player.x, player.y-26, '-'+d, '#e04b4b');
  spawnParticles(player.x,player.y,5,bloodCol('#b23a3a'),120,0.4,4);
  if(player.hp<=0){ player.hp=0; triggerGameOver(); }
}

// A bloater's fuse ran out: acid over everything close, walls included.
function bloaterPop(z){
  z.alive = false;
  bossBlast(z.x,z.y,BLOAT_R,z.dmg,z.sdmg,'acid');
}
// Nothing solid between x,y and the target? (world geometry only; built walls do not block a shot)
function clearShot(x,y,t){
  const n = Math.ceil(Math.hypot(t.x-x,t.y-y)/24);
  for(let i=1;i<n;i++) if(shotBlocked(x+(t.x-x)*i/n, y+(t.y-y)*i/n)) return false;
  return true;
}

function findNearestCrate(){
  let best=null, bestD=50*50;
  const scan = c=>{
    if(c.looted) return;
    const d = dist2(player.x,player.y,c.x+c.w/2,c.y+c.h/2);
    if(d < bestD){ bestD=d; best=c; }
  };
  outdoorCrates.forEach(scan);
  for(const h of houses){
    if(player.x<h.x-40||player.x>h.x+h.w+40||player.y<h.y-40||player.y>h.y+h.h+40) continue;
    h.crates.forEach(scan);
  }
  return best;
}
function nearestPickup(){
  let best=null, bestD=pickupRange()*pickupRange();
  for(const p of pickups){
    if(p.taking) continue;
    const d=dist2(player.x,player.y,p.x,p.y);
    if(d<bestD){ bestD=d; best=p; }
  }
  return best;
}
function collectPickups(){
  const r2 = pickupRange()*pickupRange();
  for(const p of pickups){
    if(p.taking || dist2(player.x,player.y,p.x,p.y) >= r2) continue;
    if(p.w ? !canCarryWeapon(p.w.id) : bagRoom(p.type)<=0) continue; // no room or too heavy: it stays on the ground
    p.taking=true; gesture('reach',0.3);
  }
}
function interact(){
  if(craftOpen){ setCraftOpen(false); return; }
  if(invOpen){ setInvOpen(false); return; }
  const crate = findNearestCrate();
  if(crate){
    gesture('reach',0.4);
    sfx.open();
    // take what fits; the rest stays in the container for a later trip
    let i=0, left=0, got=0, stuck='';
    for(const key in crate.loot){
      if(!ITEMS[key]){ delete crate.loot[key]; continue; }
      const n = takeItem(key, crate.loot[key], player.x, player.y-30, i);
      crate.loot[key] -= n; got += n; left += crate.loot[key];
      if(n>0) i++;
      if(crate.loot[key]<=0) delete crate.loot[key]; else stuck = key;
    }
    if(got>0) sfx.loot();
    if(left>0) bagFullNotice(stuck);
    else { crate.looted = true; gainXp(4); }
    return;
  }
  const pk = nearestPickup();
  if(pk){
    if(pk.w){ if(!canCarryWeapon(pk.w.id)){ spawnFloat(player.x, player.y-46, '너무 무겁습니다 — 더 들 수 없습니다', '#e04b4b'); sfx.deny(); } }
    else if(bagRoom(pk.type)<=0) bagFullNotice(pk.type);
    collectPickups();
    return;
  }
  if(nearestWorkbench()){ setCraftOpen(true); return; }
  if(nearestStove()){ gesture('reach',0.4); setCraftOpen(true,'stove'); return; }
  const chest = nearestChest();
  if(chest){ gesture('reach',0.4); sfx.open(); setInvOpen(true, chest); return; }
  const turret = nearestStruct('turret',70);
  if(turret){ loadTurret(turret); return; }
  const op = nearestOutpost(80);
  if(op){ gesture('reach',0.4); activateOutpost(op); }
}
function tryHeal(){
  if(player.inv.medkit <= 0 || player.hp >= player.maxHp) return;
  player.inv.medkit--;
  player.hp = Math.min(player.maxHp, player.hp+40);
  gesture('heal',0.6);
  spawnFloat(player.x, player.y-30, '+40 체력', '#8fd16a');
  sfx.heal();
}
let lastFood = ''; // what was eaten last: the eat dial starts on it
function hasFood(){ for(const k in ITEMS) if(ITEMS[k].eat && player.inv[k]>0) return true; return false; }
// Eat one of a food item from the bag; returns false if nothing was eaten.
function eatItem(key){
  const it = ITEMS[key], e = it && it.eat;
  if(!e || !(player.inv[key]>0)) return false;
  if(player.hunger >= 95 && !(e.hp>0 && player.hp<player.maxHp)){
    spawnFloat(player.x, player.y-30, '배가 부릅니다', '#aea583');
    return false;
  }
  player.inv[key]--;
  lastFood = key;
  player.hunger = Math.min(100, player.hunger+e.hunger);
  if(e.hp) player.hp = clamp(player.hp+e.hp, 1, player.maxHp); // raw meat hurts, but never kills
  gesture('eat',0.6);
  spawnFloat(player.x, player.y-30, it.name+' · +'+e.hunger+' '+T('포만감')+(e.hp ? ' · '+T('체력')+' '+(e.hp>0?'+':'')+e.hp : ''), e.hp<0 ? '#e8843a' : '#f0c85a');
  sfx.eat();
  return true;
}

function onNewDay(){
  let restocked=0;
  const restock = c=>{ if(c.looted && rng()<0.4){ c.looted=false; c.loot=rollLoot(c.bias); restocked++; } };
  houses.forEach(h=>h.crates.forEach(restock));
  outdoorCrates.forEach(restock);
  // exhausted trees, rocks and wrecks slowly recover
  obstacles.forEach(o=>{ if(o.res<=0 && rng()<0.35) o.res = RES_MAX[o.type]||3; });
  const add = Math.min(PICKUP_TARGET*0.4|0, Math.max(0, PICKUP_TARGET-pickups.length));
  sfx.dawn();
  for(let i=0;i<add;i++) spawnRandomPickup();
  gainXp(30);
  const saved = saveGame();
  showToast(Tf('{n}일차',{n:day}),T('새벽이 밝았습니다 — 자원이 다시 나타났습니다')+(saved?T(' · 자동 저장됨'):''));
}
