import { describe, expect, it } from 'vitest';
import { PluginHost, type LextrixPlugin } from '../src/core/plugins/plugin-host.js';

describe('PluginHost', () => {
  it('registers and retrieves plugins by id', () => {
    const host = new PluginHost();
    const plugin: LextrixPlugin = {
      options: {},
      bindEditor: () => {},
    };
    host.register('keyboard', plugin);
    expect(host.get('keyboard')).toBe(plugin);
    expect(host.has('keyboard')).toBe(true);
  });

  it('exposes a theme.modules-compatible record', () => {
    const host = new PluginHost();
    const a: LextrixPlugin = { options: {}, bindEditor: () => {} };
    const b: LextrixPlugin = { options: {}, bindEditor: () => {} };
    host.register('clipboard', a);
    host.register('history', b);
    expect(host.asModuleRecord()).toEqual({ clipboard: a, history: b });
  });

  it('binds and unbinds all plugins', () => {
    const host = new PluginHost();
    let bound = 0;
    let unbound = 0;
    const editor = {} as import('../src/core/lextrix.js').default;
    host.register('a', {
      options: {},
      bindEditor: () => {
        bound += 1;
      },
      unbindEditor: () => {
        unbound += 1;
      },
    });
    host.bindAll(editor);
    host.unbindAll(editor);
    expect(bound).toBe(1);
    expect(unbound).toBe(1);
  });
});
