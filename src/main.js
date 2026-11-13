import * as THREE from 'three';
import { TYPES, REELS, ENDINGS, isFinish } from './story.js';

/* =====================================================================
   DIRECTOR'S CUT — prototype
   You are in Reel 1. Zoom out, grab loose reels, splice them onto the
   glowing gate at the end of your reel. The first/last "frame" of each
   reel must match (open door -> open door, etc.) or it's a continuity error.
   ===================================================================== */

// ---------- tuning ----------
const W = 26;              // reel length (x)
const H = 14;              // walkable height (z)
const B = 2.2;             // film border (sprocket strip) thickness
const D = H + 2 * B;       // full reel depth
const SNAP_R = 9;          // how close a reel's left edge must be to the gate to splice
const PLAYER_R = 0.55;
const PLAYER_SPEED = 7.5;
const ZOOM_NEAR = 38, ZOOM_FAR = 155;
const TALK_R = 3.2;        // how close you must be to an NPC to talk
const WORLD_CENTER = new THREE.Vector3(56, 0, 0); // centre of the finished chain (for zoomed-out view)

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1000);

scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a1c, 1.6));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);


// ---------- helpers ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
function box(w, h, d, color, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.castShadow = m.receiveShadow = true; return m;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (k, dt) => 1 - Math.exp(-k * dt);

// ---------- the big wooden table everything lies on ----------
const TABLE_W = 250, TABLE_D = 140;
function makeWoodTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * TABLE_D / TABLE_W);
  const g = c.getContext('2d');
  const planks = 7, ph = c.height / planks;
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    g.fillStyle = `hsl(${rnd(27, 33)}, ${rnd(38, 48)}%, ${rnd(52, 60)}%)`;
    g.fillRect(0, y0, c.width, ph);
    for (let k = 0; k < 170; k++) {                       // wavy grain streaks
      const y = y0 + rnd(2, ph - 2), amp = rnd(1, 5), fr = rnd(0.002, 0.006), ph0 = rnd(0, 6);
      g.strokeStyle = `rgba(${rnd(50, 90)},${rnd(25, 45)},10,${rnd(0.04, 0.16)})`;
      g.lineWidth = rnd(0.6, 2.6); g.beginPath();
      for (let x = 0; x <= c.width; x += 48) { const yy = y + Math.sin(x * fr + ph0) * amp; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {                         // knots
      if (Math.random() < 0.6) continue;
      const kx = rnd(100, c.width - 100), ky = y0 + rnd(ph * 0.25, ph * 0.75);
      for (let r = 5; r > 0; r--) { g.strokeStyle = `rgba(70,35,12,${0.12 + r * 0.04})`; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, r * 9, r * 3.5, 0, 0, 7); g.stroke(); }
    }
    g.fillStyle = 'rgba(35,18,6,.7)'; g.fillRect(0, y0, c.width, 3);   // plank seam
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
  return tex;
}
{
  const cx = WORLD_CENTER.x;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W, TABLE_D).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.62 }));
  top.position.set(cx, -0.49, 0); top.receiveShadow = true; scene.add(top);
  const edge = box(TABLE_W, 3, TABLE_D, 0x7a4f2c, { roughness: 0.7 });
  edge.position.set(cx, -2, 0); scene.add(edge);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), mat(0x2a2018, { roughness: 1 }));
  floor.position.y = -16; floor.receiveShadow = true; scene.add(floor);

  // --- props lying on the table ---
  const place = (obj, x, z, rot = 0) => { obj.position.set(x, -0.5, z); obj.rotation.y = rot; scene.add(obj); return obj; };
  const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

  // old film camera (like the one in the concept photo)
  const cam = new THREE.Group();
  const bodyM = box(14, 9, 8, 0x1c1e22, { roughness: 0.5 }); bodyM.position.y = 4.5; cam.add(bodyM);
  const topPlate = box(9, 1.2, 6.5, 0x2a2d33, { metalness: 0.5, roughness: 0.4 }); topPlate.position.set(-1, 9.6, 0); cam.add(topPlate);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 3.5, 24), mat(0x0d0d10, { metalness: 0.7, roughness: 0.3 }));
  lens.rotation.x = Math.PI / 2; lens.position.set(-2, 4.8, 5.6); cam.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), mat(0x3b6d8c, { metalness: 0.9, roughness: 0.05 }));
  glass.position.set(-2, 4.8, 7.4); cam.add(glass);
  const lab = document.createElement('canvas'); lab.width = 256; lab.height = 128;
  { const g = lab.getContext('2d'); g.fillStyle = '#d8d8d0'; g.font = 'bold 72px Arial'; g.fillText('F 89', 20, 90); }
  const label = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lab), transparent: true }));
  label.rotation.x = -Math.PI / 2; label.position.set(3.5, 10.3, 0); cam.add(label);
  place(shadowed(cam), 154, -46, -0.35);

  // film canisters, a loose reel, a mug
  const canister = (r, h) => {
    const g = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), mat(0xb9bcc2, { metalness: 0.7, roughness: 0.35 })); c1.position.y = h / 2; g.add(c1);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, h * 0.3, 28), mat(0xc8402e)); band.position.y = h / 2; g.add(band);
    return g;
  };
  place(shadowed(canister(4, 1.8)), -48, -56, 0);
  place(shadowed(canister(4, 1.8)), -48, -56, 0.5).position.y += 1.8;
  place(shadowed(canister(3.4, 1.6)), 150, 52, 0);
  place(shadowed(canister(3.4, 1.6)), 150, 52, 0.7).position.y += 1.6;
  const spool = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.5, 8, 30), mat(0x2a2d33, { metalness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; spool.add(ring);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1, 16), mat(0x2a2d33, { metalness: 0.6 })); hub.position.y = 0.5; spool.add(hub);
  const rolled = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.7, 30), mat(0x2b1d12)); rolled.position.y = 0.4; spool.add(rolled);
  place(shadowed(spool), -52, 50, 0.4);
  const mug = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2, 3.6, 20), mat(0xe9e4d4, { roughness: 0.4 })); cup.position.y = 1.8; mug.add(cup);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.3, 8, 16), mat(0xe9e4d4)); handle.position.set(2.5, 1.9, 0); mug.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), mat(0x2b1a10)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 3.45; mug.add(coffee);
  place(shadowed(mug), 22, 60, 0.5);
}

