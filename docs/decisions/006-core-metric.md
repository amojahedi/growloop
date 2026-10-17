# 006 — Task count is the core metric; hours are optional

**Status:** Accepted · 2026-10-17

## Context
Time logging is high-friction and many people won't do it consistently. A dashboard built on hours would look empty or misleading for those users.

## Decision
**Items completed** is the primary dashboard metric and always shown. **Hours learned** is optional: estimates and time logs can be entered per item, but there is no hours widget, not even an optional one.

Hours never appear on the dashboard; they remain optional on cards.

## Consequences
- The dashboard is meaningful from day one with zero extra input.
- Users who like time tracking still get it.
