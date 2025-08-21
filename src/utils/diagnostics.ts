export enum LogLevel {
  Off = 0,
  Error = 1,
  Warn = 2,
  Info = 3,
  Debug = 4,
}

export interface LogSink {
  debug(scope: string, message: string, ...details: unknown[]): void;
  info(scope: string, message: string, ...details: unknown[]): void;
  warn(scope: string, message: string, ...details: unknown[]): void;
  error(scope: string, message: string, ...details: unknown[]): void;
}

class ConsoleLogSink implements LogSink {
  debug(scope: string, message: string, ...details: unknown[]): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[${scope}] ${message}`, ...details);
    }
  }
  info(scope: string, message: string, ...details: unknown[]): void {
    if (typeof console !== 'undefined' && console.info) {
      console.info(`[${scope}] ${message}`, ...details);
    }
  }
  warn(scope: string, message: string, ...details: unknown[]): void {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[${scope}] ${message}`, ...details);
    }
  }
  error(scope: string, message: string, ...details: unknown[]): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[${scope}] ${message}`, ...details);
    }
  }
}

export class Diagnostics {
  private static globalLevel: LogLevel = LogLevel.Info;
  private static sink: LogSink = new ConsoleLogSink();

  static setGlobalLevel(level: LogLevel): void {
    this.globalLevel = level;
  }

  static setSink(sink: LogSink): void {
    this.sink = sink;
  }

  static create(scope: string, minLevel?: LogLevel): ScopedLogger {
    return new ScopedLogger(scope, minLevel ?? this.globalLevel);
  }

  static getSink(): LogSink {
    return this.sink;
  }

  static getLevel(): LogLevel {
    return this.globalLevel;
  }
}

export class ScopedLogger {
  private readonly scope: string;
  private minLevel: LogLevel;

  constructor(scope: string, minLevel: LogLevel) {
    this.scope = scope;
    this.minLevel = minLevel;
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  withScope(child: string): ScopedLogger {
    return new ScopedLogger(`${this.scope}:${child}`, this.minLevel);
  }

  debug(message: string, ...details: unknown[]): void {
    if (this._shouldLog(LogLevel.Debug)) {
      Diagnostics.getSink().debug(this.scope, message, ...details);
    }
  }

  info(message: string, ...details: unknown[]): void {
    if (this._shouldLog(LogLevel.Info)) {
      Diagnostics.getSink().info(this.scope, message, ...details);
    }
  }

  warn(message: string, ...details: unknown[]): void {
    if (this._shouldLog(LogLevel.Warn)) {
      Diagnostics.getSink().warn(this.scope, message, ...details);
    }
  }

  error(message: string, ...details: unknown[]): void {
    if (this._shouldLog(LogLevel.Error)) {
      Diagnostics.getSink().error(this.scope, message, ...details);
    }
  }

  private _shouldLog(level: LogLevel): boolean {
    const effectiveLevel = Math.max(Diagnostics.getLevel(), this.minLevel);
    return level <= effectiveLevel && effectiveLevel !== LogLevel.Off;
  }
}


