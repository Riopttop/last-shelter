'use strict';

/* ============================================================
   HUD
============================================================ */
const $ = id=>document.getElementById(id);
const el = {
  hpFill:$('hpFill'), hpNum:$('hpNum'), hungerFill:$('hungerFill'), hungerNum:$('hungerNum'),
  xpFill:$('xpFill'), xpNum:$('xpNum'), ammoSub:$('ammoSub'),
  ammoCount:$('ammoCount'), weaponName:$('weaponName'),
  dayVal:$('dayVal'), clockVal:$('clockVal'), clockLbl:$('clockLbl'), killVal:$('killVal'),
  prompt:$('prompt'), toast:$('toast'), gearList:$('gearList'), invRows:$('invRows'),
  buildBar:$('buildBar'), buildHint:$('buildHint'), craftPanel:$('craftPanel'), recipeList:$('recipeList'),
  craftTabs:$('craftTabs'), craftDetail:$('craftDetail'), craftMats:$('craftMats'), craftLvl:$('craftLvl'),
  durFill:$('durFill'), craftTitle:$('craftTitle'), linkNote:$('linkNote'),
  wtGauge:$('hudWt'), wtNum:$('hudWtNum'), loadChip:$('loadChip'),
  inv:{},
};
const kg = n=>n.toFixed(1);
// Carried weight against the capacity; cls: '' | warn (nearly full) | over (slowed) | max (hard limit).
function loadState(){
  const wt=carriedWeight(), cap=carryCap(), max=cap*OVERLOAD_MAX;
  return {wt, cap, max, cls: wt>cap+1e-6 ? (wt>=max-0.5 ? 'over max' : 'over') : (wt>cap*0.85 ? 'warn' : '')};
}
// A weight gauge spans 0..hard limit, with a tick where the slowdown starts.
function setGauge(node,ls){
  const cls='wt-gauge '+ls.cls, w=clamp(ls.wt/ls.max*100,0,100).toFixed(1)+'%', fill=node.firstElementChild.firstElementChild;
  if(node.className!==cls) node.className=cls;
  if(fill.style.width!==w) fill.style.width=w;
}
let wasOverloaded=false;
// backpack rows; anything beyond the basics stays hidden until the player carries some
for(const k in ITEMS){
  if(k==='ammo' || ITEMS[k].food) continue; // ammo is on the weapon plate, food is summed into one row below
  const row=document.createElement('div');
  row.className='inv-row';
  row.innerHTML='<i style="background:'+ITEMS[k].color+'"></i><span>'+ITEMS[k].name+'</span><b>0</b>';
  el.invRows.appendChild(row);
  el.inv[k]={row, num:row.lastChild, shown:-1};
}
{ // every kind of food in one row
  const row=document.createElement('div');
  row.className='inv-row';
  row.innerHTML='<i style="background:'+ITEMS.food.color+'"></i><span>식량</span><b>0</b>';
  el.invRows.insertBefore(row, el.invRows.children[4]||null);
  el.foodRow={row, num:row.lastChild, shown:-1};
}
BUILD_DEFS.forEach((d,i)=>{
  d.slot=document.createElement('div');
  d.slot.className='slot';
  d.slot.addEventListener('click',()=>{ buildSel=i; }); // touch screens: tap a slot to pick it
  el.buildBar.appendChild(d.slot);
});
// Names on the rows and slots built above; called again when the language changes.
function labelHud(){
  for(const k in el.inv) el.inv[k].row.children[1].textContent=ITEMS[k].name;
  el.foodRow.row.children[1].textContent=T('식량');
  BUILD_DEFS.forEach((d,i)=>{
    d.slot.innerHTML='<span class="k">'+(i<10?(i+1)%10:T('휠'))+'</span><div class="n">'+d.name+'</div><div class="c">'+costText(d.cost)+'</div>';
  });
}
labelHud();

/* ---------- workbench ---------- */
let craftTab='tool', craftSel='', craftDetailHtml='', craftMatsHtml='';
const craftRows=[]; // one per recipe of the open tab: {r, node, cost, st}

