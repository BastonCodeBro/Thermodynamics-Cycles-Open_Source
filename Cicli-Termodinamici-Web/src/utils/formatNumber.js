const isFiniteNumber = (value) => Number.isFinite(value);

/**
 * Formats a number with consistent significant figures.
 * @param {number} value
 * @param {'energy'|'temperature'|'pressure'|'volume'|'entropy'|'generic'} type
 * @returns {string}
 */
export function formatValue(value, type = 'generic') {
  if (value === undefined || value === null || !isFiniteNumber(value)) return '\u2014';
  const a = Math.abs(value);

  switch (type) {
    case 'energy':
      return a >= 100 ? value.toFixed(1) : value.toFixed(2);
    case 'temperature':
      return a >= 100 ? value.toFixed(0) : value.toFixed(1);
    case 'pressure':
      if (a >= 100) return value.toFixed(1);
      if (a >= 1) return value.toFixed(2);
      return value.toFixed(4);
    case 'volume':
      if (a >= 1) return value.toFixed(4);
      if (a >= 0.01) return value.toFixed(5);
      return value.toFixed(6);
    case 'entropy':
      return a >= 1 ? value.toFixed(3) : value.toFixed(5);
    default:
      if (a >= 1000) return value.toFixed(1);
      if (a >= 100) return value.toFixed(2);
      if (a >= 1) return value.toFixed(3);
      if (a >= 0.01) return value.toFixed(4);
      if (a >= 0.001) return value.toFixed(5);
      return value.toFixed(6);
  }
}
