'use strict';

/* ============================================================
   BOSSES — five mutants, each a small state machine.
   z.st = state, z.t = seconds in it, z.w = its length (wind-ups are drawn as
   telegraphs from t/w), z.cd = pause before the next attack, z.stage = how many
   health thresholds (stages) it has dropped through; every stage adds patterns.
============================================================ */
const TAU = Math.PI*2;
const BOSS_ORDER = ['butcher','spitter','brood','lasher','titan']; // one per boss night, in this order
const BOSSES = {
  butcher:{name:'도살자',     sub:'돌진을 벽으로 유도하면 기절합니다',        r:32, hp:800,  speed:78, dmg:28, sdmg:60, xp:250, skin:'#8a5560', cloth:'#3a1c24', stages:[0.5]},
  spitter:{name:'부식체',     sub:'산성 웅덩이를 피해 거리를 좁히세요',       r:28, hp:600,  speed:66, dmg:18, sdmg:30, xp:260, skin:'#6f7a4a', cloth:'#3f4a2a', stages:[0.5]},
  brood:  {name:'산란 모체',  sub:'알이 부화하기 전에 터뜨리세요',            r:30, hp:680,  speed:92, dmg:22, sdmg:40, xp:280, skin:'#5a4058', cloth:'#3a2438', stages:[0.5]},
  lasher: {name:'채찍 군체',  sub:'촉수에 붙잡히면 끌려갑니다',               r:30, hp:760,  speed:60, dmg:24, sdmg:45, xp:300, skin:'#7a3048', cloth:'#4a1c2c', stages:[0.5]},
  titan:  {name:'역병의 왕',  sub:'갑각은 단단합니다 — 공격 직후 드러나는 핵을 노리세요', r:40, hp:1000, speed:56, dmg:34, sdmg:90, xp:500, skin:'#b8ac90', cloth:'#3a3040', stages:[0.66,0.33]},
};
// r,g,b of each kind of telegraph / pool / projectile
const HAZ_COL = {acid:'184,224,74', flesh:'224,75,110', bone:'232,220,190', rock:'224,140,75', web:'220,224,235', spore:'160,110,210'};
const LASH_R = 205, LASH_HALF = 1.45; // reach and half-angle of the lasher's sweep

function makeBoss(type,scale){
  const d = BOSSES[type] || BOSSES.butcher, tier = Math.max(1, Math.floor(day/BOSS_EVERY));
  return initBoss({kind:'boss', boss:type, r:d.r, hp:d.hp*scale*(1+0.25*(tier-1)), speed:d.speed, dmg:d.dmg, sdmg:d.sdmg, skin:d.skin, cloth:d.cloth});
}
// Fills in the state a boss needs; also repairs bosses from saves made before they had patterns.
function initBoss(z){
  if(!BOSSES[z.boss]) z.boss = 'butcher';
  if(!z.st){ z.st='idle'; z.t=0; z.w=0; z.cd=2.5; z.stage=0; z.roarCd=9; z.last=''; z.aim=0; z.n=0; z.e=0; z.vent=0; z.dir=1; z.air=false; }
  return z;
}
// Eggs and the crawlers that hatch from them.
function spawnMinion(kind,x,y){
  const scale = (1 + 0.12*(day-1))*diff().zHp;
  const z = kind==='egg'
    ? {kind, r:12, hp:26*scale, speed:0, dmg:0, sdmg:0, skin:'#d8c9a0', cloth:'#7a3048', hatch:rr(4,5)}
    : {kind, r:10, hp:20*scale, speed:rr(150,180), dmg:Math.max(1,Math.round(5*diff().zDmg)), sdmg:4, skin:'#b89aa4', cloth:'#4a3a4a'};
  z.x=clamp(x,20,WORLD_W-20); z.y=clamp(y,20,WORLD_H-20); z.maxHp=z.hp; z.alive=true; z.atkCd=0.4; z.spikeCd=0; z.phase=rr(0,10);
  z.angle=rr(0,TAU); z.flash=0; z.nc=-1; z.ox=rr(-7,7); z.oy=rr(-7,7);
  collideStructs(z,true,-1); collideWithWorld(z);
  zombies.push(z);
  return z;
}
function updateEgg(z,dt){
  z.hatch -= dt;
  if(z.hatch>0) return;
  z.alive = false;
  spawnMinion('crawler',z.x,z.y);
  spawnParticles(z.x,z.y,8,'#d8c9a0',130,0.5,4);
  if(dist2(z.x,z.y,player.x,player.y) < 600*600) sfx.hatch();
}

/* ---------- shared attack pieces ---------- */
function bossSet(z,st,wind){ z.st=st; z.t=0; z.w=wind||0; z.hitP=false; }
// Attack over: a short recovery, then `cd` seconds of walking before the next one.
function bossEnd(z,pause,cd){
  z.rcd = cd; bossSet(z,'recover',pause);
  if(z.boss==='titan') z.vent = pause+2.2; // the core opens while it catches its breath
}
function bossRest(z,cd){ z.st='idle'; z.t=0; z.w=0; z.cd=cd*(1-0.18*z.stage); }
function bossPick(z,opts){
  if(!opts.length) return '';
  const o = opts.filter(a=>a!==z.last);
  return z.last = pick(o.length ? o : opts);
}
// Damage multiplier: the titan's carapace, and anything stunned or with its core open takes more.
function bossArmor(z){ return z.boss==='titan' ? (z.vent>0 ? 1.5 : 0.5) : (z.st==='stun' ? 1.5 : 1); }
// Where the player will be in t seconds if they keep walking (k<1 leads less).
function leadPos(t,k){
  if(!player.moving) return {x:player.x, y:player.y};
  const d = PLAYER_SPEED*speedMul()*t*k;
  return {x:clamp(player.x+Math.cos(player.moveAngle)*d,20,WORLD_W-20), y:clamp(player.y+Math.sin(player.moveAngle)*d,20,WORLD_H-20)};
}
function pushPlayer(a,d){
  const n = Math.ceil(d/10);
  for(let i=0;i<n;i++){
    player.x += Math.cos(a)*d/n; player.y += Math.sin(a)*d/n;
    collideStructs(player,false,-1); collideWithWorld(player);
  }
}
function slowPlayer(t){
  if(!(player.slow>0)) spawnFloat(player.x,player.y-40,'둔화!','#c8d2e8');
  player.slow = Math.max(player.slow||0, t);
}
// Same test the player's bullets use: solid world geometry at this point?
function shotBlocked(x,y){
  const ci = cellIdx(x,y);
  if(ci<0) return true;
  if(!staticBlock[ci]) return false;
  for(const h of houses){
    if(x<h.x-30||x>h.x+h.w+30||y<h.y-30||y>h.y+h.h+30) continue;
    for(const w of h.walls) if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h) return true;
  }
  for(const o of obstacles){
    if(Math.abs(x-o.x)>130||Math.abs(y-o.y)>130) continue;
    const r = obstacleRect(o);
    if(x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h) return true;
  }
  return false;
}
function smashStructs(x,y,r,sdmg,test){
  const x0=Math.max(0,Math.floor((x-r)/CELL)), x1=Math.min(GW-1,Math.floor((x+r)/CELL));
  const y0=Math.max(0,Math.floor((y-r)/CELL)), y1=Math.min(GH-1,Math.floor((y+r)/CELL));
  for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){
    const s = structGrid[cy*GW+cx];
    if(!s) continue;
    const sx=s.x+CELL/2, sy=s.y+CELL/2;
    if(dist2(sx,sy,x,y) > r*r || (test && !test(sx,sy))) continue;
    damageStruct(s,sdmg);
  }
}
// hazards: burst = a telegraphed circle (or ring, with r0) that goes off after `delay`;
//          pool  = lingering ground that hurts on a tick; ring / spike = the flash left by a burst.
// o: {r0, pool:seconds of pool left behind, lob:{x,y} where the glob was thrown from, spike:true}
function hazBurst(x,y,r,delay,dmg,sdmg,type,o){
  hazards.push(Object.assign({k:'burst',x:clamp(x,0,WORLD_W),y:clamp(y,0,WORLD_H),r,t:0,delay,dmg,sdmg,type},o));
}
function hazPool(x,y,r,life,dmg,type,homing){
  hazards.push({k:'pool',x,y,r,life,max:life,tick:0.3,dmg,type,homing:homing||0,phase:rr(0,6)});
}
function hazRing(x,y,r,type,r0){ hazards.push({k:'ring',x,y,r,r0:r0||0,life:0.45,max:0.45,type}); }
// The hit itself: everything inside r (outside r0) is struck.
function bossBlast(x,y,r,dmg,sdmg,type,r0){
  hazRing(x,y,r,type,r0);
  spawnParticles(x,y,16,'rgb('+HAZ_COL[type]+')',r*1.5,0.5,5);
  if(dist2(x,y,player.x,player.y) < 750*750){
    shakeTime = 0.25; shakeMag = Math.min(9,3+r/40);
    (type==='acid' ? sfx.splat : sfx.slam)();
  }
  if(sdmg) smashStructs(x,y,r,sdmg);
  const pd = Math.hypot(player.x-x,player.y-y);
  if(pd < r+player.r*0.4 && pd >= (r0||0) && gameState==='playing') hurtPlayer(dmg);
}
function bossShot(z,a,speed,life,r,dmg,type,slow){
  eshots.push({x:z.x+Math.cos(a)*z.r, y:z.y+Math.sin(a)*z.r, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
               life, max:life, r, dmg, type, slow:slow||0});
}
function bossSummon(z,n,pd){
  for(let i=0;i<n;i++){
    spawnZombie(0);
    const m = zombies[zombies.length-1];
    m.x = clamp(z.x+rr(-70,70), 20, WORLD_W-20); m.y = clamp(z.y+rr(-70,70), 20, WORLD_H-20);
  }
  spawnParticles(z.x,z.y,20,z.skin,220,0.7,5);
  sfx.roar();
  if(pd<700){ shakeTime = 0.3; shakeMag = 5; spawnFloat(z.x,z.y-z.r-20,'포효!','#e04b4b'); }
}
// Dropped through a health threshold: faster, angrier, more patterns.
function bossEnrage(z,pd){
  spawnFloat(z.x,z.y-z.r-26,'격노!','#e04b4b');
  hazRing(z.x,z.y,190,'flesh');
  spawnParticles(z.x,z.y,26,z.skin,260,0.8,6);
  sfx.roar();
  if(pd<800){ shakeTime = 0.45; shakeMag = 7; }
  z.cd = Math.min(z.cd,0.8);
  if(z.boss==='titan') bossSummon(z,4,pd);
  if(z.boss==='brood') for(let i=0;i<3;i++) spawnMinion('egg',z.x+rr(-60,60),z.y+rr(-60,60));
}
function bossDeath(z){
  hazRing(z.x,z.y,220,'flesh');
  if(z.boss==='spitter'){ // the sac bursts
    for(let i=0;i<6;i++){
      const a=i/6*TAU+rr(0,0.5), d=i?rr(60,150):0;
      hazBurst(z.x+Math.cos(a)*d, z.y+Math.sin(a)*d, 60, 0.5+i*0.1, z.dmg*0.9, 20, 'acid', {pool:5});
    }
  }
  if(z.boss==='brood') zombies.forEach(m=>{ if(m.alive && m.kind==='egg'){ m.alive=false; spawnParticles(m.x,m.y,8,'#d8c9a0',120,0.5,4); } });
  if(z.boss==='titan') hazards = hazards.filter(h=>!h.homing);
}

