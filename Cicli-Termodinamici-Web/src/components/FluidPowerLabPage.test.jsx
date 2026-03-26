import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FluidPowerLabPage from './FluidPowerLabPage';

const addComponent = (label) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
};

describe('FluidPowerLabPage', () => {
  test('renders the domain tabs and updates the palette by domain', () => {
    render(<FluidPowerLabPage />);

    expect(screen.getByRole('button', { name: /^Aggiungi Pompa idraulica$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pneumatica/i }));

    expect(screen.getByRole('button', { name: /^Aggiungi Compressore$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aggiungi Pompa idraulica$/i })).not.toBeInTheDocument();
  });

  test('blocks incompatible port connections', () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Motore primo$/i);
    addComponent(/^Aggiungi Pompa idraulica$/i);

    fireEvent.click(screen.getByRole('button', { name: /Porta Albero di Motore primo 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Porta P di Pompa idraulica 1/i }));

    expect(screen.getByText(/Porte incompatibili/i)).toBeInTheDocument();
  });

  test('starts a valid minimal hydraulic simulation', () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Pompa idraulica$/i);
    addComponent(/^Aggiungi Valvola 3\/2 monostabile$/i);
    addComponent(/^Aggiungi Cilindro a singolo effetto$/i);
    addComponent(/^Aggiungi Serbatoio$/i);

    fireEvent.click(screen.getByRole('button', { name: /Porta P di Pompa idraulica 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Porta P di Valvola 3\/2 monostabile 1/i }));

    fireEvent.click(screen.getByRole('button', { name: /Porta A di Valvola 3\/2 monostabile 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Porta A di Cilindro a singolo effetto 1/i }));

    fireEvent.click(screen.getByRole('button', { name: /Porta R di Valvola 3\/2 monostabile 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Porta T di Serbatoio 1/i }));

    fireEvent.click(screen.getByRole('button', { name: /Commuta Valvola 3\/2 monostabile 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Avvia schema/i }));

    expect(screen.getAllByText(/Schema avviato/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/estensione/i).length).toBeGreaterThan(0);
  });
});
