# JazzLMS API tests — Aziret

The Postman collection and local environment are in this folder. The environment export contains no saved JWTs and no secrets (`jwtSecret` is empty).

## Collection layout

| Folder | What it is |
|---|---|
| `00 Setup · Aziret` | Logs in the seed accounts, registers a learner, creates the shared fixtures (group, branch, category, course, lesson, question, test, certificate template). |
| `01`–`05` service folders | 123 Swagger-derived operations of the five services (hand-run only — see below). |
| `06 Security · N1-N8` | N1–N8 negatives, direct service access, spoofed headers. |
| `06 Security · matrix · Aziret` | SEC-01…06: direct-port matrix for all five services, header spoofing, forged/expired/foreign-secret tokens, the full 17-row × 3-role gateway matrix, rate limit, unknown paths. |
| `07 E2E · Aziret` | E2E-1…7 plus the gap-closing scenarios E2E-3b (lockout expires), 4b (clone lifecycle events), 5b (33/67/100 % checkpoints), 6b (weighted score + `TEST_COMPLETED`), 7b (Zipkin trace across gateway → course-service → user-service, Loki, Grafana, Prometheus). |
| `08 Checks · user-service · Aziret` | AUTH-01…06, DEMO-01, USR-01…08, SET-01/02, ORG (branches and groups). |
| `08 Checks · course-service · Aziret` | CAT, CRS, ENR, RPT, UNT (incl. uploads and the learner flow), CRT, QST, TST. |
| `08 Checks · notification, analytics, gamification · Aziret` | NTF-01…12, ANL-01…14, GAM-01…16. |
| `09 Known defects · Aziret` | The spec-expected result for every defect found. **These requests fail today by design** — see `API_TEST_FINDINGS.md`. |
| `99 Teardown · Aziret` | Restores account settings and deletes the Setup fixtures. |

Every generated folder creates its own users, courses and settings overrides and removes them again, so the folders can be run alone after `00 Setup`.

## Full acceptance run

From the repository root. `--delay-request 60` keeps the run under the gateway's rate limit (20 requests/s per user, burst 40):

```powershell
newman run docs/postman/JazzLMS.postman_collection.json `
  -e docs/postman/JazzLMS-local.postman_environment.json `
  --env-var "jwtSecret=<value of jwt.secret from services/api-gateway/src/main/resources/application.yml>" `
  --folder '00 Setup · Aziret' `
  --folder '06 Security · N1-N8' `
  --folder '06 Security · matrix · Aziret' `
  --folder '07 E2E · Aziret' `
  --folder '08 Checks · user-service · Aziret' `
  --folder '08 Checks · course-service · Aziret' `
  --folder '08 Checks · notification, analytics, gamification · Aziret' `
  --folder '99 Teardown · Aziret' `
  --iteration-count 3 --delay-request 60 --reporters cli
```

`jwtSecret` is only needed by `SEC-03e` (a correctly signed, expired token). Without it that one request skips itself.

Add `--folder '09 Known defects · Aziret'` to see the defect list fail.

The E2E extras use three more environment URLs (`zipkinUrl`, `lokiUrl`, `grafanaUrl`, `prometheusUrl`), already set to the local compose ports.

## Running one scenario

Run `00 Setup · Aziret` first, then the folder you want, then `99 Teardown · Aziret`. `E2E-5` uses the `e2eLearnerToken` / `e2eLearnerId` created by `E2E-1`, so run `E2E-1` before it. If a manual run stopped halfway, run `99 Teardown · Aziret` before starting over.

## Service operation folders

`01`–`05` are the raw Swagger operations. They are not part of the repeatable run because some requests create, modify or delete real records; review each body and expected status before running one. Their endpoint-specific positive and negative coverage lives in the `08 Checks` folders.

## Regenerating the check folders

`08`, `09`, `06 Security · matrix` and the E2E extras are generated from tables so the status expectations stay reviewable:

```powershell
node docs/postman/tools/build-checks.mjs
```

The generator (`tools/build-checks.mjs`, `tools/lib.mjs`, `tools/checks/*.mjs`) replaces only those folders and leaves the hand-written ones untouched. Fixtures for uploads and CSV imports are in `fixtures/`.

## Not covered by Newman

- `DELETE /api/notifications/history` and `POST /api/gamification/reset-statistics` wipe shared data (mail history, every user's points and the leaderboard); only their 403 paths are checked.
- 300 MB upload limit (413), `docker compose stop user-service` behaviour for `ENR-02`, Redis `TTL` / `KEYS` inspection and the `down -v` rebuild need Docker CLI access, which is not available in this environment. Lockout expiry is verified through behaviour instead (E2E-3b).
- Shuffle checks (`shuffleQuestions`) are probabilistic and are not asserted.