/* ---------- per-frame: hazards and enemy projectiles ---------- */
function updateHazards(dt){
  if(player.slow>0) player.slow -= dt;
  for(let i=hazards.length-1;i>=0;i--){
    const h = hazards[i];
    if(h.k==='ring' || h.k==='spike'){ h.life -= dt; if(h.life<=0) hazards.splice(i,1); continue; }
    if(h.k==='burst'){
      h.t += dt;
      if(h.t < h.delay) continue;
      hazards.splice(i,1);
      if(h.spike) hazards.push({k:'spike',x:h.x,y:h.y,r:h.r,life:0.55,max:0.55,type:h.type});
      if(h.pool) hazPool(h.x,h.y,h.r,h.pool,h.dmg*0.35,h.type);
      bossBlast(h.x,h.y,h.r,h.dmg,h.sdmg,h.type,h.r0);
      if(gameState!=='playing') return;
      continue;
    }
    h.life -= dt; h.tick -= dt;
    if(h.life<=0){ hazards.splice(i,1); continue; }
    if(h.homing){ // spore clouds drift after the player
      const a = Math.atan2(player.y-h.y,player.x-h.x);
      h.x += Math.cos(a)*h.homing*dt; h.y += Math.sin(a)*h.homing*dt;
    }
    if(rng()<dt*6){
      const a=rr(0,TAU), d=rr(0,h.r*0.8);
      particles.push({x:h.x+Math.cos(a)*d,y:h.y+Math.sin(a)*d,vx:rr(-8,8),vy:rr(-40,-15),life:0.6,max:0.6,color:'rgb('+HAZ_COL[h.type]+')',size:rr(2,4)});
    }
    if(h.tick<=0){
      h.tick = 0.5;
      if(h.type==='acid') smashStructs(h.x,h.y,h.r*0.8,6); // acid eats through barricades
      if(dist2(player.x,player.y,h.x,h.y) < h.r*h.r*0.75){
        hurtPlayer(h.dmg);
        if(h.type==='spore') slowPlayer(0.7);
        if(gameState!=='playing') return;
      }
    }
  }
}
function updateEShots(dt){
  for(let i=eshots.length-1;i>=0;i--){
    const s = eshots[i];
    s.life -= dt; s.x += s.vx*dt; s.y += s.vy*dt;
    let dead = s.life<=0 || shotBlocked(s.x,s.y);
    if(!dead){
      const st = structGrid[cellIdx(s.x,s.y)];
      if(st && st.def.blockZ){ damageStruct(st,8); dead = true; }
      else if(dist2(s.x,s.y,player.x,player.y) < (s.r+player.r)*(s.r+player.r)){
        dead = true;
        hurtPlayer(s.dmg);
        if(s.slow && gameState==='playing') slowPlayer(s.slow);
      }
    }
    if(dead){
      eshots.splice(i,1);
      spawnParticles(s.x,s.y,4,'rgb('+HAZ_COL[s.type]+')',90,0.3,3);
      if(gameState!=='playing') return;
    }
  }
}

/* ---------- AI ----------
   Returns the walking-speed multiplier for this frame (0 = stand still, the boss
   may have moved itself), or -1 while it is in the air and the rest of the
   zombie update (collision, contact damage) has to be skipped. */
function bossThink(z,dt,pd){
  const th = BOSSES[z.boss].stages[z.stage];
  if(th!==undefined && z.hp <= z.maxHp*th){ z.stage++; bossEnrage(z,pd); }
  z.t += dt; z.cd -= dt;
  if(z.vent>0) z.vent -= dt;
  z.face = null; // set by a state to turn toward something other than the walk direction
  if(z.st==='recover'){ if(z.t>=z.w) bossRest(z,z.rcd); return 0; }
  return BOSS_AI[z.boss](z,dt,pd,Math.atan2(player.y-z.y,player.x-z.x));
}
function startLeap(z,wind){
  const p = leadPos(0.6,0.7);
  let dx=p.x-z.x, dy=p.y-z.y;
  const d = Math.hypot(dx,dy)||1, m = Math.min(d,540);
  z.tx = z.x+dx/d*m; z.ty = z.y+dy/d*m;
  bossSet(z,'leap',wind);
}
function startSweep(z,ang,wind){ z.dir = z.dir>0 ? -1 : 1; z.aim = ang; z.pk = 0; bossSet(z,'sweep',wind); }