// ---------- reel top texture (film strip + floor + start/end badges) ----------
function paintReel(def, index) {
  const s = 56; // px per world unit
  const c = document.createElement('canvas');
  c.width = W * s; c.height = D * s;
  const g = c.getContext('2d');
  const emojiFont = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  // film base
  g.fillStyle = '#16110c'; g.fillRect(0, 0, c.width, c.height);

  // sprocket holes + edge print
  const holes = 16;
  for (let i = 0; i < holes; i++) {
    const x = (i + 0.5) * (c.width / holes) - 0.35 * s;
    for (const y of [0.3 * s, c.height - 1.2 * s]) {
      g.fillStyle = '#050507'; g.beginPath(); g.roundRect(x, y, 0.7 * s, 0.9 * s, 0.15 * s); g.fill();
    }
  }
  g.fillStyle = '#b8782a'; g.font = `${0.38 * s}px "Courier New", monospace`; g.textAlign = 'left';
  const stamp = `▸ DIRECTOR'S CUT  ${String(index + 1).padStart(2, '0')}A  ▸  `;
  g.fillText(stamp.repeat(4), 0.4 * s, 1.85 * s);
  g.fillText(stamp.repeat(4), 0.4 * s, c.height - 1.5 * s);

  // floor
  const iy = B * s, ih = H * s;
  g.fillStyle = def.floor; g.fillRect(0, iy, c.width, ih);
  g.fillStyle = def.alt;
  if (def.pattern === 'checker') {
    const t = 2 * s;
    for (let x = 0; x < c.width; x += t) for (let y = 0; y < ih; y += t)
      if (((x / t) + (y / t)) % 2 === 0) g.fillRect(x, iy + y, t, t);
  } else if (def.pattern === 'planks') {
    const t = 1.3 * s;
    for (let x = 0, k = 0; x < c.width; x += t, k++) {
      if (k % 2) g.fillRect(x, iy, t, ih);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, iy, 3, ih); g.fillStyle = def.alt;
    }
  } else if (def.pattern === 'road') {
    g.fillStyle = '#e8e2c4';
    for (let x = 0.5 * s; x < c.width; x += 3 * s) g.fillRect(x, iy + ih / 2 - 0.12 * s, 1.6 * s, 0.24 * s);
    g.fillStyle = 'rgba(255,255,255,.08)'; // wet-asphalt sheen
    for (let k = 0; k < 14; k++) g.fillRect(Math.random() * c.width, iy + Math.random() * ih, 3 * s, 0.4 * s);
  } else if (def.pattern === 'carpet') {
    g.fillRect(0, iy + ih / 2 - 3.2 * s, c.width, 6.4 * s);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 0.12 * s;
    g.strokeRect(0, iy + ih / 2 - 3.2 * s, c.width, 6.4 * s);
  }
  // frame line in the middle + frame edges
  g.fillStyle = '#0a0a0c'; g.fillRect(c.width / 2 - 0.12 * s, iy, 0.24 * s, ih);
  g.fillRect(0, iy, 0.15 * s, ih); g.fillRect(c.width - 0.15 * s, iy, 0.15 * s, ih);

  // big reel number + name
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.10)';
  g.font = `bold ${8 * s}px "Courier New", monospace`;
  g.fillText(String(index + 1), c.width / 2, iy + ih / 2 + 2.8 * s);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `bold ${0.8 * s}px "Courier New", monospace`;
  g.fillText(`REEL ${index + 1} · ${def.name}`, c.width / 2, iy + 1.3 * s);

  // badges
  const badge = (cx, type, caption) => {
    const t = TYPES[type], cy = c.height / 2, r = 2.1 * s;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(cx, cy + 0.15 * s, r + 0.2 * s, 0, 7); g.fill();
    g.fillStyle = t.color; g.globalAlpha = 0.92; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.globalAlpha = 1;
    g.lineWidth = 0.14 * s; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#000'; g.font = `${2.0 * s}px ${emojiFont}`; g.textBaseline = 'middle';
    g.fillText(t.icon, cx, cy + 0.1 * s);
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round'; g.strokeStyle = '#000'; g.lineWidth = 0.22 * s; g.fillStyle = '#fff';
    g.font = `bold ${0.78 * s}px "Courier New", monospace`;
    g.strokeText(t.label, cx, cy + r + 0.95 * s); g.fillText(t.label, cx, cy + r + 0.95 * s);
    g.font = `bold ${0.55 * s}px "Courier New", monospace`;
    g.strokeText(caption, cx, cy - r - 0.4 * s); g.fillText(caption, cx, cy - r - 0.4 * s);
  };
  badge(6.6 * s, def.start, 'STARTS WITH');
  badge(c.width - 6.6 * s, def.end, 'ENDS WITH');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// ---------- edge decorations (3D props at a reel's start/end) ----------
