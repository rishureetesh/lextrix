/**
 * Infrastructure demo (browser-safe CAS + lifecycle).
 */
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence/authority-memory';
import { InMemoryDocumentLifecycle } from 'lextrix-change/persistence/lifecycle';
import {
  clearError,
  detailsBlock,
  reportCaught,
  setStatus,
} from './ui-helpers.js';

const DOC_ID = 'infra_demo_doc';

let persistence = null;
let lifecycle = null;
let handle = null;

export function bindInfraDemo() {
  document.getElementById('infra-init-btn')?.addEventListener('click', async () => {
    clearError();
    try {
      persistence = new InMemoryAuthoritativePersistence();
      lifecycle = new InMemoryDocumentLifecycle();
      handle = DocumentHandle.create({
        documentId: DOC_ID,
        contents: new ChangeSet([{ insert: 'Infra demo seed\n' }]),
      });
      let expected = null;
      for (const v of handle.listVersions()) {
        const r = await persistence.compareAndAppend(DOC_ID, expected, v, {
          changeId: `seed_${v.sequence}`,
        });
        if (r.ok) expected = r.version.id;
      }
      setStatus(
        'infra-status',
        'In-memory CAS + lifecycle ready. Snapshot SHA-256 / compaction: Node engine tests (not in-browser).',
        'ok',
      );
      renderInfra();
    } catch (err) {
      reportCaught(err, 'infra-status');
    }
  });

  document.getElementById('infra-mutate-btn')?.addEventListener('click', async () => {
    clearError();
    if (!handle || !persistence) {
      setStatus('infra-status', 'Initialize infrastructure demo first.', 'error');
      return;
    }
    try {
      const before = handle.currentVersion().id;
      const len = handle.getContents().length();
      handle.apply(new ChangeSet().retain(Math.max(0, len - 1)).insert('!'));
      const head = handle.currentVersion();
      const r = await persistence.compareAndAppend(DOC_ID, before, head, {
        changeId: `m_${Date.now()}`,
      });
      setStatus(
        'infra-status',
        r.ok
          ? `Appended Version ${head.id} (seq ${head.sequence}) via compareAndAppend.`
          : `Persistence rejected write: ${r.reason ?? 'unknown'}`,
        r.ok ? 'ok' : 'error',
      );
      renderInfra();
    } catch (err) {
      reportCaught(err, 'infra-status');
    }
  });

  document.getElementById('infra-snapshot-btn')?.addEventListener('click', () => {
    setStatus(
      'infra-status',
      'NOT SUITABLE FOR BROWSER DEMO: snapshot integrity uses node:crypto. Covered by packages/change compaction tests.',
      'info',
    );
  });

  document.getElementById('infra-compact-btn')?.addEventListener('click', () => {
    setStatus(
      'infra-status',
      'NOT SUITABLE FOR BROWSER DEMO: CompactionController seal→archive→purge runs in Node tests / lextrix-server.',
      'info',
    );
  });

  document.getElementById('infra-tombstone-btn')?.addEventListener('click', () => {
    clearError();
    if (!lifecycle) {
      setStatus('infra-status', 'Initialize first.', 'error');
      return;
    }
    try {
      lifecycle.tombstone(DOC_ID);
      setStatus(
        'infra-status',
        `Lifecycle → ${lifecycle.getState(DOC_ID)} (mutations should be rejected while tombstoned in full server path).`,
        'ok',
      );
      renderInfra();
    } catch (err) {
      reportCaught(err, 'infra-status');
    }
  });

  document.getElementById('infra-revive-btn')?.addEventListener('click', () => {
    clearError();
    if (!lifecycle) {
      setStatus('infra-status', 'Initialize first.', 'error');
      return;
    }
    try {
      lifecycle.revive?.(DOC_ID);
      setStatus(
        'infra-status',
        `Lifecycle → ${lifecycle.getState(DOC_ID)}`,
        'ok',
      );
      renderInfra();
    } catch (err) {
      reportCaught(err, 'infra-status');
    }
  });
}

function renderInfra() {
  const el = document.getElementById('infra-summary');
  const host = document.getElementById('infra-dev');
  if (!el || !handle) return;
  const head = handle.currentVersion();
  el.replaceChildren();
  const dl = document.createElement('dl');
  dl.className = 'kv';
  for (const [k, v] of [
    ['Document', DOC_ID],
    ['HEAD', head.id],
    ['Sequence', String(head.sequence)],
    ['Versions', String(handle.listVersions().length)],
    ['Lifecycle', lifecycle?.getState(DOC_ID) ?? 'n/a'],
  ]) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  el.appendChild(dl);
  host?.replaceChildren(
    detailsBlock(
      'Developer details',
      JSON.stringify(
        {
          versions: handle.listVersions().map((v) => ({
            id: v.id,
            sequence: v.sequence,
          })),
        },
        null,
        2,
      ),
    ),
  );
}
