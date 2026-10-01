import { renderOpsecGuides } from './workspaceGuides.js';
import { renderOpsecProtections } from './workspaceProtections.js';

const SECTIONS = [
  {
    id: 'protections',
    name: 'Protections',
    blurb: 'Turn security and privacy guards on or off, then verify them.'
  },
  {
    id: 'guides',
    name: 'Guides',
    blurb: 'Secure DNS, Do Not Track, and cookie hardening.'
  }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function paintSectionCards(wrap, onSectionChange) {
  wrap.className = 'ws-cards';
  wrap.replaceChildren();
  SECTIONS.forEach((section) => {
    const card = el('button', 'ws-tool-card');
    card.type = 'button';
    card.append(el('strong', '', section.name), el('span', '', section.blurb));
    card.addEventListener('click', () => onSectionChange(section.id));
    wrap.appendChild(card);
  });
}

export function renderOpsecWorkspace(wrap, {
  section = '',
  guide = '',
  onSectionChange,
  onGuideChange
}) {
  if (!section) {
    paintSectionCards(wrap, onSectionChange);
    return;
  }

  if (section === 'protections') {
    renderOpsecProtections(wrap, {
      onBack: () => onSectionChange('')
    });
    return;
  }

  if (section === 'guides') {
    renderOpsecGuides(wrap, {
      tool: guide,
      onToolChange: onGuideChange,
      onSectionBack: () => onSectionChange('')
    });
    return;
  }

  paintSectionCards(wrap, onSectionChange);
}
