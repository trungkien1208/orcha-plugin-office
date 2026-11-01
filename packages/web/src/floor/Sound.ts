/** Audio stays local. A missing server sound uses a short synthesized cartoon cue. */
export class FloorSound {
  private context?: AudioContext;
  private playing = new Set<HTMLAudioElement>();
  unlock() { this.context ??= new AudioContext(); void this.context.resume().catch(() => undefined); }
  play(kind: string, muted: boolean, url?: string) {
    if (muted) return;
    if (url) { const audio = new Audio(url); this.playing.add(audio); const stop = () => { audio.pause(); this.playing.delete(audio); }; audio.onended = stop; void audio.play().catch(stop); setTimeout(stop, 1900); return; }
    const c = this.context; if (c?.state !== "running") return;
    const o = c.createOscillator(), g = c.createGain(); o.type = kind === "gong" ? "sine" : "triangle"; o.frequency.setValueAtTime(kind === "zap" ? 320 : kind === "gong" ? 180 : 600, c.currentTime); o.frequency.exponentialRampToValueAtTime(70, c.currentTime + .2); g.gain.setValueAtTime(.05,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.35); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+.36);
  }
  destroy() { for (const audio of this.playing) audio.pause(); this.playing.clear(); void this.context?.close(); }
}
