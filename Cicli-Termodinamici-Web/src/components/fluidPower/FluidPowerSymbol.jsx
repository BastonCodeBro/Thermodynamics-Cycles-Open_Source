import React from 'react';

const domainColor = (component, active) => {
  const base = component.domain === 'hydraulic' ? '#F59E0B' : '#38BDF8';
  return active ? '#22D3EE' : base;
};

const Box = ({ border = '#38BDF8', fill = '#0F172A' }) => (
  <rect x="12" y="12" width="136" height="72" rx="14" fill={fill} stroke={border} strokeWidth="3" />
);

const DirectionalValve = ({ component, color }) => {
  const family = component.simBehavior.family;
  const rightPorts = family === '2/2' || family === '3/2' ? ['A'] : ['A', 'B'];
  const segments = component.symbol === 'directional-4-3' ? 3 : 2;
  const width = segments === 3 ? 132 : 124;
  const x = segments === 3 ? 14 : 18;
  const cellWidth = width / segments;

  return (
    <>
      <rect x={x} y="20" width={width} height="56" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
      {segments === 2 ? (
        <line x1="80" y1="20" x2="80" y2="76" stroke={color} strokeWidth="2" />
      ) : (
        <>
          <line x1={x + cellWidth} y1="20" x2={x + cellWidth} y2="76" stroke={color} strokeWidth="2" />
          <line x1={x + cellWidth * 2} y1="20" x2={x + cellWidth * 2} y2="76" stroke={color} strokeWidth="2" />
        </>
      )}
      <path d="M40 48 H68" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <polygon points="68,48 58,42 58,54" fill={color} />
      {segments === 3 ? (
        <>
          <path d="M88 48 H108" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" />
          <path d="M118 48 H132" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <polygon points="132,48 122,42 122,54" fill={color} />
        </>
      ) : (
        <path d="M92 48 H120" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4" />
      )}
      <text x="30" y="30" fill={color} fontSize="12" fontWeight="800">P</text>
      {rightPorts.map((port, index) => (
        <text key={port} x="124" y={index === 0 ? 30 : 68} fill={color} fontSize="12" fontWeight="800">
          {port}
        </text>
      ))}
      {(component.simBehavior.returnPorts ?? []).map((port, index) => (
        <text key={port} x={index === 0 ? 46 : 104} y="72" fill={color} fontSize="11" fontWeight="800">
          {port}
        </text>
      ))}
      <text x="80" y="94" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="700">
        {family}
      </text>
    </>
  );
};

const RotaryMachine = ({ component, color }) => {
  const variant = component.symbolVariant ?? {};
  const isPump = variant.style === 'pump' || variant.style === 'vacuum-pump';
  const isOscillating = variant.style === 'oscillating-motor';

  if (isOscillating) {
    return (
      <>
        <rect x="30" y="26" width="88" height="40" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
        <path d="M76 26 V10" stroke={color} strokeWidth="3" />
        <path d="M56 12 Q80 -2 104 12" fill="none" stroke={color} strokeWidth="3" />
        <path d="M22 36 H30 M22 58 H30" stroke={color} strokeWidth="3" />
      </>
    );
  }

  return (
    <>
      <circle cx="80" cy="48" r="30" fill="#111827" stroke={color} strokeWidth="3" />
      <path
        d={isPump ? 'M68 60 V36 L96 48 Z' : 'M92 60 V36 L64 48 Z'}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {(variant.reversible || !isPump) && <path d="M48 48 H22" stroke={color} strokeWidth="3" />}
      <path d="M112 48 H138" stroke={color} strokeWidth="3" />
      {variant.reversible && <path d="M48 48 H22" stroke={color} strokeWidth="3" />}
      {variant.variable && <path d="M48 72 L114 18" stroke={color} strokeWidth="3" />}
      {variant.style === 'vacuum-pump' && <circle cx="80" cy="20" r="7" fill="none" stroke={color} strokeWidth="3" />}
      {component.ports.some((port) => port.kind === 'mechanical') && (
        <path d="M80 12 V24" stroke="#94A3B8" strokeWidth="3" />
      )}
    </>
  );
};

