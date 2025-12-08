import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import { parseXml } from '../utils/xml.js';
import type { EmailTemplateMetadata, EmailTemplateType } from '../types/salesforce/email.js';

const logger = getLogger('EmailTemplateParser');

/**
 * Email template dependency types
 */
export type EmailTemplateDependencyType =
  | 'merge_field'
  | 'visualforce_page'
  | 'related_entity'
  | 'attachment'
  | 'custom_label';

/**
 * Represents a dependency found in an email template
 */
export type EmailTemplateDependency = {
  type: EmailTemplateDependencyType;
  name: string;
  objectName?: string; // For merge fields: the SObject name
  fieldName?: string; // For merge fields: the field name
};

/**
 * Merge field reference
 */
export type MergeField = {
  fullReference: string; // e.g., {!Contact.Name}
  objectName: string; // e.g., Contact
  fieldName: string; // e.g., Name
  isRelated: boolean; // true if it's a related object reference
  relationshipPath?: string; // e.g., Account.Owner.Name
};

/**
 * Result of parsing an email template
 * Extends EmailTemplateMetadata with parsed dependencies
 * Overrides attachments to be string[] for easier consumption
 */
export type EmailTemplateParseResult = Omit<EmailTemplateMetadata, 'attachments'> & {
  mergeFields: MergeField[];
  customLabels: string[];
  dependencies: EmailTemplateDependency[];
  visualforcePage?: string;
  attachments?: string[]; // Override to be string[] instead of Attachment[]
};

/**
 * Extract merge fields from template content
 *
 * @ac US-019-AC-1: Extract merge fields (object.field references)
 */
function extractMergeFields(content: string): MergeField[] {
  const mergeFields: MergeField[] = [];
  const seen = new Set<string>();

  // Pattern: {!ObjectName.FieldName} or {!RelatedObject__r.Field__c}
  // Also matches: {!Account.Owner.Name} (related traversal)
  const mergeFieldPattern = /\{!([a-zA-Z][a-zA-Z0-9_]*(?:__[rc])?)\.([a-zA-Z][a-zA-Z0-9_.]*)\}/g;
  const matches = content.matchAll(mergeFieldPattern);

  for (const match of matches) {
    const fullReference = match[0];
    const objectName = match[1];
    const fieldPath = match[2];

    // Check if it's a related object traversal (contains dots)
    const isRelated = fieldPath.includes('.');
    const parts = fieldPath.split('.');
    const fieldName = parts[parts.length - 1];
    const relationshipPath = isRelated ? fieldPath : undefined;

    const key = `${objectName}.${fieldPath}`;
    if (!seen.has(key)) {
      seen.add(key);
      mergeFields.push({
        fullReference,
        objectName,
        fieldName,
        isRelated,
        relationshipPath,
      });
    }
  }

  return mergeFields;
}

/**
 * Extract custom label references
 *
 * @ac US-019-AC-5: Extract custom label references
 */
function extractCustomLabels(content: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  // Pattern: {!$Label.MyLabel} or {!$Label.namespace__MyLabel}
  const labelPattern = /\{!\$Label\.([a-zA-Z][a-zA-Z0-9_.]*)\}/g;
  const matches = content.matchAll(labelPattern);

  for (const match of matches) {
    const labelName = match[1];
    if (!seen.has(labelName)) {
      seen.add(labelName);
      labels.push(labelName);
    }
  }

  return labels;
}

/**
 * Parse email template metadata XML
 *
 * @ac US-019-AC-6: Parse template metadata (.email-meta.xml)
 */
