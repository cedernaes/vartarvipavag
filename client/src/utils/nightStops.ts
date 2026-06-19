import { Position } from '../types';

/**
 * Convert a timestamp to the given timezone and extract date/time components.
 */
const getDateInTimezone = (timestamp: string, timeZone: string): {
  date: Date;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeOfDay: number; // Minutes since midnight
} => {
  const date = new Date(timestamp);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  const timeOfDay = hour * 60 + minute + second / 60;

  return { date, year, month, day, hour, minute, timeOfDay };
};

/**
 * Compute the set of position ids that represent overnight stops.
 *
 * Positions are grouped by "night" in the home timezone (a night spans from the
 * evening of day N to the morning of day N+1). For each night, the position
 * closest to the configured night stop hour is chosen. A night only produces a
 * marker if it actually ended -- i.e. there is a later position recorded the
 * following morning (between the night stop hour and noon, local time). This
 * prevents an in-progress day from being marked as an overnight stop.
 *
 * @returns a Set of `position.id` values that are overnight stops (one per night)
 */
export function computeNightStopPositionIds(
  positions: Position[],
  timeZone: string,
  nightStopHour: number
): Set<string> {
  const nightStops = new Set<string>();

  if (positions.length === 0) {
    return nightStops;
  }

  // Group positions by "night".
  const positionsByNight = new Map<string, Array<{ position: Position; timeOfDay: number }>>();

  positions.forEach(position => {
    const dateInfo = getDateInTimezone(position.timestamp, timeZone);
    const dayKey = `${dateInfo.year}-${dateInfo.month}-${dateInfo.day}`;

    // Early morning (before noon) belongs to the previous day's night;
    // afternoon/evening belongs to the current day's night.
    let nightKey: string;
    if (dateInfo.hour < 12) {
      const date = new Date(dateInfo.date);
      date.setTime(date.getTime() - 24 * 60 * 60 * 1000);
      const prevDateInfo = getDateInTimezone(date.toISOString(), timeZone);
      nightKey = `${prevDateInfo.year}-${prevDateInfo.month}-${prevDateInfo.day}`;
    } else {
      nightKey = dayKey;
    }

    if (!positionsByNight.has(nightKey)) {
      positionsByNight.set(nightKey, []);
    }
    positionsByNight.get(nightKey)!.push({ position, timeOfDay: dateInfo.timeOfDay });
  });

  const targetMinutes = nightStopHour * 60;

  positionsByNight.forEach((nightPositions) => {
    if (nightPositions.length === 0) return;

    // Find the position closest to the target hour (with midnight wrap-around).
    let closestPosition = nightPositions[0];
    let minDifference = Infinity;

    nightPositions.forEach(({ position, timeOfDay }) => {
      const diffForward = Math.abs(timeOfDay - targetMinutes);
      const diffWrapNext = Math.abs((timeOfDay + 24 * 60) - targetMinutes);
      const diffWrapPrev = timeOfDay > targetMinutes
        ? Math.abs(timeOfDay - (targetMinutes + 24 * 60))
        : Infinity;

      const minDiff = Math.min(diffForward, diffWrapNext, diffWrapPrev);

      if (minDiff < minDifference) {
        minDifference = minDiff;
        closestPosition = { position, timeOfDay };
      }
    });

    // Only count it if the night is complete: the group must contain both
    // evening positions (hour >= 12, the day's end) and early-morning positions
    // (hour < 12, the next day). A group with only daytime readings means the
    // day is still in progress.
    const hasEvening = nightPositions.some(({ timeOfDay }) => Math.floor(timeOfDay / 60) >= 12);
    const hasMorning = nightPositions.some(({ timeOfDay }) => Math.floor(timeOfDay / 60) < 12);
    if (!hasEvening || !hasMorning) return;

    // One night stop per night.
    nightStops.add(closestPosition.position.id);
  });

  return nightStops;
}
