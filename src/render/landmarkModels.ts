// The seven landmark buildings from Maddy's model, built at full scale.
// Each builder returns a group whose front faces local +z with its footprint centred on the origin.
// Architecture follows the full-scale city reference; identities and signage follow the handmade model.

import * as THREE from 'three';
import { PALETTE } from '../config';
import type { LandmarkId } from '../world/landmarks';
import { box, basic, cyl, gable, gableFront, glassMat, glowMat, plane, sphere, std } from './kit';
import { brickTexture, drawBullseye, facadeTexture, hex, painted, signTexture } from './textures';
import { buildCar, buildFireEngine, buildPoliceCar, buildSchoolBus, flowerBed } from './props';

const F = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function sign(text: string, w: number, h: number, bg: string | undefined, fg: string, x: number, y: number, z: number, px = 1024, border?: string) {
  const t = signTexture(text, { bg, fg, w: px, h: Math.round((px * h) / w), border });
  const m = plane(w, h, basic(0xffffff, { map: t, transparent: !bg }), x, y, z);
  return m;
}

// ------------------------------------------------------------------ Trinity Church
function church(): THREE.Group {
  const grp = new THREE.Group();
  const W = 13;
  const D = 22;
  const wallH = 8.5;
  const roofH = 7.5;
  const cream = std(PALETTE.cream, { rough: 0.85 });
  const roof = std(PALETTE.charcoalRoof, { rough: 0.7 });
  grp.add(box(W, wallH, D, cream, 0, wallH / 2, 0));
  grp.add(gable(W, roofH, D, roof, 0, wallH, 0, 0.6));
  // painted front: tall gable, round window divided in four, dark arched door, small arched windows, lettering
  const front = painted('church-front', 512, 1024, (g, w, h) => {
    g.fillStyle = hex(PALETTE.cream);
    g.fillRect(0, 0, w, h);
    const H = wallH + roofH;
    const yOf = (m: number) => h - (m / H) * h;
    // rose window
    const ry = yOf(wallH + 2.6);
    g.fillStyle = '#ffc865';
    g.beginPath();
    g.arc(w / 2, ry, w * 0.12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#6b5a45';
    g.lineWidth = 8;
    g.stroke();
    g.beginPath();
    g.moveTo(w / 2 - w * 0.12, ry);
    g.lineTo(w / 2 + w * 0.12, ry);
    g.moveTo(w / 2, ry - w * 0.12);
    g.lineTo(w / 2, ry + w * 0.12);
    g.stroke();
    // lettering under the gable
    g.fillStyle = '#5a3a28';
    g.textAlign = 'center';
    g.font = `900 ${w * 0.085}px ${F}`;
    g.fillText('TRINITY CHURCH', w / 2, yOf(wallH - 0.3));
    // arched door (warm light inside, dark frame)
    const dw = w * 0.2;
    const dTop = yOf(4.4);
    const dBot = yOf(0);
    g.fillStyle = '#3b2a20';
    archPath(g, w / 2, dTop - 6, dw + 14, dBot - dTop + 6);
    g.fill();
    g.fillStyle = '#ffb755';
    archPath(g, w / 2, dTop, dw, dBot - dTop);
    g.fill();
    g.fillStyle = '#4a3326';
    g.fillRect(w / 2 - 3, dTop + dw / 2, 6, dBot - dTop);
    // small arched windows either side
    for (const sx of [-1, 1]) {
      g.fillStyle = '#3b2a20';
      archPath(g, w / 2 + sx * w * 0.3, yOf(6.4) - 4, w * 0.1 + 8, yOf(3) - yOf(6.4) + 8);
      g.fill();
      g.fillStyle = '#ffc865';
      archPath(g, w / 2 + sx * w * 0.3, yOf(6.4), w * 0.1, yOf(3) - yOf(6.4));
      g.fill();
    }
  });
  const fm = gableFront(W, wallH, roofH, std(0xffffff, { map: front, rough: 0.85 }));
  fm.position.z = D / 2 + 0.02;
  grp.add(fm);
  // tall warmly lit arched side windows
  const sideWin = painted('church-side', 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4a3326';
    archPath(g, w / 2, 0, w, h);
    g.fill();
    g.fillStyle = '#ffbf5e';
    archPath(g, w / 2, 8, w - 16, h - 12);
    g.fill();
    g.fillStyle = 'rgba(120,60,20,0.5)';
    g.fillRect(w / 2 - 2, 20, 4, h);
  });
  const swm = basic(0xffffff, { map: sideWin, transparent: true });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const p = plane(1.6, 4.2, swm, sx * (W / 2 + 0.03), 4.2, -D / 2 + 4 + i * 4.6);
      p.rotation.y = (sx * Math.PI) / 2;
      grp.add(p);
    }
  }
  // cross at the roof peak
  const gold = std(0xf4ecd8, { rough: 0.4, metal: 0.3, emissive: 0x403520, ei: 0.4 });
  grp.add(box(0.35, 2.4, 0.35, gold, 0, wallH + roofH + 1.1, D / 2 - 0.2));
  grp.add(box(1.4, 0.35, 0.35, gold, 0, wallH + roofH + 1.5, D / 2 - 0.2));
  // steps and garden path
  const stone = std(0xd9cdb8);
  grp.add(box(5, 0.25, 1.4, stone, 0, 0.12, D / 2 + 0.9));
  grp.add(box(4, 0.25, 1.0, stone, 0, 0.37, D / 2 + 0.5));
  grp.add(flowerBed(3.6, 1.2, 0, -5.5, D / 2 + 1.5));
  grp.add(flowerBed(3.6, 1.2, 1, 5.5, D / 2 + 1.5));
  return grp;
}

