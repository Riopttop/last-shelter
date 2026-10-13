'use strict';

/* ============================================================
   CONFIG
============================================================ */
const WORLD_W = 12000, WORLD_H = 9000;
const CELL = 40, GW = WORLD_W/CELL, GH = WORLD_H/CELL;
const WALL_T = 20;
const PLAYER_SPEED = 195;
const PLAYER_R = 13;
const DAY_LEN = 240;          // seconds per full day
const BUILD_RANGE = 230;
const PICKUP_RANGE = 46;
const GRACE_TIME = 75;        // seconds before the first zombie appears
const BOSS_EVERY = 5;         // a boss arrives at nightfall every N days
const FLOW_R = 56;            // cells around the player covered by the zombie flow field
const LEASH = 2700;           // zombies left further behind than this are dropped (the boss catches up instead)
const SWING_T = 0.28, DRAW_T = 0.22; // melee swing / weapon draw animation length, seconds
const MAX_MARKERS = 40;
const ADMIN = false;          // true: F2 / ` opens the test panel (boss summoning, god mode); keep false to ship

// base = always listed on the HUD; stack = how many fit in one bag slot (default STACK);
// wt = kg per unit, counted against the carry capacity
const ITEMS = {
  wood:  {name:'목재',     color:'#b98a4e', base:true, wt:0.5, desc:'방벽과 도구의 기본 재료'},
  stone: {name:'돌',       color:'#9a9a90', base:true, wt:0.8, desc:'무겁지만 어디에나 쓰이는 건축 재료'},
  metal: {name:'고철',     color:'#8fa0a8', base:true, wt:0.6, desc:'폐차와 잔해에서 뜯어낸 쇳조각'},
  cloth: {name:'천',       color:'#c9bfa0', base:true, wt:0.1, desc:'갑옷·가방·밧줄의 재료'},
  food:  {name:'통조림',   color:'#c3d16a', food:true, stack:10, wt:0.4, eat:{hunger:28}, desc:'따서 바로 먹는 통조림 · 요리 재료로도 씁니다'},
  medkit:{name:'구급상자', color:'#e06a5a', base:true, stack:5, wt:0.5, desc:'클릭 또는 {heal} — 체력 +40'}, // {action} in a text = the key bound to it (settings.js)
  ammo:  {name:'탄약',     color:'#f0c85a', stack:120, wt:0.02, desc:'일반 총기 공용 예비탄'},
  coal:  {name:'석탄',     color:'#6a6a74', wt:0.4, desc:'화약·강철·연료를 만드는 데 씁니다'},
  sulfur:{name:'유황',     color:'#d8c93a', wt:0.3, desc:'석탄과 섞어 화약을 만듭니다'},
  ore:   {name:'철광석',   color:'#b8705a', wt:0.9, desc:'석탄으로 제련하면 강철이 됩니다'},
  herb:  {name:'약초',     color:'#6fbf5a', wt:0.05, desc:'구급상자·스튜·연료의 재료'},
  fuel:  {name:'연료',     color:'#d0703a', stack:10, wt:1, desc:'화염방사기의 탄 · 화염병의 재료'},
  gunpowder:{name:'화약',  color:'#8a8f9a', wt:0.1, desc:'탄약과 폭발물의 재료'},
  steel: {name:'강철',     color:'#c8d6e0', stack:20, wt:0.8, desc:'상급 무기와 방벽의 재료'},
  parts: {name:'부품',     color:'#d9a528', stack:20, wt:0.3, desc:'총기와 장비의 기계 부품'},
  rope:  {name:'밧줄',     color:'#b89a62', stack:20, wt:0.3, desc:'천을 꼬아 만든 밧줄'},
  grenade:{name:'수류탄',  color:'#7f9a4a', stack:5, wt:0.5, desc:'{grenade} 키로 던집니다 · 유탄 발사기의 탄'},
  molotov:{name:'화염병',  color:'#e8642a', stack:5, wt:0.7, desc:'{molotov} 키로 던집니다 · 불바다'},
  // food = shown in the T dial and summed on the HUD; eat = {hunger, hp} gained by eating one.
  // Found as loot:
  bread:   {name:'빵',       color:'#d9a868', food:true, stack:10, wt:0.2, eat:{hunger:18}, desc:'딱딱하게 굳었지만 먹을 만합니다'},
  bar:     {name:'에너지바', color:'#c98a4a', food:true, stack:20, wt:0.1, eat:{hunger:12}, desc:'가볍고 오래 가는 비상식량'},
  potato:  {name:'감자',     color:'#b89466', food:true, stack:20, wt:0.2, eat:{hunger:8}, desc:'날로도 먹지만 화로에서 구우면 훨씬 든든합니다'},
  rice:    {name:'쌀',       color:'#e8e2cc', food:true, stack:20, wt:0.2, desc:'날로는 못 먹습니다 — 화로에서 밥을 지으세요'},
  meat:    {name:'생고기',   color:'#c0504a', food:true, stack:10, wt:0.4, eat:{hunger:12,hp:-10}, desc:'날로 먹으면 탈이 납니다 — 화로에서 구우세요'},
  mushroom:{name:'버섯',     color:'#c9a07a', food:true, stack:20, wt:0.05, eat:{hunger:6}, desc:'나무를 베다 보면 나옵니다 · 수프 재료'},
  // Cooked at a stove:
  bakedpotato:{name:'구운 감자',     color:'#c98f4a', food:true, stack:10, wt:0.2, eat:{hunger:30}, desc:'화로에서 구운 감자'},
  ricebowl:   {name:'밥',            color:'#f0ead8', food:true, stack:10, wt:0.3, eat:{hunger:36}, desc:'갓 지은 밥 한 그릇'},
  steak:      {name:'구운 고기',     color:'#9a5a34', food:true, stack:10, wt:0.3, eat:{hunger:45,hp:10}, desc:'잘 익힌 고기 · 체력도 조금 회복'},
  mushsoup:   {name:'버섯 수프',     color:'#c9b48a', food:true, stack:5,  wt:0.4, eat:{hunger:40,hp:12}, desc:'버섯과 약초를 끓인 따뜻한 수프'},
  friedrice:  {name:'통조림 볶음밥', color:'#d9b45a', food:true, stack:5,  wt:0.5, eat:{hunger:65}, desc:'통조림을 넣고 볶은 든든한 한 끼'},
  stew:       {name:'고기 스튜',     color:'#a8522a', food:true, stack:5,  wt:0.6, eat:{hunger:85,hp:25}, desc:'고기·감자·약초를 푹 끓인 최고의 식사'},
};

