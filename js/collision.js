'use strict';

/* ============================================================
   COLLISION
============================================================ */
function resolveCircleRect(ent, rect){
  const cx = Math.max(rect.x, Math.min(ent.x, rect.x+rect.w));
  const cy = Math.max(rect.y, Math.min(ent.y, rect.y+rect.h));
  const dx = ent.x-cx, dy = ent.y-cy;
  const d2 = dx*dx+dy*dy;
  if(d2 < ent.r*ent.r){
    const d = Math.sqrt(d2) || 0.001;
    const overlap = ent.r - d;
    ent.x += (dx/d)*overlap;
    ent.y += (dy/d)*overlap;
    return true;
  }
  return false;
}
function collideWithWorld(ent){
  for(const h of houses){
    if(ent.x<h.x-30||ent.x>h.x+h.w+30||ent.y<h.y-30||ent.y>h.y+h.h+30) continue;
    for(const w of h.walls) resolveCircleRect(ent, w);
  }
  for(const o of obstacles){
    if(Math.abs(ent.x-o.x)>130||Math.abs(ent.y-o.y)>130) continue;
    resolveCircleRect(ent, obstacleRect(o));
  }
  ent.x = clamp(ent.x, ent.r, WORLD_W-ent.r);
  ent.y = clamp(ent.y, ent.r, WORLD_H-ent.r);
}
// Returns the built structure the entity bumped into (preferring `want`), if any.
function collideStructs(ent,isZombie,want){
  const cx=Math.floor(ent.x/CELL), cy=Math.floor(ent.y/CELL);
  let hit=null;
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    const nx=cx+dx, ny=cy+dy;
    if(nx<0||ny<0||nx>=GW||ny>=GH) continue;
    const s=structGrid[ny*GW+nx];
    if(!s) continue;
    if(isZombie ? !s.def.blockZ : !s.def.blockP) continue;
    if(resolveCircleRect(ent,s.rect)){ if(!hit || s.cell===want) hit=s; }
  }
  return hit;
}
