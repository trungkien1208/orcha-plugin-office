import type Phaser from "phaser";
import type { Art } from "./Art.ts";
import type { Layout } from "./layout.ts";
import { crisp, fitText } from "./text.ts";
/** Any CSS colour (Project colours are hsl()) as a Phaser number, via the canvas parser. */
const parsed = new Map<string, number>();
export function cssColor(color: string): number {
  const hit = parsed.get(color); if (hit !== undefined) return hit;
  const g = document.createElement("canvas").getContext("2d"); if (!g) return 0x8c96aa;
  g.fillStyle = color; const value = Number.parseInt(String(g.fillStyle).replace("#", ""), 16) || 0x8c96aa;
  parsed.set(color, value); return value;
}
export const STATUS_COLOR = { blocked: 0xffb020, working: 0x3a8fe0, done: 0x2fae6c, idle: 0x1d2747, unknown: 0x8c96aa };
export type Screen = { shape: Phaser.GameObjects.Rectangle; x: number; y: number; width: number; height: number };
export class Room {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private details: Phaser.GameObjects.GameObject[] = [];
  readonly screens = new Map<string, Screen>();
  readonly chairs = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>();
  constructor(private scene: Phaser.Scene, private art: Art) {}
  clear() { for (const item of this.objects) item.destroy(); this.objects = []; this.details=[]; this.screens.clear(); this.chairs.clear(); }
  add<T extends Phaser.GameObjects.GameObject>(item: T): T { this.objects.push(item); return item; }
  draw(layout: Layout, selectProject: (key: string) => void, previous?: Layout, reduced = false) {
    this.clear(); const s = this.scene, { width, height } = layout;
    const floor = this.art.object("tiles", "floor");
    this.add(floor ? s.add.tileSprite(0, 0, width, height, floor).setOrigin(0) : s.add.rectangle(0, 0, width, height, 0xc9d8d4).setOrigin(0));
    this.add(s.add.rectangle(16, 192, width - 32, height - 208, 0xc9d8d4).setOrigin(0).setStrokeStyle(1, 0x2f3a4f));
    if (floor) this.add(s.add.tileSprite(17, 193, width - 34, height - 210, floor).setOrigin(0));
    for (let y = 208; y < height - 144; y += 32) this.add(this.art.image("tiles", "aisle", width / 2 - 16, y));
    if(this.art.theme!=="office")for(let y=192;y<height-32;y+=32)for(let x=32;x<width-32;x+=32){const seed=(x*17+y*31)>>>0;if(seed%100<12)this.add(this.art.image("tiles",["floorWear","floorDirty","floorCracked"][seed%3]??"floorWear",x,y));}
    if(this.art.theme!=="office")for(let y=208;y<height-144;y+=32)for(const x of [width/2-40,width/2+32])this.add(this.art.image("objects","floorTape",x,y));
    for (const b of layout.benches) {
      const was = previous?.benches.find((bench) => bench.id === b.id);
      const burning = b.closed && !reduced && !!was && !was.closed;
      const ash = b.closed ? this.ash(b.x, b.y, burning) : null;
      const start = this.objects.length;
      if (!b.closed || burning) {
      this.add(this.art.image("objects", "benchL", b.x, b.y, 32, 48));
      for (let n = 0; n < b.seats; n++) {
        const x = b.x + 32 + n * 32, slot = `${b.id}:${n}`;
        this.add(this.art.image("objects", "benchM", x, b.y, 32, 48));
        const rect = this.art.bank.manifest.layout?.monitor?.screen ?? { x: 4, y: 4, width: 24, height: 12 };
        const screen = this.add(s.add.rectangle(x + rect.x, b.y - 4 + rect.y, rect.width, rect.height, STATUS_COLOR.idle).setOrigin(0));
        this.screens.set(slot, { shape: screen, x: screen.x, y: screen.y, width: rect.width, height: rect.height });
        this.add(this.art.image("objects", "monitor", x, b.y - 4, 32, 24));
        this.add(this.art.image("objects", "phoneRack", x - 2, b.y + 15, 16, 16));
        const clutter = this.art.bank.manifest.objects?.clutter;
        const phone = clutter && !Array.isArray(clutter) && typeof clutter === "object" ? clutter.phone : undefined;
        if (phone && this.art.bank.images.has(phone)) { const key = `asset:${phone}`; if (!s.textures.exists(key)) s.textures.addImage(key, this.art.bank.images.get(phone) as HTMLImageElement); this.add(s.add.image(x + 17, b.y + 16, key).setOrigin(0)); }
        if(this.art.theme==="office"&&layout.desks.some(d=>d.benchId===b.id&&d.index===n))this.add(this.art.image("objects","deskLamp",x+16,b.y+24)).setDepth(b.y+48);
        if(this.art.theme!=="office"){
          const items=["phoneTray","laptopOpen","simCards","cashSmall","snackPack","ashtray","nameCard","batteryLamp","mug","noodleCup","energyDrink","papers","deskFan"];
          const seed=b.team*17+n*7;for(let i=0;i<1+seed%2;i++){const name=items[(seed+i*3)%items.length];if(name){const key=this.art.strip("objects",name,name==="deskFan"?16:16,name==="deskFan"?24:16);if(key)this.add(s.add.image(x+2+i*15,b.y+30,key,0).setOrigin(0).setScale(.65));}}
        }
        const chair = this.add(this.art.image("objects", layout.desks.some((d) => d.benchId === b.id && d.index === n) ? "chairBack" : "chairFront", x, b.y + 40, 32, 32)).setDepth(b.y + 69); this.chairs.set(slot, chair);
      }
      this.add(this.art.image("objects", "benchR", b.x + 32 + b.seats * 32, b.y, 32, 48));
      }
      if (burning) this.burn(b.x, b.y, this.objects.slice(start), ash);
      this.details.push(...this.objects.slice(start));
      const tagWidth = b.width - 16, signY = b.y - 30, ceiling = height + 60;
      // Hanging sign over the monitors, drawn at ceiling level so the Boss walks under it, not over the text.
      const faceY = this.sign(b.x + 8, signY, tagWidth, b.closed ? null : b.project.projectColor, ceiling);
      const label = this.add(crisp(s, b.x + 8 + tagWidth / 2, faceY, `TEAM ${String(b.team).padStart(2, "0")} · ${b.label}`, 10, b.closed ? "#c9ccd2" : "#ffffff")).setOrigin(0.5).setFontFamily("'Chakra Petch', sans-serif").setFontStyle("700").setStroke("#1d2742", 3).setDepth(ceiling + 2);
      fitText(label, tagWidth - 10);
      this.add(s.add.zone(b.x + 8, signY, tagWidth, 18).setOrigin(0).setDepth(ceiling + 3).setInteractive({ useHandCursor: true }).on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); selectProject(b.project.workspaceId); }));
      const before = previous?.benches.find((bench)=>bench.id===b.id);
      if (before && !reduced && (before.x!==b.x || before.y!==b.y)) for (const item of this.objects.slice(start)) {
        const point = item as Phaser.GameObjects.Image;
        const x=point.x,y=point.y; point.setPosition(x+before.x-b.x,y+before.y-b.y);
        s.tweens.add({targets:point,x,y,duration:450,ease:"Sine.easeInOut"});
      }
    }
  }
  /** Ash heap with blinking embers where a closed Project's Bench stood. */
  private ash(x: number, y: number, hidden: boolean): Phaser.GameObjects.GameObject {
    // Cozy Office leaves covered desks ("boxes") where the Compound leaves ash.
    const key = (this.art.theme === "office" ? this.art.strip("objects", "boxes", 144, 48) : null) ?? this.art.sheet("objects", "benchAsh");
    if (!key) return this.add(this.art.image("objects", "benchAsh", x + 24, y + 24, 144, 48)).setDepth(y + 1).setAlpha(hidden ? 0 : 1);
    const heap = this.add(this.scene.add.sprite(x + 24, y + 8, key, 0).setOrigin(0).setDepth(y + 1).setAlpha(hidden ? 0 : 1));
    return this.art.play(heap, key, 2);
  }
  /** Sparks catch, the whole Bench burns with smoke and an alarm, caves in, and the ash stays. Cartoon only. */
  private burn(x: number, y: number, furniture: Phaser.GameObjects.GameObject[], ash: Phaser.GameObjects.GameObject | null) {
    if (this.art.theme === "office") return this.pack(x, y, furniture, ash);
    const s = this.scene, art = this.art, depth = y + 300, temp: Phaser.GameObjects.GameObject[] = [];
    const sprite = (group: "objects" | "ui", name: string, sx: number, sy: number, rate: number, repeat = -1) => {
      const key = art.sheet(group, name);
      if (!key) return null;
      const item = s.add.sprite(sx, sy, key, 0).setOrigin(0).setDepth(depth);
      temp.push(item);
      return art.play(item, key, rate, repeat);
    };
    const alarm = sprite("objects", "fireAlarm", x - 4, y - 28, 4);
    alarm?.setDepth(y + 1);
    const ignite = sprite("objects", "benchIgnite", x + 24, y - 16, 8, 0);
    s.time.delayedCall(500, () => {
      ignite?.destroy();
      sprite("objects", "benchFire", x + 24, y - 32, 10);
      sprite("ui", "fxSmokeColumn", x + 72, y - 120, 6);
      sprite("ui", "fxEmbers", x + 20, y - 40, 6);
      sprite("ui", "fxEmbers", x + 140, y - 30, 5);
    });
    s.time.delayedCall(2300, () => {
      for (const item of furniture) if (item.active) s.tweens.add({ targets: item, alpha: 0, duration: 450 });
      for (const item of temp) if (item.active && item !== alarm) s.tweens.add({ targets: item, alpha: 0, duration: 500, onComplete: () => item.destroy() });
      sprite("objects", "benchCollapse", x + 24, y - 16, 6, 0);
    });
    s.time.delayedCall(3000, () => {
      if (ash?.active) s.tweens.add({ targets: ash, alpha: 1, duration: 300 });
      for (const item of temp) if (item.active) s.tweens.add({ targets: item, alpha: 0, duration: 300, onComplete: () => item.destroy() });
    });
  }
  /** Cozy Office: the lamps go off and a cloth is laid over the desks; no fire. */
  private pack(x: number, y: number, furniture: Phaser.GameObjects.GameObject[], ash: Phaser.GameObjects.GameObject | null) {
    const s = this.scene, key = this.art.strip("objects", "benchPack", 144, 64);
    const cloth = key ? this.art.play(this.add(s.add.sprite(x + 24, y - 16, key, 0).setOrigin(0).setDepth(y + 300)), key, 5, 0) : null;
    s.time.delayedCall(700, () => { for (const item of furniture) if (item.active) s.tweens.add({ targets: item, alpha: 0, duration: 400 }); });
    s.time.delayedCall(1000, () => {
      if (ash?.active) s.tweens.add({ targets: ash, alpha: 1, duration: 300 });
      if (cloth?.active) s.tweens.add({ targets: cloth, alpha: 0, duration: 300, onComplete: () => cloth.destroy() });
    });
  }
  /** Team sign on two chains: grey face tinted per Project, or scorched once the Project is closed. Returns the face's centre y. */
  private sign(x: number, y: number, width: number, color: string | null, depth: number): number {
    const s = this.scene, key = this.art.object("objects", "teamSignHanging"), slice = this.art.bank.manifest.layout?.teamSignHanging;
    if (!key || !slice) {
      for (const sx of [x + 12, x + width - 12]) this.add(s.add.rectangle(sx, y - 14, 2, 14, 0x1d2742).setOrigin(0.5, 0).setDepth(depth));
      const tag = this.tag(color ?? "#8c96aa", width);
      if (tag) this.add(s.add.image(x, y, tag).setOrigin(0).setDepth(depth + 1));
      else this.add(s.add.rectangle(x, y, width, 18, 0xffffff).setOrigin(0).setStrokeStyle(1, 0x2f3a4f).setDepth(depth + 1));
      return y + 8;
    }
    const top = y - 14, face = slice.tint ?? { x: 4, y: 14, width: 88, height: 12 };
    this.add(s.add.nineslice(x, top, key, undefined, width, 32, slice.left, slice.right, slice.top, slice.bottom).setOrigin(0).setDepth(depth));
    const burnt = color ? null : (this.art.theme === "office" ? this.art.object("ui", "tagClosed") : null) ?? this.art.object("ui", "tagBurnt");
    if (burnt) this.add(s.add.nineslice(x + face.x, top + face.y - 2, burnt, undefined, width - 8, 16, 8, 8, 4, 4).setOrigin(0).setDepth(depth + 1));
    else if (color) this.add(s.add.rectangle(x + face.x, top + face.y, width - 8, face.height, cssColor(color), 0.9).setOrigin(0).setDepth(depth + 1));
    return top + face.y + face.height / 2;
  }
  setFar(far: boolean) { for(const item of this.details) (item as Phaser.GameObjects.Image).setVisible(!far); }
  private tag(color: string, width: number): string | null {
    const path = this.art.bank.manifest.objects?.benchTag, maskPath = this.art.bank.manifest.objects?.benchTagPolo;
    if (typeof path !== "string") return null;
    const base = this.art.bank.images.get(path), mask = typeof maskPath === "string" ? this.art.bank.images.get(maskPath) : undefined; if (!base) return null;
    const key = `tag:${width}:${color}`; if (this.scene.textures.exists(key)) return key;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = 16; const g = canvas.getContext("2d"); if (!g) return null; g.imageSmoothingEnabled = false;
    const paint = (image: HTMLImageElement | HTMLCanvasElement) => { g.drawImage(image, 0, 0, 4, 16, 0, 0, 4, 16); g.drawImage(image, 4, 0, 56, 16, 4, 0, width - 8, 16); g.drawImage(image, 60, 0, 4, 16, width - 4, 0, 4, 16); };
    paint(base);
    if (mask) { const layer = document.createElement("canvas"); layer.width = 64; layer.height = 16; const m = layer.getContext("2d"); if (m) { m.drawImage(mask, 0, 0); m.globalCompositeOperation = "multiply"; m.fillStyle = color; m.fillRect(0, 0, 64, 16); m.globalCompositeOperation = "destination-in"; m.drawImage(mask, 0, 0); paint(layer); } }
    this.scene.textures.addCanvas(key, canvas); return key;
  }
}
