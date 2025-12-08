/**
 * Type definitions for Salesforce Custom Metadata Type
 * Represents CustomMetadata metadata structures (.md-meta.xml and .md files)
 */

/**
 * Custom Metadata Type metadata (.md-meta.xml)
 */
export type CustomMetadataType = {
  label: string;
  pluralLabel: string;
  description?: string;
  visibility?: CustomMetadataVisibility;
  fields?: CustomMetadataField[];
};

/**
 * Custom Metadata Type visibility
 */
export type CustomMetadataVisibility = 'PackageProtected' | 'Protected' | 'Public';

/**
 * Custom Metadata Type field definition
 */
export type CustomMetadataField = {
  fullName: string;
  label: string;
  type: CustomMetadataFieldType;
  businessOwnerGroup?: string;
  businessOwnerUser?: string;
  businessStatus?: string;
  caseSensitive?: boolean;
  defaultValue?: string;
  deprecated?: boolean;
  description?: string;
  externalId?: boolean;
  fieldManageability?: FieldManageability;
  inlineHelpText?: string;
  length?: number;
  precision?: number;
  referenceTo?: string; // For EntityDefinition or FieldDefinition
  referenceTargetField?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  required?: boolean;
  scale?: number;
  unique?: boolean;
  valueSet?: CustomMetadataValueSet;
  visibleLines?: number;
};

/**
 * Custom Metadata Field Type
 */
export type CustomMetadataFieldType =
  | 'Checkbox'
  | 'Date'
  | 'DateTime'
  | 'Email'
  | 'MetadataRelationship'
  | 'Number'
  | 'Percent'
  | 'Phone'
  | 'Picklist'
  | 'Text'
  | 'TextArea'
  | 'LongTextArea'
  | 'Url';

/**
 * Field Manageability
 */
export type FieldManageability = 'DeveloperControlled' | 'SubscriberControlled';

/**
 * Custom Metadata Value Set (for picklists)
 */
export type CustomMetadataValueSet = {
  restricted?: boolean;
  valueSetDefinition?: CustomMetadataValueSetDefinition;
};

/**
 * Custom Metadata Value Set Definition
 */
export type CustomMetadataValueSetDefinition = {
  sorted: boolean;
  value: CustomMetadataValue[];
};

/**
 * Custom Metadata Value (picklist value)
 */
export type CustomMetadataValue = {
  fullName: string;
  default: boolean;
  label: string;
  color?: string;
  isActive?: boolean;
};

/**
 * Custom Metadata Record (.md file)
 */
export type CustomMetadataRecord = {
  label: string;
  language?: string;
  protected?: boolean;
  values?: CustomMetadataRecordValue[];
};

/**
 * Custom Metadata Record Value
 */
export type CustomMetadataRecordValue = {
  field: string;
  value: unknown;
};
