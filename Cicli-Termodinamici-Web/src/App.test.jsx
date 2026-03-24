import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./utils/waterProps', () => ({
  ensureCoolProp: vi.fn().mockResolvedValue({}),
}));

describe('App routes', () => {
  test('renders landing page content', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/L'intera Termodinamica/i)).toBeInTheDocument();
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
});