function archPath(g: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number) {
  const r = w / 2;
  g.beginPath();
  g.moveTo(cx - r, top + h);
  g.lineTo(cx - r, top + r);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(cx + r, top + h);
  g.closePath();
}

// ------------------------------------------------------------------ Kingdom School
function school(): THREE.Group {
  const grp = new THREE.Group();
  const brick = brickTexture('#8a5634', '#c9a483');
  brick.repeat.set(4, 1.5);
  const wallMat = std(0xffffff, { map: brick, rough: 0.9 });
  const roof = std(PALETTE.charcoalRoof, { rough: 0.7 });
  const W = 34;
  const D = 15;
  const H = 8;
  const win = facadeTexture('school-wing', '#8a5634', 4, 2, { frame: '#f3e7d2', brick: true });
  const winMat = std(0xffffff, { map: win, rough: 0.9 });
  const wingMats = [wallMat, wallMat, roof, wallMat, winMat, wallMat];
  // wings
  for (const sx of [-1, 1]) {
    const wing = box(11, H, D, wingMats, sx * 11.5, H / 2, 0);
    grp.add(wing);
    grp.add(gable(D, 2.6, 11, roof, sx * 11.5, H, 0, 0.3).rotateY(Math.PI / 2));
  }
  // central gable block — steep triangular front gable with sign
  const cW = 12;
  const cH = 9;
  const cRoof = 7;
  grp.add(box(cW, cH, D + 1.6, wallMat, 0, cH / 2, 0.8));
  grp.add(gable(cW, cRoof, D + 1.6, roof, 0, cH, 0.8, 0.5));
  const front = painted('school-front', 512, 768, (g, w, h) => {
    g.fillStyle = '#8a5634';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,30,15,0.35)';
    g.lineWidth = 2;
    for (let y = 0; y < h; y += 12) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    const T = cH + cRoof;
    const yOf = (m: number) => h - (m / T) * h;
    // sign board
    g.fillStyle = '#f6efe0';
    g.fillRect(w * 0.08, yOf(cH + 0.2), w * 0.84, yOf(cH - 1.6) - yOf(cH + 0.2));
    g.fillStyle = '#5b2f17';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${w * 0.083}px ${F}`;
    g.fillText('KINGDOM SCHOOL', w / 2, (yOf(cH + 0.2) + yOf(cH - 1.6)) / 2 + 2);
    // gable round window
    g.fillStyle = '#ffd27a';
    g.beginPath();
    g.arc(w / 2, yOf(cH + 2.6), w * 0.07, 0, Math.PI * 2);
    g.fill();
    // big windows
    for (const r of [0, 1]) {
      for (const c of [-1, 1]) {
        const x = w / 2 + c * w * 0.26;
        const y = yOf(2.3 + r * 3.3 + 2.2);
        g.fillStyle = '#f3e7d2';
        g.fillRect(x - w * 0.13 - 5, y - 5, w * 0.26 + 10, (2.2 / T) * h + 10);
        g.fillStyle = '#ffc865';
        g.fillRect(x - w * 0.13, y, w * 0.26, (2.2 / T) * h);
        g.fillStyle = 'rgba(110,60,20,0.5)';
        g.fillRect(x - 2, y, 4, (2.2 / T) * h);
      }
    }
    // doors
    g.fillStyle = '#f3e7d2';
    g.fillRect(w / 2 - w * 0.12 - 6, yOf(3.2) - 6, w * 0.24 + 12, (3.2 / T) * h + 6);
    g.fillStyle = '#ffb755';
    g.fillRect(w / 2 - w * 0.12, yOf(3.2), w * 0.24, (3.2 / T) * h);
    g.fillStyle = '#7a4a2a';
    g.fillRect(w / 2 - 3, yOf(3.2), 6, (3.2 / T) * h);
  });
  const fm = gableFront(cW, cH, cRoof, std(0xffffff, { map: front, rough: 0.9 }));
  fm.position.z = D / 2 + 1.6 + 0.03;
  grp.add(fm);
  // steps
  grp.add(box(6, 0.3, 1.6, std(0xd9cdb8), 0, 0.15, D / 2 + 2.4));
  // school bus parked on the apron (outside the running course)
  const bus = buildSchoolBus();
  bus.position.set(-W / 2 + 3, 0, D / 2 + 4.6);
  bus.rotation.y = Math.PI / 2;
  grp.add(bus);
  // playground at the right
  grp.add(playground(W / 2 + 7, 0));
  // school-zone sign
  const zone = sign('SCHOOL ZONE', 2.4, 1.2, '#f8d830', '#222', W / 2 - 2, 2.6, D / 2 + 6.4, 512, '#222');
  grp.add(zone);
  grp.add(cyl(0.06, 0.06, 2.2, std(0x777777), W / 2 - 2, 1.1, D / 2 + 6.35, 6));
  return grp;
}

function playground(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat = std(0xd0b78a, { rough: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 24), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.03;
  ground.receiveShadow = true;
  g.add(ground);
  const red = std(0xe2483d);
  const blue = std(0x3d8fe2);
  const yellow = std(0xf2c230);
  // climbing tower + slide
  for (const [px, pz] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [-1.2, 1.2],
    [1.2, 1.2],
  ]) g.add(cyl(0.1, 0.1, 3, blue, px, 1.5, pz, 8));
  g.add(box(2.6, 0.2, 2.6, yellow, 0, 2, 0));
  g.add(gable(2.6, 1.2, 2.6, red, 0, 3, 0, 0.1));
  const slide = box(0.9, 0.12, 3.6, yellow, 0, 1.0, 2.9);
  slide.rotation.x = 0.55;
  g.add(slide);
  // swings
  g.add(box(4.2, 0.15, 0.15, red, -3.5, 2.6, -3));
  for (const sx of [-1, 1]) {
    const leg = box(0.12, 2.8, 0.12, red, -3.5 + sx * 2.05, 1.3, -3);
    g.add(leg);
  }
  for (const sx of [-0.9, 0.9]) g.add(box(0.6, 0.08, 0.3, blue, -3.5 + sx, 0.7, -3));
  return g;
}

// ------------------------------------------------------------------ Super Target
function store(): THREE.Group {
  const grp = new THREE.Group();
  const W = 46;
  const D = 26;
  const H = 8;
  const wall = std(PALETTE.lightBrick, { rough: 0.9 });
  const roofMat = std(0xb9b0a3, { rough: 0.95 });
  const side = facadeTexture('store-side', '#e6d6b8', 6, 2, { frame: '#d8c7a6' });
  const sideMat = std(0xffffff, { map: side, rough: 0.9 });
  grp.add(box(W, H, D, [sideMat, sideMat, roofMat, wall, wall, wall], 0, H / 2, 0));
  // raised central facade with bullseye and lettering
  const fW = 20;
  const fH = 12.5;
  const facade = painted('store-facade', 1024, 640, (g, w, h) => {
    g.fillStyle = '#f2e8d4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e6d8bd';
    g.fillRect(0, h * 0.9, w, h * 0.1);
    drawBullseye(g, w / 2, h * 0.3, h * 0.2);
    g.fillStyle = '#cc1a24';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${h * 0.14}px ${F}`;
    g.fillText('SUPER TARGET', w / 2, h * 0.63);
  });
  grp.add(box(fW, fH, 1.2, wall, 0, fH / 2, D / 2 + 0.6));
  grp.add(plane(fW, fH - H + 6, std(0xffffff, { map: facade, rough: 0.8 }), 0, H - 6 + (fH - H + 6) / 2, D / 2 + 1.22));
  // glass storefront with red awnings
  const glass = glassMat();
  grp.add(box(14, 3.6, 0.2, glass, 0, 1.8, D / 2 + 1.25, false));
  for (const sx of [-1, 1]) {
    grp.add(box(10, 3.2, 0.2, glass, sx * 16, 1.9, D / 2 + 0.12, false));
    const aw = box(11, 0.25, 2.2, std(PALETTE.targetRed, { rough: 0.6 }), sx * 16, 3.9, D / 2 + 1.0);
    aw.rotation.x = 0.28;
    grp.add(aw);
  }
  const aw = box(15, 0.25, 2.4, std(PALETTE.targetRed, { rough: 0.6 }), 0, 4.2, D / 2 + 2.2);
  aw.rotation.x = 0.28;
  grp.add(aw);
  // grid of rectangular windows on the upper front wings
  const grid = facadeTexture('store-grid', '#efe3cb', 5, 1, { frame: '#d8c7a6' });
  for (const sx of [-1, 1]) grp.add(plane(12, 2.6, std(0xffffff, { map: grid, rough: 0.9 }), sx * 16, 6.2, D / 2 + 0.03));
  // red bullseye bollards, cart corral, parcels on the plaza
  const red = std(PALETTE.targetRed, { rough: 0.5 });
  for (let i = -3; i <= 3; i++) grp.add(sphere(0.45, red, i * 2.4, 0.45, D / 2 + 4.2, 12, 8));
  grp.add(box(4, 1, 1.8, std(0xd9d9d9, { metal: 0.6, rough: 0.4 }), 14, 0.5, D / 2 + 5));
  // parking lot
  const lot = painted('parking', 512, 256, (g, w, h) => {
    g.fillStyle = '#5c5e63';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#efeee6';
    for (let x = 0; x <= w; x += w / 12) {
      g.fillRect(x, 0, 4, h * 0.35);
      g.fillRect(x, h * 0.65, 4, h * 0.35);
    }
  });
  const lotMesh = plane(W + 8, 14, std(0xffffff, { map: lot, rough: 0.95 }), 0, 0.03, D / 2 + 12);
  lotMesh.rotation.x = -Math.PI / 2;
  lotMesh.receiveShadow = true;
  grp.add(lotMesh);
  const carColors = [0x3a6ea5, 0xe8e4da, 0x9c2f2f, 0x4b7f52, 0x2b2b2e, 0xd9a441];
  for (let i = 0; i < 7; i++) {
    if (i === 3) continue;
    const car = buildCar(carColors[i % carColors.length]);
    car.position.set(-22 + i * 7.3 + (i % 2) * 1.5, 0, D / 2 + 8.3 + (i % 3 === 0 ? 7 : 0));
    car.rotation.y = i % 3 === 0 ? 0 : Math.PI;
    grp.add(car);
  }
  return grp;
}

