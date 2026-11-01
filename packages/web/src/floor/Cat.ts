import type Phaser from "phaser";
import type { FloorScene } from "./FloorScene.ts";
import { advance, route, type Route } from "./motion.ts";

// office-cat.png: 4×3 frames of 32×32: walk, sit and groom, sleep.
const WALK = [0, 1, 2, 3], SIT = [4, 5, 6, 7], SLEEP = [8, 9, 10, 11];

/** Cozy Office only: a cat wanders to a free tile, sits or naps, then wanders again. Purely decorative. */
export class OfficeCat {
  private sprite?: Phaser.GameObjects.Sprite;
  private path?: Route;
  private rest: { frames: number[]; until: number } | null = null;

  constructor(private scene: FloorScene) {}

  /** Texture from themes.office.characters.officeCat (or objects.officeCat); null when Codex has not drawn it. */
  private texture(): string | null {
    const theme = this.scene.art.bank.manifest.themes?.office, raw = theme?.characters?.officeCat ?? theme?.objects?.officeCat;
    const path = typeof raw === "string" ? raw : (raw as { sheet?: string } | undefined)?.sheet, image = path ? this.scene.art.bank.images.get(path) : undefined;
    if (!path || !image) return null;
    const key = `asset:${path}`;
    if (!this.scene.textures.exists(key)) {
      const texture = this.scene.textures.addImage(key, image);
      for (let n = 0; n < 12; n++) texture?.add(n, 0, (n % 4) * 32, Math.floor(n / 4) * 32, 32, 32);
    }
    return key;
  }

  sync(on: boolean) {
    if (!on) { this.destroy(); return; }
    if (this.sprite) return;
    const key = this.texture(), layout = this.scene.layout;
    if (!key || !layout) return;
    const start = this.freeTile();
    if (!start) return;
    this.sprite = this.scene.add.sprite(start.x, start.y, key, 4).setOrigin(0.5, 1);
    this.rest = { frames: SIT, until: this.scene.time.now + 3000 };
  }

  private freeTile(): { x: number; y: number } | null {
    const grid: boolean[][] | undefined = this.scene.layout?.grid;
    if (!grid) return null;
    for (let tries = 0; tries < 40; tries++) {
      const y: number = 7 + Math.floor(Math.random() * Math.max(1, grid.length - 9));
      const row: boolean[] | undefined = grid[y];
      const x = 1 + Math.floor(Math.random() * Math.max(1, (row?.length ?? 2) - 2));
      if (row && row[x] === false && !this.scene.layout?.desks.some(d=>d.approach.x===x&&d.approach.y===y) && !(this.scene.layout?.door.x===x&&this.scene.layout.door.y===y)) return { x: x * 32 + 16, y: y * 32 + 24 };
    }
    return null;
  }

  update(time: number, delta: number) {
    const cat = this.sprite, layout = this.scene.layout;
    if (!cat || !layout) return;
    cat.setDepth(cat.y);
    if(this.scene.reduced){cat.setFrame(0);return;}
    if (this.rest) {
      const frames = this.rest.frames;
      cat.setFrame(frames[Math.floor(time / (frames === SLEEP ? 600 : 300)) % frames.length] ?? 4);
      if (time < this.rest.until) return;
      this.rest = null;
      const target = this.freeTile();
      if (target) this.path = { points: route(layout.grid, cat, target), speed: 45, done: () => undefined };
      return;
    }
    const point = this.path?.points[0];
    if (!this.path || !point) {
      const nap = Math.random() < 0.4;
      this.rest = { frames: nap ? SLEEP : SIT, until: time + (nap ? 9000 + Math.random() * 8000 : 2500 + Math.random() * 3000) };
      return;
    }
    cat.setFrame(WALK[Math.floor(time / 160) % 4] ?? 0).setFlipX(point.x > cat.x);
    if (this.scene.reduced) { cat.setPosition(point.x, point.y); this.path.points.shift(); return; }
    advance(cat, this.path, delta);
  }

  destroy() {
    this.sprite?.destroy();
    this.sprite = undefined;
    this.path = undefined;
    this.rest = null;
  }
}
