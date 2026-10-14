'use strict';

/* ============================================================
   SETTINGS — audio levels, language, key bindings, blood.
   Kept in localStorage, apart from the save slot.
============================================================ */
const SETTINGS_KEY = 'lastShelter.settings.v1';
// bindable actions, in the order the settings list shows them
const BIND_DEFS = [
  {id:'up',        name:'위로 이동',          def:'w'},
  {id:'down',      name:'아래로 이동',        def:'s'},
  {id:'left',      name:'왼쪽으로 이동',      def:'a'},
  {id:'right',     name:'오른쪽으로 이동',    def:'d'},
  {id:'interact',  name:'줍기 · 상호작용',    def:'e'},
  {id:'melee',     name:'근접 공격 · 채집',   def:'f'},
  {id:'reload',    name:'재장전',             def:'r'},
  {id:'eat',       name:'식사 (꾹 눌러 선택)', def:'t'},
  {id:'heal',      name:'구급상자 사용',      def:'q'},
  {id:'grenade',   name:'수류탄 던지기',      def:'g'},
  {id:'molotov',   name:'화염병 던지기',      def:'v'},
  {id:'build',     name:'건설 모드',          def:'b'},
  {id:'inventory', name:'인벤토리',           def:'tab'},
  {id:'map',       name:'지도',               def:'m'},
  {id:'stats',     name:'능력치 · 저장',      def:'c'},
  {id:'mute',      name:'소리 켜기/끄기',     def:'n'},
];
// spare keys that always work as well, as long as nothing else is bound to them
const ALT_KEYS = {up:'arrowup', down:'arrowdown', left:'arrowleft', right:'arrowright', inventory:'i'};
const KEY_LABELS = {' ':'Space', tab:'Tab', shift:'Shift', capslock:'Caps', backspace:'Bksp', delete:'Del', insert:'Ins',
                    arrowup:'↑', arrowdown:'↓', arrowleft:'←', arrowright:'→', pageup:'PgUp', pagedown:'PgDn'};
