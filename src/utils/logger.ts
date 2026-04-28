import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Numeric values for log level comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Log entry structure
 */
export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: Record<string, unknown>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

/**
 * Logger configuration
 */
export type LoggerConfig = {
  /** Component name for context */
  component: string;
  /** Minimum log level to record */
  level: LogLevel;
  /** Enable console output */
  logToConsole: boolean;
  /** Enable file output */
  logToFile: boolean;
  /** Directory for log files */
  logDirectory?: string;
  /** Format: 'json' or 'text' */
  format: 'json' | 'text';
  /** Max log file size in MB before rotation */
  maxLogFileSizeMB: number;
  /** Max number of rotated log files to keep */
  maxLogFiles: number;
};

type LoggerErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

type NormalizedLogContext = {
  context?: Record<string, unknown>;
  error?: LoggerErrorDetails;
};

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: Omit<LoggerConfig, 'component'> = {
  level: LogLevel.INFO,
  logToConsole: true,
  logToFile: true,
  format: 'json',
  maxLogFileSizeMB: 10,
  maxLogFiles: 5,
};

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  public constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  public end(): number {
    return Date.now() - this.startTime;
  }

  public getLabel(): string {
    return this.label;
  }
}

/**
 * Singleton Logger with file rotation and structured logging
 *
 * @example
 * ```typescript
 * const logger = Logger.getInstance({ component: 'MyComponent' });
 * logger.info('Operation started', { userId: 123 });
 * logger.error('Operation failed', { error, userId: 123 });
 *
 * const timer = logger.startTimer('expensive-operation');
 * // ... do work ...
 * logger.info('Operation completed', { duration: timer.end() });
 * ```
 */
export class Logger {
  private static instances: Map<string, Logger> = new Map();

  private config: LoggerConfig;
  private logFilePath?: string;
  private writeQueue: Promise<void> = Promise.resolve();

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(config: Partial<LoggerConfig> & { component: string }) {
    this.config = this.createConfig(config);
    this.logFilePath = this.resolveLogFilePath(this.config);
  }

  /**
   * Get logger instance for component (one instance per component)
   */
  public static getInstance(config: Partial<LoggerConfig> & { component: string }): Logger {
    const { component } = config;

    if (!Logger.instances.has(component)) {
      Logger.instances.set(component, new Logger(config));
    }

    return Logger.instances.get(component)!;
  }

  /**
   * Reset all instances (for testing)
   */
  public static resetInstances(): void {
    Logger.instances.clear();
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log with timer duration
   */
  public logWithDuration(
    level: LogLevel,
    message: string,
    timer: PerformanceTimer,
    context?: Record<string, unknown>
  ): void {
    this.log(level, message, {
      ...context,
      duration: timer.end(),
      operation: timer.getLabel(),
    });
  }

  /**
   * Update logger configuration
   */
  public configure(config: Partial<Omit<LoggerConfig, 'component'>>): void {
    this.config = { ...this.config, ...config };
    this.logFilePath = this.resolveLogFilePath(this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Flush any pending writes (useful for testing)
   */
  public async flush(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.level]) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);

    if (this.config.logToConsole) {
      this.logToConsoleOutput(entry);
    }

    if (this.config.logToFile && this.logFilePath) {
      void this.logToFileAsync(entry);
    }
  }

  private createConfig(config: Partial<LoggerConfig> & { component: string }): LoggerConfig {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    if (mergedConfig.logToFile && !mergedConfig.logDirectory) {
      mergedConfig.logDirectory = path.join(os.homedir(), '.sf', 'smart-deployment', 'logs');
    }

    return mergedConfig;
  }

  private resolveLogFilePath(config: LoggerConfig): string | undefined {
    if (!config.logToFile || !config.logDirectory) {
      return undefined;
    }

    const sanitizedComponent = config.component.replaceAll(/[^\w-]/g, '_').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    return path.join(config.logDirectory, `${sanitizedComponent}-${date}.log`);
  }

