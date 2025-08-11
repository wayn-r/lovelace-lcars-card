import { ColorValue, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { ColorResolver } from './color-resolver';

export class Color {
  private readonly _value: ColorValue;
  private readonly _fallback: string;
  
  constructor(value: ColorValue, fallback: string = 'transparent') {
    this._value = value;
    this._fallback = fallback;
  }

  static from(value: ColorValue, fallback?: string): Color {
    return new Color(value, fallback || 'transparent');
  }

  static withFallback(value: ColorValue, fallback: string): Color {
    return new Color(value, fallback);
  }

  static fromValue(value: ColorValue | undefined, fallback: string = 'transparent'): Color {
    if (value === undefined || value === null) {
      return new Color(fallback, fallback);
    }
    return new Color(value, fallback);
  }

  get value(): ColorValue {
    return this._value;
  }

  get fallback(): string {
    return this._fallback;
  }

  get hasInteractiveStates(): boolean {
    return isStatefulColorConfig(this._value);
  }

  get isDynamic(): boolean {
    return isDynamicColorConfig(this._value);
  }

  get isStatic(): boolean {
    return !this.isDynamic && !this.hasInteractiveStates;
  }

  toStaticString(element: Element): string {
    return String(
      ColorResolver
        .resolve(this._value)
        .withFallback(this._fallback)
        .withDom(element)
    );
  }

  withFallback(newFallback: string): Color {
    return new Color(this._value, newFallback);
  }

  toString(): string {
    return String(
      ColorResolver
        .resolve(this._value)
        .withFallback(this._fallback)
    );
  }

} 