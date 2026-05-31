import Lextron, { globalRegistry, registerBlots } from 'lextron-core';
import { registerFormats } from 'lextron-formats';
import { describe, expect, test, vitest, beforeAll } from 'vitest';
import createRegistryWithFormats from 'lextron-core/core/utils/createRegistryWithFormats.js';
import logger from 'lextron-core/core/logger.js';
import { Registry } from 'lextron-dom';
import Inline from 'lextron-core/blots/inline.js';
import Container from 'lextron-core/blots/container.js';

const debug = logger('test');

beforeAll(() => {
  registerBlots(Lextron);
  registerFormats(Lextron);
});

describe('createRegistryWithFormats', () => {
  test('register core formats', () => {
    const registry = createRegistryWithFormats([], globalRegistry, debug);
    expect(registry.query('cursor')).toBeTruthy();
    expect(registry.query('bold')).toBeFalsy();
  });

  test('register specified formats', () => {
    const registry = createRegistryWithFormats(['bold'], globalRegistry, debug);
    expect(registry.query('cursor')).toBeTruthy();
    expect(registry.query('bold')).toBeTruthy();
  });

  test('register required container', () => {
    const sourceRegistry = new Registry();

    class RequiredContainer extends Container {
      static blotName = 'my-required-container';
    }

    class MyInline extends Inline {
      static requiredContainer = RequiredContainer;
      static blotName = 'my-inline';
    }

    sourceRegistry.register(RequiredContainer);
    sourceRegistry.register(MyInline);

    const registry = createRegistryWithFormats(
      ['my-inline'],
      sourceRegistry,
      debug,
    );
    expect(registry.query('my-inline')).toBeTruthy();
    expect(registry.query('my-required-container')).toBeTruthy();
  });

  test('warn on missing format', () => {
    const error = vitest.spyOn(debug, 'error');
    createRegistryWithFormats(['missing-format'], globalRegistry, debug);
    expect(error).toHaveBeenCalled();
  });
});