const BUILD_DEFS = [
  {id:'woodwall',  name:'목재 방벽', cost:{wood:4},          hp:140, blockP:true,  blockZ:true},
  {id:'metalwall', name:'철제 방벽', cost:{metal:5,stone:2}, hp:380, blockP:true,  blockZ:true},
  {id:'steelwall', name:'강철 방벽', cost:{steel:3,stone:2}, hp:820, blockP:true,  blockZ:true},
  {id:'door',      name:'문',        cost:{wood:5,metal:1},  hp:120, blockP:false, blockZ:true},
  {id:'spikes',    name:'가시 함정', cost:{wood:3,metal:2},  hp:60,  blockP:false, blockZ:false},
  {id:'mine',      name:'지뢰',      cost:{metal:2,gunpowder:2}, hp:1, blockP:false, blockZ:false},
  {id:'campfire',  name:'모닥불',    cost:{wood:5,stone:3},  hp:60,  blockP:false, blockZ:false},
  {id:'workbench', name:'제작대',    cost:{wood:10,metal:4}, hp:160, blockP:true,  blockZ:true},
  {id:'chest',     name:'보관함',    cost:{wood:8,metal:2},  hp:180, blockP:true,  blockZ:true},
  {id:'outpost',   name:'거점 깃발', cost:{wood:12,cloth:4,metal:4}, hp:260, blockP:true, blockZ:true},
  {id:'stove',     name:'화로 조리대', cost:{stone:8,metal:3,wood:4}, hp:150, blockP:true, blockZ:true},
  {id:'turret',    name:'자동 포탑', cost:{metal:14,parts:4,wood:4}, hp:220, blockP:true, blockZ:true},
  {id:'lamp',      name:'조명탑',    cost:{metal:6,parts:1,wood:4},  hp:120, blockP:true, blockZ:true},
];
// Turret: shoots the nearest zombie in sight out of its own magazine, which the player fills (E) from the bag.
const TURRET = {range:300, cd:0.45, dmg:16, ammoMax:120, ammoStart:30};
const LAMP_R = 320;  // radius a light tower keeps lit at night
const BLOAT_R = 88;  // burst radius of a bloater

