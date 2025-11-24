# How to Deploy for Testing

This guide explains how to deploy feature branches to the public test site hosted on GitHub Pages, and how to merge tested features back to main without bringing over the deployment artifacts.

## Overview

- **Test Branch:** `test` - Deployed to GitHub Pages at https://vail-cw.github.io/training_tools/
- **Main Branch:** `main` - Production code, deployed to Netlify at https://training.vailmorse.com
- **Feature Branches:** Your development branches (e.g., `QSO-Difficulty-Levels`)

## Deploying a Feature Branch for Testing

### Step 1: Merge Your Feature Branch into `test`

```bash
# Make sure you're on your feature branch and all changes are committed
git status

# Checkout the test branch
git checkout test

# Pull latest changes from remote
git pull origin test

# Merge your feature branch into test
git merge your-feature-branch

# Resolve any merge conflicts if they occur
# Then commit the merge
```

### Step 2: Rebuild QSO Simulator (if needed)

If you made changes to the QSO Simulator, rebuild it:

```bash
cd training/qso-simulator
npm run build
cd ../..
```

### Step 3: Update the Deployment Package

The `docs/` folder is what GitHub Pages serves. Update it with the latest changes:

```bash
# Remove old docs folder
rm -rf docs

# Copy netlify-deploy contents to docs
cp -r netlify-deploy/. docs/

# If you rebuilt QSO Simulator, update it in docs as well
# (The build process should have already updated netlify-deploy/qso-simulator)
```

### Step 4: Commit and Push to Test

```bash
# Stage all changes including docs
git add .

# Commit with a descriptive message
git commit -m "Deploy [feature-name] to test branch for public testing"

# Push to GitHub
git push origin test
```

### Step 5: Wait for GitHub Pages Build

GitHub Pages will automatically rebuild the site. You can monitor the deployment:

- Visit: https://github.com/Vail-CW/training_tools/deployments
- Or check build status: `gh api repos/Vail-CW/training_tools/pages/builds/latest`

The site should be live in 1-2 minutes at: https://vail-cw.github.io/training_tools/

## Merging Tested Features Back to Main

Once your feature has been tested on the public test site, you can merge it back to `main` **without** bringing over the GitHub Pages deployment files.

### Step 1: Checkout Main Branch

```bash
git checkout main
git pull origin main
```

### Step 2: Merge Using Specific Paths (Excluding docs/)

**Option A: Merge specific files/folders (Recommended)**

If your changes are contained in specific directories:

```bash
# Merge only the directories you changed
# Example: If you only changed QSO Simulator
git checkout test -- training/qso-simulator/src
git checkout test -- training/qso-simulator/package.json

# Or if you changed main training tools
git checkout test -- training/scripts
git checkout test -- training/index.html
git checkout test -- training/training.css

# Commit the changes
git commit -m "Merge [feature-name] from test branch"
```

**Option B: Merge everything, then remove docs/ (Alternative)**

```bash
# Merge the test branch
git merge test --no-commit

# Remove the docs folder before committing
git reset HEAD docs/
git checkout -- docs/

# Or if docs doesn't exist on main, just remove it
rm -rf docs
git add -u docs

# Now commit the merge
git commit -m "Merge [feature-name] from test branch (excluding docs/)"
```

**Option C: Cherry-pick specific commits (Most precise)**

```bash
# Find the commit hashes from test branch that you want
git log test --oneline

# Cherry-pick specific commits
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>
# etc.
```

### Step 3: Update netlify-deploy for Production

After merging to main, update the production deployment package:

```bash
# If you changed QSO Simulator, rebuild it first
cd training/qso-simulator
npm run build
cd ../..

# Copy training files to netlify-deploy
# (Adjust paths based on what you changed)

# Update main index and assets
cp training/index.html netlify-deploy/
cp training/training.css netlify-deploy/

# Update scripts if changed
cp training/scripts/*.js netlify-deploy/scripts/

# Update QSO Simulator build
rm -rf netlify-deploy/qso-simulator
cp -r training/qso-simulator/dist netlify-deploy/qso-simulator

# Commit the updated netlify-deploy
git add netlify-deploy/
git commit -m "Update netlify-deploy with [feature-name]"
```

### Step 4: Push to Main

```bash
git push origin main
```

