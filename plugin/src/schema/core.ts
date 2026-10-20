// A tiny validator library (spec D14: the plugin has no dependencies, so no zod).
// A Schema checks an unknown value and returns either the typed value or the problems
// found, each with a path such as "settings.usage". It never throws.

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type Schema<T> = (value: unknown, path?: string) => Result<T>;
export type Infer<S> = S extends Schema<infer T> ? T : never;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(path: string, message: string): Result<T> => ({
  ok: false,
  errors: [`${path}: ${message}`],
});

export const string =
  (options: { minLength?: number; pattern?: RegExp; hint?: string } = {}): Schema<string> =>
  (value, path = 'value') => {
    if (typeof value !== 'string') return fail(path, 'expected a string');
    if (options.minLength !== undefined && value.length < options.minLength) {
      return fail(path, `expected at least ${String(options.minLength)} characters`);
    }
    if (options.pattern !== undefined && !options.pattern.test(value)) {
      return fail(path, `expected ${options.hint ?? `text matching ${String(options.pattern)}`}`);
    }
    return ok(value);
  };

export const number =
  (options: { min?: number; max?: number; integer?: boolean } = {}): Schema<number> =>
  (value, path = 'value') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fail(path, 'expected a number');
    }
    if (options.integer === true && !Number.isInteger(value)) {
      return fail(path, 'expected a whole number');
    }
    if (options.min !== undefined && value < options.min) {
      return fail(path, `expected ${String(options.min)} or more`);
    }
    if (options.max !== undefined && value > options.max) {
      return fail(path, `expected ${String(options.max)} or less`);
    }
    return ok(value);
  };

export const boolean =
  (): Schema<boolean> =>
  (value, path = 'value') =>
    typeof value === 'boolean' ? ok(value) : fail(path, 'expected true or false');

export const scalar =
  (): Schema<string | number | boolean> =>
  (value, path = 'value') =>
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
      ? ok(value)
      : fail(path, 'expected text, a number or true/false');

export const oneOf =
  <const T extends readonly string[]>(choices: T): Schema<T[number]> =>
  (value, path = 'value') =>
    typeof value === 'string' && choices.includes(value)
      ? ok(value as T[number])
      : fail(path, `expected one of ${choices.join(', ')}`);

// ISO 8601 timestamp produced by Date#toISOString, e.g. 2026-10-21T04:00:00.000Z.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
export const isoDate =
  (): Schema<string> =>
  (value, path = 'value') =>
    typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
      ? ok(value)
      : fail(path, 'expected an ISO date like 2026-10-21T04:00:00.000Z');

export const arrayOf =
  <T>(item: Schema<T>): Schema<T[]> =>
  (value, path = 'value') => {
    if (!Array.isArray(value)) return fail(path, 'expected a list');
    const results = value.map((entry, index) => item(entry, `${path}[${String(index)}]`));
    return collect(results, (values) => values);
  };

export const recordOf =
  <T>(item: Schema<T>): Schema<Record<string, T>> =>
  (value, path = 'value') => {
    if (!isPlainObject(value)) return fail(path, 'expected an object');
    const entries = Object.entries(value).map(
      ([key, entry]) => [key, item(entry, `${path}.${key}`)] as const,
    );
    return collectEntries(entries);
  };

type Shape = Record<string, Schema<unknown>>;
type OptionalKeys<S extends Shape> = {
  [K in keyof S]: undefined extends Infer<S[K]> ? K : never;
}[keyof S];
type Simplify<T> = { [K in keyof T]: T[K] } & {};
// Fields whose schema allows undefined (see `optional`) become optional properties.
type Output<S extends Shape> = Simplify<
  { [K in Exclude<keyof S, OptionalKeys<S>>]: Infer<S[K]> } & {
    [K in OptionalKeys<S>]?: Exclude<Infer<S[K]>, undefined>;
  }
>;

// Unknown keys are dropped so stale fields from an older version never leak back into a
// file when it's rewritten. Absent optional fields stay absent.
export const object =
  <S extends Shape>(shape: S): Schema<Output<S>> =>
  (value, path = 'value') => {
    if (!isPlainObject(value)) return fail(path, 'expected an object');
    const entries = Object.entries(shape).map(
      ([key, schema]) => [key, schema(value[key], `${path}.${key}`)] as const,
    );
    const result = collectEntries(entries);
    return result as Result<Output<S>>;
  };

// Optional field: absent (undefined) is allowed and stays absent.
export const optional =
  <T>(inner: Schema<T>): Schema<T | undefined> =>
  (value, path = 'value') =>
    value === undefined ? ok(undefined) : inner(value, path);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collect<T, R>(results: Result<T>[], build: (values: T[]) => R): Result<R> {
  const values: T[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.ok) values.push(result.value);
    else errors.push(...result.errors);
  }
  return errors.length > 0 ? { ok: false, errors } : ok(build(values));
}

function collectEntries<T>(
  entries: readonly (readonly [string, Result<T>])[],
): Result<Record<string, T>> {
  const output: Record<string, T> = {};
  const errors: string[] = [];
  for (const [key, result] of entries) {
    if (!result.ok) errors.push(...result.errors);
    else if (result.value !== undefined) output[key] = result.value;
  }
  return errors.length > 0 ? { ok: false, errors } : ok(output);
}
