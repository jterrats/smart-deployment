/**
 * Type definitions for Salesforce Object metadata
 * Represents CustomObject and CustomField metadata structures
 */

/**
 * Custom Object metadata (.object-meta.xml)
 */
export type CustomObjectMetadata = {
  actionOverrides?: ActionOverride[];
  allowInChatterGroups?: boolean;
  compactLayoutAssignment?: string;
  customHelpPage?: string;
  deploymentStatus?: DeploymentStatus;
  deprecated?: boolean;
  description?: string;
  enableActivities?: boolean;
  enableBulkApi?: boolean;
  enableChangeDataCapture?: boolean;
  enableEnhancedLookup?: boolean;
  enableFeeds?: boolean;
  enableHistory?: boolean;
  enableReports?: boolean;
  enableSearch?: boolean;
  enableSharing?: boolean;
  enableStreamingApi?: boolean;
  externalSharingModel?: SharingModel;
  fields?: CustomField[];
  fieldSets?: FieldSet[];
  gender?: Gender;
  household?: boolean;
  label: string;
  listViews?: ListView[];
  nameField?: CustomField;
  pluralLabel: string;
  recordTypes?: RecordType[];
  searchLayouts?: SearchLayouts;
  sharingModel?: SharingModel;
  sharingReasons?: SharingReason[];
  sharingRecalculations?: SharingRecalculation[];
  startsWith?: StartsWith;
  validationRules?: ValidationRule[];
  visibility?: SetupObjectVisibility;
  webLinks?: WebLink[];
};

/**
 * Deployment status
 */
export type DeploymentStatus = 'Deployed' | 'InDevelopment';

/**
 * Sharing model
 */
export type SharingModel =
  | 'Private'
  | 'Read'
  | 'ReadWrite'
  | 'ReadWriteTransfer'
  | 'FullAccess'
  | 'ControlledByParent'
  | 'ControlledByCampaign'
  | 'ControlledByLeadOrContact';

/**
 * Gender
 */
export type Gender = 'Neuter' | 'Masculine' | 'Feminine' | 'AnimateMasculine' | 'ClassI' | 'ClassIII';

/**
 * Starts with
 */
export type StartsWith = 'Consonant' | 'Vowel' | 'Special';

/**
 * Setup object visibility
 */
export type SetupObjectVisibility = 'Public' | 'Protected' | 'PackageProtected';

/**
 * Action override
 */
export type ActionOverride = {
  actionName: string;
  comment?: string;
  content?: string;
  formFactor?: FormFactor;
  skipRecordTypeSelect?: boolean;
  type: ActionOverrideType;
};

/**
 * Form factor
 */
export type FormFactor = 'Small' | 'Medium' | 'Large';

/**
 * Action override type
 */
export type ActionOverrideType =
  | 'Default'
  | 'Standard'
  | 'Scontrol'
  | 'Visualforce'
  | 'Flexipage'
  | 'LightningComponent';

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
 * Filter item
 */
export type FilterItem = {
  field: string;
  operation: FilterOperation;
  value?: string;
  valueField?: string;
};

/**
 * Filter operation
 */
export type FilterOperation =
  | 'equals'
  | 'notEqual'
  | 'lessThan'
  | 'greaterThan'
  | 'lessOrEqual'
  | 'greaterOrEqual'
  | 'contains'
  | 'notContain'
  | 'startsWith'
  | 'includes'
  | 'excludes'
  | 'within';

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

/**
 * List view
 */
export type ListView = {
  fullName: string;
  booleanFilter?: string;
  columns: string[];
  division?: string;
  filterScope: FilterScope;
  filters?: ListViewFilter[];
  label: string;
  language?: string;
  queue?: string;
  sharedTo?: SharedTo;
};

/**
 * Filter scope
 */
export type FilterScope =
  | 'Everything'
  | 'Mine'
  | 'Queue'
  | 'Delegated'
  | 'MyTerritory'
  | 'MyTeamTerritory'
  | 'Team'
  | 'AssignedToMe'
  | 'MineAndMyGroups';

/**
 * List view filter
 */
export type ListViewFilter = {
  field: string;
  operation: FilterOperation;
  value?: string;
};

/**
 * Shared to
 */
