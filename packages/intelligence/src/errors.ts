/** Application-layer intelligence errors (not Document-engine errors). */

export type IntelligenceErrorCode =
  | 'invalid_instruction'
  | 'invalid_range'
  | 'wrong_document'
  | 'version_mismatch'
  | 'unsupported_operation'
  | 'unsupported_content'
  | 'provider_failed'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_malformed'
  | 'out_of_range'
  | 'parse_failed'
  | 'invalid_serialized';

export class IntelligenceRequestError extends Error {
  readonly code: IntelligenceErrorCode;

  constructor(code: IntelligenceErrorCode, message: string) {
    super(message);
    this.name = 'IntelligenceRequestError';
    this.code = code;
  }
}

export class IntelligenceProviderError extends Error {
  readonly code: IntelligenceErrorCode;

  constructor(code: IntelligenceErrorCode, message: string) {
    super(message);
    this.name = 'IntelligenceProviderError';
    this.code = code;
  }
}

export class IntelligenceParseError extends Error {
  readonly code: IntelligenceErrorCode = 'parse_failed';

  constructor(message: string) {
    super(message);
    this.name = 'IntelligenceParseError';
  }
}
