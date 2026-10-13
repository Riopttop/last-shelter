'use strict';

/* ============================================================
   PROGRESSION — difficulty, levels, stats
============================================================ */
const DIFFICULTIES = {
  easy:      {name:'쉬움', desc:'좀비가 약하고 물자가 넉넉합니다',   zHp:0.75, zDmg:0.6, spawn:0.75, cap:0.8,  hunger:0.75, loot:1.3,  xp:0.8},
  normal:    {name:'보통', desc:'기본 균형',                         zHp:1,    zDmg:1,   spawn:1,    cap:1,    hunger:1,    loot:1,    xp:1},
  hard:      {name:'어려움', desc:'좀비가 강하고 물자가 줄어듭니다', zHp:1.3,  zDmg:1.4, spawn:1.3,  cap:1.25, hunger:1.2,  loot:0.85, xp:1.25},
  nightmare: {name:'악몽', desc:'끝없는 무리, 부족한 물자',          zHp:1.7,  zDmg:1.9, spawn:1.7,  cap:1.5,  hunger:1.4,  loot:0.7,  xp:1.6},
};
let difficulty = 'normal';
function diff(){ return DIFFICULTIES[difficulty]; }

const STAT_MAX = 10;
const STAT_DEFS = [
  {id:'vit', name:'체력', desc:'최대 체력 +15'},
  {id:'str', name:'힘',   desc:'근접 피해 +12% · 채집량 증가 · 적재량 +3kg'},
  {id:'aim', name:'사격', desc:'총기 피해 +10% · 연사 속도 +4%'},
  {id:'agi', name:'민첩', desc:'이동 속도 +4%'},
  {id:'sur', name:'생존', desc:'허기 소모 -7% · 줍기 범위 증가'},
  {id:'eng', name:'건축', desc:'새 구조물 내구도 +12%'},
];

function meleeMul(){ return 1 + 0.12*player.stats.str; }
function gunMul(){ return 1 + 0.10*player.stats.aim; }
function fireCdMul(){ return 1 - 0.04*player.stats.aim; }
function speedMul(){ return (1 + 0.04*player.stats.agi) * (player.gear.boots ? 1.08 : 1) * loadSpeedMul(); }
function armorMul(){ return (player.gear.steelarmor ? 0.5 : (player.gear.armor ? 0.65 : 1)) * (player.gear.helmet ? 0.9 : 1); }
function meleeCdMul(){ return player.gear.gloves ? 0.85 : 1; }
function reloadMul(){ return player.gear.bandolier ? 0.75 : 1; }
function hungerMul(){ return (1 - 0.07*player.stats.sur) * diff().hunger; }
function pickupRange(){ return PICKUP_RANGE + 5*player.stats.sur; }
function buildHpMul(){ return 1 + 0.12*player.stats.eng; }

function xpNeed(level){ return 40 + level*35; }
function gainXp(amount){
  player.xp += amount*diff().xp;
  let leveled = false;
  while(player.xp >= xpNeed(player.level)){
    player.xp -= xpNeed(player.level);
    player.level++;
    player.points++;
    leveled = true;
  }
  if(leveled){
    player.hp = Math.min(player.maxHp, player.hp+20);
    spawnFloat(player.x, player.y-44, 'LEVEL UP!', '#f0c85a');
    spawnParticles(player.x, player.y, 18, '#f0c85a', 170, 0.7, 4);
    showToast(Tf('레벨 {n}',{n:player.level}), '{stats} 키로 능력치 포인트를 사용하세요');
    sfx.levelup();
  }
}
function spendPoint(i){
  const def = STAT_DEFS[i];
  if(!def || player.points<=0 || player.stats[def.id]>=STAT_MAX){ sfx.deny(); return; }
  player.points--;
  player.stats[def.id]++;
  if(def.id==='vit'){ player.maxHp += 15; player.hp += 15; }
  sfx.loot();
  renderPauseMenu();
  updateHUD();
}

/* ---------- pause menu: stats + difficulty + save ---------- */
function openPause(){
  if(gameState!=='playing') return;
  setCraftOpen(false); setInvOpen(false);
  gameState = 'paused';
  for(const k in keys) keys[k]=false;
  mouse.down=false; mouse.rdown=false;
  document.getElementById('saveMsg').textContent = '';
  renderPauseMenu();
  document.getElementById('pauseOverlay').classList.remove('hidden');
}
function closePause(){
  if(gameState!=='paused') return;
  gameState = 'playing';
  document.getElementById('pauseOverlay').classList.add('hidden');
}
function renderPauseMenu(){
  document.getElementById('lvlLine').textContent =
    'LV '+player.level+' · XP '+Math.floor(player.xp)+' / '+xpNeed(player.level)+' · '+T('포인트')+' '+player.points;
  const list = document.getElementById('statList');
  list.innerHTML = '';
  STAT_DEFS.forEach((d,i)=>{
    const v = player.stats[d.id];
    const can = player.points>0 && v<STAT_MAX;
    const b = document.createElement('button');
    b.className = 'stat-row'+(can?'':' na');
    let pips = '';
    for(let p=0;p<STAT_MAX;p++) pips += '<i'+(p<v?' class="on"':'')+'></i>';
    b.innerHTML = '<span class="k">'+(i+1)+'</span><span class="body">'+d.name+'<div class="d">'+d.desc+'</div></span><span class="pips">'+pips+'</span><span class="plus">+</span>';
    b.addEventListener('click',()=>spendPoint(i));
    list.appendChild(b);
  });
  renderDifficulty();
}
function renderDifficulty(){
  ['startDiff','pauseDiff'].forEach(id=>{
    const box = document.getElementById(id);
    box.innerHTML = '';
    Object.keys(DIFFICULTIES).forEach(key=>{
      const b = document.createElement('button');
      b.className = 'diff-btn'+(key===difficulty?' sel':'');
      b.textContent = DIFFICULTIES[key].name;
      b.title = DIFFICULTIES[key].desc;
      b.addEventListener('click',()=>{ difficulty = key; renderDifficulty(); });
      box.appendChild(b);
    });
    const note = document.createElement('div');
    note.className = 'diff-note';
    note.textContent = T('난이도: ')+diff().desc;
    box.appendChild(note);
  });
}
renderDifficulty();
