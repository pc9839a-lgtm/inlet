(() => {
  const autoGrow = textarea => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(190, textarea.scrollHeight)}px`;
  };

  const stabilizeEditor = () => {
    const textarea = document.querySelector('#messageText');
    if (textarea) {
      autoGrow(textarea);
      textarea.addEventListener('input', () => autoGrow(textarea));
      textarea.addEventListener('focus', () => setTimeout(() => textarea.scrollIntoView({block:'center',behavior:'smooth'}), 180));
    }
    const save = document.querySelector('#saveMessage');
    if (save) save.addEventListener('click', () => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  };

  if (typeof bindRoot === 'function') {
    const previousBindRoot = bindRoot;
    bindRoot = function () {
      previousBindRoot();
      stabilizeEditor();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', stabilizeEditor, {once:true});
  } else {
    stabilizeEditor();
  }
})();
