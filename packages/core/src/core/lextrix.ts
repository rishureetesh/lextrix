/** Lextrix core — document editor shell. */
import { merge } from 'lodash-es';
import * as Dom from 'lextrix-dom';
import type { ChangeOp } from 'lextrix-change';
import ChangeSet from 'lextrix-change';
import type { BlockEmbed } from '../blots/block.js';
import type Block from '../blots/block.js';
import type Scroll from '../blots/scroll.js';
import type {
  ClipboardModule,
  EditorCapabilities,
  HistoryModule,
  KeyboardModule,
  UploaderModule,
} from './contracts/modules.js';
import Editor from './editor.js';
import Emitter, {
  releaseDocumentListeners,
  retainDocumentListeners,
} from './emitter.js';
import type { EmitterSource } from './emitter.js';
import {
  InvalidContainerError,
  MissingBlotError,
  UnknownThemeError,
} from './errors.js';
import instances from './instances.js';
import logger from './logger.js';
import type { DebugLevel } from './logger.js';
import Module from './module.js';
import Selection, { Range } from './selection.js';
import type { Bounds } from './selection.js';
import Composition from './composition.js';
import Theme from './theme.js';
import type { ThemeConstructor } from './theme.js';
import { PluginHost } from './plugins/plugin-host.js';
import {
  SerializerHost,
  createDefaultSerializers,
  createSerializerRegistry,
  getGlobalSerializerRegistry,
  getMarkdownExportWarnings,
  type ContentSerializer,
  type ExportInput,
  type SafetyIssue,
  type SerializeFormat,
} from 'lextrix-serialize';
import scrollRectIntoView from './utils/scrollRectIntoView.js';
import type {
  Rect,
  ScrollRectIntoViewOptions,
} from './utils/scrollRectIntoView.js';
import createRegistryWithFormats from './utils/createRegistryWithFormats.js';
import {
  isBlotOrFormatPath,
  lxrPath,
  resolveImportKey,
} from '../registry-paths.js';
import {
  EditorDocumentBridge,
  type ExternalApplyResult,
} from './document-bridge/index.js';
import type {
  ChangeMeta,
  ChangeSource,
  ChangeProposal,
  Document as ExperimentalDocument,
  DocumentHandle,
  DocumentTransaction,
  AcceptProposalResult,
  TransactionCommitOptions,
} from 'lextrix-change/experimental';

const debug = logger('lextrix');

const globalRegistry = new Dom.Registry();
Dom.ParentBlot.uiClass = 'lxr-ui';

/**
 * Options for initializing a Lextrix instance
 */
export interface LextrixOptions {
  theme?: string;
  debug?: DebugLevel | boolean;
  registry?: Dom.Registry;
  /**
   * Whether to disable the editing
   * @default false
   */
  readOnly?: boolean;

  /**
   * Placeholder text to display when the editor is empty
   * @default ""
   */
  placeholder?: string;
  bounds?: HTMLElement | string | null;
  modules?: Record<string, unknown>;

  /**
   * A list of formats that are recognized and can exist within the editor contents.
   * `null` means all formats are allowed.
   * @default null
   */
  formats?: string[] | null;

  /**
   * Content serializers for import/export.
   * `true` or omitted registers built-in serializers (json, html, markdown, mdx).
   * Pass an array to register custom serializers only.
   * `false` disables serialization.
   */
  serializers?: ContentSerializer[] | boolean;

  /**
   * @experimental Phase 2: mirror settled editor changes into headless DocumentState.
   * Strategy B (editor-first). Default true. Set false to disable the bridge.
   */
  experimentalDocument?: boolean;
}

/**
 * Similar to LextrixOptions, but with all properties expanded to their default values,
 * and all selectors resolved to HTMLElements.
 */
export interface ExpandedLextrixOptions
  extends Omit<LextrixOptions, 'theme' | 'formats'> {
  theme: ThemeConstructor;
  registry: Dom.Registry;
  container: HTMLElement;
  modules: Record<string, unknown>;
  bounds?: HTMLElement | null;
  readOnly: boolean;
  serializers: ContentSerializer[] | false;
  experimentalDocument: boolean;
}

class Lextrix {
  static DEFAULTS = {
    bounds: null,
    modules: {
      clipboard: true,
      keyboard: true,
      history: true,
      uploader: true,
    },
    placeholder: '',
    readOnly: false,
    registry: globalRegistry,
    theme: 'default',
    experimentalDocument: true,
  } satisfies Partial<LextrixOptions>;
  static events = Emitter.events;
  static sources = Emitter.sources;
  static version = typeof LEXTRIX_VERSION === 'undefined' ? 'dev' : LEXTRIX_VERSION;

  static imports: Record<string, unknown> = {
    change: ChangeSet,
    dom: Dom,
    [lxrPath.core.module]: Module,
    [lxrPath.core.theme]: Theme,
  };

  static debug(limit: DebugLevel | boolean) {
    if (limit === true) {
      limit = 'log';
    }
    logger.level(limit);
  }

  static find(node: Node, bubble = false) {
    return instances.get(node) || globalRegistry.find(node, bubble);
  }

