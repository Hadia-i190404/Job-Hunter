import { describe, expect, it } from 'vitest';
import { matchPlace } from '../../plugin/src/pipeline/location.ts';
import { detectWorkMode } from '../../plugin/src/pipeline/work-mode.ts';

describe('matchPlace', () => {
  it.each([
    ['Lahore (Hybrid)', ['lahore']],
    ['Karachi, Sindh, Pakistan', ['karachi']],
    ['Isb/Rwp', ['islamabad', 'rawalpindi']],
    ['Islamabad Capital Territory, Pakistan', ['islamabad']],
    ['Twin Cities, Pakistan', ['islamabad', 'rawalpindi']],
    ['Faisalabad / Lyallpur', ['faisalabad']],
    ['Hyderabad, Sindh', ['hyderabad']],
    ['Wah Cantt, Pakistan', ['wah']],
    ['D.G. Khan', ['dera-ghazi-khan']],
    ['Lahore, Karachi or Islamabad', ['karachi', 'lahore', 'islamabad']],
  ])('%s → %j', (text, cities) => {
    expect(matchPlace(text)).toEqual({ cities, inPakistan: true });
  });

  it.each([
    ['Hyderabad, Telangana, India'],
    ['Hyderabad'],
    ['Remote, Worldwide'],
    ['Twin Cities, Minnesota'],
    ['Wah Street, London'],
    ['Lahorez'],
  ])('%s → no Pakistani city', (text) => {
    expect(matchPlace(text).cities).toEqual([]);
  });

  it('knows Pakistan without a city', () => {
    expect(matchPlace('Remote - Pakistan')).toEqual({ cities: [], inPakistan: true });
    expect(matchPlace('Anywhere in PK')).toEqual({ cities: [], inPakistan: true });
  });
});

describe('detectWorkMode', () => {
  it.each([
    [{ location: 'Lahore (Hybrid)' }, 'hybrid'],
    [{ location: 'Remote - Worldwide' }, 'remote'],
    [{ location: 'Karachi', title: 'Accountant (On-site)' }, 'onsite'],
    [{ location: 'Islamabad', description: '3 days a week in office, 2 from home.' }, 'hybrid'],
    [{ location: 'Remote (hybrid optional)' }, 'hybrid'],
    [{ location: 'Lahore', description: 'This is not a remote role.' }, 'onsite'],
    [{ location: 'Anywhere' }, 'remote'],
    [{ title: 'Customer Support (Work from Home)' }, 'remote'],
    [{ location: 'Karachi', remoteFlag: true }, 'remote'],
    [{ location: 'Karachi' }, 'unknown'],
    [{ location: 'Office-based, Multan' }, 'onsite'],
  ])('%j → %s', (parts, mode) => {
    expect(detectWorkMode(parts)).toBe(mode);
  });
});
