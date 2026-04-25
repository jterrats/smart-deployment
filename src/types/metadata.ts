/**
 * Core Salesforce Metadata Types
 *
 * This union defines the most common metadata types (~78).
 * Salesforce has 100+ types total and adds more each release.
 *
 * **Extensibility**: Runtime code handles unknown types via fallback logic.
 * See: src/constants/deployment-order.ts (priority 99 for unknown types)
 *
 * @see https://developer.salesforce.com/docs/metadata-coverage/61
 */

export type MetadataType =
  // Tier 0: Global Configuration & Translations
  | 'GlobalValueSet'
  | 'StandardValueSet'
  | 'CustomLabels'
  | 'Translations'
  | 'StandardValueSetTranslation'
  // Tier 1: Foundation
  | 'CustomObject'
  | 'CustomSetting'
  | 'DataCategoryGroup'
  | 'CustomMetadata'
  | 'CustomMetadataRecord'
  | 'CustomField'
  | 'ObjectTranslation'
  | 'RecordType'
  | 'BusinessProcess'
  | 'ValidationRule'
  | 'WorkflowRule'
  // Tier 2: Security Foundation
  | 'OrgSettings'
  | 'CorsWhitelistOrigin'
  | 'CspTrustedSite'
  | 'Role'
  | 'DelegateGroup'
  | 'Group'
  | 'CustomPermission'
  | 'ExternalCredential'
  | 'NamedCredential'
  | 'DataSourceObject'
  // Tier 3: Code & Resources
  | 'StaticResource'
  | 'Document'
  | 'ContentAsset'
  | 'EmailTemplate'
  | 'ApexClass'
  | 'VisualforceComponent'
  | 'VisualforcePage'
  | 'LightningComponentBundle'
  | 'AuraDefinitionBundle'
  | 'ApexTrigger'
  // Tier 4: Service Cloud
  | 'ServicePresenceStatus'
  | 'PresenceUserConfig'
  | 'Queue'
  | 'ServiceChannel'
  | 'QueueRoutingConfig'
  | 'ChannelLayout'
  // Tier 5: Business Logic
  | 'MilestoneType'
  | 'EntitlementProcess'
  | 'GenAiFunction'
  | 'GenAiPromptTemplate'
  | 'GenAiPlannerBundle'
  | 'Flow'
  | 'PathAssistant'
  // Tier 6: UI
  | 'Layout'
  | 'Bot'
  | 'BotVersion'
  | 'GenAiPlugin'
  | 'FlexiPage'
  | 'QuickAction'
  | 'CompactLayout'
  | 'ListView'
  | 'WebLink'
  | 'LightningApp'
  | 'SearchCustomization'
  | 'CustomNotificationType'
  // Tier 7: Experience Cloud
  | 'BrandingSet'
  | 'DigitalExperienceConfig'
  | 'Site'
  | 'DigitalExperience'
  | 'NetworkBranding'
  | 'Network'
  | 'EmbeddedServiceConfig'
  | 'MessagingChannel'
  // Tier 8: Advanced
  | 'OmniSupervisorConfig'
  // Tier 9: Security & Access
  | 'SharingRules'
  | 'PermissionSet'
  | 'MutingPermissionSet'
  | 'PermissionSetGroup'
  | 'Profile'
  // Tier 10: Testing
  | 'ApexTestSuite'
  | 'DataPackageKitDefinition'
  | 'DataPackageKitObject';

export type MetadataDependencyKind = 'hard' | 'soft' | 'inferred';

export type MetadataDependencyReference = {
  /** Target node ID in the graph, e.g. Type:Name */
  nodeId: string;
  /** Relationship strength */
  kind: MetadataDependencyKind;
  /** Provenance of the dependency */
  source?: 'parser' | 'ai' | 'manual' | 'merged';
  /** Optional explanation */
  reason?: string;
  /** Optional confidence for inferred dependencies */
  confidence?: number;
};

/**
 * Base interface for all metadata components
 */
export type MetadataComponent = {
  /** Component name (e.g., "SC_Account_Service") */
  name: string;
  /** Metadata type */
  type: MetadataType;
  /** File path relative to project root */
  filePath: string;
  /** Set of dependencies (node IDs: "Type:Name") */
  dependencies: Set<string>;
  /** Structured dependency metadata preserving strength/source */
  dependencyDetails?: MetadataDependencyReference[];
  /** Set of optional/soft dependencies (subset of dependencies) */
  optionalDependencies?: Set<string>;
  /** Set of dependents (node IDs) */
  dependents: Set<string>;
  /** Priority boost for heuristics (negative = deploy earlier) */
  priorityBoost: number;
};

/**
 * Specialized metadata types
 */

export type ApexClass = MetadataComponent & {
  type: 'ApexClass';
  isTest: boolean;
  isUtility: boolean;
  isHandler: boolean;
  isService: boolean;
  isIntegration: boolean;
};

export type ApexTrigger = MetadataComponent & {
  type: 'ApexTrigger';
  sobject: string;
  handlerClass?: string;
};

export type Flow = MetadataComponent & {
  type: 'Flow';
  referencedApexClasses: string[];
  referencedPromptTemplates: string[];
  referencedFlows: string[];
};

export type LightningComponentBundle = MetadataComponent & {
  type: 'LightningComponentBundle';
  referencedApexClasses: string[];
  referencedLwcs: string[];
  referencedSobjects: string[];
};

export type PermissionSet = MetadataComponent & {
  type: 'PermissionSet';
  apexClasses: string[];
  flows: string[];
  customObjects: string[];
  customPermissions: string[];
};

export type CustomObject = MetadataComponent & {
  type: 'CustomObject';
  isCustomMetadataType: boolean;
};

export type CustomMetadataRecord = MetadataComponent & {
  type: 'CustomMetadataRecord';
  metadataTypeName: string;
};

/**
 * Archivo de metadata físico en el proyecto
 */
export type ComponentFile = {
  /** Path absoluto al archivo */
  path: string;
  /** Nombre del archivo */
  fileName: string;
  /** Tipo de metadata inferido del path */
  metadataType: MetadataType;
  /** Contenido del archivo (puede ser lazy-loaded) */
  content?: string;
};

/**
 * Resultado del parsing de un componente
 */
export type ParseResult<T extends MetadataComponent> = {
  component: T;
  errors: ParseError[];
};

/**
 * Error durante el parsing
 */
export type ParseError = {
  file: string;
  message: string;
  severity: 'warning' | 'error';
  line?: number;
};
