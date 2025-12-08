import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import { parseXml } from '../utils/xml.js';
import type {
  CustomMetadataType,
  CustomMetadataField,
  CustomMetadataRecord as CMDRecord,
  CustomMetadataFieldType,
} from '../types/salesforce/custom-metadata.js';

const logger = getLogger('CustomMetadataParser');

/**
 * Custom Metadata dependency types
 */
export type CustomMetadataDependencyType = 'metadata_type' | 'relationship_field' | 'lookup_reference' | 'record';

/**
 * Represents a dependency found in custom metadata
 */
export type CustomMetadataDependency = {
  type: CustomMetadataDependencyType;
  name: string;
  referencedObject?: string;
  fieldName?: string;
};

/**
 * Custom Metadata Record (extended with fullName and simplified values for parsing)
 */
export type CustomMetadataRecord = Omit<CMDRecord, 'values'> & {
  fullName: string;
  values: Record<string, unknown>; // Simplified from CustomMetadataRecordValue[] for easier access
};

/**
 * Result of parsing a Custom Metadata Type
 * Extends CustomMetadataType with parsing-specific fields
 */
export type CustomMetadataParseResult = CustomMetadataType & {
  typeName: string;
  fields: CustomMetadataField[]; // Override to ensure always defined
  records: CustomMetadataRecord[];
  dependencies: CustomMetadataDependency[];
  // CMT-specific splitting info
  requiresSplitting: boolean; // True if >200 records
  splitBatches?: number; // Number of 200-record batches needed
};

/**
 * Parse Custom Metadata Type definition
 *
 * @param typeName - Name of the custom metadata type
 * @param metadataContent - Content of the .md-meta.xml file
 * @returns CustomMetadataParseResult
 *
 * @throws {ParsingError} If the metadata cannot be parsed
 *
 * @ac US-026-AC-1: Extract field definitions
 * @ac US-026-AC-2: Extract relationship references
 * @ac US-026-AC-5: Handle CMT splitting (200 records/wave)
 *
 * @example
 * ```typescript
 * const result = await parseCustomMetadataType('MyConfig__mdt', metadataXml);
 * console.log(result.fields); // [{fullName: 'Value__c', ...}]
 * console.log(result.requiresSplitting); // true if >200 records
 * ```
 */
