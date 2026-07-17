markdown
---
name: 🔀 Pull Request
about: Submit code changes for review and merge
title: '[PR]: '
labels: ['needs-review']
assignees: ''
---

## 🔀 Pull Request

### 📝 Description
<!-- Provide a clear and concise description of the changes -->

**What does this PR do?**
[Brief summary of changes]

**Why is this needed?**
[Explain the problem being solved or feature being added]

**Related Issue(s):**
<!-- Link the issues this PR addresses -->
- Closes #
- Fixes #
- Related to #

### 🎯 Type of Change
<!-- Mark the type of change with an [x] -->
- [ ] 🐛 Bug Fix (non-breaking change that fixes an issue)
- [ ] ✨ New Feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking Change (fix or feature that changes existing functionality)
- [ ] 🚀 Performance Improvement
- [ ] 📚 Documentation Update
- [ ] 🎨 UI/UX Enhancement
- [ ] 🔒 Security Fix
- [ ] 🧹 Code Refactoring (no functional changes)
- [ ] 🧪 Test Addition/Update
- [ ] ⚙️ Configuration/Infrastructure Change
- [ ] 🔧 Build/Deployment Update
- [ ] 📦 Dependency Update

### 📁 Files Changed
<!-- Summary of files modified, added, or deleted -->

**Modified Files:**
| File | Change Type | Description |
|------|-------------|-------------|
| `src/js/modules/example.js` | Modified | Updated function logic |
| `src/css/components.css` | Modified | Fixed styling issue |

**New Files:**
| File | Description |
|------|-------------|
| `src/js/components/newComponent.js` | New reusable component |

**Deleted Files:**
| File | Reason |
|------|--------|
| `src/js/old/deprecated.js` | Replaced by new implementation |

### 🧪 Testing

**Test Coverage:**
<!-- Describe the tests you've added or modified -->
- [ ] Unit Tests Added/Updated
- [ ] Integration Tests Added/Updated
- [ ] E2E Tests Added/Updated
- [ ] Manual Testing Performed
- [ ] Edge Cases Tested

**Test Results:**
Paste test output or summary here
Example:
✅ Unit Tests: 45 passed, 0 failed
✅ Integration Tests: 12 passed, 0 failed
✅ E2E Tests: 8 passed, 0 failed

text

**Manual Testing Steps:**
<!-- Steps to manually verify the changes -->
1. Go to '...'
2. Click on '...'
3. Verify that '...'
4. Check that '...'

**Testing Environment:**
- Browser(s): [e.g., Chrome 126, Firefox 128, Safari 17]
- OS: [e.g., Windows 11, macOS 14.2]
- Device(s): [e.g., Desktop, iPhone 15, iPad Pro]
- Screen Size(s): [e.g., 1920x1080, 375x812]
- Node Version: [e.g., 20.x]

### 📸 Screenshots / Recordings
<!-- If applicable, add screenshots or recordings -->

**Before:**
<!-- Screenshot of the current state -->
![Before](url)

**After:**
<!-- Screenshot of the new state -->
![After](url)

### 📊 Performance Impact
<!-- Any changes to application performance -->

**Bundle Size Changes:**
| Bundle | Before | After | Change |
|--------|--------|-------|--------|
| JS Main | XXX KB | XXX KB | +/- XX KB |
| CSS Main | XXX KB | XXX KB | +/- XX KB |

**Runtime Performance:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Page Load | XXms | XXms | +/- XXms |
| API Response | XXms | XXms | +/- XXms |
| Memory Usage | XXMB | XXMB | +/- XXMB |

### 🔒 Security Considerations
<!-- Any security implications of the changes -->
- [ ] No security impact
- [ ] Authentication/Authorization changes
- [ ] Data validation/sanitization changes
- [ ] API endpoint changes
- [ ] Third-party dependency added/updated
- [ ] Sensitive data handling changes

**Security Review Notes:**
[Describe any security considerations]

### 🌐 Accessibility
<!-- Accessibility impact of UI changes -->
- [ ] No UI changes
- [ ] ARIA labels added/updated
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Color contrast verified
- [ ] Focus states verified
- [ ] Touch targets verified (44px minimum)

### 📱 Responsive Design
<!-- Impact on mobile/tablet layouts -->
- [ ] No layout changes
- [ ] Mobile tested (320px)
- [ ] Tablet tested (768px)
- [ ] Desktop tested (1440px)
- [ ] All breakpoints verified

### 🔄 Breaking Changes
<!-- Document any breaking changes and migration path -->

**Breaking Changes:**
- [ ] No breaking changes
- [ ] API changes (describe below)
- [ ] Database schema changes (describe below)
- [ ] Configuration changes (describe below)

**Migration Guide:**
```javascript
// Before (old way)
oldFunction(param1, param2);

// After (new way)
newFunction({ param1, param2 });
📋 Dependencies
<!-- List any new or updated dependencies -->
New Dependencies:

Package	Version	Purpose
package-name	1.0.0	Description of why needed
Updated Dependencies:

Package	Old Version	New Version
package-name	1.0.0	2.0.0
📚 Documentation
<!-- Documentation updates included -->
README updated

API documentation updated

User guide updated

Changelog updated

Code comments added

JSDoc comments added/updated

No documentation needed

✅ Pre-Merge Checklist
<!-- Verify all items before requesting review -->
Code follows project coding standards

All tests pass locally

No console errors or warnings

No commented-out code

No debugging artifacts

Git history is clean (no merge commits, meaningful commit messages)

Branch is up-to-date with the target branch

Conflicts resolved

Linting passes (npm run lint)

Formatting passes (npm run format)

Build succeeds (npm run build)

Self-review completed

👥 Reviewers
<!-- Tag specific reviewers if needed -->
@mention-reviewer-1 for [reason]
@mention-reviewer-2 for [reason]

📝 Additional Notes
<!-- Any other information for reviewers -->
Deployment Notes:
[Special deployment instructions if any]

Rollback Plan:
[How to rollback if something goes wrong]

Follow-up Tasks:

Task 1 (tracked in issue #)

Task 2 (tracked in issue #)

Thank you for contributing to 11 Avatar Digital Hub! 🚀
A maintainer will review your PR within 2-3 business days.
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
