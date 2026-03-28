import http from 'node:http';
import process from 'node:process';
import {
  getThermoCycleCapabilities,
  solveThermoCyclePayload,
} from './thermoCycleBridge.js';

const PORT = Number.parseInt(process.env.THERMO_CYCLE_SOLVER_PORT ?? '8090', 10);

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

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'OPTIONS') {
    writeJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    const capabilities = await getThermoCycleCapabilities();
    writeJson(response, 200, {
      ok: true,
      service: 'thermohub-thermo-cycle-solver',
      capabilities,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/thermo/capabilities') {
    writeJson(response, 200, await getThermoCycleCapabilities());
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/thermo/solve-cycle') {
    try {
      const payload = await readJsonBody(request);
      const result = await solveThermoCyclePayload(payload);

      if (!result.ok) {
        writeJson(response, result.statusCode ?? 400, {
          ok: false,
          errors: result.errors ?? ['Errore solver non specificato.'],
        });
        return;
      }

      writeJson(response, 200, {
        result: result.result,
        solver: result.solver,
      });
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
    `[thermohub-thermo-cycle-solver] listening on http://localhost:${PORT}\n`,
  );
});
