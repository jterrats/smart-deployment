import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import { parseXml } from '../utils/xml.js';
import type {
  CustomObjectMetadata,
  CustomField,
  ValidationRule,
  RecordType,
  ListView,
  ActionOverride,
  FieldSet,
  SharingReason,
  SharingRecalculation,
  WebLink,
} from '../types/salesforce/object.js';
import { normalizeOptionalArray } from './parser-utils.js';

const logger = getLogger('CustomObjectParser');

/**
 * Custom object dependency types
 */
export type CustomObjectDependencyType =
  | 'lookup_field'
  | 'master_detail_field'
  | 'formula_field'
  | 'validation_rule'
  | 'workflow_rule'
  | 'apex_class'
  | 'record_type'
  | 'custom_field';

/**
 * Represents a dependency found in a custom object
 */
export type CustomObjectDependency = {
  type: CustomObjectDependencyType;
  name: string;
  referencedObject?: string;
  fieldName?: string;
};

/**
 * Sharing rule metadata (for parsing)
 */
export type SharingRule = {
  fullName: string;
  accessLevel: string;
  sharedTo?: {
    group?: string;
    role?: string;
    roleAndSubordinates?: string;
  };
};

/**
 * Result of parsing a custom object
 * Extends CustomObjectMetadata with parsed dependencies
 * Ensures arrays are always defined (never undefined)
 */
export type CustomObjectParseResult = Omit<
  CustomObjectMetadata,
  'fields' | 'validationRules' | 'recordTypes' | 'listViews'
> & {
  fields: CustomField[];
  validationRules: ValidationRule[];
  recordTypes: RecordType[];
  listViews: ListView[];
  sharingRules: SharingRule[];
  dependencies: CustomObjectDependency[];
};

type CustomObjectBaseSections = {
  fields: CustomField[];
  validationRules: ValidationRule[];
  recordTypes: RecordType[];
  listViews: ListView[];
};

type ParsedCustomObjectXml = {
  parsedRoot: Record<string, unknown>;
  customObjectNode: Record<string, unknown>;
};

type CustomObjectFieldSections = {
  fields?: CustomField[];
  fieldSets?: FieldSet[];
  nameField?: CustomField;
};

type CustomObjectRelationshipSettings = {
  compactLayoutAssignment?: string;
  enableEnhancedLookup?: boolean;
  externalSharingModel?: CustomObjectMetadata['externalSharingModel'];
  sharingModel?: CustomObjectMetadata['sharingModel'];
  sharingReasons?: SharingReason[];
  sharingRecalculations?: SharingRecalculation[];
};

type CustomObjectValidationAndExternalSettings = {
  actionOverrides?: ActionOverride[];
  customHelpPage?: string;
  enableActivities?: boolean;
  enableBulkApi?: boolean;
  enableChangeDataCapture?: boolean;
  enableFeeds?: boolean;
  enableHistory?: boolean;
  enableReports?: boolean;
  enableSearch?: boolean;
  enableSharing?: boolean;
  enableStreamingApi?: boolean;
  listViews?: ListView[];
  recordTypes?: RecordType[];
  validationRules?: ValidationRule[];
  webLinks?: WebLink[];
};

/**
 * Extract object references from formula
 *
 * @ac US-020-AC-3: Extract formula field dependencies
 */
function extractFormulaReferences(formula: string): string[] {
  const references = new Set<string>();

  // Pattern: ObjectName.FieldName or $ObjectType.ObjectName
  const objectPattern = /\b([A-Z][a-zA-Z0-9_]*)\./g;
  const matches = formula.matchAll(objectPattern);

  for (const match of matches) {
    const objectName = match[1];
    // Skip common formula functions
    if (
      !['IF', 'AND', 'OR', 'NOT', 'CASE', 'TEXT', 'VALUE', 'DATE', 'DATEVALUE', 'NOW', 'TODAY'].includes(objectName)
    ) {
      references.add(objectName);
    }
  }

  // Also check for $ObjectType references
  const objectTypePattern = /\$ObjectType\.([a-zA-Z][a-zA-Z0-9_]*)/g;
  const objectTypeMatches = formula.matchAll(objectTypePattern);

  for (const match of objectTypeMatches) {
    references.add(match[1]);
  }

  return [...references];
}

function sanitizeFormula(formula: string): string {
  return formula.replace(/"[^"]*"|'[^']*'/g, ' ');
}

