---
name: release-notes
description: Drafts user-facing release notes and changelog entries from commits, merged PRs and tags between two versions, grouping changes by impact and calling out breaking changes with migration steps. Use when asked to "write release notes", "update the CHANGELOG", "what changed since v2.3", "draft the GitHub release", or when cutting a new version.
license: MIT
---

# Release Notes

Turn a range of commits and pull requests into notes a user can act on: what they get, what might break, and what they must do. Commit messages are written for developers at the time of change; release notes are written for users at the time of upgrade. Translate, filter, and group.

## Workflow

1. **Determine the range.** Find the previous release tag (`git describe --tags --abbrev=0`, or `git tag --sort=-v:refname`) and the target (new tag or `HEAD`). Confirm the version number with the user if it is not given.
2. **Collect changes.** `git log --no-merges --pretty='%h %s' <prev>..<target>`; if the repo uses GitHub, also list merged PRs in that range (`gh pr list --state merged --search "merged:>=<date>"`) because PR titles and labels are usually better than commit subjects.
3. **Classify each change** into: Breaking, Security, Added, Changed, Fixed, Deprecated, Removed, Performance, Internal. Use labels and Conventional Commit prefixes (`feat`, `fix`, `perf`, `!`, `BREAKING CHANGE:`) as hints, then read the diff when the message is vague.
4. **Drop internal noise**: CI tweaks, refactors with no behavior change, test-only changes, dependency bumps with no user effect. Keep dependency bumps that fix a CVE or change a supported version.
5. **Rewrite each kept item** from the user's point of view (rules below), with a PR or issue reference.
6. **Write migration steps** for every breaking change and deprecation.
7. **Write the highlights**: one to three sentences on the most important changes, at the top.
8. **Check versioning.** If there is a breaking change and the bump is not major (or minor while < 1.0), flag it to the user.

## Rules

- **User impact, not implementation.** "Exports now include archived projects" not "refactor ExportService query builder".
- **Start each item with a verb in past tense or a noun phrase, consistently.** Pick one style per document.
- **Breaking changes go first** and each one says what breaks, who is affected, and the exact steps or code change to migrate, with before/after snippets when it is an API change.
- **Security fixes** state severity and affected versions, and include the CVE/GHSA ID if one exists. Do not include exploit details before users have had time to upgrade.
- **Credit contributors** when the project does that (`thanks @handle`), especially first-time contributors.
- **Never invent changes.** Every line traces to a commit or PR. If a commit message is too vague to classify after reading the diff, list it under "Needs review" for the user.
- **Match the project's existing CHANGELOG format** (often Keep a Changelog). Add the new section at the top; do not rewrite old entries.

## Example

Bad:
> - fix bug
> - update deps
> - refactor auth (#412)
> - feat: new param

Good:
> ### Breaking
> - `client.search()` now returns a `Page` object instead of a list. Replace `for r in client.search(q)` with `for r in client.search(q).items`. (#418)
>
> ### Added
> - `--since` flag on `export` to export only records changed after a date. (#405)
>
> ### Fixed
> - Login no longer fails for email addresses containing `+`. (#412, thanks @rkim)
>
> ### Security
> - Upgraded `xml-parser` to 4.2.1 to fix an XXE issue (GHSA-xxxx-xxxx-xxxx, affects 2.0.0-2.4.1).

## Output

1. A markdown section ready to paste into `CHANGELOG.md` or a GitHub release:

```
## [X.Y.Z] - YYYY-MM-DD

<Highlights: 1-3 sentences>

### Breaking
### Security
### Added
### Changed
### Fixed
### Deprecated
### Removed
```
   Omit empty headings.
2. If asked, edit `CHANGELOG.md` in place (new section at top, compare link at bottom if the file uses them).
3. A short "Needs review" list of commits you could not classify, and any version-bump concern.
