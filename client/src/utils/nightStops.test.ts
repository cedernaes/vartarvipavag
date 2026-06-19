import { describe, it, expect } from 'vitest';
import { computeNightStopPositionIds } from './nightStops';
import { Position } from '../types';

const TZ = 'Europe/Stockholm'; // UTC+2 in June (CEST)
const HOUR = 2; // night stop target: 02:00 local

// Helper: build a position. `local` is a wall-clock time in CEST (UTC+2),
// converted to the UTC ISO string the API would actually return.
let counter = 0;
const pos = (localIso: string, lat = 50, lon = 10): Position => {
  // localIso is "YYYY-MM-DDTHH:MM" in CEST; subtract 2h to get UTC.
  const utc = new Date(`${localIso}:00+02:00`).toISOString();
  counter += 1;
  return { id: `p${counter}`, timestamp: utc, latitude: lat, longitude: lon };
};

describe('computeNightStopPositionIds', () => {
  it('marks a single night stop when a night spans two days', () => {
    const positions = [
      // Day 1 (June 13) daytime + evening
      pos('2026-06-13T10:00'),
      pos('2026-06-13T18:00'),
      pos('2026-06-13T23:00'),
      // The actual overnight position, closest to 02:00 local
      pos('2026-06-14T02:00'),
      // Day 2 (June 14) morning onwards
      pos('2026-06-14T08:00'),
      pos('2026-06-14T11:00'),
    ];

    const result = computeNightStopPositionIds(positions, TZ, HOUR);

    expect(result.size).toBe(1);
    // The 02:00 position is the one nearest the target hour.
    const nightStopIso = new Date('2026-06-14T02:00:00+02:00').toISOString();
    const expected = positions.find(p => p.timestamp === nightStopIso)!;
    expect(result.has(expected.id)).toBe(true);
  });

  it('does not mark a night stop until there is a morning-after position', () => {
    // Only day 1 so far (the day is still in progress, no reading after 02:00 next day).
    const dayOneOnly = [
      pos('2026-06-13T10:00'),
      pos('2026-06-13T14:00'),
      pos('2026-06-13T18:00'),
    ];
    expect(computeNightStopPositionIds(dayOneOnly, TZ, HOUR).size).toBe(0);

    // Add an overnight position but still no morning-after reading -> still none.
    const withOvernight = [...dayOneOnly, pos('2026-06-14T02:00')];
    const nightStopId = counter;
    expect(computeNightStopPositionIds(withOvernight, TZ, HOUR)).toEqual(new Set([`p${nightStopId}`]));

    // Now add a position the next morning, after 02:00 -> same result.
    const withMorningAfter = [...withOvernight, pos('2026-06-14T08:00')];
    expect(computeNightStopPositionIds(withMorningAfter, TZ, HOUR)).toEqual(new Set([`p${nightStopId}`]));
  });
});
