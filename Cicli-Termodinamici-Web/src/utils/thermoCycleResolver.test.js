import { describe, expect, it } from 'vitest';
import { resolveCycleDisplayResult } from './thermoCycleResolver';

describe('thermoCycleResolver', () => {
  it('maps the local result when no external solver is configured', async () => {
    const resolved = await resolveCycleDisplayResult({
      cycleId: 'otto',
      inputs: { r: 8 },
      computeLocalResult: async () => ({
        points: [{ name: '1' }, { name: '2' }],
        stats: { eta: 42 },
      }),
      mapResultToDisplay: (result) => ({
        pointCount: result.points.length,
        eta: result.stats.eta,
      }),
    });

    expect(resolved.pointCount).toBe(2);
    expect(resolved.eta).toBe(42);
    expect(resolved.solverMeta.source).toBe('local');
  });
});
