import type Phaser from "phaser";
import { artPath, composite, themedSheet, type ArtBank } from "./manifest.ts";
import { nearestFrame } from "./frames.ts";
import { paintBoss, paintWorker } from "./placeholders.ts";
export class Art {
  /** "office" when the Cozy Office theme is on; default art otherwise. */
  theme: string | undefined;
  constructor(readonly scene: Phaser.Scene, readonly bank: ArtBank) {}
  object(group: "objects" | "tiles" | "ui" | "backgrounds", name: string): string | null {
    const path = artPath(this.bank, group, name, this.theme), image = path ? this.bank.images.get(path) : undefined; if (!image || !path) {
      if (name !== "monitor") return null;
      const key = "fallback:monitor"; if (!this.scene.textures.exists(key)) {
        const c = document.createElement("canvas"); c.width = 32; c.height = 24; const g = c.getContext("2d");
        if (g) { g.fillStyle = "#2f3a4f"; g.fillRect(0,0,32,18); g.clearRect(4,4,24,12); g.fillRect(14,18,4,4); g.fillRect(8,22,16,2); }
        this.scene.textures.addCanvas(key,c);
      } return key;
    }
    const key = `asset:${path}`; if (!this.scene.textures.exists(key)) this.scene.textures.addImage(key, image); return key;
  }
  image(group: "objects" | "tiles" | "ui" | "backgrounds", name: string, x: number, y: number, width = 32, height = 32): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    const key = this.object(group, name); if (key) return this.scene.add.image(x, y, key).setOrigin(0, 0);
    return this.scene.add.rectangle(x, y, width, height, name.includes("chair") ? 0x2a2f38 : 0xdfe5e4).setOrigin(0, 0).setStrokeStyle(1, 0x2f3a4f);
  }
  character(skin: string, color: string, boss = false): string {
    const themed = boss ? themedSheet(this.bank, this.theme, "boss") : undefined;
    const key = `character:${boss ? `boss:${themed ? this.theme : "default"}` : skin}:${color}`; if (this.scene.textures.exists(key)) return key;
    const entry = boss ? this.bank.manifest.characters?.boss : this.bank.manifest.characters?.skins?.[skin];
    const sheet = themed ?? entry?.sheet;
    const base = sheet ? this.bank.images.get(sheet) : undefined, mask = entry?.polo && !themed ? this.bank.images.get(entry.polo) : undefined;
    const canvas = base ? composite(base, mask, color) : boss ? paintBoss() : paintWorker(color);
    const texture = this.scene.textures.addCanvas(key, canvas); if (!texture) return "__MISSING";
    const fw = this.bank.manifest.characters?.frame?.width ?? 48, fh = this.bank.manifest.characters?.frame?.height ?? 72;
    const declared = this.bank.manifest.characters?.frame;
    const cols = Math.max(1, Math.min(declared?.columns ?? 4, Math.floor(canvas.width / fw))), rows = Math.max(1, Math.min((boss ? this.bank.manifest.characters?.bossRows : declared?.rows) ?? (boss ? 10 : 9), Math.floor(canvas.height / fh)));
    for (let n = 0; n < cols * rows; n++) texture.add(n, 0, n % cols * fw, Math.floor(n / cols) * fh, fw, fh);
    return key;
  }
  /** The HR bouncer sheet (not tinted). Falls back to the Boss placeholder. */
  bouncer(): string {
    const themed = themedSheet(this.bank, this.theme, "bouncer"), key = `character:bouncer:${themed ? this.theme : "default"}`;
    if (this.scene.textures.exists(key)) return key;
    const entry = this.bank.manifest.characters?.bouncer, sheet = themed ?? entry?.sheet, base = sheet ? this.bank.images.get(sheet) : undefined;
    const canvas = base ? composite(base, undefined, "#2a2f38") : paintBoss();
    const texture = this.scene.textures.addCanvas(key, canvas);
    if (!texture) return "__MISSING";
    const fw = 48, fh = 72, cols = Math.max(1, Math.floor(canvas.width / fw)), rows = Math.max(1, Math.floor(canvas.height / fh));
    for (let n = 0; n < cols * rows; n++) texture.add(n, 0, n % cols * fw, Math.floor(n / cols) * fh, fw, fh);
    return key;
  }
  /** A sheet of equal frames (fire, poof, smoke), split left to right, top to bottom. Returns null when the art is missing. */
  strip(group: "objects" | "ui", name: string, fw: number, fh: number): string | null {
    const key = this.object(group, name);
    if (!key) return null;
    const texture = this.scene.textures.get(key);
    if (texture.frameTotal <= 1) {
      const source = texture.getSourceImage() as HTMLImageElement, cols = Math.floor(source.width / fw), rows = Math.floor(source.height / fh);
      for (let n = 0; n < cols * rows; n++) texture.add(n, 0, (n % cols) * fw, Math.floor(n / cols) * fh, fw, fh);
    }
    return key;
  }
  /** A sheet whose frame size is declared in manifest layout.animations. */
  sheet(group: "objects" | "ui", name: string): string | null {
    const frame = this.bank.manifest.layout?.animations?.[name]?.frame;
    return frame ? this.strip(group, name, frame.width, frame.height) : null;
  }
  /** Loop (or play once) every frame of a sheet on a sprite; Phaser stops it when the sprite is destroyed. */
  play(sprite: Phaser.GameObjects.Sprite, key: string, rate: number, repeat = -1, frames?: number[]) {
    if((this.scene as Phaser.Scene & {reduced?:boolean}).reduced)return sprite.setFrame(0);
    const id = `anim:${key}:${rate}:${repeat}:${frames?.join(",") ?? "all"}`;
    if (!this.scene.anims.exists(id)) {
      const all = this.scene.textures.get(key).getFrameNames().map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      this.scene.anims.create({ key: id, frames: (frames ?? all).map((frame) => ({ key, frame })), frameRate: rate, repeat });
    }
    return sprite.play(id);
  }
  frame(key: string, requested: number): number { const texture = this.scene.textures.get(key); return nearestFrame(requested, texture.getFrameNames().map(Number).filter(Number.isFinite)); }
}
