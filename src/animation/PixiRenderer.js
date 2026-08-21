import { Application, Container, Graphics, Text, Sprite, TilingSprite, Assets } from 'pixi.js';
import { DIFFICULTIES, buildMultiplierLadder } from '../shared/gameConfig.js';
import { theme } from '../theme.js';

import chickenIdleUrl from '../assets/chicken/chicken-idle.png';
import chickenRunUrl from '../assets/chicken/chicken-run.png';
import chickenVictoryUrl from '../assets/chicken/chicken-victory.png';
import chickenKoUrl from '../assets/chicken/chicken-ko.png';
import iconShurikenUrl from '../assets/icons/icon-shuriken.png';
import iconXUrl from '../assets/icons/icon-x.png';
import roadLaneTileUrl from '../assets/road/road-lane-tile.png';
import roadStartPostUrl from '../assets/road/road-start-post.png';
import roadFinishPostUrl from '../assets/road/road-finish-post.png';
import pathSandTileUrl from '../assets/road/path-sand-tile.png';
import pathPostUrl from '../assets/road/path-post.png';
import badgeMultiplierUrl from '../assets/ui/badge-multiplier.png';

// Manga/BD scene — real sprites (src/assets/) replacing the old Graphics-only
// placeholders. Same public contract (init/reset/update/destroy) as before,
// GameCanvas.jsx does not need to change.

const TILE_W      = 84;
const TILE_H      = 58;
const TILE_GAP    = 16;
const TILE_STEP   = TILE_W + TILE_GAP;
const VIEW_ANCHOR = 0.30;   // fraction of canvas width where the chicken sits on screen
const HOP_MS      = 320;
const HOP_ARC     = 26;
// Bust sequence used to fire the hop and the shuriken flight at the same time, so the
// star landed (and the KO pose triggered) while the chicken was still mid-hop — the two
// animations overlapped instead of reading as "chicken arrives, then gets hit". They now
// run in sequence: hop lands → SUSPENSE_MS beat on the danger tile → shuriken thrown in.
const SUSPENSE_MS = 180;
const SHURIKEN_MS = 300;
const CHICKEN_H   = 66 * 1.2; // display height, all poses scaled to match — +20%
const KO_SQUASH_MS = 150;
const BADGE_SIZE  = 46;     // multiplier disc drawn on each tile, replaces the plain lane number
const TOP_CLEARANCE = CHICKEN_H + HOP_ARC + 30; // room above the road for the chicken hop + wall decor
const REFERENCE_H     = 380; // canvas height the road/chicken/tiles were originally sized for
const MAX_SCENE_SCALE = 1.5; // cap so the scene doesn't blow up into an unreadable zoom on very tall canvases
const TRACK_Y_EXTRA    = 36; // nudges the whole road scene down off the safety-clearance line, more breathing room above without needing to fully center it

// road-decor proportions (training posts, start/finish gates) are pinned to the chicken's
// original height, not the live CHICKEN_H — so resizing the chicken doesn't drag the
// already-tuned post/gate sizes along with it.
const POST_REF_H = 66;

// The sand/post source art (path-post.png, path-sand-tile.png) is cropped from the same
// generated panel, split so they can scale independently: the sand ground can grow to fill
// any canvas height without the post growing along with it and outscaling the chicken.
const SAND_TILE_SCALE   = 0.6;              // dot density on screen — independent of canvas height
const POST_DISPLAY_H    = POST_REF_H * 1.55 * 0.8; // training post is taller than the chicken, not huge — sized down 20% for the new archery-target artwork
const POST_SPACING_LANES = 1;               // one post per lane, aligned under every badge

const DEFAULT_LANES = Math.max(...Object.values(DIFFICULTIES).map(d => d.lanes));

const num = hex => parseInt(hex.replace('#', ''), 16);