function createRelationshipFieldMap(
  fields: CustomField[]
): Map<string, { fieldName: string; referencedObjects: string[] }> {
  const relationshipFieldMap = new Map<string, { fieldName: string; referencedObjects: string[] }>();

  for (const field of fields) {
    if (!field.referenceTo || field.referenceTo.length === 0) {
      continue;
    }

    const keys = new Set<string>();
    keys.add(field.fullName);

    if (field.fullName.endsWith('__c')) {
      keys.add(`${field.fullName.slice(0, -3)}__r`);
    }

    if (field.relationshipName) {
      keys.add(field.relationshipName);
    }

    for (const key of keys) {
      relationshipFieldMap.set(key, {
        fieldName: field.fullName,
        referencedObjects: field.referenceTo,
      });
    }
  }

  return relationshipFieldMap;
}

function resolveFormulaReferences(formula: string, fields: CustomField[]): string[] {
  const rawReferences = extractFormulaReferences(formula);
  const relationshipFieldMap = createRelationshipFieldMap(fields);
  const resolved = new Set<string>();

  for (const rawReference of rawReferences) {
    const relationship = relationshipFieldMap.get(rawReference);
    if (relationship) {
      for (const referencedObject of relationship.referencedObjects) {
        resolved.add(referencedObject);
      }
      continue;
    }

    resolved.add(rawReference);
  }

  return [...resolved];
}

function extractCustomFieldReferences(formula: string, fields: CustomField[], currentFieldName?: string): string[] {
  const sanitizedFormula = sanitizeFormula(formula);
  const customFieldNames = new Set(fields.map((field) => field.fullName));
  const relationshipFieldMap = createRelationshipFieldMap(fields);
  const references = new Set<string>();

  const directFieldPattern = /\b([a-zA-Z][a-zA-Z0-9_]*__c)\b/g;
  for (const match of sanitizedFormula.matchAll(directFieldPattern)) {
    const fieldName = match[1];
    if (fieldName !== currentFieldName && customFieldNames.has(fieldName)) {
      references.add(fieldName);
    }
  }

  const relationshipPattern = /\b([a-zA-Z][a-zA-Z0-9_]*__r)\./g;
  for (const match of sanitizedFormula.matchAll(relationshipPattern)) {
    const relationshipName = match[1];
    const fieldReference = relationshipFieldMap.get(relationshipName)?.fieldName;
    if (fieldReference && fieldReference !== currentFieldName) {
      references.add(fieldReference);
    }
  }

  return [...references];
}

/**
 * Extract Apex class references from validation rules
 *
 * @ac US-020-AC-5: Extract Apex class references in formulas
 */
