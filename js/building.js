'use strict';

/* ============================================================
   INVENTORY / STRUCTURES
============================================================ */
// Building, crafting and cooking draw on the bag plus every chest standing nearby (linkedChests,
// refreshed each frame in update), so materials never have to be carried out of storage first.
function stock(key){
  let n = player.inv[key]||0;
  for(const c of linkedChests) n += c.store[key]||0;
  return n;
}
// Takes `n` of an item: from the bag first (it lightens the load), then from the linked chests.
function spend(key,n){
  const a = Math.min(n, player.inv[key]||0);
  player.inv[key] -= a; n -= a;
  for(const c of linkedChests){
    if(n<=0) break;
    const b = Math.min(n, c.store[key]||0);
    if(b>0){ c.store[key] -= b; n -= b; }
  }
}
function canAfford(cost){ for(const k in cost) if(stock(k) < cost[k]) return false; return true; }
function pay(cost){ for(const k in cost) spend(k, cost[k]); }
/* ---------- bag / chest capacity: every stack of an item takes one slot ---------- */
function stackOf(key){ return ITEMS[key].stack || STACK; }
function slotsUsed(inv){
  let n=0;
  for(const k in inv) if(inv[k]>0 && ITEMS[k]) n += Math.ceil(inv[k]/stackOf(k));
  return n;
}
function bagSlots(){ return BAG_SLOTS[player.bagLvl] || BAG_SLOTS[0]; }
// How many more of `key` fit into a store with `cap` slots.
function roomFor(inv,cap,key){
  const st=stackOf(key), have=inv[key]||0;
  return (have%st ? st-have%st : 0) + Math.max(0,cap-slotsUsed(inv))*st;
}
/* ---------- weight: bag contents + the weapons in the slots ---------- */
function invWeight(inv){
  let w=0;
  for(const k in inv) if(inv[k]>0 && ITEMS[k]) w += inv[k]*ITEMS[k].wt;
  return w;
}
function weaponWeight(){
  return player.slots.reduce((w,id)=>w+(id ? WEAPONS[id].wt : 0), 0) + player.spares.reduce((w,s)=>w+WEAPONS[s.id].wt, 0);
}
function carriedWeight(){ return invWeight(player.inv)+weaponWeight(); }
function carryCap(){ return (BAG_WEIGHT[player.bagLvl] || BAG_WEIGHT[0]) + STR_CARRY*player.stats.str; }
function carryMax(){ return carryCap()*OVERLOAD_MAX; }
function overloaded(){ return carriedWeight() > carryCap()+1e-6; }
// Walking speed factor: full speed up to the capacity, then slower and slower up to the hard limit.
function loadSpeedMul(){
  const r = carriedWeight()/carryCap();
  if(r <= 1+1e-6) return 1;
  return OVERLOAD_SPEED[0] + (OVERLOAD_SPEED[1]-OVERLOAD_SPEED[0])*clamp((r-1)/(OVERLOAD_MAX-1),0,1);
}
// How many more of `key` can be carried before the hard weight limit.
function weightRoom(key){ return Math.max(0, Math.floor((carryMax()-carriedWeight())/ITEMS[key].wt + 1e-6)); }
function bagRoom(key){ return Math.min(roomFor(player.inv, bagSlots(), key), weightRoom(key)); }
// Why no more of `key` fits: 'weight', 'slots', or '' if it does.
function bagBlock(key){
  if(weightRoom(key)<=0) return 'weight';
  return roomFor(player.inv, bagSlots(), key)<=0 ? 'slots' : '';
}
let bagFullAt = 0;
function bagFullNotice(key){
  if(performance.now()-bagFullAt < 1500) return;
  bagFullAt = performance.now();
  const heavy = key && bagBlock(key)==='weight';
  spawnFloat(player.x, player.y-46, heavy ? '너무 무겁습니다 — 더 들 수 없습니다' : '가방이 가득 찼습니다', '#e04b4b');
  sfx.deny();
}
// Puts as much as fits into the bag and returns that amount.
function takeItem(key,amt,x,y,row){
  const n = Math.min(amt, bagRoom(key));
  if(n>0){
    player.inv[key] += n;
    totalLoot += n;
    spawnFloat(x, y-(row||0)*14, '+'+n+' '+ITEMS[key].name, ITEMS[key].color);
  }
  return n;
}
// Like takeItem, but whatever does not fit is dropped at the player's feet.
function addItem(key,amt,x,y,row){
  const n = takeItem(key,amt,x,y,row);
  if(n<amt){
    spawnPickupAt(player.x+rr(-20,20), player.y+rr(-20,20), key, amt-n);
    bagFullNotice(key);
  }
  return n;
}
// For crafted goods: what the bag cannot take goes into a linked chest, and only then onto the ground.
function stashItem(key,amt,x,y,row){
  let left = amt - takeItem(key,amt,x,y,row);
  for(const c of linkedChests){
    if(left<=0) break;
    const n = Math.min(left, roomFor(c.store, chestCap(c), key));
    if(n>0){
      c.store[key] = (c.store[key]||0)+n; left -= n;
      spawnFloat(c.x+CELL/2, c.y, '+'+n+' '+Tf('{x} → 보관함',{x:ITEMS[key].name}), ITEMS[key].color);
    }
  }
  if(left>0){
    spawnPickupAt(player.x+rr(-20,20), player.y+rr(-20,20), key, left);
    bagFullNotice(key);
  }
}
function dropItem(key,amt){
  amt = Math.min(amt, player.inv[key]);
  if(amt<=0) return;
  player.inv[key] -= amt;
  spawnPickupAt(player.x+Math.cos(player.angle)*34+rr(-6,6), player.y+Math.sin(player.angle)*34+rr(-6,6), key, amt);
  sfx.open();
}
// Move up to `amt` of an item between the bag and an open chest; returns the amount moved.
function moveItem(chest,key,amt,toChest){
  const from = toChest ? player.inv : chest.store, to = toChest ? chest.store : player.inv;
  const n = Math.min(amt, from[key]||0, toChest ? roomFor(to, chestCap(chest), key) : bagRoom(key));
  if(n<=0){ if(!toChest && from[key]>0) bagFullNotice(key); else sfx.deny(); return 0; }
  from[key] -= n; to[key] = (to[key]||0)+n;
  sfx.pickup();
  return n;
}

