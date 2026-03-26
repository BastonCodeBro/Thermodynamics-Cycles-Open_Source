import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./utils/waterProps', () => ({
  ensureCoolProp: vi.fn().mockResolvedValue({}),
  solveFluid: vi.fn().mockResolvedValue({
    t: 100,
    p: 1,
    h: 2676,
    s: 7.35,
    v: 1.694,
  }),
  getSaturationDomeFull: vi.fn().mockResolvedValue({
    ts: { s: [1, 2], t: [100, 200] },
    hs: { s: [1, 2], h: [500, 2600] },
  }),
}));

describe('App routes', () => {
  test('renders landing page content', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Tre aree per/i)).toBeInTheDocument();
    });
  });

  test('renders 404 fallback for unknown route', async () => {
    render(
      <MemoryRouter initialEntries={['/not-found']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pagina non trovata/i)).toBeInTheDocument();
    });
  });

  test('renders steam lab route', async () => {
    render(
      <MemoryRouter initialEntries={['/laboratorio-vapore']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Laboratorio Vapore/i })).toBeInTheDocument();
      expect(screen.getByText(/Strumento derivato dal desktop/i)).toBeInTheDocument();
    });
  });

  test('renders fluid power route', async () => {
    render(
      <MemoryRouter initialEntries={['/impianti-fluidici']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Impianti Oleodinamici \/ Pneumatici/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Oleodinamica/i })).toBeInTheDocument();
    });
  });

  test('renders thermodynamic library route', async () => {
    render(
      <MemoryRouter initialEntries={['/cicli-termodinamici']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tutti i principali cicli termodinamici/i })).toBeInTheDocument();
      expect(screen.getByText(/Ciclo Joule-Brayton/i)).toBeInTheDocument();
    });
  });

  test('renders state exams route', async () => {
    render(
      <MemoryRouter initialEntries={['/esami-di-stato']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tracce e svolgimenti dettagliati/i })).toBeInTheDocument();
      expect(screen.getAllByText(/A056 Ordinaria 2025/i).length).toBeGreaterThan(0);
    });
  });
});
