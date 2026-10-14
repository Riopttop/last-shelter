'use strict';

/* ============================================================
   SAVE / LOAD — one slot in localStorage
============================================================ */
// v3: much larger map, markers, outposts; older saves don't fit the new world and are ignored
const SAVE_KEY = 'lastShelter.save.v3';
const SAVE_SLOTS = 3;
// Slot 1 keeps the key of the old single save. The slot in use is settings.slot.
function slotKey(i){ return i ? SAVE_KEY+'.s'+(i+1) : SAVE_KEY; }

function readSave(slot){
  try{
    const d = JSON.parse(localStorage.getItem(slotKey(slot===undefined ? settings.slot : slot)));
    return d && d.v===3 ? d : null;
  }catch(e){ return null; }
}
function deleteSave(){
  try{ localStorage.removeItem(slotKey(settings.slot)); }catch(e){}
  refreshSaveUI();
}
// "saved" tag on the HUD, for the autosaves as well
let saveChipTimer = 0;
function flashSaved(){
  const chip = document.getElementById('saveChip');
  chip.classList.add('show');
  clearTimeout(saveChipTimer);
  saveChipTimer = setTimeout(()=>chip.classList.remove('show'), 1800);
}
function saveGame(){
  if(gameState==='gameover' || gameState==='start' || player.hp<=0) return false;
  const data = {
    v:3, savedAt:Date.now(), difficulty,
    day, worldTime, survivalTime, killCount, totalLoot, spawnTimer, bossDay,
    markers, checkpoint, groundSeed,
    player,
    houses: houses.map(h=>{ const o=Object.assign({},h); delete o.type; return o; }),
    outdoorCrates, obstacles,
    pickups: pickups.map(p=>Object.assign({},p,{taking:false})),
    structures: structures.map(s=>({id:s.def.id,cx:s.cx,cy:s.cy,hp:s.hp,maxHp:s.maxHp,store:s.store,weapons:s.weapons,ammo:s.ammo})),
    zombies: zombies.filter(z=>z.alive),
  };
  try{ localStorage.setItem(slotKey(settings.slot), JSON.stringify(data)); }
  catch(e){ return false; }
  refreshSaveUI();
  flashSaved();
  return true;
}
function loadGame(){
  const d = readSave();
  if(!d) return false;
  resetGame(); // fresh defaults and UI state, then overwrite with the saved world
  if(DIFFICULTIES[d.difficulty]) difficulty = d.difficulty;

  houses.length=0; outdoorCrates.length=0; obstacles.length=0; pickups.length=0;
  d.houses.forEach(h=>{ h.type=BUILDING_TYPES[h.typeId]; houses.push(h); });
  d.outdoorCrates.forEach(c=>outdoorCrates.push(c));
  d.obstacles.forEach(o=>obstacles.push(o));
  d.pickups.forEach(p=>{ if(p.w ? validWeapon(p.w) : ITEMS[p.type]) pickups.push(p); });
  // saves from before rocks existed: scatter them now, clear of anything already built
  if(!obstacles.some(o=>o.type==='rock')){
    addRocks(d.structures.map(s=>({x:s.cx*CELL,y:s.cy*CELL,w:CELL,h:CELL}))
      .concat(outdoorCrates, [{x:d.player.x-200,y:d.player.y-200,w:400,h:400}]));
  }
  structures.length=0; structGrid.fill(null);
  computeStatic();
  d.structures.forEach(s=>{
    const def = BUILD_DEFS.find(b=>b.id===s.id);
    if(!def) return;
    const st = placeStruct(def,s.cx,s.cy);
    st.hp = s.hp; st.maxHp = s.maxHp || def.hp;
    if(st.store && s.store) st.store = s.store;
    if(st.weapons && s.weapons) st.weapons = s.weapons.filter(validWeapon);
    if(s.ammo>=0 && st.ammo!==undefined) st.ammo = s.ammo;
  });

  const inv = Object.assign(player.inv, d.player.inv);
  const stats = Object.assign(player.stats, d.player.stats);
  const mags = Object.assign(player.mags, d.player.mags);
  const gear = Object.assign(player.gear, d.player.gear);
  Object.assign(player, d.player);
  player.inv = inv; player.stats = stats; player.mags = mags; player.gear = gear;
  // older saves kept owned weapons as flags (and the bat, armour and flashlight as their own)
  const owned = player.owned || {knife:true};
  if(player.hasBat) owned.bat = true;
  if(player.hasArmor) gear.armor = true;
  if(player.hasFlash) gear.flash = true;
  delete player.hasBat; delete player.hasArmor; delete player.hasFlash; delete player.owned;
  const real = id=>!!(id && WEAPONS[id] && id!=='fist');
  if(!real(player.weapon)) player.weapon = 'knife';
  // saves from before weapon slots: equip the weapon in hand plus the best of the rest
  if(!d.player.slots){
    const rest = WEAPON_ORDER.filter(id=>owned[id] && id!==player.weapon).reverse();
    player.slots = [player.weapon, rest[0]||null, rest[1]||null];
  }
  player.slots = player.slots.slice(0,WEAPON_SLOTS).map(id=>real(id) ? id : null);
  while(player.slots.length<WEAPON_SLOTS) player.slots.push(null);
  // saves from before durability: slotted weapons start fresh, and every other owned weapon moves into the bag
  if(!d.player.spares) player.spares = WEAPON_ORDER.filter(id=>owned[id] && player.slots.indexOf(id)<0).map(newWeapon);
  player.spares = player.spares.filter(validWeapon);
  const dur = {};
  equippedWeapons().forEach(id=>{ dur[id] = (d.player.dur && d.player.dur[id]>0) ? d.player.dur[id] : WEAPONS[id].dur; });
  player.dur = dur;
  fixHand();
  if(!(player.bagLvl>=0)) player.bagLvl = gear.backpack ? 2 : 0;
  delete gear.backpack;
  bossDay = d.bossDay || 0;
  markers = d.markers || [];
  checkpoint = structGrid[d.checkpoint] ? d.checkpoint : -1;

  zombies = d.zombies;
  zombies.forEach(z=>{ if(z.kind==='boss') initBoss(z); });
  day = d.day; worldTime = d.worldTime; survivalTime = d.survivalTime;
  killCount = d.killCount; totalLoot = d.totalLoot; spawnTimer = d.spawnTimer;

  resetGround(d.groundSeed);
  computeFlow();
  snapCamera();
  renderDifficulty();
  return true;
}

