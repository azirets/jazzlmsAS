# API test findings — Aziret

Validation date: 2026-10-28. The safe integrated collection was run three consecutive iterations against the local stack.

## Verified

- Setup, E2E-1 through E2E-7, and teardown passed 3/3 iterations: 576 requests, 2,982 assertions, zero failures.
- Direct access to each of the five service ports returned 401 without a bearer token and 200 with the admin token.
- E2E-1 verifies signup/login, the newcomer badge, signup and login analytics events, the configured welcome email, and duplicate registration rejection.
- E2E-2 verifies CSV import/export, group memberships, deactivation and denied login, deletion, and the remaining active member count.
- E2E-3 verifies default-group assignment, first-login password change, and lockout. The second bad password returns 423 at a threshold of 2; a third request remains locked.
- E2E-4 verifies duplicate enrollment rejection, sequential locking, clone/delete/restore/permanent deletion, reporting, and lifecycle events.
- E2E-5 verifies CHECKBOX, QUESTION, and TIME lessons, early TIME rejection and polling, certificate rendering/privacy, points, course report, and course events.
- E2E-6 verifies multiple-choice, fill-gap, ordering, and drag-drop questions, failed retry then pass, answer visibility, and one-time award.
- Kafka UI replayed the same `COURSE_COMPLETED` event twice (original offset 5, replay offsets 126 and 127). Gamification stayed at 205 points. A temporary rule created for the fixture produced one email on the first replay and no second email on the duplicate replay.
- The collection restores original account settings and removes the disposable records it creates.

## Defects observed in the expanded security run

The expanded run executed 211 requests and 1,083 assertions. Four assertions failed across two distinct checks (the common checks are attached at both collection and request level):

| Check | Expected | Observed |
|---|---:|---:|
| SEC-AZ-N6 malformed UUID | 400 | 500 |
| SEC-AZ-N8 malformed JSON | 400 | 500 |

The collection intentionally retains the expected 400 status so both defects remain visible. No external GitHub issues have been filed.

The lockout threshold also differs from the wording in the supplied checklist: with `lockAfterAttempts = 2`, the second incorrect login returns 423, while the checklist describes the third request as the first 423.

## Additional infrastructure verification (2026-10-27)

- Redis answered PING. After setting the lock threshold to 2 for a disposable learner, two wrong-password attempts returned 401 then 423; `TTL login:fail:<user>` was 60 seconds. The test learner was deleted and original settings were restored.
- The admin gamification API returned 85 points; Redis `ZSCORE leaderboard:points <adminId>` also returned 85. The points sorted set currently contains 53 members.
- MongoDB responded to ping and `gamification_db.processed_events` contains 1,485 current documents. After enabling Spring Data index creation and rebuilding `gamification-service`, `processed_events` has the expected `processedAt` TTL index of 604,800 seconds (7 days). Mongo's TTL monitor removed expired records after the index appeared.
- Grafana health is OK, Loki is ready, Prometheus has 6/6 targets up, and Kafka UI reports its one-broker cluster online. Zipkin includes all six application services. A recent gateway-to-course trace was visible in both Zipkin and Loki; 57 `Unit … completed` course log lines were found in the last 24 hours. A single shared trace spanning user-service and course-service has not been confirmed.
- Kafka consumer recovery was exercised by stopping `gamification-service`, completing the enrolled learner's only course unit, and starting the service again. The matching learner profile then showed the `Unit completed` (+15), `Course completed` (+100), and `Certificate` (+50) awards; total points were 175 including the prior 10 login points. This confirms recovery for the one-unit course used in this run.
- The analytics timeline returned `UNIT_COMPLETED`, `COURSE_COMPLETED`, and `CERTIFICATE_ISSUED` for this course. All three event IDs matched documents in `gamification_db.processed_events` (3/3).
- The course used for this manual recovery run contained only one lesson, so this run does not exercise E2E5's question and TIME lessons. The earlier three-iteration Newman E2E run remains evidence for the broader E2E5 flow; separate progress checkpoint assertions remain an open checklist item.

