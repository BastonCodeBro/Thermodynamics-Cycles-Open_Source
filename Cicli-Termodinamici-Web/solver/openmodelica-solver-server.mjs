import http from 'node:http';
import process from 'node:process';
import {
  getOpenModelicaCapabilities,
  solveWithOpenModelica,
  validateSolverPayload,
} from './openModelicaBridge.js';

const PORT = Number.parseInt(process.env.FLUID_POWER_SOLVER_PORT ?? '8080', 10);

const writeJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload, null, 2));
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk.toString();

      if (rawBody.length > 2_000_000) {
        reject(new Error('Payload troppo grande.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });

const buildMappingWarnings = (payload, result) => {
  const warnings = [...(result.diagnostics ?? [])];
  const mappedComponents = payload.openHydraulics?.mappedComponents ?? [];
  const unsupportedComponents = payload.openHydraulics?.unsupportedComponents ?? [];
  const manualMappings = mappedComponents.filter((component) => component.supportLevel === 'manual');

  if (manualMappings.length > 0) {
    warnings.push(
      `Mapping manuale richiesto per ${manualMappings.length} componente/i OpenHydraulics.`,
    );
  }

  if (unsupportedComponents.length > 0) {
    warnings.push(
      `Nessun mapping OpenHydraulics automatico per ${unsupportedComponents.length} componente/i del circuito.`,
    );
  }

  return warnings;
};

const buildExternalSolverResponse = (payload, result) => {
  const warnings = buildMappingWarnings(payload, result);

  return {
    snapshot: {
      warnings,
    summary: {
      externalSolver: {
        status: result.status,
        modelName: result.artifacts?.modelName ?? null,
        workspaceDir: result.artifacts?.workspaceDir ?? null,
        openHydraulicsAvailable: result.capabilities?.openHydraulicsAvailable ?? false,
        output: result.output ?? '',
        mappedComponents: payload.openHydraulics?.mappedComponents ?? [],
        unsupportedComponents: payload.openHydraulics?.unsupportedComponents ?? [],
      },
    },
    },
    solver: {
      source: 'external',
      detail: result.capabilities?.openHydraulicsAvailable
        ? 'OpenModelica bridge attivo con OpenHydraulics rilevata'
        : 'OpenModelica bridge attivo senza libreria OpenHydraulics rilevata',
      warnings,
    },
  };
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'OPTIONS') {
    writeJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    const capabilities = await getOpenModelicaCapabilities();
    writeJson(response, 200, {
      ok: true,
      service: 'thermohub-fluid-power-solver',
      capabilities,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/fluid-power/capabilities') {
    const capabilities = await getOpenModelicaCapabilities();
    writeJson(response, 200, capabilities);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/fluid-power/solve') {
    try {
      const payload = await readJsonBody(request);
      const validation = validateSolverPayload(payload);

      if (!validation.valid) {
        writeJson(response, 400, {
          ok: false,
          errors: validation.errors,
        });
        return;
      }

      const result = await solveWithOpenModelica(payload);

      if (result.status === 'unavailable') {
        writeJson(response, 503, {
          ok: false,
          solver: {
            source: 'external',
            detail: result.capabilities.detail,
            warnings: result.diagnostics,
          },
        });
        return;
      }

      if (result.status === 'error') {
        writeJson(response, 502, {
          ok: false,
          solver: {
            source: 'external',
            detail: 'OpenModelica ha rifiutato il modello generato.',
            warnings: result.diagnostics,
          },
          diagnostics: result.output,
        });
        return;
      }

      writeJson(response, 200, buildExternalSolverResponse(payload, result));
      return;
    } catch (error) {
      writeJson(response, 500, {
        ok: false,
        error: error.message,
      });
      return;
    }
  }

  writeJson(response, 404, {
    ok: false,
    error: 'Endpoint non trovato.',
  });
});

server.listen(PORT, () => {
  process.stdout.write(
    `[thermohub-fluid-power-solver] listening on http://localhost:${PORT}\n`,
  );
});
