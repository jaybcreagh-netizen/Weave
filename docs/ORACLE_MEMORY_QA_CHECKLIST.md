# Oracle Memory QA Checklist

Use this checklist before promoting builds that include the Oracle Memory redesign.

## 1) Automated Verification (Completed)

Run and confirm all pass:

- `npx tsc --noEmit`
- `npx jest src/modules/relationships/services/__tests__/memory-candidate.service.test.ts src/modules/relationships/services/__tests__/memory-life-event.service.test.ts src/modules/relationships/services/__tests__/memory-roadmap.integration.test.ts --runInBand`

Expected:
- Typecheck passes with no TS errors.
- Memory lifecycle tests pass (candidate creation/review, temporal metadata, cleanup).

## 2) Friend Profile / Detail Sheet

- Open friend profile -> open details sheet.
- Confirm **Memory / Relationship Notes** section renders.
- Confirm pending badge appears when journal candidates exist.
- Tap **Review** -> opens memory editor with first pending candidate.
- Tap **Dismiss all** -> confirmation -> pending suggestions clear.
- Confirm top cards and spacing remain stable (no layout regressions).

## 3) Memory Editor

- **Add** memory (manual source) with type/title/content/tags.
- **Edit** existing memory and verify updated timestamp/source display behavior.
- **Archive** memory and confirm it no longer appears in active memory lists.
- Review a candidate and **Approve**; verify:
  - Candidate leaves pending queue.
  - Memory record appears in profile/journal memory surfaces.
- Review a candidate and **Dismiss**; verify candidate leaves pending queue.
- While reviewing multiple candidates, verify auto-advance to next candidate.

## 4) Journal Arc Surface

- Open Journal -> Friend Arc for same friend.
- Confirm "Relationship notes" reflects saved memories.
- Confirm pending suggestion count reflects pending candidates.
- Confirm empty state copy when no memories exist.

## 5) Oracle Memory Flow

- In friend Oracle context, trigger/save a note action.
- Confirm app routes to friend profile with memory prefill.
- Save memory and verify source stored as Oracle action.
- Ask Oracle follow-up in same friend context; verify memory-aware grounding appears.

## 6) Suggestion Integration

- Confirm at least one suggestion path reflects memory-aware influence:
  - Upcoming/milestone memory can elevate urgency or life-event framing.
  - Avoid/preference memory can alter category/urgency text appropriately.
- Confirm no crash/empty state regressions in suggestion feed.

## 7) Lifecycle Maintenance

- Launch app and foreground app after backgrounding.
- Confirm no errors while running maintenance:
  - expired memory archival
  - reviewed-candidate cleanup
- Open friend profile and confirm stale reviewed candidates do not reappear.

## 8) Data Portability

- Export backup and verify `friendMemories` and `friendMemoryCandidates` are present.
- Import backup to clean profile and verify records restore correctly.
- Confirm legacy `friend.notes` backfill still preserves existing notes data.

## 9) Ship Gate

Ship only if all are true:
- No regressions in friend profile, friend detail sheet, or journal arc.
- Oracle `add_memory` flow works end-to-end.
- Candidate review flow supports approve, dismiss, and dismiss-all reliably.
- Suggestion feed reflects memory-aware behavior without instability.
- Cleanup/expiration maintenance runs without user-visible errors.
