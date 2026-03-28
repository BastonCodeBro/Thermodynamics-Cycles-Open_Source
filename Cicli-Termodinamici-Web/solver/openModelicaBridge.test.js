// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildCapabilityProbeScript,
  buildModelicaCheckScript,
  createModelicaWorkspaceFiles,
  validateSolverPayload,
} from './openModelicaBridge.js';

const payload = {
  domain: 'hydraulic',
  components: [
    { id: 'pump-1', componentId: 'hydraulic-pump' },
    { id: 'tank-1', componentId: 'hydraulic-reservoir' },
  ],
  connections: [],
  modelica: {
    modelName: 'ThermoHub.Generated.FluidPowerCircuit_hydraulic',
    source: `within ThermoHub.Generated;
model FluidPowerCircuit_hydraulic
end FluidPowerCircuit_hydraulic;`,
  },
};

describe('openModelicaBridge', () => {
  test('validates the solver payload contract', () => {
    expect(validateSolverPayload(payload).valid).toBe(true);
    expect(validateSolverPayload({}).valid).toBe(false);
  });

  test('builds the capability probe script', () => {
    const script = buildCapabilityProbeScript();

    expect(script).toContain('loadModel(Modelica);');
    expect(script).toContain('loadModel(OpenHydraulics);');
  });

  test('creates a Modelica workspace with package files and model source', async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'thermohub-bridge-test-'));
    const workspace = await createModelicaWorkspaceFiles(payload, { runtimeRoot });
    const modelSource = await fs.readFile(workspace.modelFilePath, 'utf8');
    const packageSource = await fs.readFile(
      path.join(workspace.workspaceDir, 'ThermoHub', 'Generated', 'package.mo'),
      'utf8',
    );

    expect(modelSource).toContain('model FluidPowerCircuit_hydraulic');
    expect(packageSource).toContain('package Generated');
  });

  test('builds the Modelica check script for the generated model', () => {
    const script = buildModelicaCheckScript({
      packageFilePaths: [
        'C:\\temp\\ThermoHub\\package.mo',
        'C:\\temp\\ThermoHub\\Generated\\package.mo',
      ],
      modelFilePath: 'C:\\temp\\ThermoHub\\Generated\\FluidPowerCircuit_hydraulic.mo',
      modelName: 'ThermoHub.Generated.FluidPowerCircuit_hydraulic',
      includeOpenHydraulics: true,
    });

    expect(script).toContain('loadModel(OpenHydraulics);');
    expect(script).toContain('C:/temp/ThermoHub/package.mo');
    expect(script).toContain('checkModel(ThermoHub.Generated.FluidPowerCircuit_hydraulic);');
    expect(script).toContain('C:/temp/ThermoHub/Generated/FluidPowerCircuit_hydraulic.mo');
  });
});