  static import(name: typeof lxrPath.core.module): typeof Module;
  static import(name: `lxr/themes/${string}`): typeof Theme;
  static import(name: 'dom'): typeof Dom;
  static import(name: 'change'): typeof ChangeSet;
  static import(name: string): unknown;
  static import(name: string) {
    const key = resolveImportKey(name);
    if (this.imports[key] == null) {
      debug.error(`Cannot import ${name}. Are you sure it was registered?`);
    }
    return this.imports[key];
  }

  static register(
    targets: Record<
      string,
      | Dom.RegistryDefinition
      | Record<string, unknown> // any objects
      | Theme
      | Module
      | Function // ES5 constructors
    >,
    overwrite?: boolean,
  ): void;
  static register(
    target: Dom.RegistryDefinition,
    overwrite?: boolean,
  ): void;
  static register(path: string, target: any, overwrite?: boolean): void;
  static register(...args: any[]): void {
    if (typeof args[0] !== 'string') {
      const target = args[0];
      const overwrite = !!args[1];

      const name = 'attrName' in target ? target.attrName : target.blotName;
      if (typeof name === 'string') {
        // Shortcut for formats:
        // register(Blot | Attributor, overwrite)
        this.register(lxrPath.format(name), target, overwrite);
      } else {
        Object.keys(target).forEach((key) => {
          this.register(resolveImportKey(key), target[key], overwrite);
        });
      }
    } else {
      const path = resolveImportKey(args[0]);
      const target = args[1];
      const overwrite = !!args[2];

      if (this.imports[path] != null && !overwrite) {
        debug.warn(`Overwriting ${path} with`, target);
      }
      this.imports[path] = target;
      if (
        isBlotOrFormatPath(path) &&
        target &&
        typeof target !== 'boolean' &&
        target.blotName !== 'abstract'
      ) {
        globalRegistry.register(target);
      }
      if (typeof target.register === 'function') {
        target.register(globalRegistry);
      }
    }
  }

  container: HTMLElement;
  root: HTMLDivElement;
  scroll: Scroll;
  emitter: Emitter;
  protected allowReadOnlyEdits: boolean;
  editor: Editor;
  composition: Composition;
  selection: Selection;

  theme: Theme;
  pluginHost: PluginHost;
  serializerHost: SerializerHost;
  keyboard: KeyboardModule;
  clipboard: ClipboardModule;
  history: HistoryModule;
  uploader: UploaderModule;

  options: ExpandedLextrixOptions;
  private destroyed = false;
  /**
   * @experimental Phase 2 Strategy B bridge (editor → Document).
   * Null when `experimentalDocument: false`.
   */
  private documentBridge: EditorDocumentBridge | null = null;

  constructor(container: HTMLElement | string, options: LextrixOptions = {}) {
    this.options = expandConfig(container, options);
    this.container = this.options.container;
    if (this.container == null) {
      debug.error('Invalid Lextrix container', container);
      throw new InvalidContainerError();
    }
    if (this.options.debug) {
      Lextrix.debug(this.options.debug);
    }
    const html = this.container.innerHTML.trim();
    this.container.classList.add('lxr-container');
    this.container.innerHTML = '';
    instances.set(this.container, this);
    retainDocumentListeners();
    this.root = this.addContainer('lxr-editor');
    this.root.classList.add('lxr-blank');
    this.emitter = new Emitter();
    const scrollBlotName = Dom.ScrollBlot.blotName;
    const ScrollBlot = this.options.registry.query(scrollBlotName);
    if (!ScrollBlot || !('blotName' in ScrollBlot)) {
      releaseDocumentListeners();
      instances.delete(this.container);
      throw new MissingBlotError(scrollBlotName);
    }
    this.scroll = new ScrollBlot(this.options.registry, this.root, {
      emitter: this.emitter,
    }) as Scroll;
    this.editor = new Editor(this.scroll);
    if (this.options.experimentalDocument) {
      this.documentBridge = new EditorDocumentBridge(this.editor.changeSet);
    }
    this.selection = new Selection(this.scroll, this.emitter);
    this.composition = new Composition(this.scroll, this.emitter);
    this.pluginHost = new PluginHost();
    this.serializerHost = this.createSerializerHost();
    this.theme = new this.options.theme(this, this.options); // eslint-disable-line new-cap
    this.keyboard = this.theme.addModule('keyboard');
    this.clipboard = this.theme.addModule('clipboard');
    this.history = this.theme.addModule('history');
    this.uploader = this.theme.addModule('uploader');
    this.theme.addModule('input');
    this.theme.addModule('uiNode');
    this.theme.init();
    this.pluginHost.bindAll(this);
    this.serializerHost.setAdapter(this.createSerializerAdapter());
    this.emitter.on(Emitter.events.EDITOR_CHANGE, (type) => {
      if (type === Emitter.events.TEXT_CHANGE) {
        this.root.classList.toggle('lxr-blank', this.editor.isBlank());
      }
    });
    this.emitter.on(Emitter.events.SCROLL_UPDATE, (source, mutations) => {
      const oldRange = this.selection.lastRange;
      const [newRange] = this.selection.getRange();
      const selectionInfo =
        oldRange && newRange ? { oldRange, newRange } : undefined;
      modify.call(
        this,
        () => this.editor.update(null, mutations, selectionInfo),
        source,
      );
    });
    this.emitter.on(Emitter.events.SCROLL_EMBED_UPDATE, (blot, delta) => {
      const oldRange = this.selection.lastRange;
      const [newRange] = this.selection.getRange();
      const selectionInfo =
        oldRange && newRange ? { oldRange, newRange } : undefined;
      modify.call(
        this,
        () => {
          const change = new ChangeSet()
            .retain(blot.offset(this))
            .retain({ [blot.statics.blotName]: delta });
          return this.editor.update(change, [], selectionInfo);
        },
        Lextrix.sources.USER,
      );
    });
    if (html) {
      const contents = this.clipboard.convert({
        html: `${html}<p><br></p>`,
        text: '\n',
      });
      this.setContents(contents);
    }
    this.history.clear();
    if (this.options.placeholder) {
      this.root.setAttribute('data-placeholder', this.options.placeholder);
    }
    if (this.options.readOnly) {
      this.disable();
    }
    this.allowReadOnlyEdits = false;
  }

