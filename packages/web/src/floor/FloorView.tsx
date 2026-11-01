import { useEffect, useMemo, useRef, useState } from "react";
import { emptyFloorOffice } from "./contract.ts";
import type { FloorHud, FloorInput, FloorViewProps } from "./contract.ts";
import { ActionMenu } from "./ActionMenu.tsx";
import { loadArt } from "./manifest.ts";
import { mountFloor } from "./mount.ts";
import "./floor.css";
const EMPTY = emptyFloorOffice(), SETTINGS = {};
export function FloorView(props: FloorViewProps = {}) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<ReturnType<typeof mountFloor> | null>(null);
  const [hud, setHud] = useState<FloorHud>({ near: null, zoom: 1, ready: false });
  const input = useMemo<FloorInput>(() => ({ office: props.office ?? EMPTY, selected: props.selectedAgentKey ?? null, settings: props.settings ?? SETTINGS, callbacks: { onSearch: props.onSearch, onSelectAgent: props.onSelectAgent, onSelectProject: props.onSelectProject, onAction: props.onAction } }), [props.onSearch, props.office, props.selectedAgentKey, props.settings, props.onSelectAgent, props.onSelectProject, props.onAction]);
  const latest = useRef(input); latest.current = input;
  useEffect(() => { let live = true; void loadArt(props.manifestUrl).then((bank) => { if (live && host.current) renderer.current = mountFloor(host.current, bank, latest.current, setHud); }); return () => { live = false; renderer.current?.destroy(); renderer.current = null; }; }, [props.manifestUrl]);
  useEffect(() => { renderer.current?.scene.setInput(input); }, [input]);
  useEffect(()=>{const fly=(event:Event)=>{const detail=(event as CustomEvent<{from:string;to:string}>).detail;renderer.current?.scene.teamFlight(detail.from,detail.to);};window.addEventListener('easy-job-team-flight',fly);return()=>window.removeEventListener('easy-job-team-flight',fly);},[]);
  // The Agent the Boss is standing next to becomes the selected one (after a short pause, so walking past does not flip the chat).
  const nearKey = hud.near?.key;
  const onSelect = props.onSelectAgent, selectedKey = props.selectedAgentKey;
  useEffect(() => {
    if (!nearKey || nearKey === selectedKey) return;
    const timer = setTimeout(() => onSelect?.(nearKey), 300);
    return () => clearTimeout(timer);
  }, [nearKey, selectedKey, onSelect]);
  return <section className="ej-floor" aria-label="Easy Job pixel Floor"><div className="ej-floor-canvas" ref={host} role="application" aria-label="Pixel Floor. Click an Agent to select it." /><div className="ej-floor-hud" aria-live="polite">{hud.ready ? `${input.office.projects.length} Projects · ${input.office.agents.length} Agents` : "Loading office art…"}</div>{hud.near && <ActionMenu key={hud.near.key} near={hud.near} connected={input.office.orcha.connected} calm={!!input.settings.calm} close={()=>renderer.current?.scene.actions.close()} perform={async(kind,key,payload)=>await renderer.current?.scene.actions.perform(kind,key,payload)??"Floor unavailable"} />}<div className="ej-floor-activity" aria-live="polite">{hud.activity}</div></section>;
}