// tabs of the station the panel was opened at (workbench or stove)
function stationTabs(){ return CRAFT_TABS.filter(t=>(t.station||'workbench')===craftStation); }
function tabRecipes(){ return RECIPES.filter(r=>r.cat===craftTab); }
function selectedRecipe(){ return RECIPES.find(r=>r.id===craftSel); }
// done = already owned, lock = level too low, ok = can be made now, na = materials missing
function recipeState(r){ return recipeOwned(r) ? 'done' : (recipeLocked(r) ? 'lock' : (canAfford(r.cost) ? 'ok' : 'na')); }
function recipeColor(r){
  if(r.gives) return ITEMS[Object.keys(r.gives)[0]].color;
  if(r.weapon) return WEAPONS[r.weapon].melee ? '#c8d2d6' : '#f0c85a';
  return '#7ab8e8';
}
function costHtml(cost){
  return Object.keys(cost).map(k=>'<span'+(stock(k)<cost[k]?' class="lack"':'')+'>'+ITEMS[k].name+' '+cost[k]+'</span>').join(' · ');
}
function recipeStats(r){
  const rows=[];
  if(r.weapon){
    const w=WEAPONS[r.weapon];
    if(w.melee){
      rows.push(['피해',w.dmg],['사거리',w.range],['공격 간격',w.cd.toFixed(2)+T('초')]);
      if(w.chop) rows.push(['벌목량','×'+w.chop]);
      if(w.mine) rows.push(['채광량','×'+w.mine]);
    } else {
      rows.push(['피해',w.dmg+(w.pellets>1?' ×'+w.pellets:'')+(w.ex?T(' (폭발)'):'')],['탄창',w.mag+T('발')],
                ['연사',(1/w.cd).toFixed(1)+T('발/초')],['재장전',w.reload.toFixed(1)+T('초')]);
      if(w.pierce) rows.push(['관통',w.pierce]);
      rows.push(['사용 탄',ITEMS[w.ammoKey||'ammo'].name]);
    }
    rows.push(['무게',kg(w.wt)+'kg'],['내구도',w.dur]);
    if(w.tier) rows.push(['등급',TIER_NAME[w.tier]]);
    if(w.mine) rows.push(['캘 수 있는 광물',Object.keys(VEIN_TIER).filter(k=>VEIN_TIER[k]<=w.tier).map(k=>ITEMS[k].name).join('·')]);
  } else if(r.repair){
    const w=WEAPONS[player.weapon];
    rows.push(['손에 든 무기',w.name],['내구도',isFinite(w.dur) ? Math.ceil(player.dur[player.weapon]||0)+' / '+w.dur : '—']);
  } else if(r.gives){
    for(const k in r.gives){
      const e=ITEMS[k].eat;
      if(e){ rows.push(['포만감','+'+e.hunger]); if(e.hp) rows.push(['체력',(e.hp>0?'+':'')+e.hp]); }
      rows.push([Tf('{x} 보유',{x:ITEMS[k].name}), stock(k)+' (+'+r.gives[k]+')']);
      rows.push(['무게', '+'+kg(ITEMS[k].wt*r.gives[k])+'kg']);
    }
  }
  return rows;
}
function setCraftTab(id){
  if(craftTab===id) return;
  craftTab=id; craftSel='';
  buildCraftUI();
}
function cycleCraftTab(dir){
  const tabs=stationTabs(), i=tabs.findIndex(t=>t.id===craftTab);
  setCraftTab(tabs[(i+dir+tabs.length)%tabs.length].id);
}
// Rebuilds the tab bar and the recipe list; renderRecipes() then only refreshes their state,
// so the nodes stay put while the player is clicking on them.
function buildCraftUI(){
  const tabs=stationTabs();
  if(!tabs.some(t=>t.id===craftTab)){ craftTab=tabs[0].id; craftSel=''; }
  el.craftTitle.textContent = T(craftStation==='stove' ? '화로 조리대' : '제작대');
  el.craftTabs.classList.toggle('hidden', tabs.length<2);
  el.craftTabs.innerHTML='';
  tabs.forEach(t=>{
    const b=document.createElement('button');
    b.className='craft-tab';
    b.innerHTML=t.name+'<i></i>';
    b.addEventListener('click',()=>setCraftTab(t.id));
    el.craftTabs.appendChild(b);
    t.node=b;
  });
  const list=tabRecipes();
  if(!list.some(r=>r.id===craftSel)) craftSel=(list.find(r=>recipeState(r)==='ok') || list.find(r=>recipeState(r)!=='done') || list[0]).id;
  el.recipeList.innerHTML='';
  el.recipeList.scrollTop=0;
  craftRows.length=0;
  list.forEach((r,i)=>{
    const b=document.createElement('button');
    b.innerHTML='<span class="k">'+(i<10?(i+1)%10:'')+'</span><span class="sw" style="background:'+recipeColor(r)+'"></span>'+
                '<span class="body"><span class="n">'+r.name+'</span><div class="c"></div></span><span class="st"></span>';
    b.addEventListener('click',()=>{ craftSel=r.id; renderRecipes(); });
    b.addEventListener('dblclick',()=>craft(r,1));
    el.recipeList.appendChild(b);
    craftRows.push({r, node:b, cost:b.querySelector('.c'), st:b.querySelector('.st'), costHtml:''});
  });
  craftDetailHtml=''; craftMatsHtml='';
  renderRecipes();
}
function renderRecipes(){
  el.craftLvl.textContent='LV '+player.level+(linkedChests.length ? ' · '+Tf('보관함 {n}개 연결됨',{n:linkedChests.length}) : '');
  stationTabs().forEach(t=>{
    const n=RECIPES.reduce((a,r)=>a+(r.cat===t.id && recipeState(r)==='ok' ? 1 : 0),0);
    t.node.className='craft-tab'+(t.id===craftTab?' sel':'');
    t.node.lastChild.textContent=n||'';
  });
  craftRows.forEach(row=>{
    const st=recipeState(row.r);
    row.node.className='recipe '+st+(row.r.id===craftSel?' sel':'');
    const c=costHtml(row.r.cost);
    if(c!==row.costHtml){ row.costHtml=c; row.cost.innerHTML=c; }
    row.st.textContent = st==='done' ? T(row.r.repair ? '멀쩡함' : '보유 중') : (st==='lock' ? lockText(row.r,true) : (st==='ok' ? T('제작 가능') : ''));
  });

  const r=selectedRecipe();
  let html='';
  if(r){
    const st=recipeState(r), max=craftableCount(r);
    html='<div class="cd-head"><span class="sw" style="background:'+recipeColor(r)+'"></span><div><div class="cd-name">'+r.name+'</div>'+
         '<div class="cd-type">'+CRAFT_TABS.find(t=>t.id===r.cat).name+(r.lvl?' · <span'+(player.level<r.lvl?' class="lack"':'')+'>'+Tf('{x} 필요',{x:'LV '+r.lvl})+'</span>':'')+'</div></div></div>'+
         '<div class="cd-desc">'+r.desc+'</div>';
    const stats=recipeStats(r);
    if(stats.length) html+='<div class="cd-stats">'+stats.map(s=>'<div><span>'+T(s[0])+'</span><b>'+s[1]+'</b></div>').join('')+'</div>';
    html+='<div class="cd-label">'+T('필요 재료')+'</div><div class="cd-cost">'+Object.keys(r.cost).map(k=>
      '<div class="cost-row'+(stock(k)<r.cost[k]?' lack':'')+'"><i style="background:'+ITEMS[k].color+'"></i><span>'+ITEMS[k].name+'</span>'+
      '<b>'+stock(k)+' / '+r.cost[k]+'</b></div>').join('')+'</div>';
    const label = st==='lock' ? lockText(r) : T(st==='done' ? (r.repair ? '수리할 곳 없음' : '보유 중') : (st==='na' ? '재료 부족' : '제작'));
    html+='<div class="cd-btns"><button class="craft-btn" data-n="1"'+(st==='ok'?'':' disabled')+'>'+label+'</button>';
    if(r.gives && st==='ok' && max>1){
      if(max>5) html+='<button class="craft-btn alt" data-n="5">×5</button>';
      html+='<button class="craft-btn alt" data-n="'+max+'">'+T('최대')+' ×'+max+'</button>';
    }
    html+='</div>';
  }
  if(html!==craftDetailHtml){ craftDetailHtml=html; el.craftDetail.innerHTML=html; }

  let mats='';
  for(const k in ITEMS){
    const n=stock(k); // bag + linked chests
    if(n<=0 && (!ITEMS[k].base || craftStation==='stove')) continue;
    mats+='<span class="mat'+(n<=0?' zero':'')+'"><i style="background:'+ITEMS[k].color+'"></i>'+ITEMS[k].name+' <b>'+n+'</b></span>';
  }
  if(mats!==craftMatsHtml){ craftMatsHtml=mats; el.craftMats.innerHTML=mats; }
}
el.craftDetail.addEventListener('click',e=>{
  const b=e.target.closest('button[data-n]');
  if(b && !b.disabled) craft(selectedRecipe(), parseInt(b.dataset.n,10));
});
// number key: craft the n-th recipe of the open tab
function craftByKey(n){
  const r=tabRecipes()[n];
  if(!r) return;
  craftSel=r.id;
  if(recipeState(r)==='ok') craft(r,1); else { if(recipeState(r)!=='done') sfx.deny(); renderRecipes(); }
}

