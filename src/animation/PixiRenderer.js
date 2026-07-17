import { Application, Container, Graphics, Text } from 'pixi.js';
import { DIFFICULTIES } from '../shared/gameConfig.js';

// Placeholder scene — every visual is drawn with Pixi `Graphics`, no external
// spritesheet. Swap this file for a TexturePacker-based renderer later without
// touching GameCanvas.jsx (same contract: init / reset / update / destroy).

const TILE_W      = 84;
const TILE_H      = 58;
const TILE_GAP    = 16;
const TILE_STEP   = TILE_W + TILE_GAP;
const VIEW_ANCHOR = 0.30;   // fraction of canvas width where the chicken sits on screen
const HOP_MS      = 320;
const HOP_ARC     = 26;
const SHURIKEN_MS = 220;

const DEFAULT_LANES = Math.max(...Object.values(DIFFICULTIES).map(d => d.lanes));

const TILE_COLORS = {
  pending: 0x3a2a20,
  cleared: 0x1f4d2f,
  current: 0x6b4a12,
  danger:  0x6b1414,
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const BG_BASE  = 0x140a0c;
const BG_FLASH = 0x7a1414;

export class PixiRenderer {
  constructor() {
    this._app       = null;
    this._destroyed = false;
    this._loaded    = false; // true once _buildScene() has run — update()/reset() buffer until then
    this._pendingReset  = false;
    this._pendingUpdate = null;
    this._w = 0;
    this._h = 0;

    this._trackY = 0;
    this._camMin = 0;
    this._camMax = 0;
    this._camX   = 0;

    this._tiles       = [];
    this._appliedStep   = 0;
    this._appliedStatus = 'idle';

    this._chickenX = 0;
    this._chickenY = 0;
    this._hop = null;      // { fromX, toX, baseY, t }
    this._topple = false;

    this._shuriken = null; // { g, fromX, fromY, toX, toY, t }
    this._flash = 0;       // red bust flash alpha
    this._tailPhase = 0;
    this._bounceT = null;  // cashout victory-bounce progress

    this._onTick = this._onTick.bind(this);
  }

  async init(containerEl, width, height) {
    this._w = width;
    this._h = height;
    this._trackY = height * 0.66;
    this._camMin = width - (DEFAULT_LANES + 1) * TILE_STEP - width * 0.1;
    this._camMax = width * VIEW_ANCHOR;

    const app = new Application();
    this._app = app;
    await app.init({
      width, height,
      background:  0x140a0c,
      antialias:   true,
      resolution:  window.devicePixelRatio || 1,
      autoDensity: true,
    });
    if (this._destroyed) { app.destroy(true); return; }

    const canvas = app.canvas;
    canvas.style.width   = '100%';
    canvas.style.height  = '100%';
    canvas.style.display = 'block';
    containerEl.appendChild(canvas);

    this._buildScene();
    app.ticker.add(this._onTick);
    this._loaded = true;

    // Apply any reset()/update() calls that arrived before the scene existed.
    if (this._pendingReset) this.reset();
    if (this._pendingUpdate) this.update(this._pendingUpdate);
  }

  // ── Scene ────────────────────────────────────────────────────────────────
  _buildScene() {
    const { stage } = this._app;
    const w = this._w, h = this._h;

    this._buildBackground(stage, w, h);

    const track = new Container();
    track.y = this._trackY;
    this._track = track;
    stage.addChild(track);

    // Start pad (tile index 0)
    const pad = this._makeTile(TILE_W * 1.1, TILE_H);
    pad.x = 0;
    track.addChild(pad);

    for (let i = 1; i <= DEFAULT_LANES; i++) {
      const tile = this._makeTile(TILE_W, TILE_H);
      tile.x = i * TILE_STEP;
      track.addChild(tile);
      const label = new Text({
        text: String(i),
        style: { fontFamily: 'Arial, sans-serif', fontSize: 12, fill: 0x8a6a4a },
      });
      label.anchor.set(0.5);
      label.y = TILE_H / 2 + 12;
      tile.addChild(label);
      this._tiles.push({ container: tile, state: 'pending', label });
    }

    this._chicken = this._buildChicken();
    track.addChild(this._chicken);
    this._chickenX = 0;
    this._chickenY = 0;
    this._chicken.x = 0;
    this._chicken.y = 0;

    this._camX = this._camMax;
    track.x = this._camX;
  }

  _buildBackground(stage, w, h) {
    const bg = new Graphics();
    const bands = [0x3b1116, 0x2a0c10, 0x1a080b, 0x100608, 0x0a0507];
    const bandH = h / bands.length;
    bands.forEach((color, i) => {
      bg.rect(0, i * bandH, w, bandH + 1).fill(color);
    });
    stage.addChild(bg);

    // Moon
    const moon = new Graphics();
    moon.circle(w * 0.82, h * 0.18, 34).fill({ color: 0xf0e6c8, alpha: 0.9 });
    moon.circle(w * 0.82, h * 0.18, 48).fill({ color: 0xf0e6c8, alpha: 0.12 });
    stage.addChild(moon);

    // Torii silhouette
    const torii = new Graphics();
    const tx = w * 0.15, ty = h * 0.62;
    torii.rect(tx - 46, ty - 90, 10, 95).fill({ color: 0x1a0a0a, alpha: 0.6 });
    torii.rect(tx + 36, ty - 90, 10, 95).fill({ color: 0x1a0a0a, alpha: 0.6 });
    torii.rect(tx - 56, ty - 96, 112, 12).fill({ color: 0x1a0a0a, alpha: 0.6 });
    torii.rect(tx - 50, ty - 78, 100, 8).fill({ color: 0x1a0a0a, alpha: 0.6 });
    stage.addChild(torii);

    // Ground strip under the track
    const ground = new Graphics();
    ground.rect(0, this._trackY + TILE_H / 2 + 4, w, h - (this._trackY + TILE_H / 2 + 4))
      .fill({ color: 0x090405, alpha: 0.6 });
    stage.addChild(ground);
  }

  _makeTile(w, h) {
    const c = new Container();
    const g = new Graphics();
    c.addChild(g);
    c._draw = (color) => {
      g.clear();
      g.roundRect(-w / 2, -h / 2, w, h, 10).fill(color);
      g.roundRect(-w / 2, -h / 2, w, h, 10).stroke({ width: 2, color: 0x1a120c, alpha: 0.8 });
    };
    c._draw(TILE_COLORS.pending);
    return c;
  }

  _buildChicken() {
    const c = new Container();

    const shadow = new Graphics();
    shadow.ellipse(0, 30, 22, 7).fill({ color: 0x000000, alpha: 0.35 });
    c.addChild(shadow);

    const wing = new Graphics();
    wing.ellipse(9, 8, 9, 13).fill(0xe4d0a0);
    c.addChild(wing);

    const body = new Graphics();
    body.ellipse(0, 6, 19, 21).fill(0xf5e6c8);
    body.ellipse(0, 6, 19, 21).stroke({ width: 2, color: 0xd8c49a });
    c.addChild(body);

    const legL = new Graphics();
    legL.rect(-9, 24, 4, 10).fill(0xf39c12);
    c.addChild(legL);
    const legR = new Graphics();
    legR.rect(5, 24, 4, 10).fill(0xf39c12);
    c.addChild(legR);

    const head = new Graphics();
    head.circle(0, -18, 13).fill(0xf5e6c8);
    head.circle(0, -18, 13).stroke({ width: 2, color: 0xd8c49a });
    c.addChild(head);

    const beak = new Graphics();
    beak.poly([10, -16, 21, -18, 10, -12]).fill(0xf39c12);
    c.addChild(beak);

    const comb = new Graphics();
    comb.poly([-6, -30, -2, -38, 2, -30, 6, -37, 9, -29]).fill(0xc0392b);
    c.addChild(comb);

    const eyeL = new Graphics();
    eyeL.circle(-5, -19, 2).fill(0x1a0e0a);
    c.addChild(eyeL);
    const eyeR = new Graphics();
    eyeR.circle(5, -19, 2).fill(0x1a0e0a);
    c.addChild(eyeR);

    const headband = new Graphics();
    headband.rect(-14, -25, 28, 6).fill(0xa8281f);
    c.addChild(headband);

    const tailL = new Graphics();
    tailL.poly([-14, -22, -30, -18, -14, -16]).fill(0xa8281f);
    c.addChild(tailL);
    const tailR = new Graphics();
    tailR.poly([-14, -19, -32, -12, -14, -22]).fill(0x8f2119);
    c.addChild(tailR);

    c._tails = [tailL, tailR];
    return c;
  }

  _makeShuriken() {
    const g = new Graphics();
    g.star(0, 0, 4, 15, 7).fill(0xc9d6df);
    g.star(0, 0, 4, 15, 7).stroke({ width: 2, color: 0x333d42 });
    g.circle(0, 0, 3).fill(0x333d42);
    return g;
  }

  _setTileState(index, state) {
    const t = this._tiles[index - 1];
    if (!t) return;
    t.state = state;
    t.container._draw(TILE_COLORS[state] ?? TILE_COLORS.pending);
  }

  // ── Public contract ─────────────────────────────────────────────────────

  // Called when a brand-new round begins (fresh chicken, fresh tiles).
  reset() {
    if (!this._loaded) { this._pendingReset = true; return; }
    this._pendingReset = false;
    this._tiles.forEach((t, i) => this._setTileState(i + 1, 'pending'));
    this._hop        = null;
    this._topple      = false;
    this._shuriken     = null;
    this._flash        = 0;
    this._bounceT       = null;
    this._appliedStep   = 0;
    this._appliedStatus = 'idle';
    this._chickenX = 0;
    this._chickenY = 0;
    if (this._chicken) {
      this._chicken.x = 0;
      this._chicken.y = 0;
      this._chicken.rotation = 0;
      this._chicken.scale.set(1);
    }
  }

  update({ status, step = 0, lastOutcome }) {
    if (this._destroyed) return;
    if (!this._loaded) { this._pendingUpdate = { status, step, lastOutcome }; return; }
    this._pendingUpdate = null;

    if (status === 'active' && step > this._appliedStep) {
      this._setTileState(step, 'cleared');
      const nextIdx = step + 1;
      if (this._tiles[nextIdx - 1] && this._tiles[nextIdx - 1].state === 'pending') {
        this._setTileState(nextIdx, 'current');
      }
      this._startHop(step * TILE_STEP);
    }

    if (status === 'busted' && this._appliedStatus !== 'busted') {
      const deathLane = step + 1;
      this._setTileState(deathLane, 'danger');
      this._throwShuriken(deathLane * TILE_STEP);
    }

    if (status === 'cashed' && this._appliedStatus !== 'cashed') {
      this._bounce();
    }

    this._appliedStep   = step;
    this._appliedStatus = status;
    void lastOutcome;
  }

  destroy() {
    this._destroyed = true;
    // If init() hasn't finished yet, this._app has no ticker/stage wired up —
    // its own `if (this._destroyed)` branch tears it down once init() resolves.
    if (this._loaded && this._app) {
      this._app.ticker.remove(this._onTick);
      this._app.destroy(true, { children: true, texture: false });
    }
    this._app = null;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  _startHop(targetX) {
    this._hop = { fromX: this._chickenX, toX: targetX, t: 0 };
  }

  _throwShuriken(targetTileX) {
    const g = this._makeShuriken();
    this._track.addChild(g);
    this._shuriken = {
      g, t: 0,
      fromX: targetTileX, fromY: -160,
      toX: targetTileX,   toY: 0,
    };
    this._hop = { fromX: this._chickenX, toX: targetTileX, t: 0 };
    this._topple = 'pending';
  }

  _bounce() {
    this._bounceT = 0;
  }

  _onTick(ticker) {
    const dt = ticker.deltaTime;

    // Hop tween (parabolic arc)
    if (this._hop) {
      this._hop.t += dt * (1000 / 60) / HOP_MS;
      const t = clamp(this._hop.t, 0, 1);
      this._chickenX = this._hop.fromX + (this._hop.toX - this._hop.fromX) * t;
      this._chickenY = -Math.sin(Math.PI * t) * HOP_ARC;
      if (t >= 1) {
        this._chickenX = this._hop.toX;
        this._chickenY = 0;
        this._hop = null;
        if (this._topple === 'pending') this._topple = true;
      }
    }

    // Shuriken flight
    if (this._shuriken) {
      const s = this._shuriken;
      s.t += dt * (1000 / 60) / SHURIKEN_MS;
      const t = clamp(s.t, 0, 1);
      s.g.x = s.fromX + (s.toX - s.fromX) * t;
      s.g.y = s.fromY + (s.toY - s.fromY) * t;
      s.g.rotation += dt * 0.6;
      if (t >= 1) {
        this._track.removeChild(s.g);
        s.g.destroy();
        this._shuriken = null;
        this._flash = 1;
      }
    }

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 0.06);
      this._app.renderer.background.color = lerpColor(BG_BASE, BG_FLASH, this._flash);
    }

    if (this._topple === true) {
      this._chicken.rotation += (1.35 - this._chicken.rotation) * Math.min(1, dt * 0.14);
    } else {
      this._chicken.rotation += (0 - this._chicken.rotation) * Math.min(1, dt * 0.2);
    }

    if (this._bounceT !== null) {
      this._bounceT += dt * 0.06;
      if (this._bounceT <= 1) {
        this._chickenY = -Math.sin(Math.PI * this._bounceT) * 14;
      } else {
        this._bounceT = null;
        this._chickenY = 0;
      }
    }

    this._chicken.x = this._chickenX;
    this._chicken.y = this._chickenY;

    // Headband tail sway
    this._tailPhase += dt * 0.08;
    if (this._chicken._tails) {
      this._chicken._tails.forEach((tail, i) => {
        tail.rotation = Math.sin(this._tailPhase + i) * 0.15;
      });
    }

    // Camera follow
    const camTarget = clamp(this._w * VIEW_ANCHOR - this._chickenX, this._camMin, this._camMax);
    this._camX += (camTarget - this._camX) * Math.min(1, dt * 0.1);
    this._track.x = this._camX;
  }
}
