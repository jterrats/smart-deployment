/**
 * Custom field, lookup, and value set types for Salesforce Object metadata.
 */

import type { FilterItem } from './filter.js';

/**
 * Custom Field metadata
 */
export type CustomField = {
  fullName: string;
  label: string;
  type: FieldType;
  businessOwnerGroup?: string;
  businessOwnerUser?: string;
  businessStatus?: string;
  caseSensitive?: boolean;
  complianceGroup?: string;
  customDataType?: string;
  defaultValue?: string;
  deleteConstraint?: DeleteConstraint;
  deprecated?: boolean;
  description?: string;
  displayFormat?: string;
  displayLocationInDecimal?: boolean;
  encrypted?: boolean;
  encryptionScheme?: EncryptionScheme;
  externalDeveloperName?: string;
  externalId?: boolean;
  fieldManageability?: FieldManageability;
  formula?: string;
  formulaTreatBlanksAs?: TreatBlanksAs;
  inlineHelpText?: string;
  isAIPredictionField?: boolean;
  isConversationIntelligenceField?: boolean;
  isFilteringDisabled?: boolean;
  isNameField?: boolean;
  isSortingDisabled?: boolean;
  length?: number;
  lookupFilter?: LookupFilter;
  maskChar?: MaskChar;
  maskType?: MaskType;
  metadataRelationshipControllingField?: string;
  populateExistingRows?: boolean;
  precision?: number;
  referenceTo?: string[];
  referenceTargetField?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  relationshipOrder?: number;
  reparentableMasterDetail?: boolean;
  required?: boolean;
  scale?: number;
  securityClassification?: string;
  startingNumber?: number;
  stripMarkup?: boolean;
  summarizedField?: string;
  summaryFilterItems?: FilterItem[];
  summaryForeignKey?: string;
  summaryOperation?: SummaryOperations;
  trackFeedHistory?: boolean;
  trackHistory?: boolean;
  trackTrending?: boolean;
  translateData?: boolean;
  unique?: boolean;
  valueSet?: ValueSet;
  visibleLines?: number;
  writeRequiresMasterRead?: boolean;
};

/**
 * Field type
 */
export type FieldType =
  | 'AutoNumber'
  | 'Lookup'
  | 'MasterDetail'
  | 'MetadataRelationship'
  | 'Checkbox'
  | 'Currency'
  | 'Date'
  | 'DateTime'
  | 'Email'
  | 'EncryptedText'
  | 'ExternalLookup'
  | 'IndirectLookup'
  | 'Number'
  | 'Percent'
  | 'Phone'
  | 'Picklist'
  | 'MultiselectPicklist'
  | 'Summary'
  | 'Text'
  | 'TextArea'
  | 'LongTextArea'
  | 'Html'
  | 'Url'
  | 'Hierarchy'
  | 'File'
  | 'Location'
  | 'Time';

/**
 * Delete constraint
 */
export type DeleteConstraint = 'Cascade' | 'Restrict' | 'SetNull';

/**
 * Encryption scheme
 */
export type EncryptionScheme =
  | 'None'
  | 'ProbabilisticEncryption'
  | 'CaseSensitiveDeterministicEncryption'
  | 'CaseInsensitiveDeterministicEncryption';

/**
 * Field manageability
 */
export type FieldManageability = 'DeveloperControlled' | 'SubscriberControlled' | 'Locked';

/**
 * Treat blanks as
 */
export type TreatBlanksAs = 'BlankAsBlank' | 'BlankAsZero';

/**
 * Mask char
 */
export type MaskChar = 'asterisk' | 'X';

/**
 * Mask type
 */
export type MaskType = 'all' | 'creditCard' | 'ssn' | 'lastFour' | 'sin' | 'nino';

/**
 * Summary operations
 */
export type SummaryOperations = 'count' | 'min' | 'max' | 'sum';

/**
 * Lookup filter
 */
export type LookupFilter = {
  active: boolean;
  booleanFilter?: string;
  errorMessage?: string;
  filterItems?: FilterItem[];
  infoMessage?: string;
  isOptional: boolean;
};

/**
 * Value set
 */
export type ValueSet = {
  controllingField?: string;
  restricted?: boolean;
  valueSetDefinition?: ValueSetDefinition;
  valueSetName?: string;
};

/**
 * Value set definition
 */
export type ValueSetDefinition = {
  sorted: boolean;
  value: CustomValue[];
};

/**
 * Custom value (picklist value)
 */
export type CustomValue = {
  fullName: string;
  default: boolean;
  label: string;
  color?: string;
  isActive?: boolean;
  description?: string;
};

/**
 * Field set
 */
export type FieldSet = {
  fullName: string;
  availableFields?: FieldSetItem[];
  description?: string;
  displayedFields: FieldSetItem[];
  label: string;
};

/**
 * Field set item
 */
export type FieldSetItem = {
  field: string;
  isFieldManaged?: boolean;
  isRequired?: boolean;
};
