/**
 * Salesforce Metadata Type Models
 * Comprehensive TypeScript type definitions for Salesforce metadata
 *
 * This module provides type-safe models for all major Salesforce metadata types,
 * eliminating the need for `any` types in parsers and improving code quality.
 *
 * @module types/salesforce
 */

// Common Types (shared across multiple metadata types)
export * from './common.js';

// Parser Types (permissive types for parsing unknown/future metadata)
export * from './parser-types.js';

// Apex Types
export * from './apex.js';

// Aura Component Types
export * from './aura.js';

// Email Template Types
export * from './email.js';

// Flow Types
export * from './flow.js';

// Lightning Web Component Types
export * from './lwc.js';

// Custom Object and Field Types
export * from './object.js';

// Permission Set and Profile Types
export * from './permission.js';

// Static Resource and Custom Label Types
export * from './resource.js';

// Visualforce Types
export * from './visualforce.js';
