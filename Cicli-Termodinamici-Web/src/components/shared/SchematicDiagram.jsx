import React from 'react';
import { formatValue } from '../../utils/formatNumber';

const TEXT = '#E2E8F0';
const MUTED = '#94A3B8';
const PIPE = '#CBD5E1';
const PANEL = '#0F172A';
const CARD = '#111827';

const formatValueUnit = (value, type, unit) => {
  const formatted = formatValue(value, type);
  return formatted === '\u2014' ? '-' : `${formatted} ${unit}`;
};

const FlowArrow = ({ x1, y1, x2, y2, color = PIPE, width = 4, label, labelX, labelY }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLen = 15;
  const ax1 = x2 - arrowLen * Math.cos(angle - 0.32);
  const ay1 = y2 - arrowLen * Math.sin(angle - 0.32);
  const ax2 = x2 - arrowLen * Math.cos(angle + 0.32);
  const ay2 = y2 - arrowLen * Math.sin(angle + 0.32);

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`} fill={color} />
      {label ? (
        <text
          x={labelX ?? (x1 + x2) / 2}
          y={labelY ?? (y1 + y2) / 2 - 12}
          fill={color}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

const StationDot = ({ x, y, label, color }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r="15" fill={PANEL} stroke={color} strokeWidth="2.5" />
    <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="12" fontWeight="800">
      {label}
    </text>
  </g>
);

const ShaftLine = ({ x1, x2, y, label = 'ALBERO', color = MUTED }) => (
  <g>
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={4} strokeDasharray="10 6" />
    <text x={(x1 + x2) / 2} y={y - 10} fill={color} fontSize="10" fontWeight="700" textAnchor="middle">
      {label}
    </text>
  </g>
);

const Boiler = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x="-48" y="-74" width="96" height="148" rx="12" fill="#2A1620" stroke={color} strokeWidth="3" />
    <rect x="-34" y="-48" width="68" height="24" rx="6" fill="none" stroke={color} strokeWidth="2" />
    <rect x="-34" y="-12" width="68" height="24" rx="6" fill="none" stroke={color} strokeWidth="2" />
    <rect x="-34" y="24" width="68" height="24" rx="6" fill="none" stroke={color} strokeWidth="2" />
    <text y="-92" textAnchor="middle" fill={color} fontSize="13" fontWeight="800">CALDAIA</text>
  </g>
);

const Turbine = ({ x, y, color, label = 'TURBINA' }) => (
  <g transform={`translate(${x},${y})`}>
    <polygon points="-38,-42 36,-28 36,28 -38,42" fill="#271D13" stroke={color} strokeWidth="3" />
    <text y="-58" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{label}</text>
  </g>
);

const Compressor = ({ x, y, color, label = 'COMPRESSORE' }) => (
  <g transform={`translate(${x},${y})`}>
    <polygon points="-36,-28 38,-42 38,42 -36,28" fill="#16263A" stroke={color} strokeWidth="3" />
    <text y="-58" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{label}</text>
  </g>
);

const Pump = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r="28" fill="#143038" stroke={color} strokeWidth="3" />
    <path d="M-8,12 L-8,-10 L12,-2" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <text y="-44" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">POMPA</text>
  </g>
);

const Condenser = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r="36" fill="#14253B" stroke={color} strokeWidth="3" />
    <path d="M-22,0 Q-16,-10 -10,0 Q-4,10 2,0 Q8,-10 14,0 Q20,10 24,0" fill="none" stroke={color} strokeWidth="2.5" />
    <text y="-52" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">CONDENSATORE</text>
  </g>
);

const Combustor = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x="-48" y="-36" width="96" height="72" rx="12" fill="#2B2117" stroke={color} strokeWidth="3" />
    <path d="M0,20 C-6,14 -14,2 -10,-8 C-8,-14 -3,-20 0,-26 C3,-20 8,-14 10,-8 C14,2 6,14 0,20Z"
      fill={color} fillOpacity="0.25" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <path d="M0,14 C-3,10 -6,2 -4,-4 C-3,-8 0,-12 0,-16 C0,-12 3,-8 4,-4 C6,2 3,10 0,14Z"
      fill={color} fillOpacity="0.5" />
    <text y="-52" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">COMBUSTORE</text>
  </g>
);

const Generator = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r="22" fill="#111827" stroke={TEXT} strokeWidth="2.5" />
    <path d="M-10,0 Q-5,-10 0,0 Q5,10 10,0" fill="none" stroke={TEXT} strokeWidth="2" />
    <text y="38" textAnchor="middle" fill={TEXT} fontSize="10" fontWeight="700">GENERATORE</text>
  </g>
);

const HeatExchanger = ({ x, y, color, label }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x="-42" y="-28" width="84" height="56" rx="10" fill="#182233" stroke={color} strokeWidth="3" />
    <path d="M-26,4 H26" stroke={color} strokeWidth="2.5" />
    <path d="M-18,-8 Q-10,-16 -2,-8 Q6,0 14,-8 Q22,-16 30,-8" fill="none" stroke={color} strokeWidth="2" />
    <text y="-44" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{label}</text>
  </g>
);

const Valve = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <polygon points="-18,-16 18,16 -18,16" fill="#25161B" stroke={color} strokeWidth="3" />
    <line x1="-18" y1="16" x2="18" y2="-16" stroke={color} strokeWidth="2" />
    <text y="-30" textAnchor="middle" fill={color} fontSize="11" fontWeight="800">VALVOLA</text>
  </g>
);

const Cylinder = ({ x, y, color, label, topLabel }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x="-54" y="-56" width="108" height="112" rx="10" fill="#1A2436" stroke={color} strokeWidth="3" />
    <rect x="-40" y="-6" width="80" height="16" rx="4" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" />
    <line x1="0" y1="-6" x2="0" y2="-72" stroke={color} strokeWidth="3" />
    <circle cx="0" cy="-78" r="7" fill={color} />
    <text y="-92" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{topLabel}</text>
    <text y="76" textAnchor="middle" fill={TEXT} fontSize="12" fontWeight="800">{label}</text>
  </g>
);

const PointCard = ({ x, y, width, label, point, color }) => {
  const col1 = 14;
  const col2 = width / 2 + 8;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={width} height="92" rx="12" fill={CARD} stroke={`${color}99`} strokeWidth="1.5" />
      <text x={col1} y="18" fill={color} fontSize="12" fontWeight="800">{label}</text>
      <text x={col1} y="38" fill={TEXT} fontSize="10" fontWeight="600">
        {`P: ${formatValueUnit(point?.p, 'pressure', 'bar')}`}
      </text>
      <text x={col2} y="38" fill={TEXT} fontSize="10" fontWeight="600">
        {`T: ${formatValueUnit(point?.t, 'temperature', '\u00B0C')}`}
      </text>
      <text x={col1} y="54" fill={TEXT} fontSize="10" fontWeight="600">
        {`h: ${formatValueUnit(point?.h, 'energy', 'kJ/kg')}`}
      </text>
      <text x={col2} y="54" fill={TEXT} fontSize="10" fontWeight="600">
        {`s: ${formatValueUnit(point?.s, 'entropy', 'kJ/(kg\u00B7K)')}`}
      </text>
      <text x={col1} y="70" fill={TEXT} fontSize="10" fontWeight="600">
        {`v: ${formatValueUnit(point?.v, 'volume', 'm\u00B3/kg')}`}
      </text>
      <text x={col2} y="70" fill={MUTED} fontSize="9" fontWeight="500">
        {point?.q !== undefined && point?.q >= 0 && point?.q <= 1 ? `x: ${point.q.toFixed(3)}` : ''}
      </text>
      <line x1={col1} y1="24" x2={width - 14} y2="24" stroke={`${color}30`} strokeWidth="1" />
    </g>
  );
};

const MetricCard = ({ x, y, width, label, value, color }) => (
  <g transform={`translate(${x},${y})`}>
    <rect width={width} height="52" rx="12" fill={CARD} stroke={`${color ?? MUTED}99`} strokeWidth="1.5" />
    <text x="14" y="20" fill={MUTED} fontSize="10" fontWeight="700">{label}</text>
    <text x="14" y="38" fill={color ?? TEXT} fontSize="13" fontWeight="800">{value}</text>
  </g>
);

const renderRankinePlant = () => {
  const hot = '#F97316';
  const cold = '#60A5FA';
  const mech = '#22D3EE';

  return (
    <g>
      <Boiler x={130} y={142} color={hot} />
      <Turbine x={370} y={90} color="#FB923C" />
      <Generator x={470} y={90} />
      <Condenser x={370} y={264} color={cold} />
      <Pump x={150} y={264} color={mech} />

      <ShaftLine x1={400} x2={448} y={90} label="ALBERO" />

      <FlowArrow x1={150} y1={236} x2={150} y2={184} color={mech} label="Wp" labelX={118} labelY={212} />
      <FlowArrow x1={150} y1={184} x2={150} y2={90} color={mech} />
      <FlowArrow x1={150} y1={90} x2={330} y2={90} color={hot} label="Qin" labelX={242} labelY={68} />
      <FlowArrow x1={410} y1={90} x2={410} y2={228} color="#FB923C" label="Wt" labelX={440} labelY={164} />
      <FlowArrow x1={334} y1={264} x2={186} y2={264} color={cold} label="Qout" labelX={260} labelY={292} />

      <StationDot x={182} y={264} label="1" color={cold} />
      <StationDot x={150} y={172} label="2" color={mech} />
      <StationDot x={342} y={90} label="3" color={hot} />
      <StationDot x={410} y={228} label="4" color="#FB923C" />
    </g>
  );
};

const renderBraytonPlant = () => {
  const comp = '#60A5FA';
  const heat = '#F97316';
  const turb = '#34D399';

  return (
    <g>
      <Compressor x={120} y={164} color={comp} />
      <Combustor x={276} y={122} color={heat} />
      <Turbine x={432} y={164} color={turb} />
      <Generator x={510} y={164} />
      <ShaftLine x1={154} x2={486} y={242} label="ALBERO MOTORE" />

      <FlowArrow x1={26} y1={164} x2={78} y2={164} color={comp} label="ARIA" labelX={52} labelY={142} />
      <FlowArrow x1={160} y1={164} x2={228} y2={164} color={PIPE} label="1 -> 2" labelY={142} />
      <FlowArrow x1={276} y1={34} x2={276} y2={86} color={heat} label="COMBUSTIBILE" labelY={24} />
      <FlowArrow x1={324} y1={164} x2={392} y2={164} color={PIPE} label="2 -> 3" labelY={142} />
      <FlowArrow x1={472} y1={164} x2={548} y2={164} color={turb} label="SCARICO" labelX={510} labelY={142} />

      <StationDot x={80} y={126} label="1" color={comp} />
      <StationDot x={190} y={206} label="2" color={comp} />
      <StationDot x={356} y={206} label="3" color={heat} />
      <StationDot x={470} y={126} label="4" color={turb} />
    </g>
  );
};

const PhaseStep = ({ x, y, num, label, detail, color }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r="14" fill={PANEL} stroke={color} strokeWidth="2" />
    <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="11" fontWeight="800">
      {num}
    </text>
    <text y="24" textAnchor="middle" fill={TEXT} fontSize="9" fontWeight="700">{label}</text>
    {detail && <text y="36" textAnchor="middle" fill={MUTED} fontSize="8" fontWeight="500">{detail}</text>}
  </g>
);

const renderOttoPlant = (color) => (
  <g>
    <Cylinder x={286} y={150} color={color} label="CILINDRO - CICLO OTTO" topLabel="CANDELA" />
    <PhaseStep x={196} y={88} num="1" label="Aspirazione" detail="P bassa, T ambiente" color={color} />
    <PhaseStep x={376} y={88} num="2" label="Compressione" detail="isentropica" color={color} />
    <PhaseStep x={376} y={234} num="3" label="Combustione" detail="isocora" color={color} />
    <PhaseStep x={196} y={234} num="4" label="Espansione" detail="isentropica" color={color} />
    <line x1="210" y1="88" x2="362" y2="88" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="376" y1="102" x2="376" y2="220" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="362" y1="234" x2="210" y2="234" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="196" y1="220" x2="196" y2="102" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <polygon points="362,84 370,88 362,92" fill={`${color}80`} />
    <polygon points="380,220 376,228 372,220" fill={`${color}80`} />
    <polygon points="210,238 202,234 210,230" fill={`${color}80`} />
    <polygon points="192,102 196,94 200,102" fill={`${color}80`} />
    <text x="286" y="316" textAnchor="middle" fill={MUTED} fontSize="11" fontWeight="700">
      Sequenza temporale nel cilindro (sistema chiuso)
    </text>
  </g>
);

const renderDieselPlant = (color) => (
  <g>
    <Cylinder x={286} y={150} color={color} label="CILINDRO - CICLO DIESEL" topLabel="INIETTORE" />
    <PhaseStep x={196} y={88} num="1" label="Aspirazione" detail="P bassa, T ambiente" color={color} />
    <PhaseStep x={376} y={88} num="2" label="Compressione" detail="isentropica" color={color} />
    <PhaseStep x={376} y={234} num="3" label="Combustione" detail="P costante" color={color} />
    <PhaseStep x={196} y={234} num="4" label="Espansione" detail="isentropica" color={color} />
    <line x1="210" y1="88" x2="362" y2="88" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="376" y1="102" x2="376" y2="220" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="362" y1="234" x2="210" y2="234" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="196" y1="220" x2="196" y2="102" stroke={`${color}50`} strokeWidth="1.5" strokeDasharray="4 3" />
    <polygon points="362,84 370,88 362,92" fill={`${color}80`} />
    <polygon points="380,220 376,228 372,220" fill={`${color}80`} />
    <polygon points="210,238 202,234 210,230" fill={`${color}80`} />
    <polygon points="192,102 196,94 200,102" fill={`${color}80`} />
    <text x="286" y="316" textAnchor="middle" fill={MUTED} fontSize="11" fontWeight="700">
      Sequenza temporale nel cilindro (sistema chiuso)
    </text>
  </g>
);

const renderRefrigerationPlant = (color) => {
  const hot = '#F87171';
  const cold = '#38BDF8';
  return (
    <g>
      <Compressor x={104} y={260} color={color} label="COMPRESSORE" />
      <HeatExchanger x={266} y={92} color={hot} label="CONDENSATORE" />
      <Valve x={450} y={260} color={color} />
      <HeatExchanger x={266} y={260} color={cold} label="EVAPORATORE" />

      <FlowArrow x1={134} y1={236} x2={206} y2={118} color={PIPE} label="Win" labelX={140} labelY={176} />
      <FlowArrow x1={308} y1={92} x2={406} y2={92} color={hot} label="QH" />
      <FlowArrow x1={450} y1={118} x2={450} y2={228} color={PIPE} label="h = cost" labelX={492} labelY={176} />
      <FlowArrow x1={408} y1={260} x2={308} y2={260} color={cold} label="QL" labelY={288} />
      <FlowArrow x1={224} y1={260} x2={132} y2={260} color={PIPE} />

      <StationDot x={138} y={260} label="1" color={cold} />
      <StationDot x={214} y={118} label="2" color={color} />
      <StationDot x={416} y={92} label="3" color={hot} />
      <StationDot x={416} y={260} label="4" color={color} />
    </g>
  );
};

const renderCarnotPlant = (color) => (
  <g>
    <rect x="212" y="28" width="148" height="58" rx="14" fill="#2B1818" stroke="#EF4444" strokeWidth="3" />
    <rect x="212" y="258" width="148" height="58" rx="14" fill="#16263A" stroke="#3B82F6" strokeWidth="3" />
    <rect x="204" y="126" width="164" height="102" rx="18" fill="#171E2D" stroke={color} strokeWidth="3" />

    <text x="286" y="64" textAnchor="middle" fill="#EF4444" fontSize="16" fontWeight="800">SORGENTE TH</text>
    <text x="286" y="294" textAnchor="middle" fill="#3B82F6" fontSize="16" fontWeight="800">POZZO TL</text>
    <text x="286" y="172" textAnchor="middle" fill={color} fontSize="16" fontWeight="800">MOTORE</text>
    <text x="286" y="194" textAnchor="middle" fill={color} fontSize="16" fontWeight="800">CARNOT</text>

    <FlowArrow x1={286} y1={86} x2={286} y2={126} color="#EF4444" label="QH" labelX={318} labelY={110} />
    <FlowArrow x1={286} y1={228} x2={286} y2={258} color="#3B82F6" label="QL" labelX={318} labelY={248} />
    <FlowArrow x1={368} y1={176} x2={464} y2={176} color={color} label="Wnet" labelY={156} />

    <g transform="translate(204,126)">
      <circle cx="0" cy="0" r="12" fill={PANEL} stroke={color} strokeWidth="2" />
      <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="10" fontWeight="800">1</text>
      <text x="-4" y="-18" textAnchor="middle" fill="#EF4444" fontSize="8" fontWeight="700">Isoterma TH</text>
    </g>
    <g transform="translate(368,126)">
      <circle cx="0" cy="0" r="12" fill={PANEL} stroke={color} strokeWidth="2" />
      <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="10" fontWeight="800">2</text>
      <text x="4" y="-18" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">Isentropica</text>
    </g>
    <g transform="translate(368,228)">
      <circle cx="0" cy="0" r="12" fill={PANEL} stroke={color} strokeWidth="2" />
      <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="10" fontWeight="800">3</text>
      <text x="4" y="28" textAnchor="middle" fill="#3B82F6" fontSize="8" fontWeight="700">Isoterma TL</text>
    </g>
    <g transform="translate(204,228)">
      <circle cx="0" cy="0" r="12" fill={PANEL} stroke={color} strokeWidth="2" />
      <text y="1" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="10" fontWeight="800">4</text>
      <text x="-4" y="28" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">Isentropica</text>
    </g>
    <line x1="204" y1="114" x2="368" y2="114" stroke={`${color}40`} strokeWidth="1" strokeDasharray="3 2" />
    <line x1="380" y1="126" x2="380" y2="228" stroke={`${color}40`} strokeWidth="1" strokeDasharray="3 2" />
    <line x1="368" y1="240" x2="204" y2="240" stroke={`${color}40`} strokeWidth="1" strokeDasharray="3 2" />
    <line x1="192" y1="228" x2="192" y2="126" stroke={`${color}40`} strokeWidth="1" strokeDasharray="3 2" />

    <text x="286" y="336" textAnchor="middle" fill={MUTED} fontSize="11" fontWeight="700">
      2 isoterme + 2 isentropiche
    </text>
  </g>
);

const buildPlant = (type, accentColor) => {
  switch (type) {
    case 'rankine':
      return renderRankinePlant();
    case 'brayton':
      return renderBraytonPlant();
    case 'otto':
      return renderOttoPlant(accentColor);
    case 'diesel':
      return renderDieselPlant(accentColor);
    case 'refrigeration':
      return renderRefrigerationPlant(accentColor);
    case 'carnot':
      return renderCarnotPlant(accentColor);
    default:
      return null;
  }
};

const SchematicDiagram = ({
  type,
  accentColor = '#38BDF8',
  points = [],
  pointLabels = [],
  summaryItems = [],
  width = 980,
  height = 420,
}) => {
  const plant = buildPlant(type, accentColor);
  const infoPoints = points.slice(0, 4);
  const infoLabels = infoPoints.map((point, index) => pointLabels[index] ?? point?.name ?? `Punto ${index + 1}`);
  const cardWidth = 306;
  const visibleSummaryItems = summaryItems.slice(0, 5);
  const summaryCardWidth = visibleSummaryItems.length >= 5 ? 164 : 178;
  const summaryGap = 12;
  const summaryTotalWidth = visibleSummaryItems.length * summaryCardWidth + Math.max(visibleSummaryItems.length - 1, 0) * summaryGap;
  const summaryStartX = 964 - summaryTotalWidth - 18;

  return (
    <div className="schematic-container glass">
      <svg viewBox="0 0 980 460" width="100%" height="100%" className="schematic-svg" style={{ width, height }}>
        <rect x="16" y="16" width="566" height="360" rx="18" fill="#111827" stroke="rgba(255,255,255,0.08)" />
        <rect x="602" y="16" width="362" height="360" rx="18" fill="#111827" stroke="rgba(255,255,255,0.08)" />
        <rect x="16" y="392" width="948" height="52" rx="18" fill="#111827" stroke="rgba(255,255,255,0.08)" />

        <text x="40" y="42" fill={TEXT} fontSize="14" fontWeight="800">Schema impianto</text>
        <text x="626" y="42" fill={TEXT} fontSize="14" fontWeight="800">Punti del ciclo</text>
        <text x="40" y="420" fill={TEXT} fontSize="14" fontWeight="800">Bilancio energetico</text>

        <g transform="translate(10,12)">{plant}</g>

        {infoPoints.map((point, index) => (
          <PointCard
            key={`${infoLabels[index]}-${index}`}
            x={628}
            y={58 + index * 78}
            width={cardWidth}
            label={infoLabels[index]}
            point={point}
            color={accentColor}
          />
        ))}

        {visibleSummaryItems.map((item, index) => (
          <MetricCard
            key={`${item.label}-${index}`}
            x={summaryStartX + index * (summaryCardWidth + summaryGap)}
            y={402}
            width={summaryCardWidth}
            label={item.label}
            value={item.value}
            color={item.color ?? accentColor}
          />
        ))}
      </svg>
    </div>
  );
};

export default SchematicDiagram;
