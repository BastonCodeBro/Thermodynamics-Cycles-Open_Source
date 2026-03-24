import React from 'react';

const ICONS = {
  compressor: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <circle r={22} fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M-8,-10 L8,0 L-8,10 Z" fill={color} opacity={0.8} />
      <text y={30} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">COMPRESSORE</text>
    </g>
  ),
  turbine: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <circle r={22} fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M8,-10 L-8,0 L8,10 Z" fill={color} opacity={0.8} />
      <text y={30} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">TURBINA</text>
    </g>
  ),
  pump: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <circle r={20} fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={-6} y1={8} x2={-6} y2={-8} stroke={color} strokeWidth={3} />
      <line x1={-6} y1={-8} x2={8} y2={-2} stroke={color} strokeWidth={3} />
      <text y={28} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">POMPA</text>
    </g>
  ),
  boiler: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-28} y={-18} width={56} height={36} rx={4} fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={-16} y1={-8} x2={-16} y2={8} stroke={color} strokeWidth={2} />
      <line x1={-4} y1={-8} x2={-4} y2={8} stroke={color} strokeWidth={2} />
      <line x1={8} y1={-8} x2={8} y2={8} stroke={color} strokeWidth={2} />
      <line x1={20} y1={-8} x2={20} y2={8} stroke={color} strokeWidth={2} />
      <path d="M-12,-12 L-8,-16 L-4,-12" stroke={color} strokeWidth={1.5} fill="none" />
      <path d="M4,-12 L8,-16 L12,-12" stroke={color} strokeWidth={1.5} fill="none" />
      <path d="M16,-12 L20,-16 L24,-12" stroke={color} strokeWidth={1.5} fill="none" />
      <text y={30} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">CALDAIA</text>
    </g>
  ),
  condenser: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-28} y={-18} width={56} height={36} rx={4} fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M-18,0 Q-12,-10 -6,0 Q0,10 6,0 Q12,-10 18,0" stroke={color} strokeWidth={2} fill="none" />
      <text y={30} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">CONDENSATORE</text>
    </g>
  ),
  combustion: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-28} y={-20} width={56} height={40} rx={6} fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M-8,8 C-8,-4 -4,-12 0,-4 C4,-12 8,-4 8,8" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.2} />
      <text y={32} textAnchor="middle" fill={color} fontSize="8" fontWeight="700">CAMERA COMB.</text>
    </g>
  ),
  evaporator: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-28} y={-18} width={56} height={36} rx={4} fill="none" stroke={color} strokeWidth={2.5} />
      <circle cx={-12} cy={0} r={4} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={4} cy={-4} r={3} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={12} cy={2} r={5} fill="none" stroke={color} strokeWidth={1.5} />
      <text y={30} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">EVAPORATORE</text>
    </g>
  ),
  valve: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <polygon points="0,-14 14,8 -14,8" fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={-14} y1={8} x2={14} y2={8} stroke={color} strokeWidth={2.5} />
      <text y={24} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">VALVOLA</text>
    </g>
  ),
  heatEngine: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-24} y={-20} width={48} height={40} rx={6} fill="none" stroke={color} strokeWidth={2.5} />
      <text y={5} textAnchor="middle" fill={color} fontSize="14" fontWeight="700">η</text>
      <text y={32} textAnchor="middle" fill={color} fontSize="8" fontWeight="700">MOTORE</text>
    </g>
  ),
  heatSource: (x, y, color, label = 'T_H') => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-24} y={-16} width={48} height={32} rx={6} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
      <text y={5} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">{label}</text>
    </g>
  ),
  heatSink: (x, y, color, label = 'T_L') => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-24} y={-16} width={48} height={32} rx={6} fill={color} fillOpacity={0.1} stroke={color} strokeWidth={2} />
      <text y={5} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">{label}</text>
    </g>
  ),
  piston: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <rect x={-24} y={-25} width={48} height={50} rx={3} fill="none" stroke={color} strokeWidth={2.5} />
      <rect x={-20} y={-8} width={40} height={8} rx={2} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />
      <line x1={0} y1={-8} x2={0} y2={-30} stroke={color} strokeWidth={2} />
      <circle cy={-32} r={3} fill={color} />
      <text y={38} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">CILINDRO</text>
    </g>
  ),
  exhaust: (x, y, color) => (
    <g transform={`translate(${x},${y})`}>
      <path d="M-12,0 L0,-12 L12,0" stroke={color} strokeWidth={2} fill="none" />
      <line x1={-12} y1={0} x2={12} y2={0} stroke={color} strokeWidth={2} />
      <text y={18} textAnchor="middle" fill={color} fontSize="8" fontWeight="700">SCARICO</text>
    </g>
  ),
};

