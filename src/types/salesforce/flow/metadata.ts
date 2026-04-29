import type {
  FlowCondition,
  FlowComparisonOperator,
  FlowConnector,
  FlowDataType,
  FlowElementReferenceOrValue,
  FlowMetadataValue,
  FlowNode,
  FlowProcessType,
  FlowSortOrder,
  FlowStatus,
} from './common.js';
import type {
  FlowActionCall,
  FlowActionCallInputParameter,
  FlowActionCallOutputParameter,
  FlowActionType,
  FlowApexPluginCall,
  FlowApexPluginCallInputParameter,
  FlowApexPluginCallOutputParameter,
  FlowAssignment,
  FlowAssignmentItem,
  FlowAssignmentOperator,
  FlowDecision,
  FlowIterationOrder,
  FlowLoop,
  FlowRule,
  FlowSubflow,
  FlowSubflowInputAssignment,
  FlowSubflowOutputAssignment,
  FlowTransform,
  FlowTransformInputParameter,
  FlowTransformOutputParameter,
  FlowWait,
  FlowWaitEvent,
  FlowWaitEventInputParameter,
  FlowWaitEventOutputParameter,
} from './actions.js';
import type {
  FlowInputFieldAssignment,
  FlowOutputFieldAssignment,
  FlowRecordCreate,
  FlowRecordDelete,
  FlowRecordLookup,
  FlowRecordUpdate,
} from './records.js';
import type {
  FlowConstant,
  FlowDynamicChoiceSet,
  FlowFormula,
  FlowStage,
  FlowTextTemplate,
  FlowVariable,
} from './resources.js';
import type {
  FlowInputValidationRule,
  FlowScreen,
  FlowScreenField,
  FlowScreenFieldInputParameter,
  FlowScreenFieldOutputParameter,
  FlowScreenFieldType,
  FlowScreenRule,
  FlowScreenRuleAction,
  FlowVisibilityRule,
} from './screens.js';
import type {
  FlowRecordFilter,
  FlowRecordTriggerType,
  FlowSchedule,
  FlowScheduleFrequency,
  FlowStart,
  FlowTriggerType,
} from './start.js';

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

export type {
  FlowActionCall,
  FlowActionCallInputParameter,
  FlowActionCallOutputParameter,
  FlowActionType,
  FlowApexPluginCall,
  FlowApexPluginCallInputParameter,
  FlowApexPluginCallOutputParameter,
  FlowAssignment,
  FlowAssignmentItem,
  FlowAssignmentOperator,
  FlowComparisonOperator,
  FlowCondition,
  FlowConnector,
  FlowConstant,
  FlowDataType,
  FlowDecision,
  FlowDynamicChoiceSet,
  FlowElementReferenceOrValue,
  FlowFormula,
  FlowInputFieldAssignment,
  FlowInputValidationRule,
  FlowIterationOrder,
  FlowLoop,
  FlowMetadataValue,
  FlowNode,
  FlowOutputFieldAssignment,
  FlowProcessType,
  FlowRecordCreate,
  FlowRecordDelete,
  FlowRecordFilter,
  FlowRecordLookup,
  FlowRecordTriggerType,
  FlowRecordUpdate,
  FlowRule,
  FlowSchedule,
  FlowScheduleFrequency,
  FlowScreen,
  FlowScreenField,
  FlowScreenFieldInputParameter,
  FlowScreenFieldOutputParameter,
  FlowScreenFieldType,
  FlowScreenRule,
  FlowScreenRuleAction,
  FlowSortOrder,
  FlowStage,
  FlowStart,
  FlowStatus,
  FlowSubflow,
  FlowSubflowInputAssignment,
  FlowSubflowOutputAssignment,
  FlowTextTemplate,
  FlowTransform,
  FlowTransformInputParameter,
  FlowTransformOutputParameter,
  FlowTriggerType,
  FlowVariable,
  FlowVisibilityRule,
  FlowWait,
  FlowWaitEvent,
  FlowWaitEventInputParameter,
  FlowWaitEventOutputParameter,
};
