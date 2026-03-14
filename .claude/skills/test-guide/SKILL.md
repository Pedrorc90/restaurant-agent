---
name: test-guide
description: Generates a structured manual test guide for recent code changes in the restaurant-agent project and saves it to test-guidelines/P{N}-test.md. Use this skill whenever the user asks to "create a test guide", "document the tests", "write a test plan", "add a test guide for these changes", or after implementing a feature or fix and wanting to document how to verify it manually. Always trigger this skill when the user mentions test guides, test plans, or P{N}-test.md files.
---

# Test Guide Generator

Generate a manual test guide for the changes made in this session and save it to `test-guidelines/`.

## Steps

### 1. Determine the next filename

List existing files in `test-guidelines/` and find the highest `P{N}-test.md` number. The new file is `P{N+1}-test.md`.

### 2. Identify what changed

Run these commands to understand the scope of the changes:

```bash
git diff HEAD~1..HEAD --stat
git diff HEAD~1..HEAD -- src/
git log --oneline -5
```

If there are uncommitted changes (common mid-session), also check:

```bash
git diff --stat
git status
```

Read any relevant source files if the diff alone is not enough to understand what was added or fixed.

### 3. Group changes into testable sections

Each section in the guide should correspond to one coherent change — a feature, a fix, a refactor with visible behavior, or a security improvement. Skip internal-only refactors with no observable behavior. Good section names describe *what the user can verify*, not what file was edited.

Examples of good section names:
- "Tenant name validation — rejects XML injection"
- "Business hours — HH:MM format enforced"
- "New endpoint POST /v1/tenants/:id/menu"

### 4. Write the guide

Follow the exact format of the existing guides (`P1-test.md`, `P2-test.md`). Key rules:

**File structure:**
```
# P{N} — Manual Test Plan

Prerequisites: server running locally (`npm run dev:server`), `ADMIN_API_KEY=testkey` in `.env`.

[Optional: > **Note:** one-line context if something is breaking or notable]

## Status

- [ ] 1. Section name
- [ ] 2. Section name
...

---

## 1. Section name

[steps or curl commands]

**Expected:** [what to look for]

---
```

**All items in Status start unchecked `[ ]`** — the user marks them off manually.

**curl conventions:**
- Base URL: `http://localhost:3000`
- All routes under `/v1/` (except `/health`)
- Admin routes: `-H "X-Admin-Key: testkey"`
- Tenant routes: `-H "X-Tenant-ID: la-cazuela"` (or the relevant tenant)
- Always pipe to `| jq .` for JSON responses
- For HTTP status only: `-s -o /dev/null -w "%{http_code}\n"`
- For status + body: `-s -w "\n%{http_code}"` then `| tail -2`

**Section content patterns:**

*For API validation (rejected inputs):*
```bash
# REJECTED: reason
curl -s -X POST http://localhost:3000/v1/... \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: testkey" \
  -d '{"field": "bad value"}' | jq .
# Expected: 400 VALIDATION_ERROR
```

*For behavior that requires manual observation (no curl):*
Use a numbered step list instead of a code block.

*For subsections within a section:*
Use `### Na. Sub-title` headings (e.g. `### 3a.`, `### 3b.`).

*For things that are hard to test directly:*
Explain the indirect verification approach (e.g. checking build output, inspecting logs, checking DB with sqlite3).

**Language:** write section titles and content in the same language as the existing guides for this project (Spanish is fine for prose, English for code/commands).

### 5. Save the file

Write to `test-guidelines/P{N}-test.md`.

Confirm to the user: "Guía guardada en `test-guidelines/P{N}-test.md` con X secciones."
