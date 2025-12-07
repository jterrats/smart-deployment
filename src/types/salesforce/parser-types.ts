/**
 * Parser-friendly types for Salesforce metadata
 *
 * These types are more permissive than the strict metadata types,
 * allowing parsers to handle unknown/future metadata types gracefully.
 *
 * @module types/salesforce/parser-types
 */

import type {
  FlowMetadata,
  LWCMetadata,
  AuraComponentMetadata,
  ApexClassMetadata,
  ApexTriggerMetadata,
  CustomObjectMetadata,
} from './index.js';

/**
 * Parser-safe Flow metadata
 * Allows unknown processType values for forward compatibility
 */
export type ParsedFlowMetadata = Omit<Partial<FlowMetadata>, 'processType' | 'status'> & {
  label: string;
  processType: string; // Accept any string, not just known types
  status: string; // Accept any string
};

/**
 * Parser-safe LWC metadata
 * Allows unknown target values
 */
export type ParsedLWCMetadata = Omit<Partial<LWCMetadata>, 'targets'> & {
  apiVersion: string;
  isExposed: boolean;
  targets?: {
    target: string[]; // Accept any target string
  };
};

/**
 * Parser-safe Aura metadata
 * Allows unknown access levels
 */
export type ParsedAuraMetadata = Partial<AuraComponentMetadata> & {
  apiVersion?: string;
  access?: string; // Accept any access level
};

/**
 * Parser-safe Apex metadata
 * Allows unknown status values
 */
export type ParsedApexClassMetadata = Omit<Partial<ApexClassMetadata>, 'status'> & {
  apiVersion: string;
  status: string; // Accept any status
};

export type ParsedApexTriggerMetadata = Omit<Partial<ApexTriggerMetadata>, 'status'> & {
  apiVersion: string;
  status: string; // Accept any status
};

/**
 * Parser-safe Custom Object metadata
 * Allows unknown deployment status and sharing models
 */
export type ParsedCustomObjectMetadata = Omit<Partial<CustomObjectMetadata>, 'deploymentStatus' | 'sharingModel'> & {
  label: string;
  pluralLabel: string;
  deploymentStatus?: string; // Accept any deployment status
  sharingModel?: string; // Accept any sharing model
};

/**
 * Type guard helpers for safe type narrowing
 */

export function isKnownFlowProcessType(type: string): boolean {
  const knownTypes = [
    'AutoLaunchedFlow',
    'Flow',
    'Workflow',
    'CustomEvent',
    'InvocableProcess',
    'LoginFlow',
    'ActionPlan',
    // Add all known types
  ];
  return knownTypes.includes(type);
}

export function isKnownFlowStatus(status: string): boolean {
  return ['Active', 'Draft', 'Obsolete', 'InvalidDraft'].includes(status);
}

export function isKnownApexStatus(status: string): boolean {
  return ['Active', 'Inactive', 'Deleted'].includes(status);
}

export function isKnownAuraAccess(access: string): boolean {
  return ['GLOBAL', 'PUBLIC', 'PRIVATE', 'INTERNAL'].includes(access);
}

export function isKnownLWCTarget(target: string): boolean {
  const knownTargets = [
    'lightning__AppPage',
    'lightning__HomePage',
    'lightning__RecordPage',
    'lightning__RecordAction',
    'lightning__FlowScreen',
    // Add all known targets
  ];
  return knownTargets.includes(target);
}

/**
 * Validation helpers that log warnings for unknown values
 * but don't throw errors
 */

export function validateFlowMetadata(parsed: ParsedFlowMetadata): FlowMetadata {
  if (!isKnownFlowProcessType(parsed.processType)) {
    // Note: In production, replace with proper logger
    // logger.warn(`[FlowParser] Unknown processType: ${parsed.processType}. This might be a new Salesforce feature. Proceeding anyway...`);
  }

  if (parsed.status && !isKnownFlowStatus(parsed.status)) {
    // Note: In production, replace with proper logger
    // logger.warn(`[FlowParser] Unknown status: ${parsed.status}. Proceeding anyway...`);
  }

  // Cast to strict type after validation
  return parsed as unknown as FlowMetadata;
}

export function validateLWCMetadata(parsed: ParsedLWCMetadata): LWCMetadata {
  if (parsed.targets?.target) {
    const unknownTargets = parsed.targets.target.filter((t) => !isKnownLWCTarget(t));
    if (unknownTargets.length > 0) {
      // Note: In production, replace with proper logger
      // logger.warn(`[LWCParser] Unknown targets: ${unknownTargets.join(', ')}. These might be new Salesforce features. Proceeding anyway...`);
    }
  }

  return parsed as unknown as LWCMetadata;
}

/**
 * Helper to safely parse unknown metadata
 * Returns a generic Record if the metadata type is completely unknown
 */
export type UnknownMetadata = Record<string, unknown>;

export function parseUnknownMetadata(xmlContent: string, metadataType: string): UnknownMetadata {
  // Note: In production, replace with proper logger
  // logger.warn(`[Parser] No specific parser for metadata type: ${metadataType}. Parsing as generic metadata. Consider adding a parser for this type.`);

  // Return a generic object that can hold any properties
  return {
    _metadataType: metadataType,
    _rawContent: xmlContent,
  };
}
