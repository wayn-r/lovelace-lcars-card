import { IInteractive } from './interfaces.js';
import { LayoutElementProps } from '../layout/engine.js';
import { ColorValue, Action } from '../types.js';

/**
 * Interaction manager that handles user interactions and state changes
 */
export class InteractionManager implements IInteractive {
  id: string;
  private _isHovering = false;
  private _isActive = false;
  private _hoverTimeout?: ReturnType<typeof setTimeout>;
  private _activeTimeout?: ReturnType<typeof setTimeout>;

  private readonly _boundHandleMouseEnter: () => void;
  private readonly _boundHandleMouseLeave: () => void;
  private readonly _boundHandleMouseDown: () => void;
  private readonly _boundHandleMouseUp: () => void;
  private readonly _boundHandleTouchStart: () => void;
  private readonly _boundHandleTouchEnd: () => void;

  getShadowElement?: (id: string) => Element | null;
  requestUpdateCallback?: () => void;
  private _props?: LayoutElementProps;

  constructor(
    id: string,
    getShadowElement?: (id: string) => Element | null,
    requestUpdateCallback?: () => void,
    props?: LayoutElementProps
  ) {
    this.id = id;
    this.getShadowElement = getShadowElement;
    this.requestUpdateCallback = requestUpdateCallback;
    this._props = props;

    // Bind event handlers once for consistent listener removal
    this._boundHandleMouseEnter = this._handleMouseEnter.bind(this);
    this._boundHandleMouseLeave = this._handleMouseLeave.bind(this);
    this._boundHandleMouseDown = this._handleMouseDown.bind(this);
    this._boundHandleMouseUp = this._handleMouseUp.bind(this);
    this._boundHandleTouchStart = this._handleTouchStart.bind(this);
    this._boundHandleTouchEnd = this._handleTouchEnd.bind(this);
  }

  // Interactive state management
  get isHovering(): boolean {
    return this._isHovering;
  }

  set isHovering(value: boolean) {
    if (this._isHovering !== value) {
      this._isHovering = value;
      
      // Clear hover timeout if it exists
      if (this._hoverTimeout) {
        clearTimeout(this._hoverTimeout);
        this._hoverTimeout = undefined;
      }
      
      // Request update to re-render with new interactive state
      this._requestUpdateWithInteractiveState();
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(value: boolean) {
    if (this._isActive !== value) {
      this._isActive = value;
      
      // Clear active timeout if it exists
      if (this._activeTimeout) {
        clearTimeout(this._activeTimeout);
        this._activeTimeout = undefined;
      }
      
      // Request update to re-render with new interactive state
      this._requestUpdateWithInteractiveState();
    }
  }

  private _requestUpdateWithInteractiveState(): void {
    this.requestUpdateCallback?.();
  }

  /**
   * Setup event listeners for interactive states (hover/active)
   */
  setupInteractiveListeners(): void {
    if (!this.getShadowElement) {
      return;
    }

    // First clean up any existing listeners
    this._cleanupInteractiveListeners();

    const element = this.getShadowElement(this.id);
    if (!element) {
      return;
    }

    // Check if this element should have interactive behavior
    if (this.hasInteractiveFeatures()) {
      // Add mouse event listeners
      element.addEventListener('mouseenter', this._boundHandleMouseEnter);
      element.addEventListener('mouseleave', this._boundHandleMouseLeave);
      element.addEventListener('mousedown', this._boundHandleMouseDown);
      element.addEventListener('mouseup', this._boundHandleMouseUp);
      
      // Add touch event listeners for mobile support
      element.addEventListener('touchstart', this._boundHandleTouchStart);
      element.addEventListener('touchend', this._boundHandleTouchEnd);
    }
  }

  /**
   * Check if this element has interactive features
   */
  hasInteractiveFeatures(): boolean {
    if (!this._props) {
      return false;
    }

    return this._hasStatefulColors() || 
           this._hasButtonConfig() ||
           this._hasVisibilityTriggers() ||
           this._hasAnimations();
  }

  /**
   * Get the current state context for external use
   */
  getStateContext() {
    return {
      isCurrentlyHovering: this._isHovering,
      isCurrentlyActive: this._isActive
    };
  }

  /**
   * Update properties for interactive feature detection
   */
  updateProps(props: LayoutElementProps): void {
    this._props = props;
  }

  private _handleMouseEnter(): void {
    this.isHovering = true;
  }

  private _handleMouseLeave(): void {
    this.isHovering = false;
    this.isActive = false;
  }

  private _handleMouseDown(): void {
    this.isActive = true;
  }

  private _handleMouseUp(): void {
    this.isActive = false;
  }

  private _handleTouchStart(): void {
    this.isHovering = true;
    this.isActive = true;
  }

  private _handleTouchEnd(): void {
    this.isHovering = false;
    this.isActive = false;
  }

  private _cleanupInteractiveListeners(): void {
    const element = this.getShadowElement?.(this.id);
    if (!element) return;

    element.removeEventListener('mouseenter', this._boundHandleMouseEnter);
    element.removeEventListener('mouseleave', this._boundHandleMouseLeave);
    element.removeEventListener('mousedown', this._boundHandleMouseDown);
    element.removeEventListener('mouseup', this._boundHandleMouseUp);
    element.removeEventListener('touchstart', this._boundHandleTouchStart);
    element.removeEventListener('touchend', this._boundHandleTouchEnd);
  }

  /**
   * Check if this element has stateful colors (supports hover/active states)
   */
  private _hasStatefulColors(): boolean {
    if (!this._props) return false;
    
    const { fill, stroke, textColor } = this._props;
    return this._isStatefulColor(fill) || 
           this._isStatefulColor(stroke) || 
           this._isStatefulColor(textColor);
  }

  private _isStatefulColor(color: any): boolean {
    return Boolean(color && typeof color === 'object' && 
                  ('default' in color || 'hover' in color || 'active' in color) &&
                  !('entity' in color) && !('mapping' in color));
  }

  private _hasButtonConfig(): boolean {
    return Boolean(this._props?.button?.enabled);
  }

  private _hasVisibilityTriggers(): boolean {
    // Check if element has visibility triggers that would benefit from hover states
    return Boolean(this._props?.button?.actions?.tap?.some((action: Action) => 
      action.action === 'set_state' || action.action === 'toggle_state'
    ));
  }

  private _hasAnimations(): boolean {
    return Boolean(this._props?.animations);
  }

  /**
   * Cleanup method to remove listeners and clear timeouts
   */
  cleanup(): void {
    this._cleanupInteractiveListeners();
    
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
      this._hoverTimeout = undefined;
    }
    
    if (this._activeTimeout) {
      clearTimeout(this._activeTimeout);
      this._activeTimeout = undefined;
    }
  }
} 