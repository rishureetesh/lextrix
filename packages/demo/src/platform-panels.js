/**
 * Document / Version / Anchor / Intelligence — readable panels over real APIs.
 */
import {
  createAnchor,
  createRange,
  diffVersions,
} from 'lextrix-change/document';
import {
  DeterministicDocumentIntelligenceProvider,
  createIntelligenceRequest,
  createProposalReview,
  evaluateProposalAcceptancePolicy,
} from 'lextrix-intelligence';
import {
  clearError,
  detailsBlock,
  formatError,
  reportCaught,
  setStatus,
  showError,
  summarizeOps,
} from './ui-helpers.js';

let pendingProposal = null;
let selectedVersionId = null;

export function refreshDocumentPanel(editor) {
  const docEl = document.getElementById('doc-state');
  const verEl = document.getElementById('version-list');
  if (!editor || !docEl || !verEl) return;

  const doc = editor.getExperimentalDocument?.();
  const version = editor.getExperimentalVersion?.();
  const versions = editor.getExperimentalVersions?.() ?? [];
  const handle = editor.getExperimentalHandle?.();

  if (!doc || !version || !handle) {
    docEl.textContent =
      'experimentalDocument is disabled — Document bridge unavailable.';
    verEl.replaceChildren();
    return;
  }

  const plain = contentsPlain(doc.getContents());
  docEl.replaceChildren();
  docEl.appendChild(
    kvList([
      ['Document ID', handle.documentId],
      ['Version ID', version.id],
      ['Sequence', String(version.sequence)],
      ['Revision', String(version.revision)],
      ['Parent', version.parentId ?? '— (root)'],
      ['Editor length', `${editor.getLength()} chars`],
      ['Preview', plain.slice(0, 160) + (plain.length > 160 ? '…' : '')],
    ]),
  );
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent =
    'Editor ≠ Document. Typing projects into the mirrored Document/Version chain (Strategy B+).';
  docEl.appendChild(note);

  verEl.replaceChildren();
  for (const v of versions.slice().reverse()) {
    const preview = contentsPlain(v.contents).slice(0, 48).replace(/\n/g, '↵');
    const li = document.createElement('li');
    li.className = 'version-item';
    if (v.id === version.id) li.classList.add('current');
    if (v.id === selectedVersionId) li.classList.add('selected');
    li.dataset.versionId = v.id;
    li.setAttribute('role', 'option');
    li.setAttribute(
      'aria-selected',
      v.id === selectedVersionId ? 'true' : 'false',
    );
    li.tabIndex = 0;
    li.innerHTML = `<strong>seq ${v.sequence}</strong><span class="muted">${escapeHtml(preview || '(empty)')}</span>`;
    verEl.appendChild(li);
  }
}

