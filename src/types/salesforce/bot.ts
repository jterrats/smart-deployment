/**
 * Type definitions for Salesforce Bot metadata
 * Represents Einstein Bot (.bot-meta.xml) metadata structures
 */

// Re-export SortOrder from common types (already defined in layout.ts)
import type { SortOrder } from './layout.js';
export type { SortOrder };

/**
 * Bot metadata (.bot-meta.xml)
 */
export type BotMetadata = {
  botMlDomain?: BotMlDomain;
  botVersions?: BotVersion[];
  contextVariables?: ConversationContextVariable[];
  description?: string;
  label: string;
  logPrivateConversationData?: boolean;
  mlIntents?: MlIntent[];
  mlSlotClasses?: MlSlotClass[];
};

/**
 * Bot Version
 */
export type BotVersion = {
  botDialogs?: BotDialog[];
  conversationVariables?: ConversationVariable[];
  entryDialog?: string;
  mainMenuDialog?: string;
  responseDelayMilliseconds?: number;
};

/**
 * Bot Dialog
 */
export type BotDialog = {
  botSteps?: BotStep[];
  developerName: string;
  label: string;
  mlIntent?: string;
  mlIntentTrainingEnabled?: boolean;
  showInFooterMenu?: boolean;
};

/**
 * Bot Step
 */
export type BotStep = {
  booleanFilter?: string;
  botInvocation?: BotInvocation;
  botMessages?: BotMessage[];
  botNavigation?: BotNavigation;
  botStepConditions?: BotStepCondition[];
  botSteps?: BotStep[];
  botVariableOperation?: BotVariableOperation;
  conversationRecordLookup?: ConversationRecordLookup;
  messageDefinition?: BotMessage;
  stepIdentifier?: string;
  type: BotStepType;
};

/**
 * Bot Step Type
 */
export type BotStepType =
  | 'Navigation'
  | 'Message'
  | 'Question'
  | 'Action'
  | 'SystemMessage'
  | 'Group'
  | 'RecordLookup'
  | 'Wait'
  | 'VariableOperation';

/**
 * Bot Invocation
 */
export type BotInvocation = {
  invocationActionName?: string;
  invocationActionType?: BotInvocationActionType;
  invocationMappings?: BotInvocationMapping[];
};

/**
 * Bot Invocation Action Type
 */
export type BotInvocationActionType =
  | 'flow'
  | 'apex'
  | 'prompt'
  | 'externalService'
  | 'standardInvocableAction';

/**
 * Bot Invocation Mapping
 */
export type BotInvocationMapping = {
  parameterName: string;
  type: BotInvocationMappingType;
  value?: string;
  variableName?: string;
  variableType?: ConversationVariableType;
};

/**
 * Bot Invocation Mapping Type
 */
export type BotInvocationMappingType = 'Value' | 'Variable' | 'StandardVariable';

/**
 * Bot Message
 */
export type BotMessage = {
  message: string;
  messageIdentifier?: string;
};

/**
 * Bot Navigation
 */
export type BotNavigation = {
  botNavigationLinks?: BotNavigationLink[];
  type: BotNavigationType;
};

/**
 * Bot Navigation Type
 */
export type BotNavigationType = 'Redirect' | 'DialogGroup' | 'Menu' | 'CloseConversation';

/**
 * Bot Navigation Link
 */
export type BotNavigationLink = {
  label?: string;
  targetBotDialog?: string;
  targetVariable?: string;
  targetVariableType?: string;
};

/**
 * Bot Step Condition
 */
export type BotStepCondition = {
  leftOperand: string;
  leftOperandType?: string;
  operatorType: string;
  rightOperandValue?: string;
};

/**
 * Bot Variable Operation
 */