// Each pending/current/cleared tile shows its multiplier on a disc (badge-multiplier.png);
// danger replaces the disc with the X icon — you don't get that multiplier, showing it
// would read as a reward instead of the bust it is.
const TILE_VISUALS = {
  pending: { wash: null,          alpha: 0,    badge: true,  icon: null },
  current: { wash: theme.warning, alpha: 0.28, badge: true,  icon: null },
  cleared: { wash: theme.success, alpha: 0.18, badge: true,  icon: null },
  danger:  { wash: theme.danger,  alpha: 0.35, badge: false, icon: 'iconX' },
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

const BG_BASE  = num(theme.bg);
const BG_FLASH = num(theme.danger);

export class PixiRenderer {
  constructor() {
    this._app       = null;
    this._destroyed = false;
    this._loaded    = false; // true once _buildScene() has run — update()/reset() buffer until then
    this._pendingReset  = false;
    this._pendingUpdate = null;
    this._w = 0;
    this._h = 0;

    this._textures = null;

    this._trackY = 0;
    this._camMin = 0;
    this._camMax = 0;
    this._camX   = 0;

    this._tiles       = [];
    this._appliedStep   = 0;
    this._appliedStatus = 'idle';
    this._ladder         = buildMultiplierLadder(DIFFICULTIES.easy.deathChance, DEFAULT_LANES);
    this._pendingDifficulty = null;

    this._chickenX = 0;
    this._chickenY = 0;
    this._hop = null;      // { fromX, toX, baseY, t }
    this._topple = false;
    this._koSquashT = null;

    this._shuriken = null; // { g, fromX, fromY, toX, toY, t }
    this._suspenseT = null;  // beat between the hop landing and the shuriken being thrown
    this._deathTileX = null; // tile the chicken hopped to, pending the shuriken throw
    this._missShurikens = []; // near-miss shurikens falling on tiles the chicken just cleared
    this._flash = 0;       // bust screen-flash alpha
    this._bounceT = null;  // cashout victory-bounce progress

    this._busy = false;        // true while the bust/cashout animation is still playing
    this._onBusyChange = null; // React callback — gates the "start new round" button while _busy

    this._onTick = this._onTick.bind(this);
  }

  async init(containerEl, width, height) {
    this._w = width;
    this._h = height;
    // Whole scene (road/chicken/tiles) scales up uniformly when the canvas is taller than
    // the reference design height, so it fills the flex space App.jsx gives it instead of
    // sitting as a fixed-size band centered in a sea of cream. Uniform (not just vertical)
    // so proportions/art stay undistorted — lanes just get a bit larger, not squashed.
    const sceneScale = clamp(height / REFERENCE_H, 1, MAX_SCENE_SCALE);
    this._sceneScale = sceneScale;
    // Track sits just below its safety clearance (not centered) — centering left the
    // road floating mid-canvas with an unavoidable dead gap above it (chicken height is
    // a small fraction of a tall flex canvas no matter how much the scene is scaled up).
    // Pinning it near the top instead hands the rest of the height to the ground plane
    // below, which is what actually reads as "the game fills the canvas" — TRACK_Y_EXTRA
    // nudges it down a bit further from that top-pinned line without fully centering it.
    this._trackY = clamp(TOP_CLEARANCE * sceneScale + TRACK_Y_EXTRA, TOP_CLEARANCE, height - 30);
    // +2.5 tile-steps of slack (not +1) so the finish torii past the last lane
    // is fully revealed once the chicken reaches the last lane, not clipped off-screen.
    this._camMin = width - (DEFAULT_LANES + 2.5) * TILE_STEP * sceneScale - width * 0.1;
    this._camMax = width * VIEW_ANCHOR;

    const app = new Application();
    this._app = app;
    await app.init({
      width, height,
      background:  BG_BASE,
      antialias:   true,
      resolution:  window.devicePixelRatio || 1,
      autoDensity: true,
    });
    if (this._destroyed) { app.destroy(true); return; }

    const urls = {
      chickenIdle:     chickenIdleUrl,
      chickenRun:      chickenRunUrl,
      chickenVictory:  chickenVictoryUrl,
      chickenKo:       chickenKoUrl,
      iconShuriken:    iconShurikenUrl,
      iconX:           iconXUrl,
      roadLaneTile:    roadLaneTileUrl,
      roadStartPost:   roadStartPostUrl,
      roadFinishPost:  roadFinishPostUrl,
      pathSandTile:    pathSandTileUrl,
      pathPost:        pathPostUrl,
      badgeMultiplier: badgeMultiplierUrl,
    };
    const entries = await Promise.all(
      Object.entries(urls).map(async ([key, url]) => [key, await Assets.load(url)]),
    );
    this._textures = Object.fromEntries(entries);
    if (this._destroyed) { app.destroy(true); return; }

    const canvas = app.canvas;
    canvas.style.width   = '100%';
    canvas.style.height  = '100%';
    canvas.style.display = 'block';
    containerEl.appendChild(canvas);

    this._buildScene();
    app.ticker.add(this._onTick);
    this._loaded = true;

    // Apply any reset()/update()/setDifficulty() calls that arrived before the scene existed.
    if (this._pendingReset) this.reset();
    if (this._pendingUpdate) this.update(this._pendingUpdate);
    if (this._pendingDifficulty) this.setDifficulty(this._pendingDifficulty);
  }

  // ── Scene ────────────────────────────────────────────────────────────────
  _buildScene() {
    const { stage } = this._app;
    const w = this._w, h = this._h;

    this._buildBackground(stage, w, h);

    const track = new Container();
    track.y = this._trackY;
    track.scale.set(this._sceneScale);
    this._track = track;
    stage.addChild(track);

    // Training posts recur every ~2 lanes as individual sprites, not baked into a tiled
    // texture — sized off the chicken (POST_DISPLAY_H) so they stay proportionate no matter
    // how tall the ground plane behind them grows (see _buildBackground's sand TilingSprite).
    // X-aligned to the same TILE_STEP grid as the tile badges (one lane center per post,
    // every POST_SPACING_LANES lanes) instead of staggered between them.
    const postTex = this._textures.pathPost;
    const postStartX = TILE_STEP;
    const postEndX = (DEFAULT_LANES + 3) * TILE_STEP;
    const postLocalY = (h - this._trackY) * 0.55 / this._sceneScale;
    for (let x = postStartX; x < postEndX; x += TILE_STEP * POST_SPACING_LANES) {
      const post = new Sprite(postTex);
      post.anchor.set(0.5, 0.86);
      post.scale.set(POST_DISPLAY_H / postTex.height);
      post.x = x;
      post.y = postLocalY;
      track.addChild(post);
    }

    // Start-gate post near the start pad — the "poulailler" artwork is a full building
    // (roof, sign, lanterns) with the coop doorway/steps near its base. Doubled in size
    // then shifted up-left off its old anchor so only that lower doorway portion reads
    // on screen and the roof/signage bleed past the canvas edges — reads as "the hen is
    // stepping out of a much bigger coop" rather than a signpost standing next to her.
    const startTex = this._textures.roadStartPost;
    const startPost = new Sprite(startTex);
    startPost.anchor.set(0.5, 0.86);
    startPost.scale.set((POST_REF_H * 1.9 * 2) / startTex.height);
    startPost.x = -TILE_STEP * 0.9;
    startPost.y = -40;
    track.addChild(startPost);

    for (let i = 1; i <= DEFAULT_LANES; i++) {
      const tile = this._makeTileWash(TILE_W, TILE_H);
      tile.x = i * TILE_STEP;
      track.addChild(tile);
      this._tiles.push({ container: tile, state: 'pending' });
    }
    this._setLadder(this._ladder);

    // Finish-gate post — marks the end of the road (DEFAULT_LANES, a soft ceiling nobody
    // should realistically reach) the same way the start post marks the beginning, so the
    // route reads as a defined path rather than an infinite loop.
    const finishTex = this._textures.roadFinishPost;
    const finishPost = new Sprite(finishTex);
    finishPost.anchor.set(0.5, 0.86);
    finishPost.scale.set((POST_REF_H * 1.9) / finishTex.height);
    finishPost.x = DEFAULT_LANES * TILE_STEP + TILE_STEP * 1.15;
    finishPost.y = 6;
    track.addChild(finishPost);

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
    // Sand ground covers the full canvas (not just a strip below the track) so posts always
    // stand on sand instead of straddling a seam between a cream sky and a tinted ground band.
    const ground = new TilingSprite({ texture: this._textures.pathSandTile, width: w, height: h });
    ground.tileScale.set(SAND_TILE_SCALE);
    stage.addChild(ground);
  }

  _makeTileWash(w, h) {
    const c = new Container();
    const wash = new Graphics();
    c.addChild(wash);

    const badge = new Sprite(this._textures.badgeMultiplier);
    badge.anchor.set(0.5);
    badge.scale.set(BADGE_SIZE / badge.texture.width);
    c.addChild(badge);

    const multText = new Text({
      text: '',
      style: { fontFamily: theme.fontBody, fontSize: 11, fontWeight: '700', fill: num(theme.textPrimary) },
    });
    multText.anchor.set(0.5);
    c.addChild(multText);

    let icon = null;
    c._draw = (state) => {
      const v = TILE_VISUALS[state] ?? TILE_VISUALS.pending;
      wash.clear();
      if (v.wash) {
        wash.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: num(v.wash), alpha: v.alpha });
      }
      badge.visible = v.badge;
      multText.visible = v.badge;
      if (icon) { c.removeChild(icon); icon.destroy(); icon = null; }
      if (v.icon && this._textures) {
        icon = new Sprite(this._textures[v.icon]);
        icon.anchor.set(0.5);
        icon.scale.set(24 / icon.texture.width);
        c.addChild(icon);
      }
    };
    c._draw('pending');
    c._multText = multText;
    return c;
  }

  // Recomputes and redraws the multiplier disc on every tile for the given difficulty —
  // called on init, and whenever the player changes difficulty before starting a round.
  _setLadder(ladder) {
    this._ladder = ladder;
    this._tiles.forEach((t, i) => {
      const mult = ladder[i];
      if (mult != null) t.container._multText.text = `${mult.toFixed(2)}x`;
    });
  }

  setDifficulty(key) {
    if (!this._loaded) { this._pendingDifficulty = key; return; }
    const d = DIFFICULTIES[key] ?? DIFFICULTIES.easy;
    this._setLadder(buildMultiplierLadder(d.deathChance, DEFAULT_LANES));
  }

  _buildChicken() {
    const c = new Container();

    const shadow = new Graphics();
    shadow.ellipse(0, 6, 20, 6).fill({ color: 0x1a0e0a, alpha: 0.25 });
    c.addChild(shadow);

    const poseTextures = {
      idle:    this._textures.chickenIdle,
      run:     this._textures.chickenRun,
      victory: this._textures.chickenVictory,
      ko:      this._textures.chickenKo,
    };
    const poses = {};
    for (const [key, tex] of Object.entries(poseTextures)) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1);
      const baseScale = CHICKEN_H / tex.height;
      sprite.scale.set(baseScale);
      sprite.y = 6; // sits a bit above the ground-contact shadow, not flush with it
      sprite.visible = key === 'idle';
      sprite._baseScale = baseScale;
      c.addChild(sprite);
      poses[key] = sprite;
    }

    c._poses = poses;
    c._pose = 'idle';
    return c;
  }

  _setChickenPose(pose) {
    if (this._chicken._pose === pose) return;
    this._chicken._pose = pose;
    for (const [key, sprite] of Object.entries(this._chicken._poses)) {
      sprite.visible = key === pose;
    }
  }

  _updateChickenPose() {
    let pose = 'idle';
    if (this._topple) pose = 'ko';
    else if (this._bounceT !== null) pose = 'victory';
    else if (this._hop) pose = 'run';
    this._setChickenPose(pose);
  }

  _setTileState(index, state) {
    const t = this._tiles[index - 1];
    if (!t) return;
    t.state = state;
    t.container._draw(state);
  }

  // ── Public contract ─────────────────────────────────────────────────────

  // Registers a callback fired whenever a bust/cashout animation starts or
  // finishes — lets the UI keep the "start new round" button disabled until
  // the previous round has actually finished playing out on screen.
  setBusyListener(cb) {
    this._onBusyChange = cb;
  }

  _setBusy(v) {
    if (this._busy === v) return;
    this._busy = v;
    this._onBusyChange?.(v);
  }

  // Called when a brand-new round begins (fresh chicken, fresh tiles).
  reset() {
    if (!this._loaded) { this._pendingReset = true; return; }
    this._pendingReset = false;
    this._tiles.forEach((t, i) => this._setTileState(i + 1, 'pending'));
    this._hop        = null;
    this._topple      = false;
    this._koSquashT    = null;
    // A shuriken can still be mid-flight if a new round is started (or the
    // component remounts) before the previous bust animation finished — drop
    // the sprite from the scene, not just the JS reference, or it's left
    // stuck on screen forever since nothing else will ever remove it.
    if (this._shuriken) {
      this._track.removeChild(this._shuriken.g);
      this._shuriken.g.destroy();
    }
    this._shuriken     = null;
    this._suspenseT    = null;
    this._deathTileX   = null;
    // Same leak risk as the death shuriken above — drop any still-falling
    // near-miss sprites from the scene before starting the new round.
    this._missShurikens.forEach(s => { this._track.removeChild(s.g); s.g.destroy(); });
    this._missShurikens = [];
    this._flash        = 0;
    if (this._app) this._app.renderer.background.color = BG_BASE;
    this._bounceT       = null;
    this._appliedStep   = 0;
    this._appliedStatus = 'idle';
    this._chickenX = 0;
    this._chickenY = 0;
    if (this._chicken) {
      this._chicken.x = 0;
      this._chicken.y = 0;
      const ko = this._chicken._poses.ko;
      ko.scale.set(ko._baseScale);
      ko.y = 6;
      this._setChickenPose('idle');
    }
    this._setBusy(false);
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
      // Near-miss: a shuriken drops on the tile the chicken is leaving, as if it
      // just dodged it — plays alongside the hop, not gating it. Skipped on the
      // very first step: the chicken is leaving the start gate, not a lane tile,
      // so there's nothing to have dodged there.
      if (this._appliedStep > 0) this._throwMissShuriken(this._appliedStep * TILE_STEP);
      this._startHop(step * TILE_STEP);
    }

    if (status === 'busted' && this._appliedStatus !== 'busted') {
      const deathLane = step + 1;
      const targetTileX = deathLane * TILE_STEP;
      this._setTileState(deathLane, 'danger');
      this._deathTileX = targetTileX;
      this._startHop(targetTileX);
      this._setBusy(true);
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
    // A remount (e.g. resize) mid-animation must not leave the "start round"
    // button locked forever — nothing will ever clear _busy for this instance.
    this._setBusy(false);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  _startHop(targetX) {
    this._hop = { fromX: this._chickenX, toX: targetX, t: 0 };
  }

  // Thrown in only once the chicken has landed on the danger tile and the suspense
  // beat has played — falls straight down onto the tile (fromX === toX) so the
  // motion reads as a vertical strike rather than a diagonal throw.
  _throwShuriken(targetTileX) {
    const s = new Sprite(this._textures.iconShuriken);
    s.anchor.set(0.5);
    s.scale.set(32 / s.texture.width);
    this._track.addChild(s);
    this._shuriken = {
      g: s, t: 0,
      fromX: targetTileX, fromY: -190,
      toX: targetTileX,   toY: 0,
    };
  }

  // Cosmetic near-miss: falls straight down onto a tile the chicken already left,
  // independent of the death shuriken above — several can be in flight at once if
  // the player advances quickly, so each lives in its own list entry.
  _throwMissShuriken(tileX) {
    const s = new Sprite(this._textures.iconShuriken);
    s.anchor.set(0.5);
    s.scale.set(32 / s.texture.width);
    s.alpha = 0.85;
    this._track.addChild(s);
    this._missShurikens.push({ g: s, t: 0, x: tileX, fromY: -190, toY: 0 });
  }

  _bounce() {
    this._bounceT = 0;
    this._setBusy(true);
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
        // Death hop landed — hold on the danger tile for a beat before the shuriken
        // is thrown in, instead of firing both at once.
        if (this._deathTileX !== null) this._suspenseT = 0;
      }
    }

    // Suspense beat between the death hop landing and the shuriken throw
    if (this._suspenseT !== null) {
      this._suspenseT += dt * (1000 / 60) / SUSPENSE_MS;
      if (this._suspenseT >= 1) {
        this._suspenseT = null;
        this._throwShuriken(this._deathTileX);
        this._deathTileX = null;
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
        this._topple = true;
        this._koSquashT = 0;
      }
    }

    // Near-miss shuriken flights (survive steps) — independent of the death
    // shuriken above, no flash/topple side effects, just fall and disappear.
    if (this._missShurikens.length) {
      for (let i = this._missShurikens.length - 1; i >= 0; i--) {
        const s = this._missShurikens[i];
        s.t += dt * (1000 / 60) / SHURIKEN_MS;
        const t = clamp(s.t, 0, 1);
        s.g.x = s.x;
        s.g.y = s.fromY + (s.toY - s.fromY) * t;
        s.g.rotation += dt * 0.6;
        if (t >= 1) {
          this._track.removeChild(s.g);
          s.g.destroy();
          this._missShurikens.splice(i, 1);
        }
      }
    }

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 0.06);
      this._app.renderer.background.color = lerpColor(BG_BASE, BG_FLASH, this._flash);
    }

    // One-shot KO squash (replaces the old continuous topple rotation — the KO
    // artwork is already drawn "fallen", stacking a procedural rotation on top
    // of it would double-tilt).
    if (this._koSquashT !== null && this._koSquashT < 1) {
      this._koSquashT = Math.min(1, this._koSquashT + dt * (1000 / 60) / KO_SQUASH_MS);
      const ease = Math.sin(this._koSquashT * Math.PI / 2);
      const ko = this._chicken._poses.ko;
      ko.scale.y = ko._baseScale * (1 - 0.15 * ease);
      ko.y = 6 + 6 * ease;
    }

    // The bust sequence (hop + suspense + shuriken + KO squash) is fully settled once
    // all four finish — only then is it safe to let the player start a new round.
    if (this._busy && this._topple === true && this._hop === null && this._suspenseT === null
        && this._shuriken === null && (this._koSquashT === null || this._koSquashT >= 1)) {
      this._setBusy(false);
    }

    if (this._bounceT !== null) {
      this._bounceT += dt * 0.06;
      if (this._bounceT <= 1) {
        this._chickenY = -Math.sin(Math.PI * this._bounceT) * 14;
      } else {
        this._bounceT = null;
        this._chickenY = 0;
        this._setBusy(false);
      }
    }

    this._chicken.x = this._chickenX;
    this._chicken.y = this._chickenY;
    this._updateChickenPose();

    // Camera follow — chickenX is in the track's local (unscaled) space, so it needs the
    // scene scale applied to match the screen-space camMin/camMax/track.x it's compared against.
    const camTarget = clamp(this._w * VIEW_ANCHOR - this._chickenX * this._sceneScale, this._camMin, this._camMax);
    this._camX += (camTarget - this._camX) * Math.min(1, dt * 0.1);
    this._track.x = this._camX;
  }
}
