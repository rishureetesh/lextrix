/**
 * In-memory authoritative collaboration demo — readable status, real APIs.
 */
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence/authority-memory';
import {
  DocumentServerSession,
  EphemeralPresenceStore,
} from 'lextrix-collab';
import {
  clearError,
  detailsBlock,
  reportCaught,
  setStatus,
  summarizeOps,
} from './ui-helpers.js';

let session = null;
let persistence = null;
let presence = null;
let frames = [];
let presenceGeneration = 1;

export async function initCollabDemo() {
  clearError();
  persistence = new InMemoryAuthoritativePersistence();
  presence = new EphemeralPresenceStore();
  frames = [];
  session = await DocumentServerSession.open(
    'playground_doc',
    {
      persistence,
      authorizeEnvelope: async () => true,
      observe: () => {},
    },
    {
      contents: new ChangeSet([{ insert: 'Shared document\n' }]),
      createIfMissing: true,
    },
  );
  session.subscribe((f) => {
    frames.push(f);
    if (frames.length > 24) frames.shift();
    renderCollab();
  });
  setStatus(
    'collab-status',
    'In-memory DocumentServerSession ready (not PostgreSQL/WebSocket).',
    'ok',
  );
  renderCollab();
}

export function bindCollabDemo() {
  document.getElementById('collab-init-btn')?.addEventListener('click', () => {
    initCollabDemo().catch((err) => reportCaught(err, 'collab-status'));
  });

  document.getElementById('collab-a-btn')?.addEventListener('click', () => {
    submitClient('A', document.getElementById('collab-a-input')?.value ?? 'A');
  });
  document.getElementById('collab-b-btn')?.addEventListener('click', () => {
    submitClient('B', document.getElementById('collab-b-input')?.value ?? 'B');
  });

  document
    .getElementById('presence-publish-btn')
    ?.addEventListener('click', () => {
      clearError();
      const out = document.getElementById('presence-summary');
      const host = document.getElementById('presence-dev');
      if (!presence || !session) {
        setStatus('collab-status', 'Start the collaboration session first.', 'error');
        return;
      }
      const actorId = `actor_${Math.random().toString(36).slice(2, 7)}`;
      const result = presence.publish(
        'playground_doc',
        actorId,
        presenceGeneration++,
        { cursor: 0, label: actorId },
      );
      const online = presence.list('playground_doc').map((e) => e.actorId);
      if (out) {
        out.textContent = result.ok
          ? `Presence published for ${actorId}. Online: ${online.join(', ') || '—'}. Ephemeral — cannot block accept.`
          : `Presence publish failed (${result.reason}).`;
      }
      host?.replaceChildren(
        detailsBlock('Developer details', JSON.stringify({ result, online }, null, 2)),
      );
    });
}

async function submitClient(client, text) {
  clearError();
  if (!session) {
    setStatus('collab-status', 'Click “Start / reset session” first.', 'error');
    return;
  }
  try {
    const head = session.getHead();
    const changeId = `${client}_${Date.now()}`;
    const insert = String(text || client).slice(0, 40);
    const result = await session.accept({
      changeId,
      documentId: 'playground_doc',
      baseVersionId: head.id,
      change: new ChangeSet([{ insert }]),
      dependsOn: [],
      meta: { source: 'user', client },
    });
    if (result.ok) {
      setStatus(
        'collab-status',
        `Client ${client} accepted → ${result.version.id} (seq ${result.version.sequence}). Change: ${summarizeOps(result.version.changeFromParent?.ops ?? [{ insert }])}`,
        'ok',
      );
    } else {
      setStatus(
        'collab-status',
        `Client ${client} rejected: ${result.code ?? 'unknown'} — ${result.message ?? ''}`,
        'error',
      );
    }
    renderCollab();
  } catch (err) {
    reportCaught(err, 'collab-status');
  }
}

function renderCollab() {
  const headEl = document.getElementById('collab-head');
  const logHost = document.getElementById('collab-log-host');
  if (!session || !headEl) return;
  const head = session.getHead();
  const plain = head.contents.ops
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('');
  headEl.replaceChildren();
  const dl = document.createElement('dl');
  dl.className = 'kv';
  for (const [k, v] of [
    ['HEAD Version', head.id],
    ['Sequence', String(head.sequence)],
    ['Contents', plain.slice(0, 160) + (plain.length > 160 ? '…' : '')],
  ]) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  headEl.appendChild(dl);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent =
    'Server owns Version identity. Clients submit ChangeSets; they do not choose Version IDs.';
  headEl.appendChild(hint);

  if (logHost) {
    logHost.replaceChildren();
    const recent = frames.slice(-8);
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = recent.length
      ? `${recent.length} recent control frame(s).`
      : 'No control frames yet.';
    logHost.appendChild(p);
    if (recent.length) {
      logHost.appendChild(
        detailsBlock(
          'Developer details (frames)',
          recent.map((f) => JSON.stringify(f)).join('\n'),
        ),
      );
    }
  }
}
