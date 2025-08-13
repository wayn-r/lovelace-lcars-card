import { HomeAssistant } from 'custom-card-helpers';
import type { SliderEntityConfig } from '../layout/elements/vertical-slider.js';
import { EntityValueResolver } from './entity-value-resolver.js';

interface NumericControlStrategy {
  setTarget(hass: HomeAssistant, cfg: SliderEntityConfig, value: number): Promise<void>;
  optimisticValue?(hass: HomeAssistant | undefined, cfg: SliderEntityConfig): number | undefined;
}

class DomainSetValueStrategy implements NumericControlStrategy {
  private readonly domain: string;
  constructor(domain: string) {
    this.domain = domain;
  }
  async setTarget(hass: HomeAssistant, cfg: SliderEntityConfig, value: number): Promise<void> {
    await hass.callService(this.domain, 'set_value', { entity_id: cfg.id, value });
  }
}

class DomainAttributeSetValueStrategy implements NumericControlStrategy {
  async setTarget(hass: HomeAssistant, cfg: SliderEntityConfig, value: number): Promise<void> {
    const domain = cfg.id.split('.')[0];
    if (!cfg.attribute) return;
    await hass.callService(domain, 'set_value', { entity_id: cfg.id, [cfg.attribute]: value } as any);
  }
}

class ClimateControlStrategy implements NumericControlStrategy {
  private static instances = new Map<string, ClimateControlStrategy>();
  static forEntity(entityId: string): ClimateControlStrategy {
    const existing = this.instances.get(entityId);
    if (existing) return existing;
    const created = new ClimateControlStrategy(entityId);
    this.instances.set(entityId, created);
    return created;
  }

  private readonly entityId: string;
  private constructor(entityId: string) {
    this.entityId = entityId;
  }

  async setTarget(hass: HomeAssistant, cfg: SliderEntityConfig, value: number): Promise<void> {
    ClimateUpdateScheduler.get(this.entityId).enqueue(
      hass,
      ClimateSetTemperatureBuilder.fromConfig(this.entityId, cfg.attribute, value)
    );
  }

  optimisticValue(hass: HomeAssistant | undefined, cfg: SliderEntityConfig): number | undefined {
    if (!hass) return undefined;
    const pending = ClimateUpdateScheduler.tryGet(this.entityId)?.peekOptimistic(hass)
      || ClimateUpdateScheduler.tryGet(this.entityId)?.peekPending();
    if (!pending) return undefined;
    const attrs = (hass.states[this.entityId]?.attributes || {}) as Record<string, unknown>;
    const hvacMode = EntityControlService.getHvacMode(attrs);
    const isF = EntityValueResolver.isFahrenheit(hass);
    const attribute = (cfg.attribute || '').toLowerCase();
    if (attribute === 'target_temp_high' || attribute === 'target_temperature_high') {
      return pending.resolveHighLow(attrs, isF).high;
    }
    if (attribute === 'target_temp_low' || attribute === 'target_temperature_low') {
      return pending.resolveHighLow(attrs, isF).low;
    }
    if (!attribute || attribute === 'temperature' || attribute === 'target_temperature' || attribute === 'target_temp') {
      if (hvacMode === 'heat_cool' || hvacMode === 'auto') {
        const { high, low } = pending.resolveHighLow(attrs, isF);
        return (high + low) / 2;
      }
      if (pending.temperature !== undefined) return pending.temperature;
    }
    return undefined;
  }
}

export class EntityControlService {
  static async setNumericTarget(hass: HomeAssistant, cfg: SliderEntityConfig, value: number): Promise<void> {
    const strategy = this._strategyFor(cfg);
    await strategy.setTarget(hass, cfg, value);
  }

  static resolveOptimisticNumericValue(
    hass: HomeAssistant | undefined,
    cfg: SliderEntityConfig
  ): number | undefined {
    const strategy = this._strategyFor(cfg);
    return strategy.optimisticValue ? strategy.optimisticValue(hass, cfg) : undefined;
  }

  private static _strategyFor(cfg: SliderEntityConfig): NumericControlStrategy {
    const domain = this._domainOf(cfg.id);
    if (domain === 'climate') return ClimateControlStrategy.forEntity(cfg.id);
    if (!cfg.attribute && (domain === 'number' || domain === 'input_number')) {
      return new DomainSetValueStrategy(domain);
    }
    return new DomainAttributeSetValueStrategy();
  }

  private static _domainOf(entityId: string): string {
    return entityId.split('.')[0];
  }

  static async _commitClimateBuilder(hass: HomeAssistant, builder: ClimateSetTemperatureBuilder): Promise<void> {
    const entityId = builder.entityId;
    const attrs = (hass.states[entityId]?.attributes || {}) as Record<string, unknown>;
    const hvacMode = this.getHvacMode(attrs);
    const isF = EntityValueResolver.isFahrenheit(hass);
    const wantsRange = builder.high !== undefined || builder.low !== undefined || (builder.temperature !== undefined && (hvacMode === 'heat_cool' || hvacMode === 'auto'));
    if (wantsRange) {
      if (hvacMode !== 'heat_cool' && hvacMode !== 'auto') {
        await this._trySetHvacModeHeatCool(hass, entityId);
      }
      const { high, low } = builder.resolveHighLow(attrs, isF);
      await this._callClimateSetRange(hass, entityId, high, low);
      return;
    }
    if (builder.temperature !== undefined) {
      await hass.callService('climate', 'set_temperature', { entity_id: entityId, temperature: builder.temperature });
    }
  }

