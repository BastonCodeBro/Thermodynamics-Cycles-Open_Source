import { resolveThermoCycleResult } from './thermoCycleProfessionalAdapter';

export const resolveCycleDisplayResult = async ({
  cycleId,
  variant = null,
  mode = null,
  family = null,
  primaryFluid = null,
  secondaryFluid = null,
  inputs = {},
  outputsRequested = {},
  solverPreferences = {},
  computeLocalResult,
  mapResultToDisplay,
} = {}) => {
  const localResult = await computeLocalResult();
  const { result, solverMeta } = await resolveThermoCycleResult({
    cycleId,
    variant,
    mode,
    family,
    primaryFluid,
    secondaryFluid,
    inputs,
    outputsRequested,
    solverPreferences,
    localResult,
  });

  return {
    ...mapResultToDisplay(result, solverMeta, localResult),
    solverMeta,
  };
};
