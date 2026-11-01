import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import type { FloorInput, FloorOffice } from "../floor/contract";
import { FloorScene } from "../floor/FloorScene";
import type { ArtBank } from "../floor/manifest";
import { refreshText } from "../floor/text";
import { layoutFloor } from "../floor/layout";
import { peopleOf } from "../floor/contract";
import { preloadNativeFloor } from "./native-art";

/** A landing camera over the actual Floor, not a second set of furniture or movement rules. */
class LandingScene extends FloorScene {
  private manualUntil = 0;
  private nextTour = 1500;
  private tour = 0;
  private visiting: string | null = null;
  private suppressManual = false;
  private parked = false;
  private selectionRing?: Phaser.GameObjects.Sprite;
  private bossTag?: Phaser.GameObjects.Text;
  private wallSignature = "";
  private roomSignature = "";
  private roomTheme: string | undefined;
  private bossDesk?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private enclosure: Phaser.GameObjects.GameObject[] = [];
  onActivity: (message: string) => void = () => undefined;
  override create() {
    super.create();
    // Keep the entire office in view; walking never pans away from the other teams.
    this.controls.follow = () => undefined;
    this.controls.followWhenVisible = () => undefined;
    this.controls.focus = () => undefined;
    this.controls.update = () => undefined;
    const walk = this.actions.walk.bind(this.actions),
      move = this.actions.move.bind(this.actions);
    this.actions.walk = (x, y) => {
      if (!this.suppressManual) {
        this.manualUntil = this.time.now + 12000;
        this.visiting = null;
        this.actions.stop();
      }
      walk(x, y);
    };
    this.actions.move = (dx, dy, delta) => {
      this.manualUntil = this.time.now + 12000;
      this.visiting = null;
      move(dx, dy, delta);
    };
    if (this.boss && this.layout) this.boss.setPosition(this.layout.width / 2, 336);
    const ring = this.art.sheet("ui", "selectRing");
    if (ring) this.selectionRing = this.add.sprite(0, 0, ring, 0);
    this.bossTag = this.add
      .text(0, 0, "You", {
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize: "12px",
        color: "#42392d",
        backgroundColor: "#fff6dc",
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setDepth(95000)
      .setName("landing-boss-label");
    this.fitOffice();
  }
  protected override sync() {
    // Bound layout height before the native layout runs, including on portrait screens.
    if (this.controls)
      this.controls.fitZoom = Math.max(this.keyTarget.clientWidth / 640, this.keyTarget.clientHeight / 656);
    super.sync();
    if (this.layout && this.dataInput) {
      this.layout = layoutFloor(
        this.dataInput.office.projects,
        peopleOf(this.dataInput.office),
        this.layout.memory,
        896,
        656,
      );
      if (this.art.theme === "office")
        for (let y = 11; y < 14; y++)
          for (let x = 16; x < 22; x++) {
            const row = this.layout.grid[y];
            if (row) row[x] = true;
          }
      const signature = JSON.stringify([this.art.theme, this.layout.width, this.layout.height, !!this.reduced]);
      if (signature !== this.roomSignature) {
        const resetCat = !this.roomSignature || this.roomTheme !== this.art.theme;
        this.roomSignature = signature;
        this.roomTheme = this.art.theme;
        this.wallSignature = "";
        this.room.draw(this.layout, (id) => this.dataInput?.callbacks.onSelectProject?.(id), undefined, true);
        this.wall.draw(this.layout);
        this.bossDesk?.destroy();
        if (this.art.theme === "office")
          this.bossDesk = this.art.image("objects", "bossOffice", 512, 352).setDepth(447);
        if (resetCat) {
          this.cat.destroy();
          this.cat.sync(this.art.theme === "office");
        }
      }
      for (const worker of this.workers.values()) {
        const desk = this.layout.desks.find((d) => d.key === worker.person.key);
        if (!desk) continue;
        this.tweens.killTweensOf(worker.sprite);
        worker.desk = desk;
        worker.sprite.setPosition(desk.x, desk.y).setDepth(desk.y);
        worker.zone.setPosition(desk.x, desk.y);
      }
    }
    this.fitOffice();
  }
  private fitOffice() {
    if (!this.ready || !this.layout) return;
    this.drawEnclosure();
    const top = 0,
      width = this.layout.width,
      height = this.layout.height + 48;
    const zoom = Math.min(this.keyTarget.clientWidth / width, this.keyTarget.clientHeight / height);
    this.controls.zoom = zoom;
    this.controls.fitZoom = zoom;
    const camera = this.cameras.main;
    camera.stopFollow();
    camera.panEffect.reset();
    camera
      .setRoundPixels(false)
      .setBounds(0, top, width, height)
      .setZoom(zoom * this.dpr)
      .centerOn(width / 2, top + height / 2);
    camera.setBackgroundColor(this.art.theme === "office" ? "#d9d0bb" : "#c9d8d4");
    // The side note is the single readable label; leave the floor itself quiet.
    for (const item of this.children.list) {
      const display = item as Phaser.GameObjects.Image;
      if (display.depth >= this.layout.height + 60 && display.depth <= this.layout.height + 64) {
        display.setVisible(false);
        if (item instanceof Phaser.GameObjects.Zone) item.disableInteractive();
      }
      if (item instanceof Phaser.GameObjects.Text) {
        refreshText(item, zoom);
        if (item.y >= 192 && item.name !== "landing-boss-label") item.setVisible(false);
      }
    }
  }
  private drawEnclosure() {
    if (!this.layout) return;
    const signature = `${this.art.theme}:${this.layout.width}:${this.layout.height}`;
    if (signature === this.wallSignature) return;
    this.wallSignature = signature;
    for (const item of this.enclosure) item.destroy();
    this.enclosure = [];
    const wall = this.art.object("tiles", "wall"),
      floor = this.art.object("tiles", "floor");
    if (!wall) return;
    const width = this.layout.width,
      bottom = this.layout.height;
    const add = (side: string, x: number, y: number, w: number, h: number, depth: number, tint = 0xffffff) => {
      const face = this.add
        .image(x, y, wall)
        .setOrigin(0)
        .setDisplaySize(w, h)
        .setDepth(depth)
        .setTint(tint)
        .setName(`landing-wall-${side}`)
        .setData("wallSide", side.startsWith("front") ? "front" : side);
      this.enclosure.push(face);
      return face;
    };
    // Canvas renders the native wall plate directly; wall fixtures stay above it.
    for (const item of this.children.list) {
      const display = item as Phaser.GameObjects.Image;
      if (display.y > 0 && display.y < 192 && display.depth === 0) display.setDepth(1);
    }
    add("back", 0, 0, width, 192, 0);
    add("left", 0, 192, 16, bottom - 192, bottom + 20, 0xd4c9ad);
    add("right", width - 16, 192, 16, bottom - 192, bottom + 20, 0xc7bca1);
    const entrance = width - 160;
    add("front-left", 0, bottom, entrance, 48, bottom + 24);
    add("front-right", entrance + 64, bottom, 96, 48, bottom + 24);
    if (floor)
      this.enclosure.push(
        this.add.tileSprite(entrance, bottom, 64, 48, floor).setOrigin(0).setName("landing-office-threshold"),
      );
    this.enclosure.push(
      this.add
        .rectangle(entrance, bottom, 4, 48, 0x665e49)
        .setOrigin(0)
        .setDepth(bottom + 25),
      this.add
        .rectangle(entrance + 60, bottom, 4, 48, 0x665e49)
        .setOrigin(0)
        .setDepth(bottom + 25),
    );
  }
  override update(time: number, delta: number) {
    if (this.reduced) {
      if (!this.parked) {
        this.actions.stop();
        this.visiting = null;
        this.parked = true;
      }
    } else {
      this.parked = false;
      if (time >= this.manualUntil && time >= this.nextTour && !this.visiting) {
        const workers = [...this.workers.values()],
          worker = workers[[1, 6, 9, 3, 5, 10][this.tour++ % 6] ?? 0];
        if (worker) {
          this.visiting = worker.person.key;
          this.suppressManual = true;
          this.actions.walk(worker.desk.approach.x * 32 + 16, worker.desk.approach.y * 32 + 20);
          this.suppressManual = false;
        }
      }
      const worker = this.visiting ? this.workers.get(this.visiting) : undefined;
      if (
        worker &&
        this.boss &&
        Math.hypot(this.boss.x - (worker.desk.approach.x * 32 + 16), this.boss.y - (worker.desk.approach.y * 32 + 20)) <
          3
      ) {
        this.onActivity(`Boss is checking in with ${worker.person.name}.`);
        const neighbor = [...this.workers.values()].find(
          (w) => w.person.projectId === worker.person.projectId && w.person.key !== worker.person.key,
        );
        if (neighbor) this.teamFlight(worker.person.paneId, neighbor.person.paneId);
        this.visiting = null;
        this.nextTour = time + 4500;
      }
    }
    super.update(time, delta);
    const marker = this.art.object("ui", "markerNeeds");
    for (const item of this.children.list)
      if (item instanceof Phaser.GameObjects.Image && item.depth === 90001)
        item.setVisible(item.texture.key === marker);
    const selected = this.dataInput?.selected ? this.workers.get(this.dataInput.selected) : undefined;
    if (this.selectionRing) {
      this.selectionRing.setVisible(!!selected);
      if (selected)
        this.selectionRing
          .setPosition(selected.sprite.x, selected.sprite.y - 2)
          .setDepth(selected.sprite.depth - 0.5)
          .setFrame(0);
    }
    if (this.boss && this.bossTag) this.bossTag.setPosition(this.boss.x, this.boss.y + 3);
  }
}
/** Sleep the game loop when the office is off screen (reception, hidden tab). */
function setRunning(current: { game: Phaser.Game; scene: LandingScene }, running: boolean) {
  if (running) {
    current.scene.scene.resume();
    current.game.loop.wake();
  } else {
    current.scene.scene.pause();
    current.game.loop.sleep();
  }
}

const STATUS_LABEL: Record<string, string> = { blocked: "Needs you", done: "Done", working: "Working" };

export type NativeFloorProps = {
  office: FloorOffice;
  selected: string;
  theme: "office" | "compound";
  calm: boolean;
  active: boolean;
  onSelect: (key: string) => void;
  onProject: (id: string) => void;
  onActivity: (message: string) => void;
};
export default function NativeFloor(props: NativeFloorProps) {
  const host = useRef<HTMLDivElement>(null),
    renderer = useRef<{ game: Phaser.Game; scene: LandingScene } | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const floorInput = useMemo<FloorInput>(
    () => ({
      office: props.office,
      selected: props.selected,
      settings: { theme: props.theme, calm: props.calm, muted: true },
      callbacks: {
        onSelectAgent: (key) => latest.current.onSelect(key),
        onSelectProject: (id) => latest.current.onProject(id),
      },
    }),
    [props.office, props.selected, props.theme, props.calm],
  );
  const latestInput = useRef(floorInput);
  latestInput.current = floorInput;
  useEffect(() => {
    let live = true,
      observer: ResizeObserver | undefined;
    const start = async (bank: ArtBank) => {
      if (!live || !host.current) return;
      const target = host.current;
      // Native logical pixels at 1x avoid allocating a DPR-squared map on large monitors.
      const scene = new LandingScene(bank, target, 1);
      scene.setInput(latestInput.current);
      scene.onActivity = (message) => latest.current.onActivity(message);
      scene.onHud = (hud) => {
        if (hud.ready && live) setReady(true);
      };
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: target,
        width: target.clientWidth,
        height: target.clientHeight,
        pixelArt: true,
        roundPixels: false,
        antialias: false,
        backgroundColor: "#d9d0bb",
        scene: [scene],
        scale: { mode: Phaser.Scale.NONE },
        input: { keyboard: { target } },
        audio: { noAudio: true },
        fps: { target: 60, smoothStep: true },
      });
      renderer.current = { game, scene };
      if (new URLSearchParams(location.search).has("demo")) Object.assign(target, { floorScene: scene });
      scene.events.once("create", () => {
        if (!latest.current.active || document.hidden) setRunning({ game, scene }, false);
      });
      observer = new ResizeObserver(() => {
        if (!target.clientWidth || !target.clientHeight) return;
        game.scale.resize(target.clientWidth, target.clientHeight);
        scene.resize();
      });
      observer.observe(target);
    };
    void preloadNativeFloor()
      .then(start)
      .catch(() => {
        if (live) setError(true);
      });
    const visibility = () => {
      if (renderer.current) setRunning(renderer.current, latest.current.active && !document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      live = false;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.current?.game.destroy(true);
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    const current = renderer.current;
    if (!current) return;
    current.scene.setInput(floorInput);
    setRunning(current, props.active && !document.hidden);
  }, [floorInput, props.active]);
  return (
    <div className="native-office" data-ready={ready} data-agent-count={props.office.agents.length}>
      <div
        ref={host}
        className="native-floor-host"
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The Phaser surface owns keyboard walking controls.
        tabIndex={0}
        aria-label="Office. Click an Agent to open their Conversation. Use arrow keys or WASD to walk the Boss. Click a clear floor tile to walk there."
      />
      {!ready && (
        <span className="native-loading" role="status">
          {error ? "Office art could not load. Return to reception and try again." : "Opening the Floor…"}
        </span>
      )}
      <fieldset className="native-agent-directory" aria-label="Office Agents">
        {props.office.agents.map((agent) => (
          <button
            className="native-agent-option"
            key={agent.agentKey}
            type="button"
            aria-pressed={props.selected === agent.agentKey}
            onClick={() => props.onSelect(agent.agentKey ?? agent.paneId)}
            aria-label={`Select ${agent.name}, ${STATUS_LABEL[agent.status] ?? "On a break"}`}
          >
            {agent.name}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
