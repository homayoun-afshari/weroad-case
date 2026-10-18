"use client";

import { useState } from "react";
import { formToRequest, requestToForm, type FormValues } from "@/lib/page/form";
import { canUndo, createHistory, current, push, undo } from "@/lib/page/history";
import type { PageState } from "@/lib/page/types";
import { ResultsList } from "./ResultsList";
import { SearchControls } from "./SearchControls";

/** The whole screen: the search controls and the results list, driven by the page history. */
export function SearchApp({ initial }: { initial: PageState }) {
  const [history, setHistory] = useState(() => createHistory(initial));
  const [form, setForm] = useState(() => requestToForm(initial.request));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const page = current(history);

  async function onSearch() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToRequest(form)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The search failed. Please try again.");
      setHistory((h) => push(h, body as PageState, "user"));
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again."
          : (e as Error).message,
      );
    } finally {
      setPending(false);
    }
  }

  function onUndo() {
    const undone = undo(history);
    if (!undone) return;
    setHistory(undone.history);
    setForm(requestToForm(current(undone.history).request));
    setError(null);
  }

  return (
    <main className="app">
      <SearchControls
        form={form}
        onChange={(change: Partial<FormValues>) => setForm((f) => ({ ...f, ...change }))}
        onSearch={onSearch}
        onUndo={onUndo}
        canUndo={canUndo(history)}
        pending={pending}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <ResultsList results={page.results} />
    </main>
  );
}
