export class CubicBezier {
  private p1x: number; private p1y: number;
  private p2x: number; private p2y: number;
  constructor(p1x: number, p1y: number, p2x: number, p2y: number) {
    this.p1x = p1x; this.p1y = p1y; this.p2x = p2x; this.p2y = p2y;
  }
  private getX(t: number) { return 3*t*Math.pow(1-t,2)*this.p1x + 3*Math.pow(t,2)*(1-t)*this.p2x + Math.pow(t,3); }
  private getY(t: number) { return 3*t*Math.pow(1-t,2)*this.p1y + 3*Math.pow(t,2)*(1-t)*this.p2y + Math.pow(t,3); }
  private getXDerivative(t: number) { return 3*Math.pow(1-t,2)*this.p1x - 6*t*(1-t)*this.p1x + 6*t*(1-t)*this.p2x - 3*Math.pow(t,2)*this.p2x + 3*Math.pow(t,2); }
  solveT(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = this.getX(t) - x, d = this.getXDerivative(t);
      if (Math.abs(cx) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= cx / d;
    }
    if (t < 0 || t > 1) {
      let lo = 0, hi = 1; t = x;
      while (hi - lo > 1e-5) { const v = this.getX(t); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return t;
  }
  evaluate(x: number) { if (x <= 0) return 0; if (x >= 1) return 1; return this.getY(this.solveT(x)); }
}

export class Particle {
  x = 0; y = 0; vx = 0; vy = 0; life = 0; maxLife = 0; size = 0; color = '#fff';
  reset(w: number, h: number, color: string) {
    this.x = Math.random() * w; this.y = Math.random() * h;
    const a = Math.random() * Math.PI * 2, s = Math.random() * 1.5 + 0.5;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.maxLife = Math.random() * 100 + 50; this.life = this.maxLife;
    this.size = Math.random() * 2.5 + 0.5; this.color = color;
  }
  update(w: number, h: number, wx: number, wy: number, drag: number) {
    this.vx += wx; this.vy += wy; this.vx *= drag; this.vy *= drag;
    this.x += this.vx; this.y += this.vy; this.life--;
    if (this.x < 0) this.x = w; if (this.x > w) this.x = 0;
    if (this.y < 0) this.y = h; if (this.y > h) this.y = 0;
  }
}

export class ParticleSystem {
  particles: Particle[] = [];
  constructor() { for (let i = 0; i < 200; i++) this.particles.push(new Particle()); }
  init(w: number, h: number, color: string) { this.particles.forEach(p => p.reset(w, h, color)); }
  updateAndDraw(ctx: CanvasRenderingContext2D, w: number, h: number, wx: number, wy: number, drag: number, color: string, sizeMult: number) {
    ctx.fillStyle = color; ctx.strokeStyle = color;
    for (const p of this.particles) {
      if (p.life <= 0) p.reset(w, h, color);
      p.update(w, h, wx, wy, drag);
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * sizeMult, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export interface LayerConfig { color: string; opacity: number; speed: number; blendMode: GlobalCompositeOperation; customParams: Record<string, number>; }

export const PRESET_TEMPLATES = [
  { id: 'cosmic_core', name: 'Cosmic Core', layers: ['layer1', 'layer2', 'layer8'], bezier: [0.25, 0.1, 0.25, 1] },
  { id: 'quantum_nexus', name: 'Quantum Nexus', layers: ['layer3', 'layer4', 'layer10'], bezier: [0.34, 1.56, 0.64, 1] },
  { id: 'cyber_grid', name: 'Cyber Grid', layers: ['layer5', 'layer9', 'layer2'], bezier: [0.77, 0, 0.175, 1] },
  { id: 'bio_bloom', name: 'Bio Bloom', layers: ['layer6', 'layer7'], bezier: [0.445, 0.05, 0.55, 0.95] },
  { id: 'stellar_const', name: 'Stellar Constellation', layers: ['layer1', 'layer4', 'layer8', 'layer10'], bezier: [0.19, 1, 0.22, 1] },
];

export const OMEGA_TEMPLATE = { id: 'omega_flame', name: 'Omega Flame', layers: ['layer1', 'layer2', 'layer3', 'layer4', 'layer5', 'layer6', 'layer7', 'layer8', 'layer9', 'layer10'], bezier: [0.25, 0.1, 0.25, 1] };

const CHARS = "0101XYZΩΨΦΘΞΠΣΛГЖИ";

export function renderLayerDispatch(
  ctx: CanvasRenderingContext2D, layerId: string, varId: string, t: number,
  conf: LayerConfig, easeVal: number, w: number, h: number,
  mx: number, my: number, dayFactor: number, particles: ParticleSystem | null
) {
  const cx = w / 2, cy = h / 2, rad = Math.min(cx, cy) * 0.7 * (0.8 + easeVal * 0.4);
  const zoom = conf.customParams.zoom ?? 1;
  const circles = Math.floor((conf.customParams.circles ?? 4) * dayFactor);
  const thickness = conf.customParams.thickness ?? 1.5;
  ctx.lineWidth = thickness;

  switch (layerId) {
    case 'layer1': {
      ctx.strokeStyle = conf.color;
      if (varId.includes('var2')) {
        for (let i = 0; i < 40; i++) { const a = (i * Math.PI) / 20 + t * 0.1; const r = (rad * (i + 1)) / 40 * zoom; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 0, Math.PI * 2); ctx.fill(); }
      } else if (varId.includes('var3')) {
        for (let i = 0; i < 8; i++) { const r = ((rad * ((t * 2 + i) % 8)) / 8) * zoom; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      } else if (varId.includes('var4')) {
        ctx.fillStyle = conf.color;
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const rx = (w / 7) * (i + 1), ry = (h / 7) * (j + 1), pulse = Math.sin(t + i * 2 + j * 3) * 6; ctx.beginPath(); ctx.arc(rx, ry, Math.max(1, 3 + pulse), 0, Math.PI * 2); ctx.fill(); }
      } else if (varId.includes('var5')) {
        ctx.fillStyle = conf.color;
        for (let j = 0; j < 5; j++) { const theta = t * 0.4 * dayFactor + (j * Math.PI) / 2.5, sh = 70 * Math.sin(t); ctx.beginPath(); ctx.arc(cx + Math.cos(theta) * (90 + sh), cy + Math.sin(theta) * (90 + sh), 5, 0, Math.PI * 2); ctx.fill(); }
      } else {
        for (let i = 0; i < w; i += 70) { const wave = Math.sin(t + i * 0.02) * 20; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + wave, h); ctx.stroke(); }
      }
      break;
    }
    case 'layer2': {
      ctx.strokeStyle = conf.color;
      if (varId.includes('var2')) {
        ctx.beginPath(); const R = 120 * dayFactor, r = 40, d = 50 * easeVal;
        for (let theta = 0; theta < Math.PI * 6; theta += 0.05) { const x = (R - r) * Math.cos(theta + t) + d * Math.cos(((R - r) * (theta + t)) / r), y = (R - r) * Math.sin(theta + t) - d * Math.sin(((R - r) * (theta + t)) / r); if (theta === 0) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y); }
        ctx.stroke();
      } else if (varId.includes('var3')) {
        ctx.beginPath(); const sides = 6 + Math.floor(dayFactor * 2), curRad = rad * 0.8;
        for (let i = 0; i <= sides; i++) { const a = (i * Math.PI * 2) / sides + t, wb = 1 + Math.sin(t * 3 + i * 5) * 0.12 * easeVal; const x = cx + Math.cos(a) * curRad * wb, y = cy + Math.sin(a) * curRad * wb; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.closePath(); ctx.stroke();
      } else if (varId.includes('var4')) {
        for (let i = 0; i < circles; i++) { const grow = ((t + i / circles) % 1) * rad; ctx.beginPath(); ctx.arc(cx, cy, grow, 0, Math.PI * 2); ctx.stroke(); }
      } else if (varId.includes('var5')) {
        for (let i = 0; i < 6; i++) { const phi = (i * Math.PI * 2) / 6 + t * 0.2; ctx.beginPath(); ctx.arc(cx + Math.cos(phi) * 50, cy + Math.sin(phi) * 50, 60, 0, Math.PI * 2); ctx.stroke(); }
      } else {
        for (let d = 1; d <= circles; d++) { const sides = 3 + d, r = (rad / circles) * d; ctx.beginPath(); for (let s = 0; s <= sides; s++) { const a = (s * Math.PI * 2) / sides + t * (d % 2 === 0 ? 0.3 : -0.3); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      }
      break;
    }
    case 'layer3': {
      ctx.strokeStyle = conf.color;
      const wc = conf.customParams.waves ?? 3, freq = conf.customParams.frequency ?? 0.015;
      if (varId.includes('var2')) {
        for (let w = 0; w < wc; w++) { ctx.beginPath(); const amp = 40 + w * 15 * easeVal; for (let y = 0; y < h; y += 8) { const x = cx + Math.sin(y * freq + t + w) * amp; y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      } else if (varId.includes('var3')) {
        const s1x = cx - 100 * Math.sin(t * 0.5), s2x = cx + 100 * Math.cos(t * 0.5);
        for (let r = 10; r < w * 0.6; r += 30) { ctx.beginPath(); ctx.ellipse(s1x, cy, r * easeVal, r * 0.6 * easeVal, t, 0, Math.PI * 2); ctx.arc(s2x, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke(); }
      } else if (varId.includes('var4')) { ctx.beginPath(); for (let gx = 0; gx < w; gx += 20) { const yv = cy + Math.cos(gx * 0.03) * Math.sin(t) * 50; ctx.lineTo(gx, yv); } ctx.stroke(); }
      else if (varId.includes('var5')) { ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x < w; x += 10) { const y = h * 0.7 + Math.sin(x * 0.005 + t) * Math.cos(x * 0.01 + t) * 80 * easeVal; ctx.lineTo(x, y); } ctx.lineTo(w, h); ctx.closePath(); ctx.stroke(); }
      else { for (let wi = 0; wi < wc; wi++) { ctx.beginPath(); const amp = 30 + wi * 12 * dayFactor; for (let x = 0; x < w; x += 6) { const y = cy + Math.sin(x * freq + t + wi * 0.8) * amp * easeVal; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); } }
      break;
    }
    case 'layer4': {
      if (particles) {
        const wx = conf.customParams.windX ?? 0, wy = (conf.customParams.windY ?? 0) + Math.sin(t) * 0.05;
        if (varId.includes('var2')) particles.particles.forEach(p => { const dx = mx - p.x, dy = my - p.y, d = Math.sqrt(dx*dx+dy*dy); if (d > 5) { p.vx += (dx/d)*0.4*easeVal; p.vy += (dy/d)*0.4*easeVal; } });
        else if (varId.includes('var3')) particles.particles.forEach((p, i) => { const ro = 80 + Math.sin(t + i * 0.01) * 40, tx = cx + Math.cos(t + i) * ro, ty = cy + Math.sin(t + i) * ro; p.vx += (tx - p.x) * 0.05; p.vy += (ty - p.y) * 0.05; });
        else if (varId.includes('var4')) particles.particles.forEach(p => { p.vx += (Math.random() - 0.5) * 0.8; p.vy += (Math.random() - 0.5) * 0.8; });
        else if (varId.includes('var5')) particles.particles.forEach(p => { p.vx += 0.25 * dayFactor; });
        particles.updateAndDraw(ctx, w, h, wx, wy, 0.98, conf.color, 1 + easeVal * 0.5);
      }
      break;
    }
    case 'layer5': {
      ctx.fillStyle = conf.color; ctx.font = '10px monospace';
      const cols = 15 + Math.floor(dayFactor * 10);
      if (varId.includes('var2')) { for (let c = 0; c < cols; c++) { const theta = t + (c * Math.PI * 2) / cols, dist = ((t * 220 + c * 30) % 350) * easeVal; ctx.fillText(Math.random() > 0.5 ? '1' : '0', cx + Math.cos(theta) * dist, cy + Math.sin(theta) * dist); } }
      else if (varId.includes('var3')) { for (let row = 1; row < 12; row++) { const sy = (h / 13) * row; for (let s = 0; s < w; s += 30) { const ow = Math.sin(s * 0.015 + t + row) * 30, idx = Math.floor(Math.abs(Math.sin(s + row)) * CHARS.length); ctx.fillText(CHARS[idx], s, sy + ow); } } }
      else if (varId.includes('var4')) { for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) { const idx = Math.floor((c * 3 + r * t) % CHARS.length); ctx.fillText(CHARS[idx], 50 + c * 120, 100 + r * 80); } }
      else if (varId.includes('var5')) { for (let i = 0; i < h; i += 25) { const sl = cx - 50 + Math.sin(t + i * 0.02) * 50, sr = cx + 50 + Math.sin(t + i * 0.02 + Math.PI) * 50; ctx.fillText('0', sl, i); ctx.fillText('1', sr, i); } }
      else { for (let c = 0; c < cols; c++) { const cellX = (w / cols) * c, dropY = ((c * 120 + t * 180) % (h + 100)) - 50; for (let rp = 0; rp < 10; rp++) { ctx.save(); ctx.globalAlpha = ((10 - rp) / 10) * conf.opacity; const idx = Math.floor((c + rp * 2) % CHARS.length); ctx.fillText(CHARS[idx], cellX, dropY - rp * 12); ctx.restore(); } } }
      break;
    }
    case 'layer6': {
      ctx.strokeStyle = conf.color;
      const sectors = conf.customParams.symmetry ?? 8;
      if (varId.includes('var2')) {
        for (let s = 0; s < sectors; s++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((s * Math.PI * 2) / sectors); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(40, -60, 80 * easeVal, -100, 0, -rad * 0.8); ctx.bezierCurveTo(-80 * easeVal, -100, -40, -60, 0, 0); ctx.stroke(); ctx.restore(); }
      } else if (varId.includes('var3')) {
        const drawBranch = (len: number, depth: number) => { if (depth <= 0) return; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke(); ctx.save(); ctx.translate(0, -len); ctx.rotate(0.4 * easeVal); drawBranch(len * 0.7, depth - 1); ctx.restore(); ctx.save(); ctx.translate(0, -len); ctx.rotate(-0.4 * easeVal); drawBranch(len * 0.7, depth - 1); ctx.restore(); };
        for (let s = 0; s < sectors; s++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((s * Math.PI * 2) / sectors + t * 0.2); drawBranch(45 * dayFactor, 4); ctx.restore(); }
      } else if (varId.includes('var4')) { ctx.beginPath(); for (let i = 0; i <= sectors * 2; i++) { const a = (i * Math.PI * 2) / (sectors * 2) + t * 0.1, rv = i % 2 === 0 ? rad * 0.8 : rad * 0.3 * (1 + Math.sin(t) * 0.2); const x = cx + Math.cos(a) * rv, y = cy + Math.sin(a) * rv; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); }
      else if (varId.includes('var5')) { for (let rs = 30; rs < rad; rs += 35) { ctx.beginPath(); ctx.arc(cx, cy, rs, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); for (let s = 0; s < sectors; s++) { const a = (s * Math.PI * 2) / sectors; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } ctx.stroke(); } }
      else { for (let ring = 1; ring <= 4; ring++) { const rr = (rad / 4) * ring * easeVal; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); for (let s = 0; s < sectors; s++) { const a = (s * Math.PI * 2) / sectors + t * (ring % 2 === 0 ? 0.2 : -0.2); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 8, 0, Math.PI * 2); ctx.stroke(); } } }
      break;
    }
    case 'layer7': {
      ctx.strokeStyle = conf.color;
      const bScale = conf.customParams.scale ?? 1.2;
      if (varId.includes('var2')) { for (let b = 0; b < 3; b++) { const x = cx + Math.cos(t * 1.5 + b * 2) * 50, y = cy + Math.sin(t * 1.2 + b) * 50; ctx.beginPath(); ctx.arc(x, y, 60 * bScale * dayFactor * easeVal, 0, Math.PI * 2); ctx.stroke(); } }
      else if (varId.includes('var3')) { for (let j = 1; j <= 5; j++) { ctx.beginPath(); const ss = rad * 0.18 * j * bScale; for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) { const p = 1 + Math.sin(a * 4 + t + j) * 0.15 * easeVal; const x = cx + Math.cos(a) * ss * p, y = cy + Math.sin(a) * ss * p; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); } }
      else if (varId.includes('var4')) { const dist = 60 * Math.sin(t * 0.8); for (let p = -1; p <= 1; p += 2) { ctx.beginPath(); ctx.arc(cx + dist * p, cy, 60 * easeVal, 0, Math.PI * 2); ctx.stroke(); } }
      else if (varId.includes('var5')) { ctx.beginPath(); for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.04) { const j = Math.sin(a * 12 + t * 4) * 8 * easeVal; const x = cx + Math.cos(a) * (rad * 0.7 + j), y = cy + Math.sin(a) * (rad * 0.7 + j); a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); }
      else { ctx.beginPath(); for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) { const rOff = 1 + Math.sin(a * 5 + t * 2) * 0.22 * easeVal; const x = cx + Math.cos(a) * rad * 0.7 * rOff, y = cy + Math.sin(a) * rad * 0.7 * rOff; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); }
      break;
    }
    case 'layer8': {
      ctx.strokeStyle = conf.color; ctx.fillStyle = conf.color;
      const dotCount = Math.min(100, (conf.customParams.dotCount ?? 40) + Math.floor(dayFactor * 15));
      const maxDist = (conf.customParams.maxDistance ?? 100) * easeVal;
      const nodes: { x: number; y: number }[] = [];
      for (let i = 0; i < dotCount; i++) { const theta = (i * Math.PI * 13) / 11 + t * 0.1, drift = Math.sin(t * 0.5 + i) * 30, dist = (h * 0.35) * Math.sin(i * 1.7) + h * 0.45; nodes.push({ x: cx + Math.cos(theta) * dist + drift, y: cy + Math.sin(theta) * dist + drift }); }
      if (varId.includes('var2')) { for (let i = 0; i < dotCount; i++) { const n = nodes[i], dx = mx - n.x, dy = my - n.y, dm = Math.sqrt(dx*dx+dy*dy); if (dm < 180) { ctx.save(); ctx.globalAlpha = (1 - dm / 180) * 0.4; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(mx, my); ctx.stroke(); ctx.restore(); } } }
      else if (varId.includes('var3')) { for (let i = 0; i < dotCount; i += 6) { ctx.beginPath(); for (let m = 0; m < 6; m++) { const idx = (i + m) % dotCount; m === 0 ? ctx.moveTo(nodes[idx].x, nodes[idx].y) : ctx.lineTo(nodes[idx].x, nodes[idx].y); } ctx.closePath(); ctx.stroke(); } }
      else if (varId.includes('var4')) { for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) for (let k = j + 1; k < nodes.length; k++) { const d1 = Math.hypot(nodes[i].x - nodes[j].x, nodes[j].x - nodes[k].x), d2 = Math.hypot(nodes[j].x - nodes[k].x, nodes[j].y - nodes[k].y), d3 = Math.hypot(nodes[k].x - nodes[i].x, nodes[k].y - nodes[i].y); if (d1 < maxDist * 0.8 && d2 < maxDist * 0.8 && d3 < maxDist * 0.8) { ctx.save(); ctx.globalAlpha = 0.08 * conf.opacity; ctx.fillStyle = conf.color; ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.lineTo(nodes[k].x, nodes[k].y); ctx.closePath(); ctx.fill(); ctx.restore(); } } }
      else if (varId.includes('var5')) { for (let gx = 50; gx < w; gx += 100) for (let gy = 50; gy < h; gy += 100) ctx.fillRect(gx, gy, 2, 2); }
      nodes.forEach((node, idx) => { ctx.beginPath(); ctx.arc(node.x, node.y, 2, 0, Math.PI * 2); ctx.fill(); for (let ti = idx + 1; ti < nodes.length; ti++) { const tn = nodes[ti], dx = node.x - tn.x, dy = node.y - tn.y, d = Math.sqrt(dx*dx+dy*dy); if (d < maxDist) { ctx.save(); ctx.globalAlpha = (1 - d / maxDist) * 0.7 * conf.opacity; ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(tn.x, tn.y); ctx.stroke(); ctx.restore(); } } });
      break;
    }
    case 'layer9': {
      const gf = conf.customParams.glitchFrequency ?? 0.12;
      if (varId.includes('var2')) {
        ctx.strokeStyle = conf.color; const hexR = 30 * dayFactor, hStep = hexR * Math.sqrt(3), vStep = hexR * 1.5;
        for (let xc = -1; xc < w / hStep + 1; xc++) for (let yc = -1; yc < h / vStep + 1; yc++) { const shift = (yc % 2 === 0) ? hStep / 2 : 0, px = xc * hStep + shift, py = yc * vStep; if (Math.sin(xc + yc + t * 4) > (1 - gf)) { ctx.beginPath(); for (let s = 0; s <= 6; s++) { const a = (s * Math.PI) / 3; s === 0 ? ctx.moveTo(px + Math.cos(a) * hexR, py + Math.sin(a) * hexR) : ctx.lineTo(px + Math.cos(a) * hexR, py + Math.sin(a) * hexR); } ctx.stroke(); } }
      } else if (varId.includes('var3')) { ctx.fillStyle = conf.color; ctx.font = '9px monospace'; if (Math.random() < 0.25) { ctx.fillText(`NODES:[${Math.floor(t*100)}]`, cx - 80, cy + 80); ctx.fillText(`DAY_${Math.floor(dayFactor*1000)}`, cx + 30, cy - 80); } }
      else if (varId.includes('var4')) { ctx.fillStyle = conf.color; for (let i = 0; i < w; i += 18) { const bw = Math.sin(t + i) * 4 * easeVal; if (bw > 1) ctx.fillRect(i, 0, bw, h); } }
      else if (varId.includes('var5')) { ctx.strokeStyle = conf.color; const ts = t * 1.3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ts) * rad, cy + Math.sin(ts) * rad); ctx.stroke(); }
      else { if (Math.random() < gf) { const sh = Math.random() * 25 + 5, sy = Math.random() * (h - sh), off = (Math.random() - 0.5) * 45 * easeVal; ctx.drawImage(ctx.canvas, 0, sy, w, sh, off, sy, w, sh); } }
      break;
    }
    case 'layer10': {
      ctx.strokeStyle = conf.color;
      const vs = (conf.customParams.vortexSpeed ?? 1.2) * dayFactor;
      if (varId.includes('var2')) { for (let i = 0; i < 48; i++) { const a = (i * Math.PI) / 24 + t * 0.4, lf = 30 + Math.sin(t * 3 + i) * 20 * easeVal; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 70, my + Math.sin(a) * 70); ctx.lineTo(mx + Math.cos(a) * (70 + lf), my + Math.sin(a) * (70 + lf)); ctx.stroke(); } }
      else if (varId.includes('var3')) {
        const galaxyArms = (cxAngle: number) => { ctx.beginPath(); for (let s = 1; s < 180; s += 3) { const a = s * 0.08 + t * 0.6 + cxAngle, dist = s * 1.4 * easeVal; s === 1 ? ctx.moveTo(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist) : ctx.lineTo(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist); } ctx.stroke(); };
        galaxyArms(0); galaxyArms(Math.PI);
      } else if (varId.includes('var4')) { ctx.beginPath(); for (let side = 0; side < w; side += 12) { const ss = cy - 80 + Math.sin(t * 1.5 + side * 0.01) * 35 + easeVal * 30; side === 0 ? ctx.moveTo(side, ss) : ctx.lineTo(side, ss); } ctx.stroke(); }
      else if (varId.includes('var5')) { for (let i = 1; i <= 6; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, (rad * i) / 6, (rad * 0.5 * i) / 6, t * 1.5, 0, Math.PI * 2); ctx.stroke(); } }
      else { ctx.beginPath(); for (let idx = 0; idx < 250; idx += 4) { const phi = idx * 0.08 + t * 1.4 * vs, dr = idx * 1.2 * easeVal; idx === 0 ? ctx.moveTo(mx + Math.cos(phi) * dr, my + Math.sin(phi) * dr) : ctx.lineTo(mx + Math.cos(phi) * dr, my + Math.sin(phi) * dr); } ctx.stroke(); }
      break;
    }
  }
}
