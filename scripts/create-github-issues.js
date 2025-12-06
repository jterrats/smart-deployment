#!/usr/bin/env node

/**
 * Script to create GitHub issues from USER_STORIES.md
 *
 * Requirements:
 * - GitHub CLI (gh) installed and authenticated
 * - Run from project root: node scripts/create-github-issues.js
 *
 * Usage:
 * - Dry run (preview): node scripts/create-github-issues.js --dry-run
 * - Create issues: node scripts/create-github-issues.js
 * - Create specific epic: node scripts/create-github-issues.js --epic 1
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const REPO_OWNER = 'jterrats';
const REPO_NAME = 'smart-deployment';
const USER_STORIES_PATH = path.join(__dirname, '../docs/USER_STORIES.md');
const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_EPIC = process.argv.find((arg) => arg.startsWith('--epic'));
const EPIC_NUMBER = SPECIFIC_EPIC ? parseInt(SPECIFIC_EPIC.split('=')[1]) : null;

// Epic labels mapping
const EPIC_LABELS = {
  1: ['epic:core-infrastructure', 'priority:must-have'],
  2: ['epic:metadata-parsers', 'priority:must-have'],
  3: ['epic:dependency-analysis', 'priority:must-have'],
  4: ['epic:wave-generation', 'priority:must-have'],
  5: ['epic:cli-commands', 'priority:must-have'],
  6: ['epic:agentforce', 'priority:should-have'],
  7: ['epic:testing', 'priority:must-have'],
  8: ['epic:error-handling', 'priority:should-have'],
  9: ['epic:project-scanner', 'priority:must-have'],
  10: ['epic:deployment', 'priority:must-have'],
};

// Priority labels
const PRIORITY_LABELS = {
  'Must Have': 'priority:must-have',
  'Should Have': 'priority:should-have',
  'Could Have': 'priority:could-have',
  "Won't Have": 'priority:wont-have',
};

/**
 * Parse USER_STORIES.md and extract user stories
 */
