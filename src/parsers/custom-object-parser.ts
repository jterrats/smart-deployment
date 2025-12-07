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

/**
 * Parse custom object metadata XML
 */
async function parseMetadataXml(metadataContent: string): Promise<CustomObjectMetadata> {
  try {
    const parsed = await parseXml(metadataContent);
    const parsedObj = parsed as Record<string, unknown>;
    const customObject = (parsedObj.CustomObject as Record<string, unknown>) || parsedObj;

    // Validate that we have at least label and pluralLabel
    if (!customObject.label || !customObject.pluralLabel) {
      logger.warn('Missing required fields in custom object metadata', {
        hasLabel: Boolean(customObject.label),
        hasPluralLabel: Boolean(customObject.pluralLabel),
        parsedKeys: Object.keys(customObject),
      });
    }

    // Normalize arrays (XML parser returns single items as objects, not arrays)
    const normalizeArray = <T>(value: T | T[] | undefined): T[] | undefined => {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value : [value];
    };

    // Map to CustomObjectMetadata using the robust types from src/types/salesforce/object.ts
    let fields = normalizeArray(customObject.fields as CustomField | CustomField[] | undefined);

    // Normalize referenceTo within each field (XML parser returns single string, but type expects array)
    if (fields) {
      fields = fields.map((field) => ({
        ...field,
        referenceTo: field.referenceTo
          ? Array.isArray(field.referenceTo)
            ? field.referenceTo
            : [field.referenceTo]
          : undefined,
      }));
    }

    const metadata: CustomObjectMetadata = {
      label: (customObject.label as string) ?? '',
      pluralLabel: (customObject.pluralLabel as string) ?? '',
      actionOverrides: normalizeArray(customObject.actionOverrides as ActionOverride | ActionOverride[] | undefined),
      allowInChatterGroups: customObject.allowInChatterGroups as boolean | undefined,
      compactLayoutAssignment: customObject.compactLayoutAssignment as string | undefined,
      customHelpPage: customObject.customHelpPage as string | undefined,
      deploymentStatus: customObject.deploymentStatus as CustomObjectMetadata['deploymentStatus'],
      deprecated: customObject.deprecated as boolean | undefined,
      description: customObject.description as string | undefined,
      enableActivities: customObject.enableActivities as boolean | undefined,
      enableBulkApi: customObject.enableBulkApi as boolean | undefined,
      enableChangeDataCapture: customObject.enableChangeDataCapture as boolean | undefined,
      enableEnhancedLookup: customObject.enableEnhancedLookup as boolean | undefined,
      enableFeeds: customObject.enableFeeds as boolean | undefined,
      enableHistory: customObject.enableHistory as boolean | undefined,
      enableReports: customObject.enableReports as boolean | undefined,
      enableSearch: customObject.enableSearch as boolean | undefined,
      enableSharing: customObject.enableSharing as boolean | undefined,
      enableStreamingApi: customObject.enableStreamingApi as boolean | undefined,
      externalSharingModel: customObject.externalSharingModel as CustomObjectMetadata['externalSharingModel'],
      fields,
      fieldSets: normalizeArray(customObject.fieldSets as FieldSet | FieldSet[] | undefined),
      gender: customObject.gender as CustomObjectMetadata['gender'],
      household: customObject.household as boolean | undefined,
      listViews: normalizeArray(customObject.listViews as ListView | ListView[] | undefined),
      nameField: customObject.nameField as CustomField | undefined,
      recordTypes: normalizeArray(customObject.recordTypes as RecordType | RecordType[] | undefined),
      searchLayouts: customObject.searchLayouts as CustomObjectMetadata['searchLayouts'],
      sharingModel: customObject.sharingModel as CustomObjectMetadata['sharingModel'],
      sharingReasons: normalizeArray(customObject.sharingReasons as SharingReason | SharingReason[] | undefined),
      sharingRecalculations: normalizeArray(
        customObject.sharingRecalculations as SharingRecalculation | SharingRecalculation[] | undefined
      ),
      startsWith: customObject.startsWith as CustomObjectMetadata['startsWith'],
      validationRules: normalizeArray(customObject.validationRules as ValidationRule | ValidationRule[] | undefined),
      visibility: customObject.visibility as CustomObjectMetadata['visibility'],
      webLinks: normalizeArray(customObject.webLinks as WebLink | WebLink[] | undefined),
    };

    return metadata;
  } catch (error) {
    throw new ParsingError('Failed to parse custom object metadata XML', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
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

    // Parse metadata XML using Salesforce types
    const metadata = await parseMetadataXml(metadataContent);

    // Parse the raw XML for sharing rules (not part of CustomObjectMetadata)
    const parsedRaw = await parseXml(metadataContent);
    const customObject = ((parsedRaw as Record<string, unknown>).CustomObject as Record<string, unknown>) || parsedRaw;
    const sharingRules = extractSharingRules(customObject);

    // Extract fields
    const fields = metadata.fields ?? [];
    const validationRules = metadata.validationRules ?? [];
    const recordTypes = metadata.recordTypes ?? [];
    const listViews = metadata.listViews ?? [];

    // Build dependencies array
    const dependencies: CustomObjectDependency[] = [];

    // Add field dependencies
    for (const field of fields) {
      // Lookup/Master-Detail relationships
      if (field.referenceTo && (field.type === 'Lookup' || field.type === 'MasterDetail')) {
        const refObjects = field.referenceTo;
        for (const refObject of refObjects) {
          dependencies.push({
            type: field.type === 'MasterDetail' ? 'master_detail_field' : 'lookup_field',
            name: field.fullName,
            referencedObject: refObject,
            fieldName: field.fullName,
          });
        }
      }

      // Formula fields
      if (field.formula) {
        const formulaRefs = extractFormulaReferences(field.formula);
        for (const ref of formulaRefs) {
          dependencies.push({
            type: 'formula_field',
            name: field.fullName,
            referencedObject: ref,
            fieldName: field.fullName,
          });
        }

        // Apex class references in formulas
        const apexRefs = extractApexReferences(field.formula);
        for (const apexClass of apexRefs) {
          dependencies.push({
            type: 'apex_class',
            name: apexClass,
            fieldName: field.fullName,
          });
        }
      }
    }

    // Add validation rule dependencies
    for (const rule of validationRules) {
      if (rule.errorConditionFormula) {
        const formulaRefs = extractFormulaReferences(rule.errorConditionFormula);
        for (const ref of formulaRefs) {
          dependencies.push({
            type: 'validation_rule',
            name: rule.fullName,
            referencedObject: ref,
          });
        }

        // Apex class references in validation rules
        const apexRefs = extractApexReferences(rule.errorConditionFormula);
        for (const apexClass of apexRefs) {
          dependencies.push({
            type: 'apex_class',
            name: apexClass,
          });
        }
      }
    }

    // Add record type dependencies
    for (const rt of recordTypes) {
      dependencies.push({
        type: 'record_type',
        name: rt.fullName,
      });
    }

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
