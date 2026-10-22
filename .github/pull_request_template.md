## Summary

<!-- What does this change do, and why? One or two sentences. -->

## Requirement IDs

<!-- List every FR/NFR this PR serves, e.g. FR12, NFR7. Use "none (chore)" only for tooling or docs. -->

-

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor (no behavior change)
- [ ] Security fix
- [ ] Migration or data change
- [ ] Docs or tooling

## Checklist

### Tests
- [ ] Tests added or updated for this change (unit and/or integration)
- [ ] All tests pass locally and in CI
- [ ] Bug fixes include a regression test

### Requirements and review
- [ ] Requirement IDs listed above, and tests reference them where practical
- [ ] At least one teammate other than the author has been asked to review (NFR15)

### Database and migrations
- [ ] No schema change, **or** a migration is included
- [ ] Migration is reversible or has a documented rollback
- [ ] Migration was run against a copy of the data, and a backup step is in place (FR10, NFR9)

### Translations
- [ ] No user-facing text, **or** every new or changed string exists in both English and Spanish
- [ ] Option labels use option codes, not display strings

### Accessibility
- [ ] No UI change, **or** checked for keyboard use, labels, focus order and contrast (4.5:1, 16 px base)
- [ ] Works at tablet width

### Security and data
- [ ] No secrets, real patient data or `.env` values in the diff
- [ ] New routes declare a permission and are covered by the role-matrix test
- [ ] Actions that read or change patient data write an audit event
- [ ] No patient data in logs, URLs or error messages

## How to test

<!-- Steps a reviewer can follow, or a note on which tests cover it. -->

## Screenshots

<!-- For UI changes: before and after, in light and dark mode if relevant. -->
