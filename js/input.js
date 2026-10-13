'use strict';

/* ============================================================
   INPUT
============================================================ */
const keys = {};
const mouse = {x:0,y:0,down:false,rdown:false};

window.addEventListener('keydown', e=>{
  const k = keyName(e);
  if(e.repeat){ keys[k]=true; return; }
  keys[k] = true;
  if(confirmOpen){ // a yes / no question is up: Enter = yes, Esc = no
    if(k==='escape') closeConfirm(false);
    else if(k==='enter'){ e.preventDefault(); closeConfirm(true); }
    return;
  }
  if(k==='escape'){
    if(settingsOpen){ closeSettings(); return; }
    if(gameState==='playing'){
      if(dial.open){ closeEatDial(false); return; }
      if(mapOpen){ setMapOpen(false); return; }
      if(craftOpen){ setCraftOpen(false); return; }
      if(invOpen){ setInvOpen(false); return; }
      if(buildMode){ setBuildMode(false); return; }
      openPause();
    } else if(gameState==='paused'){ closePause(); }
    return;
  }
  if(settingsOpen) return;
  const a = actionOf(k); // key bindings: settings.js
  if(a==='mute'){ showToast(toggleMute() ? '소리 끔' : '소리 켬'); return; }
  if(gameState==='start'){ // title screen: Enter continues the save if there is one, else starts a new game
    if(k==='enter' && document.activeElement.tagName!=='BUTTON'){
      const cont = document.getElementById('continueBtn');
      (cont.classList.contains('hidden') ? document.getElementById('startBtn') : cont).click();
    }
    return;
  }
  if(e.code==='F2' || e.code==='Backquote'){ e.preventDefault(); toggleAdmin(); return; }
  if(a==='map'){ if(gameState==='playing') setMapOpen(!mapOpen); return; }
  if(a==='stats'){
    if(gameState==='playing'){ setMapOpen(false); openPause(); } else if(gameState==='paused') closePause();
    return;
  }
  if(mapOpen){
    if(gameState==='playing' && k>='1' && k<=String(MARKER_TYPES.length)) markerSel = parseInt(k,10)-1;
    return;
  }
  if(gameState==='paused' && k>='1' && k<='9'){ spendPoint(parseInt(k,10)-1); return; }
  if(gameState!=='playing') return;
  if(k==='tab') e.preventDefault();
  if(a==='inventory'){ if(craftOpen) cycleCraftTab(e.shiftKey?-1:1); else setInvOpen(!invOpen); return; }
  if(a==='interact') interact();
  else if(a==='grenade'){ if(!craftOpen && !buildMode && !invOpen) throwItem('grenade'); }
  else if(a==='molotov'){ if(!craftOpen && !buildMode && !invOpen) throwItem('molotov'); }
  else if(a==='heal') tryHeal();
  else if(a==='reload') startReload();
  else if(a==='eat') openEatDial(); // hold to choose, release to eat (a quick tap eats the last choice)
  else if(a==='melee'){ if(!invOpen) attemptMelee(); }
  else if(a==='build') setBuildMode(!buildMode);
  else if(k>='0' && k<='9'){
    const n=(parseInt(k,10)+9)%10; // 1..9 -> 0..8, 0 -> 9
    if(craftOpen) craftByKey(n);
    else if(buildMode){ if(n<BUILD_DEFS.length) buildSel=n; }
    else if(invOpen){ if(n<WEAPON_SLOTS){ invSlotSel=n; renderInventory(); } }
    else if(n<WEAPON_SLOTS) switchWeapon(player.slots[n]);
  }
});
window.addEventListener('keyup', e=>{
  const k = keyName(e);
  keys[k] = false;
  if(actionOf(k)==='eat') closeEatDial(true);
});
// Physical key, so the controls keep working while a Korean (or other) input method is active.
function keyName(e){
  const c = e.code || '';
  if(c.startsWith('Key')) return c.slice(3).toLowerCase();
  if(c.startsWith('Digit')) return c.slice(5);
  return e.key.toLowerCase();
}
window.addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; mouse.down=false; mouse.rdown=false; closeEatDial(false); });

window.addEventListener('mousemove', e=>{
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left)*VIEW_W/rect.width; mouse.y = (e.clientY - rect.top)*VIEW_H/rect.height; // window pixels -> stage pixels
});
canvas.addEventListener('mousedown', e=>{
  if(mapOpen){ if(gameState==='playing') mapClick(e.button); return; }
  if(e.button===0) mouse.down = true;
  if(e.button===2) mouse.rdown = true;
});
window.addEventListener('mouseup', e=>{
  if(e.button===0) mouse.down = false;
  if(e.button===2) mouse.rdown = false;
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('wheel', e=>{
  if(gameState!=='playing') return;
  if(mapOpen){
    markerSel = (markerSel + (e.deltaY>0?1:-1) + MARKER_TYPES.length) % MARKER_TYPES.length;
  } else if(buildMode){
    buildSel = (buildSel + (e.deltaY>0?1:-1) + BUILD_DEFS.length) % BUILD_DEFS.length;
  } else {
    const have = equippedWeapons();
    const i = have.indexOf(player.weapon);
    switchWeapon(have[(i + (e.deltaY>0?1:-1) + have.length) % have.length]);
  }
},{passive:true});

document.getElementById('startBtn').addEventListener('click', ()=>newGame()); // save.js
document.getElementById('resumeBtn').addEventListener('click', closePause);
document.getElementById('respawnBtn').addEventListener('click', respawnAtCheckpoint);
document.getElementById('retryBtn').addEventListener('click', ()=>newGame());
