import { HomeAssistant } from 'custom-card-helpers';
import { ReactiveStore } from './store.js';
import { StateManager } from '../utils/state-manager.js';
import { AnimationManager } from '../utils/animation.js';
import { ColorResolver } from '../utils/color-resolver.js';
import { LoggerService } from '../utils/logger-service.js';
import { TransformPropagator } from '../utils/transform-propagator.js';
import { Diagnostics, ScopedLogger } from '../utils/diagnostics.js';

export interface CardRuntime {
  store: ReactiveStore;
  state: StateManager;
  animations: AnimationManager;
  colors: ColorResolver;
  logger: LoggerService;
  diagnostics: ScopedLogger;
  hass?: HomeAssistant;
  getShadowElement: (id: string) => Element | null;
  requestUpdate: () => void;
  destroy: () => void;
}

export class RuntimeFactory {
  static create(params: {
    requestUpdate: () => void;
    getShadowElement: (id: string) => Element | null;
    hass?: HomeAssistant;
  }): CardRuntime {
    const store = new ReactiveStore();
    const animations = new AnimationManager(new TransformPropagator());
    const state = new StateManager(params.requestUpdate, store, animations);
    const colors = new ColorResolver();
    colors.setStateAccessor((name: string) => state.getState(name));

    const logger = new LoggerService();
    const diagnostics = Diagnostics.create('CardRuntime');

    const runtime: CardRuntime = {
      store,
      state,
      animations,
      colors,
      logger,
      diagnostics,
      hass: params.hass,
      getShadowElement: params.getShadowElement,
      requestUpdate: params.requestUpdate,
      destroy: () => {
        try { animations.cleanup(); } catch {}
        try { colors.cleanup(); } catch {}
        try { state.cleanup(); } catch {}
        try { logger.destroy(); } catch {}
      }
    };

    return runtime;
  }
}


