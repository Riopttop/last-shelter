'use strict';

/* ============================================================
   WEAPON SLOT BAR · INVENTORY (Tab) · STORAGE CHEST
============================================================ */
const weaponIconCache = {}, weaponIconURLs = {};
// The icon as a canvas (drawn onto the game view for weapons lying on the ground) ...
function weaponIconCanvas(id){
  if(!weaponIconCache[id]){
    const c=document.createElement('canvas');
    c.width=144; c.height=72;
    drawWeaponIcon(c.getContext('2d'),id,144,72);
    weaponIconCache[id]=c;
  }
  return weaponIconCache[id];
}
// ... and as an image URL for the HUD.
function weaponIconURL(id){ return weaponIconURLs[id] || (weaponIconURLs[id]=weaponIconCanvas(id).toDataURL()); }
function durBar(ratio){ return '<span class="dur'+(ratio<=0.15?' low':'')+'"><i class="d" style="width:'+Math.round(ratio*100)+'%"></i></span>'; }
// The three weapon slots at the bottom of the screen; the weapon in hand is lit up.
const weaponBar = {el:$('weaponBar'), icon:$('weaponIcon'), key:'', sel:'', durs:[]};
function updateWeaponBar(){
  const key=player.slots.join(',');
  if(key!==weaponBar.key){
    weaponBar.key=key; weaponBar.sel='';
    weaponBar.el.innerHTML=player.slots.map((id,i)=>
      '<div class="wslot'+(id?(WEAPONS[id].melee?'':' gun'):' empty')+'" data-id="'+(id||'')+'"><span class="k">'+(i+1)+'</span>'+
      (id ? '<span class="wn">'+WEAPONS[id].name+'</span><img src="'+weaponIconURL(id)+'" alt="">' : '<span class="we">'+T('빈 슬롯')+'</span>')+
      durBar(id ? durRatio(id) : 0)+'</div>').join('');
    weaponBar.durs=Array.from(weaponBar.el.querySelectorAll('.d')); // kept current by updateHUD
  }
  if(weaponBar.sel!==player.weapon){
    weaponBar.sel=player.weapon;
    for(const s of weaponBar.el.children){
      s.classList.remove('sel');
      if(s.dataset.id===player.weapon){ void s.offsetWidth; s.classList.add('sel'); } // restart the pop animation
    }
    drawWeaponIcon(weaponBar.icon.getContext('2d'),player.weapon,weaponBar.icon.width,weaponBar.icon.height);
  }
  weaponBar.el.classList.toggle('hidden', buildMode);
}

