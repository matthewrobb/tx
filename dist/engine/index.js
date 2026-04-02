/**
 * Engine public API — facade over the artifact-driven v4 engine.
 *
 * The Engine interface is what the CLI calls; internal modules are not imported directly.
 */
export { artifactSatisfied, allArtifactsSatisfied, missingArtifacts } from "./artifacts.js";
export { evaluatePredicate, evaluateAllPredicates, failingPredicates } from "./predicates.js";
export { evaluateSteps, activeStep, laneComplete } from "./evaluate.js";
export { findLane, laneSequenceForType, nextLane, canEnterLane, computeAdvancement } from "./lanes.js";
export { epicMachine } from "./machine.js";
export { saveSnapshot, loadSnapshot, createOrRehydrateActor } from "./persist.js";
export { txNext, loadCoreState, saveCoreState, moveEpicToLane } from "./next.js";
//# sourceMappingURL=index.js.map