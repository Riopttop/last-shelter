'use strict';

/* ============================================================
   AUDIO (synthesized SFX + ambience, no external files)
============================================================ */
// masterGain <- sfxGain (every tone and burst) + ambGain (wind, night drone) + musicGain; the levels come from settings.js
let actx = null, masterGain = null, sfxGain = null, ambGain = null, musicGain = null, ambience = null;

function ensureAudio(){
  if(!actx){
    try{
      actx = new (window.AudioContext||window.webkitAudioContext)();
      masterGain = actx.createGain();
      sfxGain = actx.createGain(); ambGain = actx.createGain(); musicGain = actx.createGain();
      sfxGain.connect(masterGain); ambGain.connect(masterGain); musicGain.connect(masterGain);
      masterGain.connect(actx.destination);
      applyVolume();
      startAmbience();
    }catch(e){ actx = null; }
  }
  if(actx && actx.state==='suspended'){ actx.resume(); }
}
function applyVolume(){
  if(!masterGain) return;
  masterGain.gain.value = settings.muted ? 0 : settings.master;
  sfxGain.gain.value = settings.sfx;
  ambGain.gain.value = settings.ambient;
  musicGain.gain.value = settings.music;
}
function toggleMute(){
  settings.muted = !settings.muted;
  applyVolume();
  saveSettings();
  return settings.muted;
}
function tone(freq,dur,type,vol,slideTo,delay){
  if(!actx) return;
  const t0=actx.currentTime+(delay||0);
  const osc=actx.createOscillator(), gain=actx.createGain();
  osc.type=type||'square'; osc.frequency.setValueAtTime(freq,t0);
  if(slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo,1),t0+dur);
  gain.gain.setValueAtTime(vol||0.15,t0);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  osc.connect(gain).connect(sfxGain);
  osc.start(t0); osc.stop(t0+dur+0.02);
}
// lowpass (Hz) is optional; it turns the hiss into thuds and rustles
function noiseBurst(dur,vol,lowpass){
  if(!actx) return;
  const n = Math.max(1,Math.floor(actx.sampleRate*dur));
  const buf = actx.createBuffer(1,n,actx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<n;i++) data[i]=(Math.random()*2-1)*(1-i/n);
  const src=actx.createBufferSource(); src.buffer=buf;
  const gain=actx.createGain(); gain.gain.setValueAtTime(vol||0.2,actx.currentTime);
  let node=src;
  if(lowpass){
    const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lowpass;
    node=src.connect(f);
  }
  node.connect(gain).connect(sfxGain); src.start();
}

// Looping wind bed plus a low drone that swells at night.
function startAmbience(){
  const len = actx.sampleRate*3;
  const buf = actx.createBuffer(1,len,actx.sampleRate);
  const data = buf.getChannelData(0);
  let last=0;
  for(let i=0;i<len;i++){ last = last*0.98 + (Math.random()*2-1)*0.02; data[i]=last*6; }
  const src = actx.createBufferSource(); src.buffer=buf; src.loop=true;
  const filter = actx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=500;
  const wind = actx.createGain(); wind.gain.value=0.05;
  src.connect(filter).connect(wind).connect(ambGain); src.start();

  const osc = actx.createOscillator(); osc.type='sine'; osc.frequency.value=52;
  const osc2 = actx.createOscillator(); osc2.type='sine'; osc2.frequency.value=78.5;
  const drone = actx.createGain(); drone.gain.value=0;
  osc.connect(drone); osc2.connect(drone); drone.connect(ambGain);
  osc.start(); osc2.start();
  ambience = {wind, drone, filter};
}
function setAmbience(dark, active){
  if(!ambience) return;
  const t = actx.currentTime;
  ambience.wind.gain.setTargetAtTime(active ? 0.05+0.05*dark : 0.02, t, 0.5);
  ambience.drone.gain.setTargetAtTime(active ? 0.05*dark : 0, t, 0.8);
  ambience.filter.frequency.setTargetAtTime(520-220*dark, t, 0.8);
}