  addContainer(container: string, refNode?: Node | null): HTMLDivElement;
  addContainer(container: HTMLElement, refNode?: Node | null): HTMLElement;
  addContainer(
    container: string | HTMLElement,
    refNode: Node | null = null,
  ): HTMLDivElement | HTMLElement {
    if (typeof container === 'string') {
      const className = container;
      container = document.createElement('div');
      container.classList.add(className);
    }
    this.container.insertBefore(container, refNode);
    return container;
  }

  blur() {
    this.selection.setRange(null);
  }

  deleteText(range: Range, source?: EmitterSource): ChangeSet;
  deleteText(index: number, length: number, source?: EmitterSource): ChangeSet;
  deleteText(
    index: number | Range,
    length?: number | EmitterSource,
    source?: EmitterSource,
  ): ChangeSet {
    // @ts-expect-error
    [index, length, , source] = overload(index, length, source);
    return modify.call(
      this,
      () => {
        return this.editor.deleteText(index, length);
      },
      source,
      index,
      -1 * length,
    );
  }

  disable() {
    this.enable(false);
  }

  editReadOnly<T>(modifier: () => T): T {
    this.allowReadOnlyEdits = true;
    const value = modifier();
    this.allowReadOnlyEdits = false;
    return value;
  }

  enable(enabled = true) {
    this.scroll.enable(enabled);
    this.container.classList.toggle('lxr-disabled', !enabled);
  }

  focus(options: { preventScroll?: boolean } = {}) {
    this.selection.focus();
    if (!options.preventScroll) {
      this.scrollSelectionIntoView();
    }
  }

  format(
    name: string,
    value: unknown,
    source: EmitterSource = Emitter.sources.API,
  ): ChangeSet {
    return modify.call(
      this,
      () => {
        const range = this.getSelection(true);
        let change = new ChangeSet();
        if (range == null) return change;
        if (this.scroll.query(name, Dom.Scope.BLOCK)) {
          change = this.editor.formatLine(range.index, range.length, {
            [name]: value,
          });
        } else if (range.length === 0) {
          this.selection.format(name, value);
          return change;
        } else {
          change = this.editor.formatText(range.index, range.length, {
            [name]: value,
          });
        }
        this.setSelection(range, Emitter.sources.SILENT);
        return change;
      },
      source,
    );
  }

