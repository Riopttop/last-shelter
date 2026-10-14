'use strict';

/* ============================================================
   LANGUAGE — the game is written in Korean; every other language
   is a table from the Korean source string to its translation.
   A string missing from the table is shown in Korean.
   {action} is replaced by the key bound to it (see settings.js),
   other {tokens} are filled in by Tf().
============================================================ */
const LANGS = {ko:'한국어', en:'English', ja:'日本語', zh:'中文'};
// language -> table; filled in at the end of this file and by lang_ja.js / lang_zh.js
const LANG_TABLES = {};

const LANG_EN = {
  '최후의 피난처 — 좀비 서바이벌':'Last Shelter — Zombie Survival',

  /* ---------- items ---------- */
  '목재':'Wood', '돌':'Stone', '고철':'Scrap', '천':'Cloth', '통조림':'Canned food', '구급상자':'Medkit', '탄약':'Ammo',
  '석탄':'Coal', '유황':'Sulfur', '철광석':'Iron ore', '약초':'Herb', '연료':'Fuel', '화약':'Gunpowder', '강철':'Steel',
  '부품':'Parts', '밧줄':'Rope', '수류탄':'Grenade', '화염병':'Molotov', '빵':'Bread', '에너지바':'Energy bar',
  '감자':'Potato', '쌀':'Rice', '생고기':'Raw meat', '버섯':'Mushroom', '구운 감자':'Baked potato', '밥':'Cooked rice',
  '구운 고기':'Steak', '버섯 수프':'Mushroom soup', '통조림 볶음밥':'Fried rice', '고기 스튜':'Meat stew',
  '방벽과 도구의 기본 재료':'The basic material for walls and tools',
  '무겁지만 어디에나 쓰이는 건축 재료':'Heavy, but used in everything you build',
  '폐차와 잔해에서 뜯어낸 쇳조각':'Metal stripped from wrecks and rubble',
  '갑옷·가방·밧줄의 재료':'For armour, bags and rope',
  '따서 바로 먹는 통조림 · 요리 재료로도 씁니다':'Eat it straight from the can · also a cooking ingredient',
  '클릭 또는 {heal} — 체력 +40':'Click or {heal} — health +40',
  '일반 총기 공용 예비탄':'Spare rounds shared by ordinary guns',
  '화약·강철·연료를 만드는 데 씁니다':'Used to make gunpowder, steel and fuel',
  '석탄과 섞어 화약을 만듭니다':'Mixed with coal to make gunpowder',
  '석탄으로 제련하면 강철이 됩니다':'Smelted with coal into steel',
  '구급상자·스튜·연료의 재료':'For medkits, stew and fuel',
  '화염방사기의 탄 · 화염병의 재료':'Flamethrower ammo · needed for molotovs',
  '탄약과 폭발물의 재료':'For ammo and explosives',
  '상급 무기와 방벽의 재료':'For advanced weapons and walls',
  '총기와 장비의 기계 부품':'Mechanical parts for guns and gear',
  '천을 꼬아 만든 밧줄':'Rope twisted from cloth',
  '{grenade} 키로 던집니다 · 유탄 발사기의 탄':'Throw with {grenade} · ammo for the grenade launcher',
  '{molotov} 키로 던집니다 · 불바다':'Throw with {molotov} · a sea of fire',
  '딱딱하게 굳었지만 먹을 만합니다':'Stale, but edible',
  '가볍고 오래 가는 비상식량':'Light, long-lasting emergency rations',
  '날로도 먹지만 화로에서 구우면 훨씬 든든합니다':'Edible raw, far more filling baked on a stove',
  '날로는 못 먹습니다 — 화로에서 밥을 지으세요':'Cannot be eaten raw — cook it on a stove',
  '날로 먹으면 탈이 납니다 — 화로에서 구우세요':'Makes you sick raw — grill it on a stove',
  '나무를 베다 보면 나옵니다 · 수프 재료':'Turns up when felling trees · soup ingredient',
  '화로에서 구운 감자':'A potato baked on the stove',
  '갓 지은 밥 한 그릇':'A bowl of freshly cooked rice',
  '잘 익힌 고기 · 체력도 조금 회복':'Well-done meat · restores a little health',
  '버섯과 약초를 끓인 따뜻한 수프':'A warm soup of mushrooms and herbs',
  '통조림을 넣고 볶은 든든한 한 끼':'A hearty meal fried up with canned food',
  '고기·감자·약초를 푹 끓인 최고의 식사':'Meat, potato and herbs simmered into the best meal there is',

  /* ---------- structures ---------- */
  '목재 방벽':'Wood wall', '철제 방벽':'Metal wall', '강철 방벽':'Steel wall', '문':'Door', '가시 함정':'Spike trap', '지뢰':'Mine',
  '모닥불':'Campfire', '제작대':'Workbench', '보관함':'Chest', '거점 깃발':'Outpost flag', '화로 조리대':'Cooking stove',
  '자동 포탑':'Auto turret', '조명탑':'Light tower',
  '포탑 탄약 가득':'Turret is full', '포탑 장전 +{n}':'Turret loaded +{n}', '포탑 탄약 장전 ({a} / {b})':'Load the turret ({a} / {b})',

  /* ---------- weapons / gear ---------- */
  '단검':'Knife', '못 방망이':'Nail bat', '돌 도끼':'Stone axe', '철 도끼':'Iron axe', '강철 도끼':'Steel axe',
  '돌 곡괭이':'Stone pickaxe', '철 곡괭이':'Iron pickaxe', '강철 곡괭이':'Steel pickaxe', '창':'Spear', '마체테':'Machete',
  '강철 해머':'Sledgehammer', '권총':'Pistol', '리볼버':'Revolver', '기관단총':'SMG', '산탄총':'Shotgun', '소총':'Rifle',
  '경기관총':'LMG', '저격총':'Sniper rifle', '화염방사기':'Flamethrower', '유탄 발사기':'Grenade launcher',
  '맨손':'Bare hands', '개머리판':'Gun butt', '철':'Iron',
  '누더기 갑옷':'Rag armour', '강철 갑옷':'Steel armour', '헬멧':'Helmet', '가죽 장화':'Leather boots', '작업 장갑':'Work gloves',
  '탄띠':'Bandolier', '강화 손전등':'Bright flashlight',
  '작은 가방':'Small bag', '배낭':'Backpack', '대형 배낭':'Large backpack', '군용 배낭':'Military pack',
  '나무 베기':'Chop tree', '고목 베기':'Chop dead tree', '바리케이드 뜯기':'Tear down barricade', '바위 캐기':'Mine rock',
  '잔해 뒤지기':'Dig through rubble', '폐차 뜯기':'Strip wreck',

  /* ---------- recipes ---------- */
  '도구·근접':'Tools · Melee', '총기':'Guns', '장비':'Gear', '소모품':'Supplies', '요리':'Cooking', '재료 가공':'Materials',
  '무기 수리':'Repair weapon', '탄약 ×10':'Ammo ×10', '탄약 상자 ×40':'Ammo box ×40', '약초 구급상자':'Herbal medkit',
  '화약 ×3':'Gunpowder ×3', '숯 (석탄)':'Charcoal (coal)',
  '손에 든 무기의 내구도를 끝까지 되돌립니다':'Fully restores the durability of the weapon in hand',
  '나무를 벨 때 목재를 더 많이 얻습니다':'Yields more wood when felling trees',
  '돌 도끼를 고철로 다시 벼립니다':'Reforges the stone axe with scrap',
  '철 도끼를 강철로 다시 벼립니다':'Reforges the iron axe with steel',
  '바위에서 돌과 석탄을 캡니다':'Mines stone and coal from rocks',
  '철광석까지 캘 수 있습니다':'Can also mine iron ore',
  '유황까지, 모든 광맥을 캘 수 있습니다':'Mines every vein, sulfur included',
  '단검보다 길고 묵직한 한 방':'Longer and heavier than the knife',
  '아주 긴 사거리, 좁은 공격 범위':'Very long reach, narrow arc',
  '빠르고 강한 베기':'Fast, strong slashes',
  '느리지만 좀비를 날려 버립니다':'Slow, but sends zombies flying',
  '기본 총기':'The basic gun',
  '강력한 한 발 · 관통':'One powerful shot · pierces',
  '근거리 광역 (1발당 탄약 2)':'Close-range spread (2 ammo per shell)',
  '빠른 연사':'Rapid fire',
  '연료 1통으로 탄창을 채우는 화염 줄기':'A stream of fire · one fuel can fills the tank',
  '높은 피해 · 관통':'High damage · pierces',
  '수류탄을 쏘아 폭발시킵니다':'Fires grenades that explode on impact',
  '대용량 탄창의 제압 사격':'Suppressive fire from a huge magazine',
  '초고피해 · 다중 관통 (1발당 탄약 2)':'Extreme damage · multi-pierce (2 ammo per round)',
  '받는 피해 -35%':'Damage taken -35%',
  '받는 피해 -50% (누더기 갑옷 대체)':'Damage taken -50% (replaces rag armour)',
  '받는 피해 추가 -10%':'Damage taken a further -10%',
  '이동 속도 +8%':'Movement speed +8%',
  '근접 공격·채집 속도 +15%':'Melee and harvesting speed +15%',
  '가방 칸 10 → 16 · 적재량 30 → 45kg':'Bag slots 10 → 16 · capacity 30 → 45kg',
  '가방 칸 16 → 22 · 적재량 45 → 62kg':'Bag slots 16 → 22 · capacity 45 → 62kg',
  '가방 칸 22 → 30 · 적재량 62 → 85kg':'Bag slots 22 → 30 · capacity 62 → 85kg',
  '재장전 속도 +25%':'Reload speed +25%',
  '밤 시야 확대':'Wider vision at night',
  '강철 탄피로 대량 생산':'Mass production with steel casings',
  '{grenade} 키로 던집니다 · 넓은 폭발':'Throw with {grenade} · wide blast',
  '체력 +40':'Health +40',
  '약초로 만든 구급상자':'A medkit made from herbs',
  '탄약·폭발물의 재료':'For ammo and explosives',
  '철광석을 석탄으로 제련':'Iron ore smelted with coal',
  '목재를 태워 석탄 대용으로':'Wood burned down as a coal substitute',
  '석탄과 약초를 증류':'Distilled from coal and herbs',
  '감자 두 알을 불에 굽습니다':'Two potatoes baked over the fire',
  '쌀로 밥을 짓습니다':'Cooks rice',
  '생고기를 익혀 탈 없이 먹습니다':'Cooks raw meat so it is safe to eat',
  '버섯과 약초를 끓인 수프':'A soup of mushrooms and herbs',
  '쌀과 통조림을 함께 볶습니다':'Rice fried with canned food',
  '가장 든든한 식사 · 체력도 회복':'The most filling meal · restores health',

  /* ---------- world ---------- */
  '주택':'House', '상점':'Store', '창고':'Warehouse', '경찰서':'Police', '병원':'Hospital', '정비소':'Garage',
  '수납장':'cabinet', '진열대':'shelves', '상자':'crate', '사물함':'locker', '약품함':'medicine cabinet', '공구함':'toolbox', '보급 상자':'supply crate',
  '거점 후보':'Base site', '보급':'Supplies', '위험':'Danger', '목표':'Goal',

  /* ---------- bosses ---------- */
  '도살자':'The Butcher', '부식체':'The Corroder', '산란 모체':'Brood Mother', '채찍 군체':'The Lasher', '역병의 왕':'Plague King',
  '돌진을 벽으로 유도하면 기절합니다':'Bait its charge into a wall to stun it',
  '산성 웅덩이를 피해 거리를 좁히세요':'Avoid the acid pools and close the distance',
  '알이 부화하기 전에 터뜨리세요':'Burst the eggs before they hatch',
  '촉수에 붙잡히면 끌려갑니다':'Its tentacles drag you in',
  '갑각은 단단합니다 — 공격 직후 드러나는 핵을 노리세요':'The carapace is tough — hit the core exposed right after an attack',
  '보스 출현 — {x}':'Boss — {x}', '{x} 처치!':'{x} slain!', '전리품을 챙기세요':'Collect the spoils',
  '둔화!':'Slowed!', '포효!':'Roar!', '격노!':'Enraged!', '기절!':'Stunned!', '붙잡혔다!':'Caught!', '마지막 단계':'Final stage',
  ' · 갑각':' · carapace', ' · 핵 노출!':' · core exposed!', ' · 기절!':' · stunned!',

  /* ---------- progression ---------- */
  '쉬움':'Easy', '보통':'Normal', '어려움':'Hard', '악몽':'Nightmare',
  '좀비가 약하고 물자가 넉넉합니다':'Weaker zombies, plenty of supplies',
  '기본 균형':'The standard balance',
  '좀비가 강하고 물자가 줄어듭니다':'Stronger zombies, fewer supplies',
  '끝없는 무리, 부족한 물자':'Endless hordes, scarce supplies',
  '난이도: ':'Difficulty: ',
  '체력':'Health', '힘':'Strength', '사격':'Marksmanship', '민첩':'Agility', '생존':'Survival', '건축':'Engineering',
  '최대 체력 +15':'Max health +15',
  '근접 피해 +12% · 채집량 증가 · 적재량 +3kg':'Melee damage +12% · more harvest · capacity +3kg',
  '총기 피해 +10% · 연사 속도 +4%':'Gun damage +10% · fire rate +4%',
  '이동 속도 +4%':'Movement speed +4%',
  '허기 소모 -7% · 줍기 범위 증가':'Hunger drain -7% · wider pickup range',
  '새 구조물 내구도 +12%':'New structures +12% durability',
  '레벨 {n}':'Level {n}', '{stats} 키로 능력치 포인트를 사용하세요':'Press {stats} to spend your stat points',
  '포인트':'points',

  /* ---------- HUD ---------- */
  '주변 지도 · {map} 전체':'Map · {map} full',
  '일차':'Day', '낮':'Day', '밤':'Night', '해질녘':'Dusk', '처치':'Kills',
  '가방':'Bag', '무게':'Weight', '과적':'Overloaded', '적재 한계':'At the limit', '이동 속도':'speed',
  '체력 / 허기':'Health / Hunger', '허기':'Hunger', '굶주림!':'Starving!', '식량':'Food',
  '가방 {a} / {b}칸':'Bag {a} / {b} slots',
  '과적! 걸음이 느려집니다':'Overloaded! You slow down',
  '보관함 {n}개 연결 — 건설·제작에 사용':'{n} chest(s) linked — used for building and crafting',
  '근접 무기 · 예비탄':'Melee · spare ammo', '재장전 중…':'Reloading…', '{x} 없음':'No {x}',
  '탄창 {n}발 · {reload} 재장전':'{n}-round mag · {reload} reload',
  '좌클릭 설치·수리 · 우클릭 철거(50% 회수) · 휠/숫자 선택 · {build} 종료':'LMB place/repair · RMB demolish (50% back) · wheel/number select · {build} exit',
  '휠':'whl', '빈 슬롯':'empty',
  '건설':'Build', '줍기·상호작용':'Pick up·Use', '식사':'Eat', '치료':'Heal', '근접·채집':'Melee·Harvest', '지도·표시':'Map·Markers',
  '무기':'Weapons', '능력치·저장':'Stats·Save', '소리':'Sound', '메뉴·설정':'Menu·Settings',
  /* prompts */
  '{x} 뒤지기':'Search the {x}', '줍기':'Pick up', '내구도':'Durability',
  '너무 무거워 더 들 수 없습니다':'Too heavy to carry', '가방이 가득 찼습니다':'Your bag is full',
  '너무 무겁습니다 — 더 들 수 없습니다':'Too heavy — you cannot carry more',
  '제작대 사용':'Use the workbench', '화로에서 요리':'Cook at the stove', '보관함 열기':'Open the chest',
  '거점에 저장':'Save at the outpost', '이 거점을 체크포인트로 설정':'Set this outpost as your checkpoint', '지도에서 거점 이동':'Travel between outposts on the map',
  '능력치 포인트 {n} 사용 가능':'{n} stat point(s) to spend',
  '먹기 · 누르고 있으면 음식 선택':'Eat · hold to choose a food',
  '배가 고픕니다 — 식량을 찾으세요':'You are hungry — find food',
  '구급상자 사용':'Use a medkit',
  ' · 도끼를 장착하면 더 많이 얻습니다':' · equip an axe for more',
  ' · 곡괭이를 장착해야 광물이 나옵니다':' · equip a pickaxe to get minerals',
  '{x} 광맥':'{x} vein', '{x} 곡괭이가 있어야 캘 수 있습니다 (돌만 나옴)':'needs a {x} pickaxe (stone only for now)',
  '먹을 것이 없습니다':'Nothing to eat', '포만감':'Fullness', '{eat}를 놓으면 먹기':'Release {eat} to eat',
  '배가 부릅니다':'You are full', '+40 체력':'+40 health',

  /* ---------- crafting ---------- */
  '보관함 {n}개 연결됨':'{n} chest(s) linked', '멀쩡함':'Intact', '보유 중':'Owned', '제작 가능':'Ready',
  '{x} 필요':'Needs {x}', '필요 재료':'MATERIALS', '수리할 곳 없음':'Nothing to repair', '재료 부족':'Missing materials', '제작':'Craft', '최대':'Max',
  '피해':'Damage', ' (폭발)':' (blast)', '사거리':'Range', '공격 간격':'Swing time', '초':'s', '벌목량':'Wood yield', '채광량':'Mining yield',
  '탄창':'Magazine', '발':' rds', '연사':'Fire rate', '발/초':' rds/s', '재장전':'Reload', '관통':'Pierce', '사용 탄':'Ammo type',
  '등급':'Tier', '캘 수 있는 광물':'Can mine', '손에 든 무기':'Weapon in hand', '{x} 보유':'{x} owned',
  ' 완료!':' done!', ' 완성!':' cooked!', ' 제작!':' crafted!',
  ' — 가방에 넣었습니다 ({inventory}에서 장착)':' — put in your bag (equip with {inventory})',
  ' — 너무 무거워 바닥에 놓았습니다':' — too heavy, left on the ground',
  ' — 가방 {a}칸 · 적재량 {b}kg':' — bag {a} slots · capacity {b}kg',
  '고갈됨':'Depleted', '수리':'Repaired', '{x} → 보관함':'{x} → chest',
  '같은 무기는 하나만 장착할 수 있습니다':'Only one of each weapon can be equipped',
  '{x} 파손!':'{x} broke!', '{x} — 곧 부서집니다':'{x} — about to break', '{x} 파괴!':'{x} destroyed!',

  /* ---------- inventory ---------- */
  '인벤토리':'Inventory', '적재 중량':'CARRIED WEIGHT', '무기 슬롯 — 장착할 칸 선택':'WEAPON SLOTS — PICK THE SLOT TO EQUIP INTO',
  '가방 · 착용 장비':'BAG · WORN GEAR',
  '클릭해서 먹기':'Click to eat', '개당':'EACH', '보관 {n}개':'STORED {n}', '보유 {n}개':'CARRIED {n}', '한 칸':'PER SLOT', '{n}개':'{n}',
  '근접':'Melee', '{x} 사용':'uses {x}',
  '물자와 <b>무기</b>(슬롯·가방 모두)에는 무게가 있습니다. 적재량을 넘으면 걸음이 느려지고, 적재량의 {n}%가 한계입니다 — 그 이상은 주울 수 없습니다. 보관함에 덜거나 우클릭으로 버리세요.':
    'Supplies and <b>weapons</b> (slotted or in the bag) have weight. Over capacity you walk slower, and {n}% of capacity is the hard limit — nothing more can be picked up. Unload into a chest or right-click to drop.',
  '과적 — 이동 속도':'Overloaded — speed', '한계':'limit', '물자':'Supplies',
  '가방 속 무기':'WEAPONS IN THE BAG', '클릭해서 보관함에 넣기':'CLICK TO STORE', '클릭해서 장착':'CLICK TO EQUIP', '우클릭 버리기':'RIGHT-CLICK TO DROP',
  '가방에 든 무기가 없습니다<br>슬롯을 우클릭하면 무기를 가방으로 뺍니다':'No weapons in the bag<br>Right-click a slot to move its weapon into the bag',
  '{n}칸':'{n} slots', '보관함 {a} / {b}칸':'Chest {a} / {b} slots',
  '클릭':'Click', 'Shift+클릭':'Shift+click', '우클릭':'Right-click', 'Shift+우클릭':'Shift+right-click',
  '물자·무기 옮기기':'move supplies/weapons', '같은 종류 전부':'all of that kind',
  '음식·구급상자 사용 · 무기는 슬롯을 고른 뒤 클릭해 장착':'use food/medkit · pick a slot, then click a weapon to equip',
  '버리기 / 슬롯 무기를 가방으로':'drop / slot weapon to bag', '1개 버리기':'drop one', '닫기':'Close',

  /* ---------- map ---------- */
  '전체 지도':'Full map',
  '{d}일차 · 표시 {a} / {b} · 거점 {c} — 게임은 멈춰 있습니다':'Day {d} · markers {a} / {b} · outposts {c} — the game is paused',
  '좌클릭 표시 남기기 · 표시 클릭/우클릭 삭제 · 1-{n}/휠 종류 선택 · 거점 깃발 옆에서 다른 거점 클릭 → 이동 · {map}/ESC 닫기':
    'LMB place marker · click/RMB a marker to delete · 1-{n}/wheel pick type · next to a flag, click another outpost → travel · {map}/ESC close',
  '{x} — 클릭하여 삭제':'{x} — click to delete', '거점 (체크포인트)':'Outpost (checkpoint)', '거점':'Outpost',
  ' — 현재 위치':' — you are here', ' — 클릭하여 이동':' — click to travel', ' — 거점 깃발 옆에서만 이동 가능':' — travel only from beside an outpost flag',
  '표시는 {n}개까지 남길 수 있습니다':'You can place up to {n} markers',
  '거점 깃발 옆에 있어야 이동할 수 있습니다':'You must stand beside an outpost flag to travel',
  '근처에 좀비가 있어 이동할 수 없습니다':'Zombies are nearby — cannot travel',
  '거점 이동':'Outpost travel', '허기 -6':'Hunger -6',

  /* ---------- toasts ---------- */
  '{n}일차':'Day {n}', '재료를 모아 거점을 지으세요':'Gather materials and build a base',
  '밤이 찾아옵니다':'Night falls', '좀비가 몰려옵니다 — 거점을 지키세요':'The horde is coming — defend your base',
  '새벽이 밝았습니다 — 자원이 다시 나타났습니다':'Dawn breaks — resources have returned', ' · 자동 저장됨':' · autosaved',
  '체크포인트 설정':'Checkpoint set', '쓰러지면 이 거점에서 다시 일어납니다':'If you fall, you rise again at this outpost', ' · 저장됨':' · saved',
  '거점 파괴!':'Outpost destroyed!', '체크포인트가 다른 거점으로 옮겨졌습니다':'Your checkpoint moved to another outpost', '체크포인트가 사라졌습니다':'Your checkpoint is gone',
  '거점에서 부활':'Respawn at outpost', '가진 물자의 절반({n})을 잃었습니다':'You lost half of your supplies ({n})',
  '소리 끔':'Sound off', '소리 켬':'Sound on',
  '저장된 게임을 불러왔습니다':'Saved game loaded',
  '저장했습니다.':'Saved.', '저장에 실패했습니다 (브라우저 저장소를 사용할 수 없음).':'Save failed (browser storage is unavailable).',

  /* ---------- title / menus ---------- */
  '긴급 재난 방송 · 107.3 MHz · 신호 미약':'EMERGENCY BROADCAST · 107.3 MHz · WEAK SIGNAL',
  '최후의':'LAST', '피난처':'SHELTER', '폐허 생존 기록':'SURVIVING THE RUINS',
  '난이도':'DIFFICULTY', '새 게임':'New game', '이어하기':'Continue', '설정':'Settings',
  '생존자 수첩':"Survivor's notebook", '— 찢어진 페이지':'— a torn page',
  '이동':'Move', '좌클릭':'LMB', '공격 (단검 / 총)':'Attack (knife / gun)', '줍기 · 뒤지기 · 제작대':'Pick up · search · workbench',
  '근접 공격 · 채집':'Melee · harvest', '건설 모드':'Build mode', '무기 교체 (휠)':'Switch weapon (wheel)', '인벤토리 · 무게':'Inventory · weight',
  '수류탄 / 화염병':'Grenade / molotov', '식사(꾹=선택) / 구급':'Eat (hold=choose) / heal', '능력치 · 저장':'Stats · save',
  '지도 · 표시 남기기':'Map · markers', '메뉴 · 설정':'Menu · settings',
  '일시정지':'Paused', '계속하기':'Resume', '저장':'Save',
  '사망':'DEAD', 'YOU DIED — 기록은 여기서 끝난다':'YOU DIED — the record ends here',
  '생존 일수':'Days survived', '레벨':'Level', '생존시간':'Time survived', '처치한 좀비':'Zombies killed', '수집한 자원':'Resources gathered',
  '저장 불러오기':'Load save',
  '저장 슬롯':'SAVE SLOT', '슬롯 {n}':'SLOT {n}', '비어 있음':'Empty', '선택한 슬롯 삭제':'Delete the selected slot', '저장됨':'SAVED',
  '슬롯 {n}에 저장된 게임이 있습니다. 새 게임을 시작하면 그 저장은 지워집니다.':'Slot {n} already holds a saved game. Starting a new game erases it.',
  '슬롯 {n}의 저장을 삭제할까요? 되돌릴 수 없습니다.':'Delete the save in slot {n}? This cannot be undone.',
  '확인':'OK', '취소':'Cancel',
  '철거':'Demolish', '장전':'Reload', '줍기 · 사용':'Pick up · use',
  '기기를 가로로 돌려 주세요':'Please turn your device sideways',
  '이 브라우저는 전체화면 전환을 지원하지 않습니다. 아이폰은 공유 버튼 → "홈 화면에 추가"로 설치한 뒤 그 아이콘으로 열면 전체화면으로 실행됩니다.':
    'This browser cannot switch to fullscreen. On an iPhone, use Share → "Add to Home Screen" and open the game from that icon: it then runs fullscreen.',

  /* ---------- settings ---------- */
  '오디오':'Audio', '게임':'Game', '조작키':'Controls',
  '전체 음량':'Master volume', '효과음':'Sound effects', '환경음':'Ambience', '음소거':'Mute',
  '언어':'Language', '피 표현':'Blood', '켜짐':'On', '꺼짐':'Off',
  '음악':'Music', '끄면 핏자국과 피 튀김이 먼지로 바뀝니다':'Off: blood stains and splatter become dust',
  '피해 숫자':'Damage numbers', '저체력 화면 경고':'Low-health warning', '체력이 낮을 때의 붉은 화면':'The red screen edge at low health',
  '화면 흔들림':'Screen shake', '전체화면':'Fullscreen',
  '기본값으로 되돌리기':'Reset to defaults', '설정은 이 브라우저에 자동으로 저장됩니다':'Settings are saved in this browser automatically',
  '바꿀 키를 클릭한 뒤 새 키를 누르세요 · 이미 쓰는 키는 서로 맞바뀝니다 · ESC·숫자·마우스는 고정':'Click a key, then press the new one · a key already in use is swapped · ESC, numbers and mouse are fixed',
  '새 키를 누르세요… (ESC 취소)':'Press the new key… (ESC to cancel)', '이 키는 사용할 수 없습니다':'That key cannot be used',
  '키 입력…':'press…',
  '위로 이동':'Move up', '아래로 이동':'Move down', '왼쪽으로 이동':'Move left', '오른쪽으로 이동':'Move right',
  '줍기 · 상호작용':'Pick up · interact', '식사 (꾹 눌러 선택)':'Eat (hold to choose)', '수류탄 던지기':'Throw grenade', '화염병 던지기':'Throw molotov',
  '지도':'Map', '소리 켜기/끄기':'Sound on/off',

  /* ---------- admin ---------- */
  '관리자 · F2':'Admin · F2', '보스 소환 — 조준 방향 앞에 나타납니다':'Summon a boss — appears where you aim', '보스 제어':'Boss control',
  '다음 단계':'Next stage', '체력 절반':'Half HP', '보스 제거':'Remove boss', '테스트':'Test', '무적':'God mode', '스폰 정지':'No spawns',
  '회복':'Heal', '테스트 장비':'Test kit', '좀비 제거':'Clear zombies', '낮/밤 전환':'Day/night',
};

