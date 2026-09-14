/**
 * parseChangeProposal — thin adapter over ADR-012 wire parser.
 * Kept separate from proposal model to avoid wire ↔ experimental cycles.
 */
import { WireError } from '../wire/errors.js';
import { parseChangeProposalWire } from '../wire/proposal.js';
import {
  ChangeProposal,
  ProposalError,
  type SerializedChangeProposal,
} from './proposal.js';

/**
 * Parse a JSON / plain object into a ChangeProposal.
 * Treats input as **untrusted**: sanitizes meta, validates op shape/size,
 * never evaluates code, never mutates Document.
 *
 * Throws {@link ProposalError} with code `invalid_serialized` on wire failures
 * (stable mapping from {@link WireError} for existing call sites).
 */
export function parseChangeProposal(
  input: SerializedChangeProposal | string | unknown,
): ChangeProposal {
  try {
    return parseChangeProposalWire(input);
  } catch (err) {
    if (err instanceof ProposalError) throw err;
    if (err instanceof WireError) {
      throw new ProposalError('invalid_serialized', err.message);
    }
    throw err;
  }
}