async function parseMetadataXml(metadataContent: string): Promise<EmailTemplateMetadata> {
  try {
    const parsed = await parseXml(metadataContent);
    const parsedObj = parsed as Record<string, unknown>;
    const emailTemplate = (parsedObj.EmailTemplate as Record<string, unknown>) || parsedObj;

    // Normalize arrays (XML parser returns single items as objects, not arrays)
    const normalizeArray = <T>(value: T | T[] | undefined): T[] | undefined => {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value : [value];
    };

    // Normalize attachments (XML can have just <name> or full <content><name> structure)
    let attachments = normalizeArray(emailTemplate.attachments as EmailTemplateMetadata['attachments']);
    if (attachments) {
      attachments = attachments.map((att) => {
        // If attachment is a string, it's just the name
        if (typeof att === 'string') {
          return { name: att, content: '' };
        }
        // If it has a 'name' key with no content, set content to empty
        if (typeof att === 'object' && att.name && !att.content) {
          return { name: String(att.name), content: '' };
        }
        return att as { name: string; content: string };
      });
    }

    // Map to EmailTemplateMetadata
    const metadata: EmailTemplateMetadata = {
      apiVersion: emailTemplate.apiVersion as string | undefined,
      available: (emailTemplate.available as boolean) ?? false,
      description: emailTemplate.description as string | undefined,
      encodingKey: ((emailTemplate.encodingKey as string) ?? 'UTF-8') as EmailTemplateMetadata['encodingKey'],
      name: (emailTemplate.name as string) ?? '',
      style: ((emailTemplate.style as string) ?? 'none') as EmailTemplateMetadata['style'],
      subject: emailTemplate.subject as string | undefined,
      textOnly: emailTemplate.textOnly as string | undefined,
      type: ((emailTemplate.type as string) ?? 'text') as EmailTemplateType,
      uiType: emailTemplate.uiType as EmailTemplateMetadata['uiType'],
      attachedContentDocuments: normalizeArray(emailTemplate.attachedContentDocuments as string | string[] | undefined),
      attachments,
      letterhead: emailTemplate.letterhead as string | undefined,
      packageVersions: emailTemplate.packageVersions as EmailTemplateMetadata['packageVersions'],
      relatedEntityType: emailTemplate.relatedEntityType as string | undefined,
      visualforcePage: emailTemplate.visualforcePage as string | undefined,
    };

    return metadata;
  } catch (error) {
    throw new ParsingError('Failed to parse email template metadata XML', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parse an email template and extract dependencies
 *
 * @param templateName - Name of the email template
 * @param templateContent - Content of the template (HTML, text, or VF)
 * @param metadataContent - Content of the .email-meta.xml file
 * @returns EmailTemplateParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the template cannot be parsed
 *
 * @ac US-019-AC-2: Extract Visualforce page references
 * @ac US-019-AC-3: Extract relatedEntityType (target SObject)
 * @ac US-019-AC-4: Extract attachment references
 * @ac US-019-AC-7: Support all template types (text, html, visualforce, custom)
 * @ac US-019-AC-8: Handle both body and subject merge fields
 *
 * @example
 * ```typescript
 * const result = await parseEmailTemplate(
 *   'WelcomeEmail',
 *   templateContent,
 *   metadataXml
 * );
 * console.log(result.mergeFields); // [{objectName: 'Contact', fieldName: 'Name', ...}]
 * console.log(result.relatedEntityType); // 'Contact'
 * ```
 */
export async function parseEmailTemplate(
  templateName: string,
  templateContent: string,
  metadataContent: string
): Promise<EmailTemplateParseResult> {
  try {
    logger.debug(`Parsing email template: ${templateName}`);

    // Parse metadata XML using Salesforce types
    const metadata = await parseMetadataXml(metadataContent);

    // Extract merge fields from content and subject
    const contentMergeFields = extractMergeFields(templateContent);
    const subjectMergeFields = metadata.subject ? extractMergeFields(metadata.subject) : [];
    const mergeFields = [...contentMergeFields, ...subjectMergeFields];

    // Extract custom labels
    const customLabels = extractCustomLabels(templateContent);

    // Build dependencies array
    const dependencies: EmailTemplateDependency[] = [];

    // Add related entity type as dependency
    if (metadata.relatedEntityType) {
      dependencies.push({
        type: 'related_entity',
        name: metadata.relatedEntityType,
      });
    }

    // Add Visualforce page as dependency (for visualforce template type)
    let visualforcePage: string | undefined;
    if (metadata.type === 'visualforce' && metadata.visualforcePage) {
      visualforcePage = metadata.visualforcePage;
      dependencies.push({
        type: 'visualforce_page',
        name: visualforcePage,
      });
    }

    // Add merge fields as dependencies
    for (const mergeField of mergeFields) {
      dependencies.push({
        type: 'merge_field',
        name: mergeField.fullReference,
        objectName: mergeField.objectName,
        fieldName: mergeField.fieldName,
      });
    }

    // Add custom labels as dependencies
    for (const label of customLabels) {
      dependencies.push({
        type: 'custom_label',
        name: label,
      });
    }

    // Add attachments as dependencies
    if (metadata.attachments) {
      for (const attachment of metadata.attachments) {
        dependencies.push({
          type: 'attachment',
          name: attachment.name,
        });
      }
    }

    if (metadata.attachedContentDocuments) {
      for (const doc of metadata.attachedContentDocuments) {
        dependencies.push({
          type: 'attachment',
          name: doc,
        });
      }
    }

    // Map attachments to string array (just names) and include attachedContentDocuments
    const attachmentNames = metadata.attachments?.map((att) => att.name) ?? [];
    const allAttachments = [...attachmentNames, ...(metadata.attachedContentDocuments ?? [])];

    const result: EmailTemplateParseResult = {
      ...metadata,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
      mergeFields,
      customLabels,
      dependencies,
      visualforcePage,
    };

    logger.debug(`Parsed email template: ${templateName}`, {
      templateType: metadata.type,
      relatedEntityType: !!metadata.relatedEntityType,
      mergeFieldsCount: mergeFields.length,
      customLabelsCount: customLabels.length,
      attachmentsCount: (metadata.attachments?.length ?? 0) + (metadata.attachedContentDocuments?.length ?? 0),
      dependenciesCount: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse email template: ${templateName}`, {
      filePath: templateName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
