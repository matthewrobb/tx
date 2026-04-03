// src/setup/index.ts — barrel export for the setup module
export { runInit } from './init.js';
export type { InitInput, InitResult } from './init.js';
export { getPrompt } from './questions.js';
export type { SetupStep, SetupState, SetupAnswers } from './questions.js';
