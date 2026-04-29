/**
 * Record type and picklist option types for Salesforce Object metadata.
 */

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
