'use strict';

/* ============================================================
   LOOP
============================================================ */
resetGame(); // ensure world/player valid for idle background behind start screen
applyLang(); // saved language and key names onto every label
const app = document.getElementById('app');
// ash drifting across the title screen
for(let i=0;i<34;i++){
  const a = document.createElement('i');
  a.style.cssText = 'left:'+rr(-10,100).toFixed(1)+'%;--s:'+rr(1.5,4).toFixed(1)+'px;--d:'+rr(9,22).toFixed(1)+'s;--w:'+rr(80,320).toFixed(0)+'px;animation-delay:-'+rr(0,22).toFixed(1)+'s;opacity:'+rr(0.25,0.8).toFixed(2);
  document.getElementById('titleAsh').appendChild(a);
}
let lastTs = 0;
function loop(ts){
  if(!lastTs) lastTs = ts;
  let dt = (ts-lastTs)/1000;
  lastTs = ts;
  dt = Math.min(dt, 0.05);
  pollControls(); // gamepad and touch (controls.js)
  if(gameState==='playing' && !mapOpen) update(dt); // the full map pauses the world
  updateMusic();
  if(dial.open){ if(gameState!=='playing' || mapOpen) closeEatDial(false); else updateEatDial(); }
  if(app.dataset.state!==gameState) app.dataset.state = gameState; // lets the stylesheet hide the HUD behind the title
  if(gameState==='start'){ // slow pan over the ruins behind the title screen
    camera.x = clamp(player.x-VIEW_W/2+Math.sin(ts/11000)*320, 0, WORLD_W-VIEW_W);
    camera.y = clamp(player.y-VIEW_H/2+Math.cos(ts/14000)*190, 0, WORLD_H-VIEW_H);
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
