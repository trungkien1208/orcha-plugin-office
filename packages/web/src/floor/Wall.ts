import type Phaser from "phaser";
import type { Art } from "./Art.ts";
import type { FloorInput } from "./contract.ts";
import { rankTeams } from "./kpi.ts";
import { crisp, fitText } from "./text.ts";
import { EXTERIOR, storageProps, type Layout } from "./layout.ts";
export class Wall {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private decorLoops: {image: Phaser.GameObjects.Image; count:number; rate:number}[] = [];
  private windows: Phaser.GameObjects.Image[] = [];
  private cctv?: Phaser.GameObjects.Image;
  private gong?: Phaser.GameObjects.Image;
  private coffee?: Phaser.GameObjects.Image;
  private hands?: Phaser.GameObjects.Graphics;
  private timeText?: Phaser.GameObjects.Text;
  private ranks: { label: Phaser.GameObjects.Text; score: Phaser.GameObjects.Text; width: number; dark: boolean }[] = [];
  strikeAt = -Infinity;
  constructor(private scene: Phaser.Scene, private art: Art) {}
  add<T extends Phaser.GameObjects.GameObject>(item: T): T { this.objects.push(item); return item; }
  draw(layout: Layout) {
    for (const item of this.objects) item.destroy(); this.objects = []; this.decorLoops = []; this.windows = []; this.ranks = []; this.coffee = undefined;
    const s = this.scene, w = layout.width;
    // Outside the building: Codex's compound at night, above the front wall (world y < 0, not walkable).
    const office = this.art.theme === "office";
    const hour = new Date().getHours(), dusk = hour >= 17 && hour < 19;
    const outside = (office ? this.art.object("backgrounds",dusk ? "cityDusk" : "cityDay") : null) ?? this.art.object("backgrounds",dusk ? "compoundDusk" : new Date().getDate()%2 ? "compoundNight" : "compoundNight2");
    this.add(outside ? s.add.image(w/2-384,-EXTERIOR,outside).setOrigin(0).setDepth(-10) : s.add.rectangle(0,-EXTERIOR,w,EXTERIOR,0x1d2747).setOrigin(0).setDepth(-10));
    const wallKey = this.art.object("tiles","wall");
    this.add(s.add.rectangle(0,0,w,192,0xe3ece9).setOrigin(0));
    if (wallKey) this.add(s.add.nineslice(0,0,wallKey,undefined,w,192,16,16,64,16).setOrigin(0));
    else this.add(s.add.rectangle(0,0,w,192,0xe3ece9).setOrigin(0).setStrokeStyle(1,0x2f3a4f));
    const bannerX = office ? w/2-128 : 48, bannerY = office ? 32 : 24;
    this.add(this.art.image("objects","banner",bannerX,bannerY));
    this.add(s.add.rectangle(bannerX+4,bannerY+5,248,22,office ? 0x7f9f78 : 0xb93838).setOrigin(0));
    { const banner=this.add(crisp(s,bannerX+128,bannerY+15,office ? "GOOD WORK · GOOD REST" : "HIT TARGET TODAY · SLEEP TOMORROW",10,"#ffffff")).setOrigin(0.5).setFontFamily("'Chakra Petch', sans-serif").setFontStyle("700"); fitText(banner,236); }
    if (office) {
      this.add(this.art.image("objects","kpiBoard",w/2-48,92));
      this.add(crisp(s,w/2-42,94,"DONE TODAY",7,"#ffffff"));
      this.rankRows(w/2-40,107,5,6,6,60,false);
      this.add(this.art.image("objects","posterRecruit",w/2+104,104));
    } else {
      this.put("noticeBoard",w/2-32,88,0);
      this.put("posterRecruit",80,160,0);
      this.add(crisp(s,85,164,"EASY JOB",7,"#2f3a4f"));
      this.add(crisp(s,85,178,"HIGH PAY",7,"#b93838"));
    }
    for (const x of [office ? 72 : 80,office ? w-168 : w-176]) { const win = this.frame("windowNight",96,48,x,104); if (win) this.windows.push(win); }
    this.add(this.art.image("objects","door",32,128,32,64));
    this.add(crisp(s,29,116,"ENTRY",8));
    this.cctv = this.frame("cctv",16,16,w-36,56) ?? undefined;
    const clockX = office ? w/2+176 : w/2+24, clockY = office ? 81 : 32;
    this.add(this.art.image("objects","clock",clockX,clockY,16,16));
    this.timeText = this.add(crisp(s,clockX+8,clockY+20,"00:00",9)).setOrigin(0.5,0);
    this.hands = this.add(s.add.graphics()).setData("center",{x:clockX+8,y:clockY+8});
    // The Compound strikes a gong when a job is done; the Cozy Office has a coffee corner there.
    if (office && this.art.object("objects","coffeeMachine")) { this.coffee = this.frame("coffeeMachine",32,48,w/2-160,136) ?? undefined; this.gong = undefined; }
    else this.gong = this.frame("gong",64,48,office ? w/2-174 : w/2-32,office ? 136 : 144) ?? undefined;
    this.add(this.art.image("objects","fluorescent",w/2-48,6));
    this.add(this.art.image("objects","wallFan",w-64,100));
    this.add(this.art.image("objects","phoneChargers",office ? w/2+218 : w-152,office ? 138 : 160));
    const manifest = this.art.bank.manifest.objects;
    if (office) this.officeDecor(layout);
    else for (let i=0;i<2;i++) {
      const stack = manifest?.stacks; if (Array.isArray(stack) && stack[i]) this.path(stack[i] as string, i ? w-48 : 16, 252+i*128);
      const props = manifest?.props; if (Array.isArray(props) && props[i]) this.path(props[i] as string,i ? w-48 : 16, 336+i*96);
    }
    if (!office) {
      this.compoundDecor(layout);
      this.add(this.art.image("objects","bossOffice",w/2-96,layout.height-136));
      this.add(crisp(s,w/2-42,layout.height-143,"MANAGEMENT",9));
    }
  }
  private compoundDecor(layout: Layout) {
    const w=layout.width;
    const prop=(name:string,x:number,y:number,fw?:number,fh?:number,rate=0)=>{
      if(fw&&fh){const image=this.frame(name,fw,fh,x,y);if(image&&rate)this.decorLoops.push({image,count:Math.floor(image.texture.getSourceImage().width/fw),rate});return;}
      this.put(name,x,y,y<192?0:y+64);
    };
    for(let x=0;x<w;x+=64)prop("razorWire",x,-12);
    for(const x of [24,w-56])prop("wallLamp",x,-40,16,32,1);
    prop("searchlight",w-144,-96,128,64,3);prop("neonSign",w/2-48,-40,96,32,2);
    ["waterTank","satelliteDish","tangledCables"].forEach((n,i)=>{prop(n,72+i*64,-72);});
    // Two hanging assets frame the central notice board; keep the upper sign and TV separate.
    prop("bannerHanging1",w/2-112,80);
    prop("bannerHanging3",w/2+48,80);
    prop("tvLeaderboard",w-240,16,192,64);
    this.add(this.scene.add.rectangle(w-234,35,178,32,0x1d2747).setOrigin(0));
    this.rankRows(w-226,38,3,10,9,148,true);
    prop("tubeBroken",16,72,64,16,2);
    prop("stainDamp",0,260);prop("crackWall",w-64,260);
    for(const p of storageProps(w,layout.height))prop(p.name,p.x,p.y,p.name==="shrine"?32:p.name==="generator"||p.name==="fanRusty"?48:undefined,p.name==="shrine"?48:p.name==="generator"||p.name==="fanRusty"?48:undefined,2);
    prop("supervisorPodium",w/2-96,layout.height-136);prop("moneyCounterTable",w/2-48,layout.height-130);prop("deskPhone",w/2+52,layout.height-112);
    for(const x of [144,w-64])prop("extinguisher",x,160);
    for(const b of layout.benches){prop("ceilingLight",b.x+64,b.y-46);const light=this.art.object("objects","lightPool");if(light)this.add(this.scene.add.image(b.x+96,b.y+40,light).setAlpha(.2).setDepth(1));}
  }
  private rankRows(x: number, y: number, count: number, gap: number, size: number, width: number, dark: boolean) {
    for (let i=0;i<count;i++) {
      const label = this.add(crisp(this.scene,x,y+i*gap,"",size));
      const score = this.add(crisp(this.scene,x+width,y+i*gap,"",size)).setOrigin(1,0);
      this.ranks.push({label,score,width:width-24,dark});
    }
  }
  /**
   * Cozy Office decor (level 2): plants in the four side prop cells and a lounge where the
   * management office stands. Both footprints are already blocked in layoutFloor, so nobody walks through them.
   */
  private officeDecor(layout: Layout) {
    const s = this.scene, w = layout.width, cols = w / 32, bottom = layout.height - 136;
    for (const [tx, ty] of [[1, 11], [1, 16], [cols - 2, 15], [cols - 2, 18]] as const) this.put(["plant", "plantDead"], tx * 32, ty * 32 + 16, ty * 32 + 64);
    this.put("rug", w / 2 - 64, bottom + 24, 0);
    this.put("bookshelf", w / 2 - 96, bottom + 8, bottom + 72);
    this.put("sofa", w / 2 - 28, bottom + 8, bottom + 56);
    this.put("coffeeTable", w / 2 - 4, bottom + 56, bottom + 88);
    this.put("plantHanging", w / 2 + 68, bottom, bottom + 48);
    this.add(crisp(s, w / 2 - 24, bottom - 7, "LOUNGE", 9));
  }
  /** Decor drawn only when its art exists (no grey placeholder boxes in the lounge). */
  private put(names: string | string[], x: number, y: number, depth: number) {
    const key = [names].flat().map((name) => this.art.object("objects", name)).find(Boolean);
    if (key) this.add(this.scene.add.image(x, y, key).setOrigin(0).setDepth(depth));
  }
  private path(path: string, x: number, y: number) {
    const image = this.art.bank.images.get(path); if (!image) return;
    const key = `asset:${path}`; if (!this.scene.textures.exists(key)) this.scene.textures.addImage(key,image);
    this.add(this.scene.add.image(x,y,key).setOrigin(0));
  }
  private frame(name: string, width: number, height: number, x: number, y: number) {
    const key = this.art.object("objects",name); if (!key) { this.add(this.art.image("objects",name,x,y,width,height)); return null; }
    const texture = this.scene.textures.get(key), count = Math.floor(texture.getSourceImage().width / width);
    for (let n=0;n<count;n++) if (!texture.has(`${n}`)) texture.add(n,0,n*width,0,width,height);
    return this.add(this.scene.add.image(x,y,key,0).setOrigin(0));
  }
  setVisible(visible: boolean) { for(const item of this.objects) (item as Phaser.GameObjects.Image).setVisible(visible); }
  update(time: number, input: FloorInput, totals: Record<string,number>, reduced: boolean) {
    const ranks = rankTeams(input.office.projects,input.settings.doneToday ?? totals);
    this.ranks.forEach(({label,score,width,dark},i) => {
      const rank = ranks[i], color = dark ? (i === 0 ? '#fff3c4' : '#e3ece9') : (i === 0 ? '#b93838' : '#2f3a4f');
      label.setText(rank ? `${String(i+1).padStart(2,'0')}  TEAM ${String(rank.team).padStart(2,'0')}` : '—').setColor(color);
      score.setText(rank ? String(rank.done) : '').setColor(color);
      label.setData("fullText",label.text); fitText(label,width);
    });
    const now = new Date(); this.timeText?.setText(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    if (this.timeText) this.timeText.texture.setFilter(1);
    const g = this.hands; if (g && this.timeText) { const {x,y} = g.getData("center") as {x:number;y:number}; g.clear().lineStyle(1,0x2f3a4f); const h=(now.getHours()%12+now.getMinutes()/60)*Math.PI/6-Math.PI/2, m=now.getMinutes()*Math.PI/30-Math.PI/2; g.lineBetween(x,y,x+Math.cos(h)*4,y+Math.sin(h)*4); g.lineBetween(x,y,x+Math.cos(m)*6,y+Math.sin(m)*6); }
    for(const loop of this.decorLoops)loop.image.setFrame(reduced ? 0 : Math.floor(time*loop.rate/1000)%loop.count);
    const flicker = reduced ? 0 : Math.floor(time/1800)%2; for (const win of this.windows) win.setFrame(flicker);
    this.cctv?.setFrame(reduced ? 0 : Math.floor(time/900)%2);
    this.gong?.setFrame(reduced || time-this.strikeAt > 650 ? 0 : 1+Math.floor((time-this.strikeAt)/100)%2);
    this.coffee?.setFrame(reduced ? 0 : Math.floor(time/700)%2);
  }
}