  static getHvacMode(attrs: Record<string, unknown>): string {
    const mode = (attrs.hvac_mode || (attrs as any).hvacMode || '').toString().toLowerCase();
    return mode;
  }

  private static async _trySetHvacModeHeatCool(hass: HomeAssistant, entityId: string): Promise<void> {
    try {
      await hass.callService('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: 'heat_cool' });
    } catch (_e) {
    }
  }

  private static async _callClimateSetRange(hass: HomeAssistant, entityId: string, high: number, low: number): Promise<void> {
    await hass.callService('climate', 'set_temperature', {
      entity_id: entityId,
      target_temp_high: high,
      target_temp_low: low,
    });
  }
}

class ClimateSetTemperatureBuilder {
  public readonly entityId: string;
  public temperature?: number;
  public high?: number;
  public low?: number;

  private constructor(entityId: string) {
    this.entityId = entityId;
  }

  static forEntity(entityId: string): ClimateSetTemperatureBuilder {
    return new ClimateSetTemperatureBuilder(entityId);
  }

  static fromConfig(entityId: string, attribute: string | undefined, value: number): ClimateSetTemperatureBuilder {
    const b = new ClimateSetTemperatureBuilder(entityId);
    const a = (attribute || '').toLowerCase();
    if (!attribute || a === 'temperature' || a === 'target_temperature' || a === 'target_temp') {
      b.setTemperature(value);
    } else if (a === 'target_temp_high' || a === 'target_temperature_high') {
      b.setHigh(value);
    } else if (a === 'target_temp_low' || a === 'target_temperature_low') {
      b.setLow(value);
    } else {
      b.setTemperature(value);
    }
    return b;
  }

  setTemperature(value: number): ClimateSetTemperatureBuilder {
    this.temperature = value;
    return this;
  }

  setHigh(value: number): ClimateSetTemperatureBuilder {
    this.high = value;
    return this;
  }

  setLow(value: number): ClimateSetTemperatureBuilder {
    this.low = value;
    return this;
  }

  merge(other: ClimateSetTemperatureBuilder): ClimateSetTemperatureBuilder {
    if (other.temperature !== undefined) this.temperature = other.temperature;
    if (other.high !== undefined) this.high = other.high;
    if (other.low !== undefined) this.low = other.low;
    return this;
  }

  clone(): ClimateSetTemperatureBuilder {
    const c = ClimateSetTemperatureBuilder.forEntity(this.entityId);
    if (this.temperature !== undefined) c.temperature = this.temperature;
    if (this.high !== undefined) c.high = this.high;
    if (this.low !== undefined) c.low = this.low;
    return c;
  }

  resolveHighLow(attrs: Record<string, unknown>, isF: boolean): { high: number; low: number } {
    const wantsHigh = this.high !== undefined;
    const wantsLow = this.low !== undefined;
    const baseValue = this.temperature !== undefined ? this.temperature : (wantsHigh ? (this.high as number) : (this.low as number));
    const derived = ClimateSetTemperatureBuilder._deriveRangeTargets(baseValue, wantsHigh, wantsLow, attrs, isF);
    const high = this.high !== undefined ? this.high : derived.high;
    const low = this.low !== undefined ? this.low : derived.low;
    return { high: high as number, low: low as number };
  }

  private static _deriveRangeTargets(
    value: number,
    wantsHigh: boolean,
    wantsLow: boolean,
    attrs: Record<string, unknown>,
    isF: boolean
  ): { high: number; low: number } {
    const currentHighRaw = (attrs as any).target_temp_high ?? (attrs as any).target_temperature_high;
    const currentLowRaw = (attrs as any).target_temp_low ?? (attrs as any).target_temperature_low;
    const defaultDelta = isF ? 2 : 1;
    let high = typeof currentHighRaw === 'number' && isFinite(currentHighRaw) ? (currentHighRaw as number) : undefined;
    let low = typeof currentLowRaw === 'number' && isFinite(currentLowRaw) ? (currentLowRaw as number) : undefined;
    if (wantsHigh) high = value;
    if (wantsLow) low = value;
    if (high == null && low == null) {
      high = value + defaultDelta;
      low = value - defaultDelta;
    } else if (high == null && low != null) {
      high = low + defaultDelta;
    } else if (low == null && high != null) {
      low = high - defaultDelta;
    }
    return { high: high as number, low: low as number };
  }
}

class ClimateUpdateScheduler {
  private static instances = new Map<string, ClimateUpdateScheduler>();
  static get(entityId: string): ClimateUpdateScheduler {
    let inst = this.instances.get(entityId);
    if (!inst) {
      inst = new ClimateUpdateScheduler(entityId);
      this.instances.set(entityId, inst);
    }
    return inst;
  }
  static tryGet(entityId: string): ClimateUpdateScheduler | undefined {
    return this.instances.get(entityId);
  }

