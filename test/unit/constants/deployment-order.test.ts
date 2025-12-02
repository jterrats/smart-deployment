import { expect } from 'chai';
import { DEPLOYMENT_ORDER, getDeploymentPriority } from '../../../src/constants/deployment-order.js';

describe('DEPLOYMENT_ORDER', () => {
  /**
   * @ac US-005-AC-1: CustomObject has low priority (early deployment)
   */
  it('should assign low priority to CustomObject (early deployment)', () => {
    expect(DEPLOYMENT_ORDER.CustomObject).to.be.lessThan(10);
    expect(DEPLOYMENT_ORDER.CustomObject).to.equal(6);
  });

  /**
   * @ac US-005-AC-2: CustomField comes after CustomObject
   */
  it('should assign priority after CustomObject to CustomField', () => {
    expect(DEPLOYMENT_ORDER.CustomField).to.be.greaterThan(DEPLOYMENT_ORDER.CustomObject);
    expect(DEPLOYMENT_ORDER.CustomField).to.equal(11);
  });

  /**
   * @ac US-005-AC-3: ApexClass deployed in code tier
   */
  it('should assign code-tier priority to ApexClass', () => {
    expect(DEPLOYMENT_ORDER.ApexClass).to.be.greaterThan(DEPLOYMENT_ORDER.CustomField);
    expect(DEPLOYMENT_ORDER.ApexClass).to.equal(31);
  });

  /**
   * @ac US-005-AC-4: ApexTrigger comes after ApexClass
   */
  it('should assign priority after ApexClass to ApexTrigger', () => {
    expect(DEPLOYMENT_ORDER.ApexTrigger).to.be.greaterThan(DEPLOYMENT_ORDER.ApexClass);
    expect(DEPLOYMENT_ORDER.ApexTrigger).to.equal(36);
  });

  /**
   * @ac US-005-AC-5: Flow deployed after code
   */
  it('should assign priority after Apex to Flow', () => {
    expect(DEPLOYMENT_ORDER.Flow).to.be.greaterThan(DEPLOYMENT_ORDER.ApexTrigger);
    expect(DEPLOYMENT_ORDER.Flow).to.equal(48);
  });

  /**
   * @ac US-005-AC-6: All 50+ metadata types have order defined
   */
  it('should have at least 50 metadata types defined', () => {
    const metadataTypes = Object.keys(DEPLOYMENT_ORDER);
    expect(metadataTypes.length).to.be.at.least(50);
    // Current count: 78 types defined in metadata.ts
    expect(metadataTypes.length).to.equal(78);
  });

  /**
   * @ac US-005-AC-7: Order follows Salesforce best practices
   * @ac US-005-AC-8: Constants are immutable (as const)
   */
  it('should follow Salesforce deployment best practices', () => {
    // Basic structure types must come first
    expect(DEPLOYMENT_ORDER.CustomObject).to.be.lessThan(DEPLOYMENT_ORDER.ApexClass);
    expect(DEPLOYMENT_ORDER.CustomField).to.be.lessThan(DEPLOYMENT_ORDER.ApexClass);

    // Triggers after classes
    expect(DEPLOYMENT_ORDER.ApexClass).to.be.lessThan(DEPLOYMENT_ORDER.ApexTrigger);

    // Profiles/PermissionSets should be after objects and classes
    expect(DEPLOYMENT_ORDER.Profile).to.be.greaterThan(DEPLOYMENT_ORDER.CustomObject);
    expect(DEPLOYMENT_ORDER.PermissionSet).to.be.greaterThan(DEPLOYMENT_ORDER.ApexClass);

    // Object should be immutable
    expect(Object.isFrozen(DEPLOYMENT_ORDER)).to.be.true;
  });
});

describe('getDeploymentPriority', () => {
  it('should return priority for known metadata type', () => {
    expect(getDeploymentPriority('CustomObject')).to.equal(6);
    expect(getDeploymentPriority('ApexClass')).to.equal(31);
  });

  it('should return default priority (99) for unknown metadata type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(getDeploymentPriority('UnknownType' as any)).to.equal(99);
  });

  it('should handle case-sensitive metadata types', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(getDeploymentPriority('customobject' as any)).to.equal(99); // Case matters
    expect(getDeploymentPriority('CustomObject')).to.equal(6);
  });
});
