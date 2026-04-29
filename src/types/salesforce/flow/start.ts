import type { FlowComparisonOperator, FlowConnector, FlowElementReferenceOrValue } from './common.js';

export type FlowRecordFilter = {
  field: string;
  operator: FlowComparisonOperator;
  value: FlowElementReferenceOrValue;
};

export type FlowRecordTriggerType = 'Create' | 'Update' | 'CreateAndUpdate' | 'Delete';

export type FlowScheduleFrequency = 'Once' | 'Daily' | 'Weekly';

export type FlowSchedule = {
  frequency: FlowScheduleFrequency;
  startDate?: string;
  startTime?: string;
};

export type FlowTriggerType = 'Scheduled' | 'RecordBeforeSave' | 'RecordAfterSave' | 'PlatformEvent';

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