export type SharedTo = {
  allCustomerPortalUsers?: string;
  allInternalUsers?: string;
  allPartnerUsers?: string;
  channelProgramGroup?: string[];
  channelProgramGroups?: string[];
  group?: string[];
  groups?: string[];
  managerSubordinates?: string[];
  managers?: string[];
  portalRole?: string[];
  portalRoleAndSubordinates?: string[];
  queue?: string[];
  role?: string[];
  roleAndSubordinates?: string[];
  roleAndSubordinatesInternal?: string[];
  roles?: string[];
  rolesAndSubordinates?: string[];
  territories?: string[];
  territoriesAndSubordinates?: string[];
  territory?: string[];
  territoryAndSubordinates?: string[];
};

/**
 * Record type
 */
export type RecordType = {
  fullName: string;
  active: boolean;
  businessProcess?: string;
  compactLayoutAssignment?: string;
  description?: string;
  label: string;
  picklistValues?: RecordTypePicklistValue[];
};

/**
 * Record type picklist value
 */
export type RecordTypePicklistValue = {
  picklist: string;
  values: PicklistValue[];
};

/**
 * Picklist value
 */
export type PicklistValue = {
  fullName: string;
  default: boolean;
  allowEmail?: boolean;
  closed?: boolean;
  controllingFieldValues?: string[];
  converted?: boolean;
  cssExposed?: boolean;
  forecastCategory?: ForecastCategories;
  highPriority?: boolean;
  probability?: number;
  reverseRole?: string;
  reviewed?: boolean;
  won?: boolean;
};

/**
 * Forecast categories
 */
export type ForecastCategories = 'Omitted' | 'Pipeline' | 'BestCase' | 'Forecast' | 'Closed';

/**
 * Search layouts
 */
export type SearchLayouts = {
  customTabListAdditionalFields?: string[];
  excludedStandardButtons?: string[];
  listViewButtons?: string[];
  lookupDialogsAdditionalFields?: string[];
  lookupFilterFields?: string[];
  lookupPhoneDialogsAdditionalFields?: string[];
  searchFilterFields?: string[];
  searchResultsAdditionalFields?: string[];
  searchResultsCustomButtons?: string[];
};

/**
 * Sharing reason
 */
export type SharingReason = {
  fullName: string;
  label: string;
};

/**
 * Sharing recalculation
 */
export type SharingRecalculation = {
  className: string;
};

/**
 * Validation rule
 */
export type ValidationRule = {
  fullName: string;
  active: boolean;
  description?: string;
  errorConditionFormula: string;
  errorDisplayField?: string;
  errorMessage: string;
};

/**
 * Web link
 */
export type WebLink = {
  fullName: string;
  availability: WebLinkAvailability;
  description?: string;
  displayType: WebLinkDisplayType;
  encodingKey?: Encoding;
  hasMenubar?: boolean;
  hasScrollbars?: boolean;
  hasToolbar?: boolean;
  height?: number;
  isResizable?: boolean;
  linkType: WebLinkType;
  masterLabel?: string;
  openType: WebLinkWindowType;
  page?: string;
  position?: WebLinkPosition;
  protected: boolean;
  requireRowSelection?: boolean;
  scontrol?: string;
  showsLocation?: boolean;
  showsStatus?: boolean;
  url?: string;
  width?: number;
};

/**
 * Web link availability
 */
export type WebLinkAvailability = 'online' | 'offline';

/**
 * Web link display type
 */
export type WebLinkDisplayType = 'link' | 'button' | 'massActionButton';

/**
 * Encoding
 */
export type Encoding =
  | 'UTF-8'
  | 'ISO-8859-1'
  | 'Shift_JIS'
  | 'ISO-2022-JP'
  | 'EUC-JP'
  | 'ks_c_5601-1987'
  | 'Big5'
  | 'GB2312'
  | 'Big5-HKSCS'
  | 'x-SJIS_0213';

/**
 * Web link type
 */
export type WebLinkType = 'url' | 'sControl' | 'javascript' | 'page' | 'flow';

/**
 * Web link window type
 */
export type WebLinkWindowType = 'newWindow' | 'sidebar' | 'noSidebar' | 'replace' | 'onClickJavaScript';

/**
 * Web link position
 */
export type WebLinkPosition = 'fullScreen' | 'none' | 'topLeft';
