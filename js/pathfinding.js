'use strict';

/* ============================================================
   PATHFINDING — flow field toward the player.
   Built barricades are passable at a cost, so zombies detour
   when it's cheap and break through when it isn't.
============================================================ */
const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
const flowInQ = new Uint8Array(GW*GH);
function cellSolid(cx,cy){
  if(cx<0||cy<0||cx>=GW||cy>=GH) return true;
  const i=cy*GW+cx;
  return staticBlock[i]===1 || structBlocksZ(i);
}
function computeFlow(){
  distField.fill(Infinity);
  const pcx=clamp(Math.floor(player.x/CELL),0,GW-1), pcy=clamp(Math.floor(player.y/CELL),0,GH-1);
  const start=pcy*GW+pcx;
  distField[start]=0;
  const q=[start]; let head=0;
  while(head<q.length){
    const i=q[head++]; flowInQ[i]=0;
    const cx=i%GW, cy=(i-cx)/GW, d=distField[i];
    for(let n=0;n<8;n++){
      const dx=NB[n][0], dy=NB[n][1];
      const nx=cx+dx, ny=cy+dy;
      if(nx<0||ny<0||nx>=GW||ny>=GH) continue;
      if(Math.abs(nx-pcx)>FLOW_R || Math.abs(ny-pcy)>FLOW_R) continue; // zombies beyond this just head straight in
      const ni=ny*GW+nx;
      if(staticBlock[ni]) continue;
      if(dx&&dy && (cellSolid(cx+dx,cy)||cellSolid(cx,cy+dy))) continue;
      let c=NB[n][2];
      const s=structGrid[ni];
      if(s){ if(s.def.blockZ) c+=5+s.hp/22; else if(s.def.id==='spikes') c+=2; }
      const nd=d+c;
      if(nd<distField[ni]-1e-4){
        distField[ni]=nd;
        if(!flowInQ[ni]){ flowInQ[ni]=1; q.push(ni); }
      }
    }
  }
}
