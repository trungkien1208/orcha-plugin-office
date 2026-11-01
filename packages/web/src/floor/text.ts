import Phaser from "phaser";
export function crisp(scene: Phaser.Scene, x: number, y: number, value: string, size = 11, color = "#2f3a4f"): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, value, { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: `${size}px`, color, resolution: Math.min(4, Math.ceil((window.devicePixelRatio || 1) * 2)), padding: { x: 0, y: 0 } });
  text.setData("fullText", value);
  text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); return text;
}
export function fitText(text: Phaser.GameObjects.Text, width: number) {
  const full = String(text.getData("fullText") ?? text.text); text.setText(full);
  const suffix = full.match(/_\d+$/)?.[0] ?? ""; const body=suffix ? full.slice(0,-suffix.length) : full;
  let end = body.length;
  while (text.width * text.scaleX > width && end > 0) text.setText(`${body.slice(0, --end).trimEnd()}…${suffix}`);
  text.setData("fitWidth", width); text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
export function refreshText(text: Phaser.GameObjects.Text, zoom = 1) {
  // Keep labels at screen size when zoomed in; when the floor is shrunk to fit, shrink them with it (a little less) so they stay inside tags and banners.
  text.setScale(1 / Math.max(zoom, 0.8)); text.updateText();
  const width = text.getData("fitWidth"); if (typeof width === "number") fitText(text, width);
  text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
