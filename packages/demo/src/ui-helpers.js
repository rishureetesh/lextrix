/**
 * Shared playground UI helpers — readable status, not stack-dump UX.
 */

export function showError(message, detail) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  banner.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = message;
  banner.appendChild(title);
  if (detail) {
    const details = document.createElement('details');
    details.className = 'dev-details inline';
    const summary = document.createElement('summary');
    summary.textContent = 'Developer details';
    const pre = document.createElement('pre');
    pre.className = 'code-block compact';
    pre.textContent = typeof detail === 'string' ? detail : formatError(detail);
    details.append(summary, pre);
    banner.appendChild(details);
  }
}

export function clearError() {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.classList.add('hidden');
  banner.textContent = '';
}

export function setStatus(elOrId, message, kind = 'info') {
  const el =
    typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  el.textContent = message ?? '';
  el.dataset.kind = kind;
  el.classList.toggle('status-error', kind === 'error');
  el.classList.toggle('status-ok', kind === 'ok');
}

export function formatError(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const code = err.code ?? err.reason ?? err.name;
  const msg = err.message ?? String(err);
  return code ? `${code}: ${msg}` : msg;
}

export function classifyError(err) {
  const code = String(err?.code ?? err?.reason ?? '').toLowerCase();
  const msg = String(err?.message ?? '').toLowerCase();
  if (code.includes('stale') || msg.includes('stale')) {
    return {
      user: 'This proposal is stale — the document moved on. Rebase or regenerate.',
      kind: 'stale proposal',
    };
  }
  if (code.includes('rebase') || msg.includes('rebase')) {
    return {
      user: 'Rebase failed. Refresh review against the current Version.',
      kind: 'failed rebase',
    };
  }
  if (code.includes('unauthorized') || code.includes('forbidden')) {
    return {
      user: 'Operation not authorized for this session.',
      kind: 'unauthorized',
    };
  }
  if (code.includes('lifecycle') || msg.includes('tombstone') || msg.includes('purged')) {
    return {
      user: 'Document lifecycle rejected this mutation (tombstoned/archived/purged).',
      kind: 'lifecycle rejection',
    };
  }
  if (code.includes('persistence') || code.includes('cas') || code.includes('conflict')) {
    return {
      user: 'Persistence rejected the write (conflict or CAS failure). Sync and retry.',
      kind: 'persistence failure',
    };
  }
  if (code.includes('sync') || msg.includes('sync')) {
    return {
      user: 'Sync required before this change can be accepted.',
      kind: 'sync required',
    };
  }
  if (code.includes('reject') || msg.includes('reject')) {
    return {
      user: 'The mutation was rejected by the authoritative session.',
      kind: 'rejected mutation',
    };
  }
  return {
    user: err?.message || 'Something went wrong.',
    kind: 'invalid operation',
  };
}

export function reportCaught(err, statusId) {
  const classified = classifyError(err);
  showError(classified.user, formatError(err));
  if (statusId) setStatus(statusId, classified.user, 'error');
  return classified;
}

export function detailsBlock(summaryText, bodyText) {
  const details = document.createElement('details');
  details.className = 'dev-details';
  const summary = document.createElement('summary');
  summary.textContent = summaryText;
  const pre = document.createElement('pre');
  pre.className = 'code-block compact';
  pre.textContent = bodyText;
  details.append(summary, pre);
  return details;
}

export function summarizeOps(ops, limit = 3) {
  if (!ops?.length) return '(empty ChangeSet)';
  const parts = ops.slice(0, limit).map((op) => {
    if (typeof op.insert === 'string') {
      const t = op.insert.replace(/\n/g, '↵').slice(0, 24);
      return `insert “${t}”`;
    }
    if (op.delete != null) return `delete ${op.delete}`;
    if (op.retain != null) return `retain ${typeof op.retain === 'number' ? op.retain : '…'}`;
    return 'op';
  });
  const more = ops.length > limit ? ` (+${ops.length - limit} more)` : '';
  return parts.join(', ') + more;
}
