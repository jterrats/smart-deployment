/**
 * Type definitions for Salesforce Layout metadata
 * Represents Page Layout (.layout-meta.xml) metadata structures
 */

/**
 * Layout metadata (.layout-meta.xml)
 */
export type LayoutMetadata = {
  customButtons?: string[];
  emailDefault?: boolean;
  excludeButtons?: string[];
  feedLayout?: FeedLayout;
  headers?: LayoutHeader[];
  layoutSections?: LayoutSection[];
  miniLayout?: MiniLayout;
  multilineLayoutFields?: string[];
  platformActionList?: PlatformActionList;
  quickActionList?: QuickActionList;
  relatedContent?: RelatedContent;
  relatedLists?: RelatedListItem[];
  relatedObjects?: string[];
  runAssignmentRulesDefault?: boolean;
  showEmailCheckbox?: boolean;
  showHighlightsPanel?: boolean;
  showInteractionLogPanel?: boolean;
  showRunAssignmentRulesCheckbox?: boolean;
  showSubmitAndAttachButton?: boolean;
  summaryLayout?: SummaryLayout;
};

/**
 * Layout Section
 */
export type LayoutSection = {
  customLabel?: boolean;
  detailHeading?: boolean;
  editHeading?: boolean;
  label?: string;
  layoutColumns?: LayoutColumn[];
  style: LayoutSectionStyle;
};

/**
 * Layout Section Style
 */
export type LayoutSectionStyle =
  | 'TwoColumnsTopToBottom'
  | 'TwoColumnsLeftToRight'
  | 'OneColumn'
  | 'CustomLinks';

/**
 * Layout Column
 */
export type LayoutColumn = {
  layoutItems?: LayoutItem[];
  reserved?: string;
};

/**
 * Layout Item
 */
export type LayoutItem = {
  behavior?: UiBehavior;
  canvas?: string;
  customLink?: string;
  emptySpace?: boolean;
  field?: string;
  height?: number;
  page?: string;
  reportChartComponent?: ReportChartComponentLayoutItem;
  scontrol?: string;
  showLabel?: boolean;
  showScrollbars?: boolean;
  width?: string;
};

/**
 * UI Behavior
 */
export type UiBehavior = 'Edit' | 'Required' | 'Readonly';

/**
 * Report Chart Component Layout Item
 */
export type ReportChartComponentLayoutItem = {
  cacheData?: boolean;
  contextFilterableField?: string;
  error?: string;
  hideOnError?: boolean;
  includeContext?: boolean;
  reportName?: string;
  showTitle?: boolean;
  size?: ReportChartComponentSize;
};

/**
 * Report Chart Component Size
 */
export type ReportChartComponentSize = 'Tiny' | 'Small' | 'Medium' | 'Large';

/**
 * Related List Item
 */
export type RelatedListItem = {
  customButtons?: string[];
  excludeButtons?: string[];
  fields?: string[];
  relatedList: string;
  sortField?: string;
  sortOrder?: SortOrder;
};

/**
 * Sort Order
 */
export type SortOrder = 'Asc' | 'Desc';

/**
 * Mini Layout
 */
export type MiniLayout = {
  fields?: string[];
  relatedLists?: RelatedListItem[];
};

/**
 * Feed Layout
 */
export type FeedLayout = {
  autocollapsePublisher?: boolean;
  compactFeed?: boolean;
  feedFilterPosition?: FeedLayoutFilterPosition;
  feedFilters?: FeedLayoutFilter[];
  fullWidthFeed?: boolean;
  hideSidebar?: boolean;
  highlightExternalFeedItems?: boolean;
  leftComponents?: FeedLayoutComponent[];
  rightComponents?: FeedLayoutComponent[];
  useInlineFiltersInConsole?: boolean;
};

/**
 * Feed Layout Filter Position
 */
export type FeedLayoutFilterPosition = 'CenterDropDown' | 'LeftFixed' | 'LeftFloat';

