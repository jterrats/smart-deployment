/**
 * GenAI Prompt Template Parser
 * Parses Salesforce GenAI Prompt Template metadata files (.genAiPromptTemplate-meta.xml)
 *
 * @ac US-025-AC-1: Extract related object references
 * @ac US-025-AC-2: Extract field references in prompts
 * @ac US-025-AC-3: Extract model configurations
 * @ac US-025-AC-4: Detect circular dependencies with Flows
 * @ac US-025-AC-5: Link to dependent metadata
 *
 * @issue #25
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { GenAiPromptTemplateMetadata, GenAiPromptTemplateDataProvider } from '../types/salesforce/genai.js';

/**
 * Result of parsing a GenAI Prompt Template file
 */
export type GenAiPromptParseResult = {
  /** Name of the prompt template (from filename) */
  name: string;
  /** Developer name */
  developerName: string;
  /** Master label */
  masterLabel: string;
  /** Description */
  description?: string;
  /** Related entity (SObject) */
  relatedEntity?: string;
  /** Related field */
  relatedField?: string;
  /** Status */
  status?: string;
  /** Type */
  type?: string;
  /** Model configurations */
  models: string[];
  /** Template variables */
  templateVariables: string[];
  /** SObjects referenced */
  sobjects: string[];
  /** Fields referenced */
  fields: string[];
  /** Data provider objects */
  dataProviderObjects: string[];
  /** All dependencies extracted from this prompt template */
  dependencies: {
    models: string[];
    sobjects: string[];
    fields: string[];
    dataProviders: string[];
  };
};

/**
 * Normalize value to array (handles XML parser returning single object vs array)
 */
function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extract field references from prompt content
 * Looks for {!field} and {!Object.Field} patterns
 */
function extractFieldsFromContent(content: string): string[] {
  const fieldPattern = /\{!([A-Za-z0-9_.]+)\}/g;
  const fields: string[] = [];
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = fieldPattern.exec(content)) !== null) {
    fields.push(match[1]);
  }

  return fields;
}

function extractObjectsFromFields(fields: string[]): string[] {
  return [
    ...new Set(
      fields
        .map((field) => {
          const segments = field.split('.');
          return segments.length > 1 ? segments[0] : undefined;
        })
        .filter((value): value is string => Boolean(value))
    ),
  ];
}

/**
 * Extract objects and fields from data providers
 */
function extractFromDataProviders(dataProviders: GenAiPromptTemplateDataProvider[]): {
  objects: string[];
  fields: string[];
} {
  const objects: string[] = [];
  const fields: string[] = [];

  for (const provider of dataProviders) {
    if (provider.object) {
      objects.push(provider.object);

      // Extract fields with object prefix
      const providerFields = normalizeArray(provider.fields);
      for (const field of providerFields) {
        fields.push(`${provider.object}.${field.apiName}`);
      }
    }
  }

  return { objects, fields };
}

/**
 * Parse a GenAI Prompt Template metadata XML file
 *
 * @param filePath - Path to the .genAiPromptTemplate-meta.xml file
 * @param promptName - Name of the prompt template (typically from filename)
 * @returns Parsed prompt template metadata with dependencies
 *
 * @example
 * const result = await parseGenAiPrompt(
 *   'force-app/main/default/genAiPromptTemplates/CaseSummary.genAiPromptTemplate-meta.xml',
 *   'CaseSummary'
 * );
 * console.log(result.relatedEntity); // 'Case'
 * console.log(result.models); // ['sfdc_ai__DefaultGPT35Turbo']
 * console.log(result.sobjects); // ['Case', 'Contact']
 */
export async function parseGenAiPrompt(filePath: string, promptName: string): Promise<GenAiPromptParseResult> {
  // Read and parse XML
  const xmlContent = await readFile(filePath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch (error) {
    throw new Error(
      `Failed to parse GenAI Prompt Template XML at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Type assertion with validation
  const root = parsed as { GenAiPromptTemplate?: GenAiPromptTemplateMetadata };
  if (!root.GenAiPromptTemplate) {
    throw new Error(
      `Invalid GenAI Prompt Template XML structure at ${filePath}: missing GenAiPromptTemplate root element`
    );
  }

  const metadata = root.GenAiPromptTemplate;

  // Extract template versions
  const versions = normalizeArray(metadata.templateVersions);

  // Extract models
  const models = versions.map((version) => version.primaryModel).filter((model): model is string => Boolean(model));

  // Extract template variables
  const allVariables: string[] = [];
  for (const version of versions) {
    const variables = normalizeArray(version.templateVersionVariables);
    allVariables.push(...variables.map((v) => v.developerName));
  }

  // Extract SObjects and fields from data providers
  const allObjects: string[] = [];
  const allFields: string[] = [];
  const dataProviderNames: string[] = [];
  const dataProviderObjects: string[] = [];

  for (const version of versions) {
    const dataProviders = normalizeArray(version.templateDataProviders);
    const { objects, fields } = extractFromDataProviders(dataProviders);
    allObjects.push(...objects);
    allFields.push(...fields);
    dataProviderObjects.push(...objects);

    // Extract data provider API names
    dataProviderNames.push(...dataProviders.map((dp) => dp.apiName).filter((name): name is string => Boolean(name)));
  }

  // Extract field references from prompt content
  const contentFields: string[] = [];
  for (const version of versions) {
    if (version.content) {
      contentFields.push(...extractFieldsFromContent(version.content));
    }
  }
  allObjects.push(...extractObjectsFromFields(contentFields));

  // Add related entity to objects
  if (metadata.relatedEntity) {
    allObjects.push(metadata.relatedEntity);
  }

  // Add related field to fields
  if (metadata.relatedEntity && metadata.relatedField) {
    allFields.push(`${metadata.relatedEntity}.${metadata.relatedField}`);
  }

  // Combine and deduplicate
  const uniqueObjects = [...new Set(allObjects)];
  const uniqueFields = [...new Set([...allFields, ...contentFields])];
  const uniqueDataProviders = [...new Set(dataProviderNames)];
  const uniqueModels = [...new Set(models)];
  const uniqueVariables = [...new Set(allVariables)];
  const uniqueDataProviderObjects = [...new Set(dataProviderObjects)];

  // Build result
  return {
    name: promptName,
    developerName: metadata.developerName,
    masterLabel: metadata.masterLabel,
    description: metadata.description,
    relatedEntity: metadata.relatedEntity,
    relatedField: metadata.relatedField,
    status: metadata.status,
    type: metadata.type,
    models: uniqueModels,
    templateVariables: uniqueVariables,
    sobjects: uniqueObjects,
    fields: uniqueFields,
    dataProviderObjects: uniqueDataProviderObjects,
    dependencies: {
      models: uniqueModels,
      sobjects: uniqueObjects,
      fields: uniqueFields,
      dataProviders: uniqueDataProviders,
    },
  };
}