### Step 5: Deploy to Production (Netlify)

Once pushed to main, deploy to Netlify:

```bash
# Drag the netlify-deploy folder to Netlify dashboard
# Or use Netlify CLI:
netlify deploy --prod --dir=netlify-deploy
```

## File Structure Reference

```
Vail Training Tools/
├── training/                    # Source files for main training tools
│   ├── index.html
│   ├── training.css
│   ├── scripts/
│   └── qso-simulator/          # QSO Simulator source
│       ├── src/                 # Source code (edit here)
│       ├── dist/                # Built files (generated by webpack)
│       └── webpack.*.js         # Build configuration
├── netlify-deploy/              # Production deployment package (for Netlify)
│   ├── index.html
│   ├── training.css
│   ├── scripts/
│   ├── lib/
│   └── qso-simulator/           # Built QSO Simulator for production
├── docs/                        # GitHub Pages deployment (test branch only)
│   └── (mirrors netlify-deploy structure)
└── HOW_TO_DEPLOY_FOR_TESTING.md  # This file
```

## Important Notes

### About the `docs/` Folder

- **Only exists on the `test` branch** - Do NOT merge to `main`
- Contains the same structure as `netlify-deploy` but used for GitHub Pages
- GitHub Pages is configured to serve from `/docs` folder on the `test` branch

### About `netlify-deploy/` Folder

- **Exists on `main` branch** - This is your production deployment package
- Must be manually updated when you change source files
- This is what gets deployed to https://training.vailmorse.com

### Build Process

The QSO Simulator uses Webpack and must be built before deployment:

```bash
cd training/qso-simulator
npm run build       # Production build → training/qso-simulator/dist/
```

After building, copy `dist/` contents to deployment folders:
- For testing: `docs/qso-simulator/`
- For production: `netlify-deploy/qso-simulator/`

## Common Workflows

### Workflow 1: Test a Feature, Then Deploy to Production

```bash
# 1. Develop on feature branch
git checkout -b my-new-feature
# ... make changes ...
git add .
git commit -m "Add my new feature"
git push origin my-new-feature

# 2. Merge to test for public testing
git checkout test
git merge my-new-feature
# Update docs/ folder as described above
git push origin test
# Test at https://vail-cw.github.io/training_tools/

# 3. After testing, merge to main (without docs/)
git checkout main
git checkout test -- training/scripts/my-changed-files.js
git commit -m "Merge my-new-feature from test"
# Update netlify-deploy/ as described above
git push origin main

# 4. Deploy to Netlify
netlify deploy --prod --dir=netlify-deploy
```

### Workflow 2: Quick Fix Directly to Main

```bash
# 1. Make fix on main
git checkout main
# ... make changes ...
git add .
git commit -m "Fix urgent bug"
git push origin main

# 2. Update netlify-deploy and deploy
# ... update netlify-deploy/ ...
netlify deploy --prod --dir=netlify-deploy

# 3. Merge back to test to keep it current
git checkout test
git merge main
# Update docs/ folder
git push origin test
```

## Troubleshooting

### GitHub Pages Not Updating

Check the build status:
```bash
gh api repos/Vail-CW/training_tools/pages/builds/latest
```

Trigger a rebuild:
```bash
git commit --allow-empty -m "Trigger GitHub Pages rebuild"
git push origin test
```

### QSO Simulator Not Working

Make sure you:
1. Ran `npm run build` in `training/qso-simulator/`
2. Copied the `dist/` folder to the deployment location
3. Committed and pushed the built files

### Merge Conflicts Between test and main

If you get conflicts when merging:
1. Resolve conflicts in your feature files
2. **Always** choose to keep `main` version for `docs/` folder (or exclude it entirely)
3. Complete the merge commit

## GitHub Pages Configuration

Current settings (should not need to change):
- **Source branch:** `test`
- **Source folder:** `/docs`
- **URL:** https://vail-cw.github.io/training_tools/

To view/change settings:
- Visit: https://github.com/Vail-CW/training_tools/settings/pages
- Or use CLI: `gh api repos/Vail-CW/training_tools/pages`

---

**Last Updated:** 2025-11-24
**Maintainer:** KE9BOS
**Questions?** Contact ke9bos@pigletradio.org or visit https://discord.gg/GBzj8cBat7
