#!/usr/bin/env node
// brain-first-gate — local Claude Code port of the OpenClaw brain-first finalize gate
// (openclaw-plugins/brain-runtime-contract/index.js on clawdbot).
//
// Two hook events, one contract:
//   UserPromptSubmit — brain-class question detected → inject the trace recipe up
//     front (correct behavior as the lowest-friction path).
//   Stop — brain-class question answered with ZERO brain trace → block finalize
//     once with the recipe. stop_hook_active means we already blocked this turn;
//     never nag-loop.
//
// Classifier and trace detection are ported verbatim from Steve's gate so local
// agents are held to the same standard as OpenClaw agents. Fail-open everywhere:
// a gate that breaks the harness is worse than no gate.

import { readFileSync } from "node:fs";

// ---- ported classifier (index.js:365-385) ----------------------------------
const BRAIN_INVENTORY_NOUN =
  "(?:articles?|content|posts?|pieces?|write[-\\s]?ups?|coverage|docs?|pages?|clients?|cases?|stud(?:y|ies)|research|datasets?|data|benchmarks?|comparables?|examples?|playbooks?|skills?|scripts?|repos?|assets?|something|anything)";

function looksLikeBrainClassQuestion(prompt = "") {
  const q = String(prompt || "").toLowerCase();
  if (!q || q.length > 2000) return false;
  const patterns = [
    new RegExp(`\\bdo (?:we|you) (?:have|own|track|keep|maintain)\\b[^?]*\\b${BRAIN_INVENTORY_NOUN}\\b`),
    new RegExp(`\\b(?:is|are) there (?:a|an|any|some)?\\b[^?]*\\b${BRAIN_INVENTORY_NOUN}\\b`),
    /\bhave we (?:ever )?(?:published|written|shipped|built|created|researched|scored|covered|done)\b/,
    /\bwhat (?:did|have) (?:we|you) (?:publish|wr(?:ite|itten)|ship|build|built|create|research|score|cover)/,
    /\b(?:what|which|any|is there|do (?:we|you) have)[^?]*\bbenchmark/,
    new RegExp(`\\bwhich\\b[^?]*\\b${BRAIN_INVENTORY_NOUN}\\b[^?]*\\b(?:cover|covers|exist|exists|mention|mentions|discuss|discusses|address)`),
    new RegExp(`\\b(?:any|an) (?:existing|comparable|prior|similar) ${BRAIN_INVENTORY_NOUN}\\b`),
  ];
  return patterns.some((re) => re.test(q));
}

// ---- ported trace detection (index.js isBrainTraceCall), local tool shapes --
const BRAIN_GRAPH_METHODS =
  "(?:query_graph|get_node|related|god_nodes|graph_stats|shortest_path|get_neighbors|bridges)";

function isBrainTraceToolUse(name = "", input = {}) {
  if (/^mcp__brain__/.test(name)) return true;
  const text = [
    typeof input.command === "string" ? input.command : "",
    typeof input.file_path === "string" ? input.file_path : "",
    typeof input.path === "string" ? input.path : "",
    typeof input.pattern === "string" ? input.pattern : "",
  ].join(" ");
  if (/\bauthoritytech-brain\s+(?:query|observe|sync|status|doctor|mcp)\b/.test(text)) return true;
  if (new RegExp(`\\bbrain\\.${BRAIN_GRAPH_METHODS}\\b`).test(text)) return true;
  if (/mcporter\s+call\s+['"]?\s*brain\./.test(text)) return true;
  if (/Repos\/brain\//.test(text)) return true; // local read mirror = snapshot read
  return false;
}

// ---- transcript walking ------------------------------------------------------
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

function isRealUserPrompt(entry) {
  if (!entry || entry.type !== "user" || entry.isMeta) return false;
  const content = entry.message?.content;
  if (Array.isArray(content) && content.some((c) => c?.type === "tool_result")) return false;
  const text = textOf(content);
  if (!text.trim()) return false;
  if (/<command-name>|<local-command-stdout>/.test(text)) return false; // slash commands
  return true;
}

// Last real user prompt + whether any brain trace appears after it.
function analyzeTranscript(transcriptPath) {
  const lines = readFileSync(transcriptPath, "utf-8").split("\n").filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip torn lines */ }
  }
  let promptIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isRealUserPrompt(entries[i])) { promptIdx = i; break; }
  }
  if (promptIdx === -1) return { brainClass: false, traced: false, prompt: "" };
  const prompt = textOf(entries[promptIdx].message?.content);
  const brainClass = looksLikeBrainClassQuestion(prompt);
  let traced = false;
  for (let i = promptIdx + 1; i < entries.length && !traced; i++) {
    const content = entries[i]?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "tool_use" && isBrainTraceToolUse(c.name, c.input || {})) {
        traced = true;
        break;
      }
    }
  }
  return { brainClass, traced, prompt };
}

function recipe(question) {
  const q = String(question || "").trim().replace(/\s+/g, " ").slice(0, 240);
  return [
    "Trace the AuthorityTech Brain before you answer.",
    "",
    "This is an existence / inventory / benchmark / cross-repo question. Grep and local files only see one repo; the answer to \"do we have X\" lives across all company repos and assets, and the brain is the only seam that spans them. A local-only answer to this class of question is structurally unreliable.",
    "",
    "Trace the graph first, then ground the receipts:",
    `  authoritytech-brain query ${JSON.stringify(q || "<the user's question>")}`,
    "  (or the native mcp__brain__query_graph tool, then mcp__brain__related / mcp__brain__get_node to walk the neighborhood)",
    "",
    "Brain gives connections and which assets/repos relate; it does NOT hand over hard numbers. After the graph names the surface, trace that surface for exact figures. If the brain genuinely returns nothing, say so explicitly — \"the brain has no node for X\" is a grounded answer; silence-from-grep is not.",
  ].join("\n");
}

// ---- main (fail-open) --------------------------------------------------------
let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  process.exit(0);
}

try {
  const event = input.hook_event_name || "";

  if (event === "UserPromptSubmit") {
    const prompt = String(input.prompt || "");
    if (looksLikeBrainClassQuestion(prompt)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: recipe(prompt),
        },
      }));
    }
    process.exit(0);
  }

  if (event === "Stop") {
    if (input.stop_hook_active) process.exit(0); // already blocked once — no nag loop
    if (!input.transcript_path) process.exit(0);
    const { brainClass, traced, prompt } = analyzeTranscript(input.transcript_path);
    if (brainClass && !traced) {
      process.stdout.write(JSON.stringify({ decision: "block", reason: recipe(prompt) }));
    }
    process.exit(0);
  }

  process.exit(0);
} catch {
  process.exit(0); // the gate must never break the harness
}