// side = -1 for the start edge (left), +1 for the end edge (right). Group origin is on the edge.
function makeEdgeDeco(type, side) {
  const g = new THREE.Group();
  g.position.set(side * W / 2, 0, 0);
  const inward = -side;
  switch (type) {
    case 'START': {
      const wall = box(0.6, 2.4, H, 0x1d1d24); wall.position.set(-side * 0.3, 1.2, 0); g.add(wall);
      const stripe = box(0.64, 0.3, H, 0xe9e4d4); stripe.position.set(-side * 0.3, 2.3, 0); g.add(stripe);
      const body = box(0.25, 1.1, 2.2, 0x111111); body.position.set(inward * 1.2, 0.55, 0); g.add(body);
      const clap = box(0.25, 0.3, 2.2, 0xffffff); clap.position.set(inward * 1.2, 1.3, 0); clap.rotation.z = inward * 0.35; g.add(clap);
      break;
    }
    case 'DOOR': {
      const wood = 0x8a5a2b;
      for (const z of [-2.1, 2.1]) { const p = box(0.3, 3.6, 0.3, wood); p.position.set(0, 1.8, z); g.add(p); }
      const lintel = box(0.3, 0.35, 4.5, wood); lintel.position.set(0, 3.7, 0); g.add(lintel);
      const pivot = new THREE.Group(); pivot.position.set(0, 0, 2.0); pivot.rotation.y = side * Math.PI / 2 * 0.92;
      const panel = box(0.12, 3.4, 3.7, 0xc27a3a); panel.position.set(0, 1.7, -1.85); pivot.add(panel);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), mat(0xffd36e, { metalness: 0.8 }));
      knob.position.set(0.12, 1.6, -3.3); pivot.add(knob);
      g.add(pivot);
      break;
    }
    case 'STAIRS': {
      for (let j = 0; j < 5; j++) {
        const step = box(0.8, 0.1 * (j + 1), 5.6, 0x9aa7c4);
        step.position.set(inward * (0.4 + (4 - j) * 0.8), 0.05 * (j + 1), 0); g.add(step);
      }
      for (const z of [-2.9, 2.9]) { const r = box(4, 0.12, 0.12, 0x54a0ff); r.position.set(inward * 2.0, 1.0, z); g.add(r); }
      break;
    }
    case 'BRIDGE': {
      for (let j = 0; j < 6; j++) { const p = box(0.7, 0.12, 5.2, 0x9a6b3a); p.position.set(inward * (0.4 + j * 0.8), 0.06, 0); g.add(p); }
      for (const z of [-2.7, 2.7]) {
        const rail = box(4.8, 0.1, 0.1, 0xd9c28f); rail.position.set(inward * 2.4, 1.1, z); g.add(rail);
        for (const j of [0, 2, 4]) { const post = box(0.16, 1.2, 0.16, 0x6b4a26); post.position.set(inward * (0.4 + j * 1.0), 0.6, z); g.add(post); }
      }
      break;
    }
    case 'TUNNEL': {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.6, 10, 24, Math.PI), mat(0x6b5a85));
      arch.rotation.y = Math.PI / 2; arch.castShadow = true; g.add(arch);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.DoubleSide }));
      hole.rotation.y = Math.PI / 2; g.add(hole);
      for (const z of [-3.3, 3.3]) { const b = box(1.2, 1.4, 1.4, 0x5a4a73); b.position.set(0, 0.7, z); g.add(b); }
      break;
    }
    case 'ELEVATOR': {
      const steel = 0x9aa4ad;
      for (const z of [-2.1, 2.1]) { const p = box(0.4, 3.8, 0.4, steel, { metalness: 0.6 }); p.position.set(0, 1.9, z); g.add(p); }
      const lintel = box(0.4, 0.5, 4.6, steel, { metalness: 0.6 }); lintel.position.set(0, 3.9, 0); g.add(lintel);
      const lamp = box(0.2, 0.25, 1.2, 0x7fe3ff, { emissive: 0x7fe3ff, emissiveIntensity: 1.2 }); lamp.position.set(0, 3.9, 0); lamp.position.x += inward * 0.25; g.add(lamp);
      for (const z of [-3.0, 3.0]) { const d = box(0.15, 3.4, 1.8, 0xc9d1d8, { metalness: 0.7, roughness: 0.3 }); d.position.set(0, 1.7, z); g.add(d); } // doors slid open
      const floor = box(3.4, 0.08, 3.8, 0x555d66); floor.position.set(inward * 1.7, 0.04, 0); g.add(floor);
      break;
    }
    case 'ROAD': {
      const asphalt = box(5, 0.05, 6.4, 0x1c1e22); asphalt.position.set(inward * 2.5, 0.03, 0); g.add(asphalt);
      for (let j = 0; j < 2; j++) { const dash = box(1.4, 0.06, 0.22, 0xe8e2c4); dash.position.set(inward * (1.0 + j * 2.4), 0.07, 0); g.add(dash); }
      for (const z of [-3.6, 3.6]) {
        const post = box(0.14, 3.2, 0.14, 0x444444); post.position.set(0, 1.6, z); g.add(post);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
        bulb.position.set(0, 3.3, z); g.add(bulb);
      }
      break;
    }
    default: {
      if (!isFinish(type)) break;
      const col = new THREE.Color(TYPES[type].color);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.35, 10, 28, Math.PI),
        mat(col, { emissive: col, emissiveIntensity: 0.9, metalness: 0.6 }));
      arch.rotation.y = Math.PI / 2; g.add(arch);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 9, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(inward * 1.2, 4.5, 0); g.add(beam);
      const light = new THREE.PointLight(col, 60, 14); light.position.set(inward * 1.5, 2.5, 0); g.add(light);
      break;
    }
  }
  return g;
}

// glowing gate shown at the open end of the current reel
function makeGate(type) {
  const color = new THREE.Color(TYPES[type].color);
  const g = new THREE.Group();
  g.position.set(W / 2, 0, 0);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(H, 3.4).rotateY(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  plane.position.y = 1.7; g.add(plane);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, H), new THREE.MeshBasicMaterial({ color }));
  strip.position.y = 0.06; g.add(strip);
  g.userData.plane = plane;
  return g;
}

