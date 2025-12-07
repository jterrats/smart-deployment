/**
 * Type definitions for Salesforce Apex metadata
 * Represents ApexClass and ApexTrigger metadata structures
 */

import type { PackageVersion } from './common.js';

/**
 * Apex Class metadata (ApexClass.cls-meta.xml)
 */
export type ApexClassMetadata = {
  apiVersion: string;
  status: ApexStatus;
  packageVersions?: PackageVersion[];
};

/**
 * Apex Trigger metadata (ApexTrigger.trigger-meta.xml)
 */
export type ApexTriggerMetadata = {
  apiVersion: string;
  status: ApexStatus;
  packageVersions?: PackageVersion[];
};

/**
 * Apex status values
 */
export type ApexStatus = 'Active' | 'Inactive' | 'Deleted';

/**
 * Apex sharing mode
 */
export type ApexSharingMode = 'with sharing' | 'without sharing' | 'inherited sharing';

/**
 * Apex access modifier
 */
export type ApexAccessModifier = 'public' | 'global' | 'private' | 'protected';

/**
 * Apex annotation
 */
export type ApexAnnotation = {
  name: string;
  parameters?: Record<string, string | number | boolean>;
};

/**
 * Apex method signature
 */
export type ApexMethodSignature = {
  name: string;
  returnType: string;
  parameters: ApexParameter[];
  accessModifier: ApexAccessModifier;
  isStatic: boolean;
  isTestMethod: boolean;
  annotations: ApexAnnotation[];
};

/**
 * Apex parameter
 */
export type ApexParameter = {
  name: string;
  type: string;
};

/**
 * Apex property
 */
export type ApexProperty = {
  name: string;
  type: string;
  accessModifier: ApexAccessModifier;
  isStatic: boolean;
  hasGetter: boolean;
  hasSetter: boolean;
};

/**
 * Apex inner class
 */
export type ApexInnerClass = {
  name: string;
  accessModifier: ApexAccessModifier;
  isVirtual: boolean;
  isAbstract: boolean;
  extends?: string;
  implements: string[];
};

/**
 * Apex trigger event
 */
export type ApexTriggerEvent =
  | 'before insert'
  | 'before update'
  | 'before delete'
  | 'after insert'
  | 'after update'
  | 'after delete'
  | 'after undelete';

/**
 * Apex trigger metadata structure
 */
export type ApexTriggerInfo = {
  name: string;
  objectName: string;
  events: ApexTriggerEvent[];
  isActive: boolean;
};
