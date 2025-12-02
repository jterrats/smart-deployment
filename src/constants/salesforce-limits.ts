/**
 * Salesforce API and Deployment Limits
 *
 * These are **hardcoded technical limits** from Salesforce that should NOT be configurable by users.
 * These limits are based on Salesforce API constraints and proven deployment best practices.
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm
 */

/**
 * Maximum number of metadata components per deployment wave.
 *
 * **Why 300?**
 * - Salesforce has an undocumented limit around 400-500 files per deployment
 * - Each component can generate multiple files (e.g., CustomObject + fields)
 * - 300 components ~= 400-450 files with safety margin
 * - Exceeding this causes UNKNOWN_EXCEPTION errors
 *
 * @constant
 * @type {number}
 */
const MAX_COMPONENTS_PER_WAVE = 300;

/**
 * Maximum number of Custom Metadata Records per deployment wave.
 *
 * **Why 200?**
 * - CustomMetadataType records have a **lower limit** than general metadata
 * - Salesforce enforces ~200-250 records per transaction
 * - 200 is a proven safe limit in production deployments
 * - Exceeding this causes deployment failures
 *
 * @constant
 * @type {number}
 */
const MAX_CMT_RECORDS_PER_WAVE = 200;

/**
 * Maximum number of files per deployment (including metadata + source files).
 *
 * **Why 500?**
 * - Salesforce Metadata API has an approximate limit of 500 files per deploy operation
 * - This includes both metadata XML files and source files (Apex, LWC, etc.)
 * - Exceeding this can cause timeouts or UNKNOWN_EXCEPTION
 *
 * @constant
 * @type {number}
 */
const MAX_FILES_PER_DEPLOYMENT = 500;

/**
 * API timeout for Salesforce deployment operations in milliseconds.
 *
 * **Why 600000 (10 minutes)?**
 * - Salesforce deployments can take several minutes for large metadata sets
 * - Average deployment: 2-5 minutes
 * - Complex deployments with tests: 5-10 minutes
 * - 10 minutes provides reasonable buffer while preventing indefinite hangs
 *
 * @constant
 * @type {number}
 */
const API_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Salesforce API and Deployment Limits
 *
 * **IMPORTANT**: These are immutable constants. Do NOT attempt to modify these values.
 * They represent technical constraints from Salesforce, not configuration options.
 *
 * @constant
 * @readonly
 */
export const SALESFORCE_LIMITS = Object.freeze({
  MAX_COMPONENTS_PER_WAVE,
  MAX_CMT_RECORDS_PER_WAVE,
  MAX_FILES_PER_DEPLOYMENT,
  API_TIMEOUT_MS,
} as const);

/**
 * Type helper for Salesforce Limits
 */
export type SalesforceLimits = typeof SALESFORCE_LIMITS;