// ---------- NPCs ----------
function makeNPC(def) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const extra = def.ghost ? { transparent: true, opacity: 0.55, emissive: def.body, emissiveIntensity: 0.5 } : {};
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), mat(def.body, extra));
  torso.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mat(def.ghost ? 0xdff3ff : 0xf1c9a0, extra));
  head.position.y = 1.72;
  body.add(torso, head);
  const hc = def.hatColor ?? 0x222222;
  switch (def.hat) {
    case 'cap':    { const c = box(0.7, 0.18, 0.7, hc); c.position.y = 2.0; const b = box(0.5, 0.06, 0.4, hc); b.position.set(0, 1.94, 0.45); body.add(c, b); break; }
    case 'tophat': { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 14), mat(hc)); b.position.y = 2.16;
                     const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), mat(hc)); r.position.y = 1.92; body.add(b, r); break; }
    case 'beret':  { const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hc)); b.scale.y = 0.55; b.position.set(0.06, 1.92, 0); body.add(b); break; }
    case 'hardhat':{ const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hc)); b.position.y = 1.9; body.add(b); break; }
  }
  const eyes = box(0.44, 0.08, 0.1, 0x111111); eyes.position.set(0, 1.76, 0.29); body.add(eyes);
  // bobbing "talk to me" marker
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  mark.position.y = 3.0; g.add(mark);
  g.traverse(o => { if (o.isMesh && o !== mark) o.castShadow = !def.ghost; });
  return { def, group: g, body, mark, count: 0, yaw: 0 };
}

// ---------- painted backdrops standing behind each reel (the 2.5D "set") ----------
const BACKDROP_H = 15;
const BACKDROP_KIND = { open: 'studio', hall: 'hall', roof: 'city', chasm: 'canyon', deleted: 'void',
  lobby: 'hall', pent: 'city', boiler: 'pipes', sewer: 'pipes', road: 'city', sky: 'canyon' };

