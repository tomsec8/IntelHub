import { brw } from './utils.js';

const BASE_URL = 'https://github.com/tomsec8/IntelHub/blob/main/help/';

const GUIDES = [
  { lang: 'English', flag: '🇺🇸', file: 'guide_en.md' },
  { lang: 'Hebrew (עברית)', flag: '🇮🇱', file: 'guide_he.md' },
  { lang: 'Spanish (Español)', flag: '🇪🇸', file: 'guide_es.md' },
  { lang: 'French (Français)', flag: '🇫🇷', file: 'guide_fr.md' },
  { lang: 'German (Deutsch)', flag: '🇩🇪', file: 'guide_de.md' },
  { lang: 'Portuguese (Brazil)', flag: '🇧🇷', file: 'guide_pt_br.md' },
  { lang: 'Polish (Polski)', flag: '🇵🇱', file: 'guide_pl.md' }
];

function buildMenu() {
  const menu = document.createElement('div');
  menu.id = 'helpMenu';
  menu.className = 'help-menu';
  menu.hidden = true;

  const title = document.createElement('p');
  title.className = 'help-menu-title';
  title.textContent = 'User guide';
  menu.appendChild(title);

  GUIDES.forEach((g) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-menu-item';
    btn.innerHTML = `<span class="help-flag">${g.flag}</span><span>${g.lang}</span>`;
    btn.addEventListener('click', () => {
      brw.tabs.create({ url: BASE_URL + g.file, active: true });
      menu.hidden = true;
    });
    menu.appendChild(btn);
  });

  return menu;
}

/** Bind a header "?" button: click opens the language menu. */
export function bindHelpButton(button) {
  if (!button) return;

  let menu = document.getElementById('helpMenu');
  if (!menu) {
    menu = buildMenu();
    button.parentElement?.appendChild(menu);
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== button) {
      menu.hidden = true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') menu.hidden = true;
  });
}
