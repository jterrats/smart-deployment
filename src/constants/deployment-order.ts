/**
 * Salesforce Metadata Deployment Order
 *
 * Defines recommended deployment order for CORE Salesforce metadata types.
 *
 * **Important**: Salesforce has 100+ metadata types and adds new ones each release.
 * This file defines priorities for the MOST COMMON types (~78).
 * For unlisted types, the plugin uses a fallback priority (99) via getDeploymentPriority().
 *
 * **Extensibility Strategy**:
 * - Add new types here as needed (e.g., new Einstein features)
 * - Unknown types automatically get priority 99 (deploy last, safe default)
 * - Plugin works with ANY metadata type, even if not listed here
 *
 * Lower numbers = deploy first
 * Higher numbers = deploy later
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm
 * @see https://help.salesforce.com/s/articleView?id=000386798&type=1
 */

import type { MetadataType } from '../types/metadata.js';

/**
 * Deployment priority map for all Salesforce metadata types.
 * Follows the principle: dependencies first, dependents later.
 *
 * Priority Groups:
 * - 1-9: Core data model (objects, fields, record types)
 * - 10-19: Code (Apex classes, pages, components)
 * - 20-29: Automation (triggers, flows, process builders)
 * - 30-39: UI & Experiences (layouts, pages, sites)
 * - 40-49: Security & Access (profiles, permission sets, sharing)
 * - 50-59: Integration & External (connected apps, named credentials)
 * - 60-69: Content & Knowledge
 * - 70-79: Analytics & Reporting
 * - 80-89: Other metadata
 * - 90-99: Post-deployment (translations, static resources)
 */
