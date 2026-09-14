/**
 * WebSocket transport adapter for collab control frames (ADR-024).
 * Does not mutate Documents — host routes frames to DocumentServerSession.
 */
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import {
  isCollabControlFrame,
  type CollabControlFrame,
} from 'lextrix-collab';

export type WsConnectionId = string;

export interface WsCollabConnection {
  id: WsConnectionId;
  send(frame: CollabControlFrame): void;
  close(): void;
}

export interface WsCollabServerOptions {
  server?: HttpServer;
  port?: number;
  path?: string;
  maxOutboundQueue?: number;
  heartbeatMs?: number;
  onConnection: (conn: WsCollabConnection, info: {
    token?: string;
    headers: Record<string, string | string[] | undefined>;
  }) => void | Promise<void>;
  onMessage: (
    conn: WsCollabConnection,
    frame: CollabControlFrame,
  ) => void | Promise<void>;
  onClose?: (conn: WsCollabConnection) => void;
  observe?: (event: { name: string; detail?: Record<string, unknown> }) => void;
}

let connCounter = 0;

export class WsCollabServer {
  private readonly wss: WebSocketServer;
  private readonly maxOutboundQueue: number;
  private readonly heartbeatMs: number;
  private readonly sockets = new Map<WsConnectionId, {
    ws: WebSocket;
    queue: CollabControlFrame[];
    alive: boolean;
  }>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: WsCollabServerOptions) {
    this.maxOutboundQueue = options.maxOutboundQueue ?? 256;
    this.heartbeatMs = options.heartbeatMs ?? 15_000;
    this.wss = new WebSocketServer({
      server: options.server,
      port: options.server ? undefined : options.port ?? 0,
      path: options.path ?? '/collab',
    });
    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatMs);
  }

  get address(): { port?: number } {
    const addr = this.wss.address();
    if (addr && typeof addr === 'object') return { port: addr.port };
    return {};
  }

  close(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  private async handleConnection(
    ws: WebSocket,
    req: { url?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<void> {
    connCounter += 1;
    const id = `ws_${Date.now().toString(36)}_${connCounter}`;
    const entry = { ws, queue: [] as CollabControlFrame[], alive: true };
    this.sockets.set(id, entry);
    this.options.observe?.({ name: 'ws_connected', detail: { connectionId: id } });

    const conn: WsCollabConnection = {
      id,
      send: (frame) => this.enqueue(id, frame),
      close: () => ws.close(),
    };

    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token') ?? undefined;

    ws.on('message', (data) => {
      void this.onRawMessage(conn, data);
    });
    ws.on('pong', () => {
      const e = this.sockets.get(id);
      if (e) e.alive = true;
    });
    ws.on('close', () => {
      this.sockets.delete(id);
      this.options.observe?.({ name: 'ws_disconnected', detail: { connectionId: id } });
      this.options.onClose?.(conn);
    });

    await this.options.onConnection(conn, { token, headers: req.headers });
  }

  private async onRawMessage(
    conn: WsCollabConnection,
    data: WebSocket.RawData,
  ): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(data));
    } catch {
      conn.send({
        type: 'error',
        code: 'invalid_json',
        message: 'malformed JSON',
      });
      return;
    }
    if (!isCollabControlFrame(parsed)) {
      conn.send({
        type: 'error',
        code: 'invalid_frame',
        message: 'not a collab control frame',
      });
      return;
    }
    await this.options.onMessage(conn, parsed);
  }

  private enqueue(id: WsConnectionId, frame: CollabControlFrame): void {
    const entry = this.sockets.get(id);
    if (!entry) return;
    if (entry.queue.length >= this.maxOutboundQueue) {
      this.options.observe?.({
        name: 'ws_queue_full',
        detail: { connectionId: id },
      });
      entry.ws.close(1013, 'queue_full');
      return;
    }
    entry.queue.push(frame);
    this.flush(id);
  }

  private flush(id: WsConnectionId): void {
    const entry = this.sockets.get(id);
    if (!entry || entry.ws.readyState !== entry.ws.OPEN) return;
    while (entry.queue.length > 0) {
      const frame = entry.queue.shift()!;
      entry.ws.send(JSON.stringify(frame));
    }
  }

  private heartbeat(): void {
    for (const [id, entry] of this.sockets) {
      if (!entry.alive) {
        entry.ws.terminate();
        this.sockets.delete(id);
        continue;
      }
      entry.alive = false;
      try {
        entry.ws.ping();
      } catch {
        entry.ws.terminate();
        this.sockets.delete(id);
      }
    }
  }
}
