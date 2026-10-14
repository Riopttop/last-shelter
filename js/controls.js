'use strict';

/* ============================================================
   CONTROLS — gamepad and touch, on top of keyboard + mouse.
   Both feed `vin` (what the sticks and held buttons say right now),
   which update() reads next to the keys, and both aim by moving
   the same `mouse` position the cursor does.
============================================================ */
const vin = {mx:0, my:0, fire:false, alt:false, use:false};

function cycleWeapon(dir){
  const have = equippedWeapons();
  if(!have.length) return;
  switchWeapon(have[(have.indexOf(player.weapon)+dir+have.length) % have.length]);
}
// Is the game itself taking input (no menu, no full map)?
function inPlay(){ return gameState==='playing' && !mapOpen && !settingsOpen && !confirmOpen; }
// Actions shared by the gamepad buttons and the touch buttons.
const PAD_ACTIONS = {
  use(){ if(inPlay()) interact(); },
  reload(){ if(inPlay()) startReload(); },
  heal(){ if(inPlay()) tryHeal(); },
  melee(){ if(inPlay() && !invOpen && !craftOpen) attemptMelee(); },
  grenade(){ if(inPlay() && !craftOpen && !buildMode && !invOpen) throwItem('grenade'); },
  molotov(){ if(inPlay() && !craftOpen && !buildMode && !invOpen) throwItem('molotov'); },
  build(){ if(inPlay()) setBuildMode(!buildMode); },
  bag(){ if(inPlay()){ if(craftOpen) setCraftOpen(false); else setInvOpen(!invOpen); } },
  swap(dir){ if(!inPlay()) return; if(buildMode) buildSel = (buildSel+(dir||1)+BUILD_DEFS.length) % BUILD_DEFS.length; else cycleWeapon(dir||1); },
  map(){ if(gameState==='playing' && !settingsOpen && !confirmOpen) setMapOpen(!mapOpen); },
  pause(){
    if(confirmOpen) closeConfirm(false);
    else if(settingsOpen) closeSettings();
    else if(gameState==='playing'){ setMapOpen(false); openPause(); }
    else if(gameState==='paused') closePause();
  },
};

/* ---------- gamepad (standard layout) ----------
   left stick move · right stick aim · RT fire / place · LT melee / demolish
   A use · B eat (hold to choose with the right stick) · X reload · Y heal · LB/RB weapon
   d-pad: up grenade, down molotov, left build mode, right bag · Back map · Start menu */
const pad = {prev:[], aim:0, aiming:false, mx:0, my:0, fire:false, alt:false, use:false};
window.addEventListener('mousemove', ()=>{ pad.aiming = false; }); // the mouse takes the aim back
function pollGamepad(){
  pad.mx = pad.my = 0; pad.fire = pad.alt = pad.use = false;
  const all = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for(const g of all) if(g && g.connected && g.mapping==='standard'){ gp = g; break; }
  if(!gp){ pad.prev = []; return; }
  const b = gp.buttons.map(x=>x.pressed || x.value>0.5), hit = i=>b[i] && !pad.prev[i], ax = gp.axes;
  const lx = ax[0]||0, ly = ax[1]||0, rx = ax[2]||0, ry = ax[3]||0;
  if(Math.hypot(lx,ly) > 0.22){ pad.mx = lx; pad.my = ly; }
  const rm = Math.hypot(rx,ry);
  if(rm > 0.3){ pad.aim = Math.atan2(ry,rx); pad.aiming = true; }

  if(hit(9)){ // Start
    if(gameState==='start') document.getElementById('continueBtn').classList.contains('hidden') ? newGame() : continueFromSave();
    else PAD_ACTIONS.pause();
  }
  if(confirmOpen){ if(hit(0)) closeConfirm(true); else if(hit(1)) closeConfirm(false); }
  else if(gameState==='paused' && !settingsOpen){ if(hit(0) || hit(1)) closePause(); }
  else if(gameState==='gameover'){
    if(hit(0)){ if(activeOutpost()) respawnAtCheckpoint(); else if(readSave()) continueFromSave(); else newGame(); }
  }
  else if(gameState==='playing' && mapOpen){ if(hit(1) || hit(8)) setMapOpen(false); }
  else if(inPlay()){
    if(hit(0)) PAD_ACTIONS.use();
    if(hit(1)) openEatDial();
    if(hit(2)) PAD_ACTIONS.reload();
    if(hit(3)) PAD_ACTIONS.heal();
    if(hit(4)) PAD_ACTIONS.swap(-1);
    if(hit(5)) PAD_ACTIONS.swap(1);
    if(hit(8)) PAD_ACTIONS.map();
    if(hit(12)) PAD_ACTIONS.grenade();
    if(hit(13)) PAD_ACTIONS.molotov();
    if(hit(14)) PAD_ACTIONS.build();
    if(hit(15)) PAD_ACTIONS.bag();
    pad.use = b[0]; pad.alt = b[6]; pad.fire = b[7];
    // the right stick moves the cursor: around the eat dial, onto a cell in build mode, else out along the aim
    if(dial.open){ mouse.x = dial.x+rx*100; mouse.y = dial.y+ry*100; }
    else if(pad.aiming && (!buildMode || rm>0.3)){
      const r = buildMode ? 40+rm*190 : 200;
      mouse.x = player.x-camera.x+Math.cos(pad.aim)*r; mouse.y = player.y-camera.y+Math.sin(pad.aim)*r;
    }
  }
  if(pad.prev[1] && !b[1]) closeEatDial(true);
  pad.prev = b;
}

