import React, { useEffect, useState } from 'react';
import { Wind, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const cycleLinks = [
  { to: '/rankine', label: 'Rankine' },
  { to: '/brayton', label: 'Brayton' },
  { to: '/otto', label: 'Otto' },
  { to: '/diesel', label: 'Diesel' },
  { to: '/frigo', label: 'Frigorifero' },
  { to: '/carnot', label: 'Carnot' },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <nav className="navbar glass">
        <Link to="/" className="nav-logo no-underline">
          <Wind className="nav-icon" />
          <span className="logo-text">Thermo<span className="accent">Hub</span></span>
        </Link>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Home
          </Link>
          {cycleLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          className="nav-mobile-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Apri menu di navigazione"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <Menu size={22} />
        </button>
      </nav>

      {menuOpen && (
        <div className="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu mobile">
          <button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="Chiudi menu">
            <X size={24} />
          </button>
          <Link to="/" className="nav-link no-underline" onClick={() => setMenuOpen(false)}>Home</Link>
          {cycleLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-link no-underline"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default Navbar;
