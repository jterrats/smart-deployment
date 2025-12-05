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
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.logToFile && !this.config.logDirectory) {
      this.config.logDirectory = path.join(os.homedir(), '.sf', 'smart-deployment', 'logs');
    }

    if (this.config.logToFile && this.config.logDirectory) {
      const sanitizedComponent = this.config.component.replaceAll(/[^\w-]/g, '_').toLowerCase();
      const date = new Date().toISOString().split('T')[0];
      this.logFilePath = path.join(this.config.logDirectory, `${sanitizedComponent}-${date}.log`);
    }
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
    // Check if level is enabled
    if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.config.component,
      message,
    };

    // Add context if provided
    if (context) {
      // Extract error if present
      if (context.error instanceof Error) {
        entry.error = {
          name: context.error.name,
          message: context.error.message,
          stack: context.error.stack,
        };

        // Remove error from context to avoid duplication
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { error: _, ...restContext } = context;
        if (Object.keys(restContext).length > 0) {
          entry.context = restContext;
        }
      } else {
        entry.context = context;
      }
    }

    // Log to console
    if (this.config.logToConsole) {
      this.logToConsoleOutput(entry);
    }

    // Log to file (async, non-blocking)
    if (this.config.logToFile && this.logFilePath) {
      void this.logToFileAsync(entry);
    }
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
    // Queue writes to prevent concurrent file access
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.logFilePath) return;

        // Create log directory if it doesn't exist
        await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });

        // Check if rotation is needed
        await this.rotateIfNeeded();

        // Format and write log entry
        const formatted = this.formatEntry(entry);
        await fs.appendFile(this.logFilePath, `${formatted}\n`, 'utf-8');
      } catch {
        // Silently ignore file write errors (don't block application)
      }
    });

    await this.writeQueue;
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
      // Find existing rotated files
      const dir = path.dirname(this.logFilePath);
      const baseFileName = path.basename(this.logFilePath, '.log');
      const files = await fs.readdir(dir);

      const rotatedFiles = files
        .filter((file) => file.startsWith(`${baseFileName}.`) && file.endsWith('.log'))
        .map((file) => {
          const match = /\.(\d+)\.log$/.exec(file);
          return {
            file,
            index: match ? Number.parseInt(match[1], 10) : 0,
          };
        })
        .sort((a, b) => b.index - a.index);

      // Delete oldest files if we have too many
      const filesToDelete = rotatedFiles.slice(this.config.maxLogFiles - 1);
      await Promise.all(filesToDelete.map((f) => fs.unlink(path.join(dir, f.file))));

      // Rotate existing files in parallel
      await Promise.all(
        rotatedFiles.slice(0, this.config.maxLogFiles - 1).map(({ file, index }) => {
          const oldPath = path.join(dir, file);
          const newPath = path.join(dir, `${baseFileName}.${index + 1}.log`);
          return fs.rename(oldPath, newPath);
        })
      );

      // Rotate current file to .1.log
      await fs.rename(this.logFilePath, `${this.logFilePath.replace(/\.log$/, '')}.1.log`);
    } catch {
      // Rotation failed - continue with current file
    }
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
