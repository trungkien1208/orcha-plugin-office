import type Phaser from "phaser";
import type { FloorScene, Worker } from "./FloorScene.ts";
import { advance, route, type Route } from "./motion.ts";

type Mover = { sprite: Phaser.GameObjects.Sprite; side: "left" | "right"; route?: Route };
type Request = { kind: "in" | "out"; worker: Worker; done: () => void };
type Job = Request & { movers: [Mover, Mover]; phase: "coming" | "grabbing" | "carrying" | "dropping" | "returning" | "tossing"; door?: Phaser.GameObjects.Sprite };

/** At most `limit` pairs on the floor; the rest wait and start in order. */
export function createPairQueue<T>(limit = 2) {
  let active = 0;
  const waiting: T[] = [];
  return {
    get active() { return active; },
    get waiting() { return waiting.length; },
    take(item: T): boolean {
      if (active >= limit) { waiting.push(item); return false; }
      active += 1;
      return true;
    },
    release(): T | undefined {
      active = Math.max(0, active - 1);
      const next = waiting.shift();
      if (next) active += 1;
      return next;
    },
    /** Remove a job that is still waiting. An active slot is released by `release`. */
    drop(match: (item: T) => boolean): boolean {
      const index = waiting.findIndex(match);
      if (index < 0) return false;
      waiting.splice(index, 1);
      return true;
    },
    clear() { active = 0; waiting.length = 0; },
  };
}

// Frames from manifest characters.bouncer.animations and the worker rows 9-10.
const WALK = { down: 0, left: 4, up: 8 }, CARRY = { left: 20, down: 24, up: 28 };
const REACH = [12, 13], GRAB = { left: [16, 17], right: [18, 19] }, TOSS = [32, 33, 34], DUST_OFF = [36, 37];
const LIFTED = [36, 37], STRUGGLE = [38, 39], CARRIED_DOWN = [40, 41], TOSSED = [42, 43];
const MAX_PAIRS = 2, DOOR = { x: 32, y: 128 };

export type CarryInPlace = "queued" | "started" | "none";

/** A carry-in still waiting never appeared, so there is nothing to walk out. */
export function departureFor(place: CarryInPlace): "finish" | "carry-out" {
  return place === "queued" ? "finish" : "carry-out";
}

/** Two HR bouncers walk in, lift an ended Agent under the arms, carry it out of the door and toss it. Cartoon only. */
export class Bouncers {
  private jobs: Job[] = [];
  private slots = createPairQueue<Request>(MAX_PAIRS);

  constructor(private scene: FloorScene) {}

  carry(worker: Worker, done: () => void) {
    this.enqueue({ kind: "out", worker, done });
  }

  /** Walk a new Agent in between two bouncers and sit them down. Shares the pair limit with `carry`. */
  bring(worker: Worker, done: () => void) {
    this.enqueue({ kind: "in", worker, done });
  }

  /**
   * Stop a carry-in before a departure.
   * `queued` means the pair never started (the worker is still hidden).
   * `started` means it was on the floor; the sprite is shown where it is.
   */
  cancelBring(worker: Worker): CarryInPlace {
    if (this.slots.drop((request) => request.kind === "in" && request.worker === worker)) return "queued";
    const job = this.jobs.find((item) => item.kind === "in" && item.worker === worker);
    if (!job) return "none";
    job.phase = "tossing";
    job.door?.destroy();
    for (const mover of job.movers) mover.sprite.destroy();
    this.jobs = this.jobs.filter((item) => item !== job);
    worker.sprite.setVisible(true).setAlpha(1);
    this.unblock();
    return "started";
  }

  private enqueue(request: Request) {
    if (!this.scene.layout) { request.done(); return; }
    if (this.slots.take(request)) this.begin(request);
  }

  private begin(request: Request) {
    if (request.kind === "in") this.startIn(request.worker, request.done);
    else this.start(request.worker, request.done);
  }