let lastPrompt='';
function setPrompt(html){
  if(html===lastPrompt) return;
  lastPrompt=html;
  if(html){ el.prompt.innerHTML=html; el.prompt.classList.add('show'); }
  else el.prompt.classList.remove('show');
}
function harvestPrompt(){
  const t=findHarvestTarget();
  if(!t) return '';
  const type=t.o.type, kind=HARVEST_KIND[type];
  let tip='';
  const power = k=>{ const b=bestTool(k); return b ? (b[k]||1) : 1; };
  if(kind==='chop' && type!=='barricade' && !(power('chop')>1)) tip=T(' · 도끼를 장착하면 더 많이 얻습니다');
  else if(type==='rock' && !(power('mine')>1)) tip=T(' · 곡괭이를 장착해야 광물이 나옵니다');
  else if(type==='rock' && t.o.vein){
    const need=VEIN_TIER[t.o.vein], have=(bestTool('mine')||{}).tier||0;
    tip=' · '+Tf('{x} 광맥',{x:ITEMS[t.o.vein].name})+(have<need ? ' — '+Tf('{x} 곡괭이가 있어야 캘 수 있습니다 (돌만 나옴)',{x:TIER_NAME[need]}) : '');
  }
  return kbd('melee')+HARVEST_NAME[type]+tip;
}
function updateHUD(){
  el.hpFill.style.width = Math.max(0, player.hp/player.maxHp*100)+'%';
  el.hpNum.textContent = Math.ceil(player.hp)+' / '+player.maxHp;
  el.hungerFill.style.width = player.hunger+'%';
  el.hungerNum.textContent = player.hunger<=0 ? T('굶주림!') : T('허기')+' '+Math.ceil(player.hunger);
  el.xpFill.style.width = clamp(player.xp/xpNeed(player.level)*100,0,100)+'%';
  el.xpNum.textContent = 'LV '+player.level+(player.points>0?' · '+T('포인트')+' '+player.points:'');
  const wd = WEAPONS[player.weapon];
  el.weaponName.textContent = wd.name;
  const dr = durRatio(player.weapon), dw = Math.round(dr*100)+'%';
  if(el.durFill.style.width!==dw) el.durFill.style.width = dw;
  el.durFill.parentNode.className = 'dur'+(dr<=0.15 ? ' low' : '')+(isFinite(wd.dur) ? '' : ' none');
  weaponBar.durs.forEach((n,i)=>{ const id=player.slots[i], v=id ? Math.round(durRatio(id)*100)+'%' : '0%'; if(n.style.width!==v){ n.style.width=v; n.parentNode.classList.toggle('low', !!id && durRatio(id)<=0.15); } });
  if(wd.melee){
    el.ammoCount.textContent = '—';
    el.ammoSub.textContent = T('근접 무기 · 예비탄')+' '+player.inv.ammo;
  } else {
    const reserve = reserveRounds(wd), mag = player.mags[player.weapon];
    el.ammoCount.textContent = mag+' / '+reserve;
    el.ammoSub.textContent = player.reload>0 ? T('재장전 중…') : (mag<=0 && reserve<1 ? Tf('{x} 없음',{x:ITEMS[wd.ammoKey||'ammo'].name}) : Tf('탄창 {n}발 · {reload} 재장전',{n:wd.mag}));
  }
  el.ammoCount.classList.toggle('low', !wd.melee && player.mags[player.weapon] <= wd.mag*0.25);
  updateWeaponBar();
  const used = slotsUsed(player.inv);
  inv.cap.textContent = Tf('가방 {a} / {b}칸',{a:used,b:bagSlots()});
  inv.cap.classList.toggle('lack', used >= bagSlots());
  const ls = loadState(), over = ls.wt>ls.cap+1e-6;
  setGauge(el.wtGauge, ls);
  el.wtNum.textContent = kg(ls.wt)+' / '+kg(ls.cap)+' kg';
  el.wtNum.classList.toggle('lack', over);
  el.loadChip.classList.toggle('hidden', !over);
  if(over) el.loadChip.textContent = T(ls.wt>=ls.max-0.5 ? '적재 한계' : '과적')+' · '+T('이동 속도')+' −'+Math.round((1-loadSpeedMul())*100)+'%';
  if(over && !wasOverloaded){ spawnFloat(player.x, player.y-46, '과적! 걸음이 느려집니다', '#e8843a'); sfx.deny(); }
  wasOverloaded = over;
  for(const k in el.inv){
    const e=el.inv[k], n=player.inv[k];
    if(e.shown===n) continue;
    e.shown=n;
    e.num.textContent=n;
    e.row.classList.toggle('hidden', !ITEMS[k].base && n<=0);
  }
  let foods=0;
  for(const k in ITEMS) if(ITEMS[k].food) foods += player.inv[k];
  if(el.foodRow.shown!==foods){ el.foodRow.shown=foods; el.foodRow.num.textContent=foods; }
  el.linkNote.classList.toggle('hidden', !linkedChests.length);
  if(linkedChests.length) el.linkNote.textContent = Tf('보관함 {n}개 연결 — 건설·제작에 사용',{n:linkedChests.length});
  const gear=[];
  for(const k in GEAR) if(player.gear[k]) gear.push(GEAR[k].name);
  el.gearList.textContent = gear.join(' · '); // weapons live on the switch bar
  el.gearList.classList.toggle('hidden', !gear.length);

  const t=timeOfDay(), hour=(6+t*24)%24;
  el.dayVal.textContent = day;
  el.clockVal.textContent = String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.floor(hour%1*6)*10).padStart(2,'0');
  const night=isNight();
  el.clockVal.classList.toggle('night',night);
  el.clockLbl.textContent = T(night?'밤':(t>=0.5&&t<0.6?'해질녘':'낮'));
  el.killVal.textContent = killCount;

  if(buildMode){
    BUILD_DEFS.forEach((d,i)=>{
      d.slot.classList.toggle('sel',i===buildSel);
      d.slot.classList.toggle('na',!canAfford(d.cost));
    });
  }

  let html='';
  if(!craftOpen && !buildMode && !invOpen){
    const crate=findNearestCrate(), pk=crate?null:nearestPickup();
    const use = kbd('interact');
    if(crate) html=use+Tf('{x} 뒤지기',{x:T(crate.label)}); // the label is stored with the crate, in Korean
    else if(pk && pk.w){
      const w = WEAPONS[pk.w.id], what = w.name+' <small>'+kg(w.wt)+'kg · '+T('내구도')+' '+Math.round(pk.w.dur/w.dur*100)+'%</small>';
      html = canCarryWeapon(pk.w.id) ? use+T('줍기')+' — '+what : T('너무 무거워 더 들 수 없습니다')+' — '+what;
    }
    else if(pk){
      const why = bagBlock(pk.type), what = ITEMS[pk.type].name+' ×'+pk.amt;
      html = !why ? use+T('줍기')+' — '+what+' <small>'+kg(ITEMS[pk.type].wt*pk.amt)+'kg</small>'
                  : T(why==='weight' ? '너무 무거워 더 들 수 없습니다' : '가방이 가득 찼습니다')+' — '+what+' · '+kbd('inventory')+T('인벤토리');
    }
    else if(nearestWorkbench()) html=use+T('제작대 사용');
    else if(nearestStove()) html=use+T('화로에서 요리');
    else if(nearestChest()) html=use+T('보관함 열기');
    else if(nearestStruct('turret',70)) html=use+Tf('포탑 탄약 장전 ({a} / {b})',{a:nearestStruct('turret',70).ammo,b:TURRET.ammoMax});
    else if(nearestOutpost(80)) html=use+T(nearestOutpost(80)===activeOutpost() ? '거점에 저장' : '이 거점을 체크포인트로 설정')+' · '+kbd('map')+T('지도에서 거점 이동');
    else if((html=harvestPrompt())){}
    else if(player.points>0) html=kbd('stats')+Tf('능력치 포인트 {n} 사용 가능',{n:player.points});
    else if(player.hunger<35 && hasFood()) html=kbd('eat')+T('먹기 · 누르고 있으면 음식 선택');
    else if(player.hunger<20) html=T('배가 고픕니다 — 식량을 찾으세요');
    else if(player.inv.medkit>0 && player.hp<player.maxHp-30) html=kbd('heal')+T('구급상자 사용');
  }
  setPrompt(html);
}

