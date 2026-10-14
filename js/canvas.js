'use strict';

/* ============================================================
   CANVAS SETUP
============================================================ */
// The game always renders a 1280x720 view; the whole stage (canvas + HUD) is scaled
// to fit the window, so a bigger window shows the same area, just larger.
// On a touch screen the stage widens to the screen's shape (no black bars on a phone) and the view is
// zoomed in: the canvas then has fewer pixels than the stage and is stretched over it.
// VIEW_W x VIEW_H = canvas pixels (mouse and camera work in these); STAGE_W x 720 = the HUD's layout pixels.
let VIEW_W = 1280, VIEW_H = 720, STAGE_W = 1280, viewZoom = 1;
const STAGE_H = 720, TOUCH_ZOOM = 1.3;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
canvas.width = lightCanvas.width = VIEW_W;
canvas.height = lightCanvas.height = VIEW_H;

function fitStage(){
  const stage = document.getElementById('app'), touchMode = stage.classList.contains('touch');
  STAGE_W = touchMode ? Math.round(clamp(STAGE_H*window.innerWidth/window.innerHeight, 1280, 1680)) : 1280;
  viewZoom = touchMode ? TOUCH_ZOOM : 1;
  const w = Math.round(STAGE_W/viewZoom), h = Math.round(STAGE_H/viewZoom);
  if(w!==VIEW_W || h!==VIEW_H){
    VIEW_W = canvas.width = lightCanvas.width = w;
    VIEW_H = canvas.height = lightCanvas.height = h;
  }
  const s = Math.min(window.innerWidth/STAGE_W, window.innerHeight/STAGE_H);
  stage.style.width = STAGE_W+'px';
  stage.style.transform = 'translate(-50%,-50%) scale('+s+')';
}
window.addEventListener('resize', fitStage);
fitStage();

function rrect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}
