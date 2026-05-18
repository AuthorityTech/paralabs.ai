"use client";

import { useEffect, useState, useCallback } from "react";

const LS_KEY = "pl-view-mode";

type ViewMode = "human" | "machine";

export default function MachineViewToggle() {
  const [mode, setMode] = useState<ViewMode>("human");
  const [mdUrl, setMdUrl] = useState<string>("/index.md");
  const [mdContent, setMdContent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Derive the .md URL from the current path
  const deriveMdUrl = useCallback(() => {
    const path = window.location.pathname;
    if (path === "/") return "/index.md";
    if (path === "/blog" || path === "/blog/") return "/blog.md";
    const match = path.match(/^\/blog\/([^/]+)\/?$/);
    if (match) return `/blog/${match[1]}.md`;
    return "/index.md";
  }, []);

  // Init from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "machine") {
        setMode("machine");
        document.documentElement.classList.add("machine-view-active");
      }
    } catch {
      /* noop */
    }
    setMdUrl(deriveMdUrl());
  }, [deriveMdUrl]);

  // Fetch markdown content when switching to machine mode
  useEffect(() => {
    if (mode !== "machine") return;
    const url = deriveMdUrl();
    setMdUrl(url);
    fetch(url)
      .then((r) => r.text())
      .then((t) => setMdContent(t))
      .catch(() => setMdContent("# Error loading machine view"));
  }, [mode, deriveMdUrl]);

  // Escape key returns to human mode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "machine") {
        toggle("human");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function toggle(next?: ViewMode) {
    const target = next ?? (mode === "human" ? "machine" : "human");
    setMode(target);
    setCopied(false);
    try {
      localStorage.setItem(LS_KEY, target);
    } catch {
      /* noop */
    }
    if (target === "machine") {
      document.documentElement.classList.add("machine-view-active");
    } else {
      document.documentElement.classList.remove("machine-view-active");
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(mdContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      {/* Floating toggle pill */}
      <button
        onClick={() => toggle()}
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
        <div className="pl-machine-panel">
          <div className="pl-machine-panel__bar">
            <span className="pl-machine-panel__bar-label">Machine View</span>
            <div className="pl-machine-panel__bar-actions">
              <button onClick={copyToClipboard} className="pl-machine-panel__btn">
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={mdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pl-machine-panel__btn"
              >
                Raw .md
              </a>
              <button onClick={() => toggle("human")} className="pl-machine-panel__btn">
                Esc
              </button>
            </div>
          </div>
          <pre className="pl-machine-panel__content">{mdContent}</pre>
        </div>
      )}
    </>
  );
}
