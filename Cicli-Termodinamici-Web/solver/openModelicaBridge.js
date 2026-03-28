import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RUNTIME_ROOT = path.join(os.tmpdir(), 'thermohub-fluid-power-solver');
const OPENMODELICA_DOCKER_IMAGE =
  process.env.OPENMODELICA_DOCKER_IMAGE?.trim() ?? 'openmodelica/openmodelica:v1.26.3-minimal';
const DOCKER_OPENMODELICA_HOME = path.join(DEFAULT_RUNTIME_ROOT, 'docker-home');
const DOCKER_CONTAINER_WORKSPACE = '/workspace';
const DOCKER_CONTAINER_HOME = '/root/.openmodelica';

const sanitizeName = (value) => (value ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');

const normalizeModelicaPath = (value) => value.replace(/\\/g, '/');

const trimOutput = (value, maxLength = 4000) => {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
};

export const validateSolverPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      errors: ['Payload solver assente o non valido.'],
    };
  }

  const errors = [];

  if (!payload.domain) {
    errors.push('Campo "domain" mancante.');
  }

  if (!Array.isArray(payload.components)) {
    errors.push('Campo "components" non valido.');
  }

  if (!Array.isArray(payload.connections)) {
    errors.push('Campo "connections" non valido.');
  }

  if (!payload.modelica?.modelName || !payload.modelica?.source) {
    errors.push('Sezione "modelica" incompleta.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const runCommand = (command, args, { cwd, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`Comando in timeout dopo ${timeoutMs} ms.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });

export const resolveOmcExecutable = async (explicitPath = process.env.OMC_EXECUTABLE?.trim()) => {
  if (explicitPath) {
    return explicitPath;
  }

  const locatorCommand = process.platform === 'win32' ? 'where.exe' : 'which';
  const locatorArgs = process.platform === 'win32' ? ['omc'] : ['omc'];

  try {
    const result = await runCommand(locatorCommand, locatorArgs, { timeoutMs: 4000 });
    const candidate = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return candidate ?? null;
  } catch {
    return null;
  }
};

export const buildCapabilityProbeScript = () => `loadModel(Modelica);
loadModel(OpenHydraulics);
getErrorString();
`;

const parseCapabilityProbe = ({ stdout, stderr }) => {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  const hasModelica = combined.includes('true');
  const openHydraulicsAvailable =
    hasModelica &&
    !combined.includes('error') &&
    !combined.includes('failed') &&
    !combined.includes('not found');

  return {
    openHydraulicsAvailable,
    rawOutput: trimOutput(`${stdout}\n${stderr}`.trim()),
  };
};

const toContainerPath = (filePath, workspaceDir) => {
  const relativePath = path.relative(workspaceDir, filePath).split(path.sep).join('/');
  return `${DOCKER_CONTAINER_WORKSPACE}/${relativePath}`;
};

const isDockerReady = async () => {
  try {
    await runCommand('docker', ['info'], { timeoutMs: 8000 });
    return true;
  } catch {
    return false;
  }
};

const runDockerOmc = async ({
  omcArgs,
  workspaceDir,
  homeDir = DOCKER_OPENMODELICA_HOME,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  await fs.mkdir(homeDir, { recursive: true });

  return runCommand(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${workspaceDir}:${DOCKER_CONTAINER_WORKSPACE}`,
      '-v',
      `${homeDir}:${DOCKER_CONTAINER_HOME}`,
      '-w',
      DOCKER_CONTAINER_WORKSPACE,
      OPENMODELICA_DOCKER_IMAGE,
      'omc',
      ...omcArgs,
    ],
    { timeoutMs },
  );
};

const hasInstalledDockerLibrary = async (homeDir, packageName) => {
  try {
    const libraryRoot = path.join(homeDir, 'libraries');
    const entries = await fs.readdir(libraryRoot);

    return entries.some((entry) => entry.toLowerCase().startsWith(packageName.toLowerCase()));
  } catch {
    return false;
  }
};

const ensureDockerLibraries = async (workspaceDir, homeDir = DOCKER_OPENMODELICA_HOME) => {
  const missingLibraries = [];

  if (!(await hasInstalledDockerLibrary(homeDir, 'Modelica'))) {
    missingLibraries.push('Modelica');
  }

  if (!(await hasInstalledDockerLibrary(homeDir, 'OpenHydraulics'))) {
    missingLibraries.push('OpenHydraulics');
  }

  if (missingLibraries.length === 0) {
    return {
      installed: false,
      output: '',
    };
  }

  const installScriptPath = path.join(workspaceDir, 'install-libraries.mos');
  const installScript = [
    'updatePackageIndex();',
    ...missingLibraries.map((libraryName) => `installPackage(${libraryName});`),
    'getErrorString();',
    '',
  ].join('\n');

  await fs.writeFile(installScriptPath, installScript, 'utf8');
  const result = await runDockerOmc({
    omcArgs: [toContainerPath(installScriptPath, workspaceDir)],
    workspaceDir,
    homeDir,
    timeoutMs: 180000,
  });

  return {
    installed: true,
    output: trimOutput(`${result.stdout}\n${result.stderr}`.trim()),
  };
};

const getLocalOpenModelicaCapabilities = async (executable) => {
  let version = null;
  let detail = 'OpenModelica disponibile.';
  let openHydraulicsAvailable = false;
  let probeOutput = '';

  try {
    const versionResult = await runCommand(executable, ['--version'], { timeoutMs: 5000 });
    version = trimOutput(versionResult.stdout.trim() || versionResult.stderr.trim());
  } catch (error) {
    detail = `OpenModelica trovato ma impossibile leggere la versione: ${error.message}`;
  }

  try {
    await fs.mkdir(DEFAULT_RUNTIME_ROOT, { recursive: true });
    const probeDir = await fs.mkdtemp(path.join(DEFAULT_RUNTIME_ROOT, 'probe-local-'));
    const probePath = path.join(probeDir, 'probe.mos');
    await fs.writeFile(probePath, buildCapabilityProbeScript(), 'utf8');

    const probeResult = await runCommand(executable, [probePath], {
      cwd: probeDir,
      timeoutMs: 8000,
    });
    const probe = parseCapabilityProbe(probeResult);
    openHydraulicsAvailable = probe.openHydraulicsAvailable;
    probeOutput = probe.rawOutput;
  } catch (error) {
    detail = `OpenModelica disponibile, ma il probe librerie ha fallito: ${error.message}`;
  }

  return {
    available: true,
    executable,
    mode: 'local',
    version,
    openHydraulicsAvailable,
    detail,
    probeOutput,
  };
};

const getDockerOpenModelicaCapabilities = async () => {
  if (!(await isDockerReady())) {
    return {
      available: false,
      executable: null,
      mode: 'docker',
      version: null,
      openHydraulicsAvailable: false,
      detail: 'Docker e disponibile ma il daemon non risponde.',
    };
  }

  await fs.mkdir(DEFAULT_RUNTIME_ROOT, { recursive: true });
  const probeDir = await fs.mkdtemp(path.join(DEFAULT_RUNTIME_ROOT, 'probe-docker-'));
  const versionResult = await runDockerOmc({
    omcArgs: ['--version'],
    workspaceDir: probeDir,
    timeoutMs: 300000,
  });
  const installResult = await ensureDockerLibraries(probeDir, DOCKER_OPENMODELICA_HOME);
  const probePath = path.join(probeDir, 'probe.mos');
  await fs.writeFile(probePath, buildCapabilityProbeScript(), 'utf8');
  const probeResult = await runDockerOmc({
    omcArgs: [toContainerPath(probePath, probeDir)],
    workspaceDir: probeDir,
    timeoutMs: 120000,
  });
  const probe = parseCapabilityProbe(probeResult);

  return {
    available: true,
    executable: `docker:${OPENMODELICA_DOCKER_IMAGE}`,
    mode: 'docker',
    version: trimOutput(versionResult.stdout.trim() || versionResult.stderr.trim()),
    openHydraulicsAvailable: probe.openHydraulicsAvailable,
    detail: installResult.installed
      ? 'OpenModelica disponibile via Docker con librerie inizializzate nel profilo container.'
      : 'OpenModelica disponibile via Docker.',
    probeOutput: trimOutput(
      [installResult.output, probe.rawOutput].filter(Boolean).join('\n'),
    ),
  };
};

export const getOpenModelicaCapabilities = async () => {
  const executable = await resolveOmcExecutable();

  if (executable) {
    return getLocalOpenModelicaCapabilities(executable);
  }

  try {
    return await getDockerOpenModelicaCapabilities();
  } catch (error) {
    return {
      available: false,
      executable: null,
      mode: 'unavailable',
      version: null,
      openHydraulicsAvailable: false,
      detail: `OpenModelica Compiler (omc) non trovato nel PATH e fallback Docker non disponibile (${error.message}).`,
    };
  }
};

const buildPackageFile = (packagePathParts, packageName) => {
  if (packagePathParts.length === 0) {
    return `within ;
package ${packageName}
end ${packageName};
`;
  }

  return `within ${packagePathParts.join('.')};
package ${packageName}
end ${packageName};
`;
};

export const createModelicaWorkspaceFiles = async (
  payload,
  {
    runtimeRoot = DEFAULT_RUNTIME_ROOT,
  } = {},
) => {
  const validation = validateSolverPayload(payload);

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const modelNameParts = payload.modelica.modelName.split('.');
  const className = modelNameParts.at(-1);
  const packageParts = modelNameParts.slice(0, -1);
  await fs.mkdir(runtimeRoot, { recursive: true });
  const workspaceDir = await fs.mkdtemp(
    path.join(
      runtimeRoot,
      `${sanitizeName(payload.domain)}-${sanitizeName(className)}-`,
    ),
  );

  const modelDir = path.join(workspaceDir, ...packageParts);
  await fs.mkdir(modelDir, { recursive: true });
  const packageFilePaths = [];

  for (let index = 0; index < packageParts.length; index += 1) {
    const currentParts = packageParts.slice(0, index);
    const packageName = packageParts[index];
    const currentDir = path.join(workspaceDir, ...packageParts.slice(0, index + 1));
    await fs.mkdir(currentDir, { recursive: true });
    const packageFilePath = path.join(currentDir, 'package.mo');
    await fs.writeFile(packageFilePath, buildPackageFile(currentParts, packageName), 'utf8');
    packageFilePaths.push(packageFilePath);
  }

  const modelFilePath = path.join(modelDir, `${className}.mo`);
  const manifestPath = path.join(workspaceDir, 'payload.json');
  await fs.writeFile(modelFilePath, payload.modelica.source, 'utf8');
  await fs.writeFile(manifestPath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    workspaceDir,
    modelFilePath,
    packageFilePaths,
    manifestPath,
    modelName: payload.modelica.modelName,
  };
};

export const buildModelicaCheckScript = ({
  modelFilePath,
  packageFilePaths = [],
  modelName,
  includeOpenHydraulics = false,
}) => {
  const lines = ['loadModel(Modelica);'];

  if (includeOpenHydraulics) {
    lines.push('loadModel(OpenHydraulics);');
  }

  packageFilePaths.slice(0, 1).forEach((packageFilePath) => {
    lines.push(`loadFile("${normalizeModelicaPath(packageFilePath)}");`);
  });
  lines.push(`loadFile("${normalizeModelicaPath(modelFilePath)}");`);
  lines.push(`checkModel(${modelName});`);
  lines.push('getErrorString();');

  return `${lines.join('\n')}\n`;
};

const evaluateOmcCheckResult = ({ code, stdout, stderr }) => {
  const combinedOutput = trimOutput(`${stdout}\n${stderr}`.trim());
  const hasSuccessfulCheck = /completed successfully/i.test(combinedOutput);
  const hasExplicitError = /(^|\n|\r)\s*Error:/i.test(combinedOutput);
  const hasFalseResult = /(^|[\s"])\bfalse\b([\s"]|$)/i.test(combinedOutput);
  const ok = code === 0 && (hasSuccessfulCheck || (!hasExplicitError && !hasFalseResult));

  return {
    ok,
    combinedOutput,
  };
};

export const solveWithOpenModelica = async (
  payload,
  {
    runtimeRoot = DEFAULT_RUNTIME_ROOT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) => {
  const capabilities = await getOpenModelicaCapabilities();
  const artifacts = await createModelicaWorkspaceFiles(payload, { runtimeRoot });

  if (!capabilities.available) {
    return {
      status: 'unavailable',
      capabilities,
      artifacts,
      diagnostics: ['OpenModelica non disponibile sulla macchina host.'],
    };
  }

  const scriptPath = path.join(artifacts.workspaceDir, 'check-model.mos');
  const visibleModelFilePath =
    capabilities.mode === 'docker'
      ? toContainerPath(artifacts.modelFilePath, artifacts.workspaceDir)
      : artifacts.modelFilePath;
  const visiblePackageFilePaths =
    capabilities.mode === 'docker'
      ? artifacts.packageFilePaths.map((packageFilePath) =>
        toContainerPath(packageFilePath, artifacts.workspaceDir),
      )
      : artifacts.packageFilePaths;
  const script = buildModelicaCheckScript({
    modelFilePath: visibleModelFilePath,
    packageFilePaths: visiblePackageFilePaths,
    modelName: artifacts.modelName,
    includeOpenHydraulics: capabilities.openHydraulicsAvailable,
  });
  await fs.writeFile(scriptPath, script, 'utf8');
  const effectiveTimeoutMs =
    capabilities.mode === 'docker' ? Math.max(timeoutMs, 120000) : timeoutMs;

  try {
    const result =
      capabilities.mode === 'docker'
        ? await runDockerOmc({
          omcArgs: [toContainerPath(scriptPath, artifacts.workspaceDir)],
          workspaceDir: artifacts.workspaceDir,
          timeoutMs: effectiveTimeoutMs,
        })
        : await runCommand(capabilities.executable, [scriptPath], {
          cwd: artifacts.workspaceDir,
          timeoutMs: effectiveTimeoutMs,
        });

    const evaluation = evaluateOmcCheckResult(result);

    return {
      status: evaluation.ok ? 'checked' : 'error',
      capabilities,
      artifacts: {
        ...artifacts,
        scriptPath,
      },
      diagnostics:
        evaluation.ok
          ? [
            capabilities.mode === 'docker'
              ? 'Modello Modelica generato e verificato con OpenModelica via Docker.'
              : 'Modello Modelica generato e verificato con OpenModelica.',
          ]
          : ['OpenModelica ha rifiutato o non ha verificato correttamente il modello generato.'],
      output: evaluation.combinedOutput,
      exitCode: result.code,
    };
  } catch (error) {
    return {
      status: 'error',
      capabilities,
      artifacts: {
        ...artifacts,
        scriptPath,
      },
      diagnostics: [`Verifica OpenModelica fallita: ${error.message}`],
      output: '',
      exitCode: null,
    };
  }
};
