/**
 * Vendor-neutral observability (ADR-029).
 */
export type ServerMetricEvent = {
  name: string;
  documentId?: string;
  detail?: Record<string, unknown>;
  ts?: number;
};

export type ServerObserver = (event: ServerMetricEvent) => void;

export function createCountingObserver(): {
  observe: ServerObserver;
  counts: Map<string, number>;
} {
  const counts = new Map<string, number>();
  return {
    counts,
    observe(event) {
      counts.set(event.name, (counts.get(event.name) ?? 0) + 1);
    },
  };
}
