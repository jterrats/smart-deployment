import { expect } from 'chai';
import {
  MIN_API_VERSION,
  RECOMMENDED_API_VERSION,
  DEPRECATED_API_VERSIONS,
  validateApiVersion,
  getApiVersionRequirements,
} from '../../../src/constants/api-version.js';

describe('API Version Constants', () => {
  it('should have MIN_API_VERSION set to 40.0', () => {
    expect(MIN_API_VERSION).to.equal(40.0);
  });

  it('should have RECOMMENDED_API_VERSION set to latest (61.0)', () => {
    expect(RECOMMENDED_API_VERSION).to.equal(61.0);
    expect(RECOMMENDED_API_VERSION).to.be.greaterThan(MIN_API_VERSION);
  });

  it('should have deprecated API versions 21.0-30.0', () => {
    expect(DEPRECATED_API_VERSIONS).to.have.lengthOf(10);
    expect(DEPRECATED_API_VERSIONS).to.include(21.0);
    expect(DEPRECATED_API_VERSIONS).to.include(30.0);
  });
});

describe('validateApiVersion', () => {
  describe('error cases', () => {
    it('should reject versions below minimum (40.0)', () => {
      const result = validateApiVersion(39.0);
      expect(result.valid).to.be.false;
      expect(result.level).to.equal('error');
      expect(result.message).to.include('below the minimum');
    });

    it('should reject version 30.0 (below minimum)', () => {
      const result = validateApiVersion('30.0');
      expect(result.valid).to.be.false;
      expect(result.level).to.equal('error');
    });

    it('should reject invalid version format', () => {
      const result = validateApiVersion('invalid');
      expect(result.valid).to.be.false;
      expect(result.level).to.equal('error');
      expect(result.message).to.include('Invalid API version format');
    });
  });

  describe('warning cases', () => {
    it('should warn for outdated versions (4+ versions behind)', () => {
      const oldVersion = RECOMMENDED_API_VERSION - 5;
      const result = validateApiVersion(oldVersion);
      expect(result.valid).to.be.true;
      expect(result.level).to.equal('warning');
      expect(result.message).to.include('versions behind');
    });
  });

  describe('valid cases', () => {
    it('should accept minimum version (40.0)', () => {
      const result = validateApiVersion(40.0);
      expect(result.valid).to.be.true;
    });

    it('should accept recommended version', () => {
      const result = validateApiVersion(RECOMMENDED_API_VERSION);
      expect(result.valid).to.be.true;
      expect(result.level).to.equal('ok');
    });

    it('should accept recent versions (within 3 releases)', () => {
      const recentVersion = RECOMMENDED_API_VERSION - 2;
      const result = validateApiVersion(recentVersion);
      expect(result.valid).to.be.true;
      expect(result.level).to.equal('ok');
    });

    it('should accept version as string', () => {
      const result = validateApiVersion('59.0');
      expect(result.valid).to.be.true;
    });

    it('should accept version as number', () => {
      const result = validateApiVersion(59.0);
      expect(result.valid).to.be.true;
    });
  });

  describe('governance enforcement', () => {
    it('should enforce modernization by rejecting old versions', () => {
      const legacyVersions = [35.0, 36.0, 37.0, 38.0, 39.0];

      legacyVersions.forEach((version) => {
        const result = validateApiVersion(version);
        expect(result.valid).to.be.false;
        expect(result.level).to.equal('error');
        expect(result.message).to.include('minimum supported version');
      });
    });

    it('should provide actionable error messages', () => {
      const result = validateApiVersion(35.0);
      expect(result.message).to.include('sfdx-project.json');
      expect(result.message).to.include(RECOMMENDED_API_VERSION.toString());
    });
  });
});

describe('getApiVersionRequirements', () => {
  it('should return informative requirements message', () => {
    const message = getApiVersionRequirements();

    expect(message).to.include('40');
    expect(message).to.include('61');
    expect(message).to.include('sfdx-project.json');
    expect(message).to.include('Why this requirement?');
  });

  it('should explain retirement of old versions', () => {
    const message = getApiVersionRequirements();

    expect(message).to.include('21.0-30.0');
    expect(message).to.include('retiring');
    expect(message).to.include('June 2025');
  });

  it('should provide update instructions', () => {
    const message = getApiVersionRequirements();

    expect(message).to.include('sourceApiVersion');
    expect(message).to.include('61');
  });
});

describe('API Version Governance', () => {
  it('should help orgs with poor governance modernize', () => {
    // This plugin's purpose is to enforce best practices
    // By requiring API 40.0+, we force orgs to:
    // 1. Update to modern Salesforce features
    // 2. Avoid deprecated APIs
    // 3. Follow recommended patterns

    const poorGovernanceVersion = 33.0; // Old, unmaintained org
    const result = validateApiVersion(poorGovernanceVersion);

    expect(result.valid).to.be.false;
    expect(result.message).to.include('modern features');
  });

  it('should provide clear path to compliance', () => {
    const result = validateApiVersion(35.0);

    // Message should be actionable, not just "no"
    expect(result.message).to.include('update');
    expect(result.message).to.include(RECOMMENDED_API_VERSION.toString());
  });
});
