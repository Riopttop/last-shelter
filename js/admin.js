'use strict';

/* ============================================================
   ADMIN — test panel, F2 or ` (config.js: ADMIN)
============================================================ */
const admin = {open:false, god:false, noSpawn:false, panel:document.getElementById('adminPanel')};

function toggleAdmin(){
  if(!ADMIN || gameState==='start') return;
  admin.open = !admin.open;
  admin.panel.classList.toggle('hidden', !admin.open);
}
function adminBosses(){ return zombies.filter(z=>z.alive && z.kind==='boss'); }
const ADMIN_KIT = ['rifle','shotgun','machete'];
const ADMIN_ACTIONS = {
  // drop every boss to just under its next health threshold
  stage(){
    adminBosses().forEach(z=>{
      const th = BOSSES[z.boss].stages[z.stage];
      if(th===undefined) spawnFloat(z.x,z.y-z.r-20,'마지막 단계','#aea583');
      else z.hp = Math.min(z.hp, z.maxHp*th-1);
    });
  },
  half(){ adminBosses().forEach(z=>{ z.hp = Math.max(1, z.hp*0.5); }); },
  killboss(){
    zombies.forEach(z=>{ if(z.kind==='boss' || z.kind==='egg' || z.kind==='crawler') z.alive = false; });
    hazards = []; eshots = [];
  },
  god(){ admin.god = !admin.god; },
  nospawn(){ admin.noSpawn = !admin.noSpawn; },
  heal(){ player.hp = player.maxHp; player.hunger = 100; player.slow = 0; },
  kit(){
    for(let i=0;i<WEAPON_SLOTS;i++){
      const old = takeFromSlot(i);
      if(old && ADMIN_KIT.indexOf(old.id)<0) player.spares.push(old);
    }
    player.spares = player.spares.filter(s=>ADMIN_KIT.indexOf(s.id)<0);
    ADMIN_KIT.forEach((id,i)=>putInSlot(newWeapon(id),i));
    player.weapon = 'rifle'; player.melee = 'machete'; player.reload = 0;
    const inv = player.inv;
    inv.ammo = Math.max(inv.ammo,480); inv.medkit = Math.max(inv.medkit,5);
    inv.grenade = Math.max(inv.grenade,5); inv.molotov = Math.max(inv.molotov,3);
    player.gear.steelarmor = true; player.gear.helmet = true;
    if(invOpen) renderInventory();
  },
  clear(){ zombies.forEach(z=>{ if(z.kind!=='boss') z.alive = false; }); },
  // jumps within the current day, so no new-day or nightfall events fire
  night(){ worldTime = Math.floor(worldTime/DAY_LEN)*DAY_LEN + DAY_LEN*(isNight() ? 0.3 : 0.7); },
};
function adminRefresh(){
  admin.panel.querySelector('[data-adm="god"]').classList.toggle('on', admin.god);
  admin.panel.querySelector('[data-adm="nospawn"]').classList.toggle('on', admin.noSpawn);
}

// (re)writes the summon buttons; called again when the language changes
function labelAdmin(){
  document.getElementById('admBosses').innerHTML = BOSS_ORDER.map((id,i)=>
    '<button data-boss="'+id+'"><span class="k">'+(i+1)+'</span>'+BOSSES[id].name+'<small>'+BOSSES[id].sub+'</small></button>').join('');
}
labelAdmin();
admin.panel.addEventListener('click', e=>{
  const b = e.target.closest('button');
  if(!b || gameState!=='playing') return;
  if(b.dataset.boss) spawnBoss(b.dataset.boss,true);
  else ADMIN_ACTIONS[b.dataset.adm]();
  b.blur(); // so Space / Enter don't press it again
  adminRefresh();
  updateHUD();
});
