import { endOfDay, startOfDay } from 'date-fns';
import {
    formatInTimeZone as formatInZone,
    fromZonedTime,
    toZonedTime as toZonedTimeFn,
} from 'date-fns-tz';

const DEFAULT_TIME_ZONE = 'UTC';

type DateLike = string | number | Date;

const ensureDate = (value: DateLike): Date => {
    if (value instanceof Date) {
        return value;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date value provided: ${value}`);
    }

    return date;
};

const resolveZone = (zone?: string) => zone?.trim() || DEFAULT_TIME_ZONE;

export const normalizeToUtc = (value: DateLike, zone?: string): Date => {
    const date = ensureDate(value);
    const timeZone = resolveZone(zone);

    if (!zone) {
        return new Date(date.toISOString());
    }

    return fromZonedTime(date, timeZone);
};

export const toZonedDate = (value: DateLike, zone?: string): Date => {
    const date = ensureDate(value);
    const timeZone = resolveZone(zone);
    return toZonedTimeFn(date, timeZone);
};

export interface DayRangeUtc {
    startUtc: Date;
    endUtc: Date;
}

export const getUtcDayRange = (value: DateLike, zone?: string): DayRangeUtc => {
    const timeZone = resolveZone(zone);
    const zonedDate = toZonedTimeFn(ensureDate(value), timeZone);
    const zonedStart = startOfDay(zonedDate);
    const zonedEnd = endOfDay(zonedDate);

    return {
        startUtc: fromZonedTime(zonedStart, timeZone),
        endUtc: fromZonedTime(zonedEnd, timeZone),
    };
};

export const formatInTimeZone = (
    value: DateLike,
    zone?: string,
    pattern = "yyyy-MM-dd'T'HH:mm:ssXXX"
): string => {
    const timeZone = resolveZone(zone);
    return formatInZone(ensureDate(value), timeZone, pattern);
};

export const TimezoneUtil = {
    DEFAULT_TIME_ZONE,
    normalizeToUtc,
    toZonedDate,
    getUtcDayRange,
    formatInTimeZone,
};

export type { DateLike };
