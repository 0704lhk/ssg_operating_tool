# Repository Guidelines

## Project Structure

This repository contains exercise inputs and an operations dashboard. `A_매출비교/` holds sales workbooks and the data guide; `B_팝업오픈/` holds the event brief and review materials; `C_행사준비/` holds the preparation CSV; `D_화면과연결/` holds the weather sample and screen sketch. `운영대시보드/src/` contains the dashboard HTML, JavaScript, and CSS; `build.mjs` creates `dist/`. `requirements.md` is the product and acceptance specification. Treat the workbooks, CSV, brief, and sample JSON as inputs, not places to write generated results.

## Build and Development

Run dashboard commands from `운영대시보드/`:

- `npm install` installs the pinned dependencies.
- `npm run build` bundles the browser app into `dist/`.

There is currently no test or lint script. Do not add app code as part of requirements or documentation work. For future implementation, keep browser code in `src/` and server-only integrations outside the client bundle.

## Data and Preservation Rules

Preserve every source file and its values, worksheet/column names, and ordering. Save exports and other generated results as new files; never overwrite an input. Keep real API keys and any real operational source data out of Git, builds, static assets, logs, URLs, and reports. Commit only approved synthetic teaching data. Store weather credentials in encrypted server environment variables and call the provider through a server function; never expose secrets in browser code.

For sales, map columns by the aliases in `A_매출비교/06_데이터안내.md`, not by position. Normalize to its 12 standard fields, retain values in 만원, and reject duplicate `record_id` values rather than merging them. Aggregate achievement as total sales divided by total target. When target is zero, show `—` in the UI and leave the exported Excel cell blank. Validate missing columns and channel/file mismatches without discarding previously loaded valid files.

## Domain-Specific Checks

- **Sales:** Confirm the three source workbooks yield 160 rows each (480 total), IDs are globally unique, alias mapping works, units remain 만원, and the report follows the 16-column template order. Load `05_오류_열누락.xlsx` to verify the missing-target error while the valid 480 rows remain.
- **Popup copy (B):** Use `B_팝업오픈/07_팝업브리프.md` as the source of truth for event facts, benefits, tone, and prohibited unsupported claims. Check short notices are at most 50 characters and verify dates, location, and offer against the brief.
- **Preparation (C):** Read `task_id` as the item identity and use each row's `점검기준일` for deadline classification, not the machine date. Verify all 72 rows and six areas; completed/cancelled items take precedence, and test boundary dates around the 기준일.
- **Weather:** Default to `D_화면과연결/11_날씨응답_예제.json`. Display its example status, source, and location note so it cannot be mistaken for live weather. For live mode, verify server-side environment configuration, successful and failure responses, and that no key appears in client assets or network responses.

## Commits and Pull Requests

No repository-level Git history is available to establish a commit convention. Use concise imperative subjects, for example `Document dashboard data rules`. Pull requests should summarize the change, identify affected inputs or workflows, list validation performed, and include screenshots for visible UI changes. Keep source data changes separate and explain why they are needed.
