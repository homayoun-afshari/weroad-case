"use client";

import type { FormEvent } from "react";
import type { FormValues } from "@/lib/page/form";

interface Props {
  form: FormValues;
  onChange: (change: Partial<FormValues>) => void;
  onSearch: () => void;
  onUndo: () => void;
  canUndo: boolean;
  pending: boolean;
}

/** The search bar, the search filters, and the undo and search buttons. */
export function SearchControls({ form, onChange, onSearch, onUndo, canUndo, pending }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <form className="controls" onSubmit={submit}>
      <div className="bar">
        <input
          type="search"
          aria-label="What"
          placeholder='Where to, or what for? e.g. "hiking in Argentina"'
          value={form.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <button type="button" onClick={onUndo} disabled={!canUndo || pending}>
          Undo
        </button>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </button>
      </div>
      <div className="filters">
        <label>
          From
          <input
            type="date"
            value={form.dateFrom}
            required={form.dateTo !== ""}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={form.dateTo}
            required={form.dateFrom !== ""}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </label>
        <label>
          Max price (€)
          <input type="number" min={1} step={1} value={form.maxPrice} onChange={(e) => onChange({ maxPrice: e.target.value })} />
        </label>
        <label>
          Min days
          <input type="number" min={1} step={1} value={form.minDays} onChange={(e) => onChange({ minDays: e.target.value })} />
        </label>
        <label>
          Max days
          <input type="number" min={1} step={1} value={form.maxDays} onChange={(e) => onChange({ maxDays: e.target.value })} />
        </label>
        <label>
          Age band
          <select value={form.ageBand} onChange={(e) => onChange({ ageBand: e.target.value as FormValues["ageBand"] })}>
            <option value="">Any</option>
            <option value="18-25">18–25</option>
            <option value="25-35">25–35</option>
            <option value="25-49">25–49</option>
          </select>
        </label>
        <label>
          Physical effort
          <select
            value={form.physicalRating}
            onChange={(e) => onChange({ physicalRating: e.target.value as FormValues["physicalRating"] })}
          >
            <option value="">Any</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.privateRoom} onChange={(e) => onChange({ privateRoom: e.target.checked })} />
          Private room
        </label>
      </div>
    </form>
  );
}