function refreshSaveUI(){
  let html = '';
  for(let i=0;i<SAVE_SLOTS;i++){
    const d = readSave(i), df = d && DIFFICULTIES[d.difficulty];
    html += '<button class="slot-btn'+(i===settings.slot?' sel':'')+(d?'':' empty')+'" data-slot="'+i+'"><b>'+Tf('슬롯 {n}',{n:i+1})+'</b>'+
            '<span>'+(d ? Tf('{n}일차',{n:d.day})+' · LV '+d.player.level+(df?' · '+df.name:'') : T('비어 있음'))+'</span>'+
            '<small>'+(d ? new Date(d.savedAt).toLocaleString(LOCALES[settings.lang]) : '—')+'</small></button>';
  }
  document.getElementById('slotRow').innerHTML = html;
  const d = readSave();
  document.getElementById('continueBtn').classList.toggle('hidden', !d);
  document.getElementById('loadBtn').classList.toggle('hidden', !d);
  document.getElementById('slotDel').classList.toggle('hidden', !d);
}
// New game in the chosen slot; a save already there is erased, after asking.
function newGame(){
  const go = ()=>{
    deleteSave();
    ensureAudio();
    if(touch.on) enterFullscreen(); // a phone: use the whole screen
    resetGame();
    gameState = 'playing';
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('overOverlay').classList.add('hidden');
    showToast(Tf('{n}일차',{n:1}),'재료를 모아 거점을 지으세요');
  };
  if(readSave()) askConfirm(Tf('슬롯 {n}에 저장된 게임이 있습니다. 새 게임을 시작하면 그 저장은 지워집니다.',{n:settings.slot+1}), go);
  else go();
}

/* ---------- yes / no question over everything else ---------- */
let confirmOpen = false, confirmYes = null;
function askConfirm(text,onYes){
  confirmOpen = true; confirmYes = onYes;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmOverlay').classList.remove('hidden');
}
function closeConfirm(yes){
  if(!confirmOpen) return;
  confirmOpen = false;
  document.getElementById('confirmOverlay').classList.add('hidden');
  const fn = confirmYes; confirmYes = null;
  if(yes && fn) fn();
}
document.getElementById('confirmYes').addEventListener('click', ()=>closeConfirm(true));
document.getElementById('confirmNo').addEventListener('click', ()=>closeConfirm(false));
document.getElementById('slotRow').addEventListener('click', e=>{
  const b = e.target.closest('[data-slot]');
  if(!b) return;
  settings.slot = parseInt(b.dataset.slot,10);
  saveSettings();
  refreshSaveUI();
});
document.getElementById('slotDel').addEventListener('click', ()=>{
  askConfirm(Tf('슬롯 {n}의 저장을 삭제할까요? 되돌릴 수 없습니다.',{n:settings.slot+1}), deleteSave);
});
function continueFromSave(){
  ensureAudio();
  if(touch.on) enterFullscreen();
  if(!loadGame()){ refreshSaveUI(); return; }
  gameState = 'playing';
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('overOverlay').classList.add('hidden');
  updateHUD();
  showToast(Tf('{n}일차',{n:day}),'저장된 게임을 불러왔습니다');
}

document.getElementById('continueBtn').addEventListener('click', continueFromSave);
document.getElementById('loadBtn').addEventListener('click', continueFromSave);
document.getElementById('saveBtn').addEventListener('click', ()=>{
  const ok = saveGame();
  document.getElementById('saveMsg').textContent = T(ok ? '저장했습니다.' : '저장에 실패했습니다 (브라우저 저장소를 사용할 수 없음).');
});
refreshSaveUI();
