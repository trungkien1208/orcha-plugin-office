import type { BossAction, FloorInput, Person, Status, WorkAction } from "./contract.ts";
export const WORK_ACTIONS: readonly WorkAction[]=["tap","knock","whip","bonk","megaphone"];
export const FUN_ACTIONS: readonly BossAction[]=["buzzer","zap","coffee","high-five"];
export const ACTION_LABELS: Record<BossAction,string>={tap:"Tap shoulder",knock:"Back to work",bonk:"Stop",megaphone:"Megaphone",buzzer:"Buzzer",whip:"Faster!",zap:"Zap",coffee:"Coffee","high-five":"High-five"};
export function isWorkAction(kind: BossAction): kind is WorkAction {return (WORK_ACTIONS as readonly string[]).includes(kind);}
export function availableActions(status: Status, connected=true): BossAction[] {return [...(connected?WORK_ACTIONS.filter((kind)=>(kind!=="knock"||status==="idle")&&(kind!=="whip"||status!=="blocked")):[]),...FUN_ACTIONS];}
export function inReach(a:{x:number;y:number},b:{x:number;y:number},radius=48):boolean{return Math.hypot(a.x-b.x,a.y-b.y)<=radius;}
export const HURRY="Speed it up: skip the polish, finish the current step now and report back.";
/** One narrow dispatch gate; the four local gags cannot reach the external callback. */
export async function dispatchWork(kind: BossAction, person: Person, input: FloorInput, payload?: Record<string,string>): Promise<boolean> {
  if(!isWorkAction(kind)||!input.office.orcha.connected||!availableActions(person.status).includes(kind))return false;
  if(kind==="bonk"&&payload?.confirmed!=="true")return false;
  if(kind==="megaphone"&&!payload?.text?.trim())return false;
  if(kind==="tap")input.callbacks.onSelectAgent?.(person.key);
  await input.callbacks.onAction?.(kind,kind==="megaphone"?person.projectId:person.key,kind==="knock"?{text:input.settings.nudgeText??"continue"}:kind==="whip"?{text:input.settings.hurryText??HURRY}:payload);
  return true;
}
export const BOSS_FRAMES: Record<BossAction,readonly number[]>={tap:[14,15],knock:[16,17],buzzer:[18,19],bonk:[20,21,22],megaphone:[24,25],coffee:[26,27],"high-five":[28,29],whip:[32,33,34],zap:[36,37]};
