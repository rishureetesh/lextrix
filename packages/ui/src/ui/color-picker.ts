import Picker from './picker.js';

class ColorPicker extends Picker {
  constructor(select: HTMLSelectElement, label: string) {
    super(select);
    this.label.innerHTML = label;
    this.container.classList.add('lxr-color-picker');
    Array.from(this.container.querySelectorAll('.lxr-picker-item'))
      .slice(0, 7)
      .forEach((item) => {
        item.classList.add('lxr-primary');
      });
  }

  buildItem(option: HTMLOptionElement) {
    const item = super.buildItem(option);
    item.style.backgroundColor = option.getAttribute('value') || '';
    return item;
  }

  selectItem(item: HTMLElement | null, trigger?: boolean) {
    super.selectItem(item, trigger);
    const colorLabel = this.label.querySelector<HTMLElement>('.lxr-color-label');
    const value = item ? item.getAttribute('data-value') || '' : '';
    if (colorLabel) {
      if (colorLabel.tagName === 'line') {
        colorLabel.style.stroke = value;
      } else {
        colorLabel.style.fill = value;
      }
    }
  }
}

export default ColorPicker;
