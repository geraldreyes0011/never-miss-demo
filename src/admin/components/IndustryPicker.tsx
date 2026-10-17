import { useId, useMemo, useRef, useState } from "react";
import { rankIndustries, WEAK_MATCH } from "../../shared/search";
import type { Demo } from "../../shared/types";
import { Icon } from "./Icon";

/** Smart industry combobox: same scoring and UX as the client view's picker (ARIA combobox pattern). */
export function IndustryPicker({
  demo,
  value,
  onChange,
  id,
  label = "Industry",
}: {
  demo: Demo;
  value: string;
  onChange: (id: string) => void;
  id?: string;
  label?: string;
}) {
  const auto = useId();
  const inputId = id || auto + "-in";
  const listId = auto + "-list";
  const labelOf = (k: string) => demo.industries[k]?.label || "";
  const [q, setQ] = useState(labelOf(value));
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const has = !!q.trim() && q !== labelOf(value);
  const ranked = useMemo(() => rankIndustries(demo, has ? q : ""), [demo, q, has]);
  const items = (has ? ranked.slice(0, 6) : ranked).map((r) => r.id);
  const weak = has && ranked[0] && ranked[0].s < WEAK_MATCH;

  const pick = (k: string) => {
    onChange(k);
    setQ(labelOf(k));
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    setQ(labelOf(value));
  };
  const show = (on: boolean) => {
    setOpen(on);
    setAct(0);
  };

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="picker">
        <span className="picker-ic" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input
          id={inputId}
          className="input picker-in"
          type="text"
          value={open ? q : labelOf(value)}
          placeholder="Search: e.g. psychologist, aircon"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && items[act] ? `${listId}-${act}` : undefined}
          onFocus={(e) => {
            e.target.select();
            setQ(labelOf(value));
            show(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            show(true);
          }}
          onBlur={() => setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) return show(true);
              const n = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
              setAct(n);
              listRef.current?.querySelectorAll(".pk-item")[n]?.scrollIntoView({ block: "nearest" });
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && items[act]) pick(items[act]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        />
        {open && (
          <ul className="picker-list" id={listId} role="listbox" ref={listRef} aria-label="Industries">
            <li className="picker-note" role="presentation">
              {has
                ? weak
                  ? "No exact match. Closest industries:"
                  : "Best matches"
                : `${demo.order.length} industries · type to search`}
            </li>
            {items.map((k, i) => (
              <li
                key={k}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === act}
                className={`pk-item${i === act ? " act" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(k);
                }}
                onMouseMove={() => setAct(i)}
              >
                <span>{labelOf(k)}</span>
                {k === value && <em>current</em>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
