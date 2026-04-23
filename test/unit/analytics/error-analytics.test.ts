/**
 * Tests for Error Analytics - US-078
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ErrorAnalytics } from '../../../src/analytics/error-analytics.js';

describe('ErrorAnalytics', () => {
  const analytics = new ErrorAnalytics();

  describe('US-078: Error Analytics', () => {
    /** @ac US-078-AC-1: Track error metrics */
    it('US-078-AC-1: should track error metrics', () => {
      analytics.recordError('PARSE_ERROR', 'parsing');
      analytics.recordError('PARSE_ERROR', 'parsing');

      const report = analytics.generateReport();
      expect(report.totalErrors).to.be.greaterThan(0);
    });

    /** @ac US-078-AC-2: Error frequency analysis */
    it('US-078-AC-2: should analyze error frequency', () => {
      analytics.recordError('TEST_ERROR', 'test');

      const frequency = analytics.getFrequency('TEST_ERROR');
      expect(frequency).to.be.greaterThan(0);
    });

    /** @ac US-078-AC-3: Error trending */
    it('US-078-AC-3: should analyze error trends', () => {
      analytics.recordError('TREND_ERROR', 'test');

      const trends = analytics.analyzeTrends();
      expect(trends).to.be.an('array');
    });

    /** @ac US-078-AC-4: Identify top errors */
    it('US-078-AC-4: should identify top errors', () => {
      const topErrors = analytics.getTopErrors(5);
      expect(topErrors).to.be.an('array');
    });

    /** @ac US-078-AC-5: Export metrics */
    it('US-078-AC-5: should export metrics', () => {
      const json = analytics.exportJSON();
      expect(json).to.be.a('string');
      const parsed = JSON.parse(json) as { totalErrors: number };
      expect(parsed).to.have.property('totalErrors');
    });

    /** @ac US-078-AC-6: Dashboard/visualization */
    it('US-078-AC-6: should format dashboard', () => {
      const report = analytics.generateReport();
      const dashboard = analytics.formatDashboard(report);

      expect(dashboard).to.include('Error Analytics Dashboard');
      expect(dashboard).to.include('Total Errors');
    });
  });
});