/* ---------- eat dial: hold T, point at a food, release ---------- */
const dial = {el:$('eatDial'), ring:$('eatRing'), info:$('eatInfo'), open:false, x:0, y:0, keys:[], sel:-1, def:0};
function openEatDial(){
  if(dial.open) return;
  const list = Object.keys(ITEMS).filter(k=>ITEMS[k].eat && player.inv[k]>0);
  if(!list.length){ spawnFloat(player.x, player.y-30, '먹을 것이 없습니다', '#e04b4b'); sfx.deny(); return; }
  dial.keys = list; dial.open = true; dial.sel = -1;
  dial.def = Math.max(0, list.indexOf(lastFood));
  // centred on the cursor, so a flick in any direction picks a food
  const m = 170/viewZoom; // the dial is a HUD element: stage pixels = view pixels x viewZoom
  dial.x = clamp(mouse.x,m,VIEW_W-m); dial.y = clamp(mouse.y,m,VIEW_H-m);
  dial.el.style.left = dial.x*viewZoom+'px'; dial.el.style.top = dial.y*viewZoom+'px';
  dial.ring.innerHTML = list.map((k,i)=>{
    const a = -Math.PI/2 + i/list.length*Math.PI*2;
    return '<div class="eat-node" style="left:'+(Math.cos(a)*112).toFixed(1)+'px;top:'+(Math.sin(a)*112).toFixed(1)+'px">'+
           '<img src="'+itemIconURL(k)+'" alt=""><b>'+player.inv[k]+'</b></div>';
  }).join('');
  dial.el.classList.remove('hidden');
  mouse.down = false;
  updateEatDial();
}
function updateEatDial(){
  const dx=mouse.x-dial.x, dy=mouse.y-dial.y, n=dial.keys.length;
  let sel = dial.def;
  if(dx*dx+dy*dy > 34*34) sel = Math.round((Math.atan2(dy,dx)+Math.PI/2)/(Math.PI*2)*n+n) % n;
  if(sel===dial.sel) return;
  dial.sel = sel;
  for(let i=0;i<n;i++) dial.ring.children[i].classList.toggle('sel', i===sel);
  const k=dial.keys[sel], e=ITEMS[k].eat;
  dial.info.innerHTML = '<div class="e-name">'+ITEMS[k].name+'</div><div class="e-gain">'+T('포만감')+' +'+e.hunger+'</div>'+
    (e.hp ? '<div class="e-hp'+(e.hp<0?' bad':'')+'">'+T('체력')+' '+(e.hp>0?'+':'')+e.hp+'</div>' : '')+'<div class="e-tip">'+T('{eat}를 놓으면 먹기')+'</div>';
}
function closeEatDial(eat){
  if(!dial.open) return;
  dial.open = false;
  dial.el.classList.add('hidden');
  if(eat && gameState==='playing') eatItem(dial.keys[dial.sel]);
}

