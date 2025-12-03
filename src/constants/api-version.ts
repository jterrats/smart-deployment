/**
 * Salesforce API Version Requirements
 *
 * This plugin enforces a minimum API version to ensure:
 * - Compatibility with modern Salesforce features
 * - Avoidance of deprecated/retired API versions
 * - Better governance and best practices
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/
 */

/**
 * Minimum supported Salesforce API version.
 *
 * **Why 40.0?**
 * - Released in Winter '17 (8+ years of stability)
 * - API versions 21.0-30.0 are retiring in Summer '25 (June 2025)
 * - API versions 31.0-39.0 are likely candidates for future retirement
 * - Ensures compatibility with Lightning Experience and modern features
 * - Forces orgs to modernize and follow best practices
 *
 * **What gets retired with older versions:**
 * - Classic UI compatibility issues
 * - Missing Lightning Web Components support
 * - Older Flow versions
 * - Deprecated Aura framework features
 *
 * @constant
 */
export const MIN_API_VERSION = 40.0;

/**
 * Recommended API version (latest stable).
 * This should be updated with each Salesforce release.
 *
 * Current: Spring '25 = 61.0
 *
 * @constant
 */
export const RECOMMENDED_API_VERSION = 61.0;

/**
 * API versions that are officially deprecated (will be retired soon).
 * These versions will trigger warnings.
 *
 * Source: https://help.salesforce.com/s/articleView?id=000389618&type=1
 */
export const DEPRECATED_API_VERSIONS = [21.0, 22.0, 23.0, 24.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0] as const;

/**
 * Validate if an API version meets minimum requirements.
 *
 * @param version - API version to validate (e.g., "59.0" or 59.0)
 * @returns Object with validation result and message
 *
 * @example
 * ```typescript
 * const result = validateApiVersion('40.0');
 * if (!result.valid) {
 *   console.error(result.message);
 * }
 * ```
 */
export function validateApiVersion(version: string | number): {
  valid: boolean;
  level: 'error' | 'warning' | 'ok';
  message: string;
} {
  const numVersion = typeof version === 'string' ? parseFloat(version) : version;

  if (isNaN(numVersion)) {
    return {
      valid: false,
      level: 'error',
      message: `Invalid API version format: "${version}". Expected format: "59.0" or 59.0`,
    };
  }

  // Check if version is below minimum
  if (numVersion < MIN_API_VERSION) {
    return {
      valid: false,
      level: 'error',
      message:
        `API version ${numVersion} is below the minimum supported version ${MIN_API_VERSION}. ` +
        `Please update your sfdx-project.json to use API version ${RECOMMENDED_API_VERSION} or higher. ` +
        'Older API versions lack support for modern features and may be retired soon.',
    };
  }

  // Check if version is deprecated
  if (DEPRECATED_API_VERSIONS.includes(numVersion as never)) {
    return {
      valid: true,
      level: 'warning',
      message:
        `API version ${numVersion} is officially deprecated and will be retired in Summer '25 (June 2025). ` +
        `Please update to API version ${RECOMMENDED_API_VERSION} immediately to avoid disruption.`,
    };
  }

  // Check if version is outdated (more than 4 releases old)
  const versionsBehind = RECOMMENDED_API_VERSION - numVersion;
  if (versionsBehind >= 4) {
    return {
      valid: true,
      level: 'warning',
      message:
        `API version ${numVersion} is ${Math.floor(
          versionsBehind
        )} versions behind the latest (${RECOMMENDED_API_VERSION}). ` +
        'Consider upgrading to access new features and ensure long-term compatibility.',
    };
  }

  return {
    valid: true,
    level: 'ok',
    message: `API version ${numVersion} is valid and up to date.`,
  };
}

/**
 * Get a user-friendly message about API version requirements.
 *
 * @returns Information string about version requirements
 */
export function getApiVersionRequirements(): string {
  return (
    `This plugin requires Salesforce API version ${MIN_API_VERSION} or higher.\n` +
    `Recommended version: ${RECOMMENDED_API_VERSION}\n` +
    '\n' +
    'Why this requirement?\n' +
    '- API versions below 40.0 lack modern feature support\n' +
    '- API versions 21.0-30.0 are retiring in June 2025\n' +
    '- Newer versions provide better error messages and performance\n' +
    '- Ensures compatibility with Lightning Experience\n' +
    '\n' +
    'To update your API version, modify your sfdx-project.json:\n' +
    `"sourceApiVersion": "${RECOMMENDED_API_VERSION}"`
  );
}
