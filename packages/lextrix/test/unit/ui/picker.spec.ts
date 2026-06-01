import { describe, expect, test } from 'vitest';
import Picker from 'lextrix-ui/ui/picker.js';

describe('Picker', () => {
  const setup = () => {
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML =
      '<select><option selected>0</option><option value="1">1</option></select>';
    const pickerSelectorInstance = new Picker(
      container.firstChild as HTMLSelectElement,
    );
    const pickerSelector = container.querySelector('.lxr-picker') as HTMLElement;
    return { container, pickerSelectorInstance, pickerSelector };
  };

  test('initialization', () => {
    const { container } = setup();
    expect(container.querySelector('.lxr-picker')).toBeTruthy();
    expect(container.querySelector('.lxr-active')).toBeFalsy();
    expect(
      container.querySelector('.lxr-picker-item.lxr-selected')?.outerHTML,
    ).toEqualHTML(
      '<span tabindex="0" role="button" class="lxr-picker-item lxr-selected" data-label="0"></span>',
    );
    expect(
      container.querySelector('.lxr-picker-item:not(.lxr-selected)')?.outerHTML,
    ).toEqualHTML(
      '<span tabindex="0" role="button" class="lxr-picker-item" data-value="1" data-label="1"></span>',
    );
  });

  test('escape charcters', () => {
    const { container } = setup();
    const select = document.createElement('select');
    const option = document.createElement('option');
    container.appendChild(select);
    select.appendChild(option);
    let value = '"Helvetica Neue", \'Helvetica\', sans-serif';
    option.value = value;
    value = value.replace(/"/g, '\\"');
    expect(select.querySelector(`option[value="${value}"]`)).toEqual(option);
  });

  test('label is initialized with the correct aria attributes', () => {
    const { pickerSelector } = setup();
    expect(
      pickerSelector
        .querySelector('.lxr-picker-label')
        ?.getAttribute('aria-expanded'),
    ).toEqual('false');
    const optionsId = pickerSelector.querySelector('.lxr-picker-options')?.id;
    expect(
      pickerSelector
        .querySelector('.lxr-picker-label')
        ?.getAttribute('aria-controls'),
    ).toEqual(optionsId);
  });

  test('options container is initialized with the correct aria attributes', () => {
    const { pickerSelector } = setup();
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('true');

    const ariaControlsLabel = pickerSelector
      .querySelector('.lxr-picker-label')
      ?.getAttribute('aria-controls');
    expect(pickerSelector.querySelector('.lxr-picker-options')?.id).toEqual(
      ariaControlsLabel,
    );
    expect(
      (pickerSelector.querySelector('.lxr-picker-options') as HTMLSelectElement)
        .tabIndex,
    ).toEqual(-1);
  });

  test('aria attributes toggle correctly when the picker is opened via enter key', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector('.lxr-picker-label');
    pickerLabel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(pickerLabel?.getAttribute('aria-expanded')).toEqual('true');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('false');
  });

  test('aria attributes toggle correctly when the picker is opened via mousedown', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector('.lxr-picker-label');
    pickerLabel?.dispatchEvent(
      new Event('mousedown', {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(pickerLabel?.getAttribute('aria-expanded')).toEqual('true');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('false');
  });

  test('aria attributes toggle correctly when an item is selected via click', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector(
      '.lxr-picker-label',
    ) as HTMLElement;
    pickerLabel.click();

    const pickerItem = pickerSelector.querySelector(
      '.lxr-picker-item',
    ) as HTMLElement;
    pickerItem.click();

    expect(pickerLabel.getAttribute('aria-expanded')).toEqual('false');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('true');
  });

  test('aria attributes toggle correctly when an item is selected via enter', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector(
      '.lxr-picker-label',
    ) as HTMLElement;
    pickerLabel.click();
    const pickerItem = pickerSelector.querySelector(
      '.lxr-picker-item',
    ) as HTMLElement;
    pickerItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(pickerLabel?.getAttribute('aria-expanded')).toEqual('false');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('true');
  });

  test('aria attributes toggle correctly when the picker is closed via clicking on the label again', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector(
      '.lxr-picker-label',
    ) as HTMLElement;
    pickerLabel.click();
    pickerLabel.click();
    expect(pickerLabel.getAttribute('aria-expanded')).toEqual('false');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('true');
  });

  test('aria attributes toggle correctly when the picker is closed via escaping out of it', () => {
    const { pickerSelector } = setup();
    const pickerLabel = pickerSelector.querySelector(
      '.lxr-picker-label',
    ) as HTMLElement;
    pickerLabel.click();
    pickerLabel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pickerLabel.getAttribute('aria-expanded')).toEqual('false');
    expect(
      pickerSelector
        .querySelector('.lxr-picker-options')
        ?.getAttribute('aria-hidden'),
    ).toEqual('true');
  });
});