const AdvancedCylinder = ({ component, color }) => {
  const style = component.symbolVariant?.style;
  const bodyX = style === 'telescopic-single' || style === 'telescopic-double' ? 26 : 28;
  const bodyWidth = style === 'telescopic-single' || style === 'telescopic-double' ? 96 : 100;

  return (
    <>
      <rect x={bodyX} y="30" width={bodyWidth} height="36" rx="8" fill="none" stroke={color} strokeWidth="3" />
      <line x1={bodyX + bodyWidth - 12} y1="48" x2="140" y2="48" stroke={color} strokeWidth="3" />
      <circle cx="143" cy="48" r="4" fill={color} />
      <path d="M18 40 H28" stroke={color} strokeWidth="3" />
      {(style === 'double-double-rod' || style === 'cushioned-double') && (
        <path d="M18 56 H28" stroke={color} strokeWidth="3" />
      )}
      {style === 'single-spring' && <path d="M52 58 L60 38 L68 58 L76 38 L84 58" fill="none" stroke="#94A3B8" strokeWidth="2.5" />}
      {style === 'single-force' && <path d="M22 22 L36 22 M30 16 L36 22 L30 28" fill="none" stroke="#94A3B8" strokeWidth="2.5" />}
      {style === 'double-double-rod' && <line x1="28" y1="48" x2="12" y2="48" stroke={color} strokeWidth="3" />}
      {style === 'cushioned-single' && <path d="M114 34 L122 48 L114 62" fill="none" stroke="#94A3B8" strokeWidth="2.5" />}
      {style === 'cushioned-double' && (
        <>
          <path d="M114 34 L122 48 L114 62" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
          <path d="M36 34 L28 48 L36 62" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
        </>
      )}
      {style === 'adjustable-cushion' && (
        <>
          <path d="M114 34 L122 48 L114 62" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
          <path d="M36 34 L28 48 L36 62" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
          <path d="M30 24 L42 12" stroke={color} strokeWidth="2.5" />
          <path d="M106 24 L118 12" stroke={color} strokeWidth="2.5" />
        </>
      )}
      {style === 'telescopic-single' && (
        <>
          <rect x="38" y="36" width="56" height="24" rx="6" fill="none" stroke={color} strokeWidth="2.5" />
          <rect x="52" y="40" width="34" height="16" rx="4" fill="none" stroke={color} strokeWidth="2.5" />
        </>
      )}
      {style === 'telescopic-double' && (
        <>
          <rect x="38" y="36" width="56" height="24" rx="6" fill="none" stroke={color} strokeWidth="2.5" />
          <rect x="52" y="40" width="34" height="16" rx="4" fill="none" stroke={color} strokeWidth="2.5" />
          <line x1="28" y1="48" x2="12" y2="48" stroke={color} strokeWidth="3" />
        </>
      )}
    </>
  );
};