## Still requires manual or broader validation

- The 123 Swagger-derived service-operation requests are present, but they have not each received the required endpoint-specific positive and three-negative checks. The mutating service folders were not run wholesale.
- Full Grafana user-service/course-service trace correlation, endpoint-specific checks for all 123 operations, a clean `docker compose down -v` rebuild, and GitHub issue filing remain open. Security spot checks now confirm the representative role matrix, Basic/lowercase/expired-token rejection, and gateway rate limiting (details below); these do not amount to exhaustive role coverage for every operation.
- Docker CLI access to the local Docker API named pipe was denied in this environment, so I could not stop/restart the gamification container or remove Docker volumes.

The HTML summary is `Newman-acceptance-report.html`. It distinguishes current passing runs from the earlier N6/N8 defect observation and lists remaining unverified scope.

## Follow-up source changes (2026-10-27)

The course-service global exception handler now maps malformed request parameter types (including invalid UUID path parameters) and unreadable JSON bodies to HTTP 400 Problem Details. Regression cases were added to `CourseControllerTest`. Main and test sources compile successfully. The focused Gradle test task did not complete in this environment because the Java test worker could not communicate with the injected `javatool` named pipe; the live API and Newman Security folder provide runtime verification instead.

## Live verification after rebuild (2026-10-27)

- Rebuilt the `course-service` JAR and image, then directly confirmed both malformed-input endpoints return HTTP 400 with `application/problem+json` and matching Problem Details `status`.
- Newman setup + Security (N1–N8, direct access to all five services, and spoofed-header checks) + teardown passed: 60 requests, 354 assertions, zero failures.
- The first cold run had two duplicate latency assertion failures for the initial unit creation request (3.1 seconds). The immediate warm rerun passed all assertions (maximum response time 149 ms). Fixtures created by both runs were removed by teardown.
- The earlier expanded E2E + security report remains historical evidence; its N6/N8 failures were resolved in the source and verified above. Other coverage and manual infrastructure items listed above remain open.




## Additional security spot checks (2026-10-28)

- Gateway role matrix: 11 representative reads matched expected access for learner, instructor, and admin (33/33 role outcomes). Cases covered users, settings, branches, courses, deleted courses, course questions, notifications, analytics timeline, gamification settings/profile, and certificate templates.
- Token parsing: Basic authentication, lowercase `bearer`, and a correctly signed but expired JWT each returned 401.
- Gateway rate limiter: 60 concurrent authenticated `GET /api/courses` requests produced 59 HTTP 200 and 1 HTTP 429, confirming throttling is active under a burst.
- All five direct service ports returned HTTP 200 for `/actuator/health` and `/swagger-ui/index.html`.
- The temporary learner created for this check was deleted (204). An earlier invalid attempt used a harness missing the `Bearer ` prefix; its results were discarded and were not used to judge the API.
- Security remains PARTIAL: this was representative endpoint coverage, not the full §6 role matrix or per-operation negative coverage.

## Checklist completion run (2026-10-28)

Generated check folders (see `README.md`) now cover every endpoint family of the five services with explicit positive and negative requests. Combined acceptance run: Setup, Security (N1–N8 + full matrix), E2E-1…7 with the 3b–7b gap scenarios, the three `08 Checks` folders and Teardown. Exact counts are in `Newman-acceptance-report.html`.

### Defects (reproduce with folder `09 Known defects · Aziret`)