// Blocks of static markup (index.html: data-i18n="key") that are swapped whole.
const HTML_STR = {
  lore:{
    ko:'발병 217일째. 방송은 끊겼고, 도시는 죽은 자들의 것이 되었다.<br>남은 것은 단검 한 자루와 해가 지기 전까지의 시간뿐.',
    en:'Day 217 of the outbreak. The broadcasts are gone and the city belongs to the dead.<br>All that is left is one knife, and the hours before sundown.'},
  rule1:{
    ko:'조용한 첫 낮에 재료를 줍고 건물을 뒤져 <b>거점</b>을 지을 것. 레벨을 올려 제작대에서 총을 만든다.',
    en:'Use the quiet first day to gather materials, search buildings and build a <b>base</b>. Level up to make guns at the workbench.'},
  rule2:{
    ko:'<b>도끼</b>는 나무, <b>곡괭이</b>는 바위. 돌 → 철 → 강철로 벼려야 석탄 → 철광석 → 유황이 나온다. 무기는 쓸수록 닳으니 제작대에서 <b>수리</b>할 것.',
    en:'<b>Axes</b> for trees, <b>pickaxes</b> for rocks. Stone → iron → steel tools dig out coal → iron ore → sulfur. Weapons wear down — <b>repair</b> them at the workbench.'},
  rule3:{
    ko:'<b>짐에는 무게가 있다.</b> 적재량을 넘기면 걸음이 느려지고, 적재량의 130%가 한계 — 그 이상은 아무것도 주울 수 없다. 남는 짐은 보관함에 — 보관함 근처에서는 꺼내지 않아도 그 안의 재료로 짓고 만든다.',
    en:'<b>Everything has weight.</b> Over capacity you slow down, and 130% is the hard limit — nothing more can be picked up. Keep the surplus in chests — near a chest you build and craft straight from what is inside.'},
  rule4:{
    ko:'<b>화로 조리대</b>를 지으면 감자·쌀·고기를 익혀 훨씬 든든하게 먹는다. 생고기는 날로 먹지 말 것.',
    en:'Build a <b>cooking stove</b> to cook potatoes, rice and meat into far better meals. Never eat meat raw.'},
  rule5:{
    ko:'<b>거점 깃발</b>은 체크포인트. 쓰러져도 그곳에서 다시 일어난다.',
    en:'An <b>outpost flag</b> is a checkpoint. If you fall, you get back up there.'},
  rule6:{
    ko:'밤에는 놈들이 몰려온다. <b>5일마다</b> 더 큰 것이 온다.',
    en:'At night they come in hordes. <b>Every 5 days</b> something bigger comes.'},
  titleFoot:{
    ko:'<kbd>Enter</kbd>시작 · <kbd>{mute}</kbd>소리 켜기/끄기 · 진행 상황은 이 브라우저에 저장됩니다',
    en:'<kbd>Enter</kbd>start · <kbd>{mute}</kbd>sound on/off · progress is saved in this browser'},
  craftFoot:{
    ko:'<kbd>{inventory}</kbd>분류 전환 · <kbd>숫자</kbd>바로 제작 · 클릭으로 선택 · <kbd>{interact}</kbd>/<kbd>ESC</kbd> 닫기',
    en:'<kbd>{inventory}</kbd>next tab · <kbd>number</kbd>craft at once · click to select · <kbd>{interact}</kbd>/<kbd>ESC</kbd> close'},
  padNote:{
    ko:'게임패드 — 왼쪽 스틱 이동 · 오른쪽 스틱 조준 · RT 공격 · LT 근접 · A 줍기 · B 식사 · X 재장전 · Y 치료 · LB/RB 무기 · 십자키 ↑ 수류탄 ↓ 화염병 ← 건설 → 가방 · Back 지도 · Start 메뉴',
    en:'Gamepad — left stick move · right stick aim · RT attack · LT melee · A pick up · B eat · X reload · Y heal · LB/RB weapon · d-pad ↑ grenade ↓ molotov ← build → bag · Back map · Start menu'},
};
LANG_TABLES.en = LANG_EN;
