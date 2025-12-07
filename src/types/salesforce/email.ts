/**
 * Type definitions for Salesforce Email metadata
 * Represents EmailTemplate metadata structures
 */

/**
 * Email Template metadata (.email-meta.xml)
 */
export type EmailTemplateMetadata = {
  apiVersion?: string;
  available: boolean;
  description?: string;
  encodingKey: Encoding;
  name: string;
  style: EmailTemplateStyle;
  subject?: string;
  textOnly?: string;
  type: EmailTemplateType;
  uiType?: EmailTemplateUiType;
  attachedContentDocuments?: string[];
  attachments?: Attachment[];
  letterhead?: string;
  packageVersions?: PackageVersion[];
  relatedEntityType?: string;
};

/**
 * Email Template Style
 */
export type EmailTemplateStyle =
  | 'none'
  | 'freeForm'
  | 'formalLetter'
  | 'promotionRight'
  | 'promotionLeft'
  | 'newsletter'
  | 'products';

/**
 * Email Template Type
 */
export type EmailTemplateType = 'text' | 'html' | 'custom' | 'visualforce';

/**
 * Email Template UI Type
 */
export type EmailTemplateUiType = 'Aloha' | 'SFX' | 'SFX_MailMerge';

/**
 * Encoding
 */
export type Encoding =
  | 'UTF-8'
  | 'ISO-8859-1'
  | 'Shift_JIS'
  | 'ISO-2022-JP'
  | 'EUC-JP'
  | 'ks_c_5601-1987'
  | 'Big5'
  | 'GB2312'
  | 'Big5-HKSCS'
  | 'x-SJIS_0213';

/**
 * Attachment
 */
export type Attachment = {
  content: string;
  name: string;
};

/**
 * Package Version
 */
export type PackageVersion = {
  majorNumber: number;
  minorNumber: number;
  namespace: string;
};

/**
 * Email merge field
 */
export type EmailMergeField = {
  field: string;
  objectName: string;
};

/**
 * Email recipient type
 */
export type EmailRecipientType = 'User' | 'Contact' | 'Lead' | 'Person' | 'Group' | 'Portal';
