import type { FlowElementReferenceOrValue, FlowNode, FlowSortOrder } from './common.js';
import type { FlowRecordFilter } from './start.js';

export type FlowInputFieldAssignment = {
  field: string;
  value: FlowElementReferenceOrValue;
};

export type FlowOutputFieldAssignment = {
  assignToReference: string;
  field: string;
};

export type FlowRecordCreate = FlowNode & {
  object: string;
  inputAssignments?: FlowInputFieldAssignment[];
  inputReference?: string;
  storeOutputAutomatically?: boolean;
};

export type FlowRecordDelete = FlowNode & {
  filters?: FlowRecordFilter[];
  inputReference?: string;
  object?: string;
};

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

export type FlowRecordUpdate = FlowNode & {
  filters?: FlowRecordFilter[];
  inputAssignments?: FlowInputFieldAssignment[];
  inputReference?: string;
  object?: string;
};