  private createLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    const normalizedContext = this.normalizeLogContext(context);

    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.config.component,
      message,
      context: normalizedContext.context,
      error: normalizedContext.error,
    };
  }

  private normalizeLogContext(context?: Record<string, unknown>): NormalizedLogContext {
    if (!context) {
      return {};
    }

    if (!(context.error instanceof Error)) {
      return { context };
    }

    const { error, ...restContext } = context;
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: Object.keys(restContext).length > 0 ? restContext : undefined,
    };
  }

  /**
   * Log to console with color coding
   */
  private logToConsoleOutput(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);

    switch (entry.level) {
      case LogLevel.ERROR: {
        // eslint-disable-next-line no-console
        console.error(formatted);
        break;
      }
      case LogLevel.WARN: {
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      }
      default: {
        // eslint-disable-next-line no-console
        console.log(formatted);
      }
    }
  }

  /**
   * Log to file asynchronously (queued to prevent race conditions)
   */
  private async logToFileAsync(entry: LogEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.writeLogEntry(entry);
      } catch {
        // Silently ignore file write errors (don't block application)
      }
    });

    await this.writeQueue;
  }

  private async writeLogEntry(entry: LogEntry): Promise<void> {
    if (!this.logFilePath) {
      return;
    }

    await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
    await this.rotateIfNeeded();
    await fs.appendFile(this.logFilePath, `${this.formatEntry(entry)}\n`, 'utf-8');
  }

  /**
   * Check file size and rotate if needed
   */
  private async rotateIfNeeded(): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const stats = await fs.stat(this.logFilePath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB >= this.config.maxLogFileSizeMB) {
        await this.rotateLogFile();
      }
    } catch {
      // File doesn't exist yet - no rotation needed
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const dir = path.dirname(this.logFilePath);
      const baseFileName = path.basename(this.logFilePath, '.log');
      const rotatedFiles = await this.findRotatedFiles(dir, baseFileName);

      await this.deleteOverflowRotations(dir, rotatedFiles);
      await this.bumpRotationIndexes(dir, baseFileName, rotatedFiles);
      await fs.rename(this.logFilePath, `${this.logFilePath.replace(/\.log$/, '')}.1.log`);
    } catch {
      // Rotation failed - continue with current file
    }
  }

  private async findRotatedFiles(dir: string, baseFileName: string): Promise<Array<{ file: string; index: number }>> {
    const files = await fs.readdir(dir);

    return files
      .filter((file) => file.startsWith(`${baseFileName}.`) && file.endsWith('.log'))
      .map((file) => {
        const match = /\.(\d+)\.log$/.exec(file);
        return {
          file,
          index: match ? Number.parseInt(match[1], 10) : 0,
        };
      })
      .sort((a, b) => b.index - a.index);
  }

  private async deleteOverflowRotations(
    dir: string,
    rotatedFiles: Array<{ file: string; index: number }>
  ): Promise<void> {
    const filesToDelete = rotatedFiles.slice(this.config.maxLogFiles - 1);
    await Promise.all(filesToDelete.map((file) => fs.unlink(path.join(dir, file.file))));
  }

  private async bumpRotationIndexes(
    dir: string,
    baseFileName: string,
    rotatedFiles: Array<{ file: string; index: number }>
  ): Promise<void> {
    await Promise.all(
      rotatedFiles.slice(0, this.config.maxLogFiles - 1).map(({ file, index }) => {
        const oldPath = path.join(dir, file);
        const newPath = path.join(dir, `${baseFileName}.${index + 1}.log`);
        return fs.rename(oldPath, newPath);
      })
    );
  }

  /**
   * Format log entry based on configured format
   */
  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const parts: string[] = [`[${entry.timestamp}]`, `[${entry.level}]`, `[${entry.component}]`, entry.message];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n${entry.error.stack}`);
      }
    }

    return parts.join(' ');
  }
}

/**
 * Get or create logger instance
 */
export function getLogger(component: string, config?: Partial<Omit<LoggerConfig, 'component'>>): Logger {
  return Logger.getInstance({ component, ...config });
}

/**
 * Create a performance timer for measuring operation duration
 */
export function startTimer(label: string): PerformanceTimer {
  return new PerformanceTimer(label);
}
