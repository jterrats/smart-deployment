/**
 * Common types used across multiple Salesforce metadata types
 */

/**
 * Package version reference
 */
export type PackageVersion = {
  majorNumber: number;
  minorNumber: number;
  namespace: string;
};

/**
 * Encoding types supported by Salesforce
 */
export type Encoding =
  | 'UTF-8'
  | 'ISO-8859-1'
  | 'Shift_JIS'
  | 'ISO-2022-JP'
  | 'EUC-JP'
  | 'ks_c_5601-1987'
  | 'Big5'
  | 'GB2312'
  | 'Big5-HKSCS'
  | 'x-SJIS_0213';