/* ---------- weapon icons + switch bar ---------- */
// Side-view silhouette of a weapon, drawn in a 48x24 box scaled to fit w x h.
function drawWeaponIcon(c,id,w,h){
  const def=WEAPONS[id]||{};
  const M='#b4bec4', D='#5f696f', W='#a67844', WD='#6e4c28', H=TIER_COL[def.tier]||M; // H = head of a tiered tool
  id=def.look||id;
  const R=(col,x,y,a,b)=>{ c.fillStyle=col; c.fillRect(x,y,a,b); };
  const P=(col,pts)=>{ c.fillStyle=col; c.beginPath(); pts.forEach((p,i)=>{ if(i) c.lineTo(p[0],p[1]); else c.moveTo(p[0],p[1]); }); c.closePath(); c.fill(); };
  const stock=()=>P(W,[[2,9],[12,8],[12,13.5],[2,16.5]]);
  c.save();
  c.clearRect(0,0,w,h);
  const s=Math.min(w/48,h/24);
  c.translate((w-48*s)/2,(h-24*s)/2); c.scale(s,s);
  c.lineCap='round'; c.lineJoin='round';
  if(id==='knife'){
    R(WD,8,10,10,4); R(D,18,8,2,8); P(M,[[20,9],[41,12.5],[20,15]]); R('rgba(255,255,255,.5)',21,10.5,13,1);
  } else if(id==='bat'){
    P(W,[[5,11],[40,8],[42,12],[40,16],[5,13.5]]); R(WD,5,10.8,7,3);
    c.fillStyle=M; [[30,5.5],[35,16],[38,5]].forEach(n=>c.fillRect(n[0],n[1],1.5,3));
  } else if(id==='axe'){
    R(W,5,11,36,3); P(H,[[30,11],[31,3],[39,2],[44,8],[39,11]]); R(D,30,10,9,5); R('rgba(255,255,255,.45)',33,4,7,1);
  } else if(id==='pickaxe'){
    R(W,5,11,34,3);
    c.strokeStyle=H; c.lineWidth=3.2; c.beginPath(); c.moveTo(34,1.5); c.quadraticCurveTo(45,12.5,34,22.5); c.stroke();
    R(D,36,9.5,5,6);
  } else if(id==='spear'){
    R(W,2,11.2,36,2.2); R('#b89a62',34,10.2,4,4.2); P(M,[[38,8],[47,12.3],[38,16.6]]);
  } else if(id==='machete'){
    R(WD,5,10,9,4.5); P(M,[[14,9.5],[38,6],[45,11],[40,15],[14,15]]); R('rgba(255,255,255,.45)',16,10.5,22,1);
  } else if(id==='sledge'){
    R(W,4,11,32,3); R(D,33,4,11,17); R(M,33,4,11,3); R(M,33,18,11,3);
  } else if(id==='pistol'){
    R(M,15,7,22,5.5); P(D,[[17,12.5],[25,12.5],[22.5,21],[15,21]]); R(D,26,12.5,5,1.2); R(D,30,12.5,1.2,3.5); R('#2a2c28',33,8.5,3,1.5);
  } else if(id==='revolver'){
    R(M,22,7,20,3.6); R(D,22,10.6,10,1.6); R('#d2dade',14,6,9,8.5); R(D,16,8,1.5,4.5); R(D,19.5,8,1.5,4.5);
    P(W,[[9,13],[17,14],[14,22.5],[7,21]]); R(D,17,14.5,5,1.2);
  } else if(id==='smg'){
    R(D,3,8.5,8,2); R(D,3,8.5,2,6); R(M,10,7,24,6); R(M,34,9,9,2.2); R(D,22,13,4.5,9.5); P(D,[[13,13],[18,13],[16.5,19.5],[12,19.5]]);
  } else if(id==='shotgun'){
    stock(); R(D,12,8,10,5.5); R(M,22,8,24,2.6); R(M,22,11.2,18,2.4); R(W,26,10.6,9,4);
  } else if(id==='rifle'){
    stock(); R(M,12,8,17,5); R(M,29,9.2,17,2.2); R(D,19,13,5,7.5); P(D,[[13,13],[17,13],[15.5,18.5],[12,18.5]]); R(W,29,11.4,8,2);
  } else if(id==='lmg'){
    stock(); R(M,11,7,20,7); R(M,31,9,15,2.6); R('#7f9a4a',16,14,10,7.5); R(D,12,5.5,10,1.6);
    c.strokeStyle=D; c.lineWidth=1.3; c.beginPath(); c.moveTo(41,11); c.lineTo(38,21); c.moveTo(41,11); c.lineTo(44.5,21); c.stroke();
  } else if(id==='sniper'){
    stock(); R(M,12,9,14,4.5); R(M,26,10.2,21,2); R(D,14,4,15,3.2); R(D,17,7.2,2,2); R(D,24,7.2,2,2); R(D,19,13.5,3.5,5);
  } else if(id==='flamer'){
    c.fillStyle='#c0503a'; c.beginPath(); c.roundRect ? c.roundRect(5,13,16,8,3) : c.rect(5,13,16,8); c.fill();
    R(M,7,8,22,4.5); R(D,29,9.2,12,2.2); P(D,[[22,12.5],[27,12.5],[25.5,18.5],[21,18.5]]);
    P('#f0c85a',[[41,7],[47,10.3],[41,13.6]]); P('#e8642a',[[41,8.6],[44.5,10.3],[41,12]]);
  } else if(id==='launcher'){
    stock(); R(M,15,6,24,8.5); R(D,38,5,3.5,10.5); R(D,24,6,1.5,8.5); P(D,[[16,14.5],[21,14.5],[19.5,20.5],[15,20.5]]); R('#7f9a4a',41.5,7.5,3,5.5);
  }
  c.restore();
}