/* ---------- weapons: three slots in hand, the rest in the bag ---------- */
// A weapon outside the slots is an instance {id, dur, mag}: it lies in the bag (player.spares), in a chest
// (chest.weapons) or on the ground (a pickup with .w). A slotted weapon is tracked by id — player.slots holds
// ids, player.dur[id] / player.mags[id] its state — so only one weapon of a kind can be equipped at a time.
function equippedWeapons(){ return player.slots.filter(Boolean); }
function newWeapon(id){ const w=WEAPONS[id]; return {id, dur:w.dur, mag:w.melee ? 0 : w.mag}; }
function validWeapon(s){ return !!(s && WEAPONS[s.id] && s.id!=='fist'); }
function hasWeapon(id){ return player.slots.indexOf(id)>=0 || player.spares.some(s=>s.id===id); }
// Could one more weapon of this kind be carried without passing the hard weight limit?
function canCarryWeapon(id){ return carriedWeight()+WEAPONS[id].wt <= carryMax()+1e-6; }
function durRatio(id){ const max=WEAPONS[id].dur; return isFinite(max) ? clamp((player.dur[id]||0)/max,0,1) : 1; }
// After the weapon in hand left its slot: draw whatever is still equipped, or fight bare-handed.
function fixHand(){
  if(player.slots.indexOf(player.weapon)<0){
    player.weapon = equippedWeapons()[0] || 'fist';
    player.reload = 0; player.draw = DRAW_T; player.swing = 0;
  }
  if(player.slots.indexOf(player.melee)<0) player.melee = WEAPONS[player.weapon].melee ? player.weapon : '';
}
function putInSlot(inst,slot){
  player.slots[slot] = inst.id;
  player.dur[inst.id] = inst.dur;
  if(!WEAPONS[inst.id].melee) player.mags[inst.id] = inst.mag||0;
}
// Empties a slot and returns the weapon that was in it as an instance.
function takeFromSlot(slot){
  const id = player.slots[slot];
  if(!id) return null;
  const inst = {id, dur:player.dur[id], mag:player.mags[id]||0};
  player.slots[slot] = null;
  delete player.dur[id];
  if(!WEAPONS[id].melee) player.mags[id] = 0;
  return inst;
}
// Equip the i-th bag weapon into a slot; whatever was in the slot goes back into the bag.
function equipSpare(i,slot){
  const inst = player.spares[i];
  if(!inst || slot<0 || slot>=WEAPON_SLOTS) return;
  const at = player.slots.indexOf(inst.id);
  if(at>=0 && at!==slot){
    spawnFloat(player.x, player.y-46, '같은 무기는 하나만 장착할 수 있습니다', '#e04b4b');
    sfx.deny();
    return;
  }
  const inHand = player.weapon==='fist' || player.slots[slot]===player.weapon;
  const out = takeFromSlot(slot);
  putInSlot(inst,slot);
  if(out) player.spares[i] = out; else player.spares.splice(i,1);
  if(inHand){ player.weapon = inst.id; player.reload = 0; player.draw = DRAW_T; player.swing = 0; }
  fixHand();
  sfx.swap();
}
// Move the weapon in a slot into the bag (its weight stays on the player until it is dropped or stored).
function unequipSlot(slot){
  const inst = takeFromSlot(slot);
  if(!inst) return;
  player.spares.push(inst);
  fixHand();
  sfx.swap();
}
function spawnWeaponPickup(x,y,inst){
  pickups.push({x,y,type:'weapon',w:inst,amt:1,rot:rr(0,Math.PI*2),phase:rr(0,6),taking:false});
}
function dropSpare(i){
  const inst = player.spares.splice(i,1)[0];
  if(!inst) return;
  spawnWeaponPickup(player.x+Math.cos(player.angle)*34+rr(-6,6), player.y+Math.sin(player.angle)*34+rr(-6,6), inst);
  sfx.open();
}
// Item slots left in a chest: every stored weapon takes one.
function chestCap(c){ return CHEST_SLOTS-(c.weapons ? c.weapons.length : 0); }
function storeSpare(chest,i){
  if(!player.spares[i]) return;
  if(slotsUsed(chest.store)+chest.weapons.length >= CHEST_SLOTS){ sfx.deny(); return; }
  chest.weapons.push(player.spares.splice(i,1)[0]);
  sfx.pickup();
}
function takeStored(chest,i){
  const inst = chest.weapons[i];
  if(!inst) return;
  if(!canCarryWeapon(inst.id)){ spawnFloat(player.x, player.y-46, '너무 무겁습니다 — 더 들 수 없습니다', '#e04b4b'); sfx.deny(); return; }
  chest.weapons.splice(i,1);
  player.spares.push(inst);
  sfx.pickup();
}
// Uses up durability of an equipped weapon; at 0 it breaks and leaves its slot.
function wearWeapon(id,n){
  const max = WEAPONS[id] ? WEAPONS[id].dur : Infinity;
  if(!isFinite(max) || player.dur[id]===undefined) return;
  const before = player.dur[id];
  player.dur[id] -= n;
  if(player.dur[id] <= 0){
    const slot = player.slots.indexOf(id);
    if(slot>=0) takeFromSlot(slot);
    spawnFloat(player.x, player.y-46, Tf('{x} 파손!',{x:WEAPONS[id].name}), '#e04b4b');
    spawnParticles(player.x+Math.cos(player.angle)*20, player.y+Math.sin(player.angle)*20, 10, '#b4bec4', 150, 0.5, 3);
    sfx.break();
    fixHand();
  } else if(before > max*0.15 && player.dur[id] <= max*0.15){
    spawnFloat(player.x, player.y-46, Tf('{x} — 곧 부서집니다',{x:WEAPONS[id].name}), '#e8843a');
  }
}
// Uses up one weapon of a kind (the tool an upgrade is forged from): returns the slot it sat in, or -1.
function consumeWeapon(id){
  const slot = player.slots.indexOf(id);
  if(slot>=0){ takeFromSlot(slot); return slot; }
  const i = player.spares.findIndex(s=>s.id===id);
  if(i>=0) player.spares.splice(i,1);
  return -1;
}