const ControlValve = ({ component, color }) => {
  const style = component.symbolVariant?.style;

  switch (style) {
    case 'check':
      return (
        <>
          <rect x="28" y="26" width="104" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M44 48 H116" stroke={color} strokeWidth="3" />
          <polygon points="70,38 92,48 70,58" fill="none" stroke={color} strokeWidth="3" />
          <line x1="102" y1="34" x2="102" y2="62" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pilot-check':
      return (
        <>
          <rect x="22" y="22" width="116" height="52" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M38 48 H118" stroke={color} strokeWidth="3" />
          <polygon points="64,38 86,48 64,58" fill="none" stroke={color} strokeWidth="3" />
          <line x1="96" y1="34" x2="96" y2="62" stroke={color} strokeWidth="3" />
          <path d="M116 22 V10 H148" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="5 4" />
        </>
      );
    case 'throttle-check':
      return (
        <>
          <rect x="18" y="20" width="124" height="56" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M34 48 H126" stroke={color} strokeWidth="3" />
          <path d="M44 62 L112 34" stroke={color} strokeWidth="3" />
          <polygon points="72,38 94,48 72,58" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'shuttle':
      return (
        <>
          <rect x="24" y="28" width="112" height="40" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <circle cx="62" cy="48" r="10" fill="none" stroke={color} strokeWidth="3" />
          <path d="M72 48 H118" stroke={color} strokeWidth="3" />
          <path d="M18 48 H52" stroke={color} strokeWidth="3" />
        </>
      );
    case 'quick-exhaust':
      return (
        <>
          <rect x="20" y="22" width="120" height="52" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <circle cx="58" cy="48" r="10" fill="none" stroke={color} strokeWidth="3" />
          <path d="M68 48 H120" stroke={color} strokeWidth="3" />
          <path d="M58 22 V8" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pressure-relief':
    case 'pressure-relief-pilot':
    case 'sequence':
    case 'pressure-reducer':
      return (
        <>
          <rect x="32" y="24" width="96" height="48" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M18 48 H32 M128 48 H142" stroke={color} strokeWidth="3" />
          <path d="M46 60 L54 40 L62 60 L70 40 L78 60" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
          {style !== 'sequence' && <path d="M86 48 H112" stroke={color} strokeWidth="3" />}
          {style === 'sequence' && <path d="M84 40 H112 M84 56 H112" stroke={color} strokeWidth="3" />}
          {style === 'pressure-relief-pilot' && <path d="M128 24 V10 H148" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="5 4" />}
        </>
      );
    case 'throttle':
      return (
        <>
          <rect x="28" y="26" width="104" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M40 48 H120" stroke={color} strokeWidth="3" />
          <path d="M54 62 L106 34" stroke={color} strokeWidth="3" />
        </>
      );
    case 'flow-divider':
      return (
        <>
          <rect x="20" y="20" width="120" height="56" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M80 24 V72" stroke={color} strokeWidth="3" />
          <path d="M52 58 L68 40 M92 40 L108 58" stroke={color} strokeWidth="3" />
        </>
      );
    case 'isolation':
      return (
        <>
          <path d="M26 48 H54" stroke={color} strokeWidth="3" />
          <path d="M54 48 L72 36 L90 48 L108 36" fill="none" stroke={color} strokeWidth="3" />
          <path d="M108 48 H134" stroke={color} strokeWidth="3" />
        </>
      );
    case 'servo-one-stage':
      return (
        <>
          <rect x="24" y="28" width="112" height="40" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M36 48 H92" stroke={color} strokeWidth="3" />
          <path d="M92 48 L112 34 L112 62 Z" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'servo-two-stage':
      return (
        <>
          <rect x="14" y="24" width="132" height="48" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <rect x="24" y="34" width="36" height="28" rx="8" fill="none" stroke={color} strokeWidth="2.5" />
          <path d="M60 48 H126" stroke={color} strokeWidth="3" />
          <path d="M100 48 L126 34 L126 62 Z" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    default:
      return <DirectionalValve component={component} color={color} />;
  }
};

const ServiceUnit = ({ component, color }) => {
  const style = component.symbolVariant?.style;

  switch (style) {
    case 'accumulator-hydraulic':
      return <rect x="58" y="16" width="24" height="64" rx="12" fill="none" stroke={color} strokeWidth="3" />;
    case 'accumulator-pneumatic':
      return <rect x="34" y="34" width="92" height="28" rx="14" fill="none" stroke={color} strokeWidth="3" />;
    case 'filter':
    case 'separator':
    case 'dryer':
    case 'lubricator':
    case 'heater':
    case 'cooler':
      return (
        <>
          <path d="M20 48 H42" stroke={color} strokeWidth="3" />
          <path d="M118 48 H140" stroke={color} strokeWidth="3" />
          <polygon points="42,48 80,18 118,48 80,78" fill="none" stroke={color} strokeWidth="3" />
          {style === 'filter' && <path d="M80 18 V78" stroke={color} strokeWidth="2.5" strokeDasharray="4 4" />}
          {style === 'separator' && <path d="M58 48 H102" stroke={color} strokeWidth="2.5" />}
          {style === 'dryer' && <path d="M56 40 H104 M56 56 H104" stroke={color} strokeWidth="2.5" />}
          {style === 'lubricator' && <path d="M80 30 C74 38 74 48 80 58 C86 48 86 38 80 30Z" fill="none" stroke={color} strokeWidth="2.5" />}
          {style === 'heater' && <path d="M80 30 L68 48 L80 48 L72 66" fill="none" stroke={color} strokeWidth="2.5" />}
          {style === 'cooler' && <path d="M68 32 V64 M92 32 V64" stroke={color} strokeWidth="2.5" />}
        </>
      );
    case 'silencer':
      return (
        <>
          <path d="M16 48 H42" stroke={color} strokeWidth="3" />
          <rect x="42" y="34" width="72" height="28" rx="10" fill="none" stroke={color} strokeWidth="3" />
          <path d="M114 40 L130 40 M114 48 L136 48 M114 56 L130 56" stroke={color} strokeWidth="2.5" />
        </>
      );
    default:
      return (
        <>
          <path d="M20 48 H42" stroke={color} strokeWidth="3" />
          <path d="M118 48 H140" stroke={color} strokeWidth="3" />
          <rect x="42" y="28" width="76" height="40" rx="10" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
  }
};

const CommandSymbol = ({ component, color }) => {
  const style = component.symbolVariant?.style;

  switch (style) {
    case 'positioner':
      return (
        <>
          <path d="M28 52 H78" stroke={color} strokeWidth="3" />
          <rect x="78" y="34" width="32" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <path d="M110 48 H136" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pushbutton':
      return (
        <>
          <path d="M20 48 H74" stroke={color} strokeWidth="3" />
          <rect x="74" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <path d="M46 28 V12" stroke={color} strokeWidth="3" />
          <circle cx="46" cy="12" r="6" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'lever':
      return (
        <>
          <path d="M24 48 H74" stroke={color} strokeWidth="3" />
          <rect x="74" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <path d="M48 22 L68 10" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pedal':
      return (
        <>
          <path d="M24 48 H74" stroke={color} strokeWidth="3" />
          <rect x="74" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <path d="M44 18 L66 30 H80" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'spring':
      return <path d="M26 56 L38 36 L50 56 L62 36 L74 56 L86 36 L98 56" fill="none" stroke={color} strokeWidth="3" />;
    case 'roller':
      return (
        <>
          <path d="M24 48 H74" stroke={color} strokeWidth="3" />
          <rect x="74" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <path d="M44 24 L58 24" stroke={color} strokeWidth="3" />
          <circle cx="64" cy="24" r="7" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'solenoid':
      return (
        <>
          <path d="M20 48 H68" stroke={color} strokeWidth="3" />
          <rect x="68" y="34" width="32" height="28" rx="4" fill="none" stroke={color} strokeWidth="3" />
          <path d="M68 34 L100 62" stroke={color} strokeWidth="3" />
        </>
      );
    case 'double-solenoid':
      return (
        <>
          <rect x="28" y="34" width="32" height="28" rx="4" fill="none" stroke={color} strokeWidth="3" />
          <rect x="100" y="34" width="32" height="28" rx="4" fill="none" stroke={color} strokeWidth="3" />
          <path d="M28 34 L60 62 M100 34 L132 62" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pilot-pressure':
      return (
        <>
          <path d="M18 48 H74" stroke={color} strokeWidth="3" strokeDasharray="6 4" />
          <polygon points="50,40 64,48 50,56" fill="none" stroke={color} strokeWidth="3" />
          <rect x="74" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'combined-command':
      return (
        <>
          <rect x="18" y="34" width="32" height="28" rx="4" fill="none" stroke={color} strokeWidth="3" />
          <path d="M18 34 L50 62" stroke={color} strokeWidth="3" />
          <path d="M50 48 H94" stroke={color} strokeWidth="3" strokeDasharray="6 4" />
          <rect x="94" y="34" width="28" height="28" rx="8" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    default:
      return <Box border={color} />;
  }
};

const Instrument = ({ component, color }) => {
  const style = component.symbolVariant?.style;

  switch (style) {
    case 'manometer':
      return (
        <>
          <circle cx="80" cy="42" r="24" fill="none" stroke={color} strokeWidth="3" />
          <path d="M80 42 L94 28" stroke={color} strokeWidth="3" />
          <path d="M80 66 V84" stroke={color} strokeWidth="3" />
        </>
      );
    case 'thermometer':
      return (
        <>
          <circle cx="80" cy="64" r="10" fill="none" stroke={color} strokeWidth="3" />
          <path d="M80 18 V64" stroke={color} strokeWidth="3" />
        </>
      );
    case 'flowmeter':
      return (
        <>
          <circle cx="80" cy="48" r="22" fill="none" stroke={color} strokeWidth="3" />
          <path d="M58 48 H102" stroke={color} strokeWidth="3" />
          <path d="M78 38 C86 38 90 58 102 58" fill="none" stroke={color} strokeWidth="2.5" />
        </>
      );
    case 'counter':
      return (
        <>
          <circle cx="80" cy="48" r="24" fill="none" stroke={color} strokeWidth="3" />
          <path d="M68 60 V36 L92 48 Z" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pressure-switch':
      return (
        <>
          <rect x="24" y="20" width="112" height="52" rx="12" fill="none" stroke={color} strokeWidth="3" />
          <path d="M40 32 L84 60" stroke={color} strokeWidth="3" />
          <circle cx="44" cy="32" r="4" fill={color} />
          <circle cx="88" cy="60" r="4" fill={color} />
          <path d="M128 20 L142 8" stroke={color} strokeWidth="3" />
        </>
      );
    default:
      return <circle cx="80" cy="48" r="24" fill="none" stroke={color} strokeWidth="3" />;
  }
};

const NotationSymbol = ({ component, color }) => {
  const style = component.symbolVariant?.style;

  switch (style) {
    case 'field-box':
      return <rect x="18" y="18" width="124" height="64" rx="10" fill="none" stroke={color} strokeWidth="3" strokeDasharray="9 6" />;
    case 'triangle':
      return <polygon points="80,32 100,68 60,68" fill="none" stroke={color} strokeWidth="3" />;
    case 'oblique-arrow':
      return (
        <>
          <path d="M36 64 L120 20" stroke={color} strokeWidth="3" />
          <polygon points="120,20 110,20 114,30" fill={color} />
        </>
      );
    case 'single-box':
      return <rect x="52" y="28" width="56" height="40" rx="8" fill="none" stroke={color} strokeWidth="3" />;
    case 'multi-box':
      return (
        <>
          <rect x="26" y="32" width="36" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
          <rect x="62" y="32" width="36" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
          <rect x="98" y="32" width="36" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'junction':
      return (
        <>
          <path d="M24 48 H136 M80 16 V80" stroke={color} strokeWidth="3" />
          <circle cx="80" cy="48" r="7" fill={color} />
        </>
      );
    case 'crossing':
      return (
        <>
          <path d="M24 48 H136" stroke={color} strokeWidth="3" />
          <path d="M80 16 V80" stroke={color} strokeWidth="3" strokeDasharray="8 6" />
        </>
      );
    case 'pilot-line':
      return <path d="M24 66 H86 V34 H136" fill="none" stroke={color} strokeWidth="3" strokeDasharray="8 6" />;
    default:
      return <Box border={color} />;
  }
};

const renderSymbol = (component, color) => {
  switch (component.symbol) {
    case 'single-cylinder':
      return (
        <>
          <Box border={color} />
          <rect x="34" y="36" width="72" height="24" rx="6" fill="none" stroke={color} strokeWidth="3" />
          <line x1="106" y1="48" x2="138" y2="48" stroke={color} strokeWidth="3" />
          <circle cx="141" cy="48" r="4" fill={color} />
          <path d="M24 48 H34" stroke={color} strokeWidth="3" />
          <path d="M20 38 L28 48 L20 58" fill="none" stroke="#94A3B8" strokeWidth="2" />
        </>
      );
    case 'double-cylinder':
      return (
        <>
          <Box border={color} />
          <rect x="34" y="34" width="80" height="28" rx="6" fill="none" stroke={color} strokeWidth="3" />
          <line x1="114" y1="48" x2="140" y2="48" stroke={color} strokeWidth="3" />
          <circle cx="143" cy="48" r="4" fill={color} />
          <path d="M20 36 H34" stroke={color} strokeWidth="3" />
          <path d="M20 60 H34" stroke={color} strokeWidth="3" />
        </>
      );
    case 'rotary-motor':
      return (
        <>
          <circle cx="80" cy="48" r="28" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M70 60 V38 L94 48 Z" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="2" />
          <path d="M20 36 H52" stroke={color} strokeWidth="3" />
          <path d="M108 60 H140" stroke={color} strokeWidth="3" />
        </>
      );
    case 'pump':
    case 'compressor':
      return (
        <>
          <circle cx="80" cy="48" r="30" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M68 60 V36 L96 48 Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <path d="M20 48 H50" stroke={color} strokeWidth="3" />
          <path d="M110 48 H140" stroke={color} strokeWidth="3" />
          <path d="M80 12 V24" stroke="#94A3B8" strokeWidth="3" />
        </>
      );
    case 'prime-mover':
      return (
        <>
          <circle cx="80" cy="42" r="28" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M60 42 Q70 20 80 42 Q90 64 100 42" fill="none" stroke={color} strokeWidth="3" />
          <path d="M80 70 V84" stroke="#94A3B8" strokeWidth="3" />
        </>
      );
    case 'reservoir':
      return (
        <>
          <rect x="32" y="26" width="96" height="48" rx="10" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M46 48 Q58 40 70 48 T94 48 T118 48" fill="none" stroke={color} strokeWidth="3" />
          <path d="M58 18 V26 M102 18 V26" stroke="#94A3B8" strokeWidth="3" />
        </>
      );
    case 'flow-control':
      return (
        <>
          <rect x="28" y="26" width="104" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M40 48 H120" stroke={color} strokeWidth="3" />
          <path d="M54 62 L106 34" stroke={color} strokeWidth="3" />
        </>
      );
    case 'check-valve':
      return (
        <>
          <rect x="28" y="26" width="104" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M44 48 H116" stroke={color} strokeWidth="3" />
          <polygon points="70,38 92,48 70,58" fill="none" stroke={color} strokeWidth="3" />
          <line x1="102" y1="34" x2="102" y2="62" stroke={color} strokeWidth="3" />
        </>
      );
    case 'logic-valve':
      return (
        <>
          <rect x="28" y="26" width="104" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M44 48 H76" stroke={color} strokeWidth="3" />
          <path d="M84 38 L104 48 L84 58 Z" fill="none" stroke={color} strokeWidth="3" />
          <path d="M104 48 H116" stroke={color} strokeWidth="3" />
        </>
      );
    case 'limit-valve':
      return (
        <>
          <DirectionalValve component={{ ...component, simBehavior: { ...component.simBehavior, family: '3/2' } }} color={color} />
          <path d="M24 16 L36 8" stroke="#94A3B8" strokeWidth="3" />
          <circle cx="40" cy="8" r="5" fill="#94A3B8" />
        </>
      );
    case 'rotary-machine':
      return <RotaryMachine component={component} color={color} />;
    case 'cylinder-advanced':
      return <AdvancedCylinder component={component} color={color} />;
    case 'control-valve':
      return <ControlValve component={component} color={color} />;
    case 'service-unit':
      return <ServiceUnit component={component} color={color} />;
    case 'command-symbol':
      return <CommandSymbol component={component} color={color} />;
    case 'instrument':
      return <Instrument component={component} color={color} />;
    case 'notation':
      return <NotationSymbol component={component} color={color} />;
    case 'frl':
      return (
        <>
          <rect x="20" y="26" width="120" height="44" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <line x1="58" y1="26" x2="58" y2="70" stroke={color} strokeWidth="2" />
          <line x1="98" y1="26" x2="98" y2="70" stroke={color} strokeWidth="2" />
          <circle cx="38" cy="48" r="6" fill="none" stroke={color} strokeWidth="2" />
          <path d="M74 38 V58" stroke={color} strokeWidth="3" />
          <path d="M116 36 Q110 48 116 60" fill="none" stroke={color} strokeWidth="3" />
        </>
      );
    case 'exhaust':
      return (
        <>
          <rect x="34" y="18" width="92" height="52" rx="12" fill="#111827" stroke={color} strokeWidth="3" />
          <path d="M80 18 V4" stroke={color} strokeWidth="3" />
          <path d="M58 70 L48 84 M72 70 L66 86 M88 70 L88 86 M102 70 L110 84" stroke="#94A3B8" strokeWidth="3" />
        </>
      );
    default:
      return <DirectionalValve component={component} color={color} />;
  }
};

const FluidPowerSymbol = ({ component, active = false, label }) => {
  const color = domainColor(component, active);

  return (
    <svg viewBox="0 0 160 100" className="fluid-symbol" role="img" aria-label={label ?? component.label}>
      {renderSymbol(component, color)}
    </svg>
  );
};

export default FluidPowerSymbol;
