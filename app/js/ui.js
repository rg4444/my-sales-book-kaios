(function () {
  const screenEl = document.getElementById('screen');
  const titleEl = document.getElementById('topbar');
  const skLeft = document.getElementById('sk-left');
  const skCenter = document.getElementById('sk-center');
  const skRight = document.getElementById('sk-right');

  let currentScreen = null;
  let focusedIndex = 0;

  function setSoftkeys({ left = '', center = '', right = '' }) {
    skLeft.textContent = left;
    skCenter.textContent = center;
    skRight.textContent = right;
  }

  function render(screen) {
    currentScreen = screen;
    focusedIndex = 0;
    titleEl.textContent = screen.title || 'My Sales Book';
    screenEl.innerHTML = '';
    const content = document.createElement('div');
    content.innerHTML = screen.render ? screen.render() : '';
    screenEl.appendChild(content);

    if (screen.items && screen.items.length) {
      const list = document.createElement('ul');
      list.className = 'menu';
      screen.items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'menu-item';
        li.textContent = item.label;
        if (idx === 0) li.classList.add('focused');
        list.appendChild(li);
      });
      screenEl.appendChild(list);
    }

    setSoftkeys(screen.softkeys || {});
  }

  function updateFocus(newIndex) {
    const items = screenEl.querySelectorAll('.menu-item');
    if (!items.length) return;
    focusedIndex = util.clamp(newIndex, 0, items.length - 1);
    items.forEach((item, idx) => {
      item.classList.toggle('focused', idx === focusedIndex);
    });
  }

  function activateFocused() {
    if (!currentScreen || !currentScreen.items) return;
    const item = currentScreen.items[focusedIndex];
    if (item && item.action) item.action();
  }

  function handleKey(e) {
    if (currentScreen && currentScreen.onKeyDown) {
      const handled = currentScreen.onKeyDown(e);
      if (handled) return;
    }
    switch (e.key) {
      case 'ArrowUp':
        updateFocus(focusedIndex - 1);
        e.preventDefault();
        break;
      case 'ArrowDown':
        updateFocus(focusedIndex + 1);
        e.preventDefault();
        break;
      case 'Enter':
        activateFocused();
        e.preventDefault();
        break;
      case 'SoftLeft':
        if (currentScreen && currentScreen.softkeys && currentScreen.softkeys.onLeft) {
          currentScreen.softkeys.onLeft();
          e.preventDefault();
        }
        break;
      case 'SoftRight':
        if (currentScreen && currentScreen.softkeys && currentScreen.softkeys.onRight) {
          currentScreen.softkeys.onRight();
          e.preventDefault();
        }
        break;
      case 'SoftCenter':
        if (currentScreen && currentScreen.softkeys && currentScreen.softkeys.onCenter) {
          currentScreen.softkeys.onCenter();
          e.preventDefault();
        }
        break;
      default:
        break;
    }
  }

  function showMessage(text, isError) {
    const div = document.createElement('div');
    div.className = isError ? 'card error' : 'card';
    div.textContent = text;
    screenEl.prepend(div);
  }

  window.ui = {
    render,
    updateFocus,
    showMessage,
    handleKey
  };
})();
