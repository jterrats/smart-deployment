# 📋 User Stories - Smart Deployment Plugin

## 🎯 Overview

This document contains user stories derived from the Smart Deployment Plugin architecture and requirements. Stories are organized by epics and prioritized using MoSCoW method (Must Have, Should Have, Could Have, Won't Have).

---

## 📊 Epic Summary

| Epic                           | Stories | Priority    | Story Points |
| ------------------------------ | ------- | ----------- | ------------ |
| **E1: Core Infrastructure**    | 12      | Must Have   | 34           |
| **E2: Metadata Parsers**       | 15      | Must Have   | 55           |
| **E3: Dependency Analysis**    | 10      | Must Have   | 34           |
| **E4: Wave Generation**        | 8       | Must Have   | 21           |
| **E5: CLI Commands**           | 8       | Must Have   | 21           |
| **E6: Agentforce Integration** | 7       | Should Have | 21           |
| **E7: Testing Infrastructure** | 10      | Must Have   | 34           |
| **E8: Error Handling**         | 8       | Should Have | 21           |
| **E9: Project Scanner**        | 6       | Must Have   | 13           |
| **E10: Deployment Execution**  | 6       | Must Have   | 21           |
| **TOTAL**                      | **90**  | -           | **275**      |

---

## 🏗️ EPIC 1: Core Infrastructure

**Goal**: Establish foundational architecture and utilities

### US-001: Functional Utilities

**As a** developer
**I want** functional programming utilities (pipe, compose, curry, memoize)
**So that** I can build composable data pipelines

**Acceptance Criteria**:

- [ ] `pipe()` function executes functions left-to-right
- [ ] `compose()` function executes functions right-to-left
- [ ] `curry()` function enables partial application
- [ ] `memoize()` function caches results based on arguments
- [ ] All utilities work with both sync and async functions
- [ ] Type safety is maintained through TypeScript generics

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: None

---

### US-002: Graph Algorithms

**As a** developer
**I want** graph algorithm utilities (topological sort, cycle detection)
**So that** I can order metadata dependencies correctly

**Acceptance Criteria**:

- [ ] `topologicalSort()` returns components in dependency order
- [ ] `detectCycles()` identifies circular dependencies
- [ ] `calculateDepth()` determines dependency depth
- [ ] `findShortestPath()` finds path between components
- [ ] Algorithms handle graphs with 1000+ nodes efficiently
- [ ] Performance benchmarks < 1 second for 1000 nodes

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: None

---

### US-003: File System Utilities

**As a** developer
**I want** file system utilities with proper error handling
**So that** I can safely read and scan project files

**Acceptance Criteria**:

- [ ] `readProjectFile()` reads files with encoding detection
- [ ] `scanDirectory()` recursively scans with glob patterns
- [ ] `parseXml()` parses XML with namespace support
- [ ] Handles permission errors gracefully
- [ ] Supports symlinks and large files
- [ ] Proper error messages with file paths

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: None

---

### US-004: Salesforce Limits Constants

**As a** developer
**I want** predefined Salesforce API limits
**So that** I can respect deployment constraints

**Acceptance Criteria**:

- [ ] MAX_COMPONENTS_PER_WAVE = 300
- [ ] MAX_CMT_RECORDS_PER_WAVE = 200
- [ ] MAX_FILES_PER_DEPLOYMENT = 500
- [ ] API_TIMEOUT_MS = 600000 (10 minutes)
- [ ] Constants are documented with reasons
- [ ] Constants are not user-configurable

**Priority**: Must Have
**Story Points**: 1
**Dependencies**: None

---

### US-005: Deployment Order Constants

**As a** developer
**I want** predefined metadata deployment order
**So that** I can prioritize metadata correctly

**Acceptance Criteria**:

- [ ] CustomObject = priority 1
- [ ] CustomField = priority 2
- [ ] ApexClass = priority 10
- [ ] ApexTrigger = priority 11
- [ ] Flow = priority 20
- [ ] All 50+ metadata types have order defined
- [ ] Order follows Salesforce best practices

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: None

---

### US-006: Metadata Type Definitions

**As a** developer
**I want** TypeScript type definitions for all metadata
**So that** I have type safety and autocomplete

**Acceptance Criteria**:

- [ ] `MetadataComponent` interface defined
- [ ] `DependencyNode` interface defined
- [ ] `DeploymentWave` interface defined
- [ ] 50+ metadata type enums defined
- [ ] All interfaces are exported
- [ ] Documentation comments for each type

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: None

---

### US-007: Logger Utility

**As a** developer
**I want** a standardized logging utility
**So that** I can debug and monitor the plugin

**Acceptance Criteria**:

- [ ] Supports log levels (debug, info, warn, error)
- [ ] Timestamps are included
- [ ] Context information is captured
- [ ] Can log to file and console
- [ ] Performance metrics are logged
- [ ] Structured logging format (JSON)

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: None

---

### US-008: Error Types

**As a** developer
**I want** custom error types for different failure scenarios
**So that** I can handle errors appropriately

**Acceptance Criteria**:

- [ ] `ParseError` for parsing failures
- [ ] `DependencyError` for dependency issues
- [ ] `DeploymentError` for deployment failures
- [ ] `ValidationError` for validation issues
- [ ] All errors include context and suggestions
- [ ] Errors are serializable

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: None

---

### US-009: Cache Manager

**As a** developer
**I want** a cache manager for expensive operations
**So that** I can improve performance

**Acceptance Criteria**:

- [ ] In-memory cache with TTL
- [ ] Cache invalidation strategies
- [ ] Cache size limits
- [ ] Cache hit/miss metrics
- [ ] Persistent cache option (file)
- [ ] Thread-safe operations

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: None

---

### US-010: XML Utils

**As a** developer
**I want** XML parsing and generation utilities
**So that** I can work with Salesforce metadata

**Acceptance Criteria**:

- [ ] Parse XML to JavaScript objects
- [ ] Generate XML from objects
- [ ] Handle namespaces correctly
- [ ] Validate XML against schema
- [ ] Pretty-print XML output
- [ ] Handle large XML files (streaming)

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: None

---

### US-011: String Utilities

**As a** developer
**I want** string manipulation utilities
**So that** I can process metadata content

**Acceptance Criteria**:

- [ ] `removeComments()` for Apex/JavaScript
- [ ] `extractClassName()` from file content
- [ ] `camelCase()`, `kebabCase()`, `snakeCase()` conversions
- [ ] `sanitize()` for XML special characters
- [ ] Regex utilities for common patterns
- [ ] Unicode handling

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: None

---

### US-012: Performance Monitoring

**As a** developer
**I want** performance monitoring utilities
**So that** I can optimize slow operations

**Acceptance Criteria**:

- [ ] Execution time tracking
- [ ] Memory usage tracking
- [ ] Operation profiling
- [ ] Performance reports
- [ ] Bottleneck identification
- [ ] Benchmark comparisons

**Priority**: Could Have
**Story Points**: 3
**Dependencies**: US-007

---

## 🔍 EPIC 2: Metadata Parsers

**Goal**: Implement parsers for all supported metadata types

### US-013: Apex Class Parser

**As a** developer
**I want** to parse Apex classes and extract dependencies
**So that** I can build the dependency graph

**Acceptance Criteria**:

- [ ] Extract `extends` relationships
- [ ] Extract `implements` relationships
- [ ] Extract static method calls
- [ ] Extract object instantiations
- [ ] Extract variable declarations
- [ ] Handle inner classes
- [ ] Ignore standard classes (System.\*, etc.)
- [ ] Handle managed packages
- [ ] Remove comments before parsing
- [ ] Handle Type.forName() dynamic instantiation

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-010, US-011

---

### US-014: Apex Trigger Parser

**As a** developer
**I want** to parse Apex triggers and extract dependencies
**So that** I can ensure triggers deploy with handlers

**Acceptance Criteria**:

- [ ] Extract trigger object (Account, etc.)
- [ ] Extract handler class references
- [ ] Detect trigger events (before insert, etc.)
- [ ] Link trigger to handler classes
- [ ] Handle multiple handlers per trigger
- [ ] Extract variable declarations

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-013

---

### US-015: Flow Parser

**As a** developer
**I want** to parse Flows and extract dependencies
**So that** I can handle Flow deployments correctly

**Acceptance Criteria**:

- [ ] Extract Apex action references
- [ ] Extract subflow references
- [ ] Extract record references (objects)
- [ ] Extract GenAI prompt references
- [ ] Extract screen flow fields
- [ ] Extract decision logic
- [ ] Handle all flow types (screen, record-triggered, scheduled)
- [ ] Parse flow metadata XML correctly

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-010

---

### US-016: LWC Parser

**As a** developer
**I want** to parse Lightning Web Components
**So that** I can track frontend dependencies

**Acceptance Criteria**:

- [ ] Extract Apex imports (`@salesforce/apex`)
- [ ] Extract LWC imports (`c/componentName`)
- [ ] Extract wire adapter usage
- [ ] Extract @api property dependencies
- [ ] Extract navigation references
- [ ] Handle TypeScript components
- [ ] Validate bundle structure (js, html, xml)
- [ ] Parse js-meta.xml correctly

**Priority**: Must Have
**Story Points**: 4
**Dependencies**: US-010

---

### US-017: Aura Component Parser

**As a** developer
**I want** to parse Aura components
**So that** I can support legacy Lightning components

**Acceptance Criteria**:

- [ ] Extract controller Apex class
- [ ] Extract helper dependencies
- [ ] Extract child component references
- [ ] Extract event references
- [ ] Extract interface implementations
- [ ] Validate bundle structure
- [ ] Parse all bundle files (.cmp, .js, .css, etc.)

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-018: Custom Object Parser

**As a** developer
**I want** to parse Custom Objects and fields
**So that** I can handle object deployments

**Acceptance Criteria**:

- [ ] Extract field definitions
- [ ] Extract validation rules
- [ ] Extract workflow rules
- [ ] Extract record types
- [ ] Extract lookup/master-detail relationships
- [ ] Extract formula field dependencies
- [ ] Group object with its fields
- [ ] Handle compound objects correctly

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-010

---

### US-019: Permission Set Parser

**As a** developer
**I want** to parse Permission Sets
**So that** I can ensure permissions deploy after metadata

**Acceptance Criteria**:

- [ ] Extract object permissions
- [ ] Extract field permissions
- [ ] Extract Apex class permissions
- [ ] Extract custom permission references
- [ ] Extract application permissions
- [ ] Extract tab visibility
- [ ] Link to dependent metadata

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-020: Profile Parser

**As a** developer
**I want** to parse Profiles
**So that** I can handle profile deployments

**Acceptance Criteria**:

- [ ] Extract object permissions
- [ ] Extract field permissions
- [ ] Extract Apex class permissions
- [ ] Extract page layout assignments
- [ ] Extract record type visibility
- [ ] Extract application assignments
- [ ] Link to dependent metadata

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-021: Layout Parser

**As a** developer
**I want** to parse Page Layouts
**So that** I can track layout dependencies

**Acceptance Criteria**:

- [ ] Extract related object
- [ ] Extract custom button references
- [ ] Extract Visualforce page references
- [ ] Extract field references
- [ ] Extract related list references
- [ ] Link to dependent metadata

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-010

---

### US-022: FlexiPage Parser

**As a** developer
**I want** to parse FlexiPages (Lightning Pages)
**So that** I can handle Lightning page deployments

**Acceptance Criteria**:

- [ ] Extract LWC component references
- [ ] Extract Aura component references
- [ ] Extract object references
- [ ] Extract record type filters
- [ ] Extract region configurations
- [ ] Link to all component dependencies

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-023: Visualforce Parser

**As a** developer
**I want** to parse Visualforce pages
**So that** I can track controller dependencies

**Acceptance Criteria**:

- [ ] Extract controller class
- [ ] Extract extension classes
- [ ] Extract custom component references
- [ ] Extract standard component usage
- [ ] Parse inline Apex expressions
- [ ] Link to Apex dependencies

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-024: Bot Parser

**As a** developer
**I want** to parse Einstein Bots
**So that** I can handle Bot deployments

**Acceptance Criteria**:

- [ ] Extract dialog references
- [ ] Extract GenAI prompt references
- [ ] Extract Flow references
- [ ] Extract Apex action references
- [ ] Extract menu item references
- [ ] Link to all dependencies

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-025: GenAI Prompt Parser

**As a** developer
**I want** to parse GenAI Prompt Templates
**So that** I can handle AI-powered feature deployments

**Acceptance Criteria**:

- [ ] Extract related object references
- [ ] Extract field references in prompts
- [ ] Extract model configurations
- [ ] Detect circular dependencies with Flows
- [ ] Link to dependent metadata

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-010

---

### US-026: Custom Metadata Parser

**As a** developer
**I want** to parse Custom Metadata Type definitions
**So that** I can handle CMT deployments

**Acceptance Criteria**:

- [ ] Extract field definitions
- [ ] Extract relationship references
- [ ] Group type with records
- [ ] Identify CMT records separately
- [ ] Handle CMT splitting (200 records/wave)

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-010

---

### US-027: Parser Factory

**As a** developer
**I want** a parser factory that selects the right parser
**So that** I can parse any metadata type

**Acceptance Criteria**:

- [ ] Detect metadata type by file extension
- [ ] Detect metadata type by directory structure
- [ ] Detect metadata type by XML content
- [ ] Return appropriate parser instance
- [ ] Handle unknown metadata types gracefully
- [ ] Cache parser instances

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-013 to US-025

---

## 🔗 EPIC 3: Dependency Analysis

**Goal**: Build and analyze dependency graphs

### US-028: Dependency Graph Builder

**As a** developer
**I want** to build a dependency graph from parsed components
**So that** I can analyze relationships

**Acceptance Criteria**:

- [ ] Add nodes for each component
- [ ] Add edges for each dependency
- [ ] Handle bidirectional dependencies
- [ ] Track dependency types (hard, soft)
- [ ] Support incremental graph building
- [ ] Validate graph structure

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-002

---

### US-029: Heuristic Analyzer

**As a** developer
**I want** intelligent heuristics to infer dependencies
**So that** I can detect non-obvious relationships

**Acceptance Criteria**:

- [ ] Test class → Production class inference
- [ ] Handler → Service pattern detection
- [ ] Trigger → Handler pattern detection
- [ ] Controller → Service pattern detection
- [ ] Naming convention analysis
- [ ] Confidence scoring for inferences

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-028

---

### US-030: Circular Dependency Detector

**As a** developer
**I want** to detect circular dependencies
**So that** I can break or warn about cycles

**Acceptance Criteria**:

- [ ] Detect simple cycles (A→B→A)
- [ ] Detect complex cycles (A→B→C→A)
- [ ] Report all nodes in cycle
- [ ] Suggest where to break cycle
- [ ] Support user-defined cycle breaks
- [ ] Handle multiple separate cycles

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-002, US-028

---

### US-031: Dependency Depth Calculator

**As a** developer
**I want** to calculate dependency depth for each component
**So that** I can identify high-risk components

**Acceptance Criteria**:

- [ ] Calculate depth from leaf nodes
- [ ] Identify components with depth > 10 (warning)
- [ ] Generate depth distribution report
- [ ] Highlight critical path components
- [ ] Consider cycle depth as infinite

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-028

---

### US-032: Dependency Impact Analyzer

**As a** developer
**I want** to analyze deployment impact of changes
**So that** I can estimate deployment scope

**Acceptance Criteria**:

- [ ] Given a component, find all dependents
- [ ] Calculate impact radius
- [ ] Identify critical components
- [ ] Generate impact report
- [ ] Suggest test scope based on impact

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-028

---

### US-033: Dependency Resolver

**As a** developer
**I want** to resolve all component dependencies
**So that** I can generate correct deployment order

**Acceptance Criteria**:

- [ ] Resolve direct dependencies
- [ ] Resolve transitive dependencies
- [ ] Handle optional dependencies
- [ ] Skip managed package dependencies
- [ ] Report unresolved dependencies
- [ ] Generate dependency report

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-028, US-029

---

### US-034: Dependency Validation

**As a** developer
**I want** to validate the dependency graph
**So that** I can ensure correctness

**Acceptance Criteria**:

- [ ] Validate no dangling references
- [ ] Validate all nodes have types
- [ ] Validate no self-loops (except cycles)
- [ ] Validate edge consistency
- [ ] Generate validation report
- [ ] Fail on critical issues

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-028

---

### US-035: Dependency Visualization

**As a** developer
**I want** to visualize the dependency graph
**So that** I can understand relationships

**Acceptance Criteria**:

- [ ] Generate Mermaid diagram
- [ ] Generate DOT format
- [ ] Support filtering by type
- [ ] Support filtering by depth
- [ ] Highlight critical path
- [ ] Export as SVG/PNG

**Priority**: Could Have
**Story Points**: 3
**Dependencies**: US-028

---

### US-036: Dependency Caching

**As a** developer
**I want** to cache dependency analysis results
**So that** I can speed up subsequent runs

**Acceptance Criteria**:

- [ ] Cache graph structure
- [ ] Invalidate cache on file changes
- [ ] Cache topological sort results
- [ ] Cache cycle detection results
- [ ] Cache heuristic inferences
- [ ] Configurable cache TTL

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-009, US-028

---

### US-037: Dependency Merge

**As a** developer
**I want** to merge static and AI-inferred dependencies
**So that** I can have complete dependency information

**Acceptance Criteria**:

- [ ] Merge static parser dependencies
- [ ] Merge AI-inferred dependencies
- [ ] Resolve conflicts (prefer static)
- [ ] Track dependency source
- [ ] Report merged dependencies
- [ ] Confidence scoring

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-028, US-033

---

## 🌊 EPIC 4: Wave Generation

**Goal**: Generate optimal deployment waves

### US-038: Topological Sort Wave Generator

**As a** developer
**I want** to generate waves using topological sort
**So that** I can deploy in dependency order

**Acceptance Criteria**:

- [ ] Generate waves from dependency graph
- [ ] Each wave contains independent components
- [ ] Components in wave N don't depend on wave N+1
- [ ] Handle components with no dependencies (wave 1)
- [ ] Handle isolated components
- [ ] Generate wave metadata

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-002, US-028

---

### US-039: Wave Splitter

**As a** developer
**I want** to split large waves automatically
**So that** I can respect Salesforce limits

**Acceptance Criteria**:

- [ ] Split waves with >300 components
- [ ] Maintain dependency order within split waves
- [ ] Generate sub-waves (1a, 1b, etc.)
- [ ] Split CMT waves at 200 records
- [ ] Report split decisions
- [ ] Ensure no dependency violations

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-038

---

### US-040: Test Optimizer

**As a** developer
**I want** to optimize test execution per wave
**So that** I can reduce deployment time

**Acceptance Criteria**:

- [ ] Identify waves with Apex/Trigger changes
- [ ] Include tests only in waves with code
- [ ] Sync test classes with production classes
- [ ] Ensure trigger tests are included
- [ ] Calculate test coverage per wave
- [ ] Report test optimization savings

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-038

---

### US-041: Wave Merger

**As a** developer
**I want** to merge small adjacent waves
**So that** I can reduce total deployment time

**Acceptance Criteria**:

- [ ] Identify waves with <50 components
- [ ] Merge if combined < 300 components
- [ ] Respect dependency order
- [ ] Don't merge if different test requirements
- [ ] Report merge decisions
- [ ] User override option

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-038

---

### US-042: Priority-Based Wave Generation

**As a** developer
**I want** to prioritize components by importance
**So that** I can deploy critical metadata first

**Acceptance Criteria**:

- [ ] Use deployment order constants
- [ ] Objects before classes before triggers
- [ ] Break ties using priorities
- [ ] User-defined priority overrides
- [ ] Report priority decisions
- [ ] Validate no dependency violations

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-005, US-038

---

### US-043: Wave Validation

**As a** developer
**I want** to validate generated waves
**So that** I can ensure correct deployment

**Acceptance Criteria**:

- [ ] Validate dependency order
- [ ] Validate component limits
- [ ] Validate test requirements
- [ ] Validate no cycles within wave
- [ ] Generate validation report
- [ ] Fail on critical issues

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-038

---

### US-044: Wave Metadata Generator

**As a** developer
**I want** to generate wave metadata files
**So that** I can track deployment progress

**Acceptance Criteria**:

- [ ] Generate wave_metadata.json
- [ ] Include component list per wave
- [ ] Include dependency information
- [ ] Include test requirements
- [ ] Include estimated deployment time
- [ ] Timestamp and version info

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-038

---

### US-045: Wave Diff Generator

**As a** developer
**I want** to compare waves between commits
**So that** I can see what changed

**Acceptance Criteria**:

- [ ] Compare two wave generations
- [ ] Show added/removed components
- [ ] Show wave reordering
- [ ] Show dependency changes
- [ ] Generate diff report
- [ ] Highlight breaking changes

**Priority**: Could Have
**Story Points**: 3
**Dependencies**: US-038

---

## 🖥️ EPIC 5: CLI Commands

**Goal**: Implement user-facing CLI commands

### US-046: smart-deployment:start

**As a** user
**I want** to run deployment with a single command
**So that** I can deploy intelligently without manual steps

**Acceptance Criteria**:

- [ ] Analyzes metadata automatically
- [ ] Generates deployment waves
- [ ] Executes deployment sequentially
- [ ] Supports `--target-org` flag
- [ ] Supports `--test-level` flag
- [ ] Supports `--dry-run` flag
- [ ] Supports `--use-ai` flag
- [ ] Shows progress bar
- [ ] Generates deployment report
- [ ] Handles failures gracefully

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-038, US-050

---

### US-047: smart-deployment:analyze

**As a** user
**I want** to analyze my metadata without deploying
**So that** I can understand dependencies and waves

**Acceptance Criteria**:

- [ ] Scans project metadata
- [ ] Generates dependency graph
- [ ] Generates deployment waves
- [ ] Outputs analysis report (JSON/HTML)
- [ ] Supports `--output-format` flag
- [ ] Supports `--use-ai` flag
- [ ] Shows statistics
- [ ] Highlights issues (cycles, etc.)
- [ ] No deployment execution

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-028, US-038

---

### US-048: smart-deployment:validate

**As a** user
**I want** to validate my deployment
**So that** I can catch errors before deploying

**Acceptance Criteria**:

- [ ] Performs check-only deployment
- [ ] Validates each wave
- [ ] Reports validation errors
- [ ] Supports `--target-org` flag
- [ ] Shows estimated deployment time
- [ ] No actual deployment
- [ ] Generates validation report

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-046

---

### US-049: smart-deployment:resume

**As a** user
**I want** to resume a failed deployment
**So that** I can continue from where it failed

**Acceptance Criteria**:

- [ ] Detects previous failed deployment
- [ ] Loads deployment state
- [ ] Resumes from failed wave
- [ ] Supports retry strategies
- [ ] Updates deployment report
- [ ] Handles multiple failures

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-046

---

### US-050: smart-deployment:status

**As a** user
**I want** to check deployment status
**So that** I can monitor progress

**Acceptance Criteria**:

- [ ] Shows current wave number
- [ ] Shows completed waves
- [ ] Shows remaining waves
- [ ] Shows estimated time remaining
- [ ] Shows test execution status
- [ ] Refreshes automatically
- [ ] Supports JSON output

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-046

---

### US-051: smart-deployment:config

**As a** user
**I want** to configure plugin settings
**So that** I can customize behavior

**Acceptance Criteria**:

- [ ] Set Agentforce configuration
- [ ] Set default test level
- [ ] Set timeout values
- [ ] Set retry strategies
- [ ] Save configuration to file
- [ ] Validate configuration

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: None

---

### US-052: Command Help Documentation

**As a** user
**I want** comprehensive help for each command
**So that** I can use the plugin effectively

**Acceptance Criteria**:

- [ ] Each command has `--help` flag
- [ ] Examples for common scenarios
- [ ] Flag descriptions
- [ ] Exit codes documented
- [ ] Error messages documented
- [ ] Links to online documentation

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-046 to US-051

---

### US-053: Command Progress Reporting

**As a** user
**I want** real-time progress updates
**So that** I know what's happening

**Acceptance Criteria**:

- [ ] Progress bars for long operations
- [ ] Spinners for ongoing tasks
- [ ] Percentage completion
- [ ] ETA calculation
- [ ] Current operation description
- [ ] Color-coded output

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-046

---

## 🤖 EPIC 6: Agentforce Integration

**Goal**: Integrate Salesforce AI for intelligent analysis

### US-054: Agentforce Service Setup

**As a** developer
**I want** to connect to Agentforce API
**So that** I can use AI capabilities

**Acceptance Criteria**:

- [ ] Configure API endpoint
- [ ] Handle authentication (API key/Named Credential)
- [ ] Support multiple models
- [ ] Implement retry logic
- [ ] Handle rate limiting
- [ ] Monitor API usage

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: None

---

### US-055: AI Dependency Inference

**As a** user
**I want** AI to infer non-obvious dependencies
**So that** I can catch missed relationships

**Acceptance Criteria**:

- [ ] Send component context to Agentforce
- [ ] Receive dependency inferences
- [ ] Parse AI responses
- [ ] Confidence scoring
- [ ] Fallback to static analysis if AI fails
- [ ] Cache AI results

**Priority**: Should Have
**Story Points**: 5
**Dependencies**: US-054

---

### US-056: AI Wave Validation

**As a** user
**I want** AI to validate deployment waves
**So that** I can catch business logic issues

**Acceptance Criteria**:

- [ ] Send wave structure to Agentforce
- [ ] Receive validation feedback
- [ ] Identify potential issues
- [ ] Suggest optimizations
- [ ] Risk assessment per wave
- [ ] Apply AI suggestions (optional)

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-054, US-038

---

### US-057: AI Priority Weighting

**As a** user
**I want** AI to suggest component priorities
**So that** I can deploy in optimal order

**Acceptance Criteria**:

- [ ] Send component list to Agentforce
- [ ] Receive priority recommendations
- [ ] Consider business criticality
- [ ] Consider failure impact
- [ ] Merge with static priorities
- [ ] Report AI decisions

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-054

---

### US-058: AI Prompt Builder

**As a** developer
**I want** to build effective AI prompts
**So that** I get useful responses

**Acceptance Criteria**:

- [ ] Context-aware prompt generation
- [ ] Include relevant metadata snippets
- [ ] Optimize token usage
- [ ] Template-based prompts
- [ ] Version prompts
- [ ] A/B test prompts

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-054

---

### US-059: AI Response Parser

**As a** developer
**I want** to parse AI responses reliably
**So that** I can extract actionable information

**Acceptance Criteria**:

- [ ] Parse JSON responses
- [ ] Handle malformed responses
- [ ] Extract structured data
- [ ] Validate response schema
- [ ] Handle AI hallucinations
- [ ] Confidence scoring

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-054

---

### US-060: AI Circuit Breaker

**As a** developer
**I want** circuit breaker pattern for AI calls
**So that** I can handle AI service failures

**Acceptance Criteria**:

- [ ] Track failure rate
- [ ] Open circuit after N failures
- [ ] Automatic fallback to static analysis
- [ ] Reset after timeout
- [ ] Monitor circuit state
- [ ] Alert on circuit open

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-054

---

## 🧪 EPIC 7: Testing Infrastructure

**Goal**: Comprehensive test coverage

### US-061: Unit Test Framework Setup

**As a** developer
**I want** Jest configured for unit testing
**So that** I can write and run tests easily

**Acceptance Criteria**:

- [ ] Jest configured with TypeScript
- [ ] Test coverage reporting
- [ ] Watch mode for TDD
- [ ] Parallel test execution
- [ ] Mock utilities available
- [ ] Coverage thresholds enforced

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: None

---

### US-062: Utils Unit Tests

**As a** developer
**I want** 61 unit tests for utilities
**So that** I can ensure utility reliability

**Acceptance Criteria**:

- [ ] 20 tests for functional utils
- [ ] 23 tests for graph algorithms
- [ ] 18 tests for file system utils
- [ ] All tests pass
- [ ] 100% code coverage for utils
- [ ] Performance benchmarks included

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-061

---

### US-063: Parser Unit Tests

**As a** developer
**I want** 100 unit tests for parsers
**So that** I can ensure parsing accuracy

**Acceptance Criteria**:

- [ ] 25 tests for Apex parser
- [ ] 12 tests for Flow parser
- [ ] 10 tests for LWC parser
- [ ] Tests for all 50+ metadata types
- [ ] 95% code coverage for parsers
- [ ] Edge cases covered

**Priority**: Must Have
**Story Points**: 8
**Dependencies**: US-061

---

### US-064: Service Unit Tests

**As a** developer
**I want** 57 unit tests for services
**So that** I can ensure service reliability

**Acceptance Criteria**:

- [ ] 16 tests for metadata scanner
- [ ] 12 tests for dependency resolver
- [ ] 15 tests for wave generator
- [ ] 14 tests for Agentforce service
- [ ] 90% code coverage for services
- [ ] Mock external dependencies

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-061

---

### US-065: Integration Tests

**As a** developer
**I want** 30 integration tests
**So that** I can ensure layers work together

**Acceptance Criteria**:

- [ ] Parser → Service integration
- [ ] Service → Core integration
- [ ] Core → Generator integration
- [ ] End-to-end pipeline tests
- [ ] Real project fixtures
- [ ] Performance tests

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-062, US-063, US-064

---

### US-066: BDD Test Framework

**As a** developer
**I want** Cucumber configured for BDD
**So that** I can write behavior-driven tests

**Acceptance Criteria**:

- [ ] Cucumber with TypeScript
- [ ] Gherkin syntax support
- [ ] Step definition helpers
- [ ] Scenario reporting
- [ ] Integration with Jest
- [ ] Parallel scenario execution

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-061

---

### US-067: E2E BDD Scenarios

**As a** developer
**I want** 36 E2E BDD scenarios
**So that** I can ensure user workflows work

**Acceptance Criteria**:

- [ ] 10 scenarios for start command
- [ ] 6 scenarios for analyze command
- [ ] 5 scenarios for validate command
- [ ] 4 scenarios for resume command
- [ ] 3 scenarios for status command
- [ ] 8 error handling scenarios
- [ ] All scenarios pass

**Priority**: Must Have
**Story Points**: 8
**Dependencies**: US-066

---

### US-068: Test Fixtures

**As a** developer
**I want** realistic test fixtures
**So that** I can test with real-world data

**Acceptance Criteria**:

- [ ] Sample Salesforce projects
- [ ] Various project structures
- [ ] Edge case scenarios
- [ ] Large project samples (1000+ files)
- [ ] Corrupted file samples
- [ ] Circular dependency samples

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: None

---

### US-069: Performance Tests

**As a** developer
**I want** performance benchmarks
**So that** I can ensure acceptable performance

**Acceptance Criteria**:

- [ ] Benchmark parsing 1000 files
- [ ] Benchmark topological sort 1000 nodes
- [ ] Benchmark wave generation
- [ ] Benchmark end-to-end deployment
- [ ] Performance regression detection
- [ ] Report performance metrics

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-065

---

### US-070: CI/CD Test Automation

**As a** developer
**I want** tests automated in CI/CD
**So that** I can catch regressions early

**Acceptance Criteria**:

- [ ] GitHub Actions workflow
- [ ] Run tests on PR
- [ ] Run tests on push to main
- [ ] Coverage reporting to PR
- [ ] Fail on coverage drop
- [ ] Performance comparison

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-061

---

## ⚠️ EPIC 8: Error Handling

**Goal**: Robust error handling throughout

### US-071: Parse Error Handling

**As a** developer
**I want** graceful parse error handling
**So that** one bad file doesn't break analysis

**Acceptance Criteria**:

- [ ] Catch and log parse errors
- [ ] Continue with other files
- [ ] Report errors with file paths
- [ ] Suggest fixes when possible
- [ ] Aggregate error report
- [ ] Option to fail-fast

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-008

---

### US-072: Network Error Handling

**As a** developer
**I want** network error handling with retries
**So that** temporary failures don't break deployment

**Acceptance Criteria**:

- [ ] Detect network errors
- [ ] Exponential backoff retry
- [ ] Max retry limit (3)
- [ ] Timeout handling
- [ ] Fallback strategies
- [ ] User-friendly error messages

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-008

---

### US-073: Agentforce Error Handling

**As a** developer
**I want** graceful AI failure handling
**So that** AI unavailability doesn't break plugin

**Acceptance Criteria**:

- [ ] Detect AI failures
- [ ] Fallback to static analysis
- [ ] Log AI errors
- [ ] Warn user about fallback
- [ ] Continue deployment
- [ ] Report AI usage statistics

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-054, US-060

---

### US-074: Deployment Error Handling

**As a** developer
**I want** deployment error recovery
**So that** I can retry or resume failed deployments

**Acceptance Criteria**:

- [ ] Catch deployment errors
- [ ] Save deployment state
- [ ] Enable resume from failure
- [ ] Retry with different strategies
- [ ] Report error details
- [ ] Suggest fixes

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-008

---

### US-075: Validation Error Reporting

**As a** user
**I want** clear validation error messages
**So that** I can fix issues quickly

**Acceptance Criteria**:

- [ ] User-friendly error messages
- [ ] Include file paths
- [ ] Include line numbers
- [ ] Suggest fixes
- [ ] Link to documentation
- [ ] Categorize by severity

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-008

---

### US-076: Error Logging

**As a** developer
**I want** comprehensive error logging
**So that** I can debug issues

**Acceptance Criteria**:

- [ ] Log all errors to file
- [ ] Include stack traces
- [ ] Include context information
- [ ] Timestamp errors
- [ ] Structured logging
- [ ] Log rotation

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-007, US-008

---

### US-077: Negative Scenario Tests

**As a** developer
**I want** 267 negative scenario tests
**So that** I can ensure error handling works

**Acceptance Criteria**:

- [ ] 45 negative tests for utils
- [ ] 65 negative tests for parsers
- [ ] 68 negative tests for services
- [ ] 28 negative tests for core
- [ ] 8 negative tests for generators
- [ ] 19 E2E error scenarios
- [ ] All tests pass

**Priority**: Should Have
**Story Points**: 8
**Dependencies**: US-061

---

### US-078: Error Recovery Patterns

**As a** developer
**I want** 5 error handling patterns implemented
**So that** I have consistent error handling

**Acceptance Criteria**:

- [ ] Try-catch with context pattern
- [ ] Fallback chain pattern
- [ ] Graceful degradation pattern
- [ ] Retry with backoff pattern
- [ ] Circuit breaker pattern
- [ ] Documented with examples

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-008

---

## 📂 EPIC 9: Project Scanner

**Goal**: Scan any Salesforce project structure

### US-079: SFDX Project Detection

**As a** user
**I want** automatic SFDX project detection
**So that** the plugin works with standard projects

**Acceptance Criteria**:

- [ ] Detect sfdx-project.json
- [ ] Parse packageDirectories
- [ ] Scan all package paths
- [ ] Handle multi-package projects
- [ ] Respect .forceignore
- [ ] Generate project structure report

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-003

---

### US-080: Metadata API Format Support

**As a** user
**I want** support for legacy Metadata API format
**So that** the plugin works with older projects

**Acceptance Criteria**:

- [ ] Detect package.xml
- [ ] Scan src/ directory
- [ ] Parse metadata format files
- [ ] Convert to source format internally
- [ ] Handle Documents folder structure
- [ ] Handle DigitalExperience bundles

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-003

---

### US-081: Custom Structure Support

**As a** user
**I want** support for custom project structures
**So that** the plugin works with enterprise setups

**Acceptance Criteria**:

- [ ] Scan custom paths from config
- [ ] No hardcoded path assumptions
- [ ] Detect metadata by patterns
- [ ] Flexible directory naming
- [ ] Support symlinks
- [ ] Generate structure report

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-079

---

### US-082: Monorepo Support

**As a** user
**I want** support for monorepo structures
**So that** I can deploy from monorepos

**Acceptance Criteria**:

- [ ] Detect multiple sfdx-project.json files
- [ ] Treat each as separate project
- [ ] Support aggregate deployment
- [ ] Support individual project deployment
- [ ] Handle shared dependencies
- [ ] Generate combined report

**Priority**: Could Have
**Story Points**: 3
**Dependencies**: US-079

---

### US-083: .forceignore Parsing

**As a** user
**I want** .forceignore respected
**So that** excluded files aren't deployed

**Acceptance Criteria**:

- [ ] Parse .forceignore syntax
- [ ] Support glob patterns
- [ ] Support comments
- [ ] Handle invalid patterns gracefully
- [ ] Report ignored files
- [ ] Allow .forceignore in subdirectories

**Priority**: Must Have
**Story Points**: 2
**Dependencies**: US-003

---

### US-084: Project Structure Validation

**As a** user
**I want** project structure validation
**So that** I know if my project is valid

**Acceptance Criteria**:

- [ ] Validate sfdx-project.json schema
- [ ] Validate package directories exist
- [ ] Validate metadata structure
- [ ] Check for required files
- [ ] Generate validation report
- [ ] Suggest fixes for issues

**Priority**: Should Have
**Story Points**: 2
**Dependencies**: US-079

---

## 🚀 EPIC 10: Deployment Execution

**Goal**: Execute deployments reliably

### US-085: SF CLI Integration

**As a** developer
**I want** to execute deployments via SF CLI
**So that** I can leverage official tooling

**Acceptance Criteria**:

- [ ] Execute `sf project deploy start`
- [ ] Pass manifest file
- [ ] Pass test level
- [ ] Pass target org
- [ ] Capture output
- [ ] Parse deployment results

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: None

---

### US-086: Deployment Progress Tracking

**As a** user
**I want** real-time deployment progress
**So that** I know what's happening

**Acceptance Criteria**:

- [ ] Track deployment ID
- [ ] Poll deployment status
- [ ] Show progress percentage
- [ ] Show current component deploying
- [ ] Show ETA
- [ ] Show wave progress

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-085

---

### US-087: Test Execution Management

**As a** user
**I want** intelligent test execution
**So that** I only run necessary tests

**Acceptance Criteria**:

- [ ] Run tests only in Apex waves
- [ ] Support RunLocalTests
- [ ] Support RunSpecifiedTests
- [ ] Support NoTestRun (sandbox)
- [ ] Track test results
- [ ] Report coverage

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-085

---

### US-088: Deployment Retry Logic

**As a** user
**I want** automatic retry on transient failures
**So that** temporary issues don't fail my deployment

**Acceptance Criteria**:

- [ ] Detect retryable errors
- [ ] Retry up to 3 times
- [ ] Exponential backoff
- [ ] Retry without tests (sandbox)
- [ ] Report retry attempts
- [ ] Fail after max retries

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-085, US-072

---

### US-089: Deployment State Persistence

**As a** developer
**I want** deployment state saved
**So that** I can resume after failures

**Acceptance Criteria**:

- [ ] Save state after each wave
- [ ] Include completed waves
- [ ] Include failed wave details
- [ ] Include deployment settings
- [ ] Load state on resume
- [ ] Clean up old state files

**Priority**: Should Have
**Story Points**: 3
**Dependencies**: US-085

---

### US-090: Deployment Reporting

**As a** user
**I want** comprehensive deployment reports
**So that** I can understand what happened

**Acceptance Criteria**:

- [ ] JSON report format
- [ ] HTML report format
- [ ] Include all wave results
- [ ] Include test results
- [ ] Include timing information
- [ ] Include AI metrics
- [ ] Include error details
- [ ] Generate summary statistics

**Priority**: Must Have
**Story Points**: 3
**Dependencies**: US-085

---

## 📈 Story Point Summary

```
Total Story Points: 275
Average per Story: 3.06
Estimated Sprints (40 pts/sprint): 7 sprints
Estimated Timeline: 14 weeks (2-week sprints)
```

## 🎯 Sprint Plan (Suggested)

### Sprint 1-2: Foundation (68 pts)

- Epic 1: Core Infrastructure (34 pts)
- Epic 7: Testing Infrastructure (partial - 34 pts)

### Sprint 3-4: Parsing (55 pts)

- Epic 2: Metadata Parsers (55 pts)

### Sprint 5-6: Analysis & Waves (55 pts)

- Epic 3: Dependency Analysis (34 pts)
- Epic 4: Wave Generation (21 pts)

### Sprint 7-8: CLI & Scanner (34 pts)

- Epic 5: CLI Commands (21 pts)
- Epic 9: Project Scanner (13 pts)

### Sprint 9: Deployment (21 pts)

- Epic 10: Deployment Execution (21 pts)

### Sprint 10: AI & Error Handling (42 pts)

- Epic 6: Agentforce Integration (21 pts)
- Epic 8: Error Handling (21 pts)

---

---

## 🆕 NEWLY ADDED STORIES

### US-091: XML Metadata Validator (Pre-Deployment)

**As a** developer
**I want** to validate Salesforce metadata XML files before deployment
**So that** I can catch UNKNOWN_EXCEPTION errors caused by malformed XMLs

**Acceptance Criteria**:

- [ ] Validate XML declaration format (`<?xml version="1.0" encoding="UTF-8"?>`)
- [ ] Check required namespaces (`xmlns`, `xmlns:xsi`, `xmlns:xsd`)
- [ ] Validate field types (`xsi:type="xsd:boolean"`, `xsd:string`, etc.)
- [ ] Check label length constraints (<40 characters for CustomMetadata)
- [ ] Validate boolean values are `true`/`false` (not `1`/`0`)
- [ ] Auto-fix common issues with `--fix` flag
- [ ] Generate validation report with file paths and specific errors
- [ ] Support batch validation of 10,000+ files efficiently
- [ ] Exit with appropriate codes (0=success, 1=warnings, 2=errors)
- [ ] Integrate with `sf smart deploy validate` command
- [ ] Parse and validate CustomMetadata records specifically
- [ ] Detect missing or incorrect xsi:type attributes

**Priority**: Must Have
**Story Points**: 5
**Dependencies**: US-003 (File System Utilities), US-010 (XML Utils)
**Epic**: E1 (Core Infrastructure)

**Technical Notes**:

- Based on `validate_salesforce_metadata.py` production script
- Primary root cause of Salesforce UNKNOWN_EXCEPTION errors (not file count)
- Must run BEFORE any API calls to Salesforce (pre-deployment gate)
- Critical for large-scale deployments (10k+ files)
- Should be integrated into `sf smart deploy validate` Phase 1
- Auto-fix examples:
  - Add missing `xmlns:xsd` namespace
  - Correct XML declaration
  - Fix boolean values (`1` → `true`, `0` → `false`)

**Error Examples to Detect**:

```xml
❌ BAD: Missing xmlns:xsd
<CustomMetadata xmlns="..." xmlns:xsi="...">

✅ GOOD: All namespaces present
<CustomMetadata xmlns="..." xmlns:xsi="..." xmlns:xsd="...">

❌ BAD: Invalid boolean
<value xsi:type="xsd:boolean">1</value>

✅ GOOD: Valid boolean
<value xsi:type="xsd:boolean">true</value>
```

---

**Last Updated**: December 2, 2025
**Status**: Ready for Development
**Total Stories**: 91
**Total Points**: 280
