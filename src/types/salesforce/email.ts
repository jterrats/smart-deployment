/**
 * Type definitions for Salesforce Email metadata
 * Represents EmailTemplate metadata structures
 */

import type { Encoding, PackageVersion } from './common.js';

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
  visualforcePage?: string;
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
 * Attachment
 */
export type Attachment = {
  content: string;
  name: string;
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
