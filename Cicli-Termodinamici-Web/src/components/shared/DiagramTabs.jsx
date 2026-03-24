import React, { useState } from 'react';

const DiagramTabs = ({ tabs, accentColor = '#38BDF8' }) => {
  const [active, setActive] = useState(0);

  if (!tabs || tabs.length === 0) return null;

  const safeActive = Math.min(active, tabs.length - 1);

  return (
    <div className="diagram-tabs-wrapper">
      <div className="diagram-tabs-bar">
        {tabs.map((tab, i) => (
          <button
            key={tab.id || i}
            className={`diagram-tab ${safeActive === i ? 'diagram-tab-active' : ''}`}
            onClick={() => setActive(i)}
            style={safeActive === i ? { borderColor: accentColor, color: accentColor } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="diagram-tab-content">
        {tabs[safeActive]?.content}
      </div>
    </div>
  );
};

export default DiagramTabs;
