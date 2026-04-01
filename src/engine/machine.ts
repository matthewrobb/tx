/**
 * XState v5 epic state machine.
 *
 * States: active → (advance) → active | complete | error
 *         active → (block)   → blocked
 *         blocked → (advance) → active
 *
 * The machine does not perform side effects — it tracks state transitions.
 * Persistence (snapshot save/restore) is handled in persist.ts.
 */

import { setup, assign } from "xstate";
import type { EpicContext, EpicEvent } from "../types/xstate.js";
import type { EngineResult } from "../types/engine.js";

export const epicMachine = setup({
  types: {
    context: {} as EpicContext,
    events: {} as EpicEvent,
    input: {} as EpicContext,
  },
  actions: {
    setResult: assign({
      result: ({ event }) => {
        if (event.type === "ADVANCE" || event.type === "COMPLETE") {
          return (event as { result?: EngineResult }).result;
        }
        return undefined;
      },
    }),
    setError: assign({
      error: ({ event }) => {
        if (event.type === "ERROR") return (event as { type: "ERROR"; error: string }).error;
        return undefined;
      },
    }),
    clearError: assign({ error: undefined }),
  },
}).createMachine({
  id: "epic",
  initial: "active",
  context: ({ input }) => input,
  states: {
    active: {
      on: {
        ADVANCE: {
          actions: "setResult",
        },
        BLOCK: {
          target: "blocked",
        },
        COMPLETE: {
          target: "complete",
          actions: "setResult",
        },
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },
    blocked: {
      on: {
        ADVANCE: {
          target: "active",
          actions: ["clearError", "setResult"],
        },
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },
    complete: {
      type: "final",
    },
    error: {
      on: {
        ADVANCE: {
          target: "active",
          actions: ["clearError", "setResult"],
        },
      },
    },
  },
});

export type EpicMachine = typeof epicMachine;
