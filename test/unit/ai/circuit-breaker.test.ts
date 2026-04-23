/**
 * Tests for Circuit Breaker - US-060
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { CircuitBreaker } from '../../../src/ai/circuit-breaker.js';

async function tripBreaker(breaker: CircuitBreaker, attempts: number): Promise<void> {
  const failingFn = async () => {
    throw new Error('Test failure');
  };

  if (attempts <= 0) {
    return;
  }

  try {
    await breaker.execute(failingFn);
  } catch {
    // Expected in tests
  }

  await tripBreaker(breaker, attempts - 1);
}

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100, // Short timeout for testing
      monitoringWindow: 1000,
    });
  });

  describe('US-060: AI Circuit Breaker', () => {
    /** @ac US-060-AC-1: Track failure rate */
    it('US-060-AC-1: should track failure rate', async () => {
      await tripBreaker(breaker, 3);

      const stats = breaker.getStats();
      expect(stats.failures).to.equal(3);
      expect(stats.consecutiveFailures).to.equal(3);
    });

    /** @ac US-060-AC-2: Open circuit after N failures */
    it('US-060-AC-2: should open circuit after N failures', async () => {
      expect(breaker.getState()).to.equal('closed');
      await tripBreaker(breaker, 3);

      expect(breaker.getState()).to.equal('open');
      expect(breaker.isOpen()).to.be.true;
    });

    /** @ac US-060-AC-3: Automatic fallback to static analysis */
    it('US-060-AC-3: should use fallback when circuit open', async () => {
      const failingFn = async () => {
        throw new Error('Test failure');
      };

      const fallback = () => 'fallback-result';

      await tripBreaker(breaker, 3);

      expect(breaker.isOpen()).to.be.true;

      // Should use fallback
      const result = await breaker.execute(failingFn, fallback);
      expect(result).to.equal('fallback-result');
    });

    /** @ac US-060-AC-4: Reset after timeout */
    it('US-060-AC-4: should reset to half-open after timeout', async function () {
      this.timeout(500); // Increase mocha timeout
      await tripBreaker(breaker, 3);

      expect(breaker.getState()).to.equal('open');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should transition to half-open
      expect(breaker.getState()).to.equal('half-open');
    });

    /** @ac US-060-AC-5: Monitor circuit state */
    it('US-060-AC-5: should provide monitoring stats', async () => {
      const successFn = async () => 'success';

      await breaker.execute(successFn);

      const stats = breaker.getStats();
      expect(stats).to.have.property('state');
      expect(stats).to.have.property('failures');
      expect(stats).to.have.property('successes');
      expect(stats).to.have.property('tripCount');
      expect(stats.successes).to.equal(1);
    });

    /** @ac US-060-AC-6: Alert on circuit open */
    it('US-060-AC-6: should alert when circuit opens', async () => {
      const initialTripCount = breaker.getStats().tripCount;
      await tripBreaker(breaker, 3);

      const stats = breaker.getStats();
      expect(stats.tripCount).to.be.greaterThan(initialTripCount);
    });
  });

  describe('Half-Open State', () => {
    it('should close circuit after successful tests in half-open', async function () {
      this.timeout(500);
      const successFn = async () => 'success';
      await tripBreaker(breaker, 3);

      expect(breaker.getState()).to.equal('open');

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(breaker.getState()).to.equal('half-open');

      // Execute successful calls
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      // Should close
      expect(breaker.getState()).to.equal('closed');
    });
  });

  describe('Failure Rate Calculation', () => {
    it('should calculate failure rate correctly', async () => {
      const successFn = async () => 'success';
      const failingFn = async () => {
        throw new Error('Test failure');
      };

      await breaker.execute(successFn);
      await breaker.execute(successFn);

      try {
        await breaker.execute(failingFn);
      } catch {
        // Expected
      }

      const failureRate = breaker.getFailureRate();
      expect(failureRate).to.be.closeTo(0.33, 0.01); // 1 failure out of 3 total
    });
  });

  describe('Manual Reset', () => {
    it('should allow manual reset', async () => {
      await tripBreaker(breaker, 3);

      expect(breaker.isOpen()).to.be.true;

      breaker.reset();

      expect(breaker.getState()).to.equal('closed');
      expect(breaker.getStats().failures).to.equal(0);
    });
  });

  describe('Report Formatting', () => {
    it('should format monitoring report', async () => {
      const successFn = async () => 'success';
      await breaker.execute(successFn);

      const report = breaker.formatReport();

      expect(report).to.be.a('string');
      expect(report).to.include('Circuit Breaker Status');
      expect(report).to.include('State:');
      expect(report).to.include('Failure Rate:');
    });
  });
});
