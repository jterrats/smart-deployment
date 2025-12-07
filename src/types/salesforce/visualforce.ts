/**
 * Type definitions for Visualforce metadata
 * Represents ApexPage and ApexComponent metadata structures
 */

/**
 * Visualforce Page metadata (.page-meta.xml)
 */
export type VisualforcePageMetadata = {
  apiVersion: string;
  label: string;
  description?: string;
  availableInTouch?: boolean;
  confirmationTokenRequired?: boolean;
  packageVersions?: PackageVersion[];
};

/**
 * Visualforce Component metadata (.component-meta.xml)
 */
export type VisualforceComponentMetadata = {
  apiVersion: string;
  label: string;
  description?: string;
  packageVersions?: PackageVersion[];
};

/**
 * Package version reference
 */
export type PackageVersion = {
  majorNumber: number;
  minorNumber: number;
  namespace: string;
};

/**
 * Visualforce tag types
 */
export type VisualforceTagType =
  | 'apex'
  | 'c'
  | 'chatter'
  | 'flow'
  | 'ideas'
  | 'knowledge'
  | 'messaging'
  | 'site'
  | 'support'
  | 'topics';

/**
 * Visualforce standard controller
 */
export type VisualforceStandardController = string; // SObject API name like 'Account', 'Contact'

/**
 * Visualforce attribute
 */
export type VisualforceAttribute = {
  name: string;
  type: VisualforceAttributeType;
  required?: boolean;
  default?: string;
  description?: string;
};

/**
 * Visualforce attribute type
 * For SObject types, use the SObject API name directly (e.g., 'Account', 'Contact')
 */
export type VisualforceAttributeType =
  | 'String'
  | 'Boolean'
  | 'Integer'
  | 'Double'
  | 'Date'
  | 'DateTime'
  | 'Id'
  | 'Object'
  | `${string}__c` // Custom SObjects
  | 'Account'
  | 'Contact'
  | 'Lead'
  | 'Opportunity'
  | 'Case'
  | 'User'
  | (string & NonNullable<unknown>); // Allow other standard/custom objects

/**
 * Visualforce tag reference
 */
export type VisualforceTagReference = {
  namespace: string;
  tagName: string;
  attributes?: Record<string, string>;
};

/**
 * Visualforce controller reference
 */
export type VisualforceControllerReference = {
  type: 'standard' | 'custom' | 'extension';
  name: string;
};

/**
 * Visualforce action reference
 */
export type VisualforceActionReference = {
  controller: string;
  method: string;
};