  private readonly entityId: string;
  private pending: ClimateSetTemperatureBuilder | null = null;
  private inFlight = false;
  private cooldownUntil = 0;
  private cooldownMs = 5000;
  private timer: number | null = null;
  private lastHass?: HomeAssistant;
  private lastSent: ClimateSetTemperatureBuilder | null = null;
  private lastSentAt = 0;
  private penaltyUntil = 0;

  private constructor(entityId: string) {
    this.entityId = entityId;
  }

  enqueue(hass: HomeAssistant, builder: ClimateSetTemperatureBuilder): void {
    this.lastHass = hass;
    if (!this.pending) {
      this.pending = ClimateSetTemperatureBuilder.forEntity(this.entityId).merge(builder);
    } else {
      this.pending.merge(builder);
    }
    this._schedule();
  }

  peekPending(): ClimateSetTemperatureBuilder | null {
    return this.pending ? this.pending.clone() : null;
  }

  peekOptimistic(hass?: HomeAssistant): ClimateSetTemperatureBuilder | null {
    if (hass) this._maybeAcknowledgeFromHass(hass);
    let base: ClimateSetTemperatureBuilder | null = null;
    if (this.lastSent) base = this.lastSent.clone();
    if (this.pending) base = (base ?? ClimateSetTemperatureBuilder.forEntity(this.entityId)).merge(this.pending);
    return base;
  }

  private _schedule(): void {
    if (this.timer !== null) return;
    const delay = Math.max(0, Math.max(this.cooldownUntil, this.penaltyUntil) - Date.now());
    this.timer = (setTimeout(() => {
      this.timer = null;
      this._tryFlush();
    }, delay) as unknown) as number;
  }

  private async _tryFlush(): Promise<void> {
    if (this.inFlight) {
      this._schedule();
      return;
    }
    const hass = this.lastHass;
    if (!hass || !this.pending) return;
    const now = Date.now();
    if (now < this.cooldownUntil || now < this.penaltyUntil) {
      this._schedule();
      return;
    }
    const baseBuilder = this.lastSent ? this.lastSent.clone() : ClimateSetTemperatureBuilder.forEntity(this.entityId);
    const toSend = baseBuilder.merge(this.pending);
    this.inFlight = true;
    try {
      this.lastSent = toSend.clone();
      this.lastSentAt = Date.now();
      await EntityControlService._commitClimateBuilder(hass, toSend);
      this.cooldownUntil = Date.now() + this.cooldownMs;
      this.penaltyUntil = 0;
      if (this.pending.temperature === toSend.temperature) this.pending.temperature = undefined;
      if (this.pending.high === toSend.high) this.pending.high = undefined;
      if (this.pending.low === toSend.low) this.pending.low = undefined;
      if (this.pending.temperature === undefined && this.pending.high === undefined && this.pending.low === undefined) {
        this.pending = null;
      }
    } catch (err) {
      const msg = String((err && (err as any).message) || err || '');
      if (/429|Too Many Requests|RESOURCE_EXHAUSTED|rate limit/i.test(msg)) {
        this.penaltyUntil = Date.now() + 60_000;
        this.cooldownUntil = this.penaltyUntil;
      } else {
        this.cooldownUntil = Date.now() + this.cooldownMs;
      }
      // eslint-disable-next-line no-console
      console.warn(`[ClimateUpdateScheduler] Failed to update ${this.entityId}:`, err);
    } finally {
      this.inFlight = false;
      if (this.pending) this._schedule();
    }
  }

  private _maybeAcknowledgeFromHass(hass: HomeAssistant): void {
    if (!this.lastSent) return;
    const state = hass.states[this.entityId];
    if (!state) return;
    const attrs = (state.attributes || {}) as Record<string, unknown>;
    const hvacMode = EntityControlService.getHvacMode(attrs);
    const isF = EntityValueResolver.isFahrenheit(hass);
    const eps = 0.05;
    const approxEq = (a: unknown, b: number | undefined): boolean => {
      if (typeof a !== 'number' || b === undefined) return false;
      return Math.abs(a - b) <= eps;
    };
    if (hvacMode === 'heat_cool' || hvacMode === 'auto') {
      const { high, low } = this.lastSent.resolveHighLow(attrs, isF);
      const highAttr = (attrs as any).target_temp_high ?? (attrs as any).target_temperature_high;
      const lowAttr = (attrs as any).target_temp_low ?? (attrs as any).target_temperature_low;
      if (approxEq(highAttr, high) && approxEq(lowAttr, low)) {
        this.lastSent = null;
        this.lastSentAt = 0;
      }
      return;
    }
    if (this.lastSent.temperature !== undefined) {
      const t = (attrs as any).temperature ?? (attrs as any).target_temperature ?? (attrs as any).target_temp;
      if (approxEq(t, this.lastSent.temperature)) {
        this.lastSent = null;
        this.lastSentAt = 0;
      }
    }
  }
}


