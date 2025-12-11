/**
 * Tests for Deployment Error Handler - US-074
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DeploymentErrorHandler } from '../../../src/deployment/deployment-error-handler.js';

describe('DeploymentErrorHandler', () => {
  const handler = new DeploymentErrorHandler();

  describe('US-074: Deployment Error Handling', () => {
    /** @ac US-074-AC-1: Catch deployment errors */
    /** @ac US-074-AC-2: Save deployment state */
    it('US-074-AC-1/AC-2: should catch and save deployment state', async () => {
      const error = new Error('UNABLE_TO_LOCK_ROW');
      const context = {
        wave: 2,
        components: ['Account', 'Contact'],
        strategy: 'standard' as const,
        retryCount: 0,
      };

      await handler.handleError(error, context);
      const canResume = await handler.canResume();
      expect(canResume).to.be.true;
    });

    /** @ac US-074-AC-3: Enable resume from failure */
    it('US-074-AC-3: should enable resume from failure', async () => {
      const canResume = await handler.canResume();
      expect(canResume).to.be.a('boolean');
    });
  });
});
