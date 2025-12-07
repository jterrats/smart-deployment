/**
 * Type definitions for Aura Component Framework metadata
 * Represents AuraDefinitionBundle metadata structures
 */

/**
 * Aura component metadata (.cmp, .app, .evt, .intf)
 */
export type AuraComponentMetadata = {
  apiVersion?: string;
  description?: string;
  access?: AuraAccess;
  controller?: string;
  design?: string;
  documentation?: string;
  helper?: string;
  renderer?: string;
  style?: string;
  svg?: string;
};

/**
 * Aura access level
 */
export type AuraAccess = 'GLOBAL' | 'PUBLIC' | 'PRIVATE' | 'INTERNAL';

/**
 * Aura component type
 */
export type AuraComponentType = 'component' | 'application' | 'event' | 'interface';

/**
 * Aura event type
 */
export type AuraEventType = 'APPLICATION' | 'COMPONENT';

/**
 * Aura attribute
 */
export type AuraAttribute = {
  name: string;
  type: AuraAttributeType;
  required?: boolean;
  default?: string;
  description?: string;
  access?: AuraAccess;
};

/**
 * Aura attribute type
 * For SObject types, use the SObject API name directly (e.g., 'Account', 'Contact')
 */
export type AuraAttributeType =
  | 'String'
  | 'Integer'
  | 'Long'
  | 'Double'
  | 'Decimal'
  | 'Boolean'
  | 'Date'
  | 'DateTime'
  | 'Object'
  | 'Function'
  | 'List'
  | 'Set'
  | 'Map'
  | 'Aura.Component'
  | 'Aura.Component[]'
  | `${string}__c` // Custom SObjects
  | 'Account'
  | 'Contact'
  | 'Lead'
  | 'Opportunity'
  | 'Case'
  | 'User'
  | (string & NonNullable<unknown>); // Allow other standard/custom objects

/**
 * Aura handler
 */
export type AuraHandler = {
  name?: string;
  event?: string;
  action: string;
  value?: string;
  phase?: 'capture' | 'bubble';
};

/**
 * Aura method
 */
export type AuraMethod = {
  name: string;
  action: string;
  description?: string;
  access?: AuraAccess;
  parameters?: AuraMethodParameter[];
};

/**
 * Aura method parameter
 */
export type AuraMethodParameter = {
  name: string;
  type: AuraAttributeType;
  description?: string;
  required?: boolean;
};

/**
 * Aura interface
 */
export type AuraInterface = {
  name: string;
  namespace?: string;
  attributes?: AuraAttribute[];
  methods?: AuraMethod[];
};

/**
 * Aura extends relationship
 */
export type AuraExtends = {
  componentName: string;
  namespace?: string;
};

/**
 * Aura implements relationship
 */
export type AuraImplements = {
  interfaces: string[];
};

/**
 * Aura design attribute
 */
export type AuraDesignAttribute = {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  default?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  datasource?: string;
};

/**
 * Aura design template
 */
export type AuraDesignTemplate = {
  name: string;
  label?: string;
};

/**
 * Aura SVG resource
 */
export type AuraSVGResource = {
  width?: number;
  height?: number;
  viewBox?: string;
};

/**
 * Aura dependency
 */
export type AuraDependencyInfo = {
  resource: string;
  type: AuraDependencyType;
  namespace?: string;
};

/**
 * Aura dependency type
 */
export type AuraDependencyType = 'apex_controller' | 'child_component' | 'event' | 'interface' | 'extends' | 'helper';

/**
 * Aura token
 */
export type AuraToken = {
  name: string;
  value: string;
};

/**
 * Aura lightning component interface
 */
export type AuraLightningInterface =
  | 'flexipage:availableForAllPageTypes'
  | 'flexipage:availableForRecordHome'
  | 'force:appHostable'
  | 'force:hasRecordId'
  | 'force:hasSObjectName'
  | 'force:lightningQuickAction'
  | 'force:lightningQuickActionWithoutHeader'
  | 'forceCommunity:availableForAllPageTypes'
  | 'ltng:allowGuestAccess';
