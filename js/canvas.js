'use strict';

/* ============================================================
   CANVAS SETUP
============================================================ */
// The game always renders a 1280x720 view; the whole stage (canvas + HUD) is scaled
// to fit the window, so a bigger window shows the same area, just larger.
const VIEW_W = 1280, VIEW_H = 720;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
canvas.width = lightCanvas.width = VIEW_W;
canvas.height = lightCanvas.height = VIEW_H;

function fitStage(){
  const s = Math.min(window.innerWidth/VIEW_W, window.innerHeight/VIEW_H);
  document.getElementById('app').style.transform = 'translate(-50%,-50%) scale('+s+')';
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