export type BotVariableOperation = {
  askCollectIfSet?: boolean;
  botInvocation?: BotInvocation;
  botMessages?: BotMessage[];
  botQuickReplyOptions?: BotQuickReplyOption[];
  botVariableOperands?: BotVariableOperand[];
  invalidInputBotNavigation?: BotNavigation;
  optionalRecordId?: string;
  quickReplyOptionTemplate?: string;
  quickReplyType?: BotQuickReplyType;
  quickReplyWidgetType?: string;
  retryMessages?: BotMessage[];
  sourceVariableName?: string;
  sourceVariableType?: ConversationVariableType;
  successOutputName?: string;
  targetVariableName?: string;
  type: BotVariableOperationType;
};

/**
 * Bot Variable Operation Type
 */
export type BotVariableOperationType =
  | 'Set'
  | 'Collect'
  | 'SetList'
  | 'Search'
  | 'Extract'
  | 'SendRecord';

/**
 * Bot Quick Reply Option
 */
export type BotQuickReplyOption = {
  literalValue?: string;
  quickReplyOrder?: number;
};

/**
 * Bot Quick Reply Type
 */
export type BotQuickReplyType = 'Static' | 'Dynamic';

/**
 * Bot Variable Operand
 */
export type BotVariableOperand = {
  disableAutoFill?: boolean;
  formulaExpression?: string;
  sourceValue?: string;
  targetVariableName: string;
  targetVariableType?: ConversationVariableType;
};

/**
 * Conversation Record Lookup
 */
export type ConversationRecordLookup = {
  SObjectType: string;
  conditions?: ConversationRecordLookupCondition[];
  fields?: ConversationRecordLookupField[];
  filterLogic?: string;
  lookupFields?: ConversationRecordLookupField[];
  maxLookupResults?: number;
  sortFieldName?: string;
  sortOrder?: SortOrder;
  sourceVariableName?: string;
  sourceVariableType?: ConversationVariableType;
  targetVariableName: string;
};

/**
 * Conversation Record Lookup Condition
 */
export type ConversationRecordLookupCondition = {
  leftOperand: string;
  operatorType: string;
  rightOperandName?: string;
  rightOperandType?: string;
  rightOperandValue?: string;
  sortOrder: number;
};

/**
 * Conversation Record Lookup Field
 */
export type ConversationRecordLookupField = {
  fieldName: string;
};

/**
 * Conversation Variable
 */
export type ConversationVariable = {
  SObjectType?: string;
  collectionType?: ConversationVariableCollectionType;
  dataType: ConversationVariableType;
  developerName: string;
  label: string;
};

/**
 * Conversation Variable Type
 */
export type ConversationVariableType =
  | 'Text'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'DateTime'
  | 'Currency'
  | 'SObject'
  | 'Object';

/**
 * Conversation Variable Collection Type
 */
export type ConversationVariableCollectionType = 'List' | 'None';

/**
 * Conversation Context Variable
 */
export type ConversationContextVariable = {
  SObjectType?: string;
  dataType: ConversationVariableType;
  developerName: string;
  label: string;
};

/**
 * Bot ML Domain
 */
export type BotMlDomain = {
  label: string;
  mlIntents?: MlIntent[];
  name: string;
};

/**
 * ML Intent
 */
export type MlIntent = {
  description?: string;
  developerName: string;
  label: string;
  mlIntentUtterances?: MlIntentUtterance[];
  relatedMlIntents?: RelatedMlIntent[];
};

/**
 * ML Intent Utterance
 */
export type MlIntentUtterance = {
  utterance: string;
};

/**
 * Related ML Intent
 */
export type RelatedMlIntent = {
  relatedMlIntent: string;
};

/**
 * ML Slot Class
 */
export type MlSlotClass = {
  dataType: string;
  developerName: string;
  extractionRegex?: string;
  extractionType?: MlSlotClassExtractionType;
  label: string;
  mlSlotClassValues?: MlSlotClassValue[];
};

/**
 * ML Slot Class Extraction Type
 */
export type MlSlotClassExtractionType = 'Pattern' | 'Entity';

/**
 * ML Slot Class Value
 */
export type MlSlotClassValue = {
  synonymGroup?: SynonymGroup;
  value: string;
};

/**
 * Synonym Group
 */
export type SynonymGroup = {
  languages?: Language[];
  terms: string[];
};

/**
 * Language
 */
export type Language = {
  language: string;
};

