const OUT = "#2f3a4f";
export function paintWorker(color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 72;
  const g = canvas.getContext("2d"); if (!g) return canvas;
  const box = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = OUT; g.fillRect(x,y,w,h); g.fillStyle = c; g.fillRect(x+1,y+1,w-2,h-2); };
  box(16,20,16,18,"#c79776"); box(16,20,16,7,"#5b4438"); box(13,37,22,22,color);
  box(16,58,7,14,"#48566e"); box(25,58,7,14,"#48566e"); box(19,39,9,12,"#e3ece9");
  return canvas;
}
export function paintBoss(): HTMLCanvasElement { return paintWorker("#2a2f38"); }
