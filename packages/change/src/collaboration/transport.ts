/**
 * Collaboration transport boundary (ADR-019).
 * Transport carries envelope wire bytes only — no OT, no Version creation.
 */

/**
 * Explicit ACK ladder — do not treat these as aliases.
 *
 * - received: transport/server received the bytes
 * - persisted: server stored the relevant durable record
 * - accepted: change entered authoritative collaboration ordering / OT acceptance
 * - history: resulting Version is part of the authoritative durable lineage
 */
export type CollabAckLevel =
  | 'received'
  | 'persisted'
  | 'accepted'
  | 'history';

export const COLLAB_ACK_LEVELS: readonly CollabAckLevel[] = Object.freeze([
  'received',
  'persisted',
  'accepted',
  'history',
]);

export function isCollabAckLevel(value: unknown): value is CollabAckLevel {
  return (
    value === 'received' ||
    value === 'persisted' ||
    value === 'accepted' ||
    value === 'history'
  );
}

/**
 * Provider-neutral transport: serialized envelopes only.
 * Does not understand ChangeSet algebra, OT, or Document mutation.
 */
export interface CollaborationTransport {
  /** Send a serialized collab envelope (ADR-012 wire document). */
  send(envelopeWire: unknown): void | Promise<void>;

  /**
   * Subscribe to inbound envelope wire messages.
   * Returns unsubscribe.
   */
  onMessage(handler: (envelopeWire: unknown) => void): () => void;
}

export type TransportErrorCode =
  | 'transport_error'
  | 'not_connected'
  | 'invalid_message';

export class TransportError extends Error {
  readonly code: TransportErrorCode;
  readonly causeError?: unknown;

  constructor(
    code: TransportErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'TransportError';
    this.code = code;
    this.causeError = options?.cause;
  }
}

/**
 * In-memory fake transport for contract tests only — not a network stack.
 */
export class InMemoryCollaborationTransport implements CollaborationTransport {
  private readonly handlers = new Set<(envelopeWire: unknown) => void>();
  private connected = true;
  readonly sent: unknown[] = [];

  disconnect(): void {
    this.connected = false;
  }

  connect(): void {
    this.connected = true;
  }

  send(envelopeWire: unknown): void {
    if (!this.connected) {
      throw new TransportError('not_connected', 'transport not connected');
    }
    this.sent.push(envelopeWire);
    for (const h of this.handlers) {
      h(envelopeWire);
    }
  }

  onMessage(handler: (envelopeWire: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Deliver a message as if from the peer (tests). */
  deliver(envelopeWire: unknown): void {
    if (!this.connected) {
      throw new TransportError('not_connected', 'transport not connected');
    }
    for (const h of this.handlers) {
      h(envelopeWire);
    }
  }
}
