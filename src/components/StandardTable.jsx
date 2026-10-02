import { Children, cloneElement, isValidElement, useState } from 'react';
import { displayTerminology } from '../terminology.js';

/** People is the visual reference. Use QueueRow/QueueCell for labelled cells. */
export default function StandardTable({ children, label, responsive = true, variant = "default", density = "comfortable", className = "", scrollClassName = "", columnOrderKey, compactControls }) {
  const sections = Children.toArray(children);
  const header = sections.find(section => section.type === 'thead');
  const headerRow = header && Children.toArray(header.props.children)[0];
  const columns = headerRow ? Children.toArray(headerRow.props.children) : [];
  const defaults = columns.map((_, index) => index);
  const [order, setOrder] = useState(() => {
    if (!columnOrderKey) return defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(columnOrderKey));
      return Array.isArray(saved) && saved.length === defaults.length && defaults.every(index => saved.includes(index)) ? saved : defaults;
    } catch { return defaults; }
  });
  const [dragged, setDragged] = useState(null);
  const visibleOrder = order.length === columns.length ? order : defaults;
  const [announcement, setAnnouncement] = useState('');
  const saveOrder = next => {
    setOrder(next);
    try { localStorage.setItem(columnOrderKey, JSON.stringify(next)); } catch { /* Order still works for this session. */ }
  };
  const move = (from, to) => {
    if (from === to || from < 0 || to < 0 || to >= visibleOrder.length) return;
    const next = [...visibleOrder];
    const [column] = next.splice(from, 1);
    next.splice(to, 0, column);
    saveOrder(next);
    setAnnouncement(`${columns[column].props.label || columns[column].props.children} moved to column ${to + 1}.`);
  };
  const reordered = !columnOrderKey ? children : sections.map(section => {
    if (!isValidElement(section) || !['thead', 'tbody', 'tfoot'].includes(section.type)) return section;
    return cloneElement(section, {}, Children.map(section.props.children, row => {
      if (!isValidElement(row)) return row;
      const cells = Children.toArray(row.props.children);
      if (cells.length !== columns.length) return row;
      return cloneElement(row, {}, visibleOrder.map(index => section.type === 'thead'
        ? cloneElement(cells[index], {
            draggable: true,
            title: 'Drag to reorder column, or press Alt + Left/Right',
            tabIndex: 0,
            'aria-keyshortcuts': 'Alt+ArrowLeft Alt+ArrowRight',
            onKeyDown: event => {
              if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                const position = visibleOrder.indexOf(index);
                move(position, position + (event.key === 'ArrowLeft' ? -1 : 1));
              }
            },
            onDragStart: event => { setDragged(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); },
            onDragOver: event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; },
            onDrop: event => { event.preventDefault(); if (dragged !== null) move(visibleOrder.indexOf(dragged), visibleOrder.indexOf(index)); setDragged(null); },
            onDragEnd: () => setDragged(null),
          })
        : cells[index]));
    }));
  });
  return <div className="standard-table-container">
    {compactControls && <div className="standard-table-compact-controls">{compactControls}</div>}
    {columnOrderKey && <span className="sr-only" role="status">{announcement}</span>}
    <div className={`table-scroll standard-table-scroll ${scrollClassName}`.trim()} role="region" aria-label={displayTerminology(label)} tabIndex={0}>
      <table className={`standard-table standard-table-${variant} standard-table-${density} ${responsive ? 'responsive-queue-table' : ''} ${className}`.trim()} aria-label={displayTerminology(label)}>
        {reordered}
      </table>
    </div>
  </div>;
}