export async function parseCustomMetadataType(
  typeName: string,
  metadataContent: string
): Promise<CustomMetadataParseResult> {
  try {
    logger.debug(`Parsing custom metadata type: ${typeName}`);

    const parsed = await parseXml(metadataContent);
    const parsedObj = parsed as Record<string, unknown>;
    const customMetadata = (parsedObj.CustomMetadata as Record<string, unknown>) || parsedObj;

    // Normalize arrays
    const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
      if (value === undefined) return [];
      return Array.isArray(value) ? value : [value];
    };

    // Extract fields
    const fieldsRaw = normalizeArray(customMetadata.fields as CustomMetadataField | CustomMetadataField[] | undefined);
    const fields: CustomMetadataField[] = fieldsRaw.map((field) => ({
      fullName: String(field.fullName ?? ''),
      label: String(field.label ?? ''),
      type: String(field.type ?? 'Text') as CustomMetadataFieldType,
      required: field.required ? Boolean(field.required) : undefined,
      unique: field.unique ? Boolean(field.unique) : undefined,
      description: field.description ? String(field.description) : undefined,
      referenceTo: field.referenceTo ? String(field.referenceTo) : undefined,
    }));

    // Extract basic metadata info
    const label = (customMetadata.label as string) ?? typeName;
    const pluralLabel = (customMetadata.pluralLabel as string) ?? `${label}s`;
    const description = customMetadata.description as string | undefined;

    // Build dependencies
    const dependencies: CustomMetadataDependency[] = [];

    // Add field dependencies (especially EntityDefinition relationships)
    for (const field of fields) {
      if (field.referenceTo) {
        dependencies.push({
          type: 'relationship_field',
          name: field.fullName,
          referencedObject: field.referenceTo,
          fieldName: field.fullName,
        });
      }
    }

    // Note: Records are parsed separately from .md files in the customMetadata directory
    const records: CustomMetadataRecord[] = [];

    // CMT splitting logic (200 records per wave)
    const CMT_RECORDS_PER_WAVE = 200;
    const requiresSplitting = records.length > CMT_RECORDS_PER_WAVE;
    const splitBatches = requiresSplitting ? Math.ceil(records.length / CMT_RECORDS_PER_WAVE) : undefined;

    const result: CustomMetadataParseResult = {
      typeName,
      label,
      pluralLabel,
      description,
      fields,
      records,
      dependencies,
      requiresSplitting,
      splitBatches,
    };

    logger.debug(`Parsed custom metadata type: ${typeName}`, {
      fieldsCount: fields.length,
      recordsCount: records.length,
      requiresSplitting,
      splitBatches,
      dependenciesCount: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse custom metadata type: ${typeName}`, {
      filePath: typeName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parse Custom Metadata Record
 *
 * @param recordName - Name of the record
 * @param metadataContent - Content of the .md file
 * @returns CustomMetadataRecord
 *
 * @throws {ParsingError} If the record cannot be parsed
 *
 * @ac US-026-AC-4: Identify CMT records separately
 *
 * @example
 * ```typescript
 * const record = await parseCustomMetadataRecord('MyConfig.Default', recordXml);
 * console.log(record.label); // 'Default'
 * console.log(record.values); // {Value__c: 'test'}
 * ```
 */
export async function parseCustomMetadataRecord(
  recordName: string,
  metadataContent: string
): Promise<CustomMetadataRecord> {
  try {
    logger.debug(`Parsing custom metadata record: ${recordName}`);

    const parsed = await parseXml(metadataContent);
    const parsedObj = parsed as Record<string, unknown>;
    const customMetadata = (parsedObj.CustomMetadata as Record<string, unknown>) || parsedObj;

    const label = (customMetadata.label as string) ?? recordName;
    const protectedFlag = customMetadata.protected as boolean | undefined;

    // Extract values
    const valuesRaw = customMetadata.values as Record<string, unknown> | undefined;
    const values: Record<string, unknown> = {};

    if (valuesRaw) {
      // Parse CustomMetadataValue entries
      const valueEntries = Array.isArray(valuesRaw) ? valuesRaw : [valuesRaw];
      for (const entry of valueEntries) {
        const field = (entry as Record<string, unknown>).field as string;
        const value = (entry as Record<string, unknown>).value;
        if (field) {
          values[field] = value;
        }
      }
    }

    const record: CustomMetadataRecord = {
      fullName: recordName,
      label,
      protected: protectedFlag,
      values,
    };

    logger.debug(`Parsed custom metadata record: ${recordName}`, {
      valuesCount: Object.keys(values).length,
    });

    return record;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse custom metadata record: ${recordName}`, {
      filePath: recordName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Group Custom Metadata Type with its records
 *
 * @param typeResult - Result from parseCustomMetadataType
 * @param records - Array of parsed records
 * @returns Updated CustomMetadataParseResult with records
 *
 * @ac US-026-AC-3: Group type with records
 * @ac US-026-AC-5: Handle CMT splitting (200 records/wave)
 *
 * @example
 * ```typescript
 * const typeResult = await parseCustomMetadataType('MyConfig__mdt', typeXml);
 * const records = await Promise.all(recordFiles.map(f => parseCustomMetadataRecord(f.name, f.content)));
 * const grouped = groupCustomMetadataWithRecords(typeResult, records);
 * console.log(grouped.requiresSplitting); // true if >200 records
 * ```
 */
export function groupCustomMetadataWithRecords(
  typeResult: CustomMetadataParseResult,
  records: CustomMetadataRecord[]
): CustomMetadataParseResult {
  const CMT_RECORDS_PER_WAVE = 200;
  const requiresSplitting = records.length > CMT_RECORDS_PER_WAVE;
  const splitBatches = requiresSplitting ? Math.ceil(records.length / CMT_RECORDS_PER_WAVE) : undefined;

  // Add record dependencies
  const recordDependencies: CustomMetadataDependency[] = records.map((record) => ({
    type: 'record' as const,
    name: record.fullName,
  }));

  return {
    ...typeResult,
    records,
    dependencies: [...typeResult.dependencies, ...recordDependencies],
    requiresSplitting,
    splitBatches,
  };
}