export function bindDocumentPanel(getEditor) {
  document.getElementById('refresh-doc-btn')?.addEventListener('click', () => {
    clearError();
    refreshDocumentPanel(getEditor());
  });

  const list = document.getElementById('version-list');
  list?.addEventListener('click', (ev) => onSelectVersion(ev, getEditor));
  list?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onSelectVersion(ev, getEditor);
    }
  });

  document
    .getElementById('restore-version-btn')
    ?.addEventListener('click', () => {
      clearError();
      const editor = getEditor();
      const handle = editor?.getExperimentalHandle?.();
      const status = 'version-action-status';
      if (!handle) {
        setStatus(status, 'Document bridge unavailable.', 'error');
        return;
      }
      const targetId =
        selectedVersionId ??
        document
          .querySelector('#version-list .version-item:not(.current)')
          ?.getAttribute('data-version-id');
      if (!targetId) {
        setStatus(status, 'Select a prior Version in the list first.', 'error');
        return;
      }
      if (targetId === handle.currentVersion().id) {
        setStatus(status, 'That Version is already HEAD.', 'info');
        return;
      }
      try {
        const before = handle.currentVersion().id;
        const restored = handle.restoreVersion(targetId);
        editor.setContents(handle.getContents(), 'silent');
        setStatus(
          status,
          `Restored snapshot of seq target → new Version ${restored.id} (previous HEAD ${before}). History was not rewritten.`,
          'ok',
        );
        selectedVersionId = restored.id;
        refreshDocumentPanel(editor);
      } catch (err) {
        reportCaught(err, status);
      }
    });

  document.getElementById('anchor-demo-btn')?.addEventListener('click', () => {
    clearError();
    const editor = getEditor();
    const version = editor?.getExperimentalVersion?.();
    const out = document.getElementById('anchor-summary');
    const raw = document.getElementById('anchor-dev');
    if (!version || !out) return;
    try {
      const len = Math.max(0, version.contents.length() - 1);
      const index = Math.min(3, len);
      const anchor = createAnchor(version, index, { affinity: 'before' });
      const range = createRange(version, 0, Math.min(5, len));
      out.textContent = `Anchor at index ${anchor.index} (${anchor.affinity}) on ${shortId(anchor.versionId)}. Range [${range.start}, ${range.end}).`;
      raw?.replaceChildren(
        detailsBlock(
          'Developer details',
          JSON.stringify(
            {
              anchor: {
                index: anchor.index,
                affinity: anchor.affinity,
                versionId: anchor.versionId,
              },
              range: {
                start: range.start,
                end: range.end,
                versionId: range.versionId,
              },
            },
            null,
            2,
          ),
        ),
      );
    } catch (err) {
      reportCaught(err);
    }
  });

  document
    .getElementById('intel-generate-btn')
    ?.addEventListener('click', async () => {
      clearError();
      const editor = getEditor();
      const handle = editor?.getExperimentalHandle?.();
      const summary = document.getElementById('intel-summary');
      if (!handle) {
        setStatus('intel-status', 'Document bridge unavailable.', 'error');
        return;
      }
      setStatus('intel-status', 'Generating proposal…', 'info');
      try {
        const provider = new DeterministicDocumentIntelligenceProvider();
        const instruction =
          document.getElementById('intel-instruction')?.value?.trim() ||
          'replace:Lextrix 3.0 platform';
        const request = createIntelligenceRequest(handle, {
          instruction,
          operation: instruction.startsWith('replace:') ? 'replace' : 'shorten',
          context: instruction.startsWith('replace:')
            ? { replacement: instruction.slice('replace:'.length) }
            : { maxLength: 40 },
        });
        pendingProposal = await provider.generate(request);
        const review = createProposalReview({
          proposal: pendingProposal,
          handle,
        });
        const policy = evaluateProposalAcceptancePolicy({
          proposal: pendingProposal,
          context: { headVersionId: handle.currentVersion().id },
        });
        if (summary) {
          summary.replaceChildren();
          summary.appendChild(
            kvList([
              ['Safety', 'Proposal only — Document not mutated yet'],
              ['Review', review.status],
              ['Policy', policy.eligible ? 'eligible' : policy.reasons.join(', ')],
              ['Base Version', shortId(pendingProposal.baseVersionId)],
              ['Change', summarizeOps(pendingProposal.change.ops)],
            ]),
          );
          summary.appendChild(
            detailsBlock(
              'Developer details',
              JSON.stringify(
                {
                  proposalId: pendingProposal.id,
                  ops: pendingProposal.change.ops,
                  provenance: pendingProposal.meta,
                },
                null,
                2,
              ),
            ),
          );
        }
        setStatus(
          'intel-status',
          'Proposal ready. Accept or reject explicitly.',
          'ok',
        );
      } catch (err) {
        pendingProposal = null;
        reportCaught(err, 'intel-status');
      }
    });

  document.getElementById('intel-accept-btn')?.addEventListener('click', () => {
    clearError();
    const editor = getEditor();
    if (!editor || !pendingProposal) {
      setStatus('intel-status', 'Generate a proposal first.', 'error');
      return;
    }
    try {
      const result = editor.acceptProposalAndProject(pendingProposal);
      setStatus(
        'intel-status',
        `Accepted & projected → Version ${result.version?.id ?? '—'}.`,
        'ok',
      );
      pendingProposal = null;
      refreshDocumentPanel(editor);
    } catch (err) {
      reportCaught(err, 'intel-status');
    }
  });

  document.getElementById('intel-reject-btn')?.addEventListener('click', () => {
    clearError();
    const editor = getEditor();
    const handle = editor?.getExperimentalHandle?.();
    if (!handle || !pendingProposal) {
      setStatus('intel-status', 'No pending proposal to reject.', 'error');
      return;
    }
    try {
      handle.rejectProposal(pendingProposal);
      setStatus('intel-status', 'Proposal rejected — Document unchanged.', 'ok');
      pendingProposal = null;
    } catch (err) {
      reportCaught(err, 'intel-status');
    }
  });

  document
    .getElementById('intel-stale-btn')
    ?.addEventListener('click', async () => {
      clearError();
      const editor = getEditor();
      const handle = editor?.getExperimentalHandle?.();
      if (!handle) return;
      try {
        const ChangeSet = (await import('lextrix-change')).default;
        const provider = new DeterministicDocumentIntelligenceProvider();
        const request = createIntelligenceRequest(handle, {
          instruction: 'replace:STALE_MARK',
          operation: 'replace',
          context: { replacement: 'STALE_MARK' },
        });
        pendingProposal = await provider.generate(request);
        // Advance HEAD so the proposal base is behind tip.
        handle.apply(new ChangeSet().insert('x'));
        editor.setContents(handle.getContents(), 'silent');
        refreshDocumentPanel(editor);
        editor.acceptProposalAndProject(pendingProposal);
        setStatus(
          'intel-status',
          'Unexpected: stale accept succeeded.',
          'error',
        );
      } catch (err) {
        reportCaught(err, 'intel-status');
        const tip = document.getElementById('intel-summary');
        if (tip) {
          tip.textContent =
            'Demo: after HEAD advanced, accepting the old proposal fails (stale). Document only changes on successful explicit accept.';
        }
      }
    });
}

function onSelectVersion(ev, getEditor) {
  const item = ev.target.closest('[data-version-id]');
  if (!item) return;
  selectedVersionId = item.getAttribute('data-version-id');
  for (const el of document.querySelectorAll('#version-list .version-item')) {
    el.classList.toggle('selected', el === item);
    el.setAttribute('aria-selected', el === item ? 'true' : 'false');
  }
  const editor = getEditor();
  const handle = editor?.getExperimentalHandle?.();
  const diffHost = document.getElementById('version-diff-host');
  if (!handle || !diffHost || !selectedVersionId) return;
  try {
    const selected = handle.getVersion(selectedVersionId);
    const head = handle.currentVersion();
    const delta = diffVersions(selected, head);
    diffHost.replaceChildren();
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = `Diff selected → HEAD: ${summarizeOps(delta.ops, 5)}`;
    diffHost.appendChild(p);
    diffHost.appendChild(
      detailsBlock('Developer details (ops JSON)', JSON.stringify(delta.ops, null, 2)),
    );
  } catch (err) {
    showError('Could not compute Version diff.', formatError(err));
  }
}

function kvList(rows) {
  const dl = document.createElement('dl');
  dl.className = 'kv';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  return dl;
}

function contentsPlain(cs) {
  if (!cs?.ops) return '';
  return cs.ops
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('');
}

function shortId(id) {
  if (!id) return '—';
  const parts = String(id).split(':');
  return parts[parts.length - 1] || id;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
