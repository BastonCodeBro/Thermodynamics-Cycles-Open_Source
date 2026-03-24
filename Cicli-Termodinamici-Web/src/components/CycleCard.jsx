import React from 'react';
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const CycleCard = ({ title, id, description, Icon = Activity, color = '#38BDF8' }) => {
  return (
    <Link to={`/${id}`} className="cycle-card glass no-underline">
      <div className="card-icon-wrapper" style={{ background: `${color}15`, color }}>
        <Icon className="card-icon" />
      </div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
      <div className="card-footer" style={{ color }}>
        Esplora Ciclo <span>→</span>
      </div>
    </Link>
  );
};

export default CycleCard;
