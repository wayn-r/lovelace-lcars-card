import { HomeAssistant } from 'custom-card-helpers';
import { ReactiveStore } from './store.js';
import { StateManager } from '../utils/state-manager.js';
import { animationManager as globalAnimationManager, AnimationManager } from '../utils/animation.js';
import { colorResolver as globalColorResolver, ColorResolver } from '../utils/color-resolver.js';
import { transformPropagator as globalTransformPropagator, TransformPropagator } from '../utils/transform-propagator.js';
import { LoggerService } from '../utils/logger-service.js';

export interface CardRuntime {
  store: ReactiveStore;
  state: StateManager;
  animations: AnimationManager;
  colors: ColorResolver;
  transforms: TransformPropagator;
  logger: LoggerService;
  hass?: HomeAssistant;
  getShadowElement: (id: string) => Element | null;
  requestUpdate: () => void;
}

export class RuntimeFactory {
  static create(params: {
    requestUpdate: () => void;
    getShadowElement: (id: string) => Element | null;
    hass?: HomeAssistant;
  }): CardRuntime {
    const store = new ReactiveStore();
    const state = new StateManager(params.requestUpdate, store);

    const animations = globalAnimationManager;
    const transforms = globalTransformPropagator;
    const colors = globalColorResolver;

    ColorResolver.setStateAccessor((name: string) => state.getState(name));

    const logger = new LoggerService();

    return {
      store,
      state,
      animations,
      colors,
      transforms,
      logger,
      hass: params.hass,
      getShadowElement: params.getShadowElement,
      requestUpdate: params.requestUpdate
    };
  }
}


