# How to Deploy for Testing

This guide explains how to deploy feature branches to the public test site hosted on GitHub Pages, and how to merge tested features back to main without bringing over the deployment artifacts.

## ⚠️ CRITICAL: NEVER MERGE TEST BRANCH TO MAIN ⚠️

**IMPORTANT WORKFLOW RULE:**
1. **Develop on your feature branch** (e.g., `my-feature`, `QSO-Difficulty-Levels`)
2. **Merge your feature branch to `test`** for public testing
3. **After testing passes, merge your FEATURE BRANCH to `main`** (NOT the test branch!)

**NEVER run:** `git checkout main && git merge test`

The `test` branch contains GitHub Pages deployment files (`docs/` folder, no root `index.html`) that should NEVER be merged to `main`. Always merge your original feature branch to main, not the test branch.

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

The `docs/` folder is what GitHub Pages serves from `/docs`. Update it with the latest changes:

```bash
# Remove old docs folder
rm -rf docs

# Copy netlify-deploy contents to docs
cp -r netlify-deploy/. docs/

# CRITICAL: Ensure there is NO index.html in the root directory
# GitHub Pages is configured to serve from /docs, not from root
# A root index.html will cause redirect issues
rm -f index.html

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

⚠️ **CRITICAL:** Once your feature has been tested on the public test site, merge your **ORIGINAL FEATURE BRANCH** to `main`, NOT the `test` branch. The test branch contains GitHub Pages deployment files that should never go to main.

### Step 1: Checkout Main Branch

```bash
git checkout main
git pull origin main
```

### Step 2: Merge Your Feature Branch (NOT test!)

**CORRECT METHOD - Merge your feature branch:**

```bash
# Checkout main
git checkout main

# Merge your ORIGINAL feature branch (the one you developed on)
git merge your-feature-branch

# Example: If you were working on QSO-Difficulty-Levels
git merge QSO-Difficulty-Levels

# Commit if needed (if there are conflicts to resolve)
git commit -m "Merge your-feature-branch to main after successful testing"
```

**WRONG METHOD - DO NOT DO THIS:**

```bash
# ❌ NEVER DO THIS:
git checkout main
git merge test  # This will bring over docs/ folder and other test-only files!
```

### Alternative: If You Must Pull From Test Branch

If you accidentally made commits directly on the `test` branch (not recommended), use one of these methods:

**Option A: Cherry-pick specific commits (Safest)**

```bash
# Find the specific commits you want from test (exclude docs/ updates)
git log test --oneline

# Cherry-pick only your feature commits
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>
# etc.
```

**Option B: Merge specific files only**

```bash
# Checkout specific files from test
git checkout test -- training/qso-simulator/src
git checkout test -- training/scripts/some-file.js

# Commit the changes
git commit -m "Merge [feature-name] from test branch (files only)"
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

### ⚠️ Critical Branch Management Rules

**DO:**
- ✅ Develop on feature branches (e.g., `my-feature`, `QSO-Difficulty-Levels`)
- ✅ Merge feature branch → `test` for testing
- ✅ After testing, merge feature branch → `main` for production
- ✅ Keep feature branches until they're merged to main

**DON'T:**
- ❌ **NEVER** merge `test` → `main` (will bring GitHub Pages files)
- ❌ Don't make commits directly on `test` branch (use feature branches)
- ❌ Don't delete feature branches until merged to main
- ❌ Don't create a root `index.html` on test branch (GitHub Pages serves from `/docs`)

### About the `docs/` Folder

- **Only exists on the `test` branch** - Do NOT merge to `main`
- Contains the same structure as `netlify-deploy` but used for GitHub Pages
- GitHub Pages is configured to serve from `/docs` folder on the `test` branch
- **Must NOT have a root `index.html`** - GitHub Pages serves directly from `/docs`

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

### Workflow 1: Test a Feature, Then Deploy to Production (CORRECT METHOD)

```bash
# 1. Develop on feature branch
git checkout -b my-new-feature
# ... make changes to training/ files ...
git add .
git commit -m "Add my new feature"
git push origin my-new-feature

# 2. Merge feature branch to test for public testing
git checkout test
git pull origin test
git merge my-new-feature

# 3. Update docs/ folder for GitHub Pages
rm -rf docs
cp -r netlify-deploy/. docs/
rm -f index.html  # CRITICAL: Remove root index if it exists
git add .
git commit -m "Deploy my-new-feature to test for public testing"
git push origin test

# 4. Test at https://vail-cw.github.io/training_tools/
# ... verify feature works correctly ...

# 5. After testing passes, merge FEATURE BRANCH to main (NOT test!)
git checkout main
git pull origin main
git merge my-new-feature  # ✅ Merge feature branch, NOT test branch!
git push origin main

# 6. Update netlify-deploy/ for production
# ... update netlify-deploy as described in Step 3 ...
git add netlify-deploy/
git commit -m "Update netlify-deploy with my-new-feature"
git push origin main

# 7. Deploy to Netlify
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

### GitHub Pages Shows Wrong Content or Redirects to /training/

**Problem:** The site redirects to `/training/qso-simulator/` instead of `/qso-simulator/`

**Solution:** There's a root `index.html` file causing redirects. Remove it:

```bash
git checkout test
rm -f index.html
git add index.html
git commit -m "Remove root index.html - GitHub Pages serves from /docs"
git push origin test
```

**Explanation:** GitHub Pages is configured to serve from the `/docs` folder. A root `index.html` will redirect users to the wrong path.

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
2. Copied the `dist/` folder to `docs/qso-simulator/`
3. Committed and pushed the built files
4. No root `index.html` exists (it should be deleted)

### Accidentally Merged test to main

If you accidentally ran `git merge test` on main:

```bash
# Undo the merge (if not pushed yet)
git reset --hard HEAD~1

# If already pushed, you'll need to revert
git revert -m 1 HEAD
git push origin main

# Then merge the correct feature branch
git merge your-feature-branch
```

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
