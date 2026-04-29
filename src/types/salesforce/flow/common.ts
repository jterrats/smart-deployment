/**
 * Shared Flow type definitions used across Flow metadata subdomains.
 */

export type FlowProcessType =
  | 'AutoLaunchedFlow'
  | 'Flow'
  | 'Workflow'
  | 'CustomEvent'
  | 'InvocableProcess'
  | 'LoginFlow'
  | 'ActionPlan'
  | 'JourneyBuilderIntegration'
  | 'UserProvisioningFlow'
  | 'Survey'
  | 'SurveyEnrich'
  | 'Appointments'
  | 'FSCLending'
  | 'DigitalForm'
  | 'FieldServiceMobile'
  | 'OrchestrationFlow'
  | 'FieldServiceWeb'
  | 'TransactionSecurityFlow'
  | 'ContactRequestFlow'
  | 'ActionCadenceFlow'
  | 'ManagedContentFlow'
  | 'CheckoutFlow'
  | 'CartAsyncFlow'
  | 'SalesEntryExperienceFlow'
  | 'CustomerLifecycle'
  | 'Journey'
  | 'RecommendationStrategy'
  | 'Orchestrator'
  | 'RoutingFlow'
  | 'ServiceCatalogItemFlow'
  | 'EvaluationFlow'
  | 'ActionCadenceAutolaunchedFlow'
  | 'ActionCadenceStepFlow'
  | 'IndividualObjectLinkingFlow';

export type FlowStatus = 'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft';

export type FlowElementReferenceOrValue = {
  stringValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  dateValue?: string;
  dateTimeValue?: string;
  elementReference?: string;
};

export type FlowMetadataValue = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowConnector = {
  targetReference: string;
};

export type FlowNode = {
  name: string;
  label?: string;
  locationX: number;
  locationY: number;
  connector?: FlowConnector;
  faultConnector?: FlowConnector;
};

export type FlowComparisonOperator =
  | 'EqualTo'
  | 'NotEqualTo'
  | 'GreaterThan'
  | 'LessThan'
  | 'GreaterThanOrEqualTo'
  | 'LessThanOrEqualTo'
  | 'StartsWith'
  | 'EndsWith'
  | 'Contains'
  | 'IsNull'
  | 'IsChanged'
  | 'WasSelected'
  | 'WasSet';

export type FlowCondition = {
  leftValueReference: string;
  operator: FlowComparisonOperator;
  rightValue?: FlowElementReferenceOrValue;
};

export type FlowDataType =
  | 'Boolean'
  | 'Currency'
  | 'Date'
  | 'DateTime'
  | 'Number'
  | 'String'
  | 'Picklist'
  | 'MultiPicklist'
  | 'SObject'
  | 'Apex';

export type FlowSortOrder = 'Asc' | 'Desc';