function extractApexReferences(formula: string): string[] {
  const apexClasses = new Set<string>();

  // Pattern: ClassName.methodName() or @RemoteAction patterns
  const apexPattern = /\b([A-Z][a-zA-Z0-9_]*)\.[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
  const matches = formula.matchAll(apexPattern);

  for (const match of matches) {
    apexClasses.add(match[1]);
  }

  return [...apexClasses];
}

/**
 * Extract sharing rules from metadata
 *
 * @ac US-020-AC-7: Extract sharing rules
 */
function extractSharingRules(metadata: Record<string, unknown>): SharingRule[] {
  const sharingRules: SharingRule[] = [];

  const sharingObj = metadata.sharingRules as Record<string, unknown> | undefined;
  if (!sharingObj) {
    return sharingRules;
  }

  // Sharing rules can be criteriaBasedRules or ownerRules
  const criteriaRules = sharingObj.criteriaBasedRules;
  const ownerRules = sharingObj.ownerRules;

  if (criteriaRules) {
    const criteriaList = Array.isArray(criteriaRules) ? criteriaRules : [criteriaRules];
    for (const rule of criteriaList) {
      const criteriaRule = rule as Record<string, unknown>;
      const sharingRule: SharingRule = {
        fullName: (criteriaRule.fullName as string) ?? '',
        accessLevel: (criteriaRule.accessLevel as string) ?? '',
        sharedTo: criteriaRule.sharedTo as SharingRule['sharedTo'],
      };
      sharingRules.push(sharingRule);
    }
  }

  if (ownerRules) {
    const ownerList = Array.isArray(ownerRules) ? ownerRules : [ownerRules];
    for (const rule of ownerList) {
      const ownerRule = rule as Record<string, unknown>;
      const sharingRule: SharingRule = {
        fullName: (ownerRule.fullName as string) ?? '',
        accessLevel: (ownerRule.accessLevel as string) ?? '',
        sharedTo: ownerRule.sharedTo as SharingRule['sharedTo'],
      };
      sharingRules.push(sharingRule);
    }
  }

  return sharingRules;
}

function extractBaseSections(metadata: CustomObjectMetadata): CustomObjectBaseSections {
  return {
    fields: metadata.fields ?? [],
    validationRules: metadata.validationRules ?? [],
    recordTypes: metadata.recordTypes ?? [],
    listViews: metadata.listViews ?? [],
  };
}

function extractFieldDependencies(fields: CustomField[]): CustomObjectDependency[] {
  const dependencies: CustomObjectDependency[] = [];

  for (const field of fields) {
    if (field.referenceTo && (field.type === 'Lookup' || field.type === 'MasterDetail')) {
      for (const referencedObject of field.referenceTo) {
        dependencies.push({
          type: field.type === 'MasterDetail' ? 'master_detail_field' : 'lookup_field',
          name: field.fullName,
          referencedObject,
          fieldName: field.fullName,
        });
      }
    }

    if (field.formula) {
      const formulaRefs = resolveFormulaReferences(field.formula, fields);
      for (const referencedObject of formulaRefs) {
        dependencies.push({
          type: 'formula_field',
          name: field.fullName,
          referencedObject,
          fieldName: field.fullName,
        });
      }

      const apexRefs = extractApexReferences(field.formula);
      for (const apexClass of apexRefs) {
        dependencies.push({
          type: 'apex_class',
          name: apexClass,
          fieldName: field.fullName,
        });
      }

      const customFieldRefs = extractCustomFieldReferences(field.formula, fields, field.fullName);
      for (const customFieldRef of customFieldRefs) {
        dependencies.push({
          type: 'custom_field',
          name: customFieldRef,
          fieldName: customFieldRef,
        });
      }
    }

    if (field.type === 'Summary') {
      if (field.summaryForeignKey) {
        dependencies.push({
          type: 'custom_field',
          name: field.summaryForeignKey,
          fieldName: field.summaryForeignKey,
        });
      }

      if (field.summarizedField) {
        dependencies.push({
          type: 'custom_field',
          name: field.summarizedField,
          fieldName: field.summarizedField,
        });
      }
    }
  }

  return dependencies;
}

function extractValidationRuleDependencies(
  validationRules: ValidationRule[],
  fields: CustomField[]
): CustomObjectDependency[] {
  const dependencies: CustomObjectDependency[] = [];

  for (const rule of validationRules) {
    if (!rule.errorConditionFormula) {
      continue;
    }

    const formulaRefs = resolveFormulaReferences(rule.errorConditionFormula, fields);
    for (const referencedObject of formulaRefs) {
      dependencies.push({
        type: 'validation_rule',
        name: rule.fullName,
        referencedObject,
      });
    }

    const apexRefs = extractApexReferences(rule.errorConditionFormula);
    for (const apexClass of apexRefs) {
      dependencies.push({
        type: 'apex_class',
        name: apexClass,
      });
    }

    const customFieldRefs = extractCustomFieldReferences(rule.errorConditionFormula, fields);
    for (const customFieldRef of customFieldRefs) {
      dependencies.push({
        type: 'custom_field',
        name: customFieldRef,
        fieldName: customFieldRef,
      });
    }
  }

  return dependencies;
}

function extractRecordTypeDependencies(recordTypes: RecordType[]): CustomObjectDependency[] {
  return recordTypes.map((recordType) => ({
    type: 'record_type',
    name: recordType.fullName,
  }));
}

function buildDependencies(
  fields: CustomField[],
  validationRules: ValidationRule[],
  recordTypes: RecordType[]
): CustomObjectDependency[] {
  return [
    ...extractFieldDependencies(fields),
    ...extractValidationRuleDependencies(validationRules, fields),
    ...extractRecordTypeDependencies(recordTypes),
  ];
}

async function parseCustomObjectXml(metadataContent: string): Promise<ParsedCustomObjectXml> {
  const parsed = await parseXml(metadataContent);
  const parsedRoot = parsed as Record<string, unknown>;
  const customObjectNode = (parsedRoot.CustomObject as Record<string, unknown>) || parsedRoot;

  return { parsedRoot, customObjectNode };
}

function warnOnMissingRequiredMetadata(customObjectNode: Record<string, unknown>): void {
  if (!customObjectNode.label || !customObjectNode.pluralLabel) {
    logger.warn('Missing required fields in custom object metadata', {
      hasLabel: Boolean(customObjectNode.label),
      hasPluralLabel: Boolean(customObjectNode.pluralLabel),
      parsedKeys: Object.keys(customObjectNode),
    });
  }
}

function normalizeReferenceTargets(referenceTo: string | string[] | undefined): string[] | undefined {
  if (!referenceTo) {
    return undefined;
  }

  return Array.isArray(referenceTo) ? referenceTo : [referenceTo];
}

function normalizeFieldReferences(fields?: CustomField[]): CustomField[] | undefined {
  return fields?.map((field) => ({
    ...field,
    referenceTo: normalizeReferenceTargets(field.referenceTo),
  }));
}

function extractFieldSections(customObjectNode: Record<string, unknown>): CustomObjectFieldSections {
  return {
    fields: normalizeFieldReferences(
      normalizeOptionalArray(customObjectNode.fields as CustomField | CustomField[] | undefined)
    ),
    fieldSets: normalizeOptionalArray(customObjectNode.fieldSets as FieldSet | FieldSet[] | undefined),
    nameField: customObjectNode.nameField as CustomField | undefined,
  };
}

function extractRelationshipSettings(customObjectNode: Record<string, unknown>): CustomObjectRelationshipSettings {
  return {
    compactLayoutAssignment: customObjectNode.compactLayoutAssignment as string | undefined,
    enableEnhancedLookup: customObjectNode.enableEnhancedLookup as boolean | undefined,
    externalSharingModel: customObjectNode.externalSharingModel as CustomObjectMetadata['externalSharingModel'],
    sharingModel: customObjectNode.sharingModel as CustomObjectMetadata['sharingModel'],
    sharingReasons: normalizeOptionalArray(
      customObjectNode.sharingReasons as SharingReason | SharingReason[] | undefined
    ),
    sharingRecalculations: normalizeOptionalArray(
      customObjectNode.sharingRecalculations as SharingRecalculation | SharingRecalculation[] | undefined
    ),
  };
}

function extractValidationAndExternalSettings(
  customObjectNode: Record<string, unknown>
): CustomObjectValidationAndExternalSettings {
  return {
    actionOverrides: normalizeOptionalArray(
      customObjectNode.actionOverrides as ActionOverride | ActionOverride[] | undefined
    ),
    customHelpPage: customObjectNode.customHelpPage as string | undefined,
    enableActivities: customObjectNode.enableActivities as boolean | undefined,
    enableBulkApi: customObjectNode.enableBulkApi as boolean | undefined,
    enableChangeDataCapture: customObjectNode.enableChangeDataCapture as boolean | undefined,
    enableFeeds: customObjectNode.enableFeeds as boolean | undefined,
    enableHistory: customObjectNode.enableHistory as boolean | undefined,
    enableReports: customObjectNode.enableReports as boolean | undefined,
    enableSearch: customObjectNode.enableSearch as boolean | undefined,
    enableSharing: customObjectNode.enableSharing as boolean | undefined,
    enableStreamingApi: customObjectNode.enableStreamingApi as boolean | undefined,
    listViews: normalizeOptionalArray(customObjectNode.listViews as ListView | ListView[] | undefined),
    recordTypes: normalizeOptionalArray(customObjectNode.recordTypes as RecordType | RecordType[] | undefined),
    validationRules: normalizeOptionalArray(
      customObjectNode.validationRules as ValidationRule | ValidationRule[] | undefined
    ),
    webLinks: normalizeOptionalArray(customObjectNode.webLinks as WebLink | WebLink[] | undefined),
  };
}

function assembleCustomObjectMetadata(
  customObjectNode: Record<string, unknown>,
  fieldSections: CustomObjectFieldSections,
  relationshipSettings: CustomObjectRelationshipSettings,
  validationAndExternalSettings: CustomObjectValidationAndExternalSettings
): CustomObjectMetadata {
  return {
    label: (customObjectNode.label as string) ?? '',
    pluralLabel: (customObjectNode.pluralLabel as string) ?? '',
    actionOverrides: validationAndExternalSettings.actionOverrides,
    allowInChatterGroups: customObjectNode.allowInChatterGroups as boolean | undefined,
    compactLayoutAssignment: relationshipSettings.compactLayoutAssignment,
    customHelpPage: validationAndExternalSettings.customHelpPage,
    deploymentStatus: customObjectNode.deploymentStatus as CustomObjectMetadata['deploymentStatus'],
    deprecated: customObjectNode.deprecated as boolean | undefined,
    description: customObjectNode.description as string | undefined,
    enableActivities: validationAndExternalSettings.enableActivities,
    enableBulkApi: validationAndExternalSettings.enableBulkApi,
    enableChangeDataCapture: validationAndExternalSettings.enableChangeDataCapture,
    enableEnhancedLookup: relationshipSettings.enableEnhancedLookup,
    enableFeeds: validationAndExternalSettings.enableFeeds,
    enableHistory: validationAndExternalSettings.enableHistory,
    enableReports: validationAndExternalSettings.enableReports,
    enableSearch: validationAndExternalSettings.enableSearch,
    enableSharing: validationAndExternalSettings.enableSharing,
    enableStreamingApi: validationAndExternalSettings.enableStreamingApi,
    externalSharingModel: relationshipSettings.externalSharingModel,
    fields: fieldSections.fields,
    fieldSets: fieldSections.fieldSets,
    gender: customObjectNode.gender as CustomObjectMetadata['gender'],
    household: customObjectNode.household as boolean | undefined,
    listViews: validationAndExternalSettings.listViews,
    nameField: fieldSections.nameField,
    recordTypes: validationAndExternalSettings.recordTypes,
    searchLayouts: customObjectNode.searchLayouts as CustomObjectMetadata['searchLayouts'],
    sharingModel: relationshipSettings.sharingModel,
    sharingReasons: relationshipSettings.sharingReasons,
    sharingRecalculations: relationshipSettings.sharingRecalculations,
    startsWith: customObjectNode.startsWith as CustomObjectMetadata['startsWith'],
    validationRules: validationAndExternalSettings.validationRules,
    visibility: customObjectNode.visibility as CustomObjectMetadata['visibility'],
    webLinks: validationAndExternalSettings.webLinks,
  };
}

function buildMetadataFromCustomObjectNode(customObjectNode: Record<string, unknown>): CustomObjectMetadata {
  warnOnMissingRequiredMetadata(customObjectNode);

  const fieldSections = extractFieldSections(customObjectNode);
  const relationshipSettings = extractRelationshipSettings(customObjectNode);
  const validationAndExternalSettings = extractValidationAndExternalSettings(customObjectNode);

  return assembleCustomObjectMetadata(
    customObjectNode,
    fieldSections,
    relationshipSettings,
    validationAndExternalSettings
  );
}

/**
 * Parse a custom object and extract dependencies
 *
 * @param objectName - Name of the custom object
 * @param metadataContent - Content of the .object file
 * @returns CustomObjectParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the object cannot be parsed
 *
 * @ac US-020-AC-1: Extract custom field definitions
 * @ac US-020-AC-2: Extract validation rule dependencies
 * @ac US-020-AC-4: Extract lookup/master-detail relationships
 * @ac US-020-AC-6: Extract record types
 * @ac US-020-AC-8: Extract list views
 *
 * @example
 * ```typescript
 * const result = await parseCustomObject('Account', objectXml);
 * console.log(result.fields); // [{fullName: 'CustomField__c', ...}]
 * console.log(result.dependencies); // [{type: 'lookup_field', ...}]
 * ```
 */
// eslint-disable-next-line complexity
export async function parseCustomObject(objectName: string, metadataContent: string): Promise<CustomObjectParseResult> {
  try {
    logger.debug(`Parsing custom object: ${objectName}`);

    const { customObjectNode } = await parseCustomObjectXml(metadataContent);
    const metadata = buildMetadataFromCustomObjectNode(customObjectNode);
    const { fields, validationRules, recordTypes, listViews } = extractBaseSections(metadata);
    const sharingRules = extractSharingRules(customObjectNode);
    const dependencies = buildDependencies(fields, validationRules, recordTypes);

    const result: CustomObjectParseResult = {
      ...metadata,
      fields,
      validationRules,
      recordTypes,
      listViews,
      sharingRules,
      dependencies,
    };

    logger.debug(`Parsed custom object: ${objectName}`, {
      fieldsCount: fields.length,
      validationRulesCount: validationRules.length,
      recordTypesCount: recordTypes.length,
      sharingRulesCount: sharingRules.length,
      listViewsCount: listViews.length,
      dependenciesCount: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse custom object: ${objectName}`, {
      filePath: objectName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
