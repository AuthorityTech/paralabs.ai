"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Mode = "human" | "machine";

type FetchState =
  | { status: "idle" }
  | { status: "loading"; path: string }
  | { status: "ready"; path: string; body: string }
  | { status: "missing"; path: string }
  | { status: "error"; path: string };

type FetchAction =
  | { type: "start"; path: string }
  | { type: "done"; path: string; body: string }
  | { type: "missing"; path: string }
  | { type: "error"; path: string }
  | { type: "reset" };

function fetchReducer(_state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "start":
      return { status: "loading", path: action.path };
    case "done":
      return { status: "ready", path: action.path, body: action.body };
    case "missing":
      return { status: "missing", path: action.path };
    case "error":
      return { status: "error", path: action.path };
    case "reset":
      return { status: "idle" };
  }
}

function readStoredMode(): Mode {
  if (typeof window === "undefined") return "human";
  try {
    return window.localStorage.getItem("pl-view-mode") === "machine" ? "machine" : "human";
  } catch {
    return "human";
  }
}

function markdownPath(pathname: string): string {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/") return "/index.md";
  if (cleanPath.endsWith(".md")) return cleanPath;
  return `${cleanPath}.md`;
}

export default function MachineViewToggle() {
  const pathname = usePathname();
  const [mode, setModeState] = useState<Mode>(readStoredMode);
  const [fetchState, dispatch] = useReducer(fetchReducer, { status: "idle" });
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const mdPath = useMemo(() => markdownPath(pathname), [pathname]);

  const setMode = useCallback((nextMode: Mode) => {
    setModeState(nextMode);
    window.localStorage.setItem("pl-view-mode", nextMode);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.viewMode = mode;
    document.body.classList.toggle("machine-view-active", mode === "machine");
  }, [mode]);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-view-mode");
      document.body.classList.remove("machine-view-active");
    };
  }, []);

  useEffect(() => {
    if (mode !== "machine") return;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode("human");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, setMode]);

  useEffect(() => {
    if (mode !== "machine") {
      dispatch({ type: "reset" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "start", path: mdPath });

    fetch(mdPath, {
      headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.1" },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          dispatch({ type: "missing", path: mdPath });
          return;
        }
        if (!res.ok) {
          dispatch({ type: "error", path: mdPath });
          return;
        }
        dispatch({ type: "done", path: mdPath, body: await res.text() });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error", path: mdPath });
      });

    return () => {
      cancelled = true;
    };
  }, [mdPath, mode]);

  const copyMarkdown = useCallback(async () => {
    if (fetchState.status !== "ready") return;
    await navigator.clipboard.writeText(fetchState.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [fetchState]);

  return (
    <>
      {/* Floating toggle pill */}
      <button
        onClick={() => setMode(mode === "human" ? "machine" : "human")}
        className="pl-view-switch"
        aria-label={`Switch to ${mode === "human" ? "machine" : "human"} view`}
        title={mode === "human" ? "View machine-readable version" : "Return to human view"}
      >
        <span
          className={`pl-view-switch__label ${mode === "human" ? "pl-view-switch__label--active" : ""}`}
        >
          Human
        </span>
        <span className="pl-view-switch__divider" />
        <span
          className={`pl-view-switch__label ${mode === "machine" ? "pl-view-switch__label--active" : ""}`}
        >
          Machine
        </span>
      </button>

      {/* Machine panel overlay */}
      {mode === "machine" && (
        <section
          ref={panelRef}
          className="pl-machine-panel"
          aria-label="Machine view"
          tabIndex={-1}
        >
          <div className="pl-machine-panel__bar">
            <span className="pl-machine-panel__bar-label">Machine View</span>
            <div className="pl-machine-panel__bar-actions">
              <button
                onClick={copyMarkdown}
                className="pl-machine-panel__btn"
                disabled={fetchState.status !== "ready"}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={mdPath}
                target="_blank"
                rel="noopener noreferrer"
                className="pl-machine-panel__btn"
              >
                Raw .md
              </a>
              <button onClick={() => setMode("human")} className="pl-machine-panel__btn">
                Esc
              </button>
            </div>
          </div>
          {fetchState.status === "ready" && <pre className="pl-machine-panel__content">{fetchState.body}</pre>}
          {fetchState.status === "loading" && <pre className="pl-machine-panel__content">Loading {mdPath}</pre>}
          {fetchState.status === "missing" && <pre className="pl-machine-panel__content">No machine view exists for {pathname}</pre>}
          {fetchState.status === "error" && <pre className="pl-machine-panel__content">Machine view failed to load.</pre>}
        </section>
      )}
    </>
  );
}
