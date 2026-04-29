/**
 * List view and search layout types for Salesforce Object metadata.
 */

import type { FilterOperation } from './filter.js';

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