/* ---------- music: a 16-step sequencer with three moods (day, night, boss) ---------- */
// prog = one chord per bar, as semitones above A2; a change of mood waits for the next bar
const MUSIC = {
  day:  {bpm:70,  prog:[[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]]},
  night:{bpm:56,  prog:[[0,3,7],[0,3,7],[5,8,12],[-5,-1,2]]},
  boss: {bpm:132, prog:[[0,3,7],[0,3,7],[-4,0,3],[-2,2,5]]},
};
const music = {mood:'', next:0, step:0, bar:0, noise:null};
function musicMood(){
  if(gameState!=='playing' && gameState!=='paused') return 'night'; // title, game over
  if(zombies.some(z=>z.alive && z.kind==='boss')) return 'boss';
  return isNight() ? 'night' : 'day';
}
function mnote(semi,t,dur,type,vol,cut){
  const osc=actx.createOscillator(), gain=actx.createGain(), f=actx.createBiquadFilter();
  osc.type=type; osc.frequency.value=110*Math.pow(2,semi/12);
  f.type='lowpass'; f.frequency.value=cut;
  gain.gain.setValueAtTime(0.0001,t);
  gain.gain.linearRampToValueAtTime(vol,t+Math.min(0.05,dur*0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  osc.connect(f).connect(gain).connect(musicGain);
  osc.start(t); osc.stop(t+dur+0.05);
}
function mkick(t){
  const osc=actx.createOscillator(), gain=actx.createGain();
  osc.frequency.setValueAtTime(130,t); osc.frequency.exponentialRampToValueAtTime(42,t+0.14);
  gain.gain.setValueAtTime(0.22,t); gain.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
  osc.connect(gain).connect(musicGain); osc.start(t); osc.stop(t+0.2);
}
function mhat(t){
  if(!music.noise){
    music.noise = actx.createBuffer(1,Math.floor(actx.sampleRate*0.05),actx.sampleRate);
    const d = music.noise.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  }
  const src=actx.createBufferSource(), gain=actx.createGain(), f=actx.createBiquadFilter();
  src.buffer=music.noise; f.type='highpass'; f.frequency.value=6000; gain.gain.value=0.05;
  src.connect(f).connect(gain).connect(musicGain); src.start(t);
}
// Called every frame: schedules the steps that fall into the next 0.2 s.
function updateMusic(){
  if(!actx || actx.state!=='running' || settings.muted || settings.music<=0){ music.next=0; return; }
  const now = actx.currentTime;
  if(music.next < now) music.next = now+0.06; // first run, or the tab was asleep
  while(music.next < now+0.2){
    if(music.step===0){ const m=musicMood(); if(m!==music.mood){ music.mood=m; music.bar=0; } }
    const M=MUSIC[music.mood], st=60/M.bpm/4, ch=M.prog[music.bar%M.prog.length], t=music.next, s=music.step;
    const any = ()=>ch[Math.floor(Math.random()*3)];
    if(music.mood==='day'){ // soft pad, a low root, plucked notes now and then
      if(s===0){ ch.forEach(n=>mnote(n+12,t,st*16,'triangle',0.035,900)); mnote(ch[0]-12,t,st*14,'sine',0.09,300); }
      if(s%2===0 && Math.random()<0.5) mnote(any()+24+(Math.random()<0.3?12:0),t,st*3,'triangle',0.05,1800);
    } else if(music.mood==='night'){ // drone, a slow double thump, far-off bells
      if(s===0){ mnote(ch[0]-12,t,st*16,'sine',0.12,220); mnote(ch[0]-11.9,t,st*16,'sawtooth',0.03,180); }
      if(s===0 || s===3) mnote(ch[0]-24,t,0.25,'sine',0.16,140);
      if(s%4===2 && Math.random()<0.3) mnote(any()+36,t,st*6,'sine',0.03,2600);
    } else { // driving bass, kick on every beat, stabs
      if(s%2===0) mnote(ch[0]-12,t,st*1.7,'sawtooth',0.09,s%8===0?700:420);
      if(s%4===0) mkick(t);
      if(s%4===2) mhat(t);
      if(s===0) ch.forEach(n=>mnote(n+12,t,st*8,'sawtooth',0.03,1200));
      if(s===0||s===3||s===6||s===10||s===12) mnote(ch[(s>>1)%3]+24,t,st*1.5,'square',0.035,1600);
    }
    music.next += st;
    if(++music.step>=16){ music.step=0; music.bar++; }
  }
}

const sfx = {
  turret:()=>{ noiseBurst(0.05,0.1); tone(260,0.04,'square',0.03,120); },
  shoot:()=>{ noiseBurst(0.07,0.22); tone(220,0.05,'square',0.05,90); },
  shotgun:()=>{ noiseBurst(0.16,0.32); tone(80,0.14,'sawtooth',0.12,40); },
  explode:()=>{ noiseBurst(0.45,0.4,700); tone(60,0.4,'sawtooth',0.22,28); },
  flame:()=>noiseBurst(0.09,0.09,1400),
  hit:()=>tone(190,0.07,'square',0.1,70),
  death:()=>tone(90,0.3,'sawtooth',0.16,35),
  hurt:()=>tone(140,0.22,'sawtooth',0.18,55),
  loot:()=>tone(660,0.09,'triangle',0.12,900),
  pickup:()=>tone(520,0.06,'triangle',0.09,760),
  heal:()=>tone(520,0.14,'sine',0.14,820),
  eat:()=>tone(240,0.12,'triangle',0.12,180),
  empty:()=>tone(110,0.06,'square',0.08),
  melee:()=>noiseBurst(0.05,0.17),
  chop:()=>{ noiseBurst(0.04,0.14); tone(150,0.06,'square',0.07,90); },
  open:()=>tone(300,0.1,'triangle',0.1,220),
  build:()=>{ tone(180,0.06,'square',0.1,120); noiseBurst(0.05,0.12); },
  thud:()=>tone(70,0.1,'sine',0.14,45),
  break:()=>{ noiseBurst(0.18,0.22); tone(110,0.2,'sawtooth',0.1,40); },
  craft:()=>{ tone(440,0.08,'triangle',0.12,660); tone(660,0.12,'triangle',0.12,990,0.08); },
  deny:()=>tone(130,0.09,'square',0.07,100),
  step:()=>noiseBurst(0.05,0.07,rr(500,800)),
  reload:()=>{ tone(900,0.03,'square',0.06,500); noiseBurst(0.04,0.08,1800); },
  reloadDone:()=>{ tone(600,0.03,'square',0.07,1100); tone(1200,0.04,'square',0.06,900,0.07); },
  swap:()=>{ noiseBurst(0.03,0.07,2200); tone(700,0.03,'square',0.04,500); },
  groan:(vol)=>{ const f=rr(62,105); tone(f,rr(0.45,0.8),'sawtooth',vol,f*rr(0.6,0.85)); },
  slam:()=>{ noiseBurst(0.3,0.35,400); tone(55,0.35,'sine',0.3,30); },
  spit:()=>{ noiseBurst(0.12,0.16,1200); tone(320,0.14,'sawtooth',0.07,120); },
  splat:()=>{ noiseBurst(0.2,0.2,900); tone(140,0.15,'triangle',0.08,60); },
  whip:()=>{ noiseBurst(0.1,0.2,3000); tone(900,0.12,'sawtooth',0.06,200); },
  screech:()=>{ tone(700,0.5,'sawtooth',0.1,1400); tone(1050,0.4,'square',0.04,600,0.05); },
  hatch:()=>{ noiseBurst(0.08,0.14,2000); tone(400,0.08,'triangle',0.07,700); },
  rumble:()=>{ noiseBurst(0.25,0.18,300); tone(48,0.3,'sine',0.2,36); },
  roar:()=>{ tone(95,1.1,'sawtooth',0.26,38); tone(142,0.9,'square',0.08,50); noiseBurst(0.7,0.2,500); },
  levelup:()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,0.16,'triangle',0.12,f,i*0.09)); },
  heartbeat:()=>{ tone(58,0.1,'sine',0.3,40); tone(52,0.1,'sine',0.22,36,0.17); },
  nightfall:()=>{ tone(196,0.9,'sine',0.1,98); tone(147,1.2,'sine',0.08,73,0.25); },
  dawn:()=>{ tone(330,0.4,'sine',0.08,440); tone(440,0.6,'sine',0.08,660,0.3); },
};
