/**
 * Type definitions for Salesforce Resource metadata
 * Represents StaticResource, CustomLabel, and related metadata structures
 */

/**
 * Static Resource metadata (.resource-meta.xml)
 */
export type StaticResourceMetadata = {
  cacheControl: StaticResourceCacheControl;
  contentType: string;
  description?: string;
};

/**
 * Static Resource Cache Control
 */
export type StaticResourceCacheControl = 'Private' | 'Public';

/**
 * Custom Labels metadata (CustomLabels.labels-meta.xml)
 */
export type CustomLabelsMetadata = {
  labels: CustomLabel[];
};

/**
 * Custom Label
 */
export type CustomLabel = {
  fullName: string;
  categories?: string;
  language: string;
  protected: boolean;
  shortDescription: string;
  value: string;
};

/**
 * Custom Label language codes
 */
export type CustomLabelLanguage =
  | 'en_US'
  | 'de'
  | 'es'
  | 'fr'
  | 'it'
  | 'ja'
  | 'sv'
  | 'ko'
  | 'zh_TW'
  | 'zh_CN'
  | 'pt_BR'
  | 'nl_NL'
  | 'da'
  | 'th'
  | 'fi'
  | 'ru'
  | 'es_MX'
  | 'no';

/**
 * Document metadata (for Document folder)
 */
export type DocumentMetadata = {
  description?: string;
  internalUseOnly: boolean;
  keywords?: string;
  name: string;
  public: boolean;
};

/**
 * Content Asset metadata
 */
export type ContentAssetMetadata = {
  format?: ContentAssetFormat;
  isVisibleByExternalUsers?: boolean;
  language: string;
  masterLabel: string;
  relationships?: ContentAssetRelationships;
  versions?: ContentAssetVersions;
};

/**
 * Content Asset Format
 */
export type ContentAssetFormat = 'Original' | 'ZippedVersions';

/**
 * Content Asset Relationships
 */
export type ContentAssetRelationships = {
  emailTemplate?: ContentAssetLink[];
  insightType?: ContentAssetLink[];
  organization?: ContentAssetLink[];
  userEmailPreferredPerson?: ContentAssetLink[];
  workspace?: ContentAssetLink[];
};

/**
 * Content Asset Link
 */
export type ContentAssetLink = {
  cascade?: boolean;
  name: string;
};

/**
 * Content Asset Versions
 */
export type ContentAssetVersions = {
  version: ContentAssetVersion[];
};

/**
 * Content Asset Version
 */
export type ContentAssetVersion = {
  number: string;
  pathOnClient: string;
  zipEntry?: string;
};