// Melee: range, cd = seconds between swings, arc = half-angle of the hit cone, knock = knockback,
//        chop / mine = yield multiplier on trees / rocks.
// Guns:  mag = rounds per magazine, reload = seconds, ammo = reserve spent per round loaded,
//        ammoKey = item used as the reserve (default 'ammo'), magCost = units of ammoKey for a whole magazine,
//        ex = explosion radius, flame = short-lived fire stream.
// len = blade / barrel length drawn in the player's hands
const WEAPONS = {
  knife:   {name:'단검',       melee:true, dmg:38,  range:46, cd:0.42, arc:1.15, knock:140, len:12},
  bat:     {name:'못 방망이',  melee:true, dmg:62,  range:58, cd:0.46, arc:1.15, knock:200, len:22},
  // axes and pickaxes come in three tiers (stone, iron, steel): tier = what a pickaxe can dig out (VEIN_TIER),
  // look = the weapon whose shape is drawn for it
  axe:     {name:'돌 도끼',     melee:true, dmg:50,  range:52, cd:0.5,  arc:1.15, knock:160, len:22, chop:2,   tier:1},
  axe2:    {name:'철 도끼',     melee:true, dmg:60,  range:52, cd:0.48, arc:1.15, knock:170, len:22, chop:3,   tier:2, look:'axe'},
  axe3:    {name:'강철 도끼',   melee:true, dmg:74,  range:52, cd:0.44, arc:1.15, knock:190, len:22, chop:4,   tier:3, look:'axe'},
  pickaxe: {name:'돌 곡괭이',   melee:true, dmg:44,  range:52, cd:0.55, arc:1.1,  knock:160, len:23, mine:2,   tier:1},
  pickaxe2:{name:'철 곡괭이',   melee:true, dmg:52,  range:52, cd:0.52, arc:1.1,  knock:170, len:23, mine:2.5, tier:2, look:'pickaxe'},
  pickaxe3:{name:'강철 곡괭이', melee:true, dmg:62,  range:52, cd:0.48, arc:1.1,  knock:180, len:23, mine:3.5, tier:3, look:'pickaxe'},
  spear:   {name:'창',         melee:true, dmg:58,  range:86, cd:0.5,  arc:0.5,  knock:180, len:34},
  machete: {name:'마체테',     melee:true, dmg:84,  range:58, cd:0.36, arc:1.25, knock:140, len:26, chop:1.5},
  sledge:  {name:'강철 해머',  melee:true, dmg:130, range:56, cd:0.8,  arc:1.2,  knock:380, len:24, mine:2},
  pistol:  {name:'권총',     mag:12, reload:1.1, ammo:1, dmg:24,  cd:0.2,   pellets:1, spread:0.015, speed:800,  life:0.8,  pierce:0, len:14, shake:3, snd:'shoot'},
  revolver:{name:'리볼버',   mag:6,  reload:1.7, ammo:1, dmg:64,  cd:0.42,  pellets:1, spread:0.01,  speed:950,  life:0.8,  pierce:1, len:15, shake:5, snd:'shotgun'},
  smg:     {name:'기관단총', mag:30, reload:1.6, ammo:1, dmg:15,  cd:0.085, pellets:1, spread:0.07,  speed:780,  life:0.6,  pierce:0, len:18, shake:2, snd:'shoot'},
  shotgun: {name:'산탄총',   mag:6,  reload:2.0, ammo:2, dmg:13,  cd:0.75,  pellets:6, spread:0.2,   speed:710,  life:0.36, pierce:0, len:22, shake:6, snd:'shotgun'},
  rifle:   {name:'소총',     mag:20, reload:1.8, ammo:1, dmg:42,  cd:0.32,  pellets:1, spread:0.008, speed:1000, life:0.9,  pierce:1, len:26, shake:4, snd:'shoot'},
  lmg:     {name:'경기관총', mag:60, reload:3.2, ammo:1, dmg:23,  cd:0.07,  pellets:1, spread:0.06,  speed:880,  life:0.75, pierce:1, len:28, shake:3, snd:'shoot'},
  sniper:  {name:'저격총',   mag:5,  reload:2.4, ammo:2, dmg:150, cd:1.1,   pellets:1, spread:0,     speed:1400, life:0.9,  pierce:4, len:32, shake:7, snd:'shotgun'},
  flamer:  {name:'화염방사기', mag:40, reload:2.2, ammoKey:'fuel', magCost:1, dmg:9, cd:0.05, pellets:1, spread:0.16, speed:430, life:0.42, pierce:6, len:20, shake:0, snd:'flame', flame:true},
  launcher:{name:'유탄 발사기', mag:1, reload:1.5, ammoKey:'grenade', ammo:1, dmg:150, cd:0.5, pellets:1, spread:0.01, speed:640, life:0.6, pierce:0, len:22, shake:8, snd:'shotgun', ex:120},
};
const WEAPON_ORDER = ['knife','bat','axe','axe2','axe3','pickaxe','pickaxe2','pickaxe3','spear','machete','sledge','pistol','revolver','smg','shotgun','rifle','lmg','sniper','flamer','launcher'];
// kg a weapon weighs, whether it sits in a weapon slot or in the bag
const WEAPON_WT = {knife:0.4, bat:1.5, axe:2, axe2:2.2, axe3:2.4, pickaxe:2.5, pickaxe2:2.7, pickaxe3:2.9, spear:2, machete:1.2, sledge:5,
                   pistol:1, revolver:1.2, smg:3, shotgun:3.5, rifle:4, lmg:9, sniper:6.5, flamer:8, launcher:6};
