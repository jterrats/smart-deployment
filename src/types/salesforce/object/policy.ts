/**
 * Sharing, validation, and object policy types for Salesforce Object metadata.
 */

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
