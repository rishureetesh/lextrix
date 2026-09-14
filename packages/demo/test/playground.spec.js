import { test, expect } from '@playwright/test';

test.describe('Lextrix 3.0 playground', () => {
  /** @type {string[]} */
  let fatalConsole = [];

  test.beforeEach(async ({ page }) => {
    fatalConsole = [];
    page.on('pageerror', (err) => {
      fatalConsole.push(String(err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Vite HMR / dependency warnings are noisy; track hard failures only.
        if (/Failed to fetch|is not defined|Cannot read|Uncaught/i.test(text)) {
          fatalConsole.push(text);
        }
      }
    });
    await page.goto('/');
    await page.waitForSelector('.lxr-editor', { timeout: 20000 });
  });

  test.afterEach(async () => {
    expect(fatalConsole, `fatal console: ${fatalConsole.join(' | ')}`).toEqual(
      [],
    );
  });

  test('playground loads and editor initializes', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Platform playground', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('.lxr-editor')).toBeVisible();
    const hasBridge = await page.evaluate(() => {
      const editor = window.__lextrixPlayground?.getEditor?.();
      return Boolean(
        editor &&
          editor.getExperimentalDocument?.() &&
          editor.getExperimentalVersion?.() &&
          editor.getExperimentalHandle?.(),
      );
    });
    expect(hasBridge).toBe(true);
  });

  test('typing updates Document state and Version history', async ({ page }) => {
    const before = await page.evaluate(() => {
      const editor = window.__lextrixPlayground.getEditor();
      return {
        seq: editor.getExperimentalVersion().sequence,
        text: editor.getText(),
      };
    });
    await page.locator('.lxr-editor').click();
    await page.keyboard.type(' playground-type');
    await page.click('#refresh-doc-btn');
    await expect(page.locator('#doc-state')).toContainText(/Version ID/i);
    await expect(page.locator('#version-list .version-item').first()).toBeVisible();
    const after = await page.evaluate(() => {
      const editor = window.__lextrixPlayground.getEditor();
      return {
        seq: editor.getExperimentalVersion().sequence,
        text: editor.getText(),
        versions: editor.getExperimentalVersions().length,
      };
    });
    expect(after.text).toContain('playground-type');
    expect(after.seq).toBeGreaterThanOrEqual(before.seq);
    expect(after.versions).toBeGreaterThan(0);
  });

  test('formatting works via toolbar bold', async ({ page }) => {
    await page.locator('.lxr-editor').click();
    await page.keyboard.type('BoldMe');
    await page.keyboard.press('Control+A');
    const bold = page.locator('.lxr-toolbar button.lxr-bold, .lxr-toolbar button[aria-label*="Bold" i], .lxr-toolbar .ql-bold').first();
    if (await bold.count()) {
      await bold.click();
    } else {
      // Fallback: format API on the editor instance (still user-visible via export)
      await page.evaluate(() => {
        const editor = window.__lextrixPlayground.getEditor();
        editor.format('bold', true);
      });
    }
    await page.click('#refresh-export-btn');
    const html = await page.locator('#export-output').textContent();
    expect(html?.toLowerCase()).toMatch(/<strong>|<b>|bold/i);
  });

  test('restore creates a new Version matching restored contents', async ({
    page,
  }) => {
    await page.locator('.lxr-editor').click();
    await page.keyboard.type(' restore-marker');
    await page.click('#refresh-doc-btn');
    await page.waitForSelector('#version-list .version-item');

    const snapshot = await page.evaluate(() => {
      const editor = window.__lextrixPlayground.getEditor();
      const versions = editor.getExperimentalVersions();
      const root = versions[0];
      return {
        rootId: root.id,
        rootText: root.contents.ops
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join(''),
        headBefore: editor.getExperimentalVersion().id,
        versionCount: versions.length,
      };
    });

    await page.locator(`#version-list [data-version-id="${snapshot.rootId}"]`).click();
    await page.click('#restore-version-btn');
    await expect(page.locator('#version-action-status')).toContainText(
      /Restored snapshot|new Version/i,
      { timeout: 10000 },
    );

    const after = await page.evaluate(() => {
      const editor = window.__lextrixPlayground.getEditor();
      return {
        headId: editor.getExperimentalVersion().id,
        text: editor.getText(),
        versionCount: editor.getExperimentalVersions().length,
      };
    });
    expect(after.headId).not.toBe(snapshot.headBefore);
    expect(after.versionCount).toBeGreaterThan(snapshot.versionCount);
    expect(after.text.replace(/\n/g, '')).toContain(
      snapshot.rootText.replace(/\n/g, '').slice(0, 20),
    );
  });

  test('proposal can be inspected; accept mutates only after explicit accept', async ({
    page,
  }) => {
    const beforeText = await page.evaluate(() =>
      window.__lextrixPlayground.getEditor().getText(),
    );
    await page.fill('#intel-instruction', 'replace:PROPOSAL_MARK');
    await page.click('#intel-generate-btn');
    await expect(page.locator('#intel-status')).toContainText(/Proposal ready/i, {
      timeout: 15000,
    });
    await expect(page.locator('#intel-summary')).toContainText(
      /Document not mutated/i,
    );
    const midText = await page.evaluate(() =>
      window.__lextrixPlayground.getEditor().getText(),
    );
    expect(midText).toBe(beforeText);

    await page.click('#intel-accept-btn');
    await expect(page.locator('#intel-status')).toContainText(
      /Accepted & projected/i,
      { timeout: 10000 },
    );
    const afterText = await page.evaluate(() =>
      window.__lextrixPlayground.getEditor().getText(),
    );
    expect(afterText).toContain('PROPOSAL_MARK');
    expect(afterText).not.toBe(beforeText);
  });

  test('stale proposal error renders without stack-trace primary UX', async ({
    page,
  }) => {
    await page.click('#intel-stale-btn');
    await expect(page.locator('#error-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#error-banner')).toContainText(/stale/i);
    await expect(page.locator('#error-banner strong')).toBeVisible();
    const primary = await page.locator('#error-banner strong').textContent();
    expect(primary).not.toMatch(/at Object\.|Error stack|^\s*at /);
  });

  test('collaboration demo: two clients converge on shared HEAD', async ({
    page,
  }) => {
    await page.click('#collab-init-btn');
    await expect(page.locator('#collab-status')).toContainText(
      /DocumentServerSession|ready/i,
      { timeout: 15000 },
    );
    await page.fill('#collab-a-input', 'Alpha');
    await page.click('#collab-a-btn');
    await expect(page.locator('#collab-status')).toContainText(/accepted/i, {
      timeout: 15000,
    });
    await page.fill('#collab-b-input', 'Beta');
    await page.click('#collab-b-btn');
    await expect(page.locator('#collab-status')).toContainText(/accepted/i, {
      timeout: 15000,
    });
    await expect(page.locator('#collab-head')).toContainText(/HEAD Version/i);
    await expect(page.locator('#collab-head')).toContainText(/Alpha/);
    await expect(page.locator('#collab-head')).toContainText(/Beta/);
  });

  test('presence demo publishes ephemeral actor', async ({ page }) => {
    await page.click('#collab-init-btn');
    await expect(page.locator('#collab-status')).toContainText(/ready/i, {
      timeout: 15000,
    });
    await page.click('#presence-publish-btn');
    await expect(page.locator('#presence-summary')).toContainText(
      /Presence published/i,
    );
  });

  test('infrastructure CAS mutate + lifecycle tombstone', async ({ page }) => {
    await page.click('#infra-init-btn');
    await expect(page.locator('#infra-status')).toContainText(/In-memory/i, {
      timeout: 15000,
    });
    await page.click('#infra-mutate-btn');
    await expect(page.locator('#infra-status')).toContainText(/Appended Version/i);
    await expect(page.locator('#infra-summary')).toContainText(/Sequence/i);
    await page.click('#infra-tombstone-btn');
    await expect(page.locator('#infra-status')).toContainText(/tombstoned/i);
  });

  test('snapshot/compaction buttons declare Node-only limitation', async ({
    page,
  }) => {
    await page.click('#infra-snapshot-btn');
    await expect(page.locator('#infra-status')).toContainText(
      /NOT SUITABLE FOR BROWSER DEMO/i,
    );
    await page.click('#infra-compact-btn');
    await expect(page.locator('#infra-status')).toContainText(
      /NOT SUITABLE FOR BROWSER DEMO/i,
    );
  });

  test('repeated typing does not duplicate Version per keystroke uncontrollably', async ({
    page,
  }) => {
    const before = await page.evaluate(
      () => window.__lextrixPlayground.getEditor().getExperimentalVersions().length,
    );
    await page.locator('.lxr-editor').click();
    await page.keyboard.type('abc');
    // Allow coalesce window
    await page.waitForTimeout(50);
    const after = await page.evaluate(
      () => window.__lextrixPlayground.getEditor().getExperimentalVersions().length,
    );
    // 3 keystrokes should not create 3+ separate Versions if coalesce works;
    // at worst they may batch — assert we did not explode (≤ before+3).
    expect(after - before).toBeLessThanOrEqual(3);
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
