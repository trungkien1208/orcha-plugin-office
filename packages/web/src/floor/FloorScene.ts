import Phaser from "phaser";
import { Art } from "./Art.ts";
import { peopleOf, type FloorHud, type FloorInput, type Person } from "./contract.ts";
import { layoutFloor, emptyLayoutMemory, EXTERIOR, FIRST_BENCH_Y, type Desk, type Layout } from "./layout.ts";
import type { ArtBank } from "./manifest.ts";
import { refreshText } from "./text.ts";
import { Statuses } from "./Statuses.ts";
import { Room, STATUS_COLOR } from "./Room.ts";
import { route, advance, type Route } from "./motion.ts";
import { FloorKeyboard } from "./Keyboard.ts";
import { Boss } from "./Boss.ts";
import { FloorCamera, WORLD_WIDTH } from "./Camera.ts";
import { Bouncers } from "./Bouncers.ts";
import { OfficeCat } from "./Cat.ts";
import { Wall } from "./Wall.ts";
import { FloorSound } from "./Sound.ts";
export type Worker = { person: Person; desk: Desk; sprite: Phaser.GameObjects.Sprite; zone: Phaser.GameObjects.Zone; phase: "seated" | "entering" | "leaving"; reactionUntil?: number; route?: Route };
export class FloorScene extends Phaser.Scene {
  dataInput: FloorInput | null = null;
  onHud: (hud: FloorHud) => void = () => undefined;
  art!: Art;
  room!: Room;
  wall!: Wall;
  statuses!: Statuses;
  controls!: FloorCamera;
  actions!: Boss;
  keysControl!: FloorKeyboard;
  get reduced() { return this.dataInput?.settings.calm || (this.dataInput?.settings.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches); }
  localSound = new FloorSound();
  private totals: Record<string,number> = {};
  private previous = new Map<string,string>();
  layout: Layout | null = null;
  workers = new Map<string, Worker>();
  bouncers = new Bouncers(this);
  cat: OfficeCat = new OfficeCat(this);
  private hp?: Phaser.GameObjects.Graphics;
  boss?: Phaser.GameObjects.Sprite;
  protected ready = false;
  private signature = "";
  private memory = emptyLayoutMemory();
  private initialized = false;
  private pendingSync = false;
  constructor(private bank: ArtBank, readonly keyTarget: HTMLElement, readonly dpr = 1) { super("easy-job-floor"); }
  create() {
    this.art = new Art(this, this.bank); this.room = new Room(this, this.art); this.wall = new Wall(this,this.art); this.statuses = new Statuses(this,this.art);
 this.hp = this.add.graphics().setDepth(94000); this.ready = true;
    this.cameras.main.setRoundPixels(true); this.input.on("pointerdown", () => { this.keyTarget.focus({ preventScroll: true }); this.localSound.unlock(); });
    this.controls = new FloorCamera(this,this.keyTarget,this.dpr); this.actions=new Boss(this); this.keysControl=new FloorKeyboard(this,this.keyTarget);
    if (this.dataInput) this.sync();
    void document.fonts.ready.then(() => { if (this.sys.isActive()) for (const item of this.children.list) if (item instanceof Phaser.GameObjects.Text) { refreshText(item,this.controls.zoom); } });
    this.events.once("shutdown", () => { this.ready = false; this.workers.clear(); this.localSound.destroy(); this.controls.destroy(); this.bouncers.destroy(); this.cat.destroy(); this.keysControl.destroy(); });
    this.onHud({ near: null, zoom: 1, ready: true });
  }
  teamFlight(from:string,to:string){
    if(!this.ready||this.reduced)return;
    const source=[...this.workers.values()].find(w=>w.person.paneId===from),target=[...this.workers.values()].find(w=>w.person.paneId===to);
    if(!source||!target||source.phase!=="seated"||target.phase!=="seated")return;
    const key=this.art.strip("ui","fxPaperPlane",16,16);if(!key)return;
    const plane=this.add.sprite(source.sprite.x,source.sprite.y-42,key,0).setDepth(95000).setFlipX(target.sprite.x<source.sprite.x);
    this.tweens.add({targets:plane,x:target.sprite.x,y:target.sprite.y-42,duration:650,onUpdate:tween=>{if(this.reduced){plane.destroy();tween.stop();return;}plane.setFrame(Math.min(3,Math.floor(tween.progress*4)));},onComplete:()=>plane.destroy()});
  }
  resize() { if (this.ready) { this.controls.fit(); this.sync(); } }
  setInput(data: FloorInput) { this.dataInput = data; if (this.ready) this.sync(); }
  update(time: number, delta: number) {
    this.keysControl.update(delta); this.controls.update(time);
    for(const worker of this.workers.values()) if(worker.route) {
      const point=worker.route.points[0],dx=(point?.x??worker.sprite.x)-worker.sprite.x,dy=(point?.y??worker.sprite.y)-worker.sprite.y;
      worker.sprite.setFrame(this.art.frame(worker.sprite.texture.key,(Math.abs(dx)>Math.abs(dy)?4:dy<0?8:0)+Math.floor(time/130)%4)); worker.sprite.setFlipX(Math.abs(dx)>Math.abs(dy)&&dx>0); advance(worker.sprite,worker.route,delta); worker.sprite.setDepth(worker.sprite.y); worker.zone.setPosition(worker.sprite.x,worker.sprite.y);
    }
    if (this.dataInput) this.wall.update(time,this.dataInput,this.totals,this.reduced);
    for(const worker of this.workers.values()) worker.zone.setPosition(worker.sprite.x,worker.sprite.y);
    if (this.layout && this.dataInput) this.statuses.update(time,this.workers,this.layout,this.room,this.reduced,this.controls.zoom<this.controls.fitZoom*0.99);
    this.actions.update(time,delta);
    this.bouncers.update(time,delta);
    this.cat.update(time,delta);
    this.drawHp();
  }
  private bars = new Map<string, { bar: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image }>();
  /** HP bar = account fuel left, over every seated worker's head: green, gold under 40 %, red under 15 %. */
  private drawHp() {
    const fuel = this.dataInput?.settings.fuel, barKey = this.art.object("ui", "hpBar"), fillKey = this.art.sheet("ui", "hpFill");
    const spec = this.art.bank.manifest.layout?.hpBar?.fill ?? { x: 4, y: 2, width: 24, height: 4 }, seen = new Set<string>();
    const hp = this.hp; hp?.clear();
    for (const worker of this.workers.values()) {
      const left = fuel?.[worker.person.key];
      if (left === undefined || worker.phase !== "seated") continue;
      const x = Math.round(worker.sprite.x - 16), y = Math.round(worker.sprite.y - 82), tier = left < 15 ? 2 : left < 40 ? 1 : 0;
      if (!barKey || !fillKey) { hp?.fillStyle(0x000000, 0.85).fillRect(x + 2, y + 1, 28, 5); hp?.fillStyle([0x3fbf86, 0xffb020, 0xe0443f][tier] ?? 0x3fbf86, 1).fillRect(x + 3, y + 2, Math.max(1, Math.round(26 * left / 100)), 3); continue; }
      seen.add(worker.person.key);
      let item = this.bars.get(worker.person.key);
      if (!item) { item = { bar: this.add.image(0, 0, barKey).setOrigin(0).setDepth(94000), fill: this.add.image(0, 0, fillKey, 0).setOrigin(0).setDepth(94001) }; this.bars.set(worker.person.key, item); }
      item.bar.setPosition(x, y);
      item.fill.setFrame(tier).setTint(tier === 0 ? 0x3fbf86 : 0xffffff).setPosition(x + spec.x, y + spec.y).setCrop(0, 0, Math.max(1, Math.round(spec.width * left / 100)), spec.height);
    }
    for (const [key, item] of this.bars) if (!seen.has(key)) { item.bar.destroy(); item.fill.destroy(); this.bars.delete(key); }
  }
  protected sync() {
    const data = this.dataInput; if (!data) return;
    const people = peopleOf(data.office);
    if ([...this.workers.values()].some((w)=>w.phase==="leaving")) { this.pendingSync=true; return; }
    const live=new Set(people.map((p)=>p.key));
    const removed=[...this.workers.values()].filter((w)=>!live.has(w.person.key));
    if(removed.length && this.layout) { this.pendingSync=true; for(const worker of removed) this.depart(worker); return; }
    const previousLayout=this.layout;
    this.layout = layoutFloor(data.office.projects, people, this.memory, WORLD_WIDTH, this.keyTarget.clientHeight/this.controls.fitZoom); this.memory = this.layout.memory;
    this.art.theme = data.settings.theme === "office" ? "office" : undefined;
    const signature = JSON.stringify([this.art.theme ?? "compound", !!this.reduced, this.layout.width,this.layout.height,this.layout.benches.map((b) => [b.id,b.team,b.label,b.project.projectColor])]);
    if (signature !== this.signature) { this.signature = signature; this.room.draw(this.layout, (id) => this.dataInput?.callbacks.onSelectProject?.(id),previousLayout??undefined,this.reduced); this.wall.draw(this.layout); this.cameras.main.setBounds(0,-EXTERIOR,this.layout.width,this.layout.height+EXTERIOR); if(!this.initialized) this.cameras.main.centerOn(this.layout.width/2,-EXTERIOR/2); }
    for (const person of people) {
      if (person.status === "done" && this.previous.get(person.key) && this.previous.get(person.key) !== "done") {
        this.totals[person.projectId] = (this.totals[person.projectId] ?? 0)+1;
        if (this.time.now - this.wall.strikeAt >= 2000) { this.wall.strikeAt = this.time.now; this.localSound.play("gong",!!data.settings.muted,data.settings.doneSoundUrl); }
      } this.previous.set(person.key,person.status);
    }
    for (const person of people) {
      const desk = this.layout.desks.find((d) => d.key === person.key); if (!desk) continue; const texture = this.art.character(person.skin, person.color); let worker = this.workers.get(person.key);
      if (!worker) {
        const sprite = this.add.sprite(desk.x, desk.y, texture, this.art.frame(texture, 16)).setOrigin(0.5, 1);
        const zone = this.add.zone(desk.x, desk.y, 30, 56).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
        zone.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.dataInput?.callbacks.onSelectAgent?.(person.key); const target=this.workers.get(person.key)?.desk.approach; if(target) this.actions.walk(target.x*32+16,target.y*32+20); });
        worker = { person, desk, sprite, zone, phase: "seated" }; this.workers.set(person.key, worker);
        if(this.initialized && !this.reduced) {
          const item = worker;
          item.phase="entering"; item.zone.disableInteractive();
          item.sprite.setVisible(false);
          this.bouncers.bring(item, () => { if (item.phase !== "leaving") item.phase = "seated"; });
        }
      }
      const oldDesk=worker.desk; worker.person = person; worker.desk = desk;
      if (worker.phase === "seated") worker.sprite.setTexture(texture, this.art.frame(texture, 16)).setDepth(desk.y);
      else worker.sprite.setTexture(texture).setDepth(Math.max(desk.y, worker.sprite.depth));
      if(worker.phase==="seated") {
        if(oldDesk.x!==desk.x||oldDesk.y!==desk.y) { this.tweens.killTweensOf(worker.sprite); this.tweens.add({targets:worker.sprite,x:desk.x,y:desk.y,duration:this.reduced?0:450,ease:"Sine.easeInOut"}); }
        else worker.sprite.setPosition(desk.x,desk.y);
      } else if(worker.phase==="entering"&&worker.route) worker.route.points=route(this.layout.grid,worker.sprite,{x:desk.approach.x*32+16,y:desk.approach.y*32+16}); worker.zone.setPosition(desk.x, desk.y).setDepth(this.layout.height + 10);
      this.room.screens.get(`${desk.benchId}:${desk.index}`)?.shape.setFillStyle(STATUS_COLOR[person.status]);
    }
    this.cat.sync(this.art.theme === "office");
    this.controls.refresh(); this.controls.focus(data.selected);
    this.initialized=true;
    const bossKey = this.art.character("boss", "#2a2f38", true);
    if (!this.boss) this.boss = this.add.sprite(this.layout.width / 2, FIRST_BENCH_Y + 64, bossKey, 0).setOrigin(0.5, 1).setDepth(this.layout.height);
    else if (this.boss.texture.key !== bossKey) this.boss.setTexture(bossKey, 0);
  }
  private depart(worker: Worker) {
    if (!this.layout) return; worker.phase="leaving"; worker.zone.disableInteractive(); worker.sprite.setFrame(this.art.frame(worker.sprite.texture.key,26)).setFlipX(false);
    const finish=()=>{worker.route=undefined; this.tweens.add({targets:worker.sprite,alpha:0,duration:this.reduced?0:220,onComplete:()=>{worker.sprite.destroy();worker.zone.destroy();this.workers.delete(worker.person.key); if(![...this.workers.values()].some((w)=>w.phase==="leaving")&&this.pendingSync){this.pendingSync=false;this.sync();}}});};
    this.time.delayedCall(this.reduced?0:200,()=>{ const place=this.bouncers.cancelBring(worker); if(this.reduced || place==="queued") finish(); else this.bouncers.carry(worker,finish); });
  }

}