const Arrow = ({ x1, y1, x2, y2, color = '#94A3B8', label, labelOffset = { x: 0, y: 0 } }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLen = 8;
  const ax1 = x2 - arrowLen * Math.cos(angle - 0.4);
  const ay1 = y2 - arrowLen * Math.sin(angle - 0.4);
  const ax2 = x2 - arrowLen * Math.cos(angle + 0.4);
  const ay2 = y2 - arrowLen * Math.sin(angle + 0.4);
  const mx = (x1 + x2) / 2 + labelOffset.x;
  const my = (y1 + y2) / 2 + labelOffset.y;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />
      <polygon points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`} fill={color} />
      {label && (
        <text x={mx} y={my} textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="600" dominantBaseline="auto">
          {label}
        </text>
      )}
    </g>
  );
};

const PointLabel = ({ x, y, number, processLabel, color = '#F8FAFC', bgColor }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={14} fill={bgColor || '#0F172A'} stroke={color} strokeWidth={2} />
    <text y={1} textAnchor="middle" fill={color} fontSize="12" fontWeight="800" dominantBaseline="middle">
      {number}
    </text>
    {processLabel && (
      <text y={-18} textAnchor="middle" fill="#94A3B8" fontSize="7.5" fontWeight="600">
        {processLabel}
      </text>
    )}
  </g>
);

const SchematicDiagram = ({ type, accentColor = '#38BDF8', width = 460, height = 320 }) => {
  const renderSchematic = () => {
    switch (type) {
      case 'rankine':
        return (
          <svg viewBox="0 0 460 320" width="100%" height="100%">
            {ICONS.turbine(340, 80, accentColor)}
            {ICONS.condenser(340, 230, '#60A5FA')}
            {ICONS.pump(120, 230, accentColor)}
            {ICONS.boiler(120, 80, accentColor)}

            <Arrow x1={148} y1={80} x2={310} y2={80} color="#94A3B8" label="q_{in}" labelOffset={{ x: 0, y: -14 }} />
            <Arrow x1={340} y1={108} x2={340} y2={202} color="#94A3B8" label="w_t" labelOffset={{ x: 20, y: 0 }} />
            <Arrow x1={312} y1={230} x2={148} y2={230} color="#94A3B8" label="q_{out}" labelOffset={{ x: 0, y: 16 }} />
            <Arrow x1={120} y1={202} x2={120} y2={108} color="#94A3B8" label="w_p" labelOffset={{ x: -20, y: 0 }} />

            <PointLabel x={120} y={144} number={1} processLabel="usc. condens." color={accentColor} />
            <PointLabel x={120} y={158} number={2} processLabel="usc. pompa" color={accentColor} />
            <PointLabel x={340} y={144} number={3} processLabel="usc. caldaia" color={accentColor} />
            <PointLabel x={340} y={158} number={4} processLabel="usc. turbina" color={accentColor} />
          </svg>
        );

      case 'brayton':
        return (
          <svg viewBox="0 0 460 300" width="100%" height="100%">
            {ICONS.compressor(100, 80, accentColor)}
            {ICONS.combustion(230, 80, '#F97316')}
            {ICONS.turbine(360, 80, accentColor)}
            {ICONS.exhaust(360, 210, '#64748B')}

            <Arrow x1={128} y1={80} x2={196} y2={80} color="#94A3B8" label="2" />
            <Arrow x1={264} y1={80} x2={330} y2={80} color="#94A3B8" label="3" />
            <Arrow x1={360} y1={108} x2={360} y2={180} color="#94A3B8" label="4" />
            <Arrow x1={332} y1={210} x2={128} y2={210} color="#94A3B8" labelOffset={{ x: 0, y: 0 }}>
              <line x1={332} y1={210} x2={128} y2={210} stroke="#94A3B8" strokeWidth={2} />
              <polygon points="128,210 138,205 138,215" fill="#94A3B8" />
            </Arrow>
            <Arrow x1={100} y1={180} x2={100} y2={108} color="#94A3B8" label="1" />

            <PointLabel x={70} y={150} number={1} processLabel="aspiraz." color={accentColor} />
            <PointLabel x={162} y={50} number={2} processLabel="usc. comp." color={accentColor} />
            <PointLabel x={298} y={50} number={3} processLabel="usc. comb." color={accentColor} />
            <PointLabel x={390} y={150} number={4} processLabel="usc. turb." color={accentColor} />

            <line x1={100} y1={210} x2={100} y2={108} stroke="#94A3B8" strokeWidth={2} />
            <line x1={100} y1={210} x2={360} y2={210} stroke="#94A3B8" strokeWidth={2} />
            <polygon points="128,210 138,205 138,215" fill="#94A3B8" />
          </svg>
        );

      case 'otto':
        return (
          <svg viewBox="0 0 460 320" width="100%" height="100%">
            {ICONS.piston(230, 100, accentColor)}

            <text x={230} y={200} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              1→2: Compressione isentropica (V↓)
            </text>
            <text x={230} y={216} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              2→3: Combustione isocora (P↑)
            </text>
            <text x={230} y={232} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              3→4: Espansione isentropica (V↑)
            </text>
            <text x={230} y={248} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              4→1: Scarico isocoro (P↓)
            </text>

            <PointLabel x={90} y={180} number={1} processLabel="aspiraz." color={accentColor} />
            <PointLabel x={160} y={60} number={2} processLabel="fine compr." color={accentColor} />
            <PointLabel x={300} y={60} number={3} processLabel="fine comb." color={accentColor} />
            <PointLabel x={370} y={180} number={4} processLabel="fine espans." color={accentColor} />

            <Arrow x1={110} y1={180} x2={145} y2={75} color="#94A3B8" label="1→2" />
            <Arrow x1={175} y1={60} x2={285} y2={60} color="#F97316" label="2→3" />
            <Arrow x1={315} y1={75} x2={355} y2={180} color="#94A3B8" label="3→4" />
            <Arrow x1={350} y1={190} x2={110} y2={190} color="#94A3B8" label="4→1" />
          </svg>
        );

      case 'diesel':
        return (
          <svg viewBox="0 0 460 320" width="100%" height="100%">
            {ICONS.piston(230, 100, '#EF4444')}

            <text x={230} y={200} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              1→2: Compressione isentropica (V↓)
            </text>
            <text x={230} y={216} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              2→3: Combustione isobara (T↑, V↑)
            </text>
            <text x={230} y={232} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              3→4: Espansione isentropica (V↑)
            </text>
            <text x={230} y={248} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              4→1: Scarico isocoro (P↓)
            </text>

            <PointLabel x={90} y={180} number={1} processLabel="aspiraz." color="#EF4444" />
            <PointLabel x={160} y={55} number={2} processLabel="fine compr." color="#EF4444" />
            <PointLabel x={300} y={55} number={3} processLabel="fine comb." color="#EF4444" />
            <PointLabel x={370} y={180} number={4} processLabel="fine espans." color="#EF4444" />

            <Arrow x1={110} y1={180} x2={145} y2={70} color="#94A3B8" label="1→2" />
            <Arrow x1={175} y1={55} x2={285} y2={55} color="#EF4444" label="2→3" />
            <Arrow x1={315} y1={70} x2={355} y2={180} color="#94A3B8" label="3→4" />
            <Arrow x1={350} y1={190} x2={110} y2={190} color="#94A3B8" label="4→1" />
          </svg>
        );

      case 'refrigeration':
        return (
          <svg viewBox="0 0 460 320" width="100%" height="100%">
            {ICONS.compressor(120, 70, accentColor)}
            {ICONS.condenser(340, 70, '#F87171')}
            {ICONS.valve(340, 230, accentColor)}
            {ICONS.evaporator(120, 230, '#38BDF8')}

            <Arrow x1={148} y1={70} x2={306} y2={70} color="#94A3B8" label="q_H" labelOffset={{ x: 0, y: -14 }} />
            <Arrow x1={340} y1={98} x2={340} y2={198} color="#94A3B8" label="h_3=h_4" labelOffset={{ x: 22, y: 0 }} />
            <Arrow x1={312} y1={230} x2={148} y2={230} color="#94A3B8" label="q_L" labelOffset={{ x: 0, y: 16 }} />
            <Arrow x1={120} y1={202} x2={120} y2={98} color="#94A3B8" label="w_in" labelOffset={{ x: -22, y: 0 }} />

            <PointLabel x={120} y={150} number={1} processLabel="usc. evap." color={accentColor} />
            <PointLabel x={120} y={164} number={2} processLabel="usc. comp." color={accentColor} />
            <PointLabel x={340} y={150} number={3} processLabel="usc. cond." color={accentColor} />
            <PointLabel x={340} y={164} number={4} processLabel="usc. valv." color={accentColor} />
          </svg>
        );

      case 'carnot':
        return (
          <svg viewBox="0 0 460 320" width="100%" height="100%">
            {ICONS.heatSource(120, 60, '#EF4444', 'T_H')}
            {ICONS.heatEngine(230, 155, accentColor)}
            {ICONS.heatSink(340, 60, '#3B82F6', 'T_L')}

            <Arrow x1={120} y1={82} x2={200} y2={135} color="#EF4444" label="Q_H" labelOffset={{ x: -16, y: 0 }} />
            <Arrow x1={260} y1={135} x2={340} y2={82} color="#3B82F6" label="Q_L" labelOffset={{ x: 16, y: 0 }} />
            <text x={230} y={220} textAnchor="middle" fill={accentColor} fontSize="12" fontWeight="700">
              W = Q_H - Q_L
            </text>

            <text x={230} y={255} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              1→2: Isotherm expansion at T_H
            </text>
            <text x={230} y={270} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              2→3: Adiabatic expansion T_H → T_L
            </text>
            <text x={230} y={285} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              3→4: Isotherm compression at T_L
            </text>
            <text x={230} y={300} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              4→1: Adiabatic compression T_L → T_H
            </text>
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div className="schematic-container glass">
      <div className="schematic-svg" style={{ width, height }}>
        {renderSchematic()}
      </div>
    </div>
  );
};

export default SchematicDiagram;
export { PointLabel, Arrow, ICONS };
