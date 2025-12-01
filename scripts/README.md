# 📜 Scripts

Automation scripts for the Smart Deployment Plugin project.

---

## 🎫 create-github-issues.js

Automates the creation of GitHub issues from `USER_STORIES.md`.

### Prerequisites

1. **GitHub CLI** installed and authenticated:
   ```bash
   # Install (macOS)
   brew install gh
   
   # Authenticate
   gh auth login
   ```

2. **Node.js** (v14+)

### Usage

#### Dry Run (Preview)
See what issues would be created without actually creating them:

```bash
node scripts/create-github-issues.js --dry-run
```

#### Create All Issues
Create all 90 user stories as GitHub issues:

```bash
node scripts/create-github-issues.js
```

#### Create Specific Epic
Create issues for a specific epic only:

```bash
# Epic 1: Core Infrastructure
node scripts/create-github-issues.js --epic=1

# Epic 2: Metadata Parsers
node scripts/create-github-issues.js --epic=2

# Epic 3: Dependency Analysis
node scripts/create-github-issues.js --epic=3

# ... and so on
```

### What It Does

1. **Parses** `docs/USER_STORIES.md`
2. **Extracts** all user stories with:
   - Title
   - User story format (As a... I want... So that...)
   - Acceptance criteria (as checkboxes)
   - Priority
   - Story points
   - Dependencies
   - Epic information
3. **Creates labels** automatically:
   - Epic labels (epic:core-infrastructure, etc.)
   - Priority labels (priority:must-have, etc.)
   - Story point labels (points:1, points:2, etc.)
   - User story label (user-story)
4. **Creates GitHub issues** with proper formatting and labels

### Example Output

```
🚀 GitHub Issues Creator for Smart Deployment Plugin

📖 Parsing USER_STORIES.md...

Found 90 user stories across 10 epics

Ensuring labels exist...
  ✅ Created label: epic:core-infrastructure
  ✅ Created label: priority:must-have
  ✅ Created label: points:3
  ...

📝 Creating issues...

Creating issue: [US-001] Functional Utilities...
✅ Created: https://github.com/jterrats/smart-deployment/issues/1

Creating issue: [US-002] Graph Algorithms...
✅ Created: https://github.com/jterrats/smart-deployment/issues/2

...

================================================================================
📊 Summary
================================================================================
✅ Created: 90 issues
❌ Failed: 0 issues
================================================================================
```

### Issue Format

Each GitHub issue includes:

- **Title**: `[US-XXX] Story Title`
- **Labels**: 
  - `user-story`
  - `epic:name`
  - `priority:level`
  - `points:N`
- **Body**:
  ```markdown
  ## User Story
  
  **As a** developer  
  **I want** to do something  
  **So that** I achieve a goal
  
  ## Acceptance Criteria
  
  - [ ] Criterion 1
  - [ ] Criterion 2
  - [ ] Criterion 3
  
  ## Metadata
  
  - **Epic**: 1 - Core Infrastructure
  - **Priority**: Must Have
  - **Story Points**: 3
  - **Dependencies**: US-001, US-002
  
  ## Epic Goal
  
  Establish foundational architecture and utilities
  ```

### Tips

1. **Start with dry-run**: Always preview with `--dry-run` first
2. **Epic by epic**: Create issues one epic at a time for better organization
3. **Check labels**: Verify labels are created correctly before bulk creation
4. **Rate limits**: GitHub API has rate limits; the script handles this with retries

### Troubleshooting

#### Error: "gh: command not found"
Install GitHub CLI: https://cli.github.com/

#### Error: "gh auth status failed"
Authenticate with: `gh auth login`

#### Error: "API rate limit exceeded"
Wait a few minutes and try again, or create issues epic by epic

#### Error: "Label already exists"
This is expected and handled gracefully - the script will reuse existing labels

---

## 🔮 Future Scripts

- `generate-changelog.js` - Generate CHANGELOG from git commits
- `sync-dependencies.js` - Sync dependencies between stories
- `generate-sprint-plan.js` - Generate sprint plans from user stories
- `update-story-status.js` - Update story status from GitHub issues

---

**Last Updated**: December 1, 2025

