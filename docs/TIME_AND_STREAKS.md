# Time, days and streaks

All rules live in `packages/domain` and are unit tested (`time.test.ts`, `habits.test.ts`, `focus.test.ts`).

## Two kinds of time

| Kind | Format | Used for |
| --- | --- | --- |
| Calendar date | `YYYY-MM-DD` in the user's configured time zone | Due dates, planned dates, habit days, reviews |
| Instant | UTC timestamp (ISO-8601 `Z` or epoch ms) | Time blocks, completion times, focus sessions |

Calendar dates are never converted through a timestamp, so they cannot shift by a day. Converting between the two always uses the time zone from Settings (default: the device's zone).

- **"Today"** is the calendar date of *now* in the configured zone. It rolls over at local midnight.
- **Wall-clock to instant** (e.g. a block at 09:00 on 2026-11-02): times that don't exist (spring-forward gap) move forward by the gap; ambiguous times (fall-back) use the earlier instant. This matches Temporal's `compatible` behavior.
- DST days are 23 or 25 hours long; the planner grid shows wall-clock hours.
- Changing the time zone keeps timed blocks at the same instant and all-day dates on the same calendar date.

## Habits

- A habit is **due** on a date when the date is on or after its start date, is a scheduled weekday (or the habit is daily), and is not inside a pause. A pause covers `[start, end)`; resuming on a date makes that date due again.
- **Current streak** = consecutive due days completed, counting back from today. Unscheduled and paused days are skipped — they never add to or break a streak. Today, if due but not done yet, doesn't break the streak until the day ends.
- Completions recorded on days that were not due are kept and shown as "extra" in history, but don't count toward streaks or rates.
- **Completion rate** = completed due days ÷ due days in the window. Today counts only once completed. With no due days the rate is shown as "—", not 0%.
- Past days can be backfilled from the history calendar; future days can't be logged.

## Focus timer

- The run stores timestamps (`phaseStartedAt`, `runningSince`, `accruedMs`, `pausedAt`, `pausedMs`). Remaining time is always computed from them, never counted by an interval, so reloads, sleeping tabs and restarts recover exactly.
- Paused time is tracked separately and never counted as focus.
- When a focus phase reaches its length, it is saved as **completed** with the exact instant it finished, even if the app was closed then. The break starts at that instant (or waits, if auto-start is off). A finished break moves to **Ready**; the next focus always needs a click.
- **Ended early**: the user ended or skipped focus. **Interrupted**: emergency stop, or a run left paused for more than 12 hours (closed at the moment it was paused).
- Focus shorter than one minute is not saved. Breaks are never saved as focus.

## Insights

- Tasks completed per day: tasks whose completion time falls on that date. Reopened tasks no longer count.
- Focus minutes per day: active minutes of saved sessions, attributed to the day the session started.
- Planned → done: tasks planned for a date in the window, and how many of them are done.
- Every chart states its window (last 7 or 30 days, ending today).
