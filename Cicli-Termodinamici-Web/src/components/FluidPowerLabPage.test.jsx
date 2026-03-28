import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FluidPowerLabPage from './FluidPowerLabPage';
import { FLUID_POWER_PROJECT_STORAGE_KEY } from '../utils/fluidPowerProject';

const addComponent = (label) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
};

describe('FluidPowerLabPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('renders the domain tabs and updates the palette by domain', () => {
    render(<FluidPowerLabPage />);

    expect(screen.getByRole('button', { name: /^Aggiungi Pompa idraulica$/i })).toBeInTheDocument();
    expect(screen.getByText(/Workspace locale/i)).toBeInTheDocument();

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

  test('starts a valid minimal hydraulic simulation', async () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Pompa idraulica$/i);
    addComponent(/^Aggiungi Valvola 3\/2 monostabile$/i);
    addComponent(/^Aggiungi Cilindro a singolo effetto$/i);
    addComponent(/^Aggiungi Serbatoio$/i);

    fireEvent.click(screen.getByLabelText(/Porta P di Pompa idraulica 1/i));
    fireEvent.click(screen.getByLabelText(/Porta P di Valvola 3\/2 monostabile 1/i));

    fireEvent.click(screen.getByLabelText(/Porta A di Valvola 3\/2 monostabile 1/i));
    fireEvent.click(screen.getByLabelText(/Porta A di Cilindro a singolo effetto 1/i));

    fireEvent.click(screen.getByLabelText(/Porta R di Valvola 3\/2 monostabile 1/i));
    fireEvent.click(screen.getByLabelText(/Porta T di Serbatoio 1/i));

    fireEvent.click(screen.getByRole('button', { name: /Commuta Valvola 3\/2 monostabile 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Avvia schema/i }));

    expect((await screen.findAllByText(/Schema avviato/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/estensione/i)).length).toBeGreaterThan(0);
  }, 10000);

  test('updates the selected valve command from the inspector', () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Valvola 3\/2 monostabile$/i);
    fireEvent.click(screen.getAllByText(/Valvola 3\/2 monostabile 1/i)[0]);
    fireEvent.change(screen.getByLabelText(/Tipo comando distributore/i), {
      target: { value: 'solenoid' },
    });

    expect(screen.getAllByText(/Solenoide/i).length).toBeGreaterThan(0);
  });

  test('shows full technical characteristics on component hover', () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Pompa idraulica$/i);

    const nodeTitle = screen.getAllByText(/Pompa idraulica 1/i)[0];
    const nodeCard = nodeTitle.closest('.fluid-node');

    expect(nodeCard).not.toBeNull();

    fireEvent.mouseEnter(nodeCard);

    const hoverCard = screen.getByRole('note', { name: /Caratteristiche Pompa idraulica 1/i });

    expect(within(hoverCard).getByText(/Caratteristiche nominali/i)).toBeInTheDocument();
    expect(within(hoverCard).getByText(/Potenza albero/i)).toBeInTheDocument();
    expect(within(hoverCard).getByText(/Portata nominale/i)).toBeInTheDocument();
  });

  test('shows pressure flow and temperature on line hover', async () => {
    const { container } = render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Pompa idraulica$/i);
    addComponent(/^Aggiungi Valvola 3\/2 monostabile$/i);
    addComponent(/^Aggiungi Cilindro a singolo effetto$/i);
    addComponent(/^Aggiungi Serbatoio$/i);

    fireEvent.click(screen.getByLabelText(/Porta P di Pompa idraulica 1/i));
    fireEvent.click(screen.getByLabelText(/Porta P di Valvola 3\/2 monostabile 1/i));
    fireEvent.click(screen.getByLabelText(/Porta A di Valvola 3\/2 monostabile 1/i));
    fireEvent.click(screen.getByLabelText(/Porta A di Cilindro a singolo effetto 1/i));
    fireEvent.click(screen.getByLabelText(/Porta R di Valvola 3\/2 monostabile 1/i));
    fireEvent.click(screen.getByLabelText(/Porta T di Serbatoio 1/i));
    fireEvent.click(screen.getByRole('button', { name: /Commuta Valvola 3\/2 monostabile 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Avvia schema/i }));

    const activeLine = await waitFor(() => {
      const line = container.querySelector('.fluid-connection-active');
      expect(line).not.toBeNull();
      return line;
    });

    fireEvent.mouseEnter(activeLine);

    const hoverCard = screen.getByRole('note', { name: /Linea /i });
    expect(within(hoverCard).getByText(/Portata/i)).toBeInTheDocument();
    expect(within(hoverCard).getByText(/Pressione ingresso/i)).toBeInTheDocument();
    expect(within(hoverCard).getByText(/Temperatura/i)).toBeInTheDocument();
  }, 10000);

  test('persists autosave without project mode metadata', async () => {
    render(<FluidPowerLabPage />);

    addComponent(/^Aggiungi Pompa idraulica$/i);

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(FLUID_POWER_PROJECT_STORAGE_KEY));
      expect(saved.mode).toBeUndefined();
      expect(saved.workspaces.hydraulic.nodes).toHaveLength(1);
    });
  });

  test('hydrates the simplified workspace from local storage', () => {
    window.localStorage.setItem(
      FLUID_POWER_PROJECT_STORAGE_KEY,
      JSON.stringify({
        type: 'thermohub-fluid-power-project',
        id: 'project-test',
        name: 'Fluid Power Project',
        units: 'metric',
        version: 1,
        author: 'ThermoHub',
        tags: ['fluid-power'],
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:00:00.000Z',
        workspaces: {
          hydraulic: {
            nodes: [
              {
                instanceId: 'node-1',
                componentId: 'hydraulic-pump',
                x: 48,
                y: 48,
                label: 'Pompa idraulica 1',
              },
            ],
            connections: [],
          },
          pneumatic: {},
        },
      }),
    );

    render(<FluidPowerLabPage />);

    expect(screen.getByText(/Pompa idraulica 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pannello circuito/i)).toBeInTheDocument();
  });
});
