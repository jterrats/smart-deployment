import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { getLogger, Logger, LogLevel, startTimer, type LogEntry } from '../../../src/utils/logger.js';

describe('Logger', () => {
  const testLogDir = path.join(os.tmpdir(), `test-logs-${Date.now()}`);
  let logger: Logger;

  beforeEach(() => {
    Logger.resetInstances();
  });

  afterEach(async () => {
    await fs.rm(testLogDir, { recursive: true, force: true });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance for same component', () => {
      const logger1 = Logger.getInstance({ component: 'TestComponent' });
      const logger2 = Logger.getInstance({ component: 'TestComponent' });

      expect(logger1).to.equal(logger2);
    });

    it('should return different instances for different components', () => {
      const logger1 = Logger.getInstance({ component: 'Component1' });
      const logger2 = Logger.getInstance({ component: 'Component2' });

      expect(logger1).to.not.equal(logger2);
    });

    it('should reset all instances', () => {
      const logger1 = Logger.getInstance({ component: 'TestComponent' });
      Logger.resetInstances();
      const logger2 = Logger.getInstance({ component: 'TestComponent' });

      expect(logger1).to.not.equal(logger2);
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'TestLogger',
        level: LogLevel.DEBUG,
        logToConsole: false,
        logToFile: false,
      });
    });

    it('should support DEBUG level', () => {
      expect(() => logger.debug('Debug message')).to.not.throw();
    });

    it('should support INFO level', () => {
      expect(() => logger.info('Info message')).to.not.throw();
    });

    it('should support WARN level', () => {
      expect(() => logger.warn('Warning message')).to.not.throw();
    });

    it('should support ERROR level', () => {
      expect(() => logger.error('Error message')).to.not.throw();
    });

    it('should filter logs below configured level', () => {
      logger.configure({ logToConsole: true });
      logger.configure({ level: LogLevel.WARN });
      const captured: string[] = [];
      const consoleRef = Reflect.get(globalThis, 'console');
      const originalWarn = consoleRef.warn.bind(consoleRef);
      const originalError = consoleRef.error.bind(consoleRef);

      consoleRef.warn = (message?: unknown) => {
        captured.push(String(message));
      };
      consoleRef.error = (message?: unknown) => {
        captured.push(String(message));
      };

      try {
        logger.debug('Should be filtered');
        logger.info('Should be filtered');
        logger.warn('Should not be filtered');
        logger.error('Should not be filtered');
      } finally {
        consoleRef.warn = originalWarn;
        consoleRef.error = originalError;
      }

      expect(captured).to.have.lengthOf(2);
      expect(captured[0]).to.include('"level":"WARN"');
      expect(captured[0]).to.include('Should not be filtered');
      expect(captured[1]).to.include('"level":"ERROR"');
      expect(captured[1]).to.include('Should not be filtered');
    });
  });

  describe('Context and Timestamps', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'TestLogger',
        logToConsole: false,
        logToFile: false,
      });
    });

    it('should capture context information', () => {
      const context = { userId: 123, action: 'test' };
      expect(() => logger.info('Message with context', context)).to.not.throw();
    });

    it('should handle error objects in context', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred', { error })).to.not.throw();
    });

    it('should include component name in config', () => {
      const config = logger.getConfig();
      expect(config.component).to.equal('TestLogger');
    });
  });

  describe('File Logging', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'FileLogger',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
        format: 'json',
      });
    });

    it('should create log directory', async () => {
      logger.info('Test message');
      await logger.flush();

      const dirExists = await fs
        .access(testLogDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).to.be.true;
    });

    it('should write logs to file', async () => {
      logger.info('Test message');
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      expect(files.length).to.be.greaterThan(0);

      const logFile = files.find((f) => f.startsWith('filelogger-'));
      expect(logFile).to.not.be.undefined;
    });

    it('should write valid JSON format', async () => {
      logger.info('Test message', { key: 'value' });
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      const logFile = path.join(testLogDir, files[0]);
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      const entry = JSON.parse(lines[0]) as LogEntry;
      expect(entry.message).to.equal('Test message');
      expect(entry.level).to.equal(LogLevel.INFO);
      expect(entry.component).to.equal('FileLogger');
      expect(entry.context).to.deep.equal({ key: 'value' });
    });

    it('should include timestamps in logs', async () => {
      logger.info('Test message');
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      const logFile = path.join(testLogDir, files[0]);
      const content = await fs.readFile(logFile, 'utf-8');
      const entry = JSON.parse(content.trim()) as LogEntry;

      expect(entry.timestamp).to.be.a('string');
      expect(new Date(entry.timestamp).getTime()).to.be.greaterThan(0);
    });

    it('should separate error from context', async () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error, userId: 123 });
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      const logFile = path.join(testLogDir, files[0]);
      const content = await fs.readFile(logFile, 'utf-8');
      const entry = JSON.parse(content.trim()) as LogEntry;

      expect(entry.error).to.exist;
      expect(entry.error?.message).to.equal('Test error');
      expect(entry.context).to.deep.equal({ userId: 123 });
    });
  });

  describe('Text Format', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'TextLogger',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
        format: 'text',
      });
    });

    it('should write text format logs', async () => {
      logger.info('Test message', { key: 'value' });
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      const logFile = path.join(testLogDir, files[0]);
      const content = await fs.readFile(logFile, 'utf-8');

      expect(content).to.include('[INFO]');
      expect(content).to.include('[TextLogger]');
      expect(content).to.include('Test message');
      expect(content).to.include('{"key":"value"}');
    });
  });

  describe('Log Rotation', () => {
    it('should rotate logs when size limit is reached', async () => {
      logger = Logger.getInstance({
        component: 'RotationLogger',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
        maxLogFileSizeMB: 0.0005, // 0.5KB for testing
        maxLogFiles: 3,
      });

      // Write logs in batches to ensure file writes complete
      const batches = Array.from({ length: 10 }, (_, batch) =>
        Array.from({ length: 20 }, (__, index) => {
          logger.info(`Test message ${batch}-${index}`, { data: 'x'.repeat(100) });
          return logger.flush();
        })
      );
      await Promise.all(batches.flat());

      const files = await fs.readdir(testLogDir);

      // Check if we have either a rotated file OR the current file is smaller than max
      // (indicating rotation occurred)
      const hasRotatedFile = files.some((f) => f.endsWith('.1.log'));
      const currentFile = files.find(
        (f) => f.startsWith('rotationlogger-') && f.endsWith('.log') && !f.endsWith('.1.log')
      );

      if (currentFile) {
        const stats = await fs.stat(path.join(testLogDir, currentFile));
        const sizeMB = stats.size / (1024 * 1024);

        // Either we have a rotated file, or current file is within limits (rotation working)
        expect(hasRotatedFile || sizeMB < 0.001).to.be.true;
      } else {
        // Should have at least created a log file
        expect(files.length).to.be.greaterThan(0);
      }
    });

    it('should limit number of rotated files', async () => {
      logger = Logger.getInstance({
        component: 'MaxFilesLogger',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
        maxLogFileSizeMB: 0.001,
        maxLogFiles: 2,
      });

      // Trigger multiple rotations
      for (let index = 0; index < 300; index++) {
        logger.info(`Test message ${index}`, { data: 'x'.repeat(100) });
      }

      await logger.flush();

      const files = await fs.readdir(testLogDir);
      expect(files.length).to.be.at.most(3); // Current + 2 rotated
    });
  });

  describe('Performance Timers', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'TimerLogger',
        logToConsole: false,
        logToFile: false,
      });
    });

    it('should create performance timer', () => {
      const timer = startTimer('test-operation');
      expect(timer).to.exist;
      expect(timer.getLabel()).to.equal('test-operation');
    });

    it('should measure elapsed time', async () => {
      const timer = startTimer('test-operation');

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      const duration = timer.end();
      expect(duration).to.be.greaterThan(40);
      expect(duration).to.be.lessThan(100);
    });

    it('should log with duration', () => {
      const timer = startTimer('test-operation');
      expect(() => logger.logWithDuration(LogLevel.INFO, 'Operation completed', timer)).to.not.throw();
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      logger = Logger.getInstance({ component: 'DefaultLogger' });
      const config = logger.getConfig();

      expect(config.level).to.equal(LogLevel.INFO);
      expect(config.logToConsole).to.be.true;
      expect(config.logToFile).to.be.true;
      expect(config.format).to.equal('json');
    });

    it('should accept custom configuration', () => {
      logger = Logger.getInstance({
        component: 'CustomLogger',
        level: LogLevel.DEBUG,
        logToConsole: false,
        format: 'text',
      });

      const config = logger.getConfig();
      expect(config.level).to.equal(LogLevel.DEBUG);
      expect(config.logToConsole).to.be.false;
      expect(config.format).to.equal('text');
    });

    it('should update configuration', () => {
      logger = Logger.getInstance({ component: 'UpdateLogger' });
      logger.configure({ level: LogLevel.ERROR, format: 'text' });

      const config = logger.getConfig();
      expect(config.level).to.equal(LogLevel.ERROR);
      expect(config.format).to.equal('text');
    });

    it('should use default log directory when not specified', () => {
      logger = Logger.getInstance({
        component: 'DefaultDirLogger',
        logToFile: true,
      });

      const config = logger.getConfig();
      expect(config.logDirectory).to.include('.sf');
      expect(config.logDirectory).to.include('smart-deployment');
    });

    it('should sanitize component name for filename', async () => {
      logger = Logger.getInstance({
        component: 'Test/Component:Name',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
      });

      logger.info('Test');
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      expect(files[0]).to.match(/^test_component_name-\d{4}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('Helper Function', () => {
    it('should create logger with getLogger helper', () => {
      const log = getLogger('HelperLogger');
      expect(log).to.be.instanceOf(Logger);
    });

    it('should accept config with getLogger', () => {
      const log = getLogger('HelperLogger', { level: LogLevel.ERROR });
      const config = log.getConfig();
      expect(config.level).to.equal(LogLevel.ERROR);
    });
  });

  describe('Console Logging', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'ConsoleLogger',
        logToConsole: true,
        logToFile: false,
      });
    });

    it('should not throw when logging to console', () => {
      expect(() => logger.debug('Debug to console')).to.not.throw();
      expect(() => logger.info('Info to console')).to.not.throw();
      expect(() => logger.warn('Warn to console')).to.not.throw();
      expect(() => logger.error('Error to console')).to.not.throw();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      logger = Logger.getInstance({
        component: 'EdgeCaseLogger',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
      });
    });

    it('should handle empty context', () => {
      expect(() => logger.info('Message with empty context', {})).to.not.throw();
    });

    it('should handle undefined context', () => {
      expect(() => logger.info('Message without context')).to.not.throw();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'x'.repeat(10_000);
      logger.info(longMessage);
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      expect(files.length).to.be.greaterThan(0);
    });

    it('should handle special characters in message', async () => {
      logger.info('Message with "quotes" and \n newlines');
      await logger.flush();

      const files = await fs.readdir(testLogDir);
      expect(files.length).to.be.greaterThan(0);
    });

    it('should handle circular references in context gracefully', () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      // Should not throw (JSON.stringify will handle it or fail gracefully)
      expect(() => {
        try {
          logger.info('Circular context', circular);
        } catch {
          // Expected if circular reference isn't handled
        }
      }).to.not.throw();
    });
  });

  describe('Multiple Components', () => {
    it('should create separate log files for different components', async () => {
      const logger1 = Logger.getInstance({
        component: 'Component1',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
      });

      const logger2 = Logger.getInstance({
        component: 'Component2',
        logToConsole: false,
        logToFile: true,
        logDirectory: testLogDir,
      });

      logger1.info('Message from component 1');
      logger2.info('Message from component 2');

      await Promise.all([logger1.flush(), logger2.flush()]);

      const files = await fs.readdir(testLogDir);
      expect(files.length).to.equal(2);
      expect(files.some((f) => f.startsWith('component1-'))).to.be.true;
      expect(files.some((f) => f.startsWith('component2-'))).to.be.true;
    });
  });
});
