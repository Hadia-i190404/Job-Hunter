import { describe, expect, it } from 'vitest';
import {
  arrayOf,
  boolean,
  isoDate,
  number,
  object,
  oneOf,
  optional,
  recordOf,
  scalar,
  string,
} from '../../plugin/src/schema/core.ts';
import { DEFAULT_SETTINGS, settingsSchema } from '../../plugin/src/schema/files.ts';

const errorsOf = (result: { ok: boolean; errors?: string[] }): string[] => result.errors ?? [];

describe('primitive schemas', () => {
  it('checks strings, length and pattern', () => {
    expect(string()('a').ok).toBe(true);
    expect(errorsOf(string()(1))).toEqual(['value: expected a string']);
    expect(errorsOf(string({ minLength: 2 })('a', 'name'))).toEqual([
      'name: expected at least 2 characters',
    ]);
    expect(errorsOf(string({ pattern: /^\d+$/, hint: 'digits' })('x'))).toEqual([
      'value: expected digits',
    ]);
    expect(errorsOf(string({ pattern: /^\d+$/ })('x'))[0]).toContain('matching');
  });

  it('checks numbers, ranges and whole numbers', () => {
    expect(number()(3).ok).toBe(true);
    expect(errorsOf(number()(Number.NaN))).toEqual(['value: expected a number']);
    expect(errorsOf(number({ integer: true })(1.5))).toEqual(['value: expected a whole number']);
    expect(errorsOf(number({ min: 2 })(1))).toEqual(['value: expected 2 or more']);
    expect(errorsOf(number({ max: 2 })(3))).toEqual(['value: expected 2 or less']);
  });

  it('checks booleans, scalars and choices', () => {
    expect(boolean()(false).ok).toBe(true);
    expect(boolean()('no').ok).toBe(false);
    expect([scalar()('a').ok, scalar()(1).ok, scalar()(true).ok]).toEqual([true, true, true]);
    expect(scalar()({}).ok).toBe(false);
    expect(oneOf(['a', 'b'] as const)('b').ok).toBe(true);
    expect(errorsOf(oneOf(['a', 'b'] as const)('c'))).toEqual(['value: expected one of a, b']);
  });

  it('accepts only real ISO timestamps', () => {
    expect(isoDate()('2026-10-21T04:00:00.000Z').ok).toBe(true);
    expect(isoDate()('2026-10-21').ok).toBe(false);
    expect(isoDate()('2026-13-45T99:00:00Z').ok).toBe(false);
  });
});

describe('composite schemas', () => {
  const person = object({ name: string(), age: optional(number()) });

  it('validates objects, drops unknown keys and allows optional fields', () => {
    const result = person({ name: 'Ali', extra: true });
    expect(result).toEqual({ ok: true, value: { name: 'Ali' } });
    expect(person({ name: 'Ali', age: 3 })).toEqual({ ok: true, value: { name: 'Ali', age: 3 } });
  });

  it('reports every problem with its path', () => {
    expect(errorsOf(person({ name: 1, age: 'x' }, 'p'))).toEqual([
      'p.name: expected a string',
      'p.age: expected a number',
    ]);
    expect(errorsOf(person([]))).toEqual(['value: expected an object']);
  });

  it('validates lists and records', () => {
    expect(arrayOf(number())([1, 2])).toEqual({ ok: true, value: [1, 2] });
    expect(errorsOf(arrayOf(number())([1, 'x']))).toEqual(['value[1]: expected a number']);
    expect(errorsOf(arrayOf(number())('x'))).toEqual(['value: expected a list']);
    expect(recordOf(boolean())({ a: true })).toEqual({ ok: true, value: { a: true } });
    expect(errorsOf(recordOf(boolean())({ a: 1 }))).toEqual(['value.a: expected true or false']);
    expect(errorsOf(recordOf(boolean())(null))).toEqual(['value: expected an object']);
  });
});

describe('settings schema', () => {
  it('accepts the defaults', () => {
    expect(settingsSchema(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it('rejects a bad daily run time', () => {
    expect(errorsOf(settingsSchema({ ...DEFAULT_SETTINGS, dailyRunTime: '25:00' }))).toEqual([
      'value.dailyRunTime: expected a time like 09:00',
    ]);
  });
});