// ------------------------------------------------------------------ Hospital
function hospital(): THREE.Group {
  const grp = new THREE.Group();
  const W = 28;
  const D = 16;
  const H = 7;
  const white = std(0xf7f6f1, { rough: 0.7 });
  const fascia = std(PALETTE.hospitalTurquoise, { rough: 0.5 });
  const roof = std(0xc9c7c0, { rough: 0.95 });
  const winTex = facadeTexture('hospital', '#f7f6f1', 6, 2, { frame: '#1f8fd0', glow: '#fff3d6' });
  const winMat = std(0xffffff, { map: winTex, rough: 0.7 });
  grp.add(box(W, H, D, [winMat, winMat, roof, white, winMat, white], 0, H / 2, 0));
  // bright turquoise/blue upper fascia with lettering
  grp.add(box(W + 0.4, 1.6, D + 0.4, fascia, 0, H + 0.4, 0));
  grp.add(sign('HOSPITAL', 11, 1.3, undefined, '#ffffff', 2.5, H + 0.4, D / 2 + 0.22, 1024));
  // blue cross
  const blue = std(PALETTE.hospitalBlue, { rough: 0.4, emissive: 0x0b4f7a, ei: 0.5 });
  const crossX = -6.2;
  const cross = new THREE.Group();
  cross.add(box(0.5, 1.4, 0.2, std(0xffffff), 0, 0, 0));
  cross.add(box(1.4, 0.5, 0.2, std(0xffffff), 0, 0, 0));
  cross.add(box(0.4, 1.2, 0.25, blue, 0, 0, 0.02));
  cross.add(box(1.2, 0.4, 0.25, blue, 0, 0, 0.02));
  cross.position.set(crossX, H + 0.4, D / 2 + 0.25);
  grp.add(cross);
  // blue-framed glass entrance with a canopy (public welcome area)
  const frame = std(PALETTE.hospitalBlue, { rough: 0.4 });
  grp.add(box(7, 4, 0.3, glassMat(), 0, 2, D / 2 + 0.1, false));
  for (const sx of [-1, 0, 1]) grp.add(box(0.25, 4, 0.4, frame, sx * 3.5, 2, D / 2 + 0.15));
  grp.add(box(7.4, 0.3, 0.4, frame, 0, 4.1, D / 2 + 0.15));
  grp.add(box(9, 0.35, 3.4, white, 0, 4.4, D / 2 + 1.7));
  for (const sx of [-1, 1]) grp.add(cyl(0.12, 0.12, 4.3, frame, sx * 4.2, 2.15, D / 2 + 3.2, 8));
  grp.add(sign('WELCOME', 3, 0.6, '#1f8fd0', '#ffffff', 0, 4.4, D / 2 + 3.42, 512));
  grp.add(flowerBed(5, 1.2, 2, -8, D / 2 + 1.4));
  grp.add(flowerBed(5, 1.2, 0, 9, D / 2 + 1.4));
  return grp;
}

