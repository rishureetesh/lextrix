/**
 * Application AuthN/AuthZ hooks (ADR-026). No IdP inside Lextrix.
 */
export interface CollabPrincipal {
  principalId: string;
  tenantId?: string;
  /** Application metadata (not used by OT). */
  claims?: Record<string, unknown>;
}

export type CollabAuthOp =
  | 'subscribe'
  | 'submit'
  | 'sync'
  | 'presence_publish'
  | 'presence_subscribe';

export interface CollabAuthContext {
  principal: CollabPrincipal;
  documentId: string;
  op: CollabAuthOp;
  connectionId?: string;
}

export interface CollabAuthHooks {
  /** Authenticate a connection token / cookie → principal (or null). */
  authenticate(info: {
    token?: string;
    headers?: Record<string, string | string[] | undefined>;
    connectionId: string;
  }): Promise<CollabPrincipal | null> | CollabPrincipal | null;

  authorize(ctx: CollabAuthContext): Promise<boolean> | boolean;
}

/** Dev-only: accept any token as principalId. */
export const allowAllAuth: CollabAuthHooks = {
  authenticate: ({ token, connectionId }) => ({
    principalId: token || `anon_${connectionId}`,
  }),
  authorize: () => true,
};