/**
 * Feed Layout Filter
 */
export type FeedLayoutFilter = {
  feedFilterName?: string;
  feedFilterType: FeedLayoutFilterType;
  feedItemType?: FeedItemType;
};

/**
 * Feed Layout Filter Type
 */
export type FeedLayoutFilterType = 'AllUpdates' | 'FeedItemType' | 'Custom';

/**
 * Feed Item Type
 */
export type FeedItemType =
  | 'TrackedChange'
  | 'UserStatus'
  | 'TextPost'
  | 'ContentPost'
  | 'LinkPost'
  | 'PollPost'
  | 'RypplePost'
  | 'ProfileSkillPost'
  | 'DashboardComponentSnapshot'
  | 'ApprovalPost'
  | 'CaseCommentPost'
  | 'ReplyPost'
  | 'EmailMessageEvent'
  | 'CallLogPost'
  | 'ChangeStatusPost'
  | 'AttachArticleEvent'
  | 'MilestoneEvent'
  | 'ActivityEvent'
  | 'ChatPost'
  | 'RichLinkPost'
  | 'AnnouncementPost'
  | 'CreateRecordEvent'
  | 'CanvasPost';

/**
 * Feed Layout Component
 */
export type FeedLayoutComponent = {
  componentType: FeedLayoutComponentType;
  height?: number;
  page?: string;
};

/**
 * Feed Layout Component Type
 */
export type FeedLayoutComponentType =
  | 'Following'
  | 'Followers'
  | 'Topics'
  | 'CustomTab'
  | 'Visualforce'
  | 'Canvas'
  | 'HelpAndToolLinks';

/**
 * Platform Action List
 */
export type PlatformActionList = {
  actionListContext: PlatformActionListContext;
  platformActionListItems?: PlatformActionListItem[];
  relatedSourceEntity?: string;
};

/**
 * Platform Action List Context
 */
export type PlatformActionListContext =
  | 'Chatter'
  | 'ListView'
  | 'Record'
  | 'RelatedList'
  | 'RecordEdit'
  | 'Dockable'
  | 'MobileExtension'
  | 'Global'
  | 'Assistant';

/**
 * Platform Action List Item
 */
export type PlatformActionListItem = {
  actionName: string;
  actionType: PlatformActionType;
  sortOrder: number;
  subtype?: string;
};

/**
 * Platform Action Type
 */
export type PlatformActionType =
  | 'QuickAction'
  | 'StandardButton'
  | 'CustomButton'
  | 'ProductivityAction'
  | 'ActionLink'
  | 'InvocableAction';

/**
 * Quick Action List
 */
export type QuickActionList = {
  quickActionListItems?: QuickActionListItem[];
};

/**
 * Quick Action List Item
 */
export type QuickActionListItem = {
  quickActionName: string;
};

/**
 * Related Content
 */
export type RelatedContent = {
  relatedContentItems?: RelatedContentItem[];
};

/**
 * Related Content Item
 */
export type RelatedContentItem = {
  layoutItem: LayoutItem;
};

/**
 * Summary Layout
 */
export type SummaryLayout = {
  masterLabel: string;
  sizeX: number;
  sizeY?: number;
  sizeZ?: number;
  summaryLayoutItems?: SummaryLayoutItem[];
  summaryLayoutStyle: SummaryLayoutStyle;
};

/**
 * Summary Layout Style
 */
export type SummaryLayoutStyle =
  | 'Default'
  | 'QuoteTemplate'
  | 'DefaultQuoteTemplate'
  | 'ServiceReportTemplate'
  | 'OverridesSummaryLayout'
  | 'CaseInteraction'
  | 'DefaultCaseInteraction';

/**
 * Summary Layout Item
 */
export type SummaryLayoutItem = {
  customLink?: string;
  field?: string;
  posX: number;
  posY: number;
  posZ?: number;
};

/**
 * Layout Header
 */
export type LayoutHeader = 'PersonalTagging' | 'PublicTagging';

