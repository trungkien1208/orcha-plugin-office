import Phaser from "phaser";
import type { FloorScene } from "./FloorScene.ts";
import { crisp, refreshText } from "./text.ts";
const STEPS=[1,1.25,1.5,2]; // multiples of the fit zoom
/** The floor is always this wide in world pixels: two Bench columns, the aisle and the side props. */
export const WORLD_WIDTH=640;
export class FloorCamera {
  zoom = 1.25;
  fitZoom = 1.25;
  private initialized = false;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private pointers=new Map<number,{x:number;y:number}>();
  private drag?: {x:number;y:number;scrollX:number;scrollY:number;moved:boolean};
  private pinch=0;
  private zoomTween?: Phaser.Tweens.Tween;
  private zoomTarget=1;
  private pulse: Phaser.GameObjects.Graphics;
  private nameTag?: Phaser.GameObjects.Text;
  private selected: string|null=null;
  private cleanup: (()=>void)[]=[];
  onWalk: (x:number,y:number)=>void=()=>undefined;
  /** The camera follows the Boss; dragging or focusing an Agent pauses that until the Boss moves again. */
  following=false;
  /** Click-to-walk: start following only once the Boss walks into view, so the camera never jumps away from what you are looking at. */
  private pendingFollow=false;
  constructor(private scene: FloorScene, private host: HTMLElement, readonly dpr: number) {
    this.camera=scene.cameras.main;
    this.pulse=scene.add.graphics().setDepth(95000);
    const listen=<K extends keyof HTMLElementEventMap>(name:K,handler:(event:HTMLElementEventMap[K])=>void,options?:AddEventListenerOptions)=>{host.addEventListener(name,handler,options);this.cleanup.push(()=>host.removeEventListener(name,handler,options));};
    listen("pointerdown",e=>{host.focus({preventScroll:true});this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});host.setPointerCapture(e.pointerId);this.drag={x:e.clientX,y:e.clientY,scrollX:this.camera.scrollX,scrollY:this.camera.scrollY,moved:false};if(this.pointers.size===2)this.pinch=this.distance();},{capture:true});
    listen("pointermove",e=>{if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const distance=this.distance();if(Math.abs(distance-this.pinch)>50){this.step(distance>this.pinch?1:-1,e.offsetX,e.offsetY);this.pinch=distance;}if(this.drag)this.drag.moved=true;return;}const drag=this.drag;if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){this.unfollow();this.camera.setScroll(drag.scrollX-dx/this.zoom,drag.scrollY-dy/this.zoom);}});
    listen("pointerup",e=>{const click=this.drag&&!this.drag.moved&&this.pointers.size===1;this.pointers.delete(e.pointerId);this.drag=undefined;if(click){const rect=host.getBoundingClientRect(),point=this.camera.getWorldPoint((e.clientX-rect.left)*dpr,(e.clientY-rect.top)*dpr);const hit=scene.input.hitTestPointer(scene.input.activePointer);if(!hit.length)this.onWalk(point.x,point.y);}});
    listen("pointercancel",e=>{this.pointers.delete(e.pointerId);this.drag=undefined;});
    listen("wheel",e=>{e.preventDefault();this.step(e.deltaY<0?1:-1,e.offsetX,e.offsetY);},{passive:false});
    this.fit();
  }
  private distance(){const [a,b]=[...this.pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
  /** Largest zoom step at which the whole floor width fits the map column; never zoom out past it. */
  fit(){const width=this.host.clientWidth;this.fitZoom=Math.max(0.4,Math.min(2,Math.floor(width/WORLD_WIDTH*100)/100));if(!this.initialized||this.zoomTarget<this.fitZoom){this.set(this.fitZoom);this.initialized=true;}}
  followWhenVisible(){if(!this.following)this.pendingFollow=true;}
  /** Follow the Boss; if he is off screen, glide there first instead of snapping. */
  follow(){
    const boss=this.scene.boss;if(!boss||this.following)return;
    this.pendingFollow=false;this.following=true;
    const start=()=>{if(this.following)this.camera.startFollow(boss,true,.15,.15);};
    if(this.scene.reduced||this.camera.worldView.contains(boss.x,boss.y)){start();return;}
    this.camera.pan(boss.x,boss.y,450,"Sine.easeInOut",true,(_camera,progress)=>{if(progress>=1)start();});
  }
  private stopFollowing(){if(!this.following)return;this.following=false;this.camera.stopFollow();this.camera.panEffect.reset();}
  unfollow(){this.pendingFollow=false;this.stopFollowing();}
  step(direction:number,x=this.host.clientWidth/2,y=this.host.clientHeight/2){
    const levels=STEPS.map(s=>Math.round(s*this.fitZoom*100)/100), current=this.zoomTarget||this.zoom, index=levels.reduce((best,l,i)=>Math.abs(l-current)<Math.abs((levels[best]??0)-current)?i:best,0), next=levels[Math.max(0,Math.min(levels.length-1,index+direction))]??this.fitZoom;
    if(next===(this.zoomTarget||this.zoom))return;
    this.zoomTween?.stop(); this.zoomTarget=next;
    const from=this.zoom, value={zoom:from};
    this.zoomTween=this.scene.tweens.add({targets:value,zoom:next,duration:190,ease:"Sine.easeInOut",onUpdate:()=>this.apply(value.zoom,x,y),onComplete:()=>{this.zoom=next;this.zoomTarget=next;this.zoomTween=undefined;this.refresh();}});
  }
  set(zoom:number,x=this.host.clientWidth/2,y=this.host.clientHeight/2){
    this.zoomTween?.stop();this.zoomTween=undefined;this.zoomTarget=zoom;this.apply(zoom,x,y);this.refresh();
  }
  private apply(zoom:number,x:number,y:number){const camera=this.camera,before=camera.getWorldPoint(x*this.dpr,y*this.dpr);this.zoom=zoom;camera.setZoom(zoom*this.dpr);camera.preRender();const after=camera.getWorldPoint(x*this.dpr,y*this.dpr);camera.setScroll(camera.scrollX+before.x-after.x,camera.scrollY+before.y-after.y);}
  
  refresh(){for(const item of this.scene.children.list)if(item instanceof Phaser.GameObjects.Text)refreshText(item,this.zoom);this.scene.room.setFar(false);this.scene.wall.setVisible(true);}
  focus(key:string|null){if(!key||key===this.selected)return;this.selected=key;const worker=this.scene.workers.get(key);if(!worker)return;const boss=this.scene.boss;if(boss&&Math.hypot(boss.x-worker.sprite.x,boss.y-worker.sprite.y)<96)return;const c=this.camera;this.stopFollowing();if(this.scene.reduced)c.centerOn(worker.sprite.x,worker.sprite.y);else c.pan(worker.sprite.x,worker.sprite.y,350,"Sine.easeInOut");}
  update(time:number){
    const boss=this.scene.boss;
    if(this.pendingFollow&&boss&&this.camera.worldView.contains(boss.x,boss.y))this.follow();
    this.pulse.clear();
    const worker=this.selected?this.scene.workers.get(this.selected):undefined;
    const marks=this.marks();
    if(!worker || worker.phase !== "seated"){this.nameTag?.setVisible(false);this.plate?.setVisible(false);marks?.ring.setVisible(false);marks?.arrow.setVisible(false);return;}
    const {x,y}=worker.sprite, still=this.scene.reduced, wave=still?0:Math.sin(time/180), top=y-74-(still?0:4*wave);
    if(marks){
      marks.ring.setVisible(true).setDepth(worker.sprite.depth-0.5).setPosition(x,y-2).setFrame(still?0:Math.floor(time/300)%2);
      marks.arrow.setVisible(true).setPosition(x,Math.round(top+2)).setFrame(still?0:Math.floor(time/300)%2);
    }else{
      this.pulse.fillStyle(0x3fd2e8,0.22).fillEllipse(x,y-2,46,16);
      this.pulse.lineStyle(3,0x3fd2e8,still?1:0.8+0.2*wave).strokeEllipse(x,y-2,46+(still?0:3*wave),16);
      this.pulse.fillStyle(0x1d2742,1).fillTriangle(x-9,top-1,x+9,top-1,x,top+11);
      this.pulse.fillStyle(0x3fd2e8,1).fillTriangle(x-6,top+1,x+6,top+1,x,top+8);
    }
    // The name sits under the feet so it never covers the hanging team sign above the monitors.
    if(!this.nameTag){this.nameTag=crisp(this.scene,x,y+10,"",11,"#ffffff").setOrigin(0.5,0).setFontFamily("'Chakra Petch', sans-serif").setFontStyle("700").setStroke("#1d2742",4).setDepth(95001);}
    this.nameTag.setVisible(true).setPosition(x,y+8);
    if(this.nameTag.getData("fullText")!==worker.person.name){this.nameTag.setData("fullText",worker.person.name).setText(worker.person.name);refreshText(this.nameTag,this.zoom);}
    const plateKey=this.scene.art.object("ui","namePlate"),slice=this.scene.art.bank.manifest.layout?.namePlate;
    if(plateKey&&slice){
      const width=Math.ceil(this.nameTag.displayWidth)+10,height=Math.ceil(this.nameTag.displayHeight)+2;
      this.plate??=this.scene.add.nineslice(0,0,plateKey,undefined,24,12,slice.left,slice.right,slice.top,slice.bottom).setOrigin(0.5,0).setDepth(95000);
      this.plate.setVisible(true).setPosition(x,y+7).setSize(width,height);
    }
  }
  private plate?: Phaser.GameObjects.NineSlice;
  private markSprites?: {ring:Phaser.GameObjects.Sprite;arrow:Phaser.GameObjects.Sprite}|null;
  /** Selection ring under the feet and the bobbing arrow, from the office art; null until it is drawn. */
  private marks(){
    if(this.markSprites!==undefined)return this.markSprites;
    const ring=this.scene.art.sheet("ui","selectRing"),arrow=this.scene.art.sheet("ui","selectMarker");
    this.markSprites=ring&&arrow?{ring:this.scene.add.sprite(0,0,ring,0).setDepth(1).setVisible(false),arrow:this.scene.add.sprite(0,0,arrow,0).setOrigin(0.5,0).setDepth(95000).setVisible(false)}:null;
    return this.markSprites;
  }
  destroy(){this.zoomTween?.stop();this.zoomTween=undefined;for(const cleanup of this.cleanup)cleanup();this.pointers.clear();}
}
