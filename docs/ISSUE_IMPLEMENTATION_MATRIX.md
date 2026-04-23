# Issue Implementation Matrix

Last reviewed: 2026-04-20

Status legend:

- `C` = `cumplido`
- `P` = `parcial`
- `N` = `cerrado pero no demostrado / no implementado`

Priority legend:

- `P0` = start here
- `P1` = next wave
- `P2` = useful but not blocking

## Matrix

| Area                                      | Issues / US                               | Status | Priority | Basis                                                                                                                                                                                                     |
| ----------------------------------------- | ----------------------------------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional utilities                      | US-001, US-011                            | C      | P2       | Utility modules and tests look real; no obvious placeholder pattern found in sampled coverage.                                                                                                            |
| Graph / dependency core                   | US-002, US-028 to US-037                  | C      | P2       | Real implementations and non-trivial tests, e.g. `src/dependencies/dependency-graph-builder.ts`, `test/unit/dependencies/dependency-graph-builder.test.ts`.                                               |
| Filesystem / constants / types            | US-003 to US-006                          | C      | P2       | Stable foundational pieces with direct tests and lower behavioral risk.                                                                                                                                   |
| Logger / cache / XML utils / error types  | US-007 to US-010                          | P      | P1       | Present, but acceptance criteria in GitHub are broader than what is clearly demonstrated.                                                                                                                 |
| Parsers                                   | US-013 to US-027                          | P      | P1       | Many parser modules are implemented, but I have not yet verified every closed AC end-to-end; likely mixed C/P.                                                                                            |
| Custom Object parser                      | US-018                                    | P      | P1       | GitHub issue itself leaves one AC unchecked (`compound objects`); should not be treated as fully done.                                                                                                    |
| Wave generation core                      | US-038 to US-045                          | P      | P1       | Core wave logic exists, including cycle detection and final-wave marking for unresolved cycles, but top-level command orchestration and reporting around it are not fully real.                           |
| Circular dependency remediation           | Cross-cutting gap (no explicit issue yet) | N      | P0       | The project detects cycles and surfaces them for manual handling, but does not implement automatic remediation such as temporary source rewriting, staged deploy/redeploy, or restore/rollback flows.     |
| `start` command                           | US-046                                    | P      | P0       | The working tree now generates manifests, uses `SfCliIntegration`, supports conservative cycle remediation, and has NUT coverage, but still needs broader real-world deployment validation.               |
| `analyze` command                         | US-047                                    | P      | P1       | Scanning, wave generation, plan output, and JSON/HTML report writing are now real and covered by NUTs; remaining risk is breadth and polish, not a missing core feature.                                  |
| `validate` command                        | US-048                                    | P      | P0       | Now has real validation flow, `--source-path`, and NUT coverage, but still stops short of a full deploy-validation lifecycle.                                                                             |
| `resume` command                          | US-049                                    | P      | P0       | Now resumes persisted failed state with retry metadata and NUT coverage, but still orchestrates local state rather than a fully proven live resume loop.                                                  |
| `status` command                          | US-050                                    | P      | P0       | Now reports persisted deployment status with real command-level coverage, but is still state-driven rather than polling a live deployment backend.                                                        |
| `config` command                          | US-051                                    | P      | P1       | Now has real command/NUT coverage and `--source-path`, but acceptance is still broader than what has been proven.                                                                                         |
| Help / command docs                       | US-052                                    | P      | P1       | Real `--help` coverage now exists for key commands, but broader documentation quality is still only partially verified.                                                                                   |
| Progress reporting                        | US-053                                    | P      | P1       | Some observable progress/reporting is now covered through command output, but this still needs stronger proof for richer UX expectations.                                                                 |
| Agentforce service / AI stack             | US-054 to US-060, US-073                  | P      | P1       | Base AI transport is now real in `AgentforceService` and shared command coverage is stronger, but priority/validation/inference layers still need broader end-to-end proof and provider abstraction work. |
| Test framework scaffolding                | US-061, US-066, US-068                    | C      | P2       | Test infra/helpers/fixtures are present and actually used by the suite.                                                                                                                                   |
| Utils/service/parser unit test stories    | US-062 to US-064                          | P      | P1       | Test volume exists, but story closure overstates confidence because many higher-level tests are weak.                                                                                                     |
| Integration / BDD / E2E / CI test stories | US-065, US-067, US-069, US-070, US-077    | P      | P1       | Some integration/perf tests are real, but many command/deployment scenarios are not asserting real behavior.                                                                                              |
| Parse/network/validation errors           | US-071, US-072, US-075, US-076, US-078    | P      | P1       | Error modules exist; several look credible, but need stricter verification on output and recovery semantics.                                                                                              |
| Project / scanner support                 | US-079 to US-084                          | C      | P2       | Stronger area: real implementations and tests, e.g. `sfdx-project-detector`, `.forceignore`, structure validators.                                                                                        |
| SF CLI integration                        | US-085                                    | P      | P0       | `start` now uses `SfCliIntegration` and manifest generation, but broader real deploy coverage is still limited.                                                                                           |
| Deployment tracking                       | US-086                                    | P      | P0       | Tracker and summaries are real and tested, but not yet proven against live polling/report semantics.                                                                                                      |
| Test execution management                 | US-087                                    | P      | P0       | `src/deployment/test-executor.ts` contains placeholder logic for related tests and empty failed test reporting.                                                                                           |
| Retry logic                               | US-088                                    | P      | P1       | Core retry utility exists and looks usable, but not proven in full deployment flow.                                                                                                                       |
| State persistence                         | US-089                                    | P      | P0       | `StateManager` exists and works locally, but resume/status flow above it is still stubbed.                                                                                                                |
| Deployment reporting                      | US-090                                    | P      | P1       | Reporter exists and is covered; `analyze` now writes real reports, but end-to-end deployment reporting still needs wider adoption in command flow.                                                        |
| XML metadata validator                    | US-091 / issue #99                        | P      | P0       | Validator exists, but does not satisfy the full story (`--fix`, namespace/xsi/type checks, exit codes, validate command integration).                                                                     |
| Data provisioning between waves           | Issue #107                                | P      | P1       | `DataProvisioner` exists, but implementation is simplified and not yet convincing for production-grade provisioning logic.                                                                                |
| i18n                                      | Issue #108                                | N/A    | P2       | Open issue, not expected to be complete.                                                                                                                                                                  |

