'use strict';

/* ============================================================
   UTIL
============================================================ */
function makeRng(seed){
  let s = seed >>> 0;
  return function(){
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
function rr(a,b){ return a + rng()*(b-a); }
function ri(a,b){ return Math.floor(rr(a,b+1)); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function dist2(x1,y1,x2,y2){ const dx=x1-x2,dy=y1-y2; return dx*dx+dy*dy; }
function normAngle(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function rectsOverlap(a,b,m){ m=m||0; return !(a.x+a.w+m<b.x || b.x+b.w+m<a.x || a.y+a.h+m<b.y || b.y+b.h+m<a.y); }
function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
function costText(cost){ return Object.keys(cost).map(k=>ITEMS[k].name+' '+cost[k]).join(' · '); }