function parseUserStories() {
  const content = fs.readFileSync(USER_STORIES_PATH, 'utf-8');
  const stories = [];
  let currentEpic = null;
  let currentStory = null;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Epic
    if (line.match(/^## 🏗️ EPIC \d+:/)) {
      const match = line.match(/^## 🏗️ EPIC (\d+): (.+)$/);
      if (match) {
        currentEpic = {
          number: parseInt(match[1]),
          title: match[2],
          goal: '',
        };
      }
      continue;
    }

    // Detect Epic Goal
    if (currentEpic && line.match(/^\*\*Goal\*\*:/)) {
      currentEpic.goal = line.replace(/^\*\*Goal\*\*:\s*/, '');
      continue;
    }

    // Detect User Story
    if (line.match(/^### US-\d+:/)) {
      // Save previous story
      if (currentStory) {
        stories.push(currentStory);
      }

      const match = line.match(/^### (US-\d+): (.+)$/);
      if (match) {
        currentStory = {
          id: match[1],
          title: match[2],
          epic: currentEpic,
          asA: '',
          iWant: '',
          soThat: '',
          acceptanceCriteria: [],
          priority: '',
          storyPoints: 0,
          dependencies: [],
          body: '',
        };
      }
      continue;
    }

    // Parse story content
    if (currentStory) {
      if (line.match(/^\*\*As a\*\*/)) {
        currentStory.asA = line.replace(/^\*\*As a\*\*\s*/, '').trim();
      } else if (line.match(/^\*\*I want\*\*/)) {
        currentStory.iWant = line.replace(/^\*\*I want\*\*\s*/, '').trim();
      } else if (line.match(/^\*\*So that\*\*/)) {
        currentStory.soThat = line.replace(/^\*\*So that\*\*\s*/, '').trim();
      } else if (line.match(/^\*\*Acceptance Criteria\*\*:/)) {
        // Next lines are acceptance criteria
        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('- [')) {
          currentStory.acceptanceCriteria.push(lines[j].replace(/^- \[ \] /, ''));
          j++;
        }
        i = j - 1;
      } else if (line.match(/^\*\*Priority\*\*:/)) {
        currentStory.priority = line.replace(/^\*\*Priority\*\*:\s*/, '').trim();
      } else if (line.match(/^\*\*Story Points\*\*:/)) {
        currentStory.storyPoints = parseInt(line.replace(/^\*\*Story Points\*\*:\s*/, ''));
      } else if (line.match(/^\*\*Dependencies\*\*:/)) {
        const deps = line.replace(/^\*\*Dependencies\*\*:\s*/, '').trim();
        if (deps && deps !== 'None') {
          currentStory.dependencies = deps.split(',').map((d) => d.trim());
        }
      }
    }
  }

  // Save last story
  if (currentStory) {
    stories.push(currentStory);
  }

  return stories;
}

/**
 * Format story as GitHub issue body
 */
function formatIssueBody(story) {
  let body = '';

  // User Story format
  body += `## User Story\n\n`;
  body += `**As a** ${story.asA}  \n`;
  body += `**I want** ${story.iWant}  \n`;
  body += `**So that** ${story.soThat}\n\n`;

  // Acceptance Criteria
  body += `## Acceptance Criteria\n\n`;
  story.acceptanceCriteria.forEach((criterion) => {
    body += `- [ ] ${criterion}\n`;
  });
  body += `\n`;

  // Metadata
  body += `## Metadata\n\n`;
  body += `- **Epic**: ${story.epic.number} - ${story.epic.title}\n`;
  body += `- **Priority**: ${story.priority}\n`;
  body += `- **Story Points**: ${story.storyPoints}\n`;
  if (story.dependencies.length > 0) {
    body += `- **Dependencies**: ${story.dependencies.join(', ')}\n`;
  }
  body += `\n`;

  // Epic Goal
  body += `## Epic Goal\n\n`;
  body += `${story.epic.goal}\n\n`;

  // Footer
  body += `---\n`;
  body += `*Auto-generated from USER_STORIES.md*`;

  return body;
}

/**
 * Get labels for a story
 */
function getLabels(story) {
  const labels = ['user-story', ...EPIC_LABELS[story.epic.number]];

  // Add priority label
  if (PRIORITY_LABELS[story.priority]) {
    // Remove default epic priority if exists
    const epicPriorityIndex = labels.findIndex((l) => l.startsWith('priority:'));
    if (epicPriorityIndex > -1) {
      labels.splice(epicPriorityIndex, 1);
    }
    labels.push(PRIORITY_LABELS[story.priority]);
  }

  // Add story points as label
  labels.push(`points:${story.storyPoints}`);

  return labels;
}

/**
 * Create GitHub issue using gh CLI
 */
function createGitHubIssue(story) {
  const title = `[${story.id}] ${story.title}`;
  const body = formatIssueBody(story);
  const labels = getLabels(story).join(',');

  if (DRY_RUN) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Would create issue: ${title}`);
    console.log(`Labels: ${labels}`);
    console.log(`\nBody:\n${body}`);
    console.log(`${'='.repeat(80)}\n`);
    return null;
  }

  try {
    const command = `gh issue create --repo ${REPO_OWNER}/${REPO_NAME} --title "${title}" --body "${body.replace(
      /"/g,
      '\\"'
    )}" --label "${labels}"`;

    console.log(`Creating issue: ${title}...`);
    const result = execSync(command, { encoding: 'utf-8' });
    const issueUrl = result.trim();
    console.log(`✅ Created: ${issueUrl}`);

    return issueUrl;
  } catch (error) {
    console.error(`❌ Failed to create issue ${story.id}: ${error.message}`);
    return null;
  }
}

/**
 * Check if gh CLI is installed
 */
