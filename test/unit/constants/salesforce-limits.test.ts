import { expect } from 'chai';
import { SALESFORCE_LIMITS } from '../../../src/constants/salesforce-limits.js';

describe('SALESFORCE_LIMITS', () => {
  /**
   * @ac US-004-AC-1: MAX_COMPONENTS_PER_WAVE = 300
   */
  it('should have MAX_COMPONENTS_PER_WAVE set to 300', () => {
    expect(SALESFORCE_LIMITS.MAX_COMPONENTS_PER_WAVE).to.equal(300);
  });

  /**
   * @ac US-004-AC-2: MAX_CMT_RECORDS_PER_WAVE = 200
   */
  it('should have MAX_CMT_RECORDS_PER_WAVE set to 200', () => {
    expect(SALESFORCE_LIMITS.MAX_CMT_RECORDS_PER_WAVE).to.equal(200);
  });

  /**
   * @ac US-004-AC-3: MAX_FILES_PER_DEPLOYMENT = 500
   */
  it('should have MAX_FILES_PER_DEPLOYMENT set to 500', () => {
    expect(SALESFORCE_LIMITS.MAX_FILES_PER_DEPLOYMENT).to.equal(500);
  });

  /**
   * @ac US-004-AC-4: API_TIMEOUT_MS = 600000 (10 minutes)
   */
  it('should have API_TIMEOUT_MS set to 600000', () => {
    expect(SALESFORCE_LIMITS.API_TIMEOUT_MS).to.equal(600_000);
  });

  /**
   * @ac US-004-AC-5: Constants are documented with reasons
   * @ac US-004-AC-6: Constants are not user-configurable
   */
  it('should be an immutable object with proper structure', () => {
    // Verify it's an object
    expect(SALESFORCE_LIMITS).to.be.an('object');

    // Verify it's frozen (immutable)
    expect(Object.isFrozen(SALESFORCE_LIMITS)).to.equal(true);

    // Verify all properties exist
    expect(SALESFORCE_LIMITS).to.have.property('MAX_COMPONENTS_PER_WAVE');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_CMT_RECORDS_PER_WAVE');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_FILES_PER_DEPLOYMENT');
    expect(SALESFORCE_LIMITS).to.have.property('API_TIMEOUT_MS');

    // Verify all values are positive numbers
    expect(SALESFORCE_LIMITS.MAX_COMPONENTS_PER_WAVE).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_CMT_RECORDS_PER_WAVE).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_FILES_PER_DEPLOYMENT).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.API_TIMEOUT_MS).to.be.greaterThan(0);
  });
});