  private unblock() {
    const next = this.slots.release();
    if (next) this.begin(next);
  }

  private door() {
    const door = this.scene.layout?.door ?? { x: 1, y: 6 };
    return { x: door.x * 32 + 16, y: door.y * 32 + 20 };
  }

  /** The entrance door swings open over the wall art while a job runs, then slams. */
  private openDoor(job: Job) {
    const key = this.scene.art.sheet("objects", "doorOpen");
    if (!key || job.door) return;
    job.door = this.scene.add.sprite(DOOR.x, DOOR.y, key, 0).setOrigin(0).setDepth(5);
    this.scene.art.play(job.door, key, 10, 0, [0, 1, 2]);
  }

  private slamDoor(job: Job) {
    const door = job.door, key = door?.texture.key;
    if (!door || !key) return;
    this.scene.art.play(door, key, 12, 0, [2, 3, 0]);
    this.scene.time.delayedCall(400, () => door.destroy());
  }

  private start(worker: Worker, done: () => void) {
    const { layout, art } = this.scene;
    if (!layout) { done(); this.slots.release(); return; }
    const key = art.bouncer(), door = this.door(), seat = { x: worker.desk.approach.x * 32 + 16, y: worker.desk.approach.y * 32 + 16 };
    const make = (dx: number, side: Mover["side"]): Mover => {
      const sprite = this.scene.add.sprite(door.x + dx, door.y, key, 0).setOrigin(0.5, 1).setDepth(layout.height + 20);
      return { sprite, side, route: { points: route(layout.grid, sprite, { x: seat.x + dx, y: seat.y }), speed: 170, done: () => undefined } };
    };
    const job: Job = { kind: "out", worker, done, movers: [make(-13, "left"), make(13, "right")], phase: "coming" };
    this.openDoor(job);
    this.scene.time.delayedCall(600, () => { this.slamDoor(job); job.door = undefined; });
    this.jobs.push(job);
  }

  /** The pair is already carrying the worker when they come through the door. */
  private startIn(worker: Worker, done: () => void) {
    const { layout, art } = this.scene;
    if (!layout) { done(); this.slots.release(); return; }
    const key = art.bouncer(), door = this.door();
    const seat = { x: worker.desk.approach.x * 32 + 16, y: worker.desk.approach.y * 32 + 16 };
    worker.sprite.setVisible(true).setAlpha(1).setPosition(door.x, door.y - 10).setDepth(layout.height + 21);
    const make = (dx: number, side: Mover["side"]): Mover => {
      const sprite = this.scene.add.sprite(door.x + dx, door.y, key, CARRY.down).setOrigin(0.5, 1).setDepth(layout.height + 20);
      return { sprite, side, route: { points: route(layout.grid, sprite, { x: seat.x + dx, y: seat.y }), speed: 130, done: () => undefined } };
    };
    const job: Job = { kind: "in", worker, done, movers: [make(-13, "left"), make(13, "right")], phase: "carrying" };
    this.openDoor(job);
    this.jobs.push(job);
  }

  update(time: number, delta: number) {
    for (const job of [...this.jobs]) this.step(job, time, delta);
  }

  private walk(mover: Mover, time: number, carrying: boolean, delta: number) {
    const point = mover.route?.points[0];
    if (!mover.route || !point) return;
    const dx = point.x - mover.sprite.x, dy = point.y - mover.sprite.y, tick = Math.floor(time / 140) % 4, side = Math.abs(dx) > Math.abs(dy);
    const set = carrying ? CARRY : WALK, frame = (side ? set.left : dy < 0 ? set.up : set.down) + tick;
    mover.sprite.setFrame(this.scene.art.frame(mover.sprite.texture.key, frame)).setFlipX(side && dx > 0);
    advance(mover.sprite, mover.route, delta);
  }

