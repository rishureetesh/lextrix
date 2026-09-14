/** Shared error taxonomy for Lextrix core and published consumers. */

export type LextrixErrorCode =
  | 'INVALID_CONTAINER'
  | 'UNKNOWN_THEME'
  | 'UNKNOWN_MODULE'
  | 'MISSING_BLOT'
  | 'INVALID_REGISTRY_PATH'
  | 'OPTIMIZE_LIMIT'
  | 'SERIALIZATION'
  | 'DOM'
  | 'INTERNAL';

export class LextrixError extends Error {
  readonly code: LextrixErrorCode;

  constructor(message: string, code: LextrixErrorCode = 'INTERNAL') {
    super(message);
    this.name = 'LextrixError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidContainerError extends LextrixError {
  constructor(message = 'Invalid Lextrix container') {
    super(message, 'INVALID_CONTAINER');
    this.name = 'InvalidContainerError';
  }
}

export class UnknownThemeError extends LextrixError {
  constructor(theme: string) {
    super(`Invalid theme ${theme}. Did you register it?`, 'UNKNOWN_THEME');
    this.name = 'UnknownThemeError';
  }
}

export class MissingBlotError extends LextrixError {
  constructor(blotName: string) {
    super(`Cannot initialize Lextrix without "${blotName}" blot`, 'MISSING_BLOT');
    this.name = 'MissingBlotError';
  }
}

export class InvalidRegistryPathError extends LextrixError {
  constructor(message: string) {
    super(message, 'INVALID_REGISTRY_PATH');
    this.name = 'InvalidRegistryPathError';
  }
}
