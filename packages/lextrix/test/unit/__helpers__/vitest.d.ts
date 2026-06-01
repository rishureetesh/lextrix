import 'vitest';

interface CustomMatchers<R = unknown> {
  toEqualHTML(html: string, options?: { ignoreAttrs?: string[] }): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