export const DEPLOYMENT_ORDER: Readonly<Record<MetadataType, number>> = Object.freeze({
  // ========== Tier 0: Global Configuration (1-5) ==========
  GlobalValueSet: 1, // Global value sets used by picklists
  StandardValueSet: 2, // Standard value sets
  CustomLabels: 3, // Custom labels
  Translations: 4, // Translation files
  StandardValueSetTranslation: 5, // Standard value set translations

  // ========== Tier 1: Foundation - Objects & Fields (6-15) ==========
  CustomObject: 6, // Core data model - must be early
  CustomSetting: 7, // Custom settings (like custom objects)
  DataCategoryGroup: 8, // Data category groups
  CustomMetadata: 9, // Custom metadata types
  CustomMetadataRecord: 10, // Custom metadata records
  CustomField: 11, // Fields depend on objects
  ObjectTranslation: 12, // Object translations
  RecordType: 13, // Record types depend on objects/fields
  BusinessProcess: 14, // Business processes depend on record types
  ValidationRule: 15, // Validation rules depend on fields
  WorkflowRule: 16, // Workflow rules

  // ========== Tier 2: Security Foundation (17-23) ==========
  OrgSettings: 17, // Org-wide settings
  CorsWhitelistOrigin: 18, // CORS settings
  CspTrustedSite: 19, // CSP trusted sites
  Role: 20, // Role hierarchy
  DelegateGroup: 21, // Delegate groups
  Group: 22, // Public groups
  CustomPermission: 23, // Custom permissions
  ExternalCredential: 24, // External credentials
  NamedCredential: 25, // Named credentials for callouts
  DataSourceObject: 26, // Data source objects

  // ========== Tier 3: Code & Resources (27-36) ==========
  StaticResource: 27, // Static resources
  Document: 28, // Documents
  ContentAsset: 29, // Content assets
  EmailTemplate: 30, // Email templates
  ApexClass: 31, // Apex classes - deploy before triggers
  VisualforceComponent: 32, // VF components
  VisualforcePage: 33, // VF pages
  LightningComponentBundle: 34, // LWC
  AuraDefinitionBundle: 35, // Aura components
  ApexTrigger: 36, // Triggers after classes

  // ========== Tier 4: Service Cloud (37-42) ==========
  ServicePresenceStatus: 37, // Service presence
  PresenceUserConfig: 38, // Presence config
  Queue: 39, // Queues
  ServiceChannel: 40, // Service channels
  QueueRoutingConfig: 41, // Queue routing
  ChannelLayout: 42, // Channel layouts

  // ========== Tier 5: Business Logic & AI (43-49) ==========
  MilestoneType: 43, // Milestone types
  EntitlementProcess: 44, // Entitlement processes
  GenAiFunction: 45, // Einstein AI functions
  GenAiPromptTemplate: 46, // Einstein prompts
  GenAiPlannerBundle: 47, // Einstein planners
  Flow: 48, // Flows (after Apex classes)
  PathAssistant: 49, // Path assistant

  // ========== Tier 6: UI Components (50-59) ==========
  Layout: 50, // Page layouts
  Bot: 51, // Einstein Bots
  BotVersion: 52, // Bot versions
  GenAiPlugin: 53, // Einstein plugins
  FlexiPage: 54, // Lightning pages
  QuickAction: 55, // Quick actions
  CompactLayout: 56, // Compact layouts
  ListView: 57, // List views
  WebLink: 58, // Web links
  LightningApp: 59, // Lightning apps
  SearchCustomization: 60, // Search customizations
  CustomNotificationType: 61, // Custom notifications

  // ========== Tier 7: Experience Cloud (62-69) ==========
  BrandingSet: 62, // Branding sets
  DigitalExperienceConfig: 63, // Digital experience config
  Site: 64, // Sites
  DigitalExperience: 65, // Digital experiences
  NetworkBranding: 66, // Network branding
  Network: 67, // Networks (communities)
  EmbeddedServiceConfig: 68, // Embedded service
  MessagingChannel: 69, // Messaging channels

  // ========== Tier 8: Advanced Configurations (70-74) ==========
  OmniSupervisorConfig: 70, // Omni supervisor

  // ========== Tier 9: Security & Access - LAST (75-79) ==========
  SharingRules: 75, // Sharing rules after everything
  PermissionSet: 76, // Permission sets
  MutingPermissionSet: 77, // Muting permission sets
  PermissionSetGroup: 78, // Permission set groups
  Profile: 79, // Profiles LAST (reference everything)

  // ========== Tier 10: Testing & Data Packages (80-82) ==========
  ApexTestSuite: 80, // Test suites
  DataPackageKitDefinition: 81, // Data package kits
  DataPackageKitObject: 82, // Data package kit objects
});

/**
 * Get deployment priority for a given metadata type.
 *
 * **Extensibility**: Returns 99 for unknown/new metadata types (safe fallback).
 * This ensures the plugin works with future Salesforce metadata types without updates.
 *
 * @param metadataType - The Salesforce metadata type
 * @returns Priority number (1-99), or 99 (lowest priority) if type is unknown
 *
 * @example
 * ```typescript
 * const priority = getDeploymentPriority('CustomObject'); // 6
 * const priority2 = getDeploymentPriority('ApexClass'); // 31
 * const unknown = getDeploymentPriority('UnknownNewType'); // 99 (safe fallback)
 * ```
 */
export function getDeploymentPriority(metadataType: MetadataType): number {
  return DEPLOYMENT_ORDER[metadataType] ?? 99; // Fallback for unknown/future types
}

/**
 * Sort metadata components by deployment priority.
 *
 * @param components - Array of metadata type names
 * @returns Sorted array (lowest priority number first = deploy first)
 *
 * @example
 * ```typescript
 * const sorted = sortByDeploymentOrder(['ApexClass', 'CustomObject', 'Flow']);
 * // Result: ['CustomObject', 'ApexClass', 'Flow']
 * ```
 */
export function sortByDeploymentOrder(components: MetadataType[]): MetadataType[] {
  return [...components].sort((a, b) => getDeploymentPriority(a) - getDeploymentPriority(b));
}
