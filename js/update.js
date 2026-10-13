'use strict';

/* ============================================================
   UPDATE
============================================================ */
let stepTimer = 0, groanTimer = 2, heartTimer = 0;
function update(dt){
  survivalTime += dt;
  const wasNight = isNight();
  worldTime += dt;
  const newDay = Math.floor(worldTime/DAY_LEN)+1;
  if(newDay!==day){ day=newDay; onNewDay(); }
  const night = isNight();
  if(night && !wasNight){
    if(day%BOSS_EVERY===0 && bossDay!==day) spawnBoss();
    else { showToast('밤이 찾아옵니다','좀비가 몰려옵니다 — 거점을 지키세요'); sfx.nightfall(); }
  }

  // movement
  let mx=0,my=0;
  if(held('up')) my -= 1;
  if(held('down')) my += 1;
  if(held('left')) mx -= 1;
  if(held('right')) mx += 1;
  mx += vin.mx; my += vin.my; // gamepad stick / touch stick (controls.js)
  player.moving = !!(mx||my);
  if(player.moving){
    const len = Math.hypot(mx,my);
    const sp = PLAYER_SPEED*speedMul()*(player.hunger<=0?0.8:1)*(player.slow>0?0.55:1)*Math.min(1,len); // a stick pushed halfway walks
    player.x += (mx/len)*sp*dt;
    player.y += (my/len)*sp*dt;
    player.walk += dt*11;
    player.moveAngle += normAngle(Math.atan2(my,mx)-player.moveAngle)*Math.min(1,dt*14);
    stepTimer -= dt;
    if(stepTimer<=0){ stepTimer = 0.3; sfx.step(); }
  }
  collideStructs(player,false,-1);
  collideWithWorld(player);
  linkedChests = structures.filter(s=>s.store && dist2(s.x+CELL/2,s.y+CELL/2,player.x,player.y) < CHEST_LINK*CHEST_LINK);

  snapCamera();
  player.angle = Math.atan2(mouse.y+camera.y-player.y, mouse.x+camera.x-player.x);
  // the torso follows the walk direction, back-pedals rather than turning away from the aim,
  // and settles on the aim when standing still
  let face = player.moving ? player.moveAngle : player.angle;
  if(Math.abs(normAngle(player.angle-face)) > Math.PI*0.6) face += Math.PI;
  player.bodyAngle = normAngle(player.bodyAngle + normAngle(face-player.bodyAngle)*Math.min(1,dt*(player.moving?12:7)));
  if(player.recoil>0) player.recoil = Math.max(0, player.recoil-dt*8);
  if(player.draw>0) player.draw -= dt;
  if(player.gestT>0) player.gestT -= dt;

  player.fireCd -= dt; player.meleeCd -= dt; buildCd -= dt;
  if(player.hurtFlash>0) player.hurtFlash -= dt;
  if(player.swing>0) player.swing -= dt;
  if(player.reload>0){ player.reload -= dt; if(player.reload<=0){ player.reload=0; finishReload(); } }

  // ambient audio: nearby groans, low-health heartbeat, day/night bed
  groanTimer -= dt;
  if(groanTimer<=0){
    groanTimer = rr(1.6,3.8);
    let nd = 560*560;
    for(const z of zombies){ if(z.alive){ const d=dist2(z.x,z.y,player.x,player.y); if(d<nd) nd=d; } }
    if(nd < 560*560) sfx.groan(0.03+0.11*(1-Math.sqrt(nd)/560));
  }
  if(player.hp < 30){
    heartTimer -= dt;
    if(heartTimer<=0){ heartTimer = 0.85; sfx.heartbeat(); }
  }
  setAmbience(darknessAt(timeOfDay())/0.86, true);

  // hunger
  player.hunger = Math.max(0, player.hunger - dt*0.3*hungerMul());
  if(player.hunger<=0){
    player.hp -= dt*1.5;
    if(player.hp<=0){ player.hp=0; triggerGameOver(); return; }
  } else if(player.hunger>60 && player.hp<player.maxHp){
    player.hp = Math.min(player.maxHp, player.hp+dt*0.4);
  }

  if(buildMode){
    if(mouse.down||vin.fire) buildAction();
    if(mouse.rdown||vin.alt) demolishAction();
  } else if(!craftOpen && !invOpen && !dial.open){ // while the eat dial is up the mouse picks food
    if(mouse.down||vin.fire) attemptShoot();
    if(mouse.rdown||vin.alt) attemptMelee();
  }
  if(invOpen){
    if(invChest && (structGrid[invChest.cell]!==invChest || dist2(invChest.x+CELL/2,invChest.y+CELL/2,player.x,player.y) > 96*96)) setInvOpen(false);
    else { craftRefresh-=dt; if(craftRefresh<=0){ craftRefresh=0.25; renderInventory(); } }
  }
  if(craftOpen){
    if(!nearestStruct(craftStation,74)) setCraftOpen(false);
    else { craftRefresh-=dt; if(craftRefresh<=0){ craftRefresh=0.25; renderRecipes(); } }
  }

  // ground pickups: hold E to keep collecting
  if((held('interact')||vin.use) && !craftOpen) collectPickups();
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    if(!p.taking) continue;
    const dx=player.x-p.x, dy=player.y-p.y, d=Math.hypot(dx,dy)||0.001;
    if(d<12 && p.w){ // a dropped weapon goes into the bag
      if(canCarryWeapon(p.w.id)){
        player.spares.push(p.w);
        spawnFloat(player.x, player.y-34, '+ '+WEAPONS[p.w.id].name, '#c8d2d6');
        sfx.pickup();
        pickups.splice(i,1);
      } else p.taking = false;
    } else if(d<12){
      // take what fits; a leftover stays where the player stands
      const n = takeItem(p.type,p.amt,player.x+rr(-10,10),player.y-28-rr(0,12));
      if(n>0) sfx.pickup();
      p.amt -= n;
      if(p.amt<=0) pickups.splice(i,1); else p.taking = false;
    } else {
      const sp=Math.max(260,d*9);
      p.x+=dx/d*sp*dt; p.y+=dy/d*sp*dt;
    }
  }

  // bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.life -= dt;
    let dead = b.life<=0;
    // sub-step so fast rounds can't skip over walls or zombies
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx,b.vy)*dt/10));
    for(let s=0; s<steps && !dead; s++){
      b.x += b.vx*dt/steps; b.y += b.vy*dt/steps;
      if(b.x<0||b.x>WORLD_W||b.y<0||b.y>WORLD_H){ dead=true; break; }
      if(b.flame) b.r = 6+10*(1-b.life/b.max);
      const ci=cellIdx(b.x,b.y);
      if(ci>=0 && staticBlock[ci]){
        for(const h of houses){ for(const w of h.walls){ if(b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h){ dead=true; break; } } if(dead) break; }
        if(!dead) for(const o of obstacles){ const r=obstacleRect(o); if(b.x>r.x&&b.x<r.x+r.w&&b.y>r.y&&b.y<r.y+r.h){ dead=true; break; } }
        if(dead){ spawnParticles(b.x,b.y,3,'#cfc7a8',90,0.25,2.5); break; }
      }
      for(const z of zombies){
        if(!z.alive || (b.hit && b.hit.indexOf(z)>=0)) continue;
        if(dist2(b.x,b.y,z.x,z.y) < (z.r+b.r)*(z.r+b.r)){
          if(!b.ex) damageZombie(z, b.dmg, b.flame?0:40);
          if(b.pierce>0){ b.pierce--; (b.hit||(b.hit=[])).push(z); }
          else dead = true;
          break;
        }
      }
    }
    if(dead){
      bullets.splice(i,1);
      if(b.ex) explode(clamp(b.x,0,WORLD_W), clamp(b.y,0,WORLD_H), b.ex, b.dmg);
    }
  }
  if(gameState!=='playing') return;

  // thrown grenades / molotovs, burning ground, blast flashes
  for(let i=thrown.length-1;i>=0;i--){
    const t=thrown[i];
    t.t += dt/t.dur;
    const k=Math.min(1,t.t);
    t.x = t.x0+(t.tx-t.x0)*k; t.y = t.y0+(t.ty-t.y0)*k;
    if(k>=1){ thrown.splice(i,1); landThrown(t); }
  }
  if(gameState!=='playing') return;
  for(let i=fires.length-1;i>=0;i--){
    const f=fires[i];
    f.life -= dt; f.tick -= dt;
    if(f.life<=0){ fires.splice(i,1); continue; }
    if(rng()<dt*30){
      const a=rr(0,Math.PI*2), d=rr(0,f.r*0.85);
      particles.push({x:f.x+Math.cos(a)*d,y:f.y+Math.sin(a)*d,vx:rr(-10,10),vy:rr(-70,-30),life:0.6,max:0.6,color:pick(['#f0c85a','#e8843a','#e8642a']),size:rr(2,5)});
    }
    if(f.tick<=0){
      f.tick = 0.4;
      for(const z of zombies){ if(z.alive && dist2(z.x,z.y,f.x,f.y) < (f.r+z.r)*(f.r+z.r)) damageZombie(z, MOLOTOV.dmg, 0); }
      if(dist2(player.x,player.y,f.x,f.y) < f.r*f.r*0.7){ hurtPlayer(4); if(gameState!=='playing') return; }
    }
  }
  for(let i=blasts.length-1;i>=0;i--){ blasts[i].life -= dt; if(blasts[i].life<=0) blasts.splice(i,1); }
  for(let i=tracers.length-1;i>=0;i--){ tracers[i].life -= dt; if(tracers[i].life<=0) tracers.splice(i,1); }
  updateHazards(dt);
  if(gameState!=='playing') return;
  updateEShots(dt);
  if(gameState!=='playing') return;

  // spawning
  spawnTimer -= dt;
  const aliveCount = zombies.reduce((n,z)=>n+(z.alive?1:0),0);
  const cap = Math.min(90, Math.round((20+day*5+(night?8:0))*diff().cap));
  if(spawnTimer<=0 && aliveCount < cap && !admin.noSpawn){
    const early = (day===1 && !night) ? 2.5 : 1; // sparse first daytime
    spawnTimer = Math.max(0.7, 4.0-day*0.35) * early / (night?2.2:1) / diff().spawn;
    const batch = 1 + (night && day>=3 ? 1 : 0);
    for(let i=0;i<batch;i++) spawnZombie();
  }
  if(zombies.length > 120) zombies = zombies.filter(z=>z.alive);

  // flow field
  flowTimer -= dt;
  if(flowTimer<=0){ flowTimer=0.3; computeFlow(); }

  // zombie AI
  for(const z of zombies){
    if(!z.alive) continue;
    if(z.flash>0) z.flash-=dt;
    z.atkCd -= dt; z.spikeCd -= dt;
    if(z.kind==='egg'){ updateEgg(z,dt); continue; }
    const pdx = player.x-z.x, pdy = player.y-z.y;
    const pd = Math.hypot(pdx,pdy) || 0.001;
    if(pd>LEASH){
      if(z.kind!=='boss'){ z.alive=false; continue; }
      const p=findSpawnSpot(700); z.x=p.x; z.y=p.y; continue;
    }
    let tx=player.x, ty=player.y;
    z.nc=-1;
    if(pd>46){
      const cx=Math.floor(z.x/CELL), cy=Math.floor(z.y/CELL);
      const ci=cy*GW+cx;
      let best=(ci>=0&&ci<distField.length)?distField[ci]:Infinity, bi=-1;
      for(let n=0;n<8;n++){
        const dx=NB[n][0], dy=NB[n][1], nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>=GW||ny>=GH) continue;
        if(dx&&dy && (cellSolid(cx+dx,cy)||cellSolid(cx,cy+dy))) continue;
        const v=distField[ny*GW+nx];
        if(v<best){ best=v; bi=ny*GW+nx; }
      }
      if(bi>=0){
        z.nc=bi;
        tx=(bi%GW)*CELL+CELL/2+z.ox; ty=Math.floor(bi/GW)*CELL+CELL/2+z.oy;
      }
    }
    const dx=tx-z.x, dy=ty-z.y, d=Math.hypot(dx,dy)||0.001;
    let sp=z.speed*(night?1.1:1);
    if(z.kind==='boss'){
      const m = bossThink(z,dt,pd);
      if(gameState!=='playing') return;
      if(m<0) continue; // in the air
      sp *= m;
    }
    if(z.kind==='spewer'){ // stops at a distance and spits while it can see the player
      z.shotCd -= dt;
      if(pd<340 && clearShot(z.x,z.y,player)){
        if(pd<230) sp = 0;
        if(z.shotCd<=0){
          z.shotCd = rr(2.4,3.2);
          bossShot(z, Math.atan2(pdy,pdx)+rr(-0.06,0.06), 290, 1.5, 7, z.dmg, 'acid');
          sfx.spit();
        }
      }
    } else if(z.kind==='bloater' && z.fuse!=null){ // swelling: about to burst
      sp *= 0.3;
      z.fuse -= dt;
      z.flash = Math.sin(z.fuse*40)>0 ? 0.05 : 0;
      if(z.fuse<=0){
        bloaterPop(z);
        if(gameState!=='playing') return;
        continue;
      }
    }
    const here=structGrid[cellIdx(z.x,z.y)];
    if(here && here.def.id==='mine'){
      removeStruct(here);
      explode(here.x+CELL/2, here.y+CELL/2, MINE.radius, MINE.dmg);
      if(gameState!=='playing') return;
      if(!z.alive) continue;
    } else if(here && here.def.id==='spikes'){
      sp*=0.45;
      if(z.spikeCd<=0){
        z.spikeCd=0.5;
        damageZombie(z,14);
        here.hp-=2;
        if(here.hp<=0){ removeStruct(here); spawnParticles(here.x+20,here.y+20,10,'#8fa0a8',120,0.5,4); sfx.break(); }
        if(!z.alive) continue;
      }
    }
    z.x += dx/d*sp*dt;
    z.y += dy/d*sp*dt;
    z.angle += normAngle((z.face!=null ? z.face : Math.atan2(dy,dx))-z.angle)*Math.min(1,dt*10);
    const hit = collideStructs(z,true,z.nc);
    collideWithWorld(z);
    if(z.kind==='bloater'){ // no bite: it lights its fuse against a wall or next to the player
      if(z.fuse==null && (hit || pd < z.r+player.r+26)){ z.fuse = 0.6; if(pd<700) sfx.hatch(); }
      continue;
    }
    // the boss is too wide for one-cell gaps, so it smashes anything it touches
    if(hit && z.atkCd<=0 && (z.nc<0 || hit.cell===z.nc || z.kind==='boss')){
      z.atkCd=0.7;
      damageStruct(hit,z.sdmg);
      sfx.thud();
    }
    if(pd < z.r+player.r+6 && z.atkCd<=0){
      z.atkCd = 0.7;
      hurtPlayer(z.dmg);
      if(gameState!=='playing') return;
    }
  }
  // separation between zombies
  for(let i=0;i<zombies.length;i++){
    const a = zombies[i]; if(!a.alive) continue;
    for(let j=i+1;j<zombies.length;j++){
      const b = zombies[j]; if(!b.alive) continue;
      const dx=b.x-a.x, dy=b.y-a.y;
      const d2v = dx*dx+dy*dy;
      const minD = a.r+b.r;
      if(d2v < minD*minD && d2v>0.001){
        const d = Math.sqrt(d2v);
        const push = (minD-d)*0.5;
        a.x -= dx/d*push; a.y -= dy/d*push;
        b.x += dx/d*push; b.y += dy/d*push;
      }
    }
  }

  // campfires warm and heal
  for(const s of structures){
    if(s.alarm>0) s.alarm -= dt;
    if(s.def.id==='turret') updateTurret(s,dt);
    if(s.def.id!=='campfire') continue;
    if(dist2(s.x+20,s.y+20,player.x,player.y) < 120*120 && player.hp<player.maxHp){
      player.hp=Math.min(player.maxHp,player.hp+dt*2);
    }
    if(rng()<dt*14) particles.push({x:s.x+20+rr(-5,5),y:s.y+18,vx:rr(-8,8),vy:rr(-50,-25),life:0.7,max:0.7,color:pick(['#f0c85a','#e8843a','#d9a528']),size:rr(2,4)});
  }

  // building interior flags + roof fade
  for(const h of houses){
    h.playerInside = player.x > h.x && player.x < h.x+h.w && player.y > h.y && player.y < h.y+h.h;
    const target = h.playerInside ? 0 : 1;
    h.roofA += clamp(target-h.roofA,-dt*5,dt*5);
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.92; p.vy*=0.92; p.life-=dt;
    if(p.life<=0) particles.splice(i,1);
  }
  for(let i=floatingTexts.length-1;i>=0;i--){
    const f = floatingTexts[i];
    f.y += f.vy*dt; f.life -= dt*1.1;
    if(f.life<=0) floatingTexts.splice(i,1);
  }

  if(shakeTime>0) shakeTime -= dt;
  if(muzzleFlash>0) muzzleFlash -= dt;
  if(toastTimer>0){ toastTimer-=dt; if(toastTimer<=0) el.toast.classList.remove('show'); }

  updateHUD();
}

function triggerGameOver(){
  gameState = 'gameover';
  setBuildMode(false); setCraftOpen(false); setInvOpen(false);
  refreshSaveUI();
  document.getElementById('finalLevel').textContent = player.level;
  document.getElementById('finalDay').textContent = day;
  document.getElementById('finalTime').textContent = fmtTime(survivalTime);
  document.getElementById('finalKills').textContent = killCount;
  document.getElementById('finalLoot').textContent = totalLoot;
  document.getElementById('respawnBtn').classList.toggle('hidden', !activeOutpost());
  document.getElementById('overOverlay').classList.remove('hidden');
}

function fmtTime(s){
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}