// ------------------------------------------------------------------ Emergency station
function emergency(): THREE.Group {
  const grp = new THREE.Group();
  const W = 26;
  const D = 14;
  const H = 7;
  const masonry = std(PALETTE.emergencyGray, { rough: 0.9 });
  const sideTex = facadeTexture('emergency-side', '#bdb9b0', 4, 2, { frame: '#d2342b' });
  const sideMat = std(0xffffff, { map: sideTex, rough: 0.9 });
  grp.add(box(W, H, D, [sideMat, sideMat, std(0x9d9a93), masonry, masonry, masonry], 0, H / 2, 0));
  const red = std(PALETTE.emergencyRed, { rough: 0.55 });
  // red trim band
  grp.add(box(W + 0.3, 0.5, D + 0.3, red, 0, H - 0.25, 0));
  // three fire bays with red double doors on the left, police office on the right
  const doorTex = painted('bay-door', 256, 256, (g, w, h) => {
    g.fillStyle = hex(PALETTE.emergencyRed);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 5;
    for (let y = h / 6; y < h; y += h / 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#ffe0a8';
    for (let i = 0; i < 4; i++) g.fillRect(16 + i * 58, h * 0.22, 46, h * 0.12);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(w / 2 - 3, 0, 6, h);
  });
  const doorMat = std(0xffffff, { map: doorTex, rough: 0.6 });
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 3.4 + i * 4.8;
    grp.add(box(4.0, 4.4, 0.25, doorMat, x, 2.2, D / 2 + 0.05));
    grp.add(box(4.4, 0.3, 0.4, red, x, 4.5, D / 2 + 0.12));
  }
  grp.add(sign('FD 118', 4.2, 1.0, '#ffffff', '#d2342b', -W / 2 + 8.2, 5.4, D / 2 + 0.14, 512, '#d2342b'));
  // police side
  grp.add(box(2.2, 3.2, 0.25, std(0x2f4a7a), 7.5, 1.6, D / 2 + 0.05));
  grp.add(box(3.8, 2, 0.2, glassMat(), 11, 2.4, D / 2 + 0.05, false));
  grp.add(sign('PD 67', 3.6, 1.0, '#ffffff', '#2f4a7a', 9.4, 4.6, D / 2 + 0.14, 512, '#2f4a7a'));
  // main sign
  grp.add(sign('EMERGENCY 911', 12, 1.5, '#ffffff', '#d2342b', 1.0, H + 1.0, D / 2 + 0.2, 1024, '#d2342b'));
  grp.add(box(12.4, 1.8, 0.3, masonry, 1.0, H + 1.0, D / 2 + 0.02));
  // friendly vehicles parked on the apron (outside the running course)
  const engine = buildFireEngine();
  engine.position.set(-W / 2 + 3.4, 0, D / 2 + 3.2);
  grp.add(engine);
  const police = buildPoliceCar();
  police.position.set(10.5, 0, D / 2 + 3);
  police.rotation.y = Math.PI / 2;
  grp.add(police);
  return grp;
}

