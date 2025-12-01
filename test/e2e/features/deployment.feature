# language: en
Feature: Smart Deployment
  As a Salesforce developer
  I want to deploy metadata intelligently
  So that I avoid deployment failures and save time

  Background:
    Given a Salesforce project exists
    And a target org "production" is configured

  @smoke @fast
  Scenario: Successful deployment with AI analysis
    Given the project has the following metadata:
      | Type        | Count |
      | ApexClass   | 100   |
      | ApexTrigger | 20    |
      | Flow        | 50    |
      | LWC         | 30    |
    And Agentforce AI is enabled
    When I run the command "sf smart-deployment start --target-org production --use-ai"
    Then the output should contain "Agentforce AI Analysis"
    And Agentforce should analyze dependencies
    And the deployment should generate 8 waves
    And all 8 waves should deploy successfully
    And the deployment should complete in less than 15 minutes
    And the success message should be displayed

  @smoke
  Scenario: Deployment without AI (fallback mode)
    Given Agentforce is unavailable
    When I run the command "sf smart-deployment start --target-org production"
    Then the output should contain "Using static analysis only"
    And a warning about AI unavailability should be shown
    And the deployment should still succeed
    And waves should be generated using static analysis

  @optimization
  Scenario: Test optimization saves deployment time
    Given the project has 50 test classes
    And waves 1-3 contain Apex or Flow changes
    And waves 4-6 contain only metadata without code
    When I run the command "sf smart-deployment start --target-org production"
    Then tests should run only in waves 1, 2, and 3
    And waves 4, 5, and 6 should skip test execution
    And the output should show "Test Optimization: 3 waves with tests, 3 waves without"
    And deployment time should be reduced by at least 40%

  @error-handling
  Scenario: Deployment failure and recovery
    Given wave 3 contains a component with an error
    When I run the command "sf smart-deployment start --target-org sandbox --fail-fast=false"
    Then waves 1 and 2 should deploy successfully
    And wave 3 should fail with detailed error information
    And the deployment should stop at wave 3
    And the error message should include:
      | Field            | Value                                      |
      | Component        | AccountHandler.cls                         |
      | Error            | Invalid field reference: Account.Custom__c |
      | Line             | 42                                         |
    And I should see instructions to fix and resume

  @validation @dry-run
  Scenario: Dry-run validation before actual deployment
    Given I want to validate the deployment plan
    When I run the command "sf smart-deployment start --target-org production --dry-run"
    Then no actual deployment should occur to the org
    And I should see the complete deployment plan with:
      | Information           | Example                      |
      | Total waves           | 8 waves                      |
      | Total components      | 200 components               |
      | Estimated time        | 28-35 minutes                |
      | Components per wave   | Wave 1: 45, Wave 2: 30, etc. |
      | Tests per wave        | Wave 1: 12 tests, etc.       |
    And potential issues should be highlighted

  @scalability @large-project
  Scenario: Large project deployment (2000+ components)
    Given the project has 2000 metadata components
    And some components exceed the 300 per wave limit
    When I run the command "sf smart-deployment start --target-org production"
    Then waves should be automatically split to max 300 components each
    And CustomMetadataRecord waves should be limited to 200 per wave
    And the deployment should not hit UNKNOWN_EXCEPTION errors
    And the total wave count should be approximately 15-20 waves

  @multi-package
  Scenario: Multi-package project with cross-package dependencies
    Given the project has 3 packages:
      | Package Name    | Components |
      | core-package    | 80         |
      | sales-package   | 60         |
      | service-package | 40         |
    And packages have cross-package dependencies
    When I run the command "sf smart-deployment start --target-org production"
    Then dependencies should be resolved across all packages
    And waves should respect cross-package dependencies
    And core-package components should deploy before dependent packages

  @structure-agnostic
  Scenario: Deployment with custom project structure
    Given the project has a non-standard directory structure:
      | Path                  | Contains          |
      | backend/apex-code     | Apex classes      |
      | backend/automations   | Flows and triggers|
      | frontend/components   | LWC components    |
    And metadata is not in the standard "force-app/main/default" path
    When I run the command "sf smart-deployment start --target-org production"
    Then the scanner should auto-detect metadata in all paths
    And the deployment should succeed without configuration

  @progress @ux
  Scenario: Real-time progress reporting during deployment
    Given a deployment is in progress
    When I check the deployment status
    Then I should see:
      | Information             | Format                          |
      | Current wave            | "Wave 5/12"                     |
      | Progress percentage     | "42%"                           |
      | Components deployed     | "180/420"                       |
      | Estimated time remaining| "~12 minutes"                   |
      | Current operation       | "Deploying ApexClass components"|
      | Tests status            | "25/30 tests passed"            |
    And real-time logs should stream to console

  @cancel @rollback
  Scenario: Cancel deployment mid-execution
    Given a deployment is currently at wave 5 of 10
    When I cancel the deployment using Ctrl+C
    Then the current wave 5 should be rolled back
    And waves 1-4 should remain deployed in the org
    And the deployment state should be saved
    And I should be able to resume from wave 5 later

  @ai-insights
  Scenario: AI provides deployment insights
    Given Agentforce AI analysis is enabled
    When I run the command "sf smart-deployment analyze --use-ai"
    Then AI should provide insights including:
      | Insight Type           | Example                                           |
      | Inferred dependencies  | "Found 8 additional dependencies via AI"          |
      | Priority adjustments   | "PaymentHandler should deploy before RefundHandler"|
      | Risk assessment        | "Risk level: Medium (3 critical components)"      |
      | Optimizations          | "Merge waves 4 and 5 to save 3 minutes"           |
    And confidence scores should be shown for each insight

  @resume
  Scenario: Resume failed deployment from specific wave
    Given a previous deployment failed at wave 7
    And waves 1-6 were successfully deployed
    And the failure was due to a fixable component error
    When I fix the error in the component
    And I run the command "sf smart-deployment resume --from-wave 7"
    Then the deployment should resume from wave 7
    And waves 1-6 should not be re-deployed
    And the remaining waves should deploy successfully

  @performance
  Scenario: Analysis completes quickly for large projects
    Given a project with 5000+ metadata components
    When I run the command "sf smart-deployment analyze"
    Then the analysis should complete in less than 30 seconds
    And memory usage should remain under 500MB
    And the dependency graph should be fully constructed

  @circular-deps
  Scenario: Detect and handle circular dependencies
    Given components have circular references:
      | Component A        | Depends On          |
      | FlowA              | ApexClass: Handler1 |
      | Handler1           | GenAI: Prompt1      |
      | Prompt1            | Flow: FlowA         |
    When I run the command "sf smart-deployment analyze"
    Then circular dependencies should be detected and reported
    And suggestions to break the cycle should be provided
    And a visual diagram of the cycle should be shown

  @unknown-metadata
  Scenario: Handle unknown metadata types gracefully
    Given the project contains unsupported metadata types:
      | Type                | Count |
      | FutureMetadataType1 | 5     |
      | FutureMetadataType2 | 3     |
    When I run the command "sf smart-deployment start --target-org production"
    Then a warning should be shown about unknown types
    And known metadata types should deploy successfully
    And unknown types should be included in a separate manifest
    And the deployment should not fail due to unknown types

