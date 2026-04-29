/**
 * Filter and query condition types for Salesforce Object metadata.
 */

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