## Hard evidence behind the top priority items

- `US-046`: `src/commands/start.ts` now generates manifests, uses `SfCliIntegration`, and has NUT coverage, but still needs broader production-style validation.
- `US-047`: `src/commands/analyze.ts` now writes JSON/HTML reports and has NUT coverage.
- `US-048` to `US-050`: the current working tree now has real command behavior with command-level tests, but still needs wider production validation.
- `US-085` to `US-090`: placeholder-only coverage has been replaced with real tests for SF CLI parsing, tracking, retry, and reporting, but not all live integration semantics are proven.
- `US-091`: code points to `@issue #91`, but the actual XML validator story is GitHub issue `#99`; the implementation does not yet match that issue's acceptance criteria.
- Circular dependency handling is detection-only today: unresolved cyclic nodes are pushed into a final wave for manual resolution; there is no automated comment/deploy/restore workflow.

## Notes

- The repository currently passes `yarn test`, but that is not sufficient evidence that all closed GitHub stories are correctly implemented.
- The placeholder `expect(true).to.be.true` tests that previously inflated confidence have been removed from `test/`.
- The scanner and dependency-analysis layers look materially more trustworthy than the top-level CLI orchestration layer.

## Multi-LLM Backlog

These are design/implementation items to discuss later, not committed scope yet:

1. `LLM provider abstraction`
   Create a provider-neutral interface above `AgentforceService` so AI consumers can target `Salesforce AI`, `OpenAI`, `Anthropic`, or local models without duplicating orchestration logic.

2. `Provider-specific auth/config`
   Support separate config keys for provider selection, endpoint/base URL, API keys, model names, timeouts, and rate limits.

3. `Prompt/response normalization`
   Normalize request/response payloads so services like dependency inference, wave validation, and priority analysis consume one stable internal shape regardless of provider.

4. `Capability matrix`
   Add a provider capability registry for JSON mode, tool calling, context limits, retries, cost tracking, and streaming support.

5. `Fallback routing`
   Allow ordered fallback chains, e.g. `agentforce -> openai -> anthropic`, with explicit reasons recorded in logs/reporting.

6. `Provider-aware tests`
   Add contract tests that any provider adapter must pass, plus fake transports for offline CI.

7. `Provider selection in CLI/config`
   Extend `config` and AI-related commands to choose provider/model explicitly per run or per repo.

8. `Usage and cost reporting`
   Track tokens, latency, provider, model, and estimated spend at a common abstraction layer.

## Recommended order of work

1. `US-046`, `US-048`, `US-049`, `US-050`
2. `US-085`, `US-086`, `US-089`, `US-090`
3. `US-047`, `US-087`, `US-091`
4. `US-051` to `US-053`, then AI/error stories still marked `P`
