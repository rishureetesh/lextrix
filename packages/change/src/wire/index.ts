/**
 * Stable wire contracts for Lextrix document-engine primitives (ADR-012).
 *
 * ```text
 * Serialized document → parse → engine types → existing OT / apply
 * ```
 *
 * This module defines persistence / boundary formats — not transport or backends.
 */
export {
  WIRE_SCHEMA_VERSION,
  SUPPORTED_WIRE_SCHEMA_VERSIONS,
  WIRE_LIMITS,
  isSupportedWireSchemaVersion,
  type WireSchemaVersion,
  type WireDocumentKind,
} from './schema.js';

export { WireError, type WireErrorCode } from './errors.js';

export {
  serializeChangeSet,
  parseChangeSet,
  changeSetsEqual,
  type SerializedChangeSet,
} from './changeset.js';

export {
  serializeDocumentVersion,
  parseDocumentVersion,
  documentVersionsEqual,
  type SerializedDocumentVersion,
} from './version.js';

export {
  serializeChangeProposal,
  parseChangeProposalWire,
  proposalsEqual,
  type SerializedChangeProposalV1,
} from './proposal.js';

export {
  serializeCollabEnvelope,
  parseCollabEnvelope,
  collabEnvelopesEqual,
  type SerializedCollabEnvelope,
} from './envelope.js';

export { parseWireOps, serializeWireOps } from './ops.js';

/** Re-export meta sanitizers used by wire parsers (normative for untrusted input). */
export {
  sanitizeUntrustedChangeMeta,
  normalizeChangeMeta,
  UNTRUSTED_META_LIMITS,
  type ChangeMeta,
  type ChangeSource,
  type ChangeOrigin,
  type ChangeProvenanceFields,
} from '../experimental/change-meta.js';