// ------------------------------------------------------------------ Neighborhood houses
function house(variant: 'turquoise' | 'pink'): THREE.Group {
  const grp = new THREE.Group();
  const W = 7;
  const D = 10;
  const H = 6.4;
  const roofH = 4.2;
  const face = variant === 'turquoise' ? PALETTE.turquoise : PALETTE.magenta;
  const trimA = variant === 'turquoise' ? '#ff8fc7' : '#9bd63a';
  const trimB = variant === 'turquoise' ? '#9bd63a' : '#8c5bd6';
  const wall = std(face, { rough: 0.85 });
  const roof = std(PALETTE.charcoalRoof, { rough: 0.7 });
  const sideTex = facadeTexture(`house-side-${variant}`, hex(face), 2, 2, { frame: trimA });
  const sideMat = std(0xffffff, { map: sideTex, rough: 0.85 });
  grp.add(box(W, H, D, [sideMat, sideMat, roof, wall, wall, wall], 0, H / 2, 0));
  grp.add(gable(W, roofH, D, roof, 0, H, 0, 0.5));
  const front = painted(`house-front-${variant}`, 512, 768, (g, w, h) => {
    g.fillStyle = hex(face);
    g.fillRect(0, 0, w, h);
    // clapboard lines
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    g.lineWidth = 3;
    for (let y = 0; y < h; y += 18) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    const T = H + roofH;
    const yOf = (m: number) => h - (m / T) * h;
    // attic gable window
    g.fillStyle = trimB;
    g.beginPath();
    g.arc(w / 2, yOf(H + 1.5), w * 0.11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd27a';
    g.beginPath();
    g.arc(w / 2, yOf(H + 1.5), w * 0.08, 0, Math.PI * 2);
    g.fill();
    // upstairs windows
    for (const c of [-1, 1]) {
      const x = w / 2 + c * w * 0.22;
      g.fillStyle = trimA;
      g.fillRect(x - w * 0.12, yOf(5.7), w * 0.24, yOf(3.7) - yOf(5.7));
      g.fillStyle = '#ffd27a';
      g.fillRect(x - w * 0.09, yOf(5.5), w * 0.18, yOf(3.9) - yOf(5.5));
      g.fillStyle = trimA;
      g.fillRect(x - 3, yOf(5.5), 6, yOf(3.9) - yOf(5.5));
    }
    // ground-floor window and glowing door
    g.fillStyle = trimB;
    g.fillRect(w * 0.08, yOf(2.8), w * 0.32, yOf(1.0) - yOf(2.8));
    g.fillStyle = '#ffd27a';
    g.fillRect(w * 0.11, yOf(2.6), w * 0.26, yOf(1.2) - yOf(2.6));
    g.fillStyle = trimA;
    g.fillRect(w * 0.56, yOf(3.0), w * 0.3, yOf(0) - yOf(3.0));
    g.fillStyle = variant === 'turquoise' ? '#1aa39a' : '#b0256f';
    g.fillRect(w * 0.6, yOf(2.8), w * 0.22, yOf(0) - yOf(2.8));
    g.fillStyle = '#ffd27a';
    g.fillRect(w * 0.64, yOf(2.6), w * 0.14, (yOf(1.6) - yOf(2.6)));
    g.fillStyle = '#f2d16b';
    g.beginPath();
    g.arc(w * 0.78, yOf(1.3), 6, 0, Math.PI * 2);
    g.fill();
  });
  const fm = gableFront(W, H, roofH, std(0xffffff, { map: front, rough: 0.85 }));
  fm.position.z = D / 2 + 0.02;
  grp.add(fm);
  // attic dormer
  grp.add(box(1.8, 1.4, 2, wall, 0, H + 1.4, 1));
  grp.add(gable(1.8, 0.9, 2, roof, 0, H + 2.1, 1, 0.15));
  // short front steps
  const step = std(0xcfc4b2);
  grp.add(box(2.2, 0.22, 0.9, step, 1.45, 0.11, D / 2 + 1.1));
  grp.add(box(2.2, 0.22, 0.6, step, 1.45, 0.33, D / 2 + 0.75));
  grp.add(box(2.2, 0.22, 0.35, step, 1.45, 0.55, D / 2 + 0.4));
  // porch lamp
  grp.add(sphere(0.18, glowMat(), 2.9, 2.6, D / 2 + 0.25, 8, 6));
  grp.add(flowerBed(2.8, 0.9, variant === 'turquoise' ? 3 : 1, -1.8, D / 2 + 0.8));
  return grp;
}

export function buildLandmark(id: LandmarkId): THREE.Group {
  let g: THREE.Group;
  switch (id) {
    case 'church':
      g = church();
      break;
    case 'school':
      g = school();
      break;
    case 'store':
      g = store();
      break;
    case 'hospital':
      g = hospital();
      break;
    case 'emergency':
      g = emergency();
      break;
    case 'house_turquoise':
      g = house('turquoise');
      break;
    case 'house_pink':
      g = house('pink');
      break;
  }
  g.name = `landmark:${id}`;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.receiveShadow = true;
  });
  return g;
}
