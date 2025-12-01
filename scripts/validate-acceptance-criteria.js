#!/usr/bin/env node

/**
 * Acceptance Criteria Validator
 * 
 * This script:
 * 1. Fetches the user story issue from GitHub
 * 2. Parses acceptance criteria from the issue
 * 3. Analyzes test files to find which tests cover which AC
 * 4. Updates the issue with checked/unchecked AC
 * 5. Generates validation results for CI/CD
 * 
 * Test files should use JSDoc annotations to link to AC:
 * 
 * @example
 * ```typescript
 * /**
 *  * @ac US-001-AC-1: Extract extends relationships
 *  *\/
 * it('should extract extends relationships', () => {
 *   // test implementation
 * });
 * ```
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const REPOSITORY = process.env.REPOSITORY;
const [OWNER, REPO] = REPOSITORY ? REPOSITORY.split('/') : ['', ''];

/**
 * Fetch issue from GitHub
 */
async function fetchIssue(issueNumber) {
  try {
    const command = `gh issue view ${issueNumber} --repo ${REPOSITORY} --json body,title,number`;
    const result = execSync(command, { encoding: 'utf-8' });
    return JSON.parse(result);
  } catch (error) {
    console.error(`Failed to fetch issue #${issueNumber}:`, error.message);
    return null;
  }
}

/**
 * Parse acceptance criteria from issue body
 */
function parseAcceptanceCriteria(issueBody) {
  const acceptanceCriteria = [];
  
  // Find "## Acceptance Criteria" section
  const acSectionMatch = issueBody.match(/## Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/i);
  
  if (!acSectionMatch) {
    console.log('⚠️  No Acceptance Criteria section found in issue');
    return acceptanceCriteria;
  }
  
  const acSection = acSectionMatch[1];
  
  // Parse checkbox items
  const checkboxRegex = /- \[([ x])\] (.+)/gi;
  let match;
  let index = 1;
  
  while ((match = checkboxRegex.exec(acSection)) !== null) {
    const checked = match[1].toLowerCase() === 'x';
    const text = match[2].trim();
    
    acceptanceCriteria.push({
      id: `AC-${index}`,
      text,
      checked,
      coveredBy: [],
    });
    
    index++;
  }
  
  console.log(`📋 Found ${acceptanceCriteria.length} acceptance criteria`);
  return acceptanceCriteria;
}

/**
 * Find all test files in the project
 */
function findTestFiles() {
  const testDirs = ['test/unit', 'test/integration', 'test/e2e'];
  const testFiles = [];
  
  testDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      const files = findFilesRecursively(fullPath, /\.(test|spec)\.(ts|js)$/);
      testFiles.push(...files);
    }
  });
  
  console.log(`🧪 Found ${testFiles.length} test files`);
  return testFiles;
}

/**
 * Find files recursively
 */
function findFilesRecursively(dir, pattern) {
  let results = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFilesRecursively(filePath, pattern));
    } else if (pattern.test(file)) {
      results.push(filePath);
    }
  }
  
  return results;
}

/**
 * Parse test file to find AC annotations
 */