  formatLine(
    index: number,
    length: number,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): ChangeSet;
  formatLine(
    index: number,
    length: number,
    name: string,
    value?: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  formatLine(
    index: number,
    length: number,
    name: string | Record<string, unknown>,
    value?: unknown | EmitterSource,
    source?: EmitterSource,
  ): ChangeSet {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    [index, length, formats, source] = overload(
      index,
      length,
      // @ts-expect-error
      name,
      value,
      source,
    );
    return modify.call(
      this,
      () => {
        return this.editor.formatLine(index, length, formats);
      },
      source,
      index,
      0,
    );
  }

  formatText(
    range: Range,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  formatText(
    index: number,
    length: number,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  formatText(
    index: number,
    length: number,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): ChangeSet;
  formatText(
    index: number | Range,
    length: number | string,
    name: string | unknown,
    value?: unknown | EmitterSource,
    source?: EmitterSource,
  ): ChangeSet {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    [index, length, formats, source] = overload(
      // @ts-expect-error
      index,
      length,
      name,
      value,
      source,
    );
    return modify.call(
      this,
      () => {
        return this.editor.formatText(index, length, formats);
      },
      source,
      index,
      0,
    );
  }

  getBounds(index: number | Range, length = 0): Bounds | null {
    let bounds: Bounds | null = null;
    if (typeof index === 'number') {
      bounds = this.selection.getBounds(index, length);
    } else {
      bounds = this.selection.getBounds(index.index, index.length);
    }
    if (!bounds) return null;
    const containerBounds = this.container.getBoundingClientRect();
    return {
      bottom: bounds.bottom - containerBounds.top,
      height: bounds.height,
      left: bounds.left - containerBounds.left,
      right: bounds.right - containerBounds.left,
      top: bounds.top - containerBounds.top,
      width: bounds.width,
    };
  }

  getContents(index = 0, length = this.getLength() - index) {
    [index, length] = overload(index, length);
    return this.editor.getContents(index, length);
  }

  getFormat(index?: number, length?: number): { [format: string]: unknown };
  getFormat(range?: Range): {
    [format: string]: unknown;
  };
  getFormat(
    index: Range | number = this.getSelection(true),
    length = 0,
  ): { [format: string]: unknown } {
    if (typeof index === 'number') {
      return this.editor.getFormat(index, length);
    }
    return this.editor.getFormat(index.index, index.length);
  }

  getIndex(blot: Dom.Blot) {
    return blot.offset(this.scroll);
  }

  getLength() {
    return this.scroll.length();
  }

  getLeaf(index: number) {
    return this.scroll.leaf(index);
  }

  getLine(index: number) {
    return this.scroll.line(index);
  }

  getLines(range: Range): (Block | BlockEmbed)[];
  getLines(index?: number, length?: number): (Block | BlockEmbed)[];
  getLines(
    index: Range | number = 0,
    length = Number.MAX_VALUE,
  ): (Block | BlockEmbed)[] {
    if (typeof index !== 'number') {
      return this.scroll.lines(index.index, index.length);
    }
    return this.scroll.lines(index, length);
  }

  getModule(name: string) {
    return this.pluginHost.get(name);
  }

  /**
   * @experimental Phase 2 — headless DocumentState mirrored from the editor (Strategy B).
   * Returns null when `experimentalDocument: false`.
   */
  getExperimentalDocument(): ExperimentalDocument | null {
    return this.documentBridge?.getDocument() ?? null;
  }

  /**
   * @experimental Phase 3 — current mirrored Document Version (linear history head).
   */
  getExperimentalVersion() {
    return this.documentBridge?.currentVersion() ?? null;
  }

  /**
   * @experimental Phase 3 — retained linear versions for the mirrored Document.
   */
  getExperimentalVersions() {
    return this.documentBridge?.listVersions() ?? [];
  }

  /**
   * @experimental Begin a transaction against the mirrored DocumentState.
   * Commit produces a ChangeSet; use {@link experimentalCommit} to apply via the editor.
   */
  experimentalTransaction(): DocumentTransaction {
    if (!this.documentBridge) {
      throw new Error(
        'experimentalTransaction requires experimentalDocument: true',
      );
    }
    return this.documentBridge.getHandle().transaction();
  }

  /**
   * @experimental Build a ChangeSet via transaction against the mirrored Document,
   * then apply through the existing editor path (`updateContents`).
   * Document is updated by the Strategy B reconcile hook using the settled change.
   */
  experimentalCommit(
    build: (tx: DocumentTransaction) => void,
    options: TransactionCommitOptions = {},
  ): ChangeSet {
    if (!this.documentBridge) {
      throw new Error('experimentalCommit requires experimentalDocument: true');
    }
    const handle = this.documentBridge.getHandle();
    const tx = handle.transaction();
    try {
      build(tx);
      const { change, meta, empty } = tx.commit(options);
      if (empty) {
        return change;
      }
      return this.updateContents(
        change,
        mapChangeSourceToEmitter(meta.source),
      );
    } catch (err) {
      if (tx.getStatus() === 'open') {
        tx.abort();
      }
      throw err;
    }
  }

  /**
   * @experimental Hybrid Strategy B+ (ADR-008): Document.apply first, then
   * project into the editor via updateContents. Bridge reconcile is skipped
   * while projecting. History is transformed (not recorded as user undo).
   * Projection failure does not roll back Document; full resync is attempted.
   */
  applyExternalChange(
    change: ChangeSet | ChangeOp[],
    options: { meta?: Partial<ChangeMeta> } = {},
  ): ExternalApplyResult {
    if (!this.documentBridge) {
      throw new Error(
        'applyExternalChange requires experimentalDocument: true',
      );
    }
    const delta = new ChangeSet(change);
    const bridge = this.documentBridge;
    const history = this.history as HistoryModule & {
      ignoreChange?: boolean;
      transform?: (d: ChangeSet) => void;
    };
    const prevIgnore = history.ignoreChange ?? false;

    return bridge.applyExternalChange(delta, {
      meta: options.meta,
      getEditorContents: () => this.getContents(),
      project: (applied) => {
        history.ignoreChange = true;
        try {
          this.updateContents(applied, Emitter.sources.SILENT);
        } finally {
          history.ignoreChange = prevIgnore;
        }
        history.transform?.(applied);
      },
      resync: (documentContents) => {
        history.ignoreChange = true;
        try {
          this.setContents(documentContents, Emitter.sources.SILENT);
        } finally {
          history.ignoreChange = prevIgnore;
        }
      },
    });
  }

  /**
   * @experimental Access the mirrored DocumentHandle for review / proposals.
   * Prefer review helpers from `lextrix-intelligence`; mutate only via
   * acceptProposal / applyExternalChange / acceptProposalAndProject.
   */
  getExperimentalHandle(): DocumentHandle | null {
    return this.documentBridge?.getHandle() ?? null;
  }

  /**
   * @experimental Project a ChangeSet that already applied to Document
   * (e.g. after DocumentHandle.acceptProposal). Does not re-apply.
   */
  projectAppliedChange(
    change: ChangeSet | ChangeOp[],
  ): ExternalApplyResult {
    if (!this.documentBridge) {
      throw new Error(
        'projectAppliedChange requires experimentalDocument: true',
      );
    }
    const delta = new ChangeSet(change);
    const bridge = this.documentBridge;
    const history = this.history as HistoryModule & {
      ignoreChange?: boolean;
      transform?: (d: ChangeSet) => void;
    };
    const prevIgnore = history.ignoreChange ?? false;

    return bridge.projectAppliedChange(delta, {
      getEditorContents: () => this.getContents(),
      project: (applied) => {
        history.ignoreChange = true;
        try {
          this.updateContents(applied, Emitter.sources.SILENT);
        } finally {
          history.ignoreChange = prevIgnore;
        }
        history.transform?.(applied);
      },
      resync: (documentContents) => {
        history.ignoreChange = true;
        try {
          this.setContents(documentContents, Emitter.sources.SILENT);
        } finally {
          history.ignoreChange = prevIgnore;
        }
      },
    });
  }

  /**
   * @experimental Accept a ChangeProposal on the mirrored Document, then
   * project into the editor (Hybrid B+). Does not auto-rebase.
   * Application should create a ProposalReview / acknowledge policy first
   * via `lextrix-intelligence` — this method is the Document→Editor path only.
   */
  acceptProposalAndProject(
    proposal: ChangeProposal,
  ): AcceptProposalResult & { projection: ExternalApplyResult } {
    if (!this.documentBridge) {
      throw new Error(
        'acceptProposalAndProject requires experimentalDocument: true',
      );
    }
    const handle = this.documentBridge.getHandle();
    const accepted = handle.acceptProposal(proposal);
    if (accepted.empty) {
      return {
        ...accepted,
        projection: {
          status: 'empty',
          version: accepted.version,
          applied: proposal.change,
          desynchronized: false,
        },
      };
    }
    const projection = this.projectAppliedChange(proposal.change);
    return { ...accepted, projection };
  }

  /** @experimental Projection nesting depth (0 when idle). */
  getProjectionDepth(): number {
    return this.documentBridge?.getProjectionDepth() ?? 0;
  }

  /** @experimental True while Document→Editor projection is active. */
  isProjecting(): boolean {
    return this.documentBridge?.isProjecting() ?? false;
  }

  /**
   * Tear down this editor instance: destroy all plugins, theme listeners,
   * document routing, and editor DOM inside the mount container.
   * Safe to call multiple times.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.pluginHost.destroyAll(this);

    const theme = this.theme as { destroy?: () => void };
    theme?.destroy?.();

    this.emitter.clearDOMListeners();
    this.emitter.removeAllListeners();
    instances.delete(this.container);
    releaseDocumentListeners();
    this.container.replaceChildren();
  }

  /**
   * Probe optional runtimes and installed modules (consistent degradation policy).
   */
  getCapabilities(): EditorCapabilities {
    const win = typeof window !== 'undefined' ? window : undefined;
    return {
      katex: Boolean(win && (win as Window & { katex?: unknown }).katex),
      highlightJs: Boolean(win && (win as Window & { hljs?: unknown }).hljs),
      imageResize: this.pluginHost.has('imageResize'),
      serializers:
        this.options.serializers === false
          ? []
          : this.serializerHost.listFormats(),
    };
  }

  /**
   * Warnings for markdown/MDX export (lossy formats, native tables). Does not throw.
   * Call before exportContent('markdown'|'mdx') to show users what will be lost.
   */
  getExportWarnings(input: ExportInput): SafetyIssue[] {
    const options = typeof input === 'string' ? { format: input } : input;
    if (options.format !== 'markdown' && options.format !== 'mdx') {
      return [];
    }
    const index = options.index ?? 0;
    const length =
      options.length ?? Math.max(0, this.getLength() - Math.max(0, index));
    return getMarkdownExportWarnings(this.getContents(index, length));
  }

  getSelection(focus: true): Range;
  getSelection(focus?: boolean): Range | null;
  getSelection(focus = false): Range | null {
    if (focus) this.focus();
    this.update(); // Make sure we access getRange with editor in consistent state
    return this.selection.getRange()[0];
  }

  getSemanticHTML(range: Range): string;
  getSemanticHTML(index?: number, length?: number): string;
  getSemanticHTML(index: Range | number = 0, length?: number) {
    if (typeof index === 'number') {
      length = length ?? this.getLength() - index;
    }
    // @ts-expect-error
    [index, length] = overload(index, length);
    return this.editor.getHTML(index, length);
  }

  /**
   * @deprecated Prefer {@link exportContent}. Kept for compatibility.
   * Export document content to a registered serialization format.
   *
   * HTML export is editor-bound (uses clipboard/DOM). For headless
   * ChangeSet→string conversion use `serializerHost.stringify()`.
   */
  export(input: ExportInput): string {
    return this.serializerHost.export(input);
  }

  /**
   * @deprecated Prefer {@link importContent}. Kept for compatibility.
   * Import document content from a registered serialization format.
   * Replaces the current document contents.
   */
  import(
    content: string,
    format: SerializeFormat,
    source: EmitterSource = Emitter.sources.API,
  ): ChangeSet {
    const delta = this.serializerHost.import(content, format);
    this.setContents(delta, source);
    return delta;
  }

  /**
   * Preferred content import API (avoids confusion with static `Lextrix.import()`).
   */
  importContent(
    content: string,
    format: SerializeFormat,
    source: EmitterSource = Emitter.sources.API,
  ): ChangeSet {
    return this.import(content, format, source);
  }

  /**
   * Preferred content export API.
   * HTML is editor-bound; markdown/mdx/json can also be done headlessly via stringify.
   */
  exportContent(input: ExportInput): string {
    return this.export(input);
  }

  /** List serialization formats registered for this editor instance. */
  listExportFormats(): SerializeFormat[] {
    return this.serializerHost.listFormats();
  }

  getText(range?: Range): string;
  getText(index?: number, length?: number): string;
  getText(index: Range | number = 0, length?: number): string {
    if (typeof index === 'number') {
      length = length ?? this.getLength() - index;
    }
    // @ts-expect-error
    [index, length] = overload(index, length);
    return this.editor.getText(index, length);
  }

  hasFocus() {
    return this.selection.hasFocus();
  }

  insertEmbed(
    index: number,
    embed: string,
    value: unknown,
    source: EmitterSource = Lextrix.sources.API,
  ): ChangeSet {
    return modify.call(
      this,
      () => {
        return this.editor.insertEmbed(index, embed, value);
      },
      source,
      index,
    );
  }

  insertText(index: number, text: string, source?: EmitterSource): ChangeSet;
  insertText(
    index: number,
    text: string,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): ChangeSet;
  insertText(
    index: number,
    text: string,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  insertText(
    index: number,
    text: string,
    name?: string | Record<string, unknown> | EmitterSource,
    value?: unknown,
    source?: EmitterSource,
  ): ChangeSet {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    // @ts-expect-error
    [index, , formats, source] = overload(index, 0, name, value, source);
    return modify.call(
      this,
      () => {
        return this.editor.insertText(index, text, formats);
      },
      source,
      index,
      text.length,
    );
  }

  isEnabled() {
    return this.scroll.isEnabled();
  }

  off(...args: Parameters<(typeof Emitter)['prototype']['off']>) {
    return this.emitter.off(...args);
  }

  on(
    event: (typeof Emitter)['events']['TEXT_CHANGE'],
    handler: (delta: ChangeSet, oldContent: ChangeSet, source: EmitterSource) => void,
  ): Emitter;
  on(
    event: (typeof Emitter)['events']['SELECTION_CHANGE'],
    handler: (range: Range, oldRange: Range, source: EmitterSource) => void,
  ): Emitter;
  on(
    event: (typeof Emitter)['events']['EDITOR_CHANGE'],
    handler: (
      ...args:
        | [
            (typeof Emitter)['events']['TEXT_CHANGE'],
            ChangeSet,
            ChangeSet,
            EmitterSource,
          ]
        | [
            (typeof Emitter)['events']['SELECTION_CHANGE'],
            Range,
            Range,
            EmitterSource,
          ]
    ) => void,
  ): Emitter;
  on(event: string, ...args: unknown[]): Emitter;
  on(...args: Parameters<(typeof Emitter)['prototype']['on']>): Emitter {
    return this.emitter.on(...args);
  }

  once(...args: Parameters<(typeof Emitter)['prototype']['once']>) {
    return this.emitter.once(...args);
  }

  removeFormat(index: number, length: number, source?: EmitterSource): ChangeSet {
    [index, length, , source] = overload(index, length, source);
    return modify.call(
      this,
      () => {
        return this.editor.removeFormat(index, length);
      },
      source,
      index,
    );
  }

  scrollRectIntoView(rect: Rect, options: ScrollRectIntoViewOptions = {}) {
    scrollRectIntoView(this.root, rect, options);
  }

  /**
   * @deprecated Use Lextrix#scrollSelectionIntoView() instead.
   */
  scrollIntoView() {
    console.warn(
      'Lextrix#scrollIntoView() has been deprecated and will be removed in the near future. Please use Lextrix#scrollSelectionIntoView() instead.',
    );
    this.scrollSelectionIntoView();
  }

  /**
   * Scroll the current selection into the visible area.
   * If the selection is already visible, no scrolling will occur.
   */
  scrollSelectionIntoView(options: ScrollRectIntoViewOptions = {}) {
    const range = this.selection.lastRange;
    const bounds = range && this.selection.getBounds(range.index, range.length);
    if (bounds) {
      this.scrollRectIntoView(bounds, options);
    }
  }

  setContents(
    delta: ChangeSet | ChangeOp[],
    source: EmitterSource = Emitter.sources.API,
  ): ChangeSet {
    return modify.call(
      this,
      () => {
        delta = new ChangeSet(delta);
        const length = this.getLength();
        // Lextrix will set empty editor to \n
        const delete1 = this.editor.deleteText(0, length);
        const applied = this.editor.insertContents(0, delta);
        // Remove extra \n from empty editor initialization
        const delete2 = this.editor.deleteText(this.getLength() - 1, 1);
        return delete1.compose(applied).compose(delete2);
      },
      source,
    );
  }
  setSelection(range: Range | null, source?: EmitterSource): void;
  setSelection(index: number, source?: EmitterSource): void;
  setSelection(index: number, length?: number, source?: EmitterSource): void;
  setSelection(index: number, source?: EmitterSource): void;
  setSelection(
    index: Range | null | number,
    length?: EmitterSource | number,
    source?: EmitterSource,
  ): void {
    if (index == null) {
      // @ts-expect-error https://github.com/microsoft/TypeScript/issues/22609
      this.selection.setRange(null, length || Lextrix.sources.API);
    } else {
      // @ts-expect-error
      [index, length, , source] = overload(index, length, source);
      this.selection.setRange(new Range(Math.max(0, index), length), source);
      if (source !== Emitter.sources.SILENT) {
        this.scrollSelectionIntoView();
      }
    }
  }

  setText(text: string, source: EmitterSource = Emitter.sources.API) {
    const delta = new ChangeSet().insert(text);
    return this.setContents(delta, source);
  }

  update(source: EmitterSource = Emitter.sources.USER) {
    const change = this.scroll.update(source); // Will update selection before selection.update() does if text changes
    this.selection.update(source);
    // TODO this is usually undefined
    return change;
  }

  updateContents(
    delta: ChangeSet | ChangeOp[],
    source: EmitterSource = Emitter.sources.API,
  ): ChangeSet {
    return modify.call(
      this,
      () => {
        delta = new ChangeSet(delta);
        return this.editor.applyChangeSet(delta);
      },
      source,
      true,
    );
  }

  private createSerializerHost(): SerializerHost {
    const serializers = this.options.serializers;
    const registry = createSerializerRegistry(
      serializers === false ? [] : serializers,
    );
    if (serializers !== false) {
      registry.mergeFrom(getGlobalSerializerRegistry());
    }
    return new SerializerHost(registry);
  }

  private createSerializerAdapter() {
    return {
      getChangeSet: (index = 0, length?: number) => {
        const resolvedLength = length ?? this.getLength() - index;
        return this.getContents(index, resolvedLength);
      },
      setChangeSet: (delta: ChangeSet) => {
        this.setContents(delta);
      },
      convertHtml: (html: string) => {
        return this.clipboard.convert({ html, text: '' });
      },
      exportHtml: (index = 0, length?: number) => {
        const resolvedLength = length ?? this.getLength() - index;
        return this.getSemanticHTML(index, resolvedLength);
      },
    };
  }
}

function resolveSelector(selector: string | HTMLElement | null | undefined) {
  return typeof selector === 'string'
    ? document.querySelector<HTMLElement>(selector)
    : selector;
}

function expandModuleConfig(config: Record<string, unknown> | undefined) {
  return Object.entries(config ?? {}).reduce(
    (expanded, [key, value]) => ({
      ...expanded,
      [key]: value === true ? {} : value,
    }),
    {} as Record<string, unknown>,
  );
}

function omitUndefinedValuesFromOptions(obj: LextrixOptions) {
  return Object.fromEntries(
    Object.entries(obj).filter((entry) => entry[1] !== undefined),
  );
}

function expandConfig(
  containerOrSelector: HTMLElement | string,
  options: LextrixOptions,
): ExpandedLextrixOptions {
  const container = resolveSelector(containerOrSelector);
  if (!container) {
    throw new InvalidContainerError();
  }

  const themeName = options.theme;
  const shouldUseDefaultTheme =
    !themeName || themeName === Lextrix.DEFAULTS.theme;
  const theme: ThemeConstructor = shouldUseDefaultTheme
    ? Theme
    : (Lextrix.import(
        lxrPath.theme(themeName) as `lxr/themes/${string}`,
      ) as ThemeConstructor);
  if (!theme) {
    throw new UnknownThemeError(String(options.theme));
  }

  const { modules: lextrixModuleDefaults, ...lextrixDefaults } = Lextrix.DEFAULTS;
  const { modules: themeModuleDefaults, ...themeDefaults } = theme.DEFAULTS;

  let userModuleOptions = expandModuleConfig(options.modules);
  // Special case toolbar shorthand
  if (
    userModuleOptions != null &&
    userModuleOptions.toolbar &&
    userModuleOptions.toolbar.constructor !== Object
  ) {
    userModuleOptions = {
      ...userModuleOptions,
      toolbar: { container: userModuleOptions.toolbar },
    };
  }

  const modules: ExpandedLextrixOptions['modules'] = merge(
    {},
    expandModuleConfig(lextrixModuleDefaults),
    expandModuleConfig(themeModuleDefaults),
    userModuleOptions,
  );

  const config = {
    ...lextrixDefaults,
    ...omitUndefinedValuesFromOptions(themeDefaults),
    ...omitUndefinedValuesFromOptions(options),
  };

  let registry = options.registry;
  if (registry) {
    if (options.formats) {
      debug.warn('Ignoring "formats" option because "registry" is specified');
    }
  } else {
    registry = options.formats
      ? createRegistryWithFormats(options.formats, config.registry, debug)
      : config.registry;
  }

  return {
    ...config,
    registry,
    container,
    theme,
    modules: Object.entries(modules).reduce(
      (modulesWithDefaults, [name, value]) => {
        if (!value) return modulesWithDefaults;

        const moduleClass = Lextrix.import(lxrPath.module(name));
        if (moduleClass == null) {
          debug.error(
            `Cannot load ${name} module. Are you sure you registered it?`,
          );
          return modulesWithDefaults;
        }
        return {
          ...modulesWithDefaults,
          // @ts-expect-error
          [name]: merge({}, moduleClass.DEFAULTS || {}, value),
        };
      },
      {},
    ),
    bounds: resolveSelector(config.bounds),
    serializers: resolveSerializersOption(options.serializers),
    experimentalDocument: config.experimentalDocument !== false,
  };
}

function resolveSerializersOption(
  serializers: LextrixOptions['serializers'],
): ExpandedLextrixOptions['serializers'] {
  if (serializers === false) return false;
  if (Array.isArray(serializers)) return serializers;
  return createDefaultSerializers();
}

// Handle selection preservation and TEXT_CHANGE emission
// common to modification APIs
function modify(
  modifier: () => ChangeSet,
  source: EmitterSource,
  index: number | boolean,
  shift: number | null,
) {
  if (
    !this.isEnabled() &&
    source === Emitter.sources.USER &&
    !this.allowReadOnlyEdits
  ) {
    return new ChangeSet();
  }
  let range = index == null ? null : this.getSelection();
  const oldChangeSet = this.editor.changeSet;
  const change = modifier();
  if (range != null) {
    if (index === true) {
      index = range.index; // eslint-disable-line prefer-destructuring
    }
    if (shift == null) {
      range = shiftRange(range, change, source);
    } else if (shift !== 0) {
      // @ts-expect-error index should always be number
      range = shiftRange(range, index, shift, source);
    }
    this.setSelection(range, Emitter.sources.SILENT);
  }
  if (change.length() > 0) {
    // Strategy B: one-way Editor → Document reconcile (settled change only).
    this.documentBridge?.reconcileEditorChange(change, {
      emitterSource: source,
      liveContents: this.editor.changeSet,
    });
    const args = [Emitter.events.TEXT_CHANGE, change, oldChangeSet, source];
    this.emitter.emit(Emitter.events.EDITOR_CHANGE, ...args);
    if (source !== Emitter.sources.SILENT) {
      this.emitter.emit(...args);
    }
  }
  return change;
}

function mapChangeSourceToEmitter(source: ChangeSource): EmitterSource {
  if (source === 'user') return Emitter.sources.USER;
  if (source === 'silent' || source === 'projection') {
    return Emitter.sources.SILENT;
  }
  return Emitter.sources.API;
}

type NormalizedIndexLength = [
  number,
  number,
  Record<string, unknown>,
  EmitterSource,
];
function overload(index: number, source?: EmitterSource): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  format: string,
  value: unknown,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  format: Record<string, unknown>,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(range: Range, source?: EmitterSource): NormalizedIndexLength;
function overload(
  range: Range,
  format: string,
  value: unknown,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  range: Range,
  format: Record<string, unknown>,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: Range | number,
  length?: number | string | Record<string, unknown> | EmitterSource,
  name?: string | unknown | Record<string, unknown> | EmitterSource,
  value?: unknown | EmitterSource,
  source?: EmitterSource,
): NormalizedIndexLength {
  let formats: Record<string, unknown> = {};
  // @ts-expect-error
  if (typeof index.index === 'number' && typeof index.length === 'number') {
    // Allow for throwaway end (used by insertText/insertEmbed)
    if (typeof length !== 'number') {
      // @ts-expect-error
      source = value;
      value = name;
      name = length;
      // @ts-expect-error
      length = index.length; // eslint-disable-line prefer-destructuring
      // @ts-expect-error
      index = index.index; // eslint-disable-line prefer-destructuring
    } else {
      // @ts-expect-error
      length = index.length; // eslint-disable-line prefer-destructuring
      // @ts-expect-error
      index = index.index; // eslint-disable-line prefer-destructuring
    }
  } else if (typeof length !== 'number') {
    // @ts-expect-error
    source = value;
    value = name;
    name = length;
    length = 0;
  }
  // Handle format being object, two format name/value strings or excluded
  if (typeof name === 'object') {
    // @ts-expect-error Fix me later
    formats = name;
    // @ts-expect-error
    source = value;
  } else if (typeof name === 'string') {
    if (value != null) {
      formats[name] = value;
    } else {
      // @ts-expect-error
      source = name;
    }
  }
  // Handle optional source
  source = source || Emitter.sources.API;
  // @ts-expect-error
  return [index, length, formats, source];
}

function shiftRange(range: Range, change: ChangeSet, source?: EmitterSource): Range;
function shiftRange(
  range: Range,
  index: number,
  length?: number,
  source?: EmitterSource,
): Range;
function shiftRange(
  range: Range,
  index: number | ChangeSet,
  lengthOrSource?: number | EmitterSource,
  source?: EmitterSource,
) {
  const length = typeof lengthOrSource === 'number' ? lengthOrSource : 0;
  if (range == null) return null;
  let start;
  let end;
  // @ts-expect-error -- TODO: add a better type guard around `index`
  if (index && typeof index.transformPosition === 'function') {
    [start, end] = [range.index, range.index + range.length].map((pos) =>
      // @ts-expect-error -- TODO: add a better type guard around `index`
      index.transformPosition(pos, source !== Emitter.sources.USER),
    );
  } else {
    [start, end] = [range.index, range.index + range.length].map((pos) => {
      // @ts-expect-error -- TODO: add a better type guard around `index`
      if (pos < index || (pos === index && source === Emitter.sources.USER))
        return pos;
      if (length >= 0) {
        return pos + length;
      }
      // @ts-expect-error -- TODO: add a better type guard around `index`
      return Math.max(index, pos + length);
    });
  }
  return new Range(start, end - start);
}

export type { Bounds, DebugLevel, EmitterSource };
export { Dom, Range };

export { globalRegistry, expandConfig, overload, Lextrix as default };
