/**
 * Type definitions for Salesforce Permission metadata
 * Represents PermissionSet and Profile metadata structures
 */

/**
 * Permission Set metadata (.permissionset-meta.xml)
 */
export type PermissionSetMetadata = {
  description?: string;
  hasActivationRequired?: boolean;
  label: string;
  license?: string;
  applicationVisibilities?: PermissionSetApplicationVisibility[];
  classAccesses?: PermissionSetApexClassAccess[];
  customMetadataTypeAccesses?: PermissionSetCustomMetadataTypeAccess[];
  customPermissions?: PermissionSetCustomPermissions[];
  customSettingAccesses?: PermissionSetCustomSettingAccess[];
  externalDataSourceAccesses?: PermissionSetExternalDataSourceAccess[];
  fieldPermissions?: PermissionSetFieldPermissions[];
  flowAccesses?: PermissionSetFlowAccess[];
  objectPermissions?: PermissionSetObjectPermissions[];
  pageAccesses?: PermissionSetApexPageAccess[];
  recordTypeVisibilities?: PermissionSetRecordTypeVisibility[];
  tabSettings?: PermissionSetTabVisibility[];
  userPermissions?: PermissionSetUserPermission[];
};

/**
 * Profile metadata (.profile-meta.xml)
 */
export type ProfileMetadata = {
  custom?: boolean;
  description?: string;
  userLicense?: string;
  applicationVisibilities?: ProfileApplicationVisibility[];
  classAccesses?: ProfileApexClassAccess[];
  customMetadataTypeAccesses?: ProfileCustomMetadataTypeAccess[];
  customPermissions?: ProfileCustomPermissions[];
  customSettingAccesses?: ProfileCustomSettingAccess[];
  externalDataSourceAccesses?: ProfileExternalDataSourceAccess[];
  fieldPermissions?: ProfileFieldPermissions[];
  flowAccesses?: ProfileFlowAccess[];
  layoutAssignments?: ProfileLayoutAssignment[];
  loginHours?: ProfileLoginHours;
  loginIpRanges?: ProfileLoginIpRange[];
  objectPermissions?: ProfileObjectPermissions[];
  pageAccesses?: ProfileApexPageAccess[];
  recordTypeVisibilities?: ProfileRecordTypeVisibility[];
  tabVisibilities?: ProfileTabVisibility[];
  userPermissions?: ProfileUserPermission[];
};

/**
 * Permission Set Application Visibility
 */
export type PermissionSetApplicationVisibility = {
  application: string;
  visible: boolean;
};

/**
 * Profile Application Visibility
 */
export type ProfileApplicationVisibility = {
  application: string;
  default: boolean;
  visible: boolean;
};

/**
 * Permission Set Apex Class Access
 */
export type PermissionSetApexClassAccess = {
  apexClass: string;
  enabled: boolean;
};

/**
 * Profile Apex Class Access
 */
export type ProfileApexClassAccess = {
  apexClass: string;
  enabled: boolean;
};

/**
 * Permission Set Custom Metadata Type Access
 */
export type PermissionSetCustomMetadataTypeAccess = {
  enabled: boolean;
  name: string;
};

/**
 * Profile Custom Metadata Type Access
 */
export type ProfileCustomMetadataTypeAccess = {
  enabled: boolean;
  name: string;
};

/**
 * Permission Set Custom Permissions
 */
export type PermissionSetCustomPermissions = {
  enabled: boolean;
  name: string;
};

/**
 * Profile Custom Permissions
 */
export type ProfileCustomPermissions = {
  enabled: boolean;
  name: string;
};

/**
 * Permission Set Custom Setting Access
 */
export type PermissionSetCustomSettingAccess = {
  enabled: boolean;
  name: string;
};

/**
 * Profile Custom Setting Access
 */
export type ProfileCustomSettingAccess = {
  enabled: boolean;
  name: string;
};

