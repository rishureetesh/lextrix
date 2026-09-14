/**
 * Explicit Phase-10 collaboration resource limits (defaults).
 */
export interface CollabLimits {
  maxRebaseDepth: number;
  maxPendingEnvelopes: number;
  maxDependencyCount: number;
}

export const DEFAULT_COLLAB_LIMITS: Readonly<CollabLimits> = Object.freeze({
  maxRebaseDepth: 64,
  maxPendingEnvelopes: 256,
  /** Align with WIRE_LIMITS.maxDependsOn */
  maxDependencyCount: 256,
});
