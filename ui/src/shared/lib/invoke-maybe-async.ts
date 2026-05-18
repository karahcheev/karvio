/**
 * Runs a callback that may return void or a Promise, and handles promise rejections.
 * Prefer this over the `void` operator on promises (Sonar typescript:S3735).
 */
export function invokeMaybeAsync(fn: () => void | Promise<unknown>): void {
  Promise.resolve(fn()).catch(() => undefined);
}
