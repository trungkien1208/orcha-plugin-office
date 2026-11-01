import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";

export type SocketOptions = {
  /** Explicit path. Wins over everything else. */
  socket?: string;
  /** Orcha session name → ~/.config/orcha/sessions/<name>/herdr.sock */
  session?: string;
};

export type ConnectEnv = {
  EASY_JOB_SOCKET?: string;
  /** Old name, still read. */
  ORCHA_OFFICE_SOCKET?: string;
  HERDR_SOCKET_PATH?: string;
  HOME?: string;
};

export function resolveSocketPath(
  opts: SocketOptions = {},
  env: ConnectEnv = {
    EASY_JOB_SOCKET: process.env.EASY_JOB_SOCKET,
    ORCHA_OFFICE_SOCKET: process.env.ORCHA_OFFICE_SOCKET,
    HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH,
    HOME: process.env.HOME,
  },
  exists: (file: string) => boolean = fs.existsSync,
): string {
  if (opts.socket) return opts.socket;
  if (env.EASY_JOB_SOCKET) return env.EASY_JOB_SOCKET;
  if (env.ORCHA_OFFICE_SOCKET) return env.ORCHA_OFFICE_SOCKET;
  const home = env.HOME ?? os.homedir();
  const herdr = path.join(home, ".config", "herdr", "herdr.sock");
  if (opts.session) {
    const sessionSock = path.join(home, ".config", "orcha", "sessions", opts.session, "herdr.sock");
    return exists(sessionSock) ? sessionSock : herdr;
  }
  if (env.HERDR_SOCKET_PATH) return env.HERDR_SOCKET_PATH;
  const orcha = path.join(home, ".config", "orcha", "herdr.sock");
  return exists(orcha) ? orcha : herdr;
}

export type Conn = {
  send(value: unknown): void;
  /** Next parsed JSON line, or null when the socket closes. Bad lines are logged and skipped. */
  next(): Promise<unknown | null>;
  close(): void;
};

export function connect(socketPath: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const conn = new SocketConn(socket);
    let settled = false;
    socket.on("connect", () => {
      if (!settled) {
        settled = true;
        resolve(conn);
      }
    });
    // Keep the listener for the life of the socket. A later error must not crash the process.
    // Windows named pipes use the same net.connect path; only this file should grow a pipe-specific branch.
    socket.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
        return;
      }
      conn.fail(error);
    });
  });
}

class SocketConn implements Conn {
  private buf = "";
  private queue: unknown[] = [];
  private waiter: ((value: unknown | null) => void) | null = null;
  private closed = false;

  constructor(private socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => this.push(chunk));
    socket.on("close", () => this.end());
  }

  send(value: unknown): void {
    this.socket.write(`${JSON.stringify(value)}\n`);
  }

  next(): Promise<unknown | null> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  close(): void {
    this.socket.end();
    this.end();
  }

  fail(error: Error): void {
    console.error(`Orcha socket error: ${error.message}`);
    this.end();
  }

  private push(chunk: string): void {
    this.buf += chunk;
    let newline = this.buf.indexOf("\n");
    while (newline >= 0) {
      const raw = this.buf.slice(0, newline).replace(/\r$/, "");
      this.buf = this.buf.slice(newline + 1);
      if (raw.trim()) {
        try {
          this.deliver(JSON.parse(raw) as unknown);
        } catch {
          console.error("skipped an Orcha line that was not JSON");
        }
      }
      newline = this.buf.indexOf("\n");
    }
  }

  private deliver(value: unknown): void {
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(value);
      return;
    }
    this.queue.push(value);
  }

  private end(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(null);
    }
  }
}
