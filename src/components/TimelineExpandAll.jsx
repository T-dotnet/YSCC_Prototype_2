import { useEffect, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

export default function TimelineExpandAll({ containerRef, containerId, itemCount, groupsExpanded = true, onToggleAll }) {
  const [allExpanded, setAllExpanded] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const cards = [...container.querySelectorAll("details.record-item")];
      setAllExpanded(groupsExpanded && cards.every((card) => card.open));
    };
    const observer = new MutationObserver(update);
    observer.observe(container, { attributes: true, attributeFilter: ["open"], childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, [containerRef, groupsExpanded, itemCount]);

  const toggleAll = () => {
    const expand = !allExpanded;
    onToggleAll?.(expand);
    containerRef.current?.querySelectorAll("details.record-item").forEach((card) => {
      card.open = expand;
    });
    setAllExpanded(expand);
  };

  return (
    <button
      type="button"
      className="timeline-expand-all"
      aria-controls={containerId}
      disabled={!itemCount}
      onClick={toggleAll}
    >
      {allExpanded ? <ChevronsDownUp size={16} aria-hidden="true" /> : <ChevronsUpDown size={16} aria-hidden="true" />}
      {allExpanded ? "Collapse all" : "Expand all"}
    </button>
  );
}