function placeStruct(def,cx,cy){
  const pad = (def.id==='workbench'||def.id==='chest'||def.id==='stove') ? 3 : 0;
  const maxHp = Math.round(def.hp*buildHpMul());
  const s = {def,cx,cy,cell:cy*GW+cx,x:cx*CELL,y:cy*CELL,hp:maxHp,maxHp,phase:rr(0,6),
             rect:{x:cx*CELL+pad,y:cy*CELL+pad,w:CELL-pad*2,h:CELL-pad*2}};
  if(def.id==='chest'){ s.store = {}; s.weapons = []; }
  if(def.id==='turret'){ s.ammo = TURRET.ammoStart; s.aim = 0; s.cd = 0; }
  structures.push(s);
  structGrid[s.cell]=s;
  flowTimer=0;
  return s;
}
function removeStruct(s){
  const i=structures.indexOf(s);
  if(i>=0) structures.splice(i,1);
  structGrid[s.cell]=null;
  flowTimer=0;
  if(s.def.id==='outpost') onOutpostLost(s);
  if(s.store){ // a broken or dismantled chest spills what it held
    for(const k in s.store) if(s.store[k]>0 && ITEMS[k]) spawnPickupAt(s.x+CELL/2+rr(-26,26), s.y+CELL/2+rr(-26,26), k, s.store[k]);
    s.weapons.forEach(w=>spawnWeaponPickup(s.x+CELL/2+rr(-26,26), s.y+CELL/2+rr(-26,26), w));
    if(invChest===s) setInvOpen(false);
    linkedChests = linkedChests.filter(c=>c!==s);
  }
}
/* ---------- automatic turret ---------- */
function updateTurret(s,dt){
  s.cd -= dt;
  if(s.cd>0 || !(s.ammo>0)) return;
  const x=s.x+CELL/2, y=s.y+CELL/2;
  let best=null, bd=TURRET.range*TURRET.range;
  for(const z of zombies){
    if(!z.alive) continue;
    const d=dist2(z.x,z.y,x,y);
    if(d<bd && clearShot(x,y,z)){ bd=d; best=z; }
  }
  if(!best){ s.cd=0.2; return; }
  s.cd=TURRET.cd; s.ammo--;
  s.aim=Math.atan2(best.y-y,best.x-x);
  tracers.push({x1:x+Math.cos(s.aim)*20, y1:y+Math.sin(s.aim)*20, x2:best.x, y2:best.y, life:0.07});
  damageZombie(best,TURRET.dmg,0);
  if(dist2(x,y,player.x,player.y) < 700*700) sfx.turret();
}
// E next to a turret: top its magazine up from the bag.
function loadTurret(s){
  const n = Math.min(TURRET.ammoMax-s.ammo, player.inv.ammo);
  if(n<=0){
    sfx.deny();
    spawnFloat(s.x+CELL/2, s.y, s.ammo>=TURRET.ammoMax ? '포탑 탄약 가득' : Tf('{x} 없음',{x:ITEMS.ammo.name}), '#e04b4b');
    return;
  }
  player.inv.ammo -= n; s.ammo += n;
  gesture('reach',0.4); sfx.reload();
  spawnFloat(s.x+CELL/2, s.y, Tf('포탑 장전 +{n}',{n}), '#f0c85a');
}
function damageStruct(s,dmg){
  s.hp -= dmg;
  const col = (s.def.id==='metalwall'||s.def.id==='steelwall') ? '#9aa4a8' : '#b98a4e';
  spawnParticles(s.x+CELL/2,s.y+CELL/2,4,col,90,0.4,3);
  if(s.def.id==='outpost') s.alarm = 2; // flashes on the map while under attack
  if(s.hp<=0){
    removeStruct(s);
    spawnParticles(s.x+CELL/2,s.y+CELL/2,16,col,160,0.7,5);
    spawnFloat(s.x+CELL/2,s.y+8,Tf('{x} 파괴!',{x:s.def.name}),'#e04b4b');
    sfx.break();
    if(craftOpen && s.def.id===craftStation) setCraftOpen(false);
  }
}
function mouseCell(){
  return {cx:Math.floor((mouse.x+camera.x)/CELL), cy:Math.floor((mouse.y+camera.y)/CELL)};
}
function cellInRange(cx,cy){
  return dist2(cx*CELL+CELL/2,cy*CELL+CELL/2,player.x,player.y) <= BUILD_RANGE*BUILD_RANGE;
}
function canPlace(def,cx,cy){
  if(cx<0||cy<0||cx>=GW||cy>=GH) return false;
  const i=cy*GW+cx;
  if(staticBlock[i] || structGrid[i]) return false;
  if(!cellInRange(cx,cy)) return false;
  if(def.blockP){
    const px=clamp(player.x,cx*CELL,cx*CELL+CELL), py=clamp(player.y,cy*CELL,cy*CELL+CELL);
    if(dist2(px,py,player.x,player.y) < player.r*player.r) return false;
  }
  return true;
}
function buildAction(){
  if(buildCd>0) return;
  const {cx,cy}=mouseCell();
  if(cx<0||cy<0||cx>=GW||cy>=GH) return;
  const def=BUILD_DEFS[buildSel];
  const existing=structGrid[cy*GW+cx];
  if(existing){
    if(existing.hp<existing.maxHp && cellInRange(cx,cy)){
      const res=Object.keys(existing.def.cost)[0];
      if(stock(res)>=1){
        spend(res,1);
        existing.hp=Math.min(existing.maxHp, existing.hp+existing.maxHp*0.35);
        spawnFloat(existing.x+CELL/2,existing.y,'수리','#8fd16a');
        sfx.build(); buildCd=0.25; flowTimer=0;
      } else { sfx.deny(); buildCd=0.3; }
    }
    return;
  }
  if(!canPlace(def,cx,cy)){ return; }
  if(!canAfford(def.cost)){
    sfx.deny(); buildCd=0.35;
    spawnFloat(cx*CELL+CELL/2,cy*CELL+10,'재료 부족','#e04b4b');
    return;
  }
  pay(def.cost);
  const built = placeStruct(def,cx,cy);
  gesture('reach',0.3);
  gainXp(2);
  if(def.id==='outpost'){ gainXp(15); activateOutpost(built); }
  spawnParticles(cx*CELL+CELL/2,cy*CELL+CELL/2,8,'#cfc7a8',80,0.4,3);
  sfx.build();
  buildCd=0.13;
}
function demolishAction(){
  if(buildCd>0) return;
  const {cx,cy}=mouseCell();
  if(cx<0||cy<0||cx>=GW||cy>=GH) return;
  const s=structGrid[cy*GW+cx];
  if(!s || !cellInRange(cx,cy)) return;
  let row=0;
  for(const k in s.def.cost){
    const back=Math.floor(s.def.cost[k]/2*(0.4+0.6*s.hp/s.maxHp));
    if(back>0){ addItem(k,back,s.x+CELL/2,s.y,row); row++; }
  }
  if(craftOpen && s.def.id===craftStation) setCraftOpen(false);
  removeStruct(s);
  sfx.open(); buildCd=0.25;
}

