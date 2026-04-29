/**
 * Core Custom Object metadata types for Salesforce Object metadata.
 */

import type { CustomField, FieldSet } from './field.js';
import type { ListView, SearchLayouts } from './view.js';
import type { RecordType } from './record.js';
import type { SharingReason, SharingRecalculation, ValidationRule } from './policy.js';
import type { ActionOverride, WebLink } from './weblink.js';

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
