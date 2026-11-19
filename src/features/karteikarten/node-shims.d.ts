/* Nur für die Typprüfung der Tests ohne @types/node (das Repo hat noch kein package.json).
 * Entfällt, sobald @types/node bzw. der endgültige Testlauf von A steht. */
declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): Promise<void>;
  export default test;
}
declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    rejects(fn: () => Promise<unknown>, expected?: unknown, message?: string): Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