/**
 * Permission Set External Data Source Access
 */
export type PermissionSetExternalDataSourceAccess = {
  enabled: boolean;
  externalDataSource: string;
};

/**
 * Profile External Data Source Access
 */
export type ProfileExternalDataSourceAccess = {
  enabled: boolean;
  externalDataSource: string;
};

/**
 * Permission Set Field Permissions
 */
export type PermissionSetFieldPermissions = {
  editable: boolean;
  field: string;
  readable?: boolean;
};

/**
 * Profile Field Permissions
 */
export type ProfileFieldPermissions = {
  editable: boolean;
  field: string;
  readable?: boolean;
};

/**
 * Permission Set Flow Access
 */
export type PermissionSetFlowAccess = {
  enabled: boolean;
  flow: string;
};

/**
 * Profile Flow Access
 */
export type ProfileFlowAccess = {
  enabled: boolean;
  flow: string;
};

/**
 * Permission Set Object Permissions
 */
export type PermissionSetObjectPermissions = {
  allowCreate: boolean;
  allowDelete: boolean;
  allowEdit: boolean;
  allowRead: boolean;
  modifyAllRecords: boolean;
  object: string;
  viewAllRecords: boolean;
};

/**
 * Profile Object Permissions
 */
export type ProfileObjectPermissions = {
  allowCreate: boolean;
  allowDelete: boolean;
  allowEdit: boolean;
  allowRead: boolean;
  modifyAllRecords: boolean;
  object: string;
  viewAllRecords: boolean;
};

/**
 * Permission Set Apex Page Access
 */
export type PermissionSetApexPageAccess = {
  apexPage: string;
  enabled: boolean;
};

/**
 * Profile Apex Page Access
 */
export type ProfileApexPageAccess = {
  apexPage: string;
  enabled: boolean;
};

/**
 * Permission Set Record Type Visibility
 */
export type PermissionSetRecordTypeVisibility = {
  recordType: string;
  visible: boolean;
};

/**
 * Profile Record Type Visibility
 */
export type ProfileRecordTypeVisibility = {
  default: boolean;
  personAccountDefault?: boolean;
  recordType: string;
  visible: boolean;
};

/**
 * Permission Set Tab Visibility
 */
export type PermissionSetTabVisibility = {
  tab: string;
  visibility: PermissionSetTabSettingsVisibility;
};

/**
 * Permission Set Tab Settings Visibility
 */
export type PermissionSetTabSettingsVisibility = 'Visible' | 'Available' | 'None';

/**
 * Profile Tab Visibility
 */
export type ProfileTabVisibility = {
  tab: string;
  visibility: ProfileTabVisibilityType;
};

/**
 * Profile Tab Visibility Type
 */
export type ProfileTabVisibilityType = 'DefaultOn' | 'DefaultOff' | 'Hidden';

/**
 * Permission Set User Permission
 */
export type PermissionSetUserPermission = {
  enabled: boolean;
  name: string;
};

/**
 * Profile User Permission
 */
export type ProfileUserPermission = {
  enabled: boolean;
  name: string;
};

/**
 * Profile Layout Assignment
 */
export type ProfileLayoutAssignment = {
  layout: string;
  recordType?: string;
};

/**
 * Profile Login Hours
 */
export type ProfileLoginHours = {
  fridayEnd?: string;
  fridayStart?: string;
  mondayEnd?: string;
  mondayStart?: string;
  saturdayEnd?: string;
  saturdayStart?: string;
  sundayEnd?: string;
  sundayStart?: string;
  thursdayEnd?: string;
  thursdayStart?: string;
  tuesdayEnd?: string;
  tuesdayStart?: string;
  wednesdayEnd?: string;
  wednesdayStart?: string;
};

/**
 * Profile Login IP Range
 */
export type ProfileLoginIpRange = {
  description?: string;
  endAddress: string;
  startAddress: string;
};
