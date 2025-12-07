/**
 * Type definitions for Salesforce Flow metadata
 * Represents Flow-meta.xml structures
 */

/**
 * Flow metadata (Flow-meta.xml)
 */
export type FlowMetadata = {
  apiVersion?: string;
  description?: string;
  label: string;
  processType: FlowProcessType;
  status: FlowStatus;
  interviewLabel?: string;
  isTemplate?: boolean;
  processMetadataValues?: FlowMetadataValue[];
  start?: FlowStart;
  actionCalls?: FlowActionCall[];
  apexPluginCalls?: FlowApexPluginCall[];
  assignments?: FlowAssignment[];
  decisions?: FlowDecision[];
  loops?: FlowLoop[];
  recordCreates?: FlowRecordCreate[];
  recordDeletes?: FlowRecordDelete[];
  recordLookups?: FlowRecordLookup[];
  recordUpdates?: FlowRecordUpdate[];
  screens?: FlowScreen[];
  subflows?: FlowSubflow[];
  variables?: FlowVariable[];
  constants?: FlowConstant[];
  formulas?: FlowFormula[];
  dynamicChoiceSets?: FlowDynamicChoiceSet[];
  textTemplates?: FlowTextTemplate[];
  stages?: FlowStage[];
  transforms?: FlowTransform[];
  waits?: FlowWait[];
};

/**
 * Flow process type
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

/**
 * Flow status
 */
export type FlowStatus = 'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft';

/**
 * Flow metadata value
 */
export type FlowMetadataValue = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow element reference or value
 */
export type FlowElementReferenceOrValue = {
  stringValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  dateValue?: string;
  dateTimeValue?: string;
  elementReference?: string;
};

/**
 * Flow start element
 */
export type FlowStart = {
  locationX: number;
  locationY: number;
  connector?: FlowConnector;
  filters?: FlowRecordFilter[];
  object?: string;
  recordTriggerType?: FlowRecordTriggerType;
  schedule?: FlowSchedule;
  triggerType?: FlowTriggerType;
};

/**
 * Flow connector
 */
export type FlowConnector = {
  targetReference: string;
};

/**
 * Flow record filter
 */