// keys with a fixed job (menu, weapon / recipe numbers, admin panel) or that the browser keeps for itself
const KEY_BLOCKED = /^(escape|enter|[0-9]|`|~|f\d+|control|alt|altgraph|meta|os|contextmenu|process|dead|unidentified|hangulmode|hanjamode|numlock|scrolllock|pause|printscreen)$/;

// shake = strength of the screen shake (0 = none); dmgNum = damage numbers; lowHp = red screen edge at low health;
// slot = the save slot in use (save.js)
const settings = {master:1, sfx:1, ambient:1, music:0.6, muted:false, lang:'ko', gore:true, shake:1, dmgNum:true, lowHp:true, slot:0, binds:{}};
function defaultBinds(){ BIND_DEFS.forEach(b=>{ settings.binds[b.id] = b.def; }); }
defaultBinds();
(function loadSettings(){
  let d = null;
  try{ d = JSON.parse(localStorage.getItem(SETTINGS_KEY)); }catch(e){}
  if(!d) return;
  ['master','sfx','ambient','music','shake'].forEach(k=>{ if(typeof d[k]==='number') settings[k] = clamp(d[k],0,1); });
  settings.muted = !!d.muted;
  ['gore','dmgNum','lowHp'].forEach(k=>{ settings[k] = d[k]!==false; });
  if(d.slot>=0 && d.slot<3) settings.slot = d.slot|0;
  if(LANGS[d.lang]) settings.lang = d.lang;
  // a saved layout is taken only if it is complete and free of clashes
  const b = d.binds || {}, seen = {};
  if(BIND_DEFS.every(x=>typeof b[x.id]==='string' && bindable(b[x.id]) && !seen[b[x.id]] && (seen[b[x.id]]=true)))
    BIND_DEFS.forEach(x=>{ settings.binds[x.id] = b[x.id]; });
})();
function saveSettings(){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch(e){}
}

/* ---------- key bindings ---------- */
function bindable(k){ return !!k && !KEY_BLOCKED.test(k); }
function keyLabel(k){ return KEY_LABELS[k] || (k.length===1 ? k.toUpperCase() : k.charAt(0).toUpperCase()+k.slice(1)); }
// The action a key triggers, '' if none.
function actionOf(k){
  for(const a in settings.binds) if(settings.binds[a]===k) return a;
  for(const a in ALT_KEYS) if(ALT_KEYS[a]===k) return a;
  return '';
}
function held(a){ return !!(keys[settings.binds[a]] || (ALT_KEYS[a] && actionOf(ALT_KEYS[a])===a && keys[ALT_KEYS[a]])); }
function kbd(a){ return '<kbd>'+keyLabel(settings.binds[a])+'</kbd>'; }

/* ---------- language ---------- */
function T(s){
  const table = LANG_TABLES[settings.lang]; // none for Korean
  if(table && table[s]!==undefined) s = table[s];
  if(s.indexOf('{')<0) return s;
  return s.replace(/\{(\w+)\}/g,(m,a)=>{
    if(a==='move'){ // the four movement keys as one label: WASD
      const l = ['up','left','down','right'].map(d=>keyLabel(settings.binds[d]));
      return l.join(l.every(x=>x.length===1) ? '' : ' ');
    }
    return settings.binds[a] ? keyLabel(settings.binds[a]) : m;
  });
}
// T() with {tokens} filled in from vars
function Tf(s,vars){ return T(s).replace(/\{(\w+)\}/g,(m,k)=>k in vars ? vars[k] : m); }

// static text of index.html, remembered in Korean so it can be translated back and forth
const staticText = [];
(function(){
  const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  let n;
  while((n = w.nextNode())){
    const s = n.nodeValue.trim();
    if(!/[가-힣{]/.test(s) || n.parentElement.closest('[data-i18n]')) continue;
    staticText.push({n, s, pre:/^\s/.test(n.nodeValue)?' ':'', post:/\s$/.test(n.nodeValue)?' ':''});
  }
})();
const DATA_KO = {tier:TIER_NAME.slice(), bag:BAG_NAME.slice(), harvest:Object.assign({},HARVEST_NAME)};
// Swaps a definition's display strings for the current language; the Korean source is kept beside them.
function localize(o,fields){
  fields.forEach(f=>{
    if(o['_'+f]===undefined){ if(typeof o[f]!=='string') return; o['_'+f] = o[f]; }
    o[f] = T(o['_'+f]);
  });
}
const HUD_KEYS = [
  [['build','건설'],['interact','줍기·상호작용']],
  [['reload','재장전'],['eat','식사'],['heal','치료']],
  [['melee','근접·채집'],['map','지도·표시']],
  [['grenade','수류탄'],['molotov','화염병']],
  [['inventory','인벤토리'],['1-3','무기']],
  [['stats','능력치·저장'],['mute','소리']],
  [['ESC','메뉴·설정']],
];
const LOCALES = {ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN'}; // date format of the save slots
const HOWTO_KEYS = [
  ['{move}','이동'], ['좌클릭','공격 (단검 / 총)'], ['{interact}','줍기 · 뒤지기 · 제작대'], ['{melee}','근접 공격 · 채집'],
  ['{build}','건설 모드'], ['1-3','무기 교체 (휠)'], ['{inventory}','인벤토리 · 무게'], ['{grenade} / {molotov}','수류탄 / 화염병'],
  ['{reload}','재장전'], ['{eat} / {heal}','식사(꾹=선택) / 구급'], ['{stats}','능력치 · 저장'], ['{map}','지도 · 표시 남기기'],
  ['ESC','메뉴 · 설정'],
];
function renderKeyHints(){
  document.getElementById('keysPlate').innerHTML = HUD_KEYS.map(row=>
    '<div>'+row.map(h=>'<kbd>'+(settings.binds[h[0]] ? keyLabel(settings.binds[h[0]]) : h[0])+'</kbd>'+T(h[1])).join(' ')+'</div>').join('');
  document.getElementById('howto').innerHTML = HOWTO_KEYS.map(h=>
    '<div class="row"><kbd>'+T(h[0])+'</kbd><span>'+T(h[1])+'</span></div>').join('');
}
// Everything that shows text or a key name is refreshed here: after a language or a key change, and once at startup (main.js).
function applyLang(){
  document.documentElement.lang = settings.lang;
  document.title = T('최후의 피난처 — 좀비 서바이벌');
  for(const k in ITEMS) localize(ITEMS[k],['name','desc']);
  for(const k in WEAPONS) localize(WEAPONS[k],['name']);
  for(const k in GEAR) localize(GEAR[k],['name']);
  for(const k in BUILDING_TYPES) localize(BUILDING_TYPES[k],['name']); // `container` ends up in the saved crates, so it stays Korean
  for(const k in BOSSES) localize(BOSSES[k],['name','sub']);
  for(const k in DIFFICULTIES) localize(DIFFICULTIES[k],['name','desc']);
  localize(GUN_BUTT,['name']);
  BUILD_DEFS.forEach(d=>localize(d,['name']));
  CRAFT_TABS.forEach(d=>localize(d,['name']));
  RECIPES.forEach(d=>localize(d,['name','desc']));
  MARKER_TYPES.forEach(d=>localize(d,['name']));
  STAT_DEFS.forEach(d=>localize(d,['name','desc']));
  DATA_KO.tier.forEach((s,i)=>{ TIER_NAME[i] = T(s); });
  DATA_KO.bag.forEach((s,i)=>{ BAG_NAME[i] = T(s); });
  for(const k in DATA_KO.harvest) HARVEST_NAME[k] = T(DATA_KO.harvest[k]);

  staticText.forEach(t=>{ t.n.nodeValue = t.pre+T(t.s)+t.post; });
  document.querySelectorAll('[data-i18n]').forEach(n=>{
    const h = HTML_STR[n.dataset.i18n];
    n.innerHTML = T(h[settings.lang] || h.ko);
  });
  document.getElementById('rotateText').textContent = T('기기를 가로로 돌려 주세요');
  renderKeyHints();
  labelHud();
  labelAdmin();
  weaponBar.key = ''; inv.html = {};
  if(invOpen) renderInventory();
  if(craftOpen) buildCraftUI();
  renderPauseMenu();
  refreshSaveUI();
  updateHUD();
  renderSettings();
}

/* ---------- blood ---------- */
// colour of a blood splash; pale dust when blood is switched off
function bloodCol(c){ return settings.gore ? c : '#a39c84'; }

/* ---------- settings panel ---------- */
const setUI = {overlay:document.getElementById('settingsOverlay'), binds:document.getElementById('bindList'),
               msg:document.getElementById('bindMsg'), lang:document.getElementById('setLang'), tab:'audio', wait:''};
let settingsOpen = false;
function openSettings(){
  settingsOpen = true; setUI.wait = '';
  renderSettings();
  setUI.overlay.classList.remove('hidden');
}
function closeSettings(){
  settingsOpen = false; setUI.wait = '';
  setUI.overlay.classList.add('hidden');
}
function renderSettings(){
  setUI.overlay.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('sel', b.dataset.tab===setUI.tab));
  setUI.overlay.querySelectorAll('[data-page]').forEach(p=>p.classList.toggle('hidden', p.dataset.page!==setUI.tab));
  setUI.overlay.querySelectorAll('[data-vol]').forEach(r=>{
    const v = Math.round(settings[r.dataset.vol]*100);
    r.value = v; r.nextElementSibling.textContent = v+'%';
  });
  const toggle = (b,on)=>{ b.classList.toggle('sel',on); b.textContent = T(on ? '켜짐' : '꺼짐'); };
  setUI.overlay.querySelectorAll('[data-toggle]').forEach(b=>toggle(b, settings[b.dataset.toggle]));
  toggle(document.getElementById('setFull'), !!document.fullscreenElement);
  setUI.lang.innerHTML = Object.keys(LANGS).map(l=>'<button class="diff-btn'+(l===settings.lang?' sel':'')+'" data-lang="'+l+'">'+LANGS[l]+'</button>').join('');
  setUI.binds.innerHTML = BIND_DEFS.map(b=>
    '<div class="bind-row"><span>'+T(b.name)+'</span><button class="bind-key'+(setUI.wait===b.id?' wait':'')+'" data-bind="'+b.id+'">'+
    (setUI.wait===b.id ? T('키 입력…') : keyLabel(settings.binds[b.id]))+'</button></div>').join('');
  setBindMsg(setUI.wait ? '새 키를 누르세요… (ESC 취소)' : '');
}
function setBindMsg(s){
  setUI.msg.textContent = T(s || '바꿀 키를 클릭한 뒤 새 키를 누르세요 · 이미 쓰는 키는 서로 맞바뀝니다 · ESC·숫자·마우스는 고정');
}
setUI.overlay.addEventListener('click', e=>{
  const b = e.target.closest('button');
  const was = setUI.wait;
  setUI.wait = ''; // a click anywhere else calls off a pending key change
  if(!b){ if(was) renderSettings(); return; }
  b.blur(); // so Space / Enter don't press it again
  if(b.dataset.tab) setUI.tab = b.dataset.tab;
  else if(b.dataset.bind){ if(was!==b.dataset.bind) setUI.wait = b.dataset.bind; }
  else if(b.dataset.lang){ settings.lang = b.dataset.lang; saveSettings(); applyLang(); return; }
  else if(b.dataset.toggle){
    const k = b.dataset.toggle;
    settings[k] = !settings[k];
    saveSettings();
    if(k==='muted'){ ensureAudio(); applyVolume(); }
    if(k==='gore') groundChunks.clear(); // the ground is baked again, with or without its stains
  }
  else if(b.id==='setFull'){ toggleFullscreen(); return; } // the label follows on 'fullscreenchange'
  else if(b.id==='bindReset'){ defaultBinds(); saveSettings(); applyLang(); return; }
  else if(b.id==='settingsClose'){ closeSettings(); return; }
  renderSettings();
});
setUI.overlay.addEventListener('input', e=>{
  const r = e.target;
  if(!r.dataset.vol) return;
  settings[r.dataset.vol] = r.value/100;
  r.nextElementSibling.textContent = r.value+'%';
  ensureAudio(); applyVolume();
});
// on release: store the level and play a sample at it
setUI.overlay.addEventListener('change', e=>{
  if(!e.target.dataset.vol) return;
  saveSettings();
  if(e.target.dataset.vol==='master' || e.target.dataset.vol==='sfx') sfx.loot();
});
// Has to be called from a tap or a click. False where the browser has no fullscreen at all (iPhone).
function enterFullscreen(){
  const el = document.documentElement;
  if(!el.requestFullscreen) return false;
  if(document.fullscreenElement) return true;
  el.requestFullscreen({navigationUI:'hide'}).then(()=>{
    if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); // phones: keep it sideways
  }).catch(()=>{});
  return true;
}
function toggleFullscreen(){
  if(document.fullscreenElement) document.exitFullscreen();
  else if(!enterFullscreen()) askConfirm(T('이 브라우저는 전체화면 전환을 지원하지 않습니다. 아이폰은 공유 버튼 → "홈 화면에 추가"로 설치한 뒤 그 아이콘으로 열면 전체화면으로 실행됩니다.'));
}
document.addEventListener('fullscreenchange', renderSettings);
// While a key change is pending, the next key press belongs to it and never reaches the game.
window.addEventListener('keydown', e=>{
  if(!setUI.wait) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k = keyName(e);
  if(k==='escape'){ setUI.wait = ''; renderSettings(); return; }
  if(!bindable(k)){ setBindMsg('이 키는 사용할 수 없습니다'); sfx.deny(); return; }
  const a = setUI.wait, other = BIND_DEFS.find(b=>b.id!==a && settings.binds[b.id]===k);
  if(other) settings.binds[other.id] = settings.binds[a]; // the two actions trade keys
  settings.binds[a] = k;
  setUI.wait = '';
  saveSettings();
  applyLang(); // key names appear all over the HUD
}, true);
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('titleSettingsBtn').addEventListener('click', openSettings);