  private step(job: Job, time: number, delta: number) {
    const { layout, art } = this.scene;
    if (!layout || job.phase === "tossing" || job.phase === "grabbing" || job.phase === "dropping") return;
    if (job.phase === "returning") {
      for (const mover of job.movers) this.walk(mover, time, false, delta);
      if (job.movers.every((mover) => !mover.route?.points.length)) this.leave(job);
      return;
    }
    const [a, b] = job.movers, worker = job.worker.sprite;
    for (const mover of job.movers) this.walk(mover, time, job.phase === "carrying", delta);
    const arrived = job.movers.every((mover) => !mover.route?.points.length);
    if (job.phase === "coming" && arrived) return this.grab(job);
    if (job.phase === "carrying") {
      const point = a.route?.points[0], down = !!point && point.y - a.sprite.y > Math.abs(point.x - a.sprite.x);
      const kick = Math.floor(time / 220) % 2, frames = down ? CARRIED_DOWN : Math.floor(time / 900) % 2 ? STRUGGLE : LIFTED;
      worker.setPosition((a.sprite.x + b.sprite.x) / 2, (a.sprite.y + b.sprite.y) / 2 - 10).setFrame(art.frame(worker.texture.key, frames[kick] ?? 36));
      if (arrived) job.kind === "in" ? this.drop(job) : this.toss(job);
    }
  }

