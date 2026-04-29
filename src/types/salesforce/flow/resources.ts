import type { FlowDataType, FlowElementReferenceOrValue, FlowSortOrder } from './common.js';
import type { FlowOutputFieldAssignment } from './records.js';

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

export type FlowConstant = {
  name: string;
  dataType: FlowDataType;
  value: FlowElementReferenceOrValue;
};

export type FlowFormula = {
  name: string;
  dataType: FlowDataType;
  expression: string;
  scale?: number;
};

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

export type FlowTextTemplate = {
  name: string;
  text: string;
};

export type FlowStage = {
  name: string;
  label: string;
  isActive: boolean;
};
