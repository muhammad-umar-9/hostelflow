# HostelFlow — working agreement

Self-hosted PWA for independently operated private hostels in Pakistan. First pilot:
H-K Boys Hostel, Lahore. `PROJECT_SPEC.md` is the product and architecture specification;
`docs/frontend-audit.md` is the live checklist of what is still mock-driven.

This file is the permanent working agreement. It applies to every remaining milestone,
feature, fix, security change and deployment change until HostelFlow is complete.

## Repository

This directory is the git repository root and the deployed application root. Deployment
artifacts (`Dockerfile`, `compose.yaml`, Caddy configuration, `docs/`) live here alongside
the Next.js app. Remote: `https://github.com/muhammad-umar-9/hostelflow` (public).

`main` holds reviewed work only. The unmodified Claude Design export is tagged
`baseline-export`.

**`main` is protected on GitHub.** Direct pushes and force pushes are refused; changes
arrive through a pull request whose branch is up to date and whose four CI checks pass:

- Format, lint, types, unit tests, build
- Database integration tests
- Playwright smoke tests
- Production image builds and can start

Admin enforcement is off, so the owner keeps an escape hatch, and no approving review is
required — review happens through `/code-review`, not GitHub approvals.

## Commands

```bash
npm run format:check   # Prettier
npm run lint           # ESLint flat config
npm run typecheck      # tsc --noEmit
npm run build          # production build
npm run verify         # format + lint + typecheck + build
npm run test:e2e       # Playwright (builds and starts the app itself)
npm audit              # dependency advisories
```

## Mandatory branch and review workflow

**Never implement project changes directly on `main`.**

For every milestone or meaningful unit of work:

1. Confirm the working tree is clean.
2. Switch to `main`.
3. If a remote exists, update safely using fast-forward only.
4. Create a dedicated branch from the latest reviewed `main`.
5. Implement all changes on that branch.
6. Use clear, logical commits instead of one uncontrolled commit.
7. Run every required validation before declaring the branch ready:
   - formatting
   - lint
   - TypeScript type checking
   - unit tests
   - integration tests
   - relevant Playwright tests
   - production build
   - dependency/security audit
8. Provide a milestone report containing:
   - branch name
   - commits
   - files changed
   - migrations added
   - architectural decisions
   - security implications
   - commands and exact results
   - known limitations
9. **Stop and wait for the user to run `/code-review max`.**
10. Do not merge the branch into `main` before the review is complete.
11. Address every valid blocking, high-severity and medium-severity review finding on the
    same branch.
12. Document any rejected review finding with clear technical evidence.
13. Rerun all affected tests and the complete required validation suite.
14. If fixes materially changed the branch, stop again so the user can rerun
    `/code-review max`.
15. Merge into `main` only after:
    - the review has no unresolved blocking findings;
    - all required checks pass;
    - migrations and deployment implications are documented;
    - the user confirms that the review is complete and authorizes the merge.
16. Use a normal merge or `--no-ff` merge so the milestone history remains visible.
17. After merging, verify `main` again with at least:
    - typecheck
    - production build
    - relevant test suite
18. Report the merge commit and final verification results.
19. Create the next branch only from this newly verified `main`.

### Branch naming

| Prefix                   | Use                           |
| ------------------------ | ----------------------------- |
| `foundation/<work>`      | Platform groundwork           |
| `feature/<feature-name>` | Product features              |
| `fix/<issue-name>`       | Defect fixes                  |
| `security/<issue-name>`  | Security changes              |
| `test/<test-area>`       | Test-only work                |
| `ops/<deployment-work>`  | Deployment and infrastructure |
| `hotfix/<urgent-fix>`    | Urgent production fixes       |

Current milestone branch: **`feature/real-authentication`**.

Merged so far: foundation (`2f47a21`), admission vertical slice (`7268ea9`), Cloudflare
tunnel deployment (`3c46c16`).

Expected later branches: `feature/admission-wizard-wiring`,
`feature/resident-upload-links`, `feature/multi-hostel-tenancy`,
`feature/payments-and-receipts`, `feature/enquiries-and-bed-holds`,
`feature/police-verification`, `feature/checkout-and-deposits`,
`feature/resident-portal`, `feature/pwa-offline-support`, `ops/production-hardening`,
`ops/server-deployment`.

### Hard rules

- Never force-push or rewrite `main`.
- Never use `git reset --hard` to solve ordinary development problems.
- Never merge code with failing checks.
- Never bypass a failing test merely to complete a milestone.
- Never delete or modify existing migrations after they have reached reviewed `main`;
  create a new corrective migration.
- Never combine unrelated features into the same branch.
- Never deploy an unreviewed feature branch to production.
- Production deployments must originate from reviewed `main` or a reviewed release tag.
- Emergency work must still use a `hotfix/` branch and pass an expedited review.
- Preserve unrelated user changes and stop if they conflict with the current task.

### Stacked pull requests

Learned the hard way while merging the foundation milestone: **GitHub does not always
retarget a stacked PR's base when the PR below it merges.** All four PRs reported `MERGED`
while `main` had received only the first; the other three had merged into their own base
branches, leaving 54 files' worth of work off `main`.

So when merging a stack, after every merge:

1. Confirm the next PR's base actually changed to `main` (`gh pr view N --json baseRefName`).
2. Retarget it explicitly if it did not (`gh pr edit N --base main`).
3. After the last merge, verify by content rather than by badge:
   `git diff --stat main <verified-tip>` must be empty.

A green `MERGED` badge says the branch was merged somewhere. It does not say it was merged
into `main`.

## Local environment

PostgreSQL, MinIO and Docker run on the **owner's server**, not on the development
machine. Do not install or start them locally. Work that needs a live database (applying
migrations, seeding, database-integration tests) is written locally, generated offline
where possible, and executed on the server with documented commands. Never report a
database-dependent check as passing when it has not actually run.
