import { describe, expect, it } from 'vitest';
import {
  buildThermoCycleSolverPayload,
  normalizeExternalCycleResult,
} from './thermoCycleProfessionalAdapter';

describe('thermoCycleProfessionalAdapter', () => {
  it('builds a normalized payload for a steam cycle', () => {
    const payload = buildThermoCycleSolverPayload({
      cycleId: 'rankine',
      variant: 'reheat',
      inputs: {
        p_high: 120,
        p_low: 0.08,
      },
      localResult: {
        actualPoints: [{}, {}, {}, {}, {}, {}],
        stats: {
          eta: 39.2,
          power: 2400,
        },
      },
    });

    expect(payload.cycle.id).toBe('rankine');
    expect(payload.cycle.family).toBe('steam');
    expect(payload.workingFluid.primary).toBe('Water');
    expect(payload.localReference.available).toBe(true);
    expect(payload.localReference.shape.actualPoints).toBe(6);
    expect(payload.localReference.shape.stats).toContain('eta');
  });

  it('merges external stats into the local result shape', () => {
    const localResult = {
      actualPoints: [{ name: '1' }, { name: '2' }],
      stats: {
        eta: 35,
        power: 1200,
      },
    };

    const normalized = normalizeExternalCycleResult(
      {
        result: {
          stats: {
            eta: 38,
            q_in: 3200,
          },
          diagramData: {
            ts: { traces: 4 },
          },
        },
        solver: {
          source: 'external',
          engine: 'tespy',
          diagramEngine: 'fluprodia',
          detail: 'TESPy + CoolProp',
        },
      },
      localResult,
    );

    expect(normalized.result.actualPoints).toHaveLength(2);
    expect(normalized.result.stats.eta).toBe(38);
    expect(normalized.result.stats.power).toBe(1200);
    expect(normalized.result.stats.q_in).toBe(3200);
    expect(normalized.solverMeta.engine).toBe('tespy');
  });

  it('falls back cleanly on invalid external responses', () => {
    const localResult = {
      points: [{ name: '1' }, { name: '2' }],
      stats: { eta: 56 },
    };

    const normalized = normalizeExternalCycleResult(null, localResult);

    expect(normalized.result).toBe(localResult);
    expect(normalized.solverMeta.usedFallback).toBe(true);
    expect(normalized.solverMeta.source).toBe('local');
  });
});
