# JazzLMS API tests — Aziret

The Postman collection and local environment are in this folder. The environment export contains no saved JWTs.

## Repeatable acceptance run

From the repository root, run the disposable setup, E2E scenarios, and teardown three times:

```powershell
newman run docs/postman/JazzLMS.postman_collection.json `
  -e docs/postman/JazzLMS-local.postman_environment.json `
  --folder '00 Setup · Aziret' `
  --folder '07 E2E · Aziret' `
  --folder '99 Teardown · Aziret' `
  --iteration-count 3 `
  --reporters cli
```

This sequence passed three iterations: 576 requests and 2,982 assertions, with zero failures. Teardown restores the account settings and deletes test users and course fixtures. It does not reset shared gamification statistics or Docker volumes.

When running E2E folders individually, run `00 Setup · Aziret` first. Run `E2E-1 · Registration and first login` before `E2E-5 · Complete course and certificate`: E2E-5 uses the `e2eLearnerToken` and `e2eLearnerId` created by E2E-1. If a previous manual run stopped partway through, run `99 Teardown · Aziret` before starting over.

## Security run

Run setup, the security folder, and teardown in one Newman invocation so tokens and fixtures remain available across the sequence:

```powershell
newman run docs/postman/JazzLMS.postman_collection.json `
  -e docs/postman/JazzLMS-local.postman_environment.json `
  --folder '00 Setup · Aziret' `
  --folder '06 Security · N1-N8' `
  --folder '99 Teardown · Aziret' `
  --reporters cli
```

The source maps malformed UUIDs and malformed JSON to HTTP 400 Problem Details. The rebuilt service has been verified through the full Security folder.

The setup + Security + teardown run passed 354 assertions with zero failures. A first cold run exceeded the 1.5-second response threshold on one fixture-creation call; the warm rerun passed. Historical findings and remaining checklist gaps are recorded in `API_TEST_FINDINGS.md`.

## Service operation folders

The collection includes 123 Swagger-derived operations across the five services. Those folders are not part of the repeatable acceptance command because some requests create, modify, or delete real records. Review each request body and expected status before running those operations.

`Newman-acceptance-report.html` is a sanitized summary of the passing repeatability run and expanded security run. It contains no credentials, JWTs, response bodies, or user data.
