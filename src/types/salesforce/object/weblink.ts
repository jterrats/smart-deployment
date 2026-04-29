/**
 * Web link and action override types for Salesforce Object metadata.
 */

import type { Encoding } from '../common.js';

/**
 * Action override
 */
export type ActionOverride = {
  actionName: string;
  comment?: string;
  content?: string;
  formFactor?: FormFactor;
  skipRecordTypeSelect?: boolean;
  type: ActionOverrideType;
};

/**
 * Form factor
 */
export type FormFactor = 'Small' | 'Medium' | 'Large';

/**
 * Action override type
 */
export type ActionOverrideType =
  | 'Default'
  | 'Standard'
  | 'Scontrol'
  | 'Visualforce'
  | 'Flexipage'
  | 'LightningComponent';

/**
 * Web link
 */
export type WebLink = {
  fullName: string;
  availability: WebLinkAvailability;
  description?: string;
  displayType: WebLinkDisplayType;
  encodingKey?: Encoding;
  hasMenubar?: boolean;
  hasScrollbars?: boolean;
  hasToolbar?: boolean;
  height?: number;
  isResizable?: boolean;
  linkType: WebLinkType;
  masterLabel?: string;
  openType: WebLinkWindowType;
  page?: string;
  position?: WebLinkPosition;
  protected: boolean;
  requireRowSelection?: boolean;
  scontrol?: string;
  showsLocation?: boolean;
  showsStatus?: boolean;
  url?: string;
  width?: number;
};

/**
 * Web link availability
 */
export type WebLinkAvailability = 'online' | 'offline';

/**
 * Web link display type
 */
export type WebLinkDisplayType = 'link' | 'button' | 'massActionButton';

/**
 * Web link type
 */
export type WebLinkType = 'url' | 'sControl' | 'javascript' | 'page' | 'flow';

/**
 * Web link window type
 */
export type WebLinkWindowType = 'newWindow' | 'sidebar' | 'noSidebar' | 'replace' | 'onClickJavaScript';

/**
 * Web link position
 */
export type WebLinkPosition = 'fullScreen' | 'none' | 'topLeft';