function setBuildMode(on){
  buildMode=on;
  el.buildBar.classList.toggle('hidden',!on);
  el.buildHint.classList.toggle('hidden',!on);
  if(on){ setCraftOpen(false); setInvOpen(false); player.draw=DRAW_T; }
}
// `station` = the structure being used: 'workbench' (default) or 'stove'; it decides which tabs are listed.
function setCraftOpen(on,station){
  craftOpen=on;
  el.craftPanel.classList.toggle('hidden',!on);
  if(on){ craftStation=station||'workbench'; setInvOpen(false); buildMode=false; el.buildBar.classList.add('hidden'); el.buildHint.classList.add('hidden'); buildCraftUI(); }
}
function recipeOwned(r){
  if(r.repair) return durRatio(player.weapon) >= 1; // nothing to mend
  if(r.gear) return !!player.gear[r.gear] || (r.gear==='armor' && !!player.gear.steelarmor);
  if(r.bag) return player.bagLvl >= r.bag;
  return false;
}
// Reason the recipe cannot be made yet ('' if none): level too low, or the previous bag / tool tier is missing.
// short = just the thing that is needed, for the narrow status column.
function lockText(r,short){
  let need = '';
  if(r.lvl && player.level<r.lvl) need = 'LV '+r.lvl;
  else if(r.from && !hasWeapon(r.from)) need = WEAPONS[r.from].name;
  else if(r.bag && player.bagLvl < r.bag-1) need = BAG_NAME[r.bag-1];
  return need && !short ? Tf('{x} 필요',{x:need}) : need;
}
function recipeLocked(r){ return !!lockText(r); }
// How many times the recipe could be made with what the player carries.
function craftableCount(r){
  let n = Infinity;
  for(const k in r.cost) n = Math.min(n, Math.floor(stock(k)/r.cost[k]));
  return n;
}
// Craft a recipe up to `times` times (stackables only; weapons, gear and bags are made once).
function craft(r,times){
  if(!r || !craftOpen) return;
  if(recipeOwned(r)) return;
  if(recipeLocked(r) || !canAfford(r.cost)){ sfx.deny(); return; }
  const n = r.gives ? Math.max(1, Math.min(times||1, craftableCount(r))) : 1;
  for(let i=0;i<n;i++) pay(r.cost);
  let note = '';
  if(r.gives){
    let row=1;
    for(const k in r.gives) stashItem(k, r.gives[k]*n, player.x, player.y-34, row++);
  } else if(r.repair){
    player.dur[player.weapon] = WEAPONS[player.weapon].dur;
  } else if(r.weapon){
    // an upgrade takes the place of the tool it was forged from; anything else goes to a free slot, else the bag
    const inst = newWeapon(r.weapon), wasInHand = !!r.from && player.weapon===r.from;
    let slot = r.from ? consumeWeapon(r.from) : -1;
    if(slot<0) slot = player.slots.indexOf(null);
    const fits = !!r.from || canCarryWeapon(r.weapon); // an upgrade replaces what was already carried
    if(slot>=0 && player.slots.indexOf(r.weapon)<0 && fits){
      putInSlot(inst,slot);
      if(wasInHand){ player.weapon = r.weapon; player.draw = DRAW_T; }
      else if(!r.from) switchWeapon(r.weapon);
    } else if(fits){
      player.spares.push(inst);
      note = T(' — 가방에 넣었습니다 ({inventory}에서 장착)');
    } else {
      spawnWeaponPickup(player.x+rr(-20,20), player.y+rr(-20,20), inst);
      note = T(' — 너무 무거워 바닥에 놓았습니다');
    }
    fixHand();
  } else if(r.gear){
    player.gear[r.gear] = true;
    if(r.gear==='steelarmor') delete player.gear.armor;
  } else if(r.bag){
    player.bagLvl = r.bag;
    note = Tf(' — 가방 {a}칸 · 적재량 {b}kg',{a:bagSlots(),b:carryCap()});
  }
  gainXp(r.gives ? 5*n : (r.repair ? 3 : 20));
  spawnFloat(player.x,player.y-34,r.name+(n>1?' ×'+n:'')+T(r.repair?' 완료!':(r.cat==='cook'?' 완성!':' 제작!'))+note,'#f0c85a');
  sfx.craft();
  renderRecipes();
}
function nearestStruct(id,range){
  let best=null, bd=range*range;
  for(const s of structures){
    if(s.def.id!==id) continue;
    const d=dist2(s.x+CELL/2,s.y+CELL/2,player.x,player.y);
    if(d<bd){ bd=d; best=s; }
  }
  return best;
}
function nearestWorkbench(){ return nearestStruct('workbench',74); }
function nearestChest(){ return nearestStruct('chest',74); }
function nearestStove(){ return nearestStruct('stove',74); }