const BOSS_AI = {
  // 도살자: charge (stunned if it rams something solid), ground slam, hurled rubble, roar for a pack
  butcher(z,dt,pd,ang){
    const mad = z.stage>0, st = z.st;
    if(st==='idle'){
      z.roarCd -= dt;
      if(z.roarCd<=0){ z.roarCd = 14; bossSummon(z,3,pd); }
      if(z.cd<=0){
        const o = [];
        if(pd<240) o.push('slam');
        if(pd>150 && pd<680) o.push('charge');
        if(pd>260 && pd<760) o.push('hurl');
        const a = bossPick(z,o);
        if(a){
          z.aim = ang;
          bossSet(z,a, a==='charge' ? (mad?0.65:0.85) : (a==='slam' ? (mad?0.7:0.9) : 0.7));
          if(a==='charge') sfx.roar();
        }
      }
      return mad ? 1.3 : 1;
    }
    if(st==='charge'){ // wind-up: follows the player, then commits to the line
      if(z.t < z.w-0.22) z.aim += normAngle(ang-z.aim)*Math.min(1,dt*7);
      z.face = z.aim;
      if(z.t>=z.w) bossSet(z,'dash');
      return 0;
    }
    if(st==='dash'){
      const step = (mad?760:640)*dt, ox=z.x, oy=z.y;
      z.face = z.aim;
      z.x += Math.cos(z.aim)*step; z.y += Math.sin(z.aim)*step;
      const hit = collideStructs(z,true,-1);
      if(hit){ damageStruct(hit,z.sdmg*5); sfx.thud(); }
      collideWithWorld(z);
      if(rng()<dt*40) spawnParticles(z.x,z.y,2,'#8a7a5a',80,0.4,5);
      if(!z.hitP && dist2(z.x,z.y,player.x,player.y) < (z.r+player.r+12)*(z.r+player.r+12)){
        z.hitP = true; z.atkCd = 0.6;
        const side = Math.sin(Math.atan2(player.y-z.y,player.x-z.x)-z.aim) > 0 ? 1 : -1;
        hurtPlayer(z.dmg*1.6);
        if(gameState==='playing') pushPlayer(z.aim+side*0.9,100);
      }
      // stopped dead by a house wall, a rock or a barricade that held
      if(Math.hypot(z.x-ox,z.y-oy) < step*0.45 && !(hit && hit.hp<=0)){
        bossSet(z,'stun');
        spawnFloat(z.x,z.y-z.r-22,'기절!','#f0c85a');
        spawnParticles(z.x,z.y,18,'#cfc7a8',200,0.6,5);
        sfx.slam(); shakeTime = 0.3; shakeMag = 7;
      } else if(z.t>=0.8) bossEnd(z,0.35,2);
      return 0;
    }
    if(st==='stun'){ if(z.t>=1.7) bossRest(z,1); return 0; }
    if(st==='slam'){
      z.face = z.aim;
      if(z.t>=z.w){
        bossBlast(z.x,z.y,175,z.dmg*1.5,z.sdmg*2,'rock');
        if(mad) hazBurst(z.x,z.y,310,0.6,z.dmg*1.2,z.sdmg,'rock',{r0:170}); // aftershock: safe only close in
        bossEnd(z,0.5,2.1);
      }
      return 0;
    }
    // hurl: rubble lobbed over walls
    z.face = ang;
    if(z.t>=z.w){
      for(let i=0;i<(mad?3:1);i++){
        const p = leadPos(0.9, i ? rr(0,1.5) : 0.9);
        hazBurst(p.x+(i?rr(-80,80):0), p.y+(i?rr(-80,80):0), 82, 0.9, z.dmg*1.1, z.sdmg, 'rock', {lob:{x:z.x,y:z.y}});
      }
      sfx.whip();
      bossEnd(z,0.4,1.9);
    }
    return 0;
  },

  // 부식체: keeps its distance; lobbed acid that leaves pools, a sweeping spray, and a point-blank nova
  spitter(z,dt,pd,ang){
    const mad = z.stage>0, st = z.st;
    if(st==='idle'){
      z.face = ang;
      if(mad){ z.e -= dt; if(z.e<=0){ z.e = 1; hazPool(z.x,z.y,36,4.5,z.dmg*0.25,'acid'); } } // dripping trail
      if(z.cd<=0){
        const o = [];
        if(pd<720) o.push('lob');
        if(pd<430) o.push('spray');
        if(mad && pd<270) o.push('nova');
        const a = bossPick(z,o);
        if(a){ z.aim = ang; z.n = 0; bossSet(z,a, a==='lob' ? 0.55 : (a==='spray' ? 0.75 : 0.65)); sfx.spit(); return 0; }
      }
      if(pd<210){ z.x -= Math.cos(ang)*z.speed*0.9*dt; z.y -= Math.sin(ang)*z.speed*0.9*dt; return 0; } // backs off
      return pd>400 ? 1 : 0;
    }
    if(st==='lob'){
      z.face = ang;
      if(z.t>=z.w){
        for(let i=0;i<(mad?3:1);i++){
          const p = leadPos(0.85, i ? rr(0,1.6) : 1);
          hazBurst(p.x+(i?rr(-90,90):0), p.y+(i?rr(-90,90):0), 62, 0.85, z.dmg*0.9, 22, 'acid', {pool:6, lob:{x:z.x,y:z.y}});
        }
        sfx.spit();
        if(++z.n < (mad?3:2)) bossSet(z,'lob',0.5); else bossEnd(z,0.3,1.7);
      }
      return 0;
    }
    if(st==='spray'){ z.face = z.aim; if(z.t>=z.w){ bossSet(z,'spraying',1.3); z.e = 0; } return 0; }
    if(st==='spraying'){ // the stream turns slowly: run around it, not away from it
      z.aim += clamp(normAngle(ang-z.aim),-1.1*dt,1.1*dt); z.face = z.aim;
      z.e -= dt;
      while(z.e<=0){ z.e += 0.045; bossShot(z,z.aim+rr(-0.3,0.3),rr(360,450),0.95,7,z.dmg*0.28,'acid'); }
      if(rng()<dt*10) sfx.flame();
      if(z.t>=z.w) bossEnd(z,0.3,1.8);
      return 0;
    }
    // nova
    z.face = ang;
    if(z.t>=z.w){
      const N = 18, off = z.n ? Math.PI/N : 0;
      for(let i=0;i<N;i++) bossShot(z,off+i/N*TAU,260,1.3,7,z.dmg*0.55,'acid');
      sfx.splat();
      if(z.n++ < 1) bossSet(z,'nova',0.35);
      else { hazPool(z.x,z.y,80,5,z.dmg*0.3,'acid'); bossEnd(z,0.3,2); }
    }
    return 0;
  },

  // 산란 모체: lays eggs that hatch into crawlers, pounces, and spits slowing webs
  brood(z,dt,pd,ang){
    const mad = z.stage>0, st = z.st;
    if(st==='idle'){
      if(z.cd<=0){
        const o = [];
        if(zombies.reduce((n,m)=>n+(m.alive && (m.kind==='egg'||m.kind==='crawler') ? 1 : 0),0) < 9) o.push('lay');
        if(pd>140 && pd<560) o.push('leap');
        if(pd>110 && pd<620) o.push('web');
        const a = bossPick(z,o);
        if(a==='leap'){ z.n = 0; startLeap(z, mad?0.5:0.65); }
        else if(a){ z.aim = ang; bossSet(z,a, a==='lay' ? 0.8 : 0.45); }
      }
      return mad ? 1.2 : 1;
    }
    if(st==='lay'){
      if(z.t>=z.w){
        for(let i=0;i<3+z.stage;i++){
          const a = z.angle+Math.PI+rr(-1.2,1.2), d = z.r+rr(14,46);
          spawnMinion('egg',z.x+Math.cos(a)*d,z.y+Math.sin(a)*d);
        }
        spawnParticles(z.x,z.y,12,'#d8c9a0',140,0.5,4);
        sfx.hatch();
        bossEnd(z,0.4,2);
      }
      return 0;
    }
    if(st==='leap'){
      z.face = Math.atan2(z.ty-z.y,z.tx-z.x);
      if(z.t>=z.w){ z.sx = z.x; z.sy = z.y; z.air = true; bossSet(z,'air',0.55); sfx.screech(); }
      return 0;
    }
    if(st==='air'){
      const k = Math.min(1,z.t/z.w);
      z.x = z.sx+(z.tx-z.sx)*k; z.y = z.sy+(z.ty-z.sy)*k;
      if(k<1) return -1;
      z.air = false;
      collideStructs(z,true,-1); collideWithWorld(z);
      bossBlast(z.x,z.y,108,z.dmg*1.4,z.sdmg*2,'flesh');
      if(mad && z.n<1 && gameState==='playing'){ z.n++; startLeap(z,0.45); } else bossEnd(z,0.45,1.8);
      return 0;
    }
    // web
    z.face = ang;
    if(z.t>=z.w){
      const n = mad ? 5 : 3;
      for(let i=0;i<n;i++) bossShot(z,ang+(i-(n-1)/2)*0.2,540,1.2,8,z.dmg*0.3,'web',2.6);
      sfx.spit();
      bossEnd(z,0.3,1.5);
    }
    return 0;
  },

  // 채찍 군체: a wide tentacle sweep, tendrils erupting under the player's feet, and a hook that drags them in
  lasher(z,dt,pd,ang){
    const mad = z.stage>0, st = z.st;
    if(st==='idle'){
      if(z.cd<=0){
        const o = [];
        if(pd<230) o.push('sweep');
        if(pd>120 && pd<800) o.push('erupt');
        if(pd>190 && pd<520) o.push('grab');
        const a = bossPick(z,o);
        z.n = 0;
        if(a==='sweep') startSweep(z,ang, mad?0.55:0.7);
        else if(a){ z.aim = ang; bossSet(z,a, a==='erupt' ? 0.5 : 0.6); }
      }
      return mad ? 1.25 : 1;
    }
    if(st==='sweep'){ z.face = z.aim; if(z.t>=z.w){ bossSet(z,'whip',0.38); sfx.whip(); } return 0; }
    if(st==='whip'){
      z.face = z.aim;
      // the limb travels from one edge of the fan to the other; whoever it passes over is hit
      const k = Math.min(1,z.t/z.w), a0 = -LASH_HALF+2*LASH_HALF*z.pk, a1 = -LASH_HALF+2*LASH_HALF*k;
      const rel = normAngle(ang-z.aim)*z.dir;
      z.pk = k;
      if(!z.hitP && pd < LASH_R+player.r && rel >= a0-0.15 && rel <= a1+0.15){
        z.hitP = true;
        hurtPlayer(z.dmg*1.2);
        if(gameState==='playing') pushPlayer(ang,80);
      }
      if(k>=1){
        smashStructs(z.x,z.y,LASH_R,z.sdmg,(sx,sy)=>Math.abs(normAngle(Math.atan2(sy-z.y,sx-z.x)-z.aim)) < LASH_HALF);
        if(mad && z.n<1){ z.n++; startSweep(z,ang,0.4); } else bossEnd(z,0.35,1.7); // backhand when enraged
      }
      return 0;
    }
    if(st==='erupt'){ if(z.t>=z.w){ bossSet(z,'erupting'); z.n = mad ? 8 : 5; z.e = 0; } return 0; }
    if(st==='erupting'){
      z.e -= dt;
      if(z.e<=0){
        z.e = 0.3;
        const p = leadPos(0.7,0.55);
        hazBurst(p.x+rr(-14,14), p.y+rr(-14,14), 50, 0.7, z.dmg*0.7, 24, 'flesh', {spike:true});
        sfx.rumble();
        if(--z.n<=0) bossEnd(z,0.5,1.6);
      }
      return 0;
    }
    if(st==='grab'){
      if(z.t < z.w-0.2) z.aim += normAngle(ang-z.aim)*Math.min(1,dt*8);
      z.face = z.aim;
      if(z.t>=z.w){ bossSet(z,'hook'); z.len = z.r; sfx.whip(); }
      return 0;
    }
    if(st==='hook'){ // the tendril shoots out; walls and barricades stop it
      z.face = z.aim;
      const steps = Math.max(1,Math.ceil(1100*dt/16));
      for(let i=0;i<steps;i++){
        z.len += 1100*dt/steps;
        const hx = z.x+Math.cos(z.aim)*z.len, hy = z.y+Math.sin(z.aim)*z.len;
        const s = structGrid[cellIdx(hx,hy)];
        if(dist2(hx,hy,player.x,player.y) < (player.r+18)*(player.r+18)){
          bossSet(z,'drag',1);
          spawnFloat(player.x,player.y-40,'붙잡혔다!','#e04b4b');
          hurtPlayer(z.dmg*0.35);
          return 0;
        }
        if(z.len>520 || shotBlocked(hx,hy) || (s && s.def.blockZ)){
          if(s && s.def.blockZ) damageStruct(s,z.sdmg);
          bossEnd(z,0.5,1.2);
          return 0;
        }
      }
      return 0;
    }
    // drag: reeled in, then struck
    z.face = ang; z.len = pd;
    if(pd > z.r+player.r+34 && z.t<z.w) pushPlayer(ang+Math.PI,470*dt);
    else { z.n = 1; startSweep(z,ang,0.42); }
    return 0;
  },

  // 역병의 왕: armoured except right after an attack. Rings of bone shards, fissures, drifting spore clouds, a stomp.
  titan(z,dt,pd,ang){
    const s = z.stage, st = z.st;
    if(st==='idle'){
      if(z.cd<=0){
        const o = ['spikes'];
        if(pd>140 && pd<780) o.push('fissure');
        if(pd<250) o.push('stomp','stomp');
        if(hazards.reduce((n,h)=>n+(h.homing?1:0),0) < 2) o.push('spore');
        const a = bossPick(z,o);
        z.aim = ang; z.n = 0; z.vent = 0; // the carapace closes as it attacks
        bossSet(z,a,{spikes:0.7,fissure:0.85,stomp:0.85,spore:0.6}[a]);
        sfx.groan(0.2);
      }
      return 1+0.12*s;
    }
    if(st==='spikes'){ if(z.t>=z.w){ bossSet(z,'volley'); z.n = 3+s; z.e = 0; } return 0; }
    if(st==='volley'){ // alternate rings are offset: stand in the gaps
      z.e -= dt;
      if(z.e<=0){
        z.e = 0.42;
        const N = 14, off = z.aim+(z.n%2)*Math.PI/N;
        for(let i=0;i<N;i++) bossShot(z,off+i/N*TAU,290,2,7,z.dmg*0.34,'bone');
        sfx.whip();
        if(--z.n<=0) bossEnd(z,0.5,2.6);
      }
      return 0;
    }
    if(st==='fissure'){
      if(z.t < z.w-0.3) z.aim += normAngle(ang-z.aim)*Math.min(1,dt*6);
      z.face = z.aim;
      if(z.t>=z.w){
        const n = 1+2*s;
        for(let i=0;i<n;i++){
          const a = z.aim+(i-(n-1)/2)*0.36;
          for(let j=1;j<=9;j++) hazBurst(z.x+Math.cos(a)*(60+j*68), z.y+Math.sin(a)*(60+j*68), 46, 0.1+j*0.07, z.dmg*0.7, 50, 'bone', {spike:true});
        }
        sfx.rumble();
        bossEnd(z,0.6,2.6);
      }
      return 0;
    }
    if(st==='stomp'){
      if(z.t>=z.w){
        bossBlast(z.x,z.y,205,z.dmg*1.3,z.sdmg*2,'rock');
        for(let i=0;i<12;i++) bossShot(z,i/12*TAU+0.26,300,1.6,7,z.dmg*0.34,'bone');
        if(s>=1) hazBurst(z.x,z.y,345,0.6,z.dmg,z.sdmg,'rock',{r0:200});
        bossEnd(z,0.6,2.6);
      }
      return 0;
    }
    // spore
    if(z.t>=z.w){
      for(let i=0;i<2;i++){
        const a = ang+(i?1:-1)*1.1;
        hazPool(z.x+Math.cos(a)*(z.r+30), z.y+Math.sin(a)*(z.r+30), 72, 9, z.dmg*0.13, 'spore', 46+7*s);
      }
      spawnParticles(z.x,z.y,20,'#a06ed2',200,0.8,5);
      sfx.spit();
      bossEnd(z,0.4,2.2);
    }
    return 0;
  },
};

