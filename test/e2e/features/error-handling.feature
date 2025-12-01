# language: en
Feature: Error Handling and Recovery (EDD)
  As a developer
  I want errors to be handled gracefully with clear messages
  So that I can quickly understand and fix issues

  Background:
    Given I am in a Salesforce project directory

  @edd @critical @project-errors
  Scenario: Missing sfdx-project.json
    Given no "sfdx-project.json" file exists
    And no "src/" directory exists
    When I run "sf smart-deployment analyze"
    Then I should see error "Unable to detect project structure"
    And I should see suggestion "Create sfdx-project.json or ensure src/ directory exists"
    And I should see "Run: sf project generate to create a valid project structure"
    And the exit code should be 1

  @edd @critical @project-errors
  Scenario: Corrupted sfdx-project.json
    Given "sfdx-project.json" contains invalid JSON:
      """
      {
        "packageDirectories": [
          { "path": "force-app"
        // Missing closing brace
      """
    When I run "sf smart-deployment analyze"
    Then I should see error "Invalid sfdx-project.json"
    And I should see "Syntax error at line 3"
    And I should see suggestion "Validate JSON syntax at jsonlint.com"
    And the exit code should be 1

  @edd @network @fallback
  Scenario: Agentforce API completely unavailable
    Given Agentforce is configured with endpoint "https://api.salesforce.com/ai"
    But the endpoint returns 503 Service Unavailable
    When I run "sf smart-deployment start --target-org production --use-ai"
    Then I should see warning "⚠️  Agentforce unavailable (503), falling back to static analysis"
    And the deployment should continue with static analysis only
    And the exit code should be 0
    And I should see "Deployment completed successfully (without AI optimization)"

  @edd @network @retry
  Scenario: Agentforce API timeout with retry
    Given Agentforce request times out after 30 seconds
    When I run "sf smart-deployment start --use-ai"
    Then the system should retry the request 3 times
    And I should see "⏳ Agentforce timeout, retrying (1/3)..."
    And I should see "⏳ Agentforce timeout, retrying (2/3)..."
    And I should see "⏳ Agentforce timeout, retrying (3/3)..."
    And if all retries fail, fallback to static analysis
    And the exit code should be 0

  @edd @network @rate-limit
  Scenario: Agentforce rate limit exceeded
    Given Agentforce returns 429 Too Many Requests
    When I run "sf smart-deployment start --use-ai"
    Then the system should implement exponential backoff
    And I should see "⏸️  Rate limit exceeded, waiting 2 seconds..."
    And retry after 2, 4, 8 seconds
    And if rate limit persists, fallback to static analysis

  @edd @deployment @wave-failure
  Scenario: Wave deployment fails with API timeout
    Given deployment is at wave 5 of 10
    When wave 5 fails due to Salesforce API timeout
    Then the system should retry wave 5 up to 3 times
    And I should see "🔄 Wave 5 failed (API timeout), retrying (1/3)..."
    And if all retries fail, save deployment state
    And I should see:
      """
      ❌ Wave 5 failed after 3 retries

      Deployment paused. Resume with:
        sf smart-deployment resume --from-wave 5

      Waves 1-4: ✅ Deployed successfully
      Wave 5: ❌ Failed (API timeout)
      Waves 6-10: ⏸️  Pending
      """

  @edd @deployment @component-error
  Scenario: Specific component fails validation
    Given deployment is at wave 3
    And wave 3 contains "AccountHandler.cls"
    When "AccountHandler.cls" has compilation error at line 42
    Then I should see detailed error:
      """
      ❌ Wave 3 failed

      Component: AccountHandler.cls
      Error: Invalid field reference: Account.NonExistent__c
      Line: 42
      Column: 15

      Fix: Ensure field Account.NonExistent__c exists or remove reference
      """
    And the deployment should stop at wave 3
    And waves 1-2 should remain deployed

  @edd @validation @circular-dependency
  Scenario: Circular dependency detected during analysis
    Given components have circular dependencies:
      | Component       | Depends On             |
      | FlowA           | ApexClass:Handler1     |
      | Handler1        | GenAI:Prompt1          |
      | Prompt1         | Flow:FlowA             |
    When I run "sf smart-deployment analyze"
    Then I should see error "Circular dependency detected"
    And I should see visual representation:
      """
      Circular Dependency Cycle:

      FlowA → Handler1 → Prompt1 → FlowA
        ↑___________________________|

      Suggestions to break the cycle:
      1. Remove Prompt1 → FlowA reference
      2. Refactor FlowA to not call Handler1
      3. Create intermediate component
      """
    And the exit code should be 1

  @edd @limits @wave-split
  Scenario: Wave exceeds Salesforce component limit
    Given a wave contains 500 Apex components
    When the wave is being generated
    Then the system should auto-split into:
      | Wave | Components |
      | 5a   | 300        |
      | 5b   | 200        |
    And I should see warning:
      """
      ⚠️  Wave 5 split due to Salesforce limits
      Original: 500 components
      Split into: Wave 5a (300) + Wave 5b (200)
      """

  @edd @limits @custom-metadata
  Scenario: Too many Custom Metadata Records in wave
    Given a wave contains 350 CustomMetadataRecord components
    When the wave is being validated
    Then the system should auto-split into batches of 200
    And I should see:
      """
      ⚠️  CustomMetadata records split due to Salesforce limit (200/wave)
      Original: 350 records
      Split into:
        - Wave 3a: 200 records
        - Wave 3b: 150 records
      """

  @edd @permissions @auth-error
  Scenario: Org authentication expired
    Given I was authenticated to org "production"
    But the auth token has expired
    When I run "sf smart-deployment start --target-org production"
    Then I should see error "Authentication expired for org 'production'"
    And I should see "Run: sf org login web --alias production"
    And the exit code should be 1

  @edd @permissions @insufficient-permissions
  Scenario: User lacks required permissions
    Given I am authenticated to org "production"
    But my user lacks "Modify All Data" permission
    When I try to deploy metadata
    Then I should see error:
      """
      ❌ Insufficient permissions

      Required permissions:
        ✗ Modify All Data
        ✗ Author Apex
        ✓ API Enabled

      Contact your Salesforce administrator to grant these permissions.
      """

  @edd @file-errors @corrupted-file
  Scenario: Corrupted Apex class file
    Given file "MyClass.cls" contains binary data or is corrupted
    When the file is being parsed
    Then I should see error "Corrupted or binary file detected: MyClass.cls"
    And the file should be skipped with warning
    And other files should continue processing
    And I should see suggestion "Re-retrieve file from org or restore from backup"

  @edd @file-errors @encoding-error
  Scenario: File with invalid encoding
    Given file "SpecialChars.cls" contains ISO-8859-1 encoding
    But the system expects UTF-8
    When the file is being read
    Then I should see error "Encoding error in file: SpecialChars.cls"
    And I should see "Expected: UTF-8, Found: ISO-8859-1"
    And I should see suggestion "Convert file to UTF-8 encoding"

  @edd @memory @out-of-memory
  Scenario: Out of memory during large project analysis
    Given a project with 15,000 metadata components
    When memory usage exceeds 2GB during analysis
    Then the system should switch to streaming analysis mode
    And I should see warning "⚠️  Large project detected, using streaming analysis"
    And if memory is still insufficient:
      """
      ❌ Insufficient memory for project analysis

      Memory: 2GB used, 512MB available
      Required: ~3GB for this project size

      Suggestions:
      1. Increase Node.js memory: export NODE_OPTIONS="--max-old-space-size=4096"
      2. Analyze packages individually: --package core-package
      3. Use incremental analysis: --incremental
      """

  @edd @ai-errors @hallucination
  Scenario: AI infers non-existent dependency
    Given Agentforce suggests dependency "ClassA → GhostClass"
    But "GhostClass" doesn't exist in the project
    When dependencies are being resolved
    Then the invalid dependency should be validated
    And rejected with warning:
      """
      ⚠️  AI suggested non-existent dependency

      Suggested: ClassA → GhostClass
      Confidence: 0.72
      Status: Ignored (GhostClass not found in project)

      Using static analysis only for ClassA
      """

  @edd @ai-errors @low-confidence
  Scenario: AI inference has very low confidence
    Given Agentforce suggests dependency with confidence 0.15
    When the inference is being evaluated
    Then the suggestion should be ignored
    And I should see:
      """
      ℹ️  Low-confidence AI inference ignored

      Suggested: FlowA → SomeClass
      Confidence: 0.15 (threshold: 0.30)
      Reason: Insufficient context for inference
      """

  @edd @concurrent @race-condition
  Scenario: Multiple deployments to same org
    Given a deployment is already running to org "production"
    And deployment ID is "abc123"
    When I try to start another deployment to "production"
    Then I should see error:
      """
      ❌ Deployment already in progress

      Org: production
      Current deployment: abc123
      Started: 5 minutes ago
      Status: Wave 3/8

      Options:
      1. Wait for current deployment: sf smart-deployment status
      2. Cancel current deployment: sf smart-deployment cancel
      """
    And the exit code should be 1

  @edd @timeout @analysis-timeout
  Scenario: Analysis takes abnormally long
    Given analysis has been running for 10 minutes
    And no progress has been made for 5 minutes
    When the timeout threshold is reached
    Then the analysis should be cancelled
    And I should see error:
      """
      ⏱️  Analysis timeout

      Time elapsed: 10 minutes
      Last progress: 5 minutes ago
      Components analyzed: 2,500/5,000

      Possible causes:
      - Project too large or complex
      - Circular dependency causing infinite loop
      - System resource constraints

      Suggestions:
      1. Try analyzing smaller batches
      2. Check for circular dependencies
      3. Increase timeout: --timeout 1800
      """

  @edd @disk-space @insufficient-space
  Scenario: Insufficient disk space for manifests
    Given available disk space is 50MB
    And manifests require approximately 100MB
    When manifest generation begins
    Then I should see error:
      """
      ❌ Insufficient disk space

      Available: 50 MB
      Required: 100 MB
      Shortfall: 50 MB

      Free up disk space and try again.
      """
    And no partial files should be written
    And the exit code should be 1

  @edd @edge-case @empty-project
  Scenario: Project has no metadata
    Given the project directory exists
    But contains 0 metadata components
    When I run "sf smart-deployment analyze"
    Then I should see warning (not error):
      """
      ⚠️  No metadata found to deploy

      Checked locations:
        ✗ force-app/main/default (empty)
        ✗ src/ (not found)

      Add metadata files to deploy
      """
    And the exit code should be 0

  @edd @recovery @fix-and-resume
  Scenario: Fix error and resume deployment
    Given deployment failed at wave 3 due to missing field
    And error was "Account.CustomField__c does not exist"
    When I create the missing field in the org
    And I run "sf smart-deployment resume --from-wave 3"
    Then wave 3 should be retried
    And I should see "🔄 Resuming deployment from wave 3"
    And waves 1-2 should not be re-deployed
    And the deployment should complete successfully

  @edd @rollback @critical-failure
  Scenario: Rollback after critical failure in production
    Given deployment is at wave 8 of 10 in production org
    When wave 8 fails with critical error
    And --fail-fast=true is configured
    Then I should see warning:
      """
      ⚠️  Critical failure detected in production

      Wave 8 failed: Data loss risk detected
      Initiating rollback...
      """
    And all deployed waves should be rolled back
    And I should see rollback progress for each wave
    And final message:
      """
      ✅ Rollback completed successfully

      Org restored to pre-deployment state
      All changes from waves 1-7 have been reverted
      """

  @edd @validation @unknown-metadata
  Scenario: Unknown metadata type encountered
    Given the project contains files with extension ".futuremetadata-meta.xml"
    And this metadata type is not yet supported
    When the project is scanned
    Then I should see warning:
      """
      ⚠️  Unknown metadata types detected

      Type: FutureMetadata (5 components)
      Action: Skipped (not yet supported)

      Known metadata will deploy normally.
      Report unknown types: https://github.com/plugin/issues
      """
    And known metadata should deploy successfully
    And the exit code should be 0

