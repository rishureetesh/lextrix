/**
 * Home-region authority contracts (ADR-033).
 * One home region per document; no active-active multi-writer.
 */
export interface DocumentRegionStore {
  getHomeRegion(documentId: string): Promise<string | null> | string | null;
  setHomeRegion(documentId: string, region: string): Promise<void> | void;
}

export class InMemoryDocumentRegionStore implements DocumentRegionStore {
  private readonly home = new Map<string, string>();

  getHomeRegion(documentId: string): string | null {
    return this.home.get(documentId) ?? null;
  }

  setHomeRegion(documentId: string, region: string): void {
    this.home.set(documentId, region);
  }

  clear(): void {
    this.home.clear();
  }
}

/**
 * Hash documentId → region from a configured ring (not OT semantics).
 */
export function assignHomeRegion(
  documentId: string,
  regions: readonly string[],
): string {
  if (regions.length === 0) {
    throw new Error('assignHomeRegion: empty regions');
  }
  let h = 0;
  for (let i = 0; i < documentId.length; i += 1) {
    h = (h * 31 + documentId.charCodeAt(i)) >>> 0;
  }
  return regions[h % regions.length]!;
}

export type RegionPromotionResult = {
  documentId: string;
  fromRegion: string;
  toRegion: string;
  ownerEpoch: number;
};

/**
 * Explicit promotion hook: bump durable owner_epoch then set home region.
 * Deployment owns replication readiness; Lextrix only fences writes.
 */
export async function promoteDocumentRegion(options: {
  documentId: string;
  toRegion: string;
  regions: DocumentRegionStore;
  bumpOwnerEpoch: (documentId: string) => Promise<number> | number;
  fromRegion?: string;
}): Promise<RegionPromotionResult> {
  const from =
    options.fromRegion ??
    (await Promise.resolve(options.regions.getHomeRegion(options.documentId))) ??
    'unknown';
  const ownerEpoch = await Promise.resolve(
    options.bumpOwnerEpoch(options.documentId),
  );
  await Promise.resolve(
    options.regions.setHomeRegion(options.documentId, options.toRegion),
  );
  return {
    documentId: options.documentId,
    fromRegion: from,
    toRegion: options.toRegion,
    ownerEpoch,
  };
}
