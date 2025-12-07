/**
 * Type definitions for Lightning Web Components (LWC) metadata
 * Represents LightningComponentBundle metadata structures
 */

/**
 * LWC metadata (component-name.js-meta.xml)
 */
export type LWCMetadata = {
  apiVersion: string;
  description?: string;
  isExposed: boolean;
  masterLabel?: string;
  targets?: LWCTargets;
  targetConfigs?: LWCTargetConfig[];
  capabilities?: LWCCapability[];
};

/**
 * LWC targets
 */
export type LWCTargets = {
  target: LWCTarget[];
};

/**
 * LWC target
 */
export type LWCTarget =
  | 'lightning__AppPage'
  | 'lightning__HomePage'
  | 'lightning__RecordPage'
  | 'lightning__RecordAction'
  | 'lightning__FlowScreen'
  | 'lightning__Tab'
  | 'lightning__Inbox'
  | 'lightning__UtilityBar'
  | 'lightningCommunity__Page'
  | 'lightningCommunity__Default'
  | 'lightningCommunity__Page_Layout'
  | 'lightningCommunity__Theme_Layout'
  | 'lightningSnapin__ChatMessage'
  | 'lightningSnapin__Minimized'
  | 'lightningSnapin__PreChat'
  | 'lightningSnapin__ChatHeader'
  | 'analytics__Dashboard';

/**
 * LWC target config
 */
export type LWCTargetConfig = {
  targets: string;
  configurationEditor?: string;
  objects?: LWCObject[];
  property?: LWCProperty[];
  supportedFormFactors?: LWCSupportedFormFactor[];
};

/**
 * LWC object
 */
export type LWCObject = {
  object: string;
};

/**
 * LWC property
 */
export type LWCProperty = {
  name: string;
  type: LWCPropertyType;
  default?: string;
  required?: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  role?: LWCPropertyRole;
  datasource?: string;
  min?: number;
  max?: number;
};

/**
 * LWC property type
 */
export type LWCPropertyType =
  | 'Boolean'
  | 'Integer'
  | 'String'
  | 'Color'
  | 'Date'
  | 'DateTime'
  | 'Picklist'
  | 'SObject'
  | 'SObjectField'
  | 'Url';

/**
 * LWC property role
 */
export type LWCPropertyRole = 'Label' | 'Icon' | 'Description' | 'Filter';

/**
 * LWC supported form factors
 */
export type LWCSupportedFormFactor = {
  type: LWCFormFactor;
};

/**
 * LWC form factor
 */
export type LWCFormFactor = 'Small' | 'Medium' | 'Large';

/**
 * LWC capability
 */
export type LWCCapability = 'urn:salesforce:communities:notifications' | 'sfdc:allow_guest_access';

/**
 * LWC import types
 */
export type LWCImportType = 'apex' | 'lwc' | 'schema' | 'custom_label' | 'navigation' | 'wire' | 'platform';

/**
 * LWC import statement
 */
export type LWCImport = {
  type: LWCImportType;
  source: string;
  imports: string[];
  default?: string;
};

/**
 * LWC wire adapter
 */
export type LWCWireAdapter = {
  adapterName: string;
  source: string;
  propertyName: string;
  parameters?: Record<string, string>;
};

/**
 * LWC @api property
 */
export type LWCApiProperty = {
  name: string;
  type?: string;
  isGetter?: boolean;
  isSetter?: boolean;
};

/**
 * LWC navigation reference
 */
export type LWCNavigationReference = {
  type: LWCNavigationType;
  target?: string;
  params?: Record<string, string>;
};

/**
 * LWC navigation type
 */
export type LWCNavigationType =
  | 'standard__recordPage'
  | 'standard__objectPage'
  | 'standard__navItemPage'
  | 'standard__knowledgeArticlePage'
  | 'standard__webPage'
  | 'comm__namedPage'
  | 'comm__loginPage'
  | 'standard__app';