/* ---------- item icons ---------- */
// Small pictogram of a bag item, drawn in a 24x24 box scaled to fit w x h (also used for food lying on the ground).
function drawItemIcon(c,key,w,h){
  const R=(col,x,y,a,b)=>{ c.fillStyle=col; c.fillRect(x,y,a,b); };
  const P=(col,pts)=>{ c.fillStyle=col; c.beginPath(); pts.forEach((p,i)=>{ if(i) c.lineTo(p[0],p[1]); else c.moveTo(p[0],p[1]); }); c.closePath(); c.fill(); };
  const O=(col,x,y,r)=>{ c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); };
  const bowl=(rim,fill)=>{ // a dish seen from the side: the food heaped over a clay bowl
    c.fillStyle=fill; c.beginPath(); c.ellipse(12,12,8,4.5,0,Math.PI,0); c.fill();
    P(rim,[[3,12],[21,12],[18,19],[6,19]]); R('rgba(0,0,0,.25)',6,19,12,1.5); R('rgba(255,255,255,.25)',3,12,18,1.2);
  };
  c.save();
  const s=Math.min(w/24,h/24);
  c.translate((w-24*s)/2,(h-24*s)/2); c.scale(s,s);
  c.lineCap='round'; c.lineJoin='round';
  if(key==='bread'){
    c.fillStyle='#b9823f'; c.beginPath(); c.ellipse(12,13,9.5,6,0,0,Math.PI*2); c.fill();
    c.fillStyle='#d9a868'; c.beginPath(); c.ellipse(12,12,8.5,4.6,0,0,Math.PI*2); c.fill();
    c.strokeStyle='#8a5a26'; c.lineWidth=1.3; c.beginPath(); [7,11,15].forEach(x=>{ c.moveTo(x,9.5); c.lineTo(x+2.5,14.5); }); c.stroke();
  } else if(key==='bar'){
    R('#7a4a22',3,9,18,7); R('#c98a4a',6,9,12,7); R('#e8d9a0',6,11.5,12,2); P('#7a4a22',[[3,9],[1.5,12.5],[3,16]]); P('#7a4a22',[[21,9],[22.5,12.5],[21,16]]);
  } else if(key==='potato'){
    c.fillStyle='#b89466'; c.beginPath(); c.ellipse(12,13,8.5,6.2,-0.3,0,Math.PI*2); c.fill();
    O('#8a6a42',9,11,1); O('#8a6a42',14,15,1); O('#8a6a42',15,10.5,0.8); R('rgba(255,255,255,.25)',7,9,5,1.2);
  } else if(key==='rice'){
    P('#c9b98a',[[6,21],[4,10],[9,7],[15,7],[20,10],[18,21]]); R('#8a7244',8,5,8,2.2); P('#d9cba0',[[9,5],[10,2],[14,2],[15,5]]);
    c.fillStyle='#f4eeda'; [[9,13],[13,12],[11,16],[15,16]].forEach(g=>{ c.beginPath(); c.ellipse(g[0],g[1],1.6,0.9,0.6,0,Math.PI*2); c.fill(); });
  } else if(key==='meat'){
    c.fillStyle='#c0504a'; c.beginPath(); c.ellipse(11,13,8,6,0.2,0,Math.PI*2); c.fill();
    c.fillStyle='#e08a7c'; c.beginPath(); c.ellipse(10,12,4.5,3,0.2,0,Math.PI*2); c.fill();
    R('#eee6d2',17,6,2.2,6); O('#eee6d2',18.2,5,2);
  } else if(key==='mushroom'){
    R('#e6dcc0',10.3,12,3.4,8); c.fillStyle='#b0744a'; c.beginPath(); c.ellipse(12,12,8,6,0,Math.PI,0); c.fill();
    O('#e6dcc0',9,9.5,1.2); O('#e6dcc0',14,8.5,1); R('#8a5a36',4,11.4,16,1.2);
  } else if(key==='bakedpotato'){
    c.fillStyle='#8a5a2c'; c.beginPath(); c.ellipse(12,13,8.5,6.2,-0.3,0,Math.PI*2); c.fill();
    P('#f0d890',[[6,12],[12,9],[18,12],[12,15]]); O('#f6ecc0',12,12,1.6);
  } else if(key==='ricebowl'){
    bowl('#7a8a94','#f6f1e0'); O('#f6f1e0',9,9,2.4); O('#f6f1e0',14,8.5,2.6);
  } else if(key==='steak'){
    c.fillStyle='#7a4424'; c.beginPath(); c.ellipse(12,13,9,6,0.15,0,Math.PI*2); c.fill();
    c.strokeStyle='#3d2010'; c.lineWidth=1.4; c.beginPath(); [7,11,15].forEach(x=>{ c.moveTo(x,10); c.lineTo(x+3,16); }); c.stroke();
    R('rgba(255,255,255,.2)',6,9.5,6,1.2);
  } else if(key==='mushsoup'){
    bowl('#8a6a42','#d9c690'); O('#b0744a',9,10,1.6); O('#b0744a',14.5,10.5,1.4); O('#6fbf5a',12,9.5,1);
  } else if(key==='friedrice'){
    bowl('#5f696f','#e0b860'); O('#e0b860',10,8.5,2.4); O('#e0b860',14,9,2.2); O('#c3d16a',9,9,0.9); O('#c0504a',13.5,8,0.9); O('#c3d16a',15,10,0.8);
  } else if(key==='stew'){
    bowl('#5a3a22','#a8522a'); O('#c0504a',9,10,1.7); O('#d9b47a',13,9.5,1.6); O('#6fbf5a',15.5,10.5,1);
    c.strokeStyle='rgba(255,255,255,.5)'; c.lineWidth=1; c.beginPath(); c.moveTo(9,6); c.quadraticCurveTo(7.5,4,9,2); c.moveTo(14,6); c.quadraticCurveTo(12.5,4,14,2); c.stroke();
  } else if(key==='wood'){
    R('#8a6236',3,5,17,6); O('#d9b07a',20,8,3); O('#a67844',20,8,1.2);
    R('#a67844',4,13,17,6); O('#e2bd88',4,16,3); O('#a67844',4,16,1.2);
  } else if(key==='stone'){
    P('#8a8a80',[[3,17],[7,8],[14,5],[20,10],[21,18],[12,21]]); P('#bdbdb0',[[7,8],[14,5],[13,11],[8,13]]); P('#6e6e66',[[12,21],[21,18],[16,15]]);
  } else if(key==='metal'){
    P('#8fa0a8',[[3,8],[15,4],[17,12],[5,15]]); P('#647178',[[9,13],[21,10],[20,19],[10,21]]);
    O('#2a2c28',7,10,1); O('#2a2c28',17,16,1); R('rgba(255,255,255,.4)',6,7,7,1);
  } else if(key==='cloth'){
    R('#c9bfa0',4,7,16,12); R('#e6dec4',4,7,16,3); R('#a2987a',4,13,16,1.5); R('#a2987a',4,16.5,16,1);
  } else if(key==='food'){
    R('#8a8f88',7,4,10,16); R('#c3d16a',7,8,10,8); R('#d8dcd4',7,4,10,2); R('#6f7a34',9,11,6,2);
  } else if(key==='medkit'){
    R('#8a8f88',9,4,6,2); R('#e8e2d0',4,6,16,13); R('#e06a5a',10.5,8,3,9); R('#e06a5a',7.5,11,9,3);
  } else if(key==='ammo'){
    [5,10.5,16].forEach(x=>{ R('#d9a528',x,10,3.2,10); P('#b8705a',[[x,10],[x+1.6,4],[x+3.2,10]]); R('#8a6a1c',x,18,3.2,2); });
  } else if(key==='coal'){
    P('#2e2e34',[[3,18],[6,9],[13,6],[20,11],[21,19],[11,21]]); P('#6a6a74',[[8,10],[13,7],[13,12]]); P('#4a4a54',[[15,13],[19,12],[18,17]]);
  } else if(key==='sulfur'){
    P('#b8aa2a',[[3,20],[8,6],[13,20]]); P('#f0e26a',[[10,20],[15,9],[21,20]]); P('#d8c93a',[[6,20],[10,13],[14,20]]);
  } else if(key==='ore'){
    P('#6e625a',[[3,17],[7,7],[15,5],[21,11],[20,19],[10,21]]); O('#b8705a',9,11,2.2); O('#d08a6e',15,15,2.6); O('#b8705a',14,8,1.4);
  } else if(key==='herb'){
    c.strokeStyle='#4f8a3e'; c.lineWidth=1.6; c.beginPath(); c.moveTo(12,21); c.lineTo(12,9); c.stroke();
    P('#6fbf5a',[[12,10],[5,7],[4,13]]); P('#8fd16a',[[12,9],[19,5],[20,12]]); P('#6fbf5a',[[12,16],[6,15],[7,19]]); P('#8fd16a',[[12,15],[18,14],[17,19]]);
  } else if(key==='fuel'){
    R('#d0703a',5,7,13,14); R('#a8552a',5,7,13,2); R('#555a56',14,3,3.5,4); R('#a8552a',6,4,6,1.6); R('#a8552a',6,4,1.6,3);
    c.strokeStyle='#8a4420'; c.lineWidth=1.4; c.beginPath(); c.moveTo(8,11); c.lineTo(15,18); c.moveTo(15,11); c.lineTo(8,18); c.stroke();
  } else if(key==='gunpowder'){
    P('#5c5f68',[[5,21],[4,12],[9,9],[15,9],[20,12],[19,21]]); R('#b89a62',8,7,8,2); P('#74788a',[[9,7],[10,3],[14,3],[15,7]]);
    O('#2a2c30',10,15,1); O('#2a2c30',14,17,1); O('#2a2c30',13,13,1);
  } else if(key==='steel'){
    P('#9fb0bc',[[3,19],[6,10],[18,10],[21,19]]); P('#e6f0f6',[[6,10],[18,10],[17,12.5],[7,12.5]]); R('#74848e',3,19,18,1.6);
  } else if(key==='parts'){
    c.save(); c.translate(12,12);
    for(let i=0;i<8;i++){ c.rotate(Math.PI/4); R('#d9a528',-1.8,-10,3.6,5); }
    c.restore();
    O('#d9a528',12,12,6.6); O('#1c1c16',12,12,2.6);
  } else if(key==='rope'){
    c.strokeStyle='#b89a62'; c.lineWidth=3; c.beginPath(); c.arc(12,12,7,0,Math.PI*2); c.stroke();
    c.strokeStyle='#8a7244'; c.lineWidth=1.6; c.beginPath(); c.arc(12,12,3.4,0,Math.PI*2); c.stroke();
    c.strokeStyle='#b89a62'; c.lineWidth=2.4; c.beginPath(); c.moveTo(18,16); c.lineTo(22,21); c.stroke();
  } else if(key==='grenade'){
    R('#555a56',10,3,4,4); O('#7f9a4a',12,14,7); R('#5f7636',5,13,14,1.4); R('#5f7636',11.3,7,1.4,14);
    c.strokeStyle='#b4bec4'; c.lineWidth=1.3; c.beginPath(); c.arc(17,5,2.4,0,Math.PI*2); c.stroke();
  } else if(key==='molotov'){
    R('#5f8a5a',8,11,8,10); R('#5f8a5a',10.5,6,3,5); R('rgba(255,255,255,.3)',9.5,12,1.5,7);
    P('#f0c85a',[[10,6],[12,0.5],[14.5,6]]); P('#e8642a',[[11,6],[12.3,3],[13.6,6]]);
  }
  c.restore();
}
const itemIconCache = {};
function itemIconURL(key){
  if(!itemIconCache[key]){
    const c=document.createElement('canvas');
    c.width=c.height=72;
    drawItemIcon(c.getContext('2d'),key,72,72);
    itemIconCache[key]=c.toDataURL();
  }
  return itemIconCache[key];
}

