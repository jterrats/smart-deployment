/**
 * Type definitions for Salesforce FlexiPage metadata
 * Represents Lightning Page (.flexipage-meta.xml) metadata structures
 */

// Re-export shared types from layout.ts to avoid duplication
import type {
  PlatformActionList,
  QuickActionList,
} from './layout.js';

export type { PlatformActionList, QuickActionList };

/**
 * FlexiPage metadata (.flexipage-meta.xml)
 */
export type FlexiPageMetadata = {
  description?: string;
  flexiPageRegions?: FlexiPageRegion[];
  masterLabel: string;
  sobjectType?: string;
  template?: FlexiPageTemplateInstance;
  type: FlexiPageType;
  events?: FlexiPageEvent[];
  parentFlexiPage?: string;
  platformActionList?: PlatformActionList;
  quickActionList?: QuickActionList;
};

/**
 * FlexiPage Type
 */
export type FlexiPageType =
  | 'AppPage'
  | 'HomePage'
  | 'RecordPage'
  | 'CommAppPage'
  | 'CommForgotPasswordPage'
  | 'CommLoginPage'
  | 'CommObjectPage'
  | 'CommSearchResultPage'
  | 'CommSelfRegisterPage'
  | 'CommThemeLayoutPage'
  | 'UtilityBar'
  | 'FlowScreen';

/**
 * FlexiPage Region
 */
export type FlexiPageRegion = {
  appendable?: RegionFlagStatus;
  itemInstances?: ItemInstance[];
  mode?: FlexiPageRegionMode;
  name: string;
  prependable?: RegionFlagStatus;
  replaceable?: RegionFlagStatus;
  type: FlexiPageRegionType;
};

/**
 * FlexiPage Region Type
 */
export type FlexiPageRegionType = 'Region' | 'Background' | 'Facet';

/**
 * FlexiPage Region Mode
 */
export type FlexiPageRegionMode = 'Append' | 'Prepend' | 'Replace';

/**
 * Region Flag Status
 */
export type RegionFlagStatus = 'Default' | 'false';

/**
 * Item Instance
 */
export type ItemInstance = {
  componentInstance?: ComponentInstance;
  fieldInstance?: FieldInstance;
};

/**
 * Component Instance
 */
export type ComponentInstance = {
  componentInstanceProperties?: ComponentInstanceProperty[];
  componentName: string;
  identifier?: string;
  visibilityRule?: UiFormulaRule;
};

/**
 * Component Instance Property
 */
export type ComponentInstanceProperty = {
  name: string;
  type?: ComponentInstancePropertyTypeEnum;
  value?: string;
  valueList?: ComponentInstancePropertyList;
};

/**
 * Component Instance Property Type
 */
export type ComponentInstancePropertyTypeEnum = 'decorator' | 'string';

/**
 * Component Instance Property List
 */
export type ComponentInstancePropertyList = {
  valueListItems?: ComponentInstancePropertyListItem[];
};

/**
 * Component Instance Property List Item
 */
export type ComponentInstancePropertyListItem = {
  value: string;
  visibilityRule?: UiFormulaRule;
};

/**
 * Field Instance
 */
export type FieldInstance = {
  fieldInstanceProperties?: FieldInstanceProperty[];
  fieldItem: string;
  identifier?: string;
  visibilityRule?: UiFormulaRule;
};

/**
 * Field Instance Property
 */
export type FieldInstanceProperty = {
  name: string;
  value?: string;
};

/**
 * UI Formula Rule
 */
export type UiFormulaRule = {
  booleanFilter?: string;
  criteria?: UiFormulaCriterion[];
};

/**
 * UI Formula Criterion
 */
export type UiFormulaCriterion = {
  leftValue: string;
  operator: string;
  rightValue?: string;
};

/**
 * FlexiPage Template Instance
 */
export type FlexiPageTemplateInstance = {
  name: string;
  properties?: FlexiPageTemplateProperty[];
};

/**
 * FlexiPage Template Property
 */
export type FlexiPageTemplateProperty = {
  name: string;
  type?: FlexiPageTemplatePropertyType;
  value?: string;
};

/**
 * FlexiPage Template Property Type
 */
export type FlexiPageTemplatePropertyType = 'string' | 'integer' | 'boolean';

/**
 * FlexiPage Event
 */
export type FlexiPageEvent = {
  name: string;
  type: string;
};

// Re-export additional shared types from layout.ts
export type {
  PlatformActionListContext,
  PlatformActionListItem,
  PlatformActionType,
  QuickActionListItem,
} from './layout.js';

