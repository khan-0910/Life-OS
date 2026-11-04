import {
  MINUTE_MS,
  addDays,
  dateInTz,
  minutesInTz,
  startOfDayMs,
  toInstant,
  toMs,
  zonedTimeToMs,
  type ISODate,
} from "./time";
import type { TimeBlock } from "./types";

export const SNAP_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 15;

export function snapMinutes(minutes: number, step: number = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export function blockDurationMs(block: Pick<TimeBlock, "start" | "end">): number {
  return toMs(block.end) - toMs(block.start);
}

/** Blocks that overlap the calendar day `date` in `tz`. */
export function blocksOnDate(blocks: TimeBlock[], date: ISODate, tz: string): TimeBlock[] {
  const from = startOfDayMs(date, tz);
  const to = startOfDayMs(addDays(date, 1), tz);
  return blocks
    .filter((b) => toMs(b.start) < to && toMs(b.end) > from)
    .sort((a, b) => toMs(a.start) - toMs(b.start));
}

export interface PlacedBlock {
  block: TimeBlock;
  /** Wall-clock minutes from local midnight, clipped to the day. */
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
}

/** Positions for a day column; overlapping blocks share width side by side. */
export function layoutDay(blocks: TimeBlock[], date: ISODate, tz: string): PlacedBlock[] {
  const placed: PlacedBlock[] = blocksOnDate(blocks, date, tz).map((block) => {
    const startMin = dateInTz(block.start, tz) < date ? 0 : minutesInTz(block.start, tz);
    let endMin = dateInTz(block.end, tz) > date ? 1440 : minutesInTz(block.end, tz);
    if (endMin <= startMin) endMin = Math.min(1440, startMin + MIN_BLOCK_MINUTES);
    return { block, startMin, endMin, column: 0, columns: 1 };
  });

  // Greedy column assignment within clusters of overlapping blocks.
  let cluster: PlacedBlock[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columnEnds: number[] = [];
    for (const p of cluster) {
      let col = columnEnds.findIndex((end) => end <= p.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(p.endMin);
      } else {
        columnEnds[col] = p.endMin;
      }
      p.column = col;
    }
    for (const p of cluster) p.columns = columnEnds.length;
    cluster = [];
  };
  for (const p of placed) {
    if (cluster.length && p.startMin >= clusterEnd) flush();
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  if (cluster.length) flush();
  return placed;
}

/** Move a block to `date` at wall-clock `startMin`, preserving its duration. */
export function moveBlock(
  block: TimeBlock,
  date: ISODate,
  startMin: number,
  tz: string,
): Pick<TimeBlock, "start" | "end"> {
  const duration = blockDurationMs(block);
  const start = zonedTimeToMs(date, startMin, tz);
  return { start: toInstant(start), end: toInstant(start + duration) };
}

/** Set a block's end to wall-clock `endMin` on its start date (minimum length enforced). */
export function resizeBlock(block: TimeBlock, endMin: number, tz: string): Pick<TimeBlock, "start" | "end"> {
  const date = dateInTz(block.start, tz);
  const startMs = toMs(block.start);
  const endMs = Math.max(zonedTimeToMs(date, endMin, tz), startMs + MIN_BLOCK_MINUTES * MINUTE_MS);
  return { start: block.start, end: toInstant(endMs) };
}

/** Build start/end instants from a date and wall-clock minutes in `tz`. */
export function blockTimes(
  date: ISODate,
  startMin: number,
  endMin: number,
  tz: string,
): { start: string; end: string } | null {
  if (endMin - startMin < MIN_BLOCK_MINUTES) return null;
  return {
    start: toInstant(zonedTimeToMs(date, startMin, tz)),
    end: toInstant(zonedTimeToMs(date, endMin, tz)),
  };
}

/** Next scheduled block that has not ended yet. */
export function nextBlock(blocks: TimeBlock[], now: number): TimeBlock | null {
  return (
    blocks
      .filter((b) => toMs(b.end) > now)
      .sort((a, b) => toMs(a.start) - toMs(b.start))[0] ?? null
  );
}
