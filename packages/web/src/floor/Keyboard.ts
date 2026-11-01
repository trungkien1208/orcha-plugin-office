import type { FloorScene } from "./FloorScene.ts";
import { agentKey } from "./contract.ts";
export class FloorKeyboard {
  private held=new Set<string>();
  constructor(private scene:FloorScene,private host:HTMLElement){host.addEventListener("keydown",this.down);host.addEventListener("keyup",this.up);host.addEventListener("blur",this.blur);window.addEventListener("blur",this.blur);}
  private editable(target:EventTarget|null){return target instanceof HTMLElement&&!!target.closest("input,textarea,select,[contenteditable=true]");}
  private down=(event:KeyboardEvent)=>{if(this.editable(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;const key=event.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(key)){event.preventDefault();this.held.add(key);return;}if(event.repeat)return;
    if(key==="escape"){event.preventDefault();this.scene.actions.close();}
    if(key==="n"){event.preventDefault();const input=this.scene.dataInput;if(!input)return;const people=input.office.agents.filter(a=>a.status==="blocked").sort((a,b)=>(a.waitingSince??0)-(b.waitingSince??0)),index=people.findIndex(a=>agentKey(a)===input.selected),next=people[(index+1)%people.length];if(next){const id=agentKey(next);input.callbacks.onSelectAgent?.(id);this.scene.controls.focus(id);}}
    if(key==="/"){event.preventDefault();this.scene.dataInput?.callbacks.onSearch?.();}
  };
  private up=(event:KeyboardEvent)=>this.held.delete(event.key.toLowerCase());
  private blur=()=>this.held.clear();
  update(delta:number){const x=Number(this.held.has("d")||this.held.has("arrowright"))-Number(this.held.has("a")||this.held.has("arrowleft")),y=Number(this.held.has("s")||this.held.has("arrowdown"))-Number(this.held.has("w")||this.held.has("arrowup"));if(x||y)this.scene.actions.move(x,y,delta);}
  destroy(){this.host.removeEventListener("keydown",this.down);this.host.removeEventListener("keyup",this.up);this.host.removeEventListener("blur",this.blur);window.removeEventListener("blur",this.blur);this.held.clear();}
}
