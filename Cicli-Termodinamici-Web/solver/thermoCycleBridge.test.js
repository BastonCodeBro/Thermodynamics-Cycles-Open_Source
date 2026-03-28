import { describe, expect, it } from 'vitest';
import {
  getThermoCycleCapabilities,
  solveThermoCyclePayload,
  validateThermoCyclePayload,
} from './thermoCycleBridge.js';

describe('thermoCycleBridge', () => {
  it('validates the minimal payload', () => {
    expect(validateThermoCyclePayload(null).valid).toBe(false);
    expect(validateThermoCyclePayload({ cycle: { id: 'otto' }, inputs: {} }).valid).toBe(true);
  });

  it('solves an ideal gas cycle through the bridge', async () => {
    const response = await solveThermoCyclePayload({
      cycle: { id: 'otto' },
      inputs: {
        p1Bar: 1,
        t1C: 25,
        r: 8,
        t3C: 1400,
        eta: 0.85,
        massFlow: 1,
      },
    });

    expect(response.ok).toBe(true);
    expect(response.result.points).toHaveLength(4);
    expect(response.result.stats.eta).toBeGreaterThan(0);
  });

  it('exposes capabilities', async () => {
    const capabilities = await getThermoCycleCapabilities();

    expect(capabilities.available).toBe(true);
    expect(capabilities.cycleFamilies).toContain('steam');
  });
});
