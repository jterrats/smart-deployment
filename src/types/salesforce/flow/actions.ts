import type { FlowCondition, FlowConnector, FlowElementReferenceOrValue, FlowNode } from './common.js';

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

export type FlowActionCallInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowActionCallOutputParameter = {
  assignToReference: string;
  name: string;
};

export type FlowActionCall = FlowNode & {
  actionName: string;
  actionType: FlowActionType;
  inputParameters?: FlowActionCallInputParameter[];
  outputParameters?: FlowActionCallOutputParameter[];
  storeOutputAutomatically?: boolean;
};

export type FlowApexPluginCallInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowApexPluginCallOutputParameter = {
  assignToReference: string;
  name: string;
};

export type FlowApexPluginCall = FlowNode & {
  apexClass: string;
  inputParameters?: FlowApexPluginCallInputParameter[];
  outputParameters?: FlowApexPluginCallOutputParameter[];
};

export type FlowAssignmentOperator =
  | 'Assign'
  | 'Add'
  | 'Subtract'
  | 'AddItem'
  | 'RemoveFirst'
  | 'RemoveBeforeFirst'
  | 'RemoveAfterFirst'
  | 'RemoveAll';

export type FlowAssignmentItem = {
  assignToReference: string;
  operator: FlowAssignmentOperator;
  value: FlowElementReferenceOrValue;
};

export type FlowAssignment = FlowNode & {
  assignmentItems: FlowAssignmentItem[];
};

export type FlowRule = {
  name: string;
  conditionLogic?: string;
  conditions: FlowCondition[];
  connector?: FlowConnector;
  label: string;
};

export type FlowDecision = FlowNode & {
  defaultConnector?: FlowConnector;
  defaultConnectorLabel?: string;
  rules: FlowRule[];
};

export type FlowIterationOrder = 'Asc' | 'Desc';

export type FlowLoop = FlowNode & {
  collectionReference: string;
  iterationOrder?: FlowIterationOrder;
  nextValueConnector?: FlowConnector;
  noMoreValuesConnector?: FlowConnector;
};

export type FlowSubflowInputAssignment = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowSubflowOutputAssignment = {
  assignToReference: string;
  name: string;
};

export type FlowSubflow = FlowNode & {
  flowName: string;
  inputAssignments?: FlowSubflowInputAssignment[];
  outputAssignments?: FlowSubflowOutputAssignment[];
  storeOutputAutomatically?: boolean;
};

export type FlowTransformInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowTransformOutputParameter = {
  assignToReference: string;
  name: string;
};

export type FlowTransform = FlowNode & {
  apexClass: string;
  inputParameters?: FlowTransformInputParameter[];
  outputParameters?: FlowTransformOutputParameter[];
};

export type FlowWaitEventInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowWaitEventOutputParameter = {
  assignToReference: string;
  name: string;
};

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

export type FlowWait = FlowNode & {
  waitEvents: FlowWaitEvent[];
  defaultConnector?: FlowConnector;
  defaultConnectorLabel?: string;
};
