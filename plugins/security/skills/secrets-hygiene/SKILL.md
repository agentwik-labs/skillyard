---
name: secrets-hygiene
description: Finds hard-coded credentials in a codebase, triages each hit, and walks through rotation, removal from git history, and prevention (env vars, secret managers, pre-commit scanning). Use when asked to "scan for secrets", "did we commit an API key", "check for leaked credentials", "clean up secrets", after a key is reported leaked, or before open-sourcing or sharing a private repository.
license: MIT
---

# Secrets Hygiene

Find credentials that live in source, config, or history; get every live one rotated; and leave the repo set up so it does not happen again. The order matters: a leaked key is compromised the moment it is pushed, so rotation comes before cleanup, and deleting the line is never the fix on its own.

## Workflow

1. **Scan the working tree.** From the skill directory run:
   `python3 scripts/scan_secrets.py <repo-path>`
   It prints `file:line:rule:masked-value` and exits 1 if anything is found, 0 if clean, 2 on usage errors. Add `--include-tests` to also scan fixture and test paths (skipped by default only for noise reduction, never assume tests are safe).
2. **Scan history** if the repo has any. Run `git log -p --all | python3 scripts/scan_secrets.py --stdin` to catch keys that were removed in later commits but are still in history.
3. **Triage every hit** into one of: live secret, revoked/expired secret, test fixture or placeholder, false positive. Do not ask the user to triage dozens of hits blind; group them by rule and file and give your call for each with the reason.
4. **For each live secret, in this order:**
   1. Tell the user to rotate or revoke it at the provider now. You cannot verify a key is dead from the code; assume it is live until the owner confirms.
   2. Check provider audit logs for use since the commit date (AWS CloudTrail, GitHub security log, Stripe events).
   3. Replace the literal with a runtime lookup (env var or secret manager) and add the variable to `.env.example` with a placeholder.
   4. Only then discuss rewriting history (`git filter-repo --replace-text`). History rewrite requires every clone to re-clone and force-push; get explicit approval first and never do it yourself unasked.
5. **Prevent.** Add `.env`, `*.pem`, `*.key`, `credentials.json` to `.gitignore`; add a pre-commit scanner (gitleaks, detect-secrets, or this script) and a CI step that fails on findings.
6. **Report** using the Output format.

## Rules

- **Never print a full secret.** Not in chat, not in the report, not in a commit message. Mask to the first 4 characters plus length. The scanner does this for you.
- **Never paste a found secret into a tool, URL, or API call** to "check if it works". Testing a credential is using it.
- **Rotation is the fix; removal is cleanup.** A key deleted in the next commit is still public in history, forks, CI logs, and caches.
- **Placeholders must look fake.** Use `AKIAEXAMPLEEXAMPLE00`, `ghp_EXAMPLE...`, `sk_test_PLACEHOLDER`. Realistic-looking fakes trip scanners forever and train people to ignore them.
- **Client-side code holds no secrets.** Anything shipped to a browser or mobile app is public; "publishable" keys are fine, secret keys are not, whatever the bundler does.
- **`.env` files are for local dev only.** Production secrets come from the platform's secret store (AWS Secrets Manager, GCP Secret Manager, Vault, Doppler, the CI provider's encrypted secrets).
- **Scope down when you replace.** A rotated key should get the minimum permissions and, where the provider supports it, an expiry.

## What the scanner detects

AWS access key IDs, GitHub tokens (`ghp_`, `gho_`, `ghs_`, `github_pat_`), Slack tokens, Stripe live keys, Google API keys, private key blocks (`-----BEGIN ... PRIVATE KEY-----`), JWTs, connection strings with inline passwords, and generic `password|secret|token|api_key = "<high-entropy value>"` assignments (Shannon entropy >= 3.5 over 16+ chars). It skips `.git`, `node_modules`, `vendor`, `dist`, `build`, virtualenvs, and binary files. It is a fast first pass, not a replacement for gitleaks in CI.

## Example

Bad response:
> "Found an AWS key in config.py: AKIA... (full key shown). I removed it and committed."

Good response:
> `config/settings.py:14 aws-access-key-id AKIA****************(20 chars)` - live, used by the S3 uploader.
> 1. Deactivate this key in IAM now and create a replacement scoped to `s3:PutObject` on the uploads bucket.
> 2. Check CloudTrail for calls from this key since 2026-03-02 (the commit date).
> 3. I changed `settings.py` to read `os.environ["AWS_ACCESS_KEY_ID"]` and added it to `.env.example`. Not committed yet.
> 4. The key is in 3 commits on `main`. After rotation, decide whether to rewrite history; rotation alone already neutralizes it.

## Output

```
## Secrets scan: <repo> (<date>)

| Location | Rule | Masked | Verdict | Action |
|---|---|---|---|---|
| path:line | rule | AKIA**** (20) | live / revoked / fixture / false positive | rotate, move to env, ignore |

### Rotate now (owner action required)
- <provider>: <what key, where to revoke, audit-log check>

### Code changes made
- <file>: <literal replaced by env/secret-manager lookup>

### Prevention
- [ ] .gitignore entries
- [ ] pre-commit hook
- [ ] CI scan step
```
