/**
 * Salesforce API and Deployment Limits
 *
 * These are **hardcoded technical limits** from Salesforce that should NOT be configurable by users.
 * These limits are based on official Salesforce Metadata API documentation and real-world production constraints.
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy_size.htm
 */

/**
 * Maximum number of components per deployment wave.
 *
 * **Real-World Limit: 300 components**
 * - Official Salesforce API limit is 10,000 files, but UNKNOWN_EXCEPTION occurs at ~300-500 components
 * - This is a proven safe limit based on production deployments
 * - Exceeding this causes UNKNOWN_EXCEPTION (not API rejection)
 * - This limit is per wave, not per deployment
 *
 * **Why not 10,000?**
 * - Salesforce has undocumented transactional limits that cause UNKNOWN_EXCEPTION
 * - Large deployments (>300 components) hit internal timeout/memory limits
 * - 300 is the safe upper bound for reliable deployments
 *
 * @constant
 * @type {number}
 */
export const MAX_COMPONENTS_PER_WAVE = 300;

/**
 * Maximum number of files per deployment operation.
 *
 * **Real-World Limit: 400-500 files**
 * - Official Salesforce API limit is higher, but practical limit is ~400-500 files
 * - Exceeding this causes UNKNOWN_EXCEPTION
 * - This includes all metadata XML files and source files (Apex, LWC, static resources, etc.)
 *
 * @constant
 * @type {number}
 */
export const MAX_FILES_PER_DEPLOYMENT = 500;

/**
 * Maximum compressed size of deployment package (ZIP).
 *
 * **Official Salesforce Limit: 39 MB compressed**
 * - Applies to the ZIP file sent to Salesforce Metadata API
 * - Exceeding this causes API rejection before deployment starts
 * - Use this to estimate if a wave needs to be split based on size
 *
 * @constant
 * @type {number}
 */
export const MAX_DEPLOYMENT_SIZE_COMPRESSED_MB = 39;

/**
 * Maximum uncompressed size of deployment package.
 *
 * **Official Salesforce Limit: 600 MB uncompressed**
 * - Applies to the total size of all files in the deployment
 * - Useful for pre-validation before compression
 * - Exceeding this causes deployment failures
 *
 * @constant
 * @type {number}
 */
export const MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB = 600;

/**
 * Maximum number of Custom Metadata Records per deployment wave.
 *
 * **Why 200?**
 * - CustomMetadataType records have a **lower transactional limit** than general metadata
 * - Salesforce enforces ~200-250 records per transaction due to row locking
 * - 200 is a proven safe limit in production deployments with heavy CMT usage
 * - Exceeding this causes "UNABLE_TO_LOCK_ROW" errors, not UNKNOWN_EXCEPTION
 *
 * @constant
 * @type {number}
 */
export const MAX_CMT_RECORDS_PER_WAVE = 200;

/**
 * Timeout for Salesforce API calls in milliseconds.
 *
 * **Why 10 minutes?**
 * - Salesforce API calls can be long-running, especially for large deployments
 * - Prevents premature timeouts for legitimate long-running operations
 * - Aligns with common CI/CD timeout practices
 *
 * @constant
 * @type {number}
 */
export const API_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Consolidated Salesforce Limits Object (for backward compatibility)
 *
 * @deprecated Use individual named exports instead (e.g., MAX_FILES_PER_DEPLOYMENT)
 * @constant
 * @readonly
 */
export const SALESFORCE_LIMITS = Object.freeze({
  MAX_COMPONENTS_PER_WAVE,
  MAX_FILES_PER_DEPLOYMENT,
  MAX_DEPLOYMENT_SIZE_COMPRESSED_MB,
  MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB,
  MAX_CMT_RECORDS_PER_WAVE,
  API_TIMEOUT_MS,
} as const);

/**
 * Type helper for Salesforce Limits
 */
export type SalesforceLimits = typeof SALESFORCE_LIMITS;