function checkGhCli() {
  try {
    execSync('gh --version', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error('❌ GitHub CLI (gh) is not installed.');
    console.error('Install it from: https://cli.github.com/');
    return false;
  }
}

/**
 * Check if gh CLI is authenticated
 */
function checkGhAuth() {
  try {
    execSync('gh auth status', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error('❌ GitHub CLI is not authenticated.');
    console.error('Run: gh auth login');
    return false;
  }
}

/**
 * Create labels in GitHub repo if they don't exist
 */
function ensureLabels() {
  const allLabels = new Set();

  // Collect all labels
  Object.values(EPIC_LABELS).forEach((labels) => labels.forEach((l) => allLabels.add(l)));
  Object.values(PRIORITY_LABELS).forEach((l) => allLabels.add(l));
  allLabels.add('user-story');

  // Story points labels (1-10)
  for (let i = 1; i <= 10; i++) {
    allLabels.add(`points:${i}`);
  }

  console.log('Ensuring labels exist...');

  allLabels.forEach((label) => {
    try {
      // Try to get the label
      execSync(`gh label list --repo ${REPO_OWNER}/${REPO_NAME} | grep "${label}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      // Label doesn't exist, create it
      try {
        let color = '0366d6'; // Default blue

        if (label.startsWith('epic:')) color = '8B4513'; // Brown
        if (label.startsWith('priority:must')) color = 'd73a4a'; // Red
        if (label.startsWith('priority:should')) color = 'fbca04'; // Yellow
        if (label.startsWith('priority:could')) color = '0e8a16'; // Green
        if (label.startsWith('priority:wont')) color = 'd4c5f9'; // Purple
        if (label.startsWith('points:')) color = 'c5def5'; // Light blue
        if (label === 'user-story') color = '1d76db'; // Dark blue

        execSync(`gh label create "${label}" --repo ${REPO_OWNER}/${REPO_NAME} --color ${color}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        console.log(`  ✅ Created label: ${label}`);
      } catch (createError) {
        console.log(`  ⚠️  Could not create label: ${label}`);
      }
    }
  });
}

/**
 * Main function
 */
function main() {
  console.log('🚀 GitHub Issues Creator for Smart Deployment Plugin\n');

  // Pre-flight checks
  if (!checkGhCli()) return;
  if (!checkGhAuth()) return;

  if (!fs.existsSync(USER_STORIES_PATH)) {
    console.error(`❌ USER_STORIES.md not found at: ${USER_STORIES_PATH}`);
    return;
  }

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No issues will be created\n');
  }

  // Parse user stories
  console.log('📖 Parsing USER_STORIES.md...\n');
  const stories = parseUserStories();
  console.log(`Found ${stories.length} user stories across ${new Set(stories.map((s) => s.epic.number)).size} epics\n`);

  // Filter by epic if specified
  let storiesToCreate = stories;
  if (EPIC_NUMBER) {
    storiesToCreate = stories.filter((s) => s.epic.number === EPIC_NUMBER);
    console.log(`Filtered to Epic ${EPIC_NUMBER}: ${storiesToCreate.length} stories\n`);
  }

  if (!DRY_RUN) {
    // Ensure labels exist
    ensureLabels();
    console.log('');
  }

  // Create issues
  console.log('📝 Creating issues...\n');
  const results = {
    created: 0,
    failed: 0,
  };

  storiesToCreate.forEach((story) => {
    const result = createGitHubIssue(story);
    if (result || DRY_RUN) {
      results.created++;
    } else {
      results.failed++;
    }
  });

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary');
  console.log('='.repeat(80));
  if (DRY_RUN) {
    console.log(`Would create: ${results.created} issues`);
  } else {
    console.log(`✅ Created: ${results.created} issues`);
    console.log(`❌ Failed: ${results.failed} issues`);
  }
  console.log('='.repeat(80));

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to create the issues');
  }
}

// Run
main();
