/**
 * Deterministic mulberry32 PRNG for reproducible fuzz failures.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxExclusive: number): number {
    return (
      minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive))
    );
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)]!;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}