  /** Reach, grab under the arms, lift: the chair spins and a shoe stays behind. */
  private grab(job: Job) {
    const scene = this.scene, { art, layout } = scene, worker = job.worker, sprite = worker.sprite;
    if (!layout) return;
    job.phase = "grabbing";
    for (const mover of job.movers) mover.sprite.setFlipX(false).setFrame(art.frame(mover.sprite.texture.key, REACH[0] ?? 12));
    scene.time.delayedCall(180, () => { for (const mover of job.movers) mover.sprite.setFrame(art.frame(mover.sprite.texture.key, REACH[1] ?? 13)); });
    scene.time.delayedCall(360, () => {
      for (const mover of job.movers) mover.sprite.setFrame(art.frame(mover.sprite.texture.key, GRAB[mover.side][0] ?? 16));
      sprite.setDepth(layout.height + 21).setFlipX(false).setFrame(art.frame(sprite.texture.key, LIFTED[0] ?? 36));
      scene.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 160, ease: "Quad.easeOut" });
      this.spinChair(worker);
      this.dropShoe(worker);
    });
    scene.time.delayedCall(620, () => {
      for (const mover of job.movers) mover.sprite.setFrame(art.frame(mover.sprite.texture.key, GRAB[mover.side][1] ?? 17));
      const door = this.door(), [a, b] = job.movers;
      a.route = { points: route(layout.grid, a.sprite, { x: door.x - 13, y: door.y }), speed: 130, done: () => undefined };
      b.route = { points: route(layout.grid, b.sprite, { x: door.x + 13, y: door.y }), speed: 130, done: () => undefined };
      job.phase = "carrying";
    });
  }

  private spinChair(worker: Worker) {
    const scene = this.scene, chair = scene.room.chairs.get(`${worker.desk.benchId}:${worker.desk.index}`), key = scene.art.sheet("objects", "chairSpin");
    if (!chair || !key) return;
    chair.setVisible(false);
    const spin = scene.add.sprite(chair.x, chair.y, key, 0).setOrigin(0).setDepth(chair.depth);
    scene.art.play(spin, key, 14, 2);
    scene.time.delayedCall(900, () => { spin.destroy(); if (chair.active) chair.setVisible(true); });
  }

  private dropShoe(worker: Worker) {
    const scene = this.scene, key = scene.art.object("ui", "fxShoe");
    if (!key) return;
    const shoe = scene.add.image(worker.desk.x + 8, worker.desk.y + 30, key).setDepth(worker.desk.y + 1);
    scene.tweens.add({ targets: shoe, alpha: 0, delay: 3000, duration: 600, onComplete: () => shoe.destroy() });
  }

  private toss(job: Job) {
    job.phase = "tossing";
    const scene = this.scene, { art } = scene, worker = job.worker.sprite, door = this.door();
    this.openDoor(job);
    for (const mover of job.movers) art.play(mover.sprite.setFlipX(mover.side === "right"), mover.sprite.texture.key, 10, 0, TOSS);
    scene.time.delayedCall(200, () => {
      art.play(worker, worker.texture.key, 8, -1, TOSSED);
      scene.tweens.add({ targets: worker, x: door.x, y: door.y - 70, scale: 0.6, angle: -200, alpha: 0, duration: 520, ease: "Quad.easeOut" });
    });
    scene.time.delayedCall(560, () => {
      const dust = art.sheet("ui", "fxDust");
      if (dust) { const fx = scene.add.sprite(door.x, door.y - 40, dust, 0).setDepth(worker.depth + 1); art.play(fx, dust, 10, 0); scene.time.delayedCall(420, () => fx.destroy()); }
      const out = art.sheet("ui", "markerOut");
      if (out) { const tag = scene.add.sprite(DOOR.x + 16, DOOR.y - 10, out, 0).setDepth(6); art.play(tag, out, 4); scene.time.delayedCall(1400, () => tag.destroy()); }
      this.slamDoor(job);
      for (const mover of job.movers) art.play(mover.sprite.setFlipX(false), mover.sprite.texture.key, 6, 1, DUST_OFF);
    });
    for (const mover of job.movers) scene.tweens.add({ targets: mover.sprite, alpha: 0, delay: 1100, duration: 300, onComplete: () => mover.sprite.destroy() });
    scene.time.delayedCall(800, () => this.complete(job));
  }

  /** Sit the carried worker down, dust the chair, then the pair walks back out. */
  private drop(job: Job) {
    job.phase = "dropping";
    const scene = this.scene, { art } = scene, worker = job.worker, sprite = worker.sprite, desk = worker.desk;
    sprite.setFlipX(false).setPosition(desk.x, desk.y).setDepth(desk.y).setFrame(art.frame(sprite.texture.key, 27));
    scene.tweens.add({ targets: sprite, y: desk.y - 8, duration: 120, yoyo: true, ease: "Quad.easeOut" });
    const dust = art.sheet("ui", "fxDust");
    if (dust) {
      const fx = scene.add.sprite(desk.x, desk.y - 8, dust, 0).setDepth(desk.y + 2);
      art.play(fx, dust, 12, 0);
      scene.time.delayedCall(400, () => fx.destroy());
    }
    for (const mover of job.movers) art.play(mover.sprite.setFlipX(false), mover.sprite.texture.key, 8, 0, DUST_OFF);
    worker.phase = "seated";
    if (worker.zone.active) worker.zone.setInteractive({ useHandCursor: true });
    scene.time.delayedCall(420, () => {
      const grid = scene.layout?.grid;
      if (!grid || job.phase !== "dropping") return;
      const door = this.door();
      for (const mover of job.movers) {
        const dx = mover.side === "left" ? -13 : 13;
        mover.route = { points: route(grid, mover.sprite, { x: door.x + dx, y: door.y }), speed: 170, done: () => undefined };
      }
      job.phase = "returning";
    });
  }

  private leave(job: Job) {
    job.phase = "tossing";
    this.slamDoor(job);
    for (const mover of job.movers) this.scene.tweens.add({ targets: mover.sprite, alpha: 0, duration: 280, onComplete: () => mover.sprite.destroy() });
    this.scene.time.delayedCall(360, () => this.complete(job));
  }

  private complete(job: Job) {
    this.jobs = this.jobs.filter((item) => item !== job);
    job.done();
    this.unblock();
  }

  destroy() {
    for (const job of this.jobs) { job.door?.destroy(); for (const mover of job.movers) mover.sprite.destroy(); }
    this.jobs = [];
    this.slots.clear();
  }
}
