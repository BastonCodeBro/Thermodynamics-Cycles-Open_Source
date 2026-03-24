import { useId } from 'react';

const InputField = ({ label, value, onChange, type = 'number', step, min, max, unit, accent = '#38BDF8' }) => {
  const inputId = useId();

  const handleChange = (rawValue) => {
    if (rawValue === '') {
      onChange(null);
      return;
    }
    const parsed = Number(rawValue);
    onChange(Number.isFinite(parsed) ? parsed : null);
  };

  return (
  <div className="input-field">
    <label className="input-label" htmlFor={inputId}>
      {label}
      {unit && <span className="input-unit">{unit}</span>}
    </label>
    {type === 'range' ? (
      <div className="range-wrapper">
        <input
          id={inputId}
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step || 1}
          value={value ?? min ?? 0}
          onChange={e => handleChange(e.target.value)}
          style={{ '--accent': accent }}
        />
        <span className="range-value" style={{ color: accent }}>{value}</span>
      </div>
    ) : (
      <input
        id={inputId}
        type="number"
        step={step}
        min={min}
        max={max}
        className="glass-input"
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{ '--focus-color': accent }}
      />
    )}
  </div>
  );
};

export default InputField;
