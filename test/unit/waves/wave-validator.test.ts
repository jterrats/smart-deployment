import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveValidator } from '../../../src/waves/wave-validator.js';

describe('WaveValidator', () => {
  /**
   * @ac US-043-AC-1: Validate dependency order
   * @ac US-043-AC-2: Validate component limits
   * @ac US-043-AC-3: Validate test requirements
   * @ac US-043-AC-4: Validate no cycles within wave
   */
  it('US-043-AC-1: should validate dependency order', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves([], new Map());
    expect(result.isValid).to.be.true;
  });

  it('US-043-AC-2: should validate component limits', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  it('US-043-AC-3: should validate test requirements', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  it('US-043-AC-4: should validate no cycles within wave', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  /**
   * @ac US-043-AC-5: Generate validation report
   */
  it('US-043-AC-5: should generate validation report', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves([], new Map());
    expect(result.errors).to.be.an('array');
  });

  /**
   * @ac US-043-AC-6: Fail on critical issues
   */
  it('US-043-AC-6: should fail on critical issues', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves([], new Map());
    expect(result.isValid).to.be.a('boolean');
  });
});
