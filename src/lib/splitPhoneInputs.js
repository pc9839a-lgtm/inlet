function digitsOnly(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function splitPhone(value = '') {
  const digits = digitsOnly(value).slice(0, 11);
  return [
    digits.slice(0, 3),
    digits.slice(3, 7),
    digits.slice(7, 11),
  ];
}

function setReactInputValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (descriptor?.set) descriptor.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function makePart({ placeholder, maxLength, label }) {
  const input = document.createElement('input');
  input.type = 'tel';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.pattern = '[0-9]*';
  input.maxLength = maxLength;
  input.placeholder = placeholder;
  input.className = 'pagero-phone-part';
  input.setAttribute('aria-label', label);
  return input;
}

function separator() {
  const span = document.createElement('span');
  span.className = 'pagero-phone-separator';
  span.textContent = '-';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function enhancePhoneInput(input) {
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.pageroPhoneSplit === 'true') return;
  if (!input.matches('.landing-section.form .form-field-phone > input[type="tel"]')) return;

  const wasRequired = input.required;
  input.dataset.pageroPhoneSplit = 'true';
  input.dataset.pageroPhoneRequired = wasRequired ? 'true' : 'false';
  input.classList.add('pagero-phone-native');
  input.required = false;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const wrapper = document.createElement('div');
  wrapper.className = 'pagero-phone-parts';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', '연락처');

  const first = makePart({ placeholder: '010', maxLength: 3, label: '연락처 앞자리' });
  const middle = makePart({ placeholder: '4746', maxLength: 4, label: '연락처 가운데자리' });
  const last = makePart({ placeholder: '9839', maxLength: 4, label: '연락처 뒷자리' });
  const parts = [first, middle, last];

  if (wasRequired) parts.forEach((part) => { part.required = true; });

  wrapper.append(first, separator(), middle, separator(), last);
  input.insertAdjacentElement('afterend', wrapper);

  const syncPartsFromNative = () => {
    const values = splitPhone(input.value);
    parts.forEach((part, index) => {
      if (part.value !== values[index]) part.value = values[index];
    });
  };

  const commit = () => {
    const next = digitsOnly(parts.map((part) => part.value).join('')).slice(0, 11);
    setReactInputValue(input, next);
  };

  parts.forEach((part, index) => {
    part.addEventListener('input', () => {
      const max = Number(part.maxLength || 4);
      const cleaned = digitsOnly(part.value).slice(0, max);
      if (part.value !== cleaned) part.value = cleaned;
      commit();
      if (cleaned.length === max && index < parts.length - 1) parts[index + 1].focus();
    });

    part.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !part.value && index > 0) {
        parts[index - 1].focus();
      }
    });

    part.addEventListener('paste', (event) => {
      const pasted = digitsOnly(event.clipboardData?.getData('text') || '');
      if (pasted.length < 7) return;
      event.preventDefault();
      const values = splitPhone(pasted);
      parts.forEach((target, partIndex) => { target.value = values[partIndex]; });
      commit();
      last.focus();
    });
  });

  syncPartsFromNative();

  const observer = new MutationObserver(() => {
    if (!document.documentElement.contains(input)) {
      observer.disconnect();
      return;
    }
    syncPartsFromNative();
  });
  observer.observe(input, { attributes: true, attributeFilter: ['value'] });
}

function scan(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.landing-section.form .form-field-phone > input[type="tel"]').forEach(enhancePhoneInput);
}

export function installSplitPhoneInputs() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__pageroSplitPhoneInputsInstalled) return;
  window.__pageroSplitPhoneInputsInstalled = true;

  const start = () => {
    scan(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.landing-section.form .form-field-phone > input[type="tel"]')) enhancePhoneInput(node);
          scan(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });
}