function paintBackdrop(def) {
  const cw = 2048, ch = Math.round(2048 * BACKDROP_H / W);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sky = (top, bottom) => { const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, cw, ch); };
  const hills = (color, base, amp, freq, ph) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, ch);
    for (let x = 0; x <= cw; x += 16) g.lineTo(x, base + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 + ph * 1.7) * amp * 0.4);
    g.lineTo(cw, ch); g.closePath(); g.fill();
  };
  const cloud = (x, y, s) => { g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + i * s * 0.55 - s, y + Math.sin(i * 2) * s * 0.18, s * 0.7, s * 0.4, 0, 0, 7); g.fill(); } };
  const pine = (x, base, h) => { g.fillStyle = '#0f1a14'; for (let i = 0; i < 4; i++) { const w2 = h * (0.34 - i * 0.06), y = base - h * 0.2 - i * h * 0.22; g.beginPath(); g.moveTo(x, y - h * 0.3); g.lineTo(x - w2, y); g.lineTo(x + w2, y); g.fill(); } g.fillRect(x - h * 0.03, base - h * 0.2, h * 0.06, h * 0.2); };

  switch (BACKDROP_KIND[def.id]) {
    case 'canyon': {
      sky('#8fb6e6', '#f6e3c0');
      g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(cw * 0.72, ch * 0.3, 90, 0, 7); g.fill();
      for (let i = 0; i < 5; i++) cloud(rnd(100, cw - 100), rnd(ch * 0.1, ch * 0.4), rnd(70, 130));
      hills('#8a9fb5', ch * 0.62, 38, 0.004, 1); hills('#5f7a72', ch * 0.72, 46, 0.006, 3); hills('#3b5a3c', ch * 0.84, 40, 0.008, 5);
      for (let i = 0; i < 9; i++) pine(rnd(40, cw - 40), ch * 0.9, rnd(150, 260));
      break;
    }
    case 'city': {
      sky('#0a0f22', '#47598a');
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.3, 0.9)})`; g.fillRect(rnd(0, cw), rnd(0, ch * 0.5), 3, 3); }
      g.fillStyle = '#f4f1de'; g.beginPath(); g.arc(cw * 0.2, ch * 0.22, 70, 0, 7); g.fill();
      [['#27304f', 0.5, 0.45], ['#1a2038', 0.65, 0.4], ['#0e1224', 0.8, 0.35]].forEach(([col, base, hmax]) => {
        for (let x = 0; x < cw;) {
          const bw = rnd(90, 190), bh = rnd(0.12, hmax) * ch; g.fillStyle = col; g.fillRect(x, ch * base + (ch * (1 - base)) - bh - ch * (1 - base) * 0.0, bw, bh + 4);
          for (let wy = ch - bh + 20; wy < ch - 20; wy += 38) for (let wx = x + 14; wx < x + bw - 20; wx += 30)
            if (Math.random() < 0.28) { g.fillStyle = 'rgba(255,225,140,.85)'; g.fillRect(wx, wy + (base - 0.5) * 0, 12, 18); }
          x += bw + rnd(0, 14);
        }
      });
      break;
    }
    case 'hall': {
      sky('#3a1c26', '#6a3a40');
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, ch * 0.62, cw, ch * 0.38); // wainscot
      for (let x = 60; x < cw; x += 170) { g.strokeStyle = 'rgba(255,230,190,.28)'; g.lineWidth = 5; g.strokeRect(x, ch * 0.68, 120, ch * 0.26); }
      for (let x = 180; x < cw; x += 420) {
        const gr = g.createLinearGradient(0, ch * 0.1, 0, ch * 0.6); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#ffd98a');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x, ch * 0.6); g.lineTo(x, ch * 0.28); g.arc(x + 55, ch * 0.28, 55, Math.PI, 0); g.lineTo(x + 110, ch * 0.6); g.fill();
        g.fillStyle = '#2a1015'; g.fillRect(x + 52, ch * 0.2, 6, ch * 0.4);
      }
      break;
    }
    case 'pipes': {
      sky('#2a2420', '#4a3a32');
      for (let y = 0; y < ch; y += 34) for (let x = (y / 34) % 2 ? -50 : 0; x < cw; x += 100) { g.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.25)})`; g.fillRect(x + 3, y + 3, 94, 28); }
      [[0.28, 38], [0.46, 54], [0.7, 30]].forEach(([fy, th]) => {
        g.fillStyle = '#6b6f78'; g.fillRect(0, ch * fy, cw, th); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, ch * fy + 6, cw, th * 0.22);
        for (let x = 80; x < cw; x += 300) { g.fillStyle = '#464a52'; g.fillRect(x, ch * fy - 8, 26, th + 16); }
      });
      for (let i = 0; i < 6; i++) { const gr = g.createRadialGradient(rnd(0, cw), ch * 0.3, 10, rnd(0, cw), ch * 0.3, 130); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch); }
      break;
    }
    case 'void': {
      sky('#120a24', '#3a2166');
      for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(230,210,255,${rnd(0.2, 0.9)})`; g.fillRect(rnd(0, cw), rnd(0, ch), 3, 3); }
      for (let i = 0; i < 7; i++) { g.strokeStyle = `rgba(190,150,255,${0.12 + i * 0.03})`; g.lineWidth = 6; g.beginPath(); g.ellipse(cw * 0.5, ch * 0.5, 160 + i * 130, 60 + i * 52, 0, 0, 7); g.stroke(); }
      for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.strokeRect(rnd(60, cw - 200), rnd(40, ch - 160), 110, 78); } // floating frames
      break;
    }
    default: { // studio
      sky('#12151f', '#2c3550');
      for (let x = 160; x < cw; x += 470) {
        const gr = g.createLinearGradient(x, 0, x, ch); gr.addColorStop(0, 'rgba(255,255,230,.5)'); gr.addColorStop(1, 'rgba(255,255,230,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 14, 0); g.lineTo(x + 14, 0); g.lineTo(x + 190, ch * 0.9); g.lineTo(x - 190, ch * 0.9); g.fill();
      }
      for (let x = 120; x < cw; x += 400) { g.fillStyle = '#d9d2b8'; g.fillRect(x, ch * 0.3, 150, 210); g.fillStyle = '#1a1a1f'; g.fillRect(x + 12, ch * 0.3 + 12, 126, 150); }
      g.fillStyle = '#5d1620'; for (let x = 0; x < cw; x += 36) { g.globalAlpha = 0.5 + 0.3 * Math.sin(x); g.fillRect(x, 0, 20, ch * 0.12); } g.globalAlpha = 1; // curtain valance
      break;
    }
  }
  // film frame lines (edges + the middle cut between the two frames of the reel)
  g.fillStyle = '#050505'; g.fillRect(0, 0, 8, ch); g.fillRect(cw - 8, 0, 8, ch); g.fillRect(cw / 2 - 5, 0, 10, ch);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
  return tex;
}

// ---------- reels ----------
const reels = [];
const npcs = [];
const pickables = [];

REELS.forEach((def, i) => {
  const group = new THREE.Group();
  const tex = paintReel(def, i);
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), topMat);
  top.position.y = 0.01; top.receiveShadow = true;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D), mat(0x15110d, { roughness: 0.6 }));
  slab.position.y = -0.25; slab.castShadow = slab.receiveShadow = true;
  group.add(slab, top);

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W, BACKDROP_H),
    new THREE.MeshBasicMaterial({ map: paintBackdrop(def), transparent: true, toneMapped: false }));
  backdrop.position.set(0, BACKDROP_H / 2, -D / 2 + 0.05);
  group.add(backdrop);

  const colliders = [];
  for (const [x, z, w, d, h, color, shape] of def.props) {
    const m = shape === 'cyl'
      ? new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 16), mat(color))
      : new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; group.add(m);
    colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  }

  const startDeco = makeEdgeDeco(def.start, -1);
  const endDeco = makeEdgeDeco(def.end, +1);
  const gate = makeGate(def.end);
  gate.visible = false;
  group.add(startDeco, endDeco, gate);

  let npc = null;
  if (def.npc) {
    npc = makeNPC(def.npc);
    npc.group.position.set(def.npc.x, 0, def.npc.z);
    group.add(npc.group);
    colliders.push({ x: def.npc.x, z: def.npc.z, hw: 0.5, hd: 0.5 });
    npcs.push(npc);
  }

  const [hx, , hz, hr = 0] = def.home;
  group.position.set(hx, 0, hz); group.rotation.y = hr;

  const reel = {
    def, index: i, group, top, slab, backdrop, startDeco, endDeco, gate, colliders,
    state: i === 0 ? 'attached' : 'loose',        // loose | dragging | returning | attached
    slotX: hx,                                    // x position once attached
    target: new THREE.Vector3(hx, 0, hz), targetRot: hr,
    lastLoose: { x: hx, z: hz, rot: hr },
    hover: false, flash: 0, flashColor: new THREE.Color(), bobPhase: Math.random() * 6,
  };
  if (npc) npc.reel = reel;
  top.userData.reel = slab.userData.reel = reel;
  pickables.push(top, slab);
  reels.push(reel);
  scene.add(group);
});

// ---------- game state ----------
const state = {
  chain: [reels[0]],
  dragging: null, dragOffset: new THREE.Vector2(),
  won: false, splices: 0, mistakes: 0, t0: performance.now(),
};
reels[0].gate.visible = true;
const tail = () => state.chain[state.chain.length - 1];
const tailEdge = () => tail().slotX + W / 2;

// ghost shown where a dragged reel would land
const ghost = new THREE.Group();
const ghostFill = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x33ff99, transparent: true, opacity: 0.22, depthWrite: false }));
ghostFill.position.y = 0.06;
const ghostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.5, D)), new THREE.LineBasicMaterial({ color: 0x33ff99 }));
ghost.add(ghostFill, ghostEdge); ghost.visible = false; scene.add(ghost);

// ---------- player ----------
const player = new THREE.Group();
const body = new THREE.Group(); player.add(body);
{
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), mat(0xe8553d));
  torso.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mat(0xf1c9a0));
  head.position.y = 1.72;
  const beret = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x15151a));
  beret.scale.y = 0.55; beret.position.set(0.05, 1.9, 0);
  const shades = box(0.5, 0.1, 0.12, 0x000000); shades.position.set(0, 1.76, 0.28);
  const mega = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12, 1, true), mat(0xf5f0e0, { side: THREE.DoubleSide }));
  mega.rotation.x = Math.PI / 2; mega.position.set(0.5, 1.1, 0.4);
  body.add(torso, head, beret, shades, mega);
  body.traverse(o => { if (o.isMesh) o.castShadow = true; });
}
player.position.set(-6, 0, 0);
scene.add(player);
const vel = new THREE.Vector3();
let yaw = 0;

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') location.reload();
  if (k === ' ') e.preventDefault();
  if (!e.repeat && (k === 'e' || k === ' ' || k === 'enter')) interact();
  if (k === 'escape') closeDialogue();
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

let zoomTarget = 0, zoom = 0;
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomTarget = clamp(zoomTarget + e.deltaY * 0.0009, 0, 1);
}, { passive: false });

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpV = new THREE.Vector3();
function setMouse(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}
function groundPoint() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(mouse, camera);
  return raycaster.ray.intersectPlane(groundPlane, tmpV);
}
function pickReel() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.reel : null;
}
const playerOn = r => player.position.x > r.slotX - W / 2 - 1;
function grabbable(r) {
  if (state.won) return false;
  if (!state.chain.includes(r)) return true;
  return r === tail() && r !== state.chain[0] && !playerOn(r);
}

const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg, cls = '', ms = 1700) {
  toastEl.textContent = msg; toastEl.className = 'hud show ' + cls;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.className = 'hud ' + cls), ms);
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || state.won || state.dialogue) return;
  setMouse(e);
  const r = pickReel();
  if (!r) return;
  if (state.chain.includes(r)) {
    if (r === state.chain[0] || r !== tail()) return toast('Already locked into the cut', '', 1200);
    if (playerOn(r)) return toast("Can't pull a reel while you're in the shot!", 'bad');
    // detach the tail so it can be swapped
    state.chain.pop();
    const t = tail(); t.endDeco.visible = true; t.gate.visible = !isFinish(t.def.end);
    r.gate.visible = false;
    r.lastLoose = findFreeSpot(r);
    updateObjective();
  }
  const g = groundPoint();
  if (!g) return;
  state.dragging = r; r.state = 'dragging';
  state.dragOffset.set(r.group.position.x - g.x, r.group.position.z - g.z);
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture?.(e.pointerId);
});

addEventListener('pointermove', e => {
  setMouse(e);
  if (state.dragging) return;
  const r = pickReel();
  for (const x of reels) x.hover = false;
  if (r && grabbable(r)) { r.hover = true; canvas.style.cursor = 'grab'; } else canvas.style.cursor = 'default';
});
addEventListener('pointerup', () => { if (state.dragging) drop(); });
addEventListener('pointercancel', () => { if (state.dragging) drop(); });

// when a spliced tail is pulled back off, park it somewhere free below the chain
function findFreeSpot(r) {
  const spots = [[r.def.home[0], r.def.home[2]], [r.slotX, 34], [r.slotX, -34]];
  for (const [x, z] of spots) {
    if (!reels.some(o => o !== r && overlaps(o.target.x, o.target.z, x, z))) return { x, z, rot: 0 };
  }
  return { x: r.slotX, z: 34, rot: 0 };
}
const overlaps = (ax, az, bx, bz) => Math.abs(ax - bx) < W - 1 && Math.abs(az - bz) < D - 1;

// ---------- splicing ----------
function dragDistanceToGate(r) {
  const p = r.group.position;
  return Math.hypot(p.x - W / 2 - tailEdge(), p.z);
}

function drop() {
  const r = state.dragging; state.dragging = null; ghost.visible = false;
  canvas.style.cursor = 'default';
  const t = tail();
  if (!isFinish(t.def.end) && dragDistanceToGate(r) < SNAP_R) {
    if (r.def.start === t.def.end) return attach(r);
    state.mistakes++;
    return reject(r, 'CONTINUITY ERROR', `${TYPES[t.def.end].label} ≠ ${TYPES[r.def.start].label}`);
  }
  const p = r.group.position;
  if (reels.some(o => o !== r && overlaps(o.target.x, o.target.z, p.x, p.z))) return reject(r, 'NO ROOM THERE', 'reels cannot overlap', false);
  r.state = 'loose'; r.target.set(p.x, 0, p.z); r.targetRot = 0;
  r.lastLoose = { x: p.x, z: p.z, rot: 0 };
}

function attach(r) {
  const t = tail();
  t.endDeco.visible = false; t.gate.visible = false;
  r.state = 'attached'; r.slotX = t.slotX + W;
  r.target.set(r.slotX, 0, 0); r.targetRot = 0;
  state.chain.push(r); state.splices++;
  r.gate.visible = !isFinish(r.def.end);
  r.flash = 1; r.flashColor.set(0x33ff99);
  shake = 0.5;
  toast('SEAMLESS CUT!', 'good');
  updateObjective();
}

function reject(r, title, sub, countAsError = true) {
  r.state = 'returning';
  r.target.set(r.lastLoose.x, 0, r.lastLoose.z); r.targetRot = r.lastLoose.rot;
  r.flash = 1; r.flashColor.set(0xff2a2a);
  shake = 0.6;
  toast(`${title}\n${sub}`, 'bad', 2200);
  toastEl.style.whiteSpace = 'pre-line';
}

const objText = document.getElementById('objText');
const objSmall = document.querySelector('#objective .small');
function updateObjective() {
  const t = tail();
  if (isFinish(t.def.end)) {
    objSmall.textContent = 'THE CUT IS COMPLETE';
    objText.textContent = `${TYPES[t.def.end].icon} Walk into the ${TYPES[t.def.end].label}`;
  } else {
    objSmall.textContent = 'NEXT SCENE MUST BEGIN WITH';
    objText.textContent = `${TYPES[t.def.end].icon} ${TYPES[t.def.end].label}`;
  }
}
updateObjective();

// ---------- NPC dialogue ----------
state.talked = new Set();
state.dialogue = null;
const dlgEl = document.getElementById('dialog');
const dlgName = document.getElementById('dlgName');
const dlgText = document.getElementById('dlgText');
const promptEl = document.getElementById('prompt');

const storyCtx = npc => ({
  count: npc ? npc.count : 0,
  n: state.chain.length,
  has: id => state.chain.some(r => r.def.id === id),
  talked: id => state.talked.has(id),
});

function playerWorldDist(npc) {
  const dx = player.position.x - (npc.reel.slotX + npc.def.x), dz = player.position.z - npc.def.z;
  return Math.hypot(dx, dz);
}
function nearestNPC() {
  let best = null, bd = TALK_R;
  for (const npc of npcs) {
    if (!state.chain.includes(npc.reel)) continue;
    const d = playerWorldDist(npc);
    if (d < bd) { bd = d; best = npc; }
  }
  return best;
}

function showLine() {
  const d = state.dialogue;
  d.full = d.lines[d.i]; d.shown = 0;
  dlgText.textContent = '';
  document.getElementById('dlgHint').textContent = d.i === d.lines.length - 1 ? '[E] close' : '[E] continue';
}
function openDialogue(npc) {
  const lines = npc.def.lines(storyCtx(npc));
  npc.count++; state.talked.add(npc.def.id);
  state.dialogue = { npc, lines, i: 0, full: '', shown: 0 };
  dlgName.textContent = npc.def.name;
  dlgEl.classList.add('show');
  promptEl.classList.remove('show');
  showLine();
}
function closeDialogue() {
  if (!state.dialogue) return;
  state.dialogue = null; dlgEl.classList.remove('show');
}
function interact() {
  if (state.won) return;
  const d = state.dialogue;
  if (d) {
    if (d.shown < d.full.length) { d.shown = d.full.length; dlgText.textContent = d.full; return; } // finish typing
    if (d.i < d.lines.length - 1) { d.i++; showLine(); } else closeDialogue();
    return;
  }
  const npc = nearestNPC();
  if (npc) openDialogue(npc);
}
function updateDialogue(dt, time) {
  const d = state.dialogue;
  if (d && d.shown < d.full.length) {
    d.shown = Math.min(d.full.length, d.shown + dt * 55);
    dlgText.textContent = d.full.slice(0, Math.floor(d.shown));
  }
  // prompt near an NPC
  const near = !d && !state.won ? nearestNPC() : null;
  promptEl.classList.toggle('show', !!near);
  if (near) promptEl.textContent = `[E] Talk to ${near.def.name.split(',')[0]}`;
  if (d && playerWorldDist(d.npc) > TALK_R + 3) closeDialogue(); // walked/zoomed away

  for (const npc of npcs) {
    npc.mark.position.y = 3.0 + Math.sin(time * 3 + npc.def.x) * 0.15;
    npc.mark.rotation.y = time * 2;
    npc.mark.material.color.set(npc.count > 0 ? 0x8a8f99 : 0xffe066);
    if (npc.def.ghost) npc.body.position.y = 0.25 + Math.sin(time * 1.8) * 0.15;
    // turn to face the player when close
    if (state.chain.includes(npc.reel) && playerWorldDist(npc) < 6) {
      const want = Math.atan2(player.position.x - (npc.reel.slotX + npc.def.x), player.position.z - npc.def.z);
      let diff = want - npc.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      npc.yaw += diff * damp(8, dt); npc.body.rotation.y = npc.yaw;
    }
  }
}

// ---------- player movement + collision ----------
function movePlayer(dt) {
  const p = player.position;
  let ix = 0, iz = 0;
  if (!state.won && !state.dialogue) {
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
  }
  const len = Math.hypot(ix, iz);
  if (len > 0) {
    ix /= len; iz /= len;
    // rotate input so W = "up the screen" whatever the camera yaw is
    const c = Math.cos(camYaw), s = Math.sin(camYaw);
    [ix, iz] = [ix * c - iz * s, ix * s + iz * c];
  }
  vel.x += (ix * PLAYER_SPEED - vel.x) * damp(14, dt);
  vel.z += (iz * PLAYER_SPEED - vel.z) * damp(14, dt);
  p.x += vel.x * dt; p.z += vel.z * dt;

  // props of every reel that is part of the cut
  for (let pass = 0; pass < 2; pass++) {
    for (const r of state.chain) for (const c of r.colliders) {
      const bx = c.x + r.slotX;
      const cx = clamp(p.x, bx - c.hw, bx + c.hw), cz = clamp(p.z, c.z - c.hd, c.z + c.hd);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_R * PLAYER_R) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * PLAYER_R; p.z = cz + dz / d * PLAYER_R; }
        else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hd + PLAYER_R);
      }
    }
  }
  const minX = state.chain[0].slotX - W / 2 + 0.9;
  const maxX = tailEdge() - (isFinish(tail().def.end) ? 0.3 : 0.9);
  p.x = clamp(p.x, minX, maxX);
  p.z = clamp(p.z, -(H / 2 - 0.7), H / 2 - 0.7);

  // facing + walk bob
  const speed = Math.hypot(vel.x, vel.z);
  if (speed > 0.4) {
    const want = Math.atan2(vel.x, vel.z);
    let diff = want - yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    yaw += diff * damp(16, dt);
  }
  player.rotation.y = yaw;
  body.position.y = Math.abs(Math.sin(performance.now() * 0.014)) * 0.1 * clamp(speed / PLAYER_SPEED, 0, 1);

  // win check
  if (!state.won && isFinish(tail().def.end) && p.x > tailEdge() - 4) win();
}

function win() {
  state.won = true;
  closeDialogue(); promptEl.classList.remove('show');
  const endType = tail().def.end, ending = ENDINGS[endType];
  const secs = ((performance.now() - state.t0) / 1000).toFixed(1);

  // remember which endings the player has discovered (survives restarts)
  let found = [];
  try { found = JSON.parse(localStorage.getItem('dc_endings') || '[]'); } catch { /* ignore */ }
  if (!found.includes(endType)) found.push(endType);
  try { localStorage.setItem('dc_endings', JSON.stringify(found)); } catch { /* ignore */ }
  const totalEndings = Object.keys(ENDINGS).length;

  const title = document.getElementById('winTitle');
  title.textContent = ending.title; title.style.color = TYPES[endType].color;
  document.getElementById('winText').textContent = ending.text(storyCtx(null));
  document.getElementById('winRoute').textContent = 'YOUR CUT:  ' + state.chain.map(r => r.def.name).join('  →  ');
  const unused = reels.filter(r => !state.chain.includes(r)).length;
  document.getElementById('winStats').textContent =
    `Time ${secs}s · Reels left on the cutting-room floor: ${unused} · Continuity errors: ${state.mistakes} · Characters met: ${state.talked.size}`;
  document.getElementById('winFound').textContent = `Endings discovered: ${found.length} / ${totalEndings}`;
  document.getElementById('win').classList.add('show');
}
document.getElementById('again').addEventListener('click', () => location.reload());

// ---------- reels update ----------
function updateReels(dt, time) {
  const k = damp(10, dt);
  // dragged reel follows the cursor
  const d = state.dragging;
  if (d) {
    const g = groundPoint();
    if (g) {
      const p = d.group.position, kk = damp(22, dt);
      p.x += (g.x + state.dragOffset.x - p.x) * kk;
      p.z += (g.z + state.dragOffset.y - p.z) * kk;
    }
    const t = tail();
    const near = !isFinish(t.def.end) && dragDistanceToGate(d) < SNAP_R;
    ghost.visible = near;
    if (near) {
      const ok = d.def.start === t.def.end;
      const col = ok ? 0x33ff99 : 0xff3b3b;
      ghostFill.material.color.setHex(col); ghostEdge.material.color.setHex(col);
      ghost.position.set(tailEdge() + W / 2, 0.02, 0);
    }
  }

  for (const r of reels) {
    const p = r.group.position;
    if (r.state !== 'dragging') {
      p.x += (r.target.x - p.x) * k; p.z += (r.target.z - p.z) * k;
    }
    r.group.rotation.y += (r.state === 'dragging' ? -r.group.rotation.y : r.targetRot - r.group.rotation.y) * k;

    let y = 0;
    if (r.state === 'dragging') y = 1.6;
    else if (r.state === 'loose' || r.state === 'returning') y = 0.35 + Math.sin(time * 1.6 + r.bobPhase) * 0.12;
    p.y += (y - p.y) * k;
    if (r.state === 'returning' && Math.hypot(r.target.x - p.x, r.target.z - p.z) < 0.05) r.state = 'loose';

    // highlight (hover + splice/error flash)
    r.flash = Math.max(0, r.flash - dt * 1.6);
    r.top.material.emissive.copy(r.flash > 0 ? r.flashColor : tmpWhite);
    r.top.material.emissiveIntensity = Math.max(r.flash * 0.9, (r.hover && grabbable(r)) || r.state === 'dragging' ? 0.22 : 0);

    // gate pulse
    if (r.gate.visible) {
      r.gate.userData.plane.material.opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(time * 4));
    }
  }
}
const tmpWhite = new THREE.Color(0xffffff);

// ---------- camera ----------
let shake = 0;
let camYaw = THREE.MathUtils.degToRad(32);
const focus = new THREE.Vector3();
function updateCamera(dt) {
  zoom += (zoomTarget - zoom) * damp(7, dt);
  const dist = ZOOM_NEAR * Math.pow(ZOOM_FAR / ZOOM_NEAR, zoom);
  const w = smoothstep(0.3, 0.95, zoom);          // follow-player -> look-at-table
  const pt = smoothstep(0.05, 0.75, zoom);        // side-on 2.5D -> top-down
  const fb = 1 - smoothstep(0.1, 0.45, zoom);     // "inside the film" amount (1 = fully in the frame)
  // low, nearly side-on camera up close (2.5D), easing into a top-down table view when zoomed out
  const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(19, 78, pt));
  camYaw = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(5, 0, pt));
  camera.fov = THREE.MathUtils.lerp(32, 45, pt); camera.updateProjectionMatrix();
  const target = tmpV.copy(player.position).lerp(WORLD_CENTER, w);
  target.y = THREE.MathUtils.lerp(1.6, 0, pt);
  focus.lerp(target, damp(6, dt));
  updateFilmLook(fb);

  const horiz = Math.cos(pitch) * dist;
  camera.position.set(focus.x - Math.sin(camYaw) * horiz, focus.y + Math.sin(pitch) * dist, focus.z + Math.cos(camYaw) * horiz);
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.z += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-dt * 9);
  }
  camera.lookAt(focus);

  // keep the shadow frustum around what we're looking at
  const size = clamp(dist * 0.75, 24, 95);
  const sc = sun.shadow.camera;
  sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.far = 220; sc.updateProjectionMatrix();
  sun.target.position.copy(focus);
  sun.position.set(focus.x + 22, 55, focus.z + 18);
}

// ---------- "inside the film" look: grayscale + sprocket-hole frame + backdrops, faded out when zoomed out ----------
const filmTop = document.getElementById('filmTop');
const filmBottom = document.getElementById('filmBottom');
let lastFilm = -1;
function updateFilmLook(fb) {
  // only reels spliced into the cut get a set behind them (a loose reel's wall would block the camera)
  for (const r of reels) { r.backdrop.visible = fb > 0.01 && r.state === 'attached'; r.backdrop.material.opacity = fb; }
  // sprocket holes scroll as you walk, like film running through a projector
  const scroll = `${(-player.position.x * 22) % 86}px`;
  filmTop.style.backgroundPositionX = scroll; filmBottom.style.backgroundPositionX = scroll;
  if (Math.abs(fb - lastFilm) < 0.01) return;
  lastFilm = fb;
  canvas.style.filter = fb > 0.01 ? `grayscale(${(0.92 * fb).toFixed(2)}) contrast(${(1 + 0.08 * fb).toFixed(2)})` : 'none';
  filmTop.style.transform = `translateY(${-(1 - fb) * 100}%)`;
  filmBottom.style.transform = `translateY(${(1 - fb) * 100}%)`;
}

// ---------- main loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
focus.copy(player.position);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  movePlayer(dt);
  updateReels(dt, now / 1000);
  updateDialogue(dt, now / 1000);
  updateCamera(dt);
  document.getElementById('zoomhint').style.opacity = zoomTarget > 0.15 ? 0 : 1;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug handle for poking from the console
window.__game = { state, reels, player, camera, THREE };