/* ---------- touch ----------
   left part of the screen: a stick that appears under the thumb (move);
   anywhere else: a second stick — drag to aim, it fires for as long as the finger is down and leans
   toward a zombie near the line of fire. A tap without a drag shoots at the tapped spot, and in build
   mode the finger points at the cell itself. Buttons for the rest. */
const touch = {on:false, move:null, aim:null, mx:0, my:0, fire:false, alt:false, use:false, demolish:false,
               ui:document.getElementById('touchUI'), stick:document.getElementById('stick'), stick2:document.getElementById('stick2')};
const STICK_R = 64; // stick travel, in stage pixels
// a finger's position in view (canvas) pixels
function stagePos(t){
  const rect = canvas.getBoundingClientRect();
  return {x:(t.clientX-rect.left)*VIEW_W/rect.width, y:(t.clientY-rect.top)*VIEW_H/rect.height};
}
function enableTouch(){
  if(touch.on) return;
  touch.on = true;
  touch.ui.classList.remove('hidden');
  document.getElementById('app').classList.add('touch');
  fitStage(); // wider stage, closer view
}
function showStick(node,p){
  node.style.left = p.x*viewZoom+'px'; node.style.top = p.y*viewZoom+'px';
  node.firstElementChild.style.transform = '';
  node.classList.remove('hidden');
}
// The zombie closest to the aimed line (within 0.3 rad and 460 px) pulls the aim onto itself.
function aimAssist(a){
  let best = a, bd = 0.3;
  for(const z of zombies){
    if(!z.alive || dist2(z.x,z.y,player.x,player.y) > 460*460) continue;
    const za = Math.atan2(z.y-player.y, z.x-player.x), d = Math.abs(normAngle(za-a));
    if(d<bd){ bd = d; best = za; }
  }
  return best;
}
function touchAim(p){
  const a = touch.aim;
  if(buildMode){
    mouse.x = p.x; mouse.y = p.y;
    touch.fire = !touch.demolish; touch.alt = touch.demolish;
    return;
  }
  const dx = (p.x-a.x0)*viewZoom, dy = (p.y-a.y0)*viewZoom, d = Math.hypot(dx,dy);
  if(!a.stick && d>20){ a.stick = true; showStick(touch.stick2,{x:a.x0,y:a.y0}); }
  if(a.stick){
    if(d>8) a.ang = Math.atan2(dy,dx);
    const k = Math.min(1,STICK_R/(d||1));
    touch.stick2.firstElementChild.style.transform = 'translate('+dx*k+'px,'+dy*k+'px)';
  } else { mouse.x = p.x; mouse.y = p.y; }
  touch.fire = true; touch.alt = false;
}
canvas.addEventListener('touchstart', e=>{
  e.preventDefault(); // no synthetic mouse events
  enableTouch();
  ensureAudio();
  for(const t of e.changedTouches){
    const p = stagePos(t);
    if(mapOpen){ mouse.x = p.x; mouse.y = p.y; if(gameState==='playing') mapClick(0); continue; }
    if(gameState!=='playing') continue;
    if(p.x < VIEW_W*0.38 && !touch.move){
      touch.move = {id:t.identifier, x0:p.x, y0:p.y};
      showStick(touch.stick,p);
    } else if(!touch.aim){
      touch.aim = {id:t.identifier, x0:p.x, y0:p.y, stick:false, ang:0};
      touchAim(p);
    }
  }
},{passive:false});
canvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    const p = stagePos(t);
    if(touch.move && t.identifier===touch.move.id){
      let dx = (p.x-touch.move.x0)*viewZoom/STICK_R, dy = (p.y-touch.move.y0)*viewZoom/STICK_R;
      const d = Math.hypot(dx,dy);
      if(d>1){ dx/=d; dy/=d; }
      touch.mx = d<0.18 ? 0 : dx; touch.my = d<0.18 ? 0 : dy;
      touch.stick.firstElementChild.style.transform = 'translate('+(dx*STICK_R)+'px,'+(dy*STICK_R)+'px)';
    } else if(touch.aim && t.identifier===touch.aim.id) touchAim(p);
  }
},{passive:false});
function touchEnd(e){
  for(const t of e.changedTouches){
    if(touch.move && t.identifier===touch.move.id){ touch.move = null; touch.mx = touch.my = 0; touch.stick.classList.add('hidden'); }
    if(touch.aim && t.identifier===touch.aim.id){ touch.aim = null; touch.fire = touch.alt = false; touch.stick2.classList.add('hidden'); }
  }
}
window.addEventListener('touchstart', enableTouch, {passive:true}); // a tap on a menu counts too
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