const inv = {panel:$('invPanel'), slots:$('invSlots'), weapons:$('invWeapons'), gear:$('invGear'), bag:$('invBag'),
             chest:$('invChest'), chestWrap:$('invChestWrap'), bagLabel:$('invBagLabel'), chestLabel:$('invChestLabel'),
             weaponsLabel:$('invWeaponsLabel'), foot:$('invFoot'), cap:$('invCapHud'), gauge:$('invWt'), wtNum:$('invWtNum'), wtSub:$('invWtSub'),
             detail:$('invDetail'), bagName:$('invBagName'), hover:null, html:{}};
// Opens the inventory; with `chest` (a built 보관함) its contents are shown next to the bag.
function setInvOpen(on,chest){
  if(on && gameState!=='playing') return;
  invOpen=on; invChest=on ? (chest||null) : null;
  inv.panel.classList.toggle('hidden',!on);
  if(on){
    setCraftOpen(false); setBuildMode(false);
    mouse.down=false; mouse.rdown=false;
    inv.html={}; inv.hover=null;
    renderInventory();
  }
}
// One cell per stack; empty cells pad the grid out to the store's capacity.
function weaponCell(inst,i,cls,from){
  const w=WEAPONS[inst.id];
  return '<button class="'+cls+'" data-from="'+from+'" data-wi="'+i+'" data-w="'+inst.id+'" data-dur="'+inst.dur+'">'+
         '<img src="'+weaponIconURL(inst.id)+'" alt=""><span>'+w.name+'</span>'+durBar(inst.dur/w.dur)+'<em>'+kg(w.wt)+'kg</em></button>';
}
// `weapons` (a chest's stored weapons) come first, one cell each.
function stackCells(store,cap,from,weapons){
  let html='', n=0;
  if(weapons) weapons.forEach((inst,i)=>{ n++; html+=weaponCell(inst,i,'cell wpn',from); });
  for(const k in ITEMS){
    let left=store[k]||0;
    const st=stackOf(k);
    while(left>0){
      const c=Math.min(st,left); left-=c; n++;
      html+='<button class="cell'+(n>cap?' over':'')+'" data-from="'+from+'" data-k="'+k+'" data-n="'+c+'">'+
            '<img src="'+itemIconURL(k)+'" alt=""><b>'+c+'</b><span>'+ITEMS[k].name+'</span><em>'+kg(ITEMS[k].wt*c)+'kg</em></button>';
    }
  }
  for(;n<cap;n++) html+='<div class="cell empty"></div>';
  return html;
}
// Only touches the DOM when a section actually changed, so clicks are never swallowed by a refresh.
function setHtml(node,key,html){ if(inv.html[key]!==html){ inv.html[key]=html; node.innerHTML=html; } }
// Detail strip for whatever the pointer is over: {k, from} for a stack, {w} for a weapon.
function invDetailHtml(){
  const h=inv.hover;
  if(h && h.k && ITEMS[h.k]){
    const it=ITEMS[h.k], have=(h.from==='chest' && invChest ? invChest.store[h.k] : player.inv[h.k])||0;
    return '<img src="'+itemIconURL(h.k)+'" alt=""><div class="d-main"><div class="d-name">'+it.name+'</div><div class="d-desc">'+
           (it.eat ? T('클릭해서 먹기')+' · '+T('포만감')+' +'+it.eat.hunger+(it.eat.hp ? ' · '+T('체력')+' '+(it.eat.hp>0?'+':'')+it.eat.hp : '')+' — ' : '')+it.desc+'</div></div>'+
           '<div class="d-stats"><div><span>'+T('개당')+'</span><b>'+(it.wt<0.1 ? it.wt.toFixed(2) : kg(it.wt))+'kg</b></div>'+
           '<div><span>'+Tf(h.from==='chest'?'보관 {n}개':'보유 {n}개',{n:have})+'</span><b>'+kg(it.wt*have)+'kg</b></div>'+
           '<div><span>'+T('한 칸')+'</span><b>'+Tf('{n}개',{n:stackOf(h.k)})+'</b></div></div>';
  }
  if(h && h.w && WEAPONS[h.w]){
    const w=WEAPONS[h.w];
    return '<img class="wide" src="'+weaponIconURL(h.w)+'" alt=""><div class="d-main"><div class="d-name">'+w.name+'</div><div class="d-desc">'+
           (w.melee ? T('근접')+' · '+T('피해')+' '+w.dmg+' · '+T('사거리')+' '+w.range
                    : T('총기')+' · '+T('피해')+' '+w.dmg+(w.pellets>1?' ×'+w.pellets:'')+' · '+T('탄창')+' '+w.mag+T('발')+' · '+Tf('{x} 사용',{x:ITEMS[w.ammoKey||'ammo'].name}))+'</div></div>'+
           '<div class="d-stats"><div><span>'+T('무게')+'</span><b>'+kg(w.wt)+'kg</b></div>'+
           '<div><span>'+T('내구도')+'</span><b'+(h.dur<=w.dur*0.15?' class="lack"':'')+'>'+Math.ceil(h.dur)+' / '+w.dur+'</b></div>'+
           (w.tier ? '<div><span>'+T('등급')+'</span><b>'+TIER_NAME[w.tier]+'</b></div>' : '')+'</div>';
  }
  return '<div class="d-hint">'+Tf('물자와 <b>무기</b>(슬롯·가방 모두)에는 무게가 있습니다. 적재량을 넘으면 걸음이 느려지고, 적재량의 {n}%가 한계입니다 — 그 이상은 주울 수 없습니다. 보관함에 덜거나 우클릭으로 버리세요.',{n:Math.round(OVERLOAD_MAX*100)})+'</div>';
}
function renderInventory(){
  const ls=loadState(), over=ls.wt>ls.cap+1e-6;
  setGauge(inv.gauge, ls);
  inv.wtNum.innerHTML='<b>'+kg(ls.wt)+'</b> / '+kg(ls.cap)+' kg';
  inv.wtNum.classList.toggle('lack', over);
  inv.wtSub.textContent = over
    ? T('과적 — 이동 속도')+' −'+Math.round((1-loadSpeedMul())*100)+'% · '+T('한계')+' '+kg(ls.max)+'kg'
    : T('물자')+' '+kg(invWeight(player.inv))+' · '+T('무기')+' '+kg(weaponWeight())+' · '+T('한계')+' '+kg(ls.max)+'kg';
  inv.wtSub.classList.toggle('lack', over);
  inv.bagName.textContent=BAG_NAME[player.bagLvl];
  setHtml(inv.slots,'slots',player.slots.map((id,i)=>
    '<button class="islot'+(i===invSlotSel?' sel':'')+(id && id===player.weapon?' hand':'')+'" data-slot="'+i+'"'+(id?' data-w="'+id+'" data-dur="'+player.dur[id]+'"':'')+'><span class="k">'+(i+1)+'</span>'+
    (id ? '<img src="'+weaponIconURL(id)+'" alt=""><span class="n">'+WEAPONS[id].name+'</span>'+durBar(durRatio(id))+'<em>'+kg(WEAPONS[id].wt)+'kg</em>' : '<span class="we">'+T('빈 슬롯')+'</span>')+'</button>').join(''));
  inv.weaponsLabel.textContent = T('가방 속 무기')+' — '+T(invChest ? '클릭해서 보관함에 넣기' : '클릭해서 장착')+' · '+T('우클릭 버리기');
  setHtml(inv.weapons,'weapons',player.spares.length
    ? player.spares.map((s,i)=>weaponCell(s,i,'wcell','bag')).join('')
    : '<div class="w-none">'+T('가방에 든 무기가 없습니다<br>슬롯을 우클릭하면 무기를 가방으로 뺍니다')+'</div>');
  const gear=Object.keys(GEAR).filter(k=>player.gear[k]).map(k=>'<span class="mat">'+GEAR[k].name+'</span>');
  setHtml(inv.gear,'gear','<span class="mat">'+BAG_NAME[player.bagLvl]+' · '+Tf('{n}칸',{n:bagSlots()})+' · '+kg(ls.cap)+'kg</span>'+gear.join(''));
  inv.bagLabel.textContent=Tf('가방 {a} / {b}칸',{a:slotsUsed(player.inv),b:bagSlots()});
  setHtml(inv.bag,'bag',stackCells(player.inv,bagSlots(),'bag'));
  inv.chestWrap.classList.toggle('hidden',!invChest);
  if(invChest){
    inv.chestLabel.textContent=Tf('보관함 {a} / {b}칸',{a:slotsUsed(invChest.store)+invChest.weapons.length,b:CHEST_SLOTS})+' · '+
      kg(invWeight(invChest.store)+invChest.weapons.reduce((w,s)=>w+WEAPONS[s.id].wt,0))+'kg';
    setHtml(inv.chest,'chest',stackCells(invChest.store,CHEST_SLOTS,'chest',invChest.weapons));
  }
  setHtml(inv.detail,'detail',invDetailHtml());
  const key = s=>'<kbd>'+T(s)+'</kbd>';
  setHtml(inv.foot,'foot', (invChest
    ? key('클릭')+T('물자·무기 옮기기')+' · '+key('Shift+클릭')+T('같은 종류 전부')
    : key('클릭')+T('음식·구급상자 사용 · 무기는 슬롯을 고른 뒤 클릭해 장착'))+
    ' · '+key('우클릭')+T('버리기 / 슬롯 무기를 가방으로')+' · '+key('Shift+우클릭')+T('1개 버리기')+' · '+kbd(invChest?'interact':'inventory')+'/<kbd>ESC</kbd> '+T('닫기'));
}
inv.panel.addEventListener('click',e=>{
  const slot=e.target.closest('[data-slot]'), w=e.target.closest('.wcell'), cell=e.target.closest('button.cell');
  if(slot){
    invSlotSel=parseInt(slot.dataset.slot,10);
    switchWeapon(player.slots[invSlotSel]);
  } else if(w){
    const i=parseInt(w.dataset.wi,10);
    if(invChest) storeSpare(invChest,i); else equipSpare(i,invSlotSel);
  } else if(cell && cell.dataset.wi){
    if(invChest) takeStored(invChest, parseInt(cell.dataset.wi,10));
  } else if(cell){
    const k=cell.dataset.k, n=parseInt(cell.dataset.n,10), fromBag=cell.dataset.from==='bag';
    if(invChest) moveItem(invChest, k, e.shiftKey ? Infinity : n, fromBag);
    else if(ITEMS[k].eat) eatItem(k);
    else if(k==='medkit') tryHeal();
  }
  renderInventory();
});
inv.panel.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const cell=e.target.closest('button.cell'), slot=e.target.closest('[data-slot]'), w=e.target.closest('.wcell');
  if(w) dropSpare(parseInt(w.dataset.wi,10));
  else if(cell && cell.dataset.from==='bag') dropItem(cell.dataset.k, e.shiftKey ? 1 : parseInt(cell.dataset.n,10));
  else if(slot) unequipSlot(parseInt(slot.dataset.slot,10));
  else return;
  renderInventory();
});
inv.panel.addEventListener('mouseover',e=>{
  const t=e.target.closest('[data-k],[data-w]');
  const h = t ? (t.dataset.k ? {k:t.dataset.k, from:t.dataset.from} : {w:t.dataset.w, dur:parseFloat(t.dataset.dur)}) : null;
  if(JSON.stringify(h)===JSON.stringify(inv.hover)) return;
  inv.hover=h;
  setHtml(inv.detail,'detail',invDetailHtml());
});
