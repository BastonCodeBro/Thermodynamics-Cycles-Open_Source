import React from 'react';

const StatCard = ({ label, value, accent = false, color = '#38BDF8' }) => (
  <div
    className={`glass p-4 text-center stat-card ${accent ? 'stat-card-accent' : ''}`}
    style={accent ? {
      borderColor: `${color}50`,
      boxShadow: `0 0 20px ${color}1A`
    } : {}}
  >
    <div className="stat-card-label">{label}</div>
    <div
      className={`stat-card-value ${accent ? '' : 'text-white'}`}
      style={accent ? { color } : {}}
    >
      {value}
    </div>
  </div>
);

export default StatCard;
