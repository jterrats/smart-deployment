import { expect } from 'chai';
import { SALESFORCE_LIMITS } from '../../../src/constants/salesforce-limits.js';

describe('SALESFORCE_LIMITS', () => {
  /**
   * @ac US-004-AC-1: MAX_COMPONENTS_PER_WAVE = 300 (real-world limit to avoid UNKNOWN_EXCEPTION)
   */
  it('should have MAX_COMPONENTS_PER_WAVE set to 300', () => {
    expect(SALESFORCE_LIMITS.MAX_COMPONENTS_PER_WAVE).to.equal(300);
  });

  /**
   * @ac US-004-AC-2: MAX_FILES_PER_DEPLOYMENT = 500 (real-world limit)
   */
  it('should have MAX_FILES_PER_DEPLOYMENT set to 500', () => {
    expect(SALESFORCE_LIMITS.MAX_FILES_PER_DEPLOYMENT).to.equal(500);
  });

  /**
   * @ac US-004-AC-2: MAX_DEPLOYMENT_SIZE_COMPRESSED_MB = 39 (official Salesforce limit)
   */
  it('should have MAX_DEPLOYMENT_SIZE_COMPRESSED_MB set to 39', () => {
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_COMPRESSED_MB).to.equal(39);
  });

  /**
   * @ac US-004-AC-3: MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB = 600 (official Salesforce limit)
   */
  it('should have MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB set to 600', () => {
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB).to.equal(600);
  });

  /**
   * @ac US-004-AC-4: MAX_CMT_RECORDS_PER_WAVE = 200 (transactional row lock limit)
   */
  it('should have MAX_CMT_RECORDS_PER_WAVE set to 200', () => {
    expect(SALESFORCE_LIMITS.MAX_CMT_RECORDS_PER_WAVE).to.equal(200);
  });

  /**
   * @ac US-004-AC-5: API_TIMEOUT_MS = 600000 (10 minutes)
   */
  it('should have API_TIMEOUT_MS set to 600000', () => {
    expect(SALESFORCE_LIMITS.API_TIMEOUT_MS).to.equal(600_000);
  });

  /**
   * @ac US-004-AC-6: Constants are documented with official Salesforce documentation references
   * @ac US-004-AC-7: Constants are not user-configurable (immutable)
   */
  it('should be an immutable object with proper structure', () => {
    // Verify it's an object
    expect(SALESFORCE_LIMITS).to.be.an('object');

    // Verify it's frozen (immutable)
    expect(Object.isFrozen(SALESFORCE_LIMITS)).to.equal(true);

    // Verify all properties exist
    expect(SALESFORCE_LIMITS).to.have.property('MAX_COMPONENTS_PER_WAVE');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_FILES_PER_DEPLOYMENT');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_DEPLOYMENT_SIZE_COMPRESSED_MB');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB');
    expect(SALESFORCE_LIMITS).to.have.property('MAX_CMT_RECORDS_PER_WAVE');
    expect(SALESFORCE_LIMITS).to.have.property('API_TIMEOUT_MS');

    // Verify all values are positive numbers
    expect(SALESFORCE_LIMITS.MAX_COMPONENTS_PER_WAVE).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_FILES_PER_DEPLOYMENT).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_COMPRESSED_MB).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.MAX_CMT_RECORDS_PER_WAVE).to.be.greaterThan(0);
    expect(SALESFORCE_LIMITS.API_TIMEOUT_MS).to.be.greaterThan(0);
  });

  /**
   * @ac US-004-AC-8: Reflect real Salesforce API limits, not arbitrary numbers
   */
  it('should use real-world limits based on production experience', () => {
    // Real-world: 300 components per wave, 500 files per deployment
    // Official API limit is higher, but UNKNOWN_EXCEPTION occurs at these thresholds
    expect(SALESFORCE_LIMITS.MAX_COMPONENTS_PER_WAVE).to.equal(300);
    expect(SALESFORCE_LIMITS.MAX_FILES_PER_DEPLOYMENT).to.equal(500);
  });

  it('should use official Salesforce limits for package size', () => {
    // Official: 39 MB compressed, 600 MB uncompressed
    // Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy_size.htm
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_COMPRESSED_MB).to.equal(39);
    expect(SALESFORCE_LIMITS.MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB).to.equal(600);
  });

  it('should use proven production limits for Custom Metadata Records', () => {
    // Proven: 200 records per wave to avoid UNABLE_TO_LOCK_ROW
    // This is NOT an official Salesforce documented limit, but a production-proven best practice
    expect(SALESFORCE_LIMITS.MAX_CMT_RECORDS_PER_WAVE).to.equal(200);
  });
});