// Durability: melee weapons lose 1 per swing that lands (on a zombie or something harvested), guns 1 per shot.
// At 0 the weapon breaks and is gone; '무기 수리' at a workbench restores it.
const WEAPON_DUR = {knife:120, bat:140, axe:90, axe2:190, axe3:380, pickaxe:90, pickaxe2:190, pickaxe3:380, spear:130, machete:220, sledge:260,
                    pistol:300, revolver:220, smg:700, shotgun:160, rifle:450, lmg:1200, sniper:120, flamer:2000, launcher:60};
WEAPON_ORDER.forEach(id=>{ WEAPONS[id].id = id; WEAPONS[id].wt = WEAPON_WT[id]; WEAPONS[id].dur = WEAPON_DUR[id]; });
// bare hands: what is left when every slot is empty; never breaks, cannot be dropped
WEAPONS.fist = {id:'fist', name:'맨손', melee:true, dmg:14, range:38, cd:0.4, arc:1.1, knock:120, len:0, wt:0, dur:Infinity};
// head colour of a tiered tool, by tier
const TIER_COL = ['', '#9a9a90', '#b8c6cc', '#e2eef6'];
const TIER_NAME = ['', '돌', '철', '강철'];

// worn equipment; the effects are read through the helpers in progression.js
const GEAR = {
  armor:     {name:'누더기 갑옷'},
  steelarmor:{name:'강철 갑옷'},
  helmet:    {name:'헬멧'},
  boots:     {name:'가죽 장화'},
  gloves:    {name:'작업 장갑'},
  bandolier: {name:'탄띠'},
  flash:     {name:'강화 손전등'},
};

// Bag: every stack of an item takes one slot. BAG_SLOTS[level] = slots at that bag level.
const STACK = 40;
const BAG_SLOTS = [10,16,22,30];
const BAG_NAME = ['작은 가방','배낭','대형 배낭','군용 배낭'];
// Weight: BAG_WEIGHT[level] kg (+STR_CARRY per 힘 point) can be carried at full speed. Above that the
// player walks slower, and OVERLOAD_MAX times the capacity is the hard limit: nothing more can be picked up.
const BAG_WEIGHT = [30,45,62,85];
const STR_CARRY = 3;
const OVERLOAD_MAX = 1.3;
const OVERLOAD_SPEED = [0.8,0.5]; // walking speed just over the capacity / at the hard limit
const CHEST_SLOTS = 24;
const CHEST_LINK = 260; // chests this close to the player count as part of the bag for building, crafting and cooking
const WEAPON_SLOTS = 3;
// F with no melee weapon equipped: a shove with the gun
const GUN_BUTT = {name:'개머리판', melee:true, dmg:20, range:42, cd:0.5, arc:1, knock:180, len:10};

const GRENADE = {range:430, radius:130, dmg:170};
const MOLOTOV = {range:400, radius:74, life:6, dmg:13};
const MINE = {radius:120, dmg:160};