// buttons: pointer events, so they answer to a finger and to the mouse alike
touch.ui.addEventListener('pointerdown', e=>{
  const b = e.target.closest('button');
  if(!b) return;
  e.preventDefault();
  ensureAudio();
  const a = b.dataset.t;
  if(a==='eat'){ if(inPlay()){ openEatDial(); dial.sel = dial.def; closeEatDial(true); } } // a tap eats what the dial would start on
  else if(a==='demolish') touch.demolish = !touch.demolish;
  else if(a==='full') toggleFullscreen();
  else PAD_ACTIONS[a]();
  if(a==='use') touch.use = true;
  if(a==='melee') touch.alt = true;
});
const touchRelease = ()=>{ touch.use = false; if(!touch.aim) touch.alt = false; };
window.addEventListener('pointerup', touchRelease);
window.addEventListener('pointercancel', touchRelease);
touch.ui.addEventListener('contextmenu', e=>e.preventDefault());

// Once a frame, before update().
function pollControls(){
  pollGamepad();
  vin.mx = clamp(pad.mx+touch.mx,-1,1); vin.my = clamp(pad.my+touch.my,-1,1);
  const play = inPlay();
  vin.fire = play && (pad.fire || touch.fire);
  vin.alt = play && (pad.alt || touch.alt);
  vin.use = play && (pad.use || touch.use);
  if(touch.aim && touch.aim.stick && play && !buildMode){ // the aim stick turns the player; the cursor rides ahead
    const a = aimAssist(touch.aim.ang);
    mouse.x = player.x-camera.x+Math.cos(a)*200; mouse.y = player.y-camera.y+Math.sin(a)*200;
  }
  if(touch.on){
    const d = touch.ui.querySelector('[data-t=demolish]');
    d.classList.toggle('off', !buildMode);
    d.classList.toggle('on', touch.demolish);
    if(!buildMode) touch.demolish = false;
  }
}
