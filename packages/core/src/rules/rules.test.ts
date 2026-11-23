import { describe, expect, it } from 'vitest';
import { DOCTORS, DEMO_TODAY, QUEUES, ROOMS, ADMINS } from '../data';
import { maskMobile } from '../format';
import {
  availableDates, canAccess, canDo, canSeePatientMasterList, dayAvailability, displayName, insertIntoQueue,
  isTooEarlyToScan, makeBookingId, nextClinicDayAfter, nextQueueNumber, roomStatus, scanOpensAtLabel, splitName, weekFromDoctor,
} from '.';

const d1 = DOCTORS.find((d) => d.id === 'd1')!;
const ctx = { today: DEMO_TODAY, hour: 10.5, capacity: 30, blocked: [], noShowRestricted: false };

describe('booking availability', () => {
  it('hides no-clinic and full days', () => {
    const dates = availableDates(d1, ctx).map((d) => d.date);
    expect(dates).not.toContain('2026-10-31'); // Saturday, no clinic for d1
    expect(dates).not.toContain('2026-11-02'); // index 3 is full in the sample
    expect(dates[0]).toBe('2026-10-30');
  });
  it('restricts to same-day walk-in after a no-show', () => {
    const dates = availableDates(d1, { ...ctx, noShowRestricted: true }).map((d) => d.date);
    expect(dates).toEqual(['2026-10-30']);
  });
  it('treats blocked dates as unavailable', () => {
    const a = dayAvailability(d1, '2026-11-04', { ...ctx, blocked: [{ doctorId: 'd1', date: '2026-11-04', reason: 'x', affected: 0, status: 'none' }] });
    expect(a).toMatchObject({ available: false, reason: 'blocked' });
  });
});

describe('queue', () => {
  it('puts Senior/PWD ahead of regular patients but behind other priority patients', () => {
    const w = insertIntoQueue(QUEUES.d1.waiting, { number: 'IM-021', patientId: 'x', patientName: 'X', type: 'online', priority: 'senior' });
    expect(w.map((p) => p.number).slice(0, 3)).toEqual(['IM-016', 'IM-021', 'IM-017']);
  });
  it('appends regular patients by scan time', () => {
    const w = insertIntoQueue(QUEUES.d1.waiting, { number: 'IM-021', patientId: 'x', patientName: 'X', type: 'walkin', priority: null });
    expect(w[w.length - 1].number).toBe('IM-021');
  });
  it('issues the next number', () => expect(nextQueueNumber(d1, QUEUES.d1)).toBe('IM-021'));
  it('formats booking ids', () => expect(makeBookingId('2026-11-12', 4)).toBe('BK-261112-004'));
});

describe('scan window', () => {
  it('opens 60 minutes before clinic hours', () => {
    expect(scanOpensAtLabel(d1, 60)).toBe('7:00 AM');
    expect(isTooEarlyToScan(d1, 6.5, 60)).toBe(true);
    expect(isTooEarlyToScan(d1, 7.25, 60)).toBe(false);
  });
});

describe('follow-up quick picks', () => {
  it('lands on the next clinic day', () => {
    expect(nextClinicDayAfter(DEMO_TODAY, 7, weekFromDoctor(d1), [])).toBe('2026-11-06');
  });
});

describe('rooms and RBAC', () => {
  it('flags over-capacity rooms', () => {
    expect(roomStatus(ROOMS.find((r) => r.number === '119')!)).toBe('in_use');
  });
  it('limits admins to granted modules', () => {
    const kevin = ADMINS.find((a) => a.id === 'a3')!;
    expect(canAccess(kevin, 'announce')).toBe(true);
    expect(canAccess(kevin, 'accounts')).toBe(false);
    expect(canDo(kevin, 'announce', 'd')).toBe(false);
    expect(canSeePatientMasterList(kevin)).toBe(false);
  });
});

describe('names and masking', () => {
  it('splits Filipino surnames with particles', () => expect(splitName('Dr. Ramon Dela Paz')).toMatchObject({ first: 'Ramon', last: 'Dela Paz' }));
  it('builds display names with credentials', () => expect(displayName({ first: 'Juan', middle: 'Perez', last: 'Dela Cruz' }, ['MD'], true)).toBe('Dr. Juan P. Dela Cruz, MD'));
  it('masks the registered mobile', () => expect(maskMobile('0917 555 0142')).toBe('0917 ••• 0142'));
});