// how much a harvestable holds, and which tool stat multiplies its yield
const RES_MAX = {tree:6, deadtree:3, car:6, rubble:5, barricade:3, rock:8};
const HARVEST_KIND = {tree:'chop', deadtree:'chop', barricade:'chop', rock:'mine', rubble:'mine'};
const HARVEST_NAME = {tree:'나무 베기', deadtree:'고목 베기', barricade:'바리케이드 뜯기', rock:'바위 캐기', rubble:'잔해 뒤지기', car:'폐차 뜯기'};
const HARVEST_RANGE = 44;
const VEIN_COL = {coal:'#1e1e22', sulfur:'#d8c93a', ore:'#b0603e'};
// pickaxe tier needed before a vein gives up its mineral; any rock still yields stone
const VEIN_TIER = {coal:1, ore:2, sulfur:3};

const CRAFT_TABS = [
  {id:'tool', name:'도구·근접'},
  {id:'gun',  name:'총기'},
  {id:'gear', name:'장비'},
  {id:'use',  name:'소모품'},
  {id:'cook', name:'요리', station:'stove'},
  {id:'mat',  name:'재료 가공', station:'stove'}, // station = the structure whose panel lists the tab (default: workbench)
];
// weapon = WEAPONS id unlocked, gear = GEAR id unlocked, gives = stackable items produced, lvl = player level required
const RECIPES = [
  // from = the tool this one is forged out of (it is used up); repair = restores the weapon in hand
  {id:'repair',  cat:'tool', name:'무기 수리',   desc:'손에 든 무기의 내구도를 끝까지 되돌립니다', cost:{metal:2,cloth:1}, repair:true},
  {id:'axe',     cat:'tool', name:'돌 도끼',     desc:'나무를 벨 때 목재를 더 많이 얻습니다',   cost:{wood:6,stone:4}, weapon:'axe'},
  {id:'axe2',    cat:'tool', name:'철 도끼',     desc:'돌 도끼를 고철로 다시 벼립니다',         cost:{metal:8,wood:3}, weapon:'axe2', from:'axe', lvl:3},
  {id:'axe3',    cat:'tool', name:'강철 도끼',   desc:'철 도끼를 강철로 다시 벼립니다',         cost:{steel:5,wood:3}, weapon:'axe3', from:'axe2', lvl:6},
  {id:'pickaxe', cat:'tool', name:'돌 곡괭이',   desc:'바위에서 돌과 석탄을 캡니다',            cost:{wood:6,stone:5}, weapon:'pickaxe'},
  {id:'pickaxe2',cat:'tool', name:'철 곡괭이',   desc:'철광석까지 캘 수 있습니다',              cost:{metal:8,wood:3}, weapon:'pickaxe2', from:'pickaxe', lvl:3},
  {id:'pickaxe3',cat:'tool', name:'강철 곡괭이', desc:'유황까지, 모든 광맥을 캘 수 있습니다',   cost:{steel:5,wood:3}, weapon:'pickaxe3', from:'pickaxe2', lvl:6},
  {id:'bat',     cat:'tool', name:'못 방망이',  desc:'단검보다 길고 묵직한 한 방',            cost:{wood:8,metal:4}, weapon:'bat'},
  {id:'spear',   cat:'tool', name:'창',         desc:'아주 긴 사거리, 좁은 공격 범위',        cost:{wood:6,metal:3,rope:1}, weapon:'spear', lvl:3},
  {id:'machete', cat:'tool', name:'마체테',     desc:'빠르고 강한 베기',                      cost:{steel:4,wood:2,cloth:1}, weapon:'machete', lvl:5},
  {id:'sledge',  cat:'tool', name:'강철 해머',  desc:'느리지만 좀비를 날려 버립니다',         cost:{steel:8,wood:4}, weapon:'sledge', lvl:7},

  {id:'pistol',  cat:'gun', name:'권총',        desc:'기본 총기',                 cost:{metal:8,wood:2}, weapon:'pistol', lvl:2},
  {id:'revolver',cat:'gun', name:'리볼버',      desc:'강력한 한 발 · 관통',       cost:{metal:10,parts:2}, weapon:'revolver', lvl:3},
  {id:'shotgun', cat:'gun', name:'산탄총',      desc:'근거리 광역 (1발당 탄약 2)', cost:{metal:14,wood:6}, weapon:'shotgun', lvl:4},
  {id:'smg',     cat:'gun', name:'기관단총',    desc:'빠른 연사',                 cost:{metal:16,cloth:3,parts:2}, weapon:'smg', lvl:5},
  {id:'flamer',  cat:'gun', name:'화염방사기',  desc:'연료 1통으로 탄창을 채우는 화염 줄기', cost:{metal:16,parts:4,rope:2}, weapon:'flamer', lvl:6},
  {id:'rifle',   cat:'gun', name:'소총',        desc:'높은 피해 · 관통',          cost:{metal:14,steel:4,wood:8,parts:2}, weapon:'rifle', lvl:7},
  {id:'launcher',cat:'gun', name:'유탄 발사기', desc:'수류탄을 쏘아 폭발시킵니다', cost:{steel:8,parts:6,wood:4}, weapon:'launcher', lvl:8},
  {id:'lmg',     cat:'gun', name:'경기관총',    desc:'대용량 탄창의 제압 사격',   cost:{steel:10,metal:20,parts:5}, weapon:'lmg', lvl:9},
  {id:'sniper',  cat:'gun', name:'저격총',      desc:'초고피해 · 다중 관통 (1발당 탄약 2)', cost:{steel:8,metal:20,parts:4,cloth:4}, weapon:'sniper', lvl:10},

  {id:'armor',     cat:'gear', name:'누더기 갑옷', desc:'받는 피해 -35%',                  cost:{cloth:8,metal:5}, gear:'armor'},
  {id:'steelarmor',cat:'gear', name:'강철 갑옷',   desc:'받는 피해 -50% (누더기 갑옷 대체)', cost:{steel:6,cloth:4,rope:2}, gear:'steelarmor', lvl:6},
  {id:'helmet',    cat:'gear', name:'헬멧',        desc:'받는 피해 추가 -10%',             cost:{metal:6,cloth:2}, gear:'helmet', lvl:2},
  {id:'boots',     cat:'gear', name:'가죽 장화',   desc:'이동 속도 +8%',                   cost:{cloth:6,rope:2}, gear:'boots'},
  {id:'gloves',    cat:'gear', name:'작업 장갑',   desc:'근접 공격·채집 속도 +15%',        cost:{cloth:4,rope:1}, gear:'gloves'},
  {id:'bag1',      cat:'gear', name:'배낭',        desc:'가방 칸 10 → 16 · 적재량 30 → 45kg', cost:{cloth:6,rope:1}, bag:1},
  {id:'bag2',      cat:'gear', name:'대형 배낭',   desc:'가방 칸 16 → 22 · 적재량 45 → 62kg', cost:{cloth:10,rope:3,metal:2}, bag:2, lvl:3},
  {id:'bag3',      cat:'gear', name:'군용 배낭',   desc:'가방 칸 22 → 30 · 적재량 62 → 85kg', cost:{cloth:14,rope:5,steel:3,parts:2}, bag:3, lvl:6},
  {id:'bandolier', cat:'gear', name:'탄띠',        desc:'재장전 속도 +25%',                cost:{cloth:5,rope:2,parts:1}, gear:'bandolier', lvl:4},
  {id:'flash',     cat:'gear', name:'강화 손전등', desc:'밤 시야 확대',                    cost:{metal:4,cloth:2}, gear:'flash'},

  {id:'ammo',    cat:'use', name:'탄약 ×10',      desc:'일반 총기 공용 예비탄',       cost:{metal:2,gunpowder:1}, gives:{ammo:10}},
  {id:'ammobox', cat:'use', name:'탄약 상자 ×40', desc:'강철 탄피로 대량 생산',       cost:{steel:2,gunpowder:3}, gives:{ammo:40}, lvl:5},
  {id:'grenade', cat:'use', name:'수류탄',        desc:'{grenade} 키로 던집니다 · 넓은 폭발', cost:{metal:2,gunpowder:2}, gives:{grenade:1}},
  {id:'molotov', cat:'use', name:'화염병',        desc:'{molotov} 키로 던집니다 · 불바다', cost:{cloth:1,fuel:1}, gives:{molotov:1}},
  {id:'medkit',  cat:'use', name:'구급상자',      desc:'체력 +40',                    cost:{cloth:3,food:1}, gives:{medkit:1}},
  {id:'herbkit', cat:'use', name:'약초 구급상자', desc:'약초로 만든 구급상자',        cost:{herb:3,cloth:1}, gives:{medkit:1}},

  {id:'gunpowder',cat:'mat', name:'화약 ×3',   desc:'탄약·폭발물의 재료',        cost:{coal:1,sulfur:1}, gives:{gunpowder:3}},
  {id:'steel',    cat:'mat', name:'강철',      desc:'철광석을 석탄으로 제련',    cost:{ore:2,coal:1}, gives:{steel:1}},
  {id:'parts',    cat:'mat', name:'부품',      desc:'총기와 장비의 기계 부품',   cost:{metal:3}, gives:{parts:1}},
  {id:'rope',     cat:'mat', name:'밧줄',      desc:'천을 꼬아 만든 밧줄',       cost:{cloth:2}, gives:{rope:1}},
  {id:'charcoal', cat:'mat', name:'숯 (석탄)', desc:'목재를 태워 석탄 대용으로', cost:{wood:4}, gives:{coal:1}},
  {id:'fuel',     cat:'mat', name:'연료',      desc:'석탄과 약초를 증류',        cost:{coal:2,herb:1}, gives:{fuel:1}},

  // cooked at a 화로 조리대; every dish burns one piece of wood
  {id:'bakedpotato', cat:'cook', name:'구운 감자',     desc:'감자 두 알을 불에 굽습니다',           cost:{potato:2,wood:1}, gives:{bakedpotato:1}},
  {id:'ricebowl',    cat:'cook', name:'밥',            desc:'쌀로 밥을 짓습니다',                   cost:{rice:2,wood:1}, gives:{ricebowl:1}},
  {id:'steak',       cat:'cook', name:'구운 고기',     desc:'생고기를 익혀 탈 없이 먹습니다',       cost:{meat:1,wood:1}, gives:{steak:1}},
  {id:'mushsoup',    cat:'cook', name:'버섯 수프',     desc:'버섯과 약초를 끓인 수프',              cost:{mushroom:3,herb:1,wood:1}, gives:{mushsoup:1}},
  {id:'friedrice',   cat:'cook', name:'통조림 볶음밥', desc:'쌀과 통조림을 함께 볶습니다',          cost:{rice:1,food:1,wood:1}, gives:{friedrice:1}},
  {id:'stew',        cat:'cook', name:'고기 스튜',     desc:'가장 든든한 식사 · 체력도 회복',       cost:{meat:1,potato:1,herb:1,wood:1}, gives:{stew:1}},
];