| ID | Spec expects | Observed | Source cause |
|---|---|---|---|
| DEF-GW-02a/b/c | `GET/PUT/DELETE /api/questions/{id}` work through the gateway | 404 (the same calls work on port 8082) | `api-gateway/application.yml`: the course-service route has no `/api/questions/**`. The frontend's question edit page calls this path. |
| DEF-CRS-03b / 04b | Course bin (restore, permanent delete) is admin-only | Any TRAINER can restore and permanently delete | `JwtAuthFilter.authorized`: the rule "write on `/api/courses` → STAFF" returns before the bin rule. |
| DEF-ENR-02 | A learner cannot change progress of another learner's enrollment | 200, progress changed | Gateway exempts `/progress` from the staff rule and `EnrollmentController.progress` has no ownership check. |
| DEF-ENR-01 | Learner cannot list a course's enrollments | 200 with names and emails | Gateway only guards `/report/` and `/files` for learners. |
| DEF-CRS-01 / 02 | A TRAINER who is not on the course gets 403 on edit and clone | 200 / 201 | `CourseService.update` and `clone` check no ownership (delete does). |
| DEF-GW-01 | 401 carries `WWW-Authenticate: Bearer` | header missing | `JwtAuthFilter.reject` sets status only. |
| DEF-GW-03 | Unknown path without a token → 401 | 404 | No route, so the JWT filter never runs. |
| DEF-USR-02…07 | Malformed UUID, malformed JSON, `text/plain` body → 400 | 500 | user-service `GlobalExceptionHandler` lacks the mappings added to course-service on 2026-10-27. |
| DEF-USR-08 | Unknown `userType` → 400 | 500 | same |
| DEF-USR-09 / 10 | Import without a file → 400; non-CSV file → 400 | 500; 200 with every line skipped | missing multipart handling; no content check |
| DEF-ANL-01 / 02 / 03 | `type=XXX` → 400, `page=-1` → 400, `period=year` → 400 | 500; 200; 200 | no input validation |
| DEF-NTF-01 | Unknown `eventType` → 400 | 500 | enum deserialisation not mapped |

### Behaviour recorded as-is ("зафиксировать")

- Login with a blank password → 400 (validation), not 401. A wrong-password 401 says only "Invalid username or password"; it does not report remaining attempts.
- Lockout threshold N locks on the Nth wrong attempt (threshold 2 → second attempt is 423); a locked account stays locked for the correct password. The lock expires after `lockMinutes` (E2E-3b).
- Branch names must be lowercase letters, digits and dashes. Duplicate group/branch name → 409.
- `GET /api/groups|branches/{id}/users` on a missing id → 404; `GET /api/users/{unknown}/groups` → 200 `[]`.
- Learner reading `/api/users/{id}/groups` for *themself* → 403 (staff only).
- Restore or permanent-delete of a course that is not deleted → 404. Enroll into a hidden or inactive course → 404.
- `GET /api/courses/stats` returns `courseCompletions, trainingSeconds, inProgress, activeCourses, assignedCourses` (checklist says `total, active`). `GET /api/courses/catalog` rows are `{course, enrolled}`.
- A locked lesson can still be read with `GET /api/units/{id}` (answer is hidden).
- Progress PATCH to 100 issues a certificate. `completedAt` is stored with microsecond precision, so values differ in the last digits between responses.
- `DELETE /api/notifications/messages/{unknown}` → 204 (idempotent). Malformed notification id → 404.
- `size=1000` on the timeline is capped to 100; the leaderboard `limit=100` is capped to 50; `by=xxx` ranks by points but echoes `by: "xxx"`.
- `GET /api/analytics/users/{unknown}/activity` → 200 with zero series.
- Gamification history labels are `Sign in`, `Unit completed`, `Course completed`, `Certificate`, `Test passed`.

### Not executed (and why)

- `DELETE /api/notifications/history` and `POST /api/gamification/reset-statistics`: destructive on shared data; only the 403 cases run.
- 300 MB upload (413), `docker compose stop user-service` during `ENR-02`, Redis `KEYS/TTL`, `down -v` rebuild: need Docker CLI access, denied in this environment.
- Shuffle order checks (probabilistic) and the "sequential course with a TEST predecessor" attempt check.
- Grafana UI inspection: Grafana health, Loki log lines and Prometheus targets are asserted through their APIs; a Zipkin trace containing api-gateway, course-service and user-service spans is asserted in E2E-7b.
