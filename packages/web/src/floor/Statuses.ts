import type Phaser from "phaser";
import type { Art } from "./Art.ts";
import type { Worker } from "./FloorScene.ts";
import type { Layout } from "./layout.ts";
import type { Room } from "./Room.ts";
import { STATUS_COLOR } from "./Room.ts";
import { statusFrame } from "./status-frame.ts";
export { statusFrame } from "./status-frame.ts";
export class Statuses {
  private marks = new Map<string, { name: string; image: Phaser.GameObjects.Image }>();
  private ink: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene, private art: Art) { this.ink = scene.add.graphics().setDepth(90000); }
  private icon(name: string) {
    const key = this.art.object("ui",name === "stage" ? "fxBubbleStage" : name === "markerNeeds" || name === "fxSleep" ? name : "icons16"); if (!key) return null;
    const texture = this.scene.textures.get(key), width = 16, height = name === "markerNeeds" || name === "fxSleep" ? 24 : 16;
    const image = texture.getSourceImage(), cols = Math.floor(image.width/width), rows = Math.floor(image.height/height);
    for (let n=0;n<cols*rows;n++) if (!texture.has(`${n}`)) texture.add(n,0,n%cols*width,Math.floor(n/cols)*height,width,height);
    return key;
  }
  update(time: number, workers: Map<string,Worker>, layout: Layout, room: Room, reduced: boolean, far = false) {
    this.ink.clear();
    for (const [key, mark] of this.marks) if (!workers.has(key)) { mark.image.destroy(); this.marks.delete(key); }
    for (const worker of workers.values()) {
      const { person, sprite, desk } = worker, status = person.status;
      if (worker.phase !== "seated") { this.marks.get(person.key)?.image.setVisible(false); continue; }
      if (!worker.reactionUntil || time > worker.reactionUntil) sprite.setFrame(this.art.frame(sprite.texture.key,statusFrame(status,time,reduced)));
      sprite.setAlpha(status === "unknown" ? .45 : 1); if (status === "unknown") sprite.setTint(0x8c96aa); else sprite.clearTint();
      sprite.setVisible(!far); room.chairs.get(`${desk.benchId}:${desk.index}`)?.setDepth(desk.y-1);
      const screen = room.screens.get(`${desk.benchId}:${desk.index}`);
      if (screen && !far) {
        screen.shape.setFillStyle(status === "blocked" && !reduced && Math.floor(time/450)%2 ? 0xe3ece9 : STATUS_COLOR[status]);
        const {width,height}=screen, x=screen.shape.x, y=screen.shape.y;
        if (status === "working") { this.ink.lineStyle(1,0xc4eef4); for (let line=0;line<3;line++) { const yy = y+2+(line*3+(reduced ? 0 : Math.floor(time/160)))%(height-2); this.ink.lineBetween(x+2,yy,x+width-4-line*2,yy); } }
        if (status === "done") this.ink.lineStyle(1,0xffffff).lineBetween(x+8,y+6,x+11,y+9).lineBetween(x+11,y+9,x+17,y+3);
        if (status === "unknown") { this.ink.fillStyle(0xdfe5e4,.7); for(let n=0;n<8;n++) this.ink.fillRect(x+1+(n*7)%22,y+1+(n*3+(reduced ? 0 : Math.floor(time/100)))%10,2,1); }
      }
      const name = status === "blocked" ? "markerNeeds" : status === "idle" ? "fxSleep" : status === "done" ? "check" : status === "unknown" ? "question" : "stage";
      let mark = this.marks.get(person.key);
      if (mark?.name !== name) { mark?.image.destroy(); this.marks.delete(person.key); const key=this.icon(name); if(key) { mark={name,image:this.scene.add.image(sprite.x,sprite.y-68,key,0).setOrigin(.5,1).setDepth(90001)}; this.marks.set(person.key,mark); } }
      if (mark) { const frame = name === "stage" ? Math.max(0,["thinking","coding","testing","reviewing","finished"].findIndex(w=>person.stage?.toLowerCase().includes(w))) : name === "check" ? 1 : name === "question" ? 2 : name === "fxSleep" ? (reduced ? 0 : Math.floor(time/550)%3) : name === "markerNeeds" ? (reduced ? 0 : Math.floor(time/450)%2) : 0; mark.image.setFrame(frame).setPosition(sprite.x+(name === "fxSleep" ? 18 : 0),sprite.y-(status === "blocked" ? 72 : 57)).setVisible(!far); }
      if (far) this.ink.fillStyle(STATUS_COLOR[status]).fillCircle(sprite.x,sprite.y-12,4);
    }
    if (!far) for (const bench of layout.benches) if ([...workers.values()].some((w)=>w.desk.benchId === bench.id && w.person.status === "blocked" && w.phase === "seated")) this.ink.lineStyle(1,0xffb020,reduced ? 1 : .45+.55*(1+Math.sin(time/220))/2).strokeRect(bench.x-2,bench.y-6,bench.width+4,78);
  }
}
