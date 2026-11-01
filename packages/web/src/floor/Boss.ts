import type Phaser from "phaser";
import type { FloorScene, Worker } from "./FloorScene.ts";
import type { BossAction, NearAgent } from "./contract.ts";
import { ACTION_LABELS, BOSS_FRAMES, availableActions, dispatchWork, inReach, isWorkAction } from "./actions.ts";
import { advance, route, type Route } from "./motion.ts";
export class Boss {
  private path?: Route;
  private animation?: {kind:BossAction;start:number;until:number};
  private reactions=new Map<string,{kind:BossAction;start:number;until:number}>();
  private effects: {image:Phaser.GameObjects.Image;start:number;until:number}[]=[];
  private dismissed: string|null=null;
  private lastHud="";
  private pending=false;
  private manualUntil=0;
  activity="";
  constructor(private scene:FloorScene){scene.controls.onWalk=(x,y)=>this.walk(x,y);}
  walk(x:number,y:number){this.scene.controls.followWhenVisible();const {boss,layout}=this.scene;if(!boss||!layout)return;const points=route(layout.grid,boss,{x,y});if(!points.length)return;this.path={points,speed:160,done:()=>{this.path=undefined;}};this.dismissed=null;}
  move(dx:number,dy:number,delta:number){this.scene.controls.follow();const {boss,layout}=this.scene;if(!boss||!layout)return;this.stop();const length=Math.hypot(dx,dy),step=140*Math.min(delta,50)/1000;
    const free=(x:number,y:number)=>layout.grid[Math.floor(y/32)]?.[Math.floor(x/32)]===false;
    const x=boss.x+dx/length*step,y=boss.y+dy/length*step;
    if(free(x-7,boss.y)&&free(x+7,boss.y))boss.x=x;
    if(free(boss.x-7,y)&&free(boss.x+7,y))boss.y=y;
    boss.setFlipX(Math.abs(dx)>Math.abs(dy)&&dx>0).setFrame(this.scene.art.frame(boss.texture.key,(Math.abs(dx)>Math.abs(dy)?4:dy<0?8:0)+(this.scene.reduced?0:Math.floor(this.scene.time.now/140)%4)));this.manualUntil=this.scene.time.now+70;this.dismissed=null;
  }
  stop(){this.path=undefined;}
  close(){this.dismissed=this.nearest()?.person.key??null;this.emit(null);}
  nearest():Worker|undefined {const boss=this.scene.boss;if(!boss)return;return [...this.scene.workers.values()].filter(w=>w.phase==="seated"&&inReach(boss,w.sprite)).sort((a,b)=>Math.hypot(a.sprite.x-boss.x,a.sprite.y-boss.y)-Math.hypot(b.sprite.x-boss.x,b.sprite.y-boss.y))[0];}
  private emit(near:NearAgent|null){const value={near,zoom:this.scene.controls.zoom,ready:true,activity:this.activity};const signature=JSON.stringify(value);if(signature!==this.lastHud){this.lastHud=signature;this.scene.onHud(value);}}
  update(time:number,delta:number){const s=this.scene,boss=s.boss;if(!boss)return;
    if(this.path){const p=this.path.points[0],dx=(p?.x??boss.x)-boss.x,dy=(p?.y??boss.y)-boss.y;boss.setFlipX(Math.abs(dx)>Math.abs(dy)&&dx>0).setFrame(s.art.frame(boss.texture.key,(Math.abs(dx)>Math.abs(dy)?4:dy<0?8:0)+(s.reduced?0:Math.floor(time/140)%4)));advance(boss,this.path,delta);}
    else if(time<this.manualUntil){ /* keyboard movement already chose its facing frame */ }
    else if(this.animation&&time<this.animation.until){const a=this.animation,frames=BOSS_FRAMES[a.kind];boss.setFrame(s.art.frame(boss.texture.key,frames[s.reduced?0:Math.min(frames.length-1,Math.floor((time-a.start)/180)%frames.length)]??12));}
    else{this.animation=undefined;boss.setFrame(s.art.frame(boss.texture.key,s.reduced?12:12+Math.floor(time/700)%2));}
    boss.setDepth(boss.y+1);
    for(const [key,reaction]of this.reactions){const w=s.workers.get(key);if(!w||time>reaction.until){if(w){w.reactionUntil=0;w.sprite.setPosition(w.desk.x,w.desk.y);}this.reactions.delete(key);continue;}const age=time-reaction.start;
      const frame=reaction.kind==="zap"?(age<250?32:age<450?33:32):reaction.kind==="high-five"?14:reaction.kind==="coffee"?22:reaction.kind==="tap"?13:26;
      w.sprite.setFrame(s.art.frame(w.sprite.texture.key,frame));if(!s.reduced&&["whip","buzzer","knock","bonk"].includes(reaction.kind))w.sprite.y=w.desk.y-Math.max(0,Math.sin(age/700*Math.PI))*7;
    }
    for(const effect of this.effects){const frame=s.reduced?0:Math.min(2,Math.floor((time-effect.start)/150));effect.image.setFrame(frame);}
    this.effects=this.effects.filter(effect=>{if(time>effect.until){effect.image.destroy();return false;}return true;});
    const worker=this.nearest();if(!worker){this.dismissed=null;this.emit(null);return;}if(worker.person.key===this.dismissed){this.emit(null);return;}
    const camera=s.cameras.main,view=camera.worldView;this.emit({key:worker.person.key,name:worker.person.name,projectId:worker.person.projectId,status:worker.person.status,x:Math.round((worker.sprite.x-view.x)*camera.zoom/s.dpr),y:Math.round((worker.sprite.y-view.y)*camera.zoom/s.dpr)});
  }
  private fx(name:string,x:number,y:number){const s=this.scene,key=s.art.object("ui",name);if(!key)return;const texture=s.textures.get(key);for(let n=0;n<3;n++)if(!texture.has(`${n}`))texture.add(n,0,n*16,0,16,16);this.effects.push({image:s.add.image(x,y,key,0).setOrigin(.5).setDepth(99990),start:s.time.now,until:s.time.now+600});}
  async perform(kind:BossAction,key:string,payload?:Record<string,string>):Promise<string>{const s=this.scene,w=s.workers.get(key),input=s.dataInput;if(!w||!input||!s.boss||w.phase!=="seated"||!inReach(s.boss,w.sprite))return "Move within 1½ tiles of this worker.";
    if(!availableActions(w.person.status,input.office.orcha.connected).includes(kind))return "This action is unavailable.";
    if(kind==="bonk"&&payload?.confirmed!=="true")return "Confirm the interrupt first.";
    if(kind==="megaphone"&&!payload?.text?.trim())return "Enter a message for the team.";
    const work=isWorkAction(kind);if(work&&this.pending)return "Waiting for the previous work action.";if(work)this.pending=true;
    this.stop();s.boss.setFlipX(w.sprite.x<s.boss.x);const start=s.time.now;this.animation={kind,start,until:start+750};w.reactionUntil=start+800;this.reactions.set(key,{kind,start,until:start+800});
    this.fx(kind==="zap"?"fxZap":kind==="whip"?"fxCrack":kind==="coffee"||kind==="high-five"?"fxHeart":kind==="buzzer"?"fxJolt":"fxStars",w.sprite.x,kind==="whip"?w.desk.benchY-24:w.sprite.y-64);
    if(kind==="buzzer"){const buzzer=s.art.image("objects","deskBuzzer",w.desk.seatX+20,w.desk.benchY+12,16,16).setDepth(99980);s.time.delayedCall(800,()=>buzzer.destroy());}
    s.localSound.play(kind,!!input.settings.muted);this.activity=`Boss · ${ACTION_LABELS[kind]} · ${w.person.name}${work?"":" (local gag)"}`;
    if(!work)return this.activity;
    try {await new Promise<void>(resolve=>s.time.delayedCall(s.reduced?0:650,resolve));const current=s.dataInput,person=s.workers.get(key)?.person;if(!current||!person)return "Worker left before the action.";const sent=await dispatchWork(kind,person,current,payload);return sent?"Sent · waiting for the office state to update.":"Status changed; action skipped.";}catch(error){return `Action failed: ${error instanceof Error?error.message:String(error)}`;}finally{this.pending=false;}
  }
}
