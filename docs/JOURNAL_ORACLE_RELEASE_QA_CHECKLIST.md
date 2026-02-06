# Journal + Oracle Release QA Checklist

| Property | Value |
|---|---|
| Owner | Product + QA |
| Last Updated | February 5, 2026 |
| Scope | Journal + Oracle unified guided reflection flow (JOM-301) |

## Preflight (required)
- [ ] `npx tsc --noEmit` passes.
- [ ] `docs/ORACLE_MEMORY_QA_CHECKLIST.md` executed (if memory flows are touched).

## JOM-301: Unified Guided Reflection (Targeted)

### Journal Home
- [ ] Journal Home → “New entry” → **Prompted reflection** selected.
  - [ ] Context → Prompt → Write flow works end-to-end.
  - [ ] Prompt selection + “Need inspiration?” chips render.
  - [ ] Friend tags selectable; friend picker works.
  - [ ] Friend context panel appears for friend context (recent weaves, previous entries, themes).
  - [ ] Save creates a journal entry and returns to journal.
- [ ] Journal Home → “New entry” → **Oracle coach** selected.
  - [ ] Topic selection appears; questions flow; draft review works.
  - [ ] “Go Deeper” works (only once).
  - [ ] Save creates a journal entry and returns to journal.

### Quick Capture
- [ ] QuickCapture → “Help me write more” opens **Oracle coach** (no mode selector).
  - [ ] Quick capture text is used as the initial seed.
  - [ ] Saving returns with notes saved appropriately.
- [ ] QuickCapture → “Open in full editor” opens **Prompted reflection** (no mode selector).
  - [ ] Prefilled text appears in the write step.

### Post-Weave & Oracle
- [ ] WeaveReflectPrompt → “Help me write” opens **Oracle coach**.
  - [ ] Reflection saves with linked weave metadata.
- [ ] Oracle Chat → “Go deeper” opens **Oracle coach** directly (no mode selector).
  - [ ] Starts questions immediately (no topic selection) and seeds from latest user message when available.

### Reflection Surfaces
- [ ] MicroReflection → “Help me write” opens **Oracle coach**.
- [ ] EditReflection → “Guided Chat” opens **Oracle coach**.

### Guardrails
- [ ] Discard confirmation appears when closing with unsaved changes (both modes).
- [ ] No references to `GuidedReflectionModal` remain in code or UI.

## Regression Sweep (Optional)
- [ ] Journal entry detail → Reflect action still opens Oracle with context.
- [ ] Memory Moment → “Write now” opens guided flow with prefill.
- [ ] Journal feed still loads pagination correctly.
