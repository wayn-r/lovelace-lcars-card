// Re-export the simplified morph engine
export { MorphEngine } from './morph/morph-engine.js';

export { ElementTypeUtils, GeometryUtils, ElementAnalyzer } from './morph/morph-element-utils.js';

export type { 
  MorphEngineOptions,
  MorphEngineHooks
} from './morph/morph-engine.js';

export type { 
  ElementMatch, 
  GroupMatch, 
  MatchingResult 
} from './morph/morph-element-matcher.js';