/* ============================================================
   DRAWING
============================================================ */
function bDot(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }
// a closed, slowly breathing outline
function blobPath(rx,ry,amp,t,seed){
  ctx.beginPath();
  for(let i=0;i<=28;i++){
    const a=i/28*TAU, k=1+amp*Math.sin(a*3+t*2+seed)+amp*0.6*Math.sin(a*5-t*1.3+seed*2);
    const x=Math.cos(a)*rx*k, y=Math.sin(a)*ry*k;
    if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
  ctx.closePath();
}
function drawBoss(z){
  const sx = z.x-camera.x, sy = z.y-camera.y;
  if(sx<-280||sy<-280||sx>canvas.width+280||sy>canvas.height+280) return;
  const t = performance.now()/1000, R = z.r;
  const wk = z.w>0 ? clamp(z.t/z.w,0,1) : 0;
  let lift = 0;
  if(z.air) lift = Math.sin(wk*Math.PI);
  shadow(sx+4,sy+7,R*1.1*(1-lift*0.35),R*0.85*(1-lift*0.35));
  ctx.save();
  ctx.translate(sx,sy-lift*70);
  ctx.rotate(z.angle + (z.st==='stun' ? Math.sin(t*22)*0.07 : 0));
  ctx.scale(1+lift*0.25,1+lift*0.25);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  BOSS_DRAW[z.boss](z,R,t,z.flash>0 ? ()=>'#f0ead8' : col=>col,wk);
  ctx.restore();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  if(z.boss==='lasher') drawLasherLimb(z,sx,sy,t);
  if(z.st==='stun'){ // stars circling the head
    ctx.fillStyle = '#f0c85a';
    for(let i=0;i<3;i++){ const a=t*5+i*TAU/3; bDot(sx+Math.cos(a)*R*0.7, sy-R-10+Math.sin(a)*5, 3); }
  }
}
// c(colour) = the colour, or the hit flash; wk = progress of the current wind-up
const BOSS_DRAW = {
  butcher(z,R,t,c,wk){
    const sw = Math.sin(t*5+z.phase), st = z.st, mad = z.stage>0;
    ctx.fillStyle = '#1c1016';
    bDot(-R*0.1+sw*5,-R*0.5,R*0.26); bDot(-R*0.1-sw*5,R*0.5,R*0.26);
    // withered left arm
    ctx.strokeStyle = c('#6a4048'); ctx.lineWidth = R*0.2;
    ctx.beginPath(); ctx.moveTo(R*0.1,-R*0.8); ctx.quadraticCurveTo(R*0.7,-R*1.0,R*1.0,-R*0.5+sw*3); ctx.stroke();
    // right arm: overgrown, ending in a slab of bone
    const armA = st==='slam' ? 1.6*wk : (st==='hurl' ? 1.3*wk : (st==='recover' ? -0.4 : (st==='charge'||st==='dash' ? -0.3 : sw*0.12)));
    ctx.save();
    ctx.translate(-R*0.05,R*0.78); ctx.rotate(armA);
    ctx.strokeStyle = c(z.skin); ctx.lineWidth = R*0.52;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(R*0.95,R*0.12); ctx.stroke();
    ctx.fillStyle = c('#d8cdb0');
    ctx.beginPath(); ctx.moveTo(R*0.8,-R*0.14); ctx.lineTo(R*1.95,-R*0.34); ctx.lineTo(R*2.15,R*0.02); ctx.lineTo(R*1.8,R*0.34); ctx.lineTo(R*0.8,R*0.34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = settings.gore ? 'rgba(120,20,20,0.7)' : 'rgba(90,84,70,0.5)'; // blood on the cleaver, or just grime
    ctx.beginPath(); ctx.moveTo(R*1.4,-R*0.24); ctx.lineTo(R*1.95,-R*0.34); ctx.lineTo(R*2.15,R*0.02); ctx.lineTo(R*1.7,-R*0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
    // torso: dark hide split open over raw muscle
    blobPath(R*0.82,R,0.035,t,z.phase);
    ctx.fillStyle = c(z.cloth); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = c(z.skin);
    ctx.beginPath(); ctx.ellipse(R*0.05,R*0.25,R*0.6,R*0.62,0.2,0,TAU); ctx.fill();
    ctx.strokeStyle = c('#d8cdb0'); ctx.lineWidth = 2.4; // ribs through the left flank
    for(let i=0;i<4;i++){ ctx.beginPath(); ctx.arc(-R*0.25+i*R*0.17,-R*0.42,R*0.3,Math.PI*1.1,Math.PI*1.75); ctx.stroke(); }
    ctx.strokeStyle = '#1c1016'; ctx.lineWidth = 1.5; // stitches
    ctx.beginPath(); ctx.moveTo(-R*0.6,R*0.1); ctx.lineTo(R*0.5,-R*0.25);
    for(let i=0;i<5;i++){ const k=i/4, x=-R*0.6+R*1.1*k, y=R*0.1-R*0.35*k; ctx.moveTo(x-2,y-5); ctx.lineTo(x+2,y+5); }
    ctx.stroke();
    [[-0.45,0.55,0.2],[0.1,0.7,0.16],[-0.3,-0.15,0.13]].forEach((p,i)=>{ // tumours
      const pr = R*p[2]*(1+0.08*Math.sin(t*4+i*2));
      ctx.fillStyle = c('#b0707a'); bDot(p[0]*R,p[1]*R,pr);
      ctx.fillStyle = 'rgba(255,220,220,0.35)'; bDot(p[0]*R-pr*0.3,p[1]*R-pr*0.3,pr*0.35);
    });
    if(mad){ // veins lit from inside
      ctx.strokeStyle = 'rgba(255,90,58,'+(0.45+0.3*Math.sin(t*8))+')'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-R*0.5,R*0.5); ctx.lineTo(-R*0.1,R*0.3); ctx.lineTo(R*0.1,R*0.55); ctx.moveTo(-R*0.1,R*0.3); ctx.lineTo(R*0.2,-R*0.05); ctx.lineTo(R*0.45,R*0.1); ctx.stroke();
    }
    // small head, one swollen eye
    ctx.fillStyle = c('#9a6570'); bDot(R*0.5,-R*0.08,R*0.36);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(R*0.5,-R*0.08,R*0.36,0,TAU); ctx.stroke();
    ctx.fillStyle = '#1c1016'; ctx.beginPath(); ctx.ellipse(R*0.76,-R*0.02,R*0.08,R*0.17,0,0,TAU); ctx.fill();
    ctx.fillStyle = mad ? '#ff5a3a' : '#f0c85a'; bDot(R*0.62,-R*0.26,R*0.12); bDot(R*0.6,R*0.14,R*0.05);
    ctx.fillStyle = '#1c1016'; bDot(R*0.66,-R*0.26,R*0.05);
  },

  spitter(z,R,t,c,wk){
    const sw = Math.sin(t*5+z.phase), st = z.st;
    const swell = (st==='lob'||st==='nova') ? wk*0.22 : (st==='spraying' ? -0.1 : 0);
    ctx.strokeStyle = c('#5a6440'); ctx.lineWidth = R*0.16; // spindly limbs
    ctx.beginPath();
    ctx.moveTo(R*0.2,-R*0.6); ctx.quadraticCurveTo(R*0.9,-R*0.95,R*1.15,-R*0.4+sw*3);
    ctx.moveTo(R*0.2,R*0.6); ctx.quadraticCurveTo(R*0.9,R*0.95,R*1.15,R*0.4-sw*3);
    ctx.moveTo(-R*0.3,-R*0.6); ctx.quadraticCurveTo(-R*0.5,-R*1.15,-R*0.9,-R*1.0-sw*2);
    ctx.moveTo(-R*0.3,R*0.6); ctx.quadraticCurveTo(-R*0.5,R*1.15,-R*0.9,R*1.0+sw*2);
    ctx.stroke();
    blobPath(R*0.85,R*0.8,0.04,t,z.phase);
    ctx.fillStyle = c(z.skin); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.8; ctx.stroke();
    // acid sac bulging out of the back
    const sr = R*0.72*(1+0.05*Math.sin(t*3+z.phase)+swell), sx = -R*0.35;
    const g = ctx.createRadialGradient(sx-sr*0.2,-sr*0.2,sr*0.1,sx,0,sr);
    g.addColorStop(0,c('#eaff9a')); g.addColorStop(0.55,c('#9ccc3a')); g.addColorStop(1,c('#3f5a1a'));
    ctx.fillStyle = g; bDot(sx,0,sr);
    ctx.strokeStyle = 'rgba(30,50,10,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx,0,sr,0,TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,90,30,0.7)'; ctx.lineWidth = 1.2;
    for(let i=0;i<5;i++){
      const a = i*1.26+0.4;
      ctx.beginPath(); ctx.moveTo(sx+Math.cos(a)*sr,Math.sin(a)*sr);
      ctx.quadraticCurveTo(sx+Math.cos(a+0.5)*sr*0.6,Math.sin(a+0.5)*sr*0.6,sx+Math.cos(a+0.3)*sr*0.25,Math.sin(a+0.3)*sr*0.25); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(240,255,190,0.6)'; // bubbles rising inside
    for(let i=0;i<3;i++){ const bt=(t*0.7+i*0.37)%1; bDot(sx+Math.sin(i*2.1+z.phase)*sr*0.45, sr*0.5-bt*sr, 1.5+2*(1-bt)); }
    ctx.fillStyle = c('#a8c04a');
    [[0.35,-0.6],[0.45,0.55],[-0.1,0.72],[0,-0.7]].forEach((p,i)=>bDot(p[0]*R,p[1]*R,R*0.12*(1+0.1*Math.sin(t*5+i*1.7))));
    // head: the jaw has split into two mandibles
    const open = st==='spraying' ? 0.6 : ((st==='spray'||st==='lob'||st==='nova') ? 0.5*wk : 0.1+0.05*sw);
    ctx.fillStyle = c('#7f8a55'); bDot(R*0.62,0,R*0.36);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(R*0.62,0,R*0.36,0,TAU); ctx.stroke();
    ctx.fillStyle = '#c8f060'; bDot(R*0.9,0,R*0.07+open*R*0.12);
    ctx.fillStyle = c('#c8c098');
    for(let s=-1;s<=1;s+=2){
      ctx.save(); ctx.translate(R*0.82,s*R*0.14); ctx.rotate(s*open);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(R*0.5,s*R*0.02); ctx.lineTo(R*0.05,s*R*0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#f0e05a';
    bDot(R*0.62,-R*0.2,2.6); bDot(R*0.62,R*0.2,2.6); bDot(R*0.48,-R*0.3,1.8); bDot(R*0.48,R*0.3,1.8);
  },

  brood(z,R,t,c,wk){
    const st = z.st, mad = z.stage>0;
    const reach = st==='leap' ? 1-0.35*wk : (z.air ? 1.2 : 1), walk = st==='idle' ? 1 : 0.2;
    ctx.strokeStyle = c('#2a1c2a'); // eight legs
    for(let s=-1;s<=1;s+=2) for(let i=0;i<4;i++){
      const a = s*(0.75+i*0.55), wob = Math.sin(t*10+i*1.7+(s>0?0:Math.PI)+z.phase)*0.16*walk;
      const bx = R*(0.45-i*0.22), by = s*R*0.4;
      const kx = bx+Math.cos(a+wob-s*0.3)*R*0.95*reach, ky = by+Math.sin(a+wob-s*0.3)*R*0.95*reach;
      const fx = bx+Math.cos(a+wob*2+s*0.15)*R*1.85*reach, fy = by+Math.sin(a+wob*2+s*0.15)*R*1.85*reach;
      ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(kx,ky); ctx.stroke();
      ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(kx,ky); ctx.lineTo(fx,fy); ctx.stroke();
    }
    // abdomen studded with eggs
    const pulse = st==='lay' ? 0.1*Math.sin(z.t*18) : 0.03*Math.sin(t*3);
    ctx.save(); ctx.translate(-R*0.6,0);
    blobPath(R*0.9*(1+pulse),R*0.8*(1+pulse),0.04,t,z.phase);
    ctx.fillStyle = c(z.cloth); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.8; ctx.stroke();
    [[-0.35,-0.3],[0.1,-0.42],[-0.45,0.2],[0.05,0.4],[-0.1,0],[0.35,0.05]].forEach((p,i)=>{
      ctx.fillStyle = c('#d8c9a0'); bDot(p[0]*R,p[1]*R,R*0.17*(1+0.1*Math.sin(t*4+i)));
      ctx.fillStyle = 'rgba(120,30,50,0.55)'; bDot(p[0]*R+1,p[1]*R+1,R*0.07);
    });
    ctx.restore();
    ctx.fillStyle = c(z.skin);
    ctx.beginPath(); ctx.ellipse(R*0.25,0,R*0.55,R*0.5,0,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,10,20,0.6)'; ctx.lineWidth = 2; // chitin ridges
    ctx.beginPath(); ctx.moveTo(R*0.05,-R*0.35); ctx.quadraticCurveTo(R*0.2,0,R*0.05,R*0.35); ctx.moveTo(R*0.35,-R*0.3); ctx.quadraticCurveTo(R*0.48,0,R*0.35,R*0.3); ctx.stroke();
    ctx.fillStyle = c('#3a2a3a'); bDot(R*0.75,0,R*0.3);
    ctx.strokeStyle = c('#d8cdb0'); ctx.lineWidth = 2.4; // fangs
    ctx.beginPath(); ctx.moveTo(R*0.95,-R*0.13); ctx.quadraticCurveTo(R*1.28,-R*0.14,R*1.22,-R*0.02);
    ctx.moveTo(R*0.95,R*0.13); ctx.quadraticCurveTo(R*1.28,R*0.14,R*1.22,R*0.02); ctx.stroke();
    ctx.fillStyle = mad ? '#ff7a3a' : '#e04b4b';
    [[0.88,0.1,2.4],[0.8,0.2,2],[0.7,0.26,1.6]].forEach(e=>{ bDot(R*e[0],R*e[1],e[2]); bDot(R*e[0],-R*e[1],e[2]); });
  },

  lasher(z,R,t,c,wk){
    const st = z.st, mad = z.stage>0;
    const busy = st==='sweep'||st==='whip'||st==='grab'||st==='hook'||st==='drag';
    const tuck = (st==='erupt'||st==='erupting') ? 0.6 : 1; // limbs driven into the ground
    for(let i=0;i<7;i++){
      if(!i && busy) continue; // the front limb is the one attacking, drawn by drawLasherLimb
      const a0 = i/7*TAU+0.45;
      let px = Math.cos(a0)*R*0.6, py = Math.sin(a0)*R*0.6;
      for(let j=1;j<=5;j++){
        const a = a0+Math.sin(t*2.6+i*1.9+j*0.7+z.phase)*0.16*j, d = R*(0.6+j*0.28*tuck);
        const nx = Math.cos(a)*d, ny = Math.sin(a)*d;
        ctx.strokeStyle = c(j%2 ? '#9a4460' : '#8a3854'); ctx.lineWidth = R*0.3*(1-j/6.5);
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(nx,ny); ctx.stroke();
        px = nx; py = ny;
      }
    }
    blobPath(R*0.92,R*0.92,0.06,t*1.4,z.phase);
    ctx.fillStyle = c(mad ? '#8a2a40' : z.skin); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(40,10,24,0.45)'; blobPath(R*0.6,R*0.6,0.08,-t,z.phase+2); ctx.fill();
    // maw ringed with teeth
    const mr = R*(0.34+0.1*(st==='idle'||st==='recover' ? 0.2*Math.sin(t*2) : wk)), mx = R*0.3;
    ctx.fillStyle = '#14060c'; bDot(mx,0,mr);
    ctx.fillStyle = c('#e8dcc0');
    for(let i=0;i<10;i++){
      const a = i/10*TAU+t*0.6;
      ctx.beginPath(); ctx.moveTo(mx+Math.cos(a-0.16)*mr,Math.sin(a-0.16)*mr); ctx.lineTo(mx+Math.cos(a+0.16)*mr,Math.sin(a+0.16)*mr);
      ctx.lineTo(mx+Math.cos(a)*mr*0.45,Math.sin(a)*mr*0.45); ctx.closePath(); ctx.fill();
    }
    [[-0.35,-0.45,0.14],[-0.5,0.3,0.17],[0.05,0.66,0.11],[0.1,-0.68,0.1],[-0.7,-0.05,0.09]].forEach((e,i)=>{ // eyes that don't blink together
      const shut = Math.sin(t*0.9+i*2.3) > 0.93;
      ctx.fillStyle = shut ? c('#5a2034') : (mad ? '#ff9a4a' : '#f0d85a'); bDot(e[0]*R,e[1]*R,e[2]*R);
      if(!shut){ ctx.fillStyle = '#14060c'; ctx.beginPath(); ctx.ellipse(e[0]*R,e[1]*R,e[2]*R*0.25,e[2]*R*0.8,0,0,TAU); ctx.fill(); }
    });
  },

  titan(z,R,t,c,wk){
    const sw = Math.sin(t*3.2+z.phase), st = z.st, s = z.stage, open = z.vent>0;
    const raise = st==='stomp' ? wk : 0;
    for(let sd=-1;sd<=1;sd+=2){ // arms ending in bone gauntlets
      const ex = R*0.55, ey = sd*R*(1.15+0.25*raise), hx = R*(1.15-0.5*raise), hy = sd*R*(0.7+0.5*raise)-sd*sw*2;
      ctx.strokeStyle = c('#3a3040'); ctx.lineWidth = R*0.42;
      ctx.beginPath(); ctx.moveTo(-R*0.05,sd*R*0.8); ctx.lineTo(ex,ey); ctx.lineTo(hx,hy); ctx.stroke();
      ctx.fillStyle = c('#e8dcc0');
      for(let k=-1;k<=1;k++){
        const a = k*0.5;
        ctx.beginPath(); ctx.moveTo(hx+Math.cos(a)*R*0.62,hy+Math.sin(a)*R*0.62);
        ctx.lineTo(hx+Math.cos(a+0.5)*R*0.26,hy+Math.sin(a+0.5)*R*0.26); ctx.lineTo(hx+Math.cos(a-0.5)*R*0.26,hy+Math.sin(a-0.5)*R*0.26); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = c(z.skin); bDot(hx,hy,R*0.3);
      ctx.strokeStyle = '#4a4234'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx,hy,R*0.3,0,TAU); ctx.stroke();
    }
    ctx.fillStyle = c('#d8cdb0'); // spines down the back
    for(let i=-2;i<=2;i++){
      const a = Math.PI+i*0.42;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*R*1.35,Math.sin(a)*R*1.35);
      ctx.lineTo(Math.cos(a+0.14)*R*0.8,Math.sin(a+0.14)*R*0.8); ctx.lineTo(Math.cos(a-0.14)*R*0.8,Math.sin(a-0.14)*R*0.8); ctx.closePath(); ctx.fill();
    }
    blobPath(R*0.95,R*1.02,0.03,t,z.phase);
    ctx.fillStyle = c(z.cloth); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    // carapace plates
    const plate = (pts,my)=>{
      ctx.beginPath();
      pts.forEach((p,i)=>{ if(i) ctx.lineTo(p[0]*R,p[1]*R*my); else ctx.moveTo(p[0]*R,p[1]*R*my); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    const shoulder = [[-0.05,-0.95],[0.45,-0.82],[0.5,-0.42],[-0.02,-0.55],[-0.45,-0.68]];
    ctx.fillStyle = c(z.skin); ctx.strokeStyle = '#4a4234'; ctx.lineWidth = 1.8;
    plate([[-0.85,-0.3],[-0.55,-0.62],[-0.1,-0.5],[-0.1,0.5],[-0.55,0.62],[-0.85,0.3]],1);
    plate(shoulder,1);
    if(s<2) plate(shoulder,-1);
    else { ctx.fillStyle = c('#7a2a34'); ctx.beginPath(); ctx.ellipse(R*0.1,R*0.68,R*0.4,R*0.2,-0.2,0,TAU); ctx.fill(); } // torn off in the last stage
    ctx.strokeStyle = s>0 ? 'rgba(200,240,96,'+(0.5+0.3*Math.sin(t*5))+')' : 'rgba(40,34,26,0.8)'; ctx.lineWidth = 1.4; // cracks
    ctx.beginPath(); ctx.moveTo(-R*0.7,-R*0.2); ctx.lineTo(-R*0.45,-R*0.05); ctx.lineTo(-R*0.5,R*0.25); ctx.lineTo(-R*0.25,R*0.35);
    ctx.moveTo(R*0.1,-R*0.8); ctx.lineTo(R*0.25,-R*0.6); ctx.lineTo(R*0.18,-R*0.5); ctx.stroke();
    // the core: shuttered while armoured, blazing while exposed
    const cr = R*0.3*(open ? 1+0.08*Math.sin(t*10) : 0.8), cx = R*0.15;
    if(open){
      const g = ctx.createRadialGradient(cx,0,cr*0.2,cx,0,cr*2.4);
      g.addColorStop(0,'rgba(220,255,140,0.55)'); g.addColorStop(1,'rgba(120,200,40,0)');
      ctx.fillStyle = g; bDot(cx,0,cr*2.4);
    }
    ctx.fillStyle = open ? '#f0ffb0' : '#2c3418'; bDot(cx,0,cr);
    ctx.strokeStyle = '#4a4234'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx,0,cr,0,TAU);
    if(!open) for(let i=-1;i<=1;i++){ const w=Math.sqrt(1-i*i*0.25)*cr; ctx.moveTo(cx-w,i*cr*0.5); ctx.lineTo(cx+w,i*cr*0.5); }
    ctx.stroke();
    // head under a crown of horns
    ctx.fillStyle = c('#e8dcc0');
    for(let i=-2;i<=2;i++){
      const a = Math.PI+i*0.6, hx = R*0.72;
      ctx.beginPath(); ctx.moveTo(hx+Math.cos(a)*R*0.62,Math.sin(a)*R*0.62);
      ctx.lineTo(hx+Math.cos(a+0.3)*R*0.26,Math.sin(a+0.3)*R*0.26); ctx.lineTo(hx+Math.cos(a-0.3)*R*0.26,Math.sin(a-0.3)*R*0.26); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = c('#4a4050'); bDot(R*0.72,0,R*0.3);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(R*0.72,0,R*0.3,0,TAU); ctx.stroke();
    ctx.fillStyle = '#c8f060'; bDot(R*0.9,-R*0.11,3); bDot(R*0.9,R*0.11,3);
  },
};
// The lasher's attacking limb is aimed in world space, so it is drawn outside the body's rotation.
function drawLasherLimb(z,sx,sy,t){
  const st = z.st;
  let a, len, bend = 0, hook = false;
  if(st==='sweep'){ a = z.aim-z.dir*LASH_HALF; len = LASH_R*(0.45+0.55*clamp(z.t/z.w,0,1)); bend = z.dir*0.5+Math.sin(t*30)*0.06; }
  else if(st==='whip'){
    const k = Math.min(1,z.t/z.w);
    a = z.aim+z.dir*(-LASH_HALF+2*LASH_HALF*k); len = LASH_R; bend = z.dir*0.55;
    ctx.strokeStyle = 'rgba(255,200,215,0.3)'; ctx.lineWidth = 16; // smear along the arc already swept
    ctx.beginPath(); ctx.arc(sx,sy,LASH_R*0.9,z.aim-z.dir*LASH_HALF,a,z.dir<0); ctx.stroke();
  }
  else if(st==='grab'){ a = z.aim; len = z.r+26+Math.sin(t*26)*5; }
  else if(st==='hook'){ a = z.aim; len = z.len; hook = true; }
  else if(st==='drag'){ a = Math.atan2(player.y-z.y,player.x-z.x); len = z.len; hook = true; }
  else return;
  const tx = sx+Math.cos(a)*len, ty = sy+Math.sin(a)*len;
  const mx = sx+Math.cos(a-bend)*len*0.55, my = sy+Math.sin(a-bend)*len*0.55;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a1426'; ctx.lineWidth = hook ? 7 : 11;
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(mx,my,tx,ty); ctx.stroke();
  ctx.strokeStyle = z.flash>0 ? '#f0ead8' : '#b85070'; ctx.lineWidth = hook ? 3.5 : 6;
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(mx,my,tx,ty); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8dcc0'; // barb at the tip
  ctx.beginPath(); ctx.moveTo(tx+Math.cos(a)*12,ty+Math.sin(a)*12); ctx.lineTo(tx+Math.cos(a+2.3)*8,ty+Math.sin(a+2.3)*8); ctx.lineTo(tx+Math.cos(a-2.3)*8,ty+Math.sin(a-2.3)*8); ctx.closePath(); ctx.fill();
}
function drawEgg(z){
  const sx = z.x-camera.x, sy = z.y-camera.y;
  if(sx<-40||sy<-40||sx>canvas.width+40||sy>canvas.height+40) return;
  const t = performance.now()/1000, R = z.r, k = clamp(1-z.hatch/4.5,0,1); // pulses faster as it nears hatching
  const p = 1+0.07*Math.sin(t*(4+k*18)+z.phase);
  shadow(sx+2,sy+4,R,R*0.7);
  ctx.save();
  ctx.translate(sx,sy); ctx.rotate(z.angle); ctx.scale(p,p);
  ctx.fillStyle = z.flash>0 ? '#ffffff' : z.skin;
  ctx.beginPath(); ctx.ellipse(0,0,R*1.05,R*0.85,0,0,TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,30,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(70,20,40,'+(0.25+0.5*k)+')';
  ctx.beginPath(); ctx.ellipse(1,0,R*0.55,R*0.42,0.3,0,TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160,40,60,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-R,0); ctx.quadraticCurveTo(-R*0.4,-R*0.6,0,-R*0.2); ctx.moveTo(R*0.9,2); ctx.quadraticCurveTo(R*0.4,R*0.6,-2,R*0.3); ctx.stroke();
  ctx.restore();
  if(z.hp < z.maxHp){
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(sx-12,sy-R-10,24,4);
    ctx.fillStyle='#b23a3a'; ctx.fillRect(sx-12,sy-R-10,24*Math.max(0,z.hp/z.maxHp),4);
  }
}

/* ---------- telegraphs: k = 0..1, how close the attack is to landing ---------- */
function teleStroke(k){
  ctx.strokeStyle = 'rgba(255,96,72,'+(0.55+0.4*k)+')'; ctx.lineWidth = 2;
  ctx.setLineDash([8,6]); ctx.lineDashOffset = -performance.now()/40;
  ctx.stroke();
  ctx.setLineDash([]);
}
function teleCircle(x,y,r,k,r0,col){
  r0 = r0||0;
  const ring = rad=>{ ctx.beginPath(); ctx.arc(x,y,rad,0,TAU); if(r0){ ctx.moveTo(x+r0,y); ctx.arc(x,y,r0,0,TAU,true); } };
  ring(r); ctx.fillStyle = 'rgba('+col+','+(0.1+0.12*k)+')'; ctx.fill();
  ring(r0+(r-r0)*k); ctx.fillStyle = 'rgba('+col+','+(0.12+0.2*k)+')'; ctx.fill(); // fills up as the delay runs out
  ctx.beginPath(); ctx.arc(x,y,r,0,TAU); teleStroke(k);
  if(r0){ ctx.beginPath(); ctx.arc(x,y,r0,0,TAU); teleStroke(k); }
}
function teleLine(x,y,a,len,w,k){
  ctx.save(); ctx.translate(x,y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(224,75,75,'+(0.1+0.1*k)+')'; ctx.fillRect(0,-w/2,len,w);
  ctx.fillStyle = 'rgba(224,75,75,'+(0.1+0.2*k)+')'; ctx.fillRect(0,-w/2,len*k,w);
  ctx.beginPath(); ctx.rect(0,-w/2,len,w); teleStroke(k);
  ctx.restore();
}
function teleCone(x,y,a,half,len,k){
  const wedge = r=>{ ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,r,a-half,a+half); ctx.closePath(); };
  wedge(len); ctx.fillStyle = 'rgba(224,75,75,'+(0.1+0.1*k)+')'; ctx.fill();
  wedge(len*k); ctx.fillStyle = 'rgba(224,75,75,'+(0.1+0.2*k)+')'; ctx.fill();
  wedge(len); teleStroke(k);
}
// Ground pass, under the entities: pools, pending bursts and the bosses' wind-ups.
function drawHazards(){
  const t = performance.now()/1000, cw = canvas.width, chh = canvas.height;
  for(const h of hazards){
    const x = h.x-camera.x, y = h.y-camera.y, m = h.r+40;
    if(x<-m||y<-m||x>cw+m||y>chh+m) continue;
    const col = HAZ_COL[h.type];
    if(h.k==='burst') teleCircle(x,y,h.r,clamp(h.t/h.delay,0,1),h.r0,col);
    else if(h.k==='pool'){
      const a = Math.min(1,h.life/0.8)*Math.min(1,(h.max-h.life)/0.25+0.2);
      if(h.type==='spore'){
        for(let i=0;i<5;i++){
          const an = t*0.5+i*1.26+h.phase, px = x+Math.cos(an)*h.r*0.35, py = y+Math.sin(an*1.3)*h.r*0.35;
          const g = ctx.createRadialGradient(px,py,2,px,py,h.r*0.75);
          g.addColorStop(0,'rgba('+col+','+(0.32*a)+')'); g.addColorStop(1,'rgba('+col+',0)');
          ctx.fillStyle = g; bDot(px,py,h.r*0.75);
        }
      } else {
        const r = h.r*(1+0.04*Math.sin(t*4+h.phase));
        const g = ctx.createRadialGradient(x,y,2,x,y,r);
        g.addColorStop(0,'rgba('+col+','+(0.6*a)+')'); g.addColorStop(0.7,'rgba('+col+','+(0.38*a)+')'); g.addColorStop(1,'rgba('+col+',0)');
        ctx.fillStyle = g; bDot(x,y,r);
        ctx.strokeStyle = 'rgba(240,255,200,'+(0.5*a)+')'; ctx.lineWidth = 1;
        for(let i=0;i<3;i++){ const bt=(t*0.8+i*0.33+h.phase)%1; ctx.beginPath(); ctx.arc(x+Math.cos(i*2.4+h.phase)*h.r*0.45,y+Math.sin(i*3.1+h.phase)*h.r*0.4,1+bt*5,0,TAU); ctx.stroke(); }
      }
    }
  }
  for(const z of zombies){
    if(!z.alive || z.kind!=='boss' || !z.w) continue;
    const x = z.x-camera.x, y = z.y-camera.y, k = clamp(z.t/z.w,0,1), id = z.boss+'.'+z.st;
    if(x<-900||y<-900||x>cw+900||y>chh+900) continue;
    if(id==='butcher.charge') teleLine(x,y,z.aim,660,z.r*2.2,k);
    else if(id==='butcher.slam') teleCircle(x,y,175,k,0,HAZ_COL.rock);
    else if(id==='spitter.spray') teleCone(x,y,z.aim,0.34,410,k);
    else if(id==='spitter.nova') teleCircle(x,y,110,k,0,HAZ_COL.acid);
    else if(id==='brood.leap') teleCircle(z.tx-camera.x,z.ty-camera.y,108,k*0.55,0,HAZ_COL.flesh);
    else if(id==='brood.air') teleCircle(z.tx-camera.x,z.ty-camera.y,108,0.55+0.45*k,0,HAZ_COL.flesh);
    else if(id==='lasher.sweep') teleCone(x,y,z.aim,LASH_HALF,LASH_R,k);
    else if(id==='lasher.grab') teleLine(x,y,z.aim,520,26,k);
    else if(id==='titan.fissure'){ const n = 1+2*z.stage; for(let i=0;i<n;i++) teleLine(x,y,z.aim+(i-(n-1)/2)*0.36,700,84,k); }
    else if(id==='titan.stomp') teleCircle(x,y,205,k,0,HAZ_COL.rock);
    else if(id==='titan.spikes') teleCircle(x,y,90,k,0,HAZ_COL.bone);
  }
  if(player.slow>0){ // webbing around the player's feet
    const x = player.x-camera.x, y = player.y-camera.y;
    ctx.strokeStyle = 'rgba(220,224,235,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for(let i=0;i<6;i++){ const a=i/6*TAU; ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*20,y+Math.sin(a)*20); }
    ctx.moveTo(x+13,y); ctx.arc(x,y,13,0,TAU);
    ctx.stroke();
  }
}
// Top pass, over the entities: lobbed globs, projectiles, shock rings and whatever bursts out of the ground.
function drawHazardsTop(){
  for(const h of hazards){
    const x = h.x-camera.x, y = h.y-camera.y, col = HAZ_COL[h.type];
    if(h.k==='burst' && h.lob){
      const k = clamp(h.t/h.delay,0,1), px = h.lob.x+(h.x-h.lob.x)*k-camera.x, py = h.lob.y+(h.y-h.lob.y)*k-camera.y-Math.sin(k*Math.PI)*90;
      if(h.type==='rock'){
        ctx.save(); ctx.translate(px,py); ctx.rotate(k*7);
        ctx.fillStyle = '#7a756a'; ctx.strokeStyle = '#2a2822'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-12,-4); ctx.lineTo(-3,-12); ctx.lineTo(10,-8); ctx.lineTo(13,5); ctx.lineTo(2,12); ctx.lineTo(-10,8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba('+col+',0.35)'; bDot(px,py,13);
        ctx.fillStyle = 'rgb('+col+')'; bDot(px,py,8);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; bDot(px-2.5,py-2.5,2.5);
      }
    } else if(h.k==='ring'){
      const k = 1-h.life/h.max, r = h.r*(0.35+0.65*Math.sqrt(k));
      ctx.beginPath(); ctx.arc(x,y,r,0,TAU);
      if(h.r0){ ctx.moveTo(x+h.r0,y); ctx.arc(x,y,h.r0,0,TAU,true); }
      ctx.fillStyle = 'rgba('+col+','+(0.3*(1-k))+')'; ctx.fill();
      ctx.strokeStyle = 'rgba('+col+','+(0.9*(1-k))+')'; ctx.lineWidth = 1+6*(1-k);
      ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.stroke();
    } else if(h.k==='spike'){
      const k = 1-h.life/h.max, grow = Math.min(1,k/0.18), n = 4;
      ctx.globalAlpha = k>0.6 ? 1-(k-0.6)/0.4 : 1;
      ctx.fillStyle = h.type==='bone' ? '#e8dcc0' : '#b85070'; ctx.strokeStyle = 'rgba(30,14,18,0.8)'; ctx.lineWidth = 1.2;
      for(let i=0;i<n;i++){
        const bx = x+(i-(n-1)/2)*h.r*0.42, hgt = h.r*1.25*grow*(0.65+0.35*((i*7)%3)/2), lean = (i-(n-1)/2)*5;
        ctx.beginPath(); ctx.moveTo(bx-h.r*0.16,y+6); ctx.lineTo(bx+lean,y+6-hgt); ctx.lineTo(bx+h.r*0.16,y+6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  for(const s of eshots){
    const x = s.x-camera.x, y = s.y-camera.y, col = HAZ_COL[s.type];
    if(x<-30||y<-30||x>canvas.width+30||y>canvas.height+30) continue;
    if(s.type==='bone'){
      const a = Math.atan2(s.vy,s.vx);
      ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#5a5040'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*11,y+Math.sin(a)*11); ctx.lineTo(x+Math.cos(a+2.5)*7,y+Math.sin(a+2.5)*7); ctx.lineTo(x+Math.cos(a-2.5)*7,y+Math.sin(a-2.5)*7); ctx.closePath(); ctx.fill(); ctx.stroke();
      continue;
    }
    ctx.strokeStyle = 'rgba('+col+',0.4)'; ctx.lineWidth = s.r;
    ctx.beginPath(); ctx.moveTo(x-s.vx*0.04,y-s.vy*0.04); ctx.lineTo(x,y); ctx.stroke();
    ctx.fillStyle = 'rgba('+col+',0.35)'; bDot(x,y,s.r+4);
    ctx.fillStyle = 'rgb('+col+')'; bDot(x,y,s.r);
    if(s.type==='web'){
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0;i<4;i++){ const a=i*TAU/8+s.life*6; ctx.moveTo(x-Math.cos(a)*(s.r+5),y-Math.sin(a)*(s.r+5)); ctx.lineTo(x+Math.cos(a)*(s.r+5),y+Math.sin(a)*(s.r+5)); }
      ctx.stroke();
    }
  }
}
// At night the attacks have to stay readable: everything dangerous glows through the dark.
function lightBossFx(hole){
  for(const h of hazards) hole(h.x-camera.x, h.y-camera.y, h.r*1.5+30, h.k==='pool' ? 0.45 : 0.6);
  for(const s of eshots) hole(s.x-camera.x, s.y-camera.y, 46, 0.45);
  for(const z of zombies){
    if(!z.alive || z.kind!=='boss') continue;
    const x = z.x-camera.x, y = z.y-camera.y;
    if(x<-700||y<-700||x>canvas.width+700||y>canvas.height+700) continue;
    hole(x,y,z.r*3,0.5);
    if(z.w && z.st!=='recover') hole(x+Math.cos(z.aim)*150, y+Math.sin(z.aim)*150, 330, 0.5);
    if(z.st==='leap'||z.st==='air') hole(z.tx-camera.x, z.ty-camera.y, 170, 0.6);
  }
}
// Health bars along the top, one per boss; ticks mark the stage thresholds.
function drawBossBars(){
  const list = zombies.filter(z=>z.alive && z.kind==='boss').slice(0,3);
  if(!list.length || gameState==='start') return;
  const bw = Math.min(460, canvas.width*0.5), bx = (canvas.width-bw)/2;
  ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'center';
  list.forEach((z,i)=>{
    const def = BOSSES[z.boss], by = 76+i*26, arm = bossArmor(z);
    ctx.fillStyle = 'rgba(16,16,10,0.8)'; ctx.fillRect(bx-3,by-3,bw+6,18);
    ctx.fillStyle = '#3a1414'; ctx.fillRect(bx,by,bw,12);
    ctx.fillStyle = arm<1 ? '#7a7468' : (arm>1 ? '#e8843a' : '#b23a3a');
    ctx.fillRect(bx,by,bw*clamp(z.hp/z.maxHp,0,1),12);
    ctx.fillStyle = 'rgba(16,16,10,0.9)';
    def.stages.forEach(th=>ctx.fillRect(bx+bw*th-1,by,2,12));
    ctx.strokeStyle = arm>1 ? '#f0ffb0' : 'rgba(217,165,40,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(bx-2.5,by-2.5,bw+5,17);
    const tag = T(arm<1 ? ' · 갑각' : (arm>1 ? (z.boss==='titan' ? ' · 핵 노출!' : ' · 기절!') : ''));
    ctx.fillStyle = '#f0c85a';
    ctx.fillText(def.name+tag+'  '+Math.ceil(z.hp)+' / '+Math.ceil(z.maxHp), canvas.width/2, by+10);
  });
  ctx.textAlign = 'left';
}
