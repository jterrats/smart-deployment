import type { FlowCondition, FlowDataType, FlowElementReferenceOrValue, FlowNode } from './common.js';

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

export type FlowScreenFieldInputParameter = {
  name: string;
  value: FlowElementReferenceOrValue;
};

export type FlowScreenFieldOutputParameter = {
  assignToReference: string;
  name: string;
};

export type FlowInputValidationRule = {
  errorMessage: string;
  formulaExpression: string;
};

export type FlowVisibilityRule = {
  conditionLogic?: string;
  conditions: FlowCondition[];
};

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

export type FlowScreenRuleAction = {
  attribute: string;
  fieldReference: string;
  value: FlowElementReferenceOrValue;
};

export type FlowScreenRule = {
  name: string;
  conditionLogic?: string;
  conditions: FlowCondition[];
  label: string;
  ruleActions: FlowScreenRuleAction[];
};

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
