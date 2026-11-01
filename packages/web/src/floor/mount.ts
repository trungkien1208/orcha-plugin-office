import Phaser from "phaser";
import { FloorScene } from "./FloorScene.ts";
import type { FloorHud, FloorInput } from "./contract.ts";
import type { ArtBank } from "./manifest.ts";
export function mountFloor(host: HTMLElement, bank: ArtBank, input: FloorInput, onHud: (hud: FloorHud) => void) {
  host.tabIndex = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), scene = new FloorScene(bank, host,dpr); scene.setInput(input); scene.onHud = onHud;
  if (new URLSearchParams(location.search).has("demo")) Object.assign(host,{floorScene:scene});
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: host.clientWidth * dpr, height: host.clientHeight * dpr, pixelArt: true, roundPixels: true, antialias: false, backgroundColor: "#c9d8d4", scene: [scene], scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr }, input: { keyboard: { target: host } }, audio: { noAudio: true } });
  const observer = new ResizeObserver(() => { const w = host.clientWidth * dpr, h = host.clientHeight * dpr; if (w && h && (game.scale.width !== w || game.scale.height !== h)) { game.scale.resize(w, h); scene.resize(); } }); observer.observe(host);
  return { scene, destroy() { observer.disconnect(); scene.onHud = () => undefined; game.destroy(true); } };
}
