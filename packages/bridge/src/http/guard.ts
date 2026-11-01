export function allowedHost(host: string | null, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function allowedOrigin(origin: string | null, origins: readonly string[]): boolean {
  if (!origin) return true;
  return origins.includes(origin);
}

export function bearer(header: string | null, token: string): boolean {
  return header === `Bearer ${token}`;
}

export function websocketToken(protocol: string | null, token: string): string | null {
  const expected = `easy-job.${token}`;
  const match = (protocol ?? "")
    .split(",")
    .map((part) => part.trim())
    .find((part) => part === expected);
  return match ?? null;
}