const BUILDING_TYPES = {
  house:    {name:'주택',   floor:'wood',     container:'수납장', bias:['food','bread','potato','rice','meat','cloth','wood','medkit','herb'],
             wall:'#5a4e3e', roof:'#7a4630', roofDark:'#58301f'},
  store:    {name:'상점',   floor:'tile',     container:'진열대', bias:['food','food','bread','bread','bar','bar','rice','potato','meat','medkit','cloth','rope'],
             wall:'#56584c', roof:'#4f6a5e', roofDark:'#374b42'},
  warehouse:{name:'창고',   floor:'concrete', container:'상자',   bias:['wood','metal','metal','stone','coal','ore','rope'],
             wall:'#4c4a42', roof:'#6f6238', roofDark:'#4e4426'},
  police:   {name:'경찰서', floor:'tile',     container:'사물함', bias:['ammo','ammo','medkit','metal','gunpowder','gunpowder'],
             wall:'#4a505a', roof:'#44546e', roofDark:'#2f3b50'},
  hospital: {name:'병원',   floor:'tile',     container:'약품함', bias:['medkit','cloth','cloth','food','bar','herb','herb'],
             wall:'#5c605c', roof:'#8a8f88', roofDark:'#62675f'},
  garage:   {name:'정비소', floor:'concrete', container:'공구함', bias:['metal','metal','ammo','wood','parts','parts','fuel','fuel'],
             wall:'#4e4640', roof:'#6a4a3a', roofDark:'#47312a'},
};
const BUILDING_ORDER = ['house','store','house','warehouse','police','house','garage','store','warehouse','house','hospital','house'];

// map markers the player can drop on the full map (M)
const MARKER_TYPES = [
  {id:'base',   name:'거점 후보', color:'#8fd16a'},
  {id:'loot',   name:'보급',      color:'#f0c85a'},
  {id:'danger', name:'위험',      color:'#e04b4b'},
  {id:'goal',   name:'목표',      color:'#7ab8e8'},
];