export type FlowRecordFilter = {
  field: string;
  operator: FlowComparisonOperator;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow comparison operator
 */
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

/**
 * Flow record trigger type
 */
export type FlowRecordTriggerType = 'Create' | 'Update' | 'CreateAndUpdate' | 'Delete';

/**
 * Flow schedule
 */
export type FlowSchedule = {
  frequency: FlowScheduleFrequency;
  startDate?: string;
  startTime?: string;
};

/**
 * Flow schedule frequency
 */
export type FlowScheduleFrequency = 'Once' | 'Daily' | 'Weekly';

/**
 * Flow trigger type
 */
export type FlowTriggerType = 'Scheduled' | 'RecordBeforeSave' | 'RecordAfterSave' | 'PlatformEvent';

/**
 * Flow action call
 */
export type FlowActionCall = FlowNode & {
  actionName: string;
  actionType: FlowActionType;
  inputParameters?: FlowActionCallInputParameter[];
  outputParameters?: FlowActionCallOutputParameter[];
  storeOutputAutomatically?: boolean;
};

/**
 * Flow node (base for all flow elements)
 */
export type FlowNode = {
  name: string;
  label?: string;
  locationX: number;
  locationY: number;
  connector?: FlowConnector;
  faultConnector?: FlowConnector;
};

/**
 * Flow action type
 */
export type FlowActionType =
  | 'apex'
  | 'emailAlert'
  | 'quickAction'
  | 'submit'
  | 'thanks'
  | 'chatterPost'
  | 'component'
  | 'contentWorkspaceEnableFolders'
  | 'customNotificationAction'
  | 'emailSimple'
  | 'externalService';

/**
 * Flow action call input parameter
 */
export type FlowActionCallInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow action call output parameter
 */
export type FlowActionCallOutputParameter = {
  assignToReference: string;
  name: string;
};

/**
 * Flow apex plugin call
 */
export type FlowApexPluginCall = FlowNode & {
  apexClass: string;
  inputParameters?: FlowApexPluginCallInputParameter[];
  outputParameters?: FlowApexPluginCallOutputParameter[];
};

/**
 * Flow apex plugin call input parameter
 */
export type FlowApexPluginCallInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow apex plugin call output parameter
 */
export type FlowApexPluginCallOutputParameter = {
  assignToReference: string;
  name: string;
};

/**
 * Flow assignment
 */
export type FlowAssignment = FlowNode & {
  assignmentItems: FlowAssignmentItem[];
};

/**
 * Flow assignment item
 */
export type FlowAssignmentItem = {
  assignToReference: string;
  operator: FlowAssignmentOperator;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow assignment operator
 */
export type FlowAssignmentOperator =
  | 'Assign'
  | 'Add'
  | 'Subtract'
  | 'AddItem'
  | 'RemoveFirst'
  | 'RemoveBeforeFirst'
  | 'RemoveAfterFirst'
  | 'RemoveAll';

/**
 * Flow decision
 */
export type FlowDecision = FlowNode & {
  defaultConnector?: FlowConnector;
  defaultConnectorLabel?: string;
  rules: FlowRule[];
};

/**
 * Flow rule
 */
export type FlowRule = {
  name: string;
  conditionLogic?: string;
  conditions: FlowCondition[];
  connector?: FlowConnector;
  label: string;
};

/**
 * Flow condition
 */
export type FlowCondition = {
  leftValueReference: string;
  operator: FlowComparisonOperator;
  rightValue?: FlowElementReferenceOrValue;
};

/**
 * Flow loop
 */
export type FlowLoop = FlowNode & {
  collectionReference: string;
  iterationOrder?: FlowIterationOrder;
  nextValueConnector?: FlowConnector;
  noMoreValuesConnector?: FlowConnector;
};

/**
 * Flow iteration order
 */
export type FlowIterationOrder = 'Asc' | 'Desc';

/**
 * Flow record create
 */
export type FlowRecordCreate = FlowNode & {
  object: string;
  inputAssignments?: FlowInputFieldAssignment[];
  inputReference?: string;
  storeOutputAutomatically?: boolean;
};

/**
 * Flow input field assignment
 */
export type FlowInputFieldAssignment = {
  field: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow record delete
 */
export type FlowRecordDelete = FlowNode & {
  filters?: FlowRecordFilter[];
  inputReference?: string;
  object?: string;
};

/**
 * Flow record lookup
 */
export type FlowRecordLookup = FlowNode & {
  object: string;
  filters?: FlowRecordFilter[];
  getFirstRecordOnly?: boolean;
  outputAssignments?: FlowOutputFieldAssignment[];
  outputReference?: string;
  queriedFields?: string[];
  sortField?: string;
  sortOrder?: FlowSortOrder;
  storeOutputAutomatically?: boolean;
};

/**
 * Flow output field assignment
 */
export type FlowOutputFieldAssignment = {
  assignToReference: string;
  field: string;
};

/**
 * Flow sort order
 */
export type FlowSortOrder = 'Asc' | 'Desc';

/**
 * Flow record update
 */
export type FlowRecordUpdate = FlowNode & {
  filters?: FlowRecordFilter[];
  inputAssignments?: FlowInputFieldAssignment[];
  inputReference?: string;
  object?: string;
};

/**
 * Flow screen
 */
export type FlowScreen = FlowNode & {
  allowBack?: boolean;
  allowFinish?: boolean;
  allowPause?: boolean;
  fields?: FlowScreenField[];
  helpText?: string;
  pausedText?: string;
  rules?: FlowScreenRule[];
  showFooter?: boolean;
  showHeader?: boolean;
};

/**
 * Flow screen field
 */
export type FlowScreenField = {
  name: string;
  fieldType: FlowScreenFieldType;
  dataType?: FlowDataType;
  defaultValue?: FlowElementReferenceOrValue;
  extensionName?: string;
  fieldText?: string;
  helpText?: string;
  inputParameters?: FlowScreenFieldInputParameter[];
  isRequired?: boolean;
  outputParameters?: FlowScreenFieldOutputParameter[];
  scale?: number;
  validationRule?: FlowInputValidationRule;
  visibilityRule?: FlowVisibilityRule;
};

/**
 * Flow screen field type
 */
export type FlowScreenFieldType =
  | 'DisplayText'
  | 'InputField'
  | 'LargeTextArea'
  | 'PasswordField'
  | 'RadioButtons'
  | 'DropdownBox'
  | 'MultiSelectCheckboxes'
  | 'MultiSelectPicklist'
  | 'ComponentInstance';

/**
 * Flow data type
 */
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

/**
 * Flow screen field input parameter
 */
export type FlowScreenFieldInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow screen field output parameter
 */
export type FlowScreenFieldOutputParameter = {
  assignToReference: string;
  name: string;
};

/**
 * Flow input validation rule
 */
export type FlowInputValidationRule = {
  errorMessage: string;
  formulaExpression: string;
};

/**
 * Flow visibility rule
 */
export type FlowVisibilityRule = {
  conditionLogic?: string;
  conditions: FlowCondition[];
};

/**
 * Flow screen rule
 */
export type FlowScreenRule = {
  name: string;
  conditionLogic?: string;
  conditions: FlowCondition[];
  label: string;
  ruleActions: FlowScreenRuleAction[];
};

/**
 * Flow screen rule action
 */
export type FlowScreenRuleAction = {
  attribute: string;
  fieldReference: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow subflow
 */
export type FlowSubflow = FlowNode & {
  flowName: string;
  inputAssignments?: FlowSubflowInputAssignment[];
  outputAssignments?: FlowSubflowOutputAssignment[];
  storeOutputAutomatically?: boolean;
};

/**
 * Flow subflow input assignment
 */
export type FlowSubflowInputAssignment = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow subflow output assignment
 */
export type FlowSubflowOutputAssignment = {
  assignToReference: string;
  name: string;
};

/**
 * Flow variable
 */
export type FlowVariable = {
  name: string;
  dataType: FlowDataType;
  isCollection?: boolean;
  isInput?: boolean;
  isOutput?: boolean;
  objectType?: string;
  scale?: number;
  value?: FlowElementReferenceOrValue;
};

/**
 * Flow constant
 */
export type FlowConstant = {
  name: string;
  dataType: FlowDataType;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow formula
 */
export type FlowFormula = {
  name: string;
  dataType: FlowDataType;
  expression: string;
  scale?: number;
};

/**
 * Flow dynamic choice set
 */
export type FlowDynamicChoiceSet = {
  name: string;
  dataType: FlowDataType;
  displayField: string;
  object: string;
  outputAssignments?: FlowOutputFieldAssignment[];
  picklistField?: string;
  picklistObject?: string;
  sortField?: string;
  sortOrder?: FlowSortOrder;
  valueField?: string;
};

/**
 * Flow text template
 */
export type FlowTextTemplate = {
  name: string;
  text: string;
};

/**
 * Flow stage
 */
export type FlowStage = {
  name: string;
  label: string;
  isActive: boolean;
};

/**
 * Flow transform
 */
export type FlowTransform = FlowNode & {
  apexClass: string;
  inputParameters?: FlowTransformInputParameter[];
  outputParameters?: FlowTransformOutputParameter[];
};

/**
 * Flow transform input parameter
 */
export type FlowTransformInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow transform output parameter
 */
export type FlowTransformOutputParameter = {
  assignToReference: string;
  name: string;
};

/**
 * Flow wait
 */
export type FlowWait = FlowNode & {
  waitEvents: FlowWaitEvent[];
  defaultConnector?: FlowConnector;
  defaultConnectorLabel?: string;
};

/**
 * Flow wait event
 */
export type FlowWaitEvent = {
  name: string;
  label: string;
  conditionLogic?: string;
  conditions: FlowCondition[];
  connector?: FlowConnector;
  eventType: string;
  inputParameters?: FlowWaitEventInputParameter[];
  outputParameters?: FlowWaitEventOutputParameter[];
};

/**
 * Flow wait event input parameter
 */
export type FlowWaitEventInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

/**
 * Flow wait event output parameter
 */
export type FlowWaitEventOutputParameter = {
  assignToReference: string;
  name: string;
};
