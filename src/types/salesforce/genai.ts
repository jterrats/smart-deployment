/**
 * Type definitions for Salesforce GenAI metadata
 * Represents GenAI Prompt Template (.genAiPromptTemplate-meta.xml) metadata structures
 */

/**
 * GenAI Prompt Template metadata (.genAiPromptTemplate-meta.xml)
 */
export type GenAiPromptTemplateMetadata = {
  activeVersion?: string;
  description?: string;
  developerName: string;
  masterLabel: string;
  relatedEntity?: string;
  relatedField?: string;
  status?: GenAiPromptTemplateStatus;
  templateVersions?: GenAiPromptTemplateVersion[];
  type?: GenAiPromptTemplateType;
};

/**
 * GenAI Prompt Template Status
 */
export type GenAiPromptTemplateStatus = 'Draft' | 'Published' | 'Archived';

/**
 * GenAI Prompt Template Type
 */
export type GenAiPromptTemplateType =
  | 'einstein_gpt__flex'
  | 'einstein_gpt__fieldCompletion'
  | 'einstein_gpt__recordSummary'
  | 'einstein_gpt__flex_v2'
  | 'einstein_gpt__recordScore'
  | 'sales_email';

/**
 * GenAI Prompt Template Version
 */
export type GenAiPromptTemplateVersion = {
  content?: string;
  number?: number;
  primaryModel?: string;
  status?: GenAiPromptTemplateStatus;
  targetVariable?: string;
  templateDataProviders?: GenAiPromptTemplateDataProvider[];
  templateVersionVariables?: GenAiPromptTemplateVariable[];
};

/**
 * GenAI Prompt Template Data Provider
 */
export type GenAiPromptTemplateDataProvider = {
  apiName?: string;
  dataProviderType?: string;
  definition?: string;
  fields?: GenAiPromptTemplateDataProviderField[];
  object?: string;
};

/**
 * GenAI Prompt Template Data Provider Field
 */
export type GenAiPromptTemplateDataProviderField = {
  apiName: string;
};

/**
 * GenAI Prompt Template Variable
 */
export type GenAiPromptTemplateVariable = {
  definition?: string;
  developerName: string;
  isRequired?: boolean;
  type?: GenAiPromptTemplateVariableType;
};

/**
 * GenAI Prompt Template Variable Type
 */
export type GenAiPromptTemplateVariableType =
  | 'Text'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'DateTime'
  | 'RecordId'
  | 'SObject';