function parseTestFile(filePath, issueNumber) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const coveredAC = [];
  
  // Match JSDoc comments with @ac annotation
  // Format: @ac US-123-AC-1: Description
  const acRegex = /@ac\s+(?:US-)?(\d+)-AC-(\d+):\s*(.+)/gi;
  let match;
  
  while ((match = acRegex.exec(content)) !== null) {
    const issueNum = match[1];
    const acNum = match[2];
    const description = match[3].trim();
    
    // Only include AC from the current issue
    if (issueNum === issueNumber.toString()) {
      coveredAC.push({
        acId: `AC-${acNum}`,
        description,
        file: path.relative(process.cwd(), filePath),
      });
    }
  }
  
  // Also check for it() and test() descriptions that might reference AC
  const testRegex = /(?:it|test)\s*\(\s*['"`](.+?)['"`]/gi;
  let testMatch;
  
  while ((testMatch = testRegex.exec(content)) !== null) {
    const testDescription = testMatch[1];
    
    // Check if test description matches any AC text (fuzzy match)
    // This is a fallback for tests without explicit @ac annotations
    const acMatch = testDescription.match(/AC[-\s]?(\d+)/i);
    if (acMatch) {
      const acNum = acMatch[1];
      coveredAC.push({
        acId: `AC-${acNum}`,
        description: testDescription,
        file: path.relative(process.cwd(), filePath),
        implicit: true, // Marked as implicit (not explicitly annotated)
      });
    }
  }
  
  return coveredAC;
}

/**
 * Analyze test coverage for acceptance criteria
 */
function analyzeTestCoverage(acceptanceCriteria, testFiles, issueNumber) {
  console.log('\n🔍 Analyzing test coverage for AC...\n');
  
  testFiles.forEach(testFile => {
    const coveredAC = parseTestFile(testFile, issueNumber);
    
    coveredAC.forEach(({ acId, description, file, implicit }) => {
      const ac = acceptanceCriteria.find(a => a.id === acId);
      if (ac) {
        ac.coveredBy.push({
          file,
          description,
          implicit: implicit || false,
        });
      }
    });
  });
  
  // Mark AC as covered if they have tests
  acceptanceCriteria.forEach(ac => {
    if (ac.coveredBy.length > 0) {
      console.log(`✅ ${ac.id}: ${ac.text}`);
      console.log(`   Covered by: ${ac.coveredBy.length} test(s)`);
      ac.coveredBy.forEach(test => {
        const marker = test.implicit ? '(implicit)' : '';
        console.log(`   - ${test.file} ${marker}`);
      });
    } else {
      console.log(`❌ ${ac.id}: ${ac.text}`);
      console.log(`   No tests found`);
    }
  });
  
  return acceptanceCriteria;
}

/**
 * Update issue with checked AC
 */
async function updateIssueWithCheckedAC(issueNumber, issueBody, acceptanceCriteria) {
  // Find the Acceptance Criteria section
  const acSectionMatch = issueBody.match(/(## Acceptance Criteria\s*\n)([\s\S]*?)(?=\n##|$)/i);
  
  if (!acSectionMatch) {
    console.log('⚠️  Cannot update issue: No Acceptance Criteria section found');
    return false;
  }
  
  const acSectionStart = acSectionMatch[1];
  let acSection = acSectionMatch[2];
  
  // Update checkboxes based on test coverage
  acceptanceCriteria.forEach((ac, index) => {
    const checked = ac.coveredBy.length > 0 ? 'x' : ' ';
    const oldCheckbox = `- [${ac.checked ? 'x' : ' '}] ${ac.text}`;
    const newCheckbox = `- [${checked}] ${ac.text}`;
    
    acSection = acSection.replace(oldCheckbox, newCheckbox);
  });
  
  // Reconstruct full issue body
  const beforeAC = issueBody.substring(0, issueBody.indexOf(acSectionMatch[0]));
  const afterAC = issueBody.substring(issueBody.indexOf(acSectionMatch[0]) + acSectionMatch[0].length);
  const newBody = beforeAC + acSectionStart + acSection + afterAC;
  
  // Update issue via gh CLI
  try {
    // Escape quotes and newlines for shell
    const escapedBody = newBody.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = `gh issue edit ${issueNumber} --repo ${REPOSITORY} --body "${escapedBody}"`;
    
    execSync(command, { encoding: 'utf-8' });
    console.log(`\n✅ Updated issue #${issueNumber} with checked AC`);
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to update issue:`, error.message);
    return false;
  }
}

/**
 * Generate validation results
 */
function generateValidationResults(issueNumber, acceptanceCriteria) {
  const completedAC = acceptanceCriteria.filter(ac => ac.coveredBy.length > 0);
  const pendingAC = acceptanceCriteria.filter(ac => ac.coveredBy.length === 0);
  
  const results = {
    issueNumber,
    totalAC: acceptanceCriteria.length,
    completedAC: completedAC.length,
    pendingAC: pendingAC.length,
    coverage: acceptanceCriteria.length > 0 
      ? Math.round((completedAC.length / acceptanceCriteria.length) * 100)
      : 0,
    details: {
      completed: completedAC.map(ac => ({
        id: ac.id,
        text: ac.text,
        coveredBy: ac.coveredBy.map(t => t.file),
      })),
      pending: pendingAC.map(ac => ({
        id: ac.id,
        text: ac.text,
        missingTests: ['Add test with @ac annotation'],
      })),
    },
  };
  
  // Write to file for GitHub Actions
  fs.writeFileSync('ac-validation-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n📊 Validation Results:');
  console.log(`   Total AC: ${results.totalAC}`);
  console.log(`   Completed: ${results.completedAC} ✅`);
  console.log(`   Pending: ${results.pendingAC} ⏳`);
  console.log(`   Coverage: ${results.coverage}%`);
  
  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Acceptance Criteria Validator\n');
  
  // Validate environment
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }
  
  if (!ISSUE_NUMBER) {
    console.error('❌ ISSUE_NUMBER is required');
    process.exit(1);
  }
  
  if (!REPOSITORY) {
    console.error('❌ REPOSITORY is required');
    process.exit(1);
  }
  
  console.log(`📋 Issue: #${ISSUE_NUMBER}`);
  console.log(`📦 Repository: ${REPOSITORY}\n`);
  
  // Fetch issue
  const issue = await fetchIssue(ISSUE_NUMBER);
  if (!issue) {
    console.error('❌ Could not fetch issue');
    process.exit(1);
  }
  
  console.log(`📖 Issue Title: ${issue.title}\n`);
  
  // Parse AC
  let acceptanceCriteria = parseAcceptanceCriteria(issue.body);
  
  if (acceptanceCriteria.length === 0) {
    console.log('⚠️  No acceptance criteria found. Skipping validation.');
    
    // Generate empty results
    generateValidationResults(ISSUE_NUMBER, []);
    process.exit(0);
  }
  
  // Find test files
  const testFiles = findTestFiles();
  
  if (testFiles.length === 0) {
    console.log('⚠️  No test files found. Skipping validation.');
    generateValidationResults(ISSUE_NUMBER, acceptanceCriteria);
    process.exit(0);
  }
  
  // Analyze coverage
  acceptanceCriteria = analyzeTestCoverage(acceptanceCriteria, testFiles, ISSUE_NUMBER);
  
  // Update issue
  await updateIssueWithCheckedAC(ISSUE_NUMBER, issue.body, acceptanceCriteria);
  
  // Generate results
  const results = generateValidationResults(ISSUE_NUMBER, acceptanceCriteria);
  
  // Exit with appropriate code
  if (results.pendingAC > 0) {
    console.log('\n⚠️  Some acceptance criteria are not covered by tests');
    process.exit(1);
  } else {
    console.log('\n✅ All acceptance criteria are covered by tests!');
    process.exit(0);
  }
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

