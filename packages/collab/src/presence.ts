/**
 * Ephemeral presence (ADR-032). Never Version / ChangeSet / history.
 */
export type PresencePayload = {
  cursor?: unknown;
  selection?: unknown;
  status?: 'online' | 'away' | string;
};

export type PresenceEntry = {
  documentId: string;
  actorId: string;
  generation: number;
  serverTime: number;
  payload: PresencePayload;
};

export type PresenceLimits = {
  maxParticipants: number;
  maxUpdatesPerSecondPerActor: number;
  maxPayloadBytes: number;
  ttlMs: number;
  maxQueueDepth: number;
};

export const DEFAULT_PRESENCE_LIMITS: PresenceLimits = {
  maxParticipants: 64,
  maxUpdatesPerSecondPerActor: 20,
  maxPayloadBytes: 4096,
  ttlMs: 30_000,
  maxQueueDepth: 256,
};

export type PresencePublishResult =
  | { ok: true; entry: PresenceEntry; dropped?: false }
  | { ok: false; reason: 'queue_full' | 'rate_limited' | 'oversized' | 'capacity' | 'invalid' };

/**
 * In-memory per-document presence. Best-effort; drop under load.
 */
export class EphemeralPresenceStore {
  private readonly byDoc = new Map<string, Map<string, PresenceEntry>>();
  private readonly updateTimes = new Map<string, number[]>();
  private queueDepth = 0;
  private readonly limits: PresenceLimits;

  constructor(limits: Partial<PresenceLimits> = {}) {
    this.limits = { ...DEFAULT_PRESENCE_LIMITS, ...limits };
  }

  publish(
    documentId: string,
    actorId: string,
    generation: number,
    payload: PresencePayload,
  ): PresencePublishResult {
    if (!actorId || typeof actorId !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    const size = roughSize(payload);
    if (size > this.limits.maxPayloadBytes) {
      return { ok: false, reason: 'oversized' };
    }
    if (this.queueDepth >= this.limits.maxQueueDepth) {
      return { ok: false, reason: 'queue_full' };
    }

    const rateKey = `${documentId}\0${actorId}`;
    const now = Date.now();
    const window = this.updateTimes.get(rateKey) ?? [];
    const recent = window.filter((t) => now - t < 1000);
    if (recent.length >= this.limits.maxUpdatesPerSecondPerActor) {
      return { ok: false, reason: 'rate_limited' };
    }
    recent.push(now);
    this.updateTimes.set(rateKey, recent);

    let map = this.byDoc.get(documentId);
    if (!map) {
      map = new Map();
      this.byDoc.set(documentId, map);
    }
    const existing = map.get(actorId);
    if (
      existing &&
      generation < existing.generation
    ) {
      // Stale generation — ignore (latest-wins).
      return { ok: true, entry: existing };
    }
    if (!existing && map.size >= this.limits.maxParticipants) {
      return { ok: false, reason: 'capacity' };
    }

    const entry: PresenceEntry = {
      documentId,
      actorId,
      generation,
      serverTime: now,
      payload: { ...payload },
    };
    map.set(actorId, entry);
    this.queueDepth = Math.min(this.queueDepth + 1, this.limits.maxQueueDepth);
    return { ok: true, entry };
  }

  remove(documentId: string, actorId: string): void {
    this.byDoc.get(documentId)?.delete(actorId);
  }

  clearDocument(documentId: string): void {
    this.byDoc.delete(documentId);
  }

  /** Drop expired entries; return removed actorIds. */
  expire(documentId: string, now = Date.now()): string[] {
    const map = this.byDoc.get(documentId);
    if (!map) return [];
    const removed: string[] = [];
    for (const [actorId, entry] of map) {
      if (now - entry.serverTime > this.limits.ttlMs) {
        map.delete(actorId);
        removed.push(actorId);
      }
    }
    return removed;
  }

  list(documentId: string): PresenceEntry[] {
    this.expire(documentId);
    return [...(this.byDoc.get(documentId)?.values() ?? [])];
  }

  /** Test helper: simulate presence subsystem failure by clearing all. */
  crash(): void {
    this.byDoc.clear();
    this.updateTimes.clear();
    this.queueDepth = 0;
  }
}

function roughSize(payload: PresencePayload): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
