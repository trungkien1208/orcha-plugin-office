export function statusFrame(status: string, time: number, reduced: boolean): number {
  const phase = reduced ? 0 : Math.floor(time/320)%2;
  return status === "working" ? 16+(reduced ? 0 : Math.floor(time/160)%4) : status === "blocked" ? 20+phase : status === "done" ? 22+phase : status === "idle" ? 24+phase : 26;
}
