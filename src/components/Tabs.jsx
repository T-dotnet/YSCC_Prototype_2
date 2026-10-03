import { useEffect, useRef } from "react";
import { LockKeyhole } from "lucide-react";
import { appTerm, displayTerminology } from "../terminology.js";
import "./tabs.css";

export function Tabs({
  id,
  label,
  items,
  value,
  onChange,
  className = "",
  panelId = `${id}-panel`,
  autoReveal = false,
}) {
  const tablistRef = useRef(null);
  useEffect(() => {
    if (!autoReveal) return;
    tablistRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value, autoReveal]);
  return (
    <div
      ref={tablistRef}
      className={`tabs ${className}`.trim()}
      role="tablist"
      aria-label={displayTerminology(label)}
    >
      {items.map((item, index) => {
        const key = typeof item === "string" ? item : item.value;
        const disabled = typeof item === "object" && item.disabled === true;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={key === value}
            aria-controls={panelId}
            aria-disabled={disabled}
            disabled={disabled}
            title={typeof item === "object" ? displayTerminology(item.title) : undefined}
            tabIndex={key === value ? 0 : -1}
            className={`tab${key === value ? " selected" : ""}`}
            onClick={() => onChange(key)}
            onKeyDown={(event) => {
              const enabled = items
                .map((candidate, candidateIndex) =>
                  typeof candidate === "object" && candidate.disabled
                    ? -1
                    : candidateIndex,
                )
                .filter((candidateIndex) => candidateIndex !== -1);
              const position = enabled.indexOf(index);
              let next;
              if (event.key === "ArrowRight") next = enabled[(position + 1) % enabled.length];
              if (event.key === "ArrowLeft") next = enabled[(position - 1 + enabled.length) % enabled.length];
              if (event.key === "Home") next = enabled[0];
              if (event.key === "End") next = enabled.at(-1);
              if (next === undefined) return;
              event.preventDefault();
              onChange(
                typeof items[next] === "string"
                  ? items[next]
                  : items[next].value,
              );
              tablistRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
            }}
          >
            {disabled && <LockKeyhole size={13} aria-hidden="true" />}
            {(() => {
              const label = typeof item === "string" ? item : item.label || item.value;
              if (typeof item === "object" && item.verbatim) return label;
              return label === "Assessment" ? appTerm("measures")
                : displayTerminology(label);
            })()}
            {item.count !== undefined && (
              <span className="tab-count">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
export function RecordTabs(props) {
  return <Tabs {...props} autoReveal className={`person-tabs ${props.className || ""}`.trim()} />;
}
export function FilterTabs(props) {
  return <Tabs {...props} className={`work-tabs ${props.className || ""}`.trim()} />;
}
