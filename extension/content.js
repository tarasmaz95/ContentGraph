(function () {
  const PANEL_ID = "cg-transcript-panel";
  if (document.getElementById(PANEL_ID)) return;

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cg-header">
      <span class="cg-title">ContentGraph</span>
      <button type="button" class="cg-close" aria-label="Close">×</button>
    </div>
    <div class="cg-meta"></div>

    <div class="cg-section">
      <div class="cg-section-title">Transcript</div>
      <p class="cg-hint">Open YouTube Transcript, then extract.</p>
      <div class="cg-status cg-multiline" data-status="transcript">Ready</div>
      <div class="cg-actions">
        <button type="button" data-action="extract-transcript">Extract</button>
        <button type="button" data-action="copy-transcript" disabled>Copy</button>
        <button type="button" data-action="export-transcript" disabled>Export</button>
        <button type="button" data-action="save-transcript" disabled>Save</button>
      </div>
      <textarea class="cg-preview" data-preview="transcript" readonly placeholder="Transcript…"></textarea>
    </div>

    <div class="cg-section">
      <div class="cg-section-title">Comments</div>
      <p class="cg-hint">Click Extract — auto Top sort, then best 20 by likes.</p>
      <div class="cg-status cg-multiline" data-status="comments">Ready</div>
      <div class="cg-actions">
        <button type="button" data-action="extract-comments">Extract comments</button>
        <button type="button" data-action="copy-comments" disabled>Copy comments</button>
        <button type="button" data-action="save-comments" disabled>Save comments</button>
      </div>
      <textarea class="cg-preview" data-preview="comments" readonly placeholder="Comments preview…"></textarea>
    </div>
  `;
  document.body.appendChild(panel);

  let transcriptText = "";
  let commentsData = [];

  panel.querySelector(".cg-close").addEventListener("click", () => {
    panel.classList.add("cg-hidden");
  });

  panel.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      if (action === "extract-transcript") await handleExtractTranscript();
      if (action === "copy-transcript") await handleCopyTranscript();
      if (action === "export-transcript") handleExportTranscript();
      if (action === "save-transcript") await handleSaveTranscript();
      if (action === "extract-comments") await handleExtractComments();
      if (action === "copy-comments") await handleCopyComments();
      if (action === "save-comments") await handleSaveComments();
    });
  });

  function setStatus(kind, text, statusKind) {
    const el = panel.querySelector(`[data-status="${kind}"]`);
    el.textContent = text;
    el.className =
      "cg-status" +
      (kind === "transcript" || kind === "comments" ? " cg-multiline" : "") +
      (statusKind ? ` cg-${statusKind}` : "");
  }

  /**
   * Human-readable save result from POST /transcripts/ingest (DB + Sheets write-back).
   * @returns {{ text: string, statusKind: 'ok'|'warn'|'error' }}
   */
  function formatTranscriptSaveStatus(result) {
    if (!result?.matched || !result.transcript_saved) {
      return {
        text: result?.message || "Video not in catalog — sync your sheet in ContentGraph first.",
        statusKind: "error",
      };
    }

    const lines = [`✓ Saved to ContentGraph (video #${result.video_id})`];
    if (result.embedding_created) {
      lines[0] += " · search index updated";
    }

    const wb = (result.sheets_writeback || "skipped").toLowerCase();
    const rows = result.sheets_rows_updated || 0;
    let statusKind = "ok";

    if (wb === "ok" && rows > 0) {
      const rowLabel = rows === 1 ? "1 row" : `${rows} rows`;
      lines.push(`✓ Google Sheets updated (${rowLabel})`);
    } else if (wb === "no_rows") {
      lines.push(
        "⚠ Google Sheets: no matching row — open tm1.website, run Quick Sync, then save again"
      );
      statusKind = "warn";
    } else if (wb === "failed") {
      const hint = result.sheets_message
        ? truncateSheetsMessage(result.sheets_message)
        : "check sheet permissions or Transcript column";
      lines.push(`⚠ Google Sheets update failed — ${hint}`);
      statusKind = "warn";
    } else if (wb === "skipped") {
      const why = result.sheets_message
        ? truncateSheetsMessage(result.sheets_message)
        : "write-back disabled or not configured";
      lines.push(`⚠ Google Sheets not updated — ${why}`);
      statusKind = "warn";
    } else {
      lines.push("⚠ Google Sheets status unknown — run Quick Sync and try again");
      statusKind = "warn";
    }

    return { text: lines.join("\n"), statusKind };
  }

  function truncateSheetsMessage(msg) {
    if (!msg) return "";
    const s = String(msg).replace(/\s+/g, " ").trim();
    return s.length > 72 ? s.slice(0, 69) + "…" : s;
  }

  /** Comments ingest: DB + Sheets write-back (parallel to transcript). */
  function formatCommentsSaveStatus(result) {
    if (!result?.matched) {
      return {
        text: result?.message || "Video not in catalog — sync your sheet in ContentGraph first.",
        statusKind: "error",
      };
    }

    const saved = result.comments_saved || 0;
    if (saved === 0) {
      return {
        text: result?.message || "No valid comments to save.",
        statusKind: "warn",
      };
    }

    const lines = [`✓ Saved ${saved} comments to ContentGraph (video #${result.video_id})`];
    const wb = (result.sheets_writeback || "skipped").toLowerCase();
    const rows = result.sheets_rows_updated || 0;
    let statusKind = "ok";

    if (wb === "ok" && rows > 0) {
      const rowLabel = rows === 1 ? "1 row" : `${rows} rows`;
      lines.push(`✓ Google Sheets updated (${rowLabel})`);
    } else if (wb === "no_rows") {
      lines.push(
        "⚠ Google Sheets: no matching row — open tm1.website, run Quick Sync, then save again"
      );
      statusKind = "warn";
    } else if (wb === "failed") {
      const hint = result.sheets_message
        ? truncateSheetsMessage(result.sheets_message)
        : 'map "Comments" column in Settings';
      lines.push(`⚠ Google Sheets update failed — ${hint}`);
      statusKind = "warn";
    } else if (wb === "skipped") {
      const why = result.sheets_message
        ? truncateSheetsMessage(result.sheets_message)
        : "write-back disabled or not configured";
      lines.push(`⚠ Google Sheets not updated — ${why}`);
      statusKind = "warn";
    } else {
      lines.push("⚠ Google Sheets status unknown — run Quick Sync and try again");
      statusKind = "warn";
    }

    return { text: lines.join("\n"), statusKind };
  }

  function setMeta() {
    const meta = getPageMeta();
    panel.querySelector(".cg-meta").textContent =
      `${meta.creator || "Unknown"} · ${truncate(meta.title, 60)}`;
    return meta;
  }

  function truncate(s, n) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function enableTranscriptActions(enabled) {
    panel
      .querySelectorAll(
        "[data-action=copy-transcript],[data-action=export-transcript],[data-action=save-transcript]"
      )
      .forEach((b) => {
        b.disabled = !enabled;
      });
  }

  function enableCommentActions(enabled) {
    panel
      .querySelectorAll("[data-action=copy-comments],[data-action=save-comments]")
      .forEach((b) => {
        b.disabled = !enabled;
      });
  }

  const TRANSCRIPT_WAIT_MS = 5000;
  const TRANSCRIPT_POLL_MS = 250;
  const SEGMENT_NODE_SELECTORS = [
    "transcript-segment-view-model",
    "timeline-item-view-model",
    "ytd-transcript-segment-renderer",
    "ytd-transcript-segment-view-model",
    "yt-transcript-segment-view-model",
  ];

  function cgLog(...args) {
    console.log("[ContentGraph transcript]", ...args);
  }

  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isTimestampOnly(text) {
    const t = (text || "").trim();
    if (!t) return true;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return true;
    if (/^[\d:.\s,]+$/.test(t) && /\d:\d/.test(t)) return true;
    return false;
  }

  function isUiChromeLine(text) {
    return /^(chapters|transcript|in this video|subtitles|show transcript|show more|\.{3}more)$/i.test(
      (text || "").trim()
    );
  }

  function cleanSegmentText(raw) {
    return normalizeText((raw || "").replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, ""));
  }

  /** Walk light DOM + open shadow roots (YouTube hides segment text in shadow). */
  function queryAllDeep(root, selector) {
    const out = [];
    const seen = new Set();

    function visit(node) {
      if (!node) return;
      if (node.nodeType === 1) {
        const el = node;
        try {
          if (el.matches?.(selector) && !seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        } catch (_) {
          /* invalid selector */
        }
        if (el.shadowRoot) visit(el.shadowRoot);
        for (const child of el.children || []) visit(child);
      } else if (node.nodeType === 11) {
        for (const child of node.children || []) visit(child);
      }
    }

    visit(root);
    return out;
  }

  function countDomSegmentNodes() {
    return collectSegmentNodes(null).length;
  }

  function collectSegmentNodes(root) {
    const seen = new Set();
    const nodes = [];
    const scopes = root ? [root, document.documentElement] : [document.documentElement];

    for (const scope of scopes) {
      for (const sel of SEGMENT_NODE_SELECTORS) {
        for (const el of scope.querySelectorAll(sel)) {
          if (!seen.has(el)) {
            seen.add(el);
            nodes.push(el);
          }
        }
        for (const el of queryAllDeep(scope, sel)) {
          if (!seen.has(el)) {
            seen.add(el);
            nodes.push(el);
          }
        }
      }
    }
    return nodes;
  }

  function isModernTranscriptSegment(segmentEl) {
    const tag = (segmentEl?.tagName || "").toLowerCase();
    return tag === "transcript-segment-view-model" || tag === "timeline-item-view-model";
  }

  function getSegmentText(segmentEl) {
    if (isModernTranscriptSegment(segmentEl)) {
      const modernSelectors = [
        'span[role="text"]',
        ".ytAttributedStringHost",
        '[class*="TranscriptSegmentViewModel"]',
      ];
      for (const sel of modernSelectors) {
        const el = segmentEl.querySelector?.(sel);
        let t = cleanSegmentText(el?.textContent || "");
        if (t && !isTimestampOnly(t) && t.length > 1) return t;
      }
      const lines = (segmentEl.innerText || "")
        .split("\n")
        .map((l) => cleanSegmentText(l))
        .filter((l) => l && !isTimestampOnly(l) && !isUiChromeLine(l) && l.length > 1);
      const line = lines.find((l) => l.length > 8) || lines[lines.length - 1] || "";
      if (line) return line;
    }

    const localSelectors = [
      ".segment-text",
      '[class*="segment-text"]',
      "yt-formatted-string.segment-text",
      "yt-formatted-string",
      "#content yt-formatted-string",
      "#content",
    ];

    for (const sel of localSelectors) {
      const el = segmentEl.querySelector?.(sel);
      const t = cleanSegmentText(el?.textContent || "");
      if (t && !isTimestampOnly(t) && t.length > 1) return t;
    }

    for (const sel of localSelectors) {
      for (const el of queryAllDeep(segmentEl, sel)) {
        const t = cleanSegmentText(el.textContent || "");
        if (t && !isTimestampOnly(t) && t.length > 1) return t;
      }
    }

    const lines = (segmentEl.innerText || "")
      .split("\n")
      .map((l) => cleanSegmentText(l))
      .filter((l) => l && !isTimestampOnly(l) && !isUiChromeLine(l) && l.length > 1);
    return lines[lines.length - 1] || lines[0] || "";
  }

  /** 2025+ UI: "In this video" panel with yt-section-list-renderer + transcript-segment-view-model. */
  function findModernInThisVideoPanel() {
    const panels = [
      ...document.querySelectorAll("ytd-engagement-panel-section-list-renderer"),
    ];

    for (const p of panels) {
      const vis = p.getAttribute("visibility") || "";
      if (!vis.includes("EXPANDED")) continue;

      const segCount = p.querySelectorAll("transcript-segment-view-model").length;
      const list = p.querySelector("yt-section-list-renderer");
      const header = (p.textContent || "").slice(0, 300);

      if (segCount > 0 && list) {
        const contents =
          list.querySelector(".ytSectionListRendererContents") || list;
        return {
          root: contents,
          layout: /in this video/i.test(header)
            ? "modern-in-this-video"
            : "modern-section-list",
          selector: "transcript-segment-view-model",
          visible: isElementVisible(p),
          segCount,
        };
      }
    }

    const anyModern = document.querySelectorAll("transcript-segment-view-model");
    if (anyModern.length > 0) {
      const host =
        anyModern[0].closest("yt-section-list-renderer") ||
        anyModern[0].closest("ytd-engagement-panel-section-list-renderer");
      return {
        root: host || document.documentElement,
        layout: "modern-segment-fallback",
        selector: "transcript-segment-view-model",
        visible: true,
        segCount: anyModern.length,
      };
    }

    return null;
  }

  function extractModernTranscriptSegments(root) {
    const scope = root || document.documentElement;
    const segs = scope.querySelectorAll("transcript-segment-view-model");
    if (!segs.length) {
      return { parts: [], rowCount: 0, method: null };
    }

    const parts = [];
    for (const seg of segs) {
      const text = getSegmentText(seg);
      if (!text || isTimestampOnly(text) || isUiChromeLine(text)) continue;
      if (parts.length && parts[parts.length - 1] === text) continue;
      parts.push(text);
    }

    if (parts.length) {
      return {
        parts,
        rowCount: parts.length,
        method: "transcript-segment-view-model",
      };
    }
    return { parts: [], rowCount: 0, method: null };
  }

  /** Locate transcript container — visibility optional when segments exist in DOM. */
  function findTranscriptRoot() {
    const attempts = [];

    const modern = findModernInThisVideoPanel();
    if (modern) attempts.push(modern);

    const expandedEngagement = document.querySelector(
      'ytd-engagement-panel-section-list-renderer[visibility*="EXPANDED"], ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]'
    );
    if (expandedEngagement) {
      const seg = expandedEngagement.querySelector("#segments-container");
      attempts.push({
        root: seg || expandedEngagement,
        layout: "engagement-panel-expanded",
        selector: "ytd-engagement-panel-section-list-renderer[expanded]",
        visible: isElementVisible(expandedEngagement),
      });
    }

    const rootSelectors = [
      { sel: "ytd-transcript-search-panel-renderer", layout: "search-panel" },
      {
        sel: 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
        layout: "engagement-panel",
      },
      { sel: "ytd-video-description-transcript-section-renderer", layout: "description-transcript" },
      { sel: "ytd-transcript-renderer", layout: "legacy-renderer" },
      { sel: "ytd-transcript-body-renderer", layout: "legacy-body" },
    ];

    for (const { sel, layout } of rootSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const seg = el.querySelector("#segments-container") || el;
      const segCount = collectSegmentNodes(seg).length;
      if (segCount > 0 || isElementVisible(el) || el.querySelector("#segments-container")) {
        attempts.push({
          root: el.querySelector("#segments-container") || seg,
          layout,
          selector: sel,
          visible: isElementVisible(el),
          segCount,
        });
      }
    }

    const subtitlesRoot = findSubtitlesOrInThisVideoRoot();
    if (subtitlesRoot) attempts.push(subtitlesRoot);

    const inline = findInThisVideoTranscriptRoot();
    if (inline) attempts.push(inline);

    const containers = document.querySelectorAll("#segments-container");
    for (const seg of containers) {
      if (seg.children?.length || collectSegmentNodes(seg).length > 0) {
        attempts.push({
          root: seg,
          layout: "segments-container-any",
          selector: "#segments-container",
          visible: isElementVisible(seg),
          segCount: collectSegmentNodes(seg).length,
        });
      }
    }

    if (!attempts.length) {
      cgLog("findTranscriptRoot: none");
      return null;
    }

    const best =
      attempts.find((a) => (a.segCount || collectSegmentNodes(a.root).length) > 0) ||
      attempts[0];
    cgLog("findTranscriptRoot:", best.layout, best);
    return best;
  }

  /** "Subtitles (hidden)" / "In this video" blocks — do not require panel visibility. */
  function findSubtitlesOrInThisVideoRoot() {
    const labelEls = Array.from(
      document.querySelectorAll(
        "h2, h3, h4, span, div, yt-formatted-string, button, tp-yt-paper-tab"
      )
    ).filter((el) => {
      const t = (el.textContent || "").trim();
      return (
        t.length < 120 &&
        (/subtitles/i.test(t) || /in this video/i.test(t) || /^transcript$/i.test(t))
      );
    });

    for (const label of labelEls) {
      const host =
        label.closest(
          "ytd-video-description-transcript-section-renderer, ytd-engagement-panel-section-list-renderer, ytd-structured-description-content-panel, ytd-expandable-video-description-body-renderer, #structured-description, ytd-watch-metadata"
        ) || label.parentElement?.parentElement;
      if (!host) continue;

      const seg =
        host.querySelector("#segments-container") ||
        host.querySelector("ytd-transcript-segment-list-renderer") ||
        host.querySelector("ytd-transcript-search-panel-renderer");
      if (seg) {
        return {
          root: seg.querySelector?.("#segments-container") || seg,
          layout: /subtitles/i.test(label.textContent || "")
            ? "subtitles-section"
            : "in-this-video-label",
          selector: "subtitles-or-in-this-video",
          visible: isElementVisible(host),
          segCount: collectSegmentNodes(seg).length,
        };
      }
    }
    return null;
  }

  /** New layout: "In this video" heading with Chapters | Transcript tabs. */
  function findInThisVideoTranscriptRoot() {
    const section = document.querySelector(
      "ytd-video-description-transcript-section-renderer"
    );
    if (section) {
      const seg =
        section.querySelector("#segments-container") ||
        section.querySelector("ytd-transcript-segment-list-renderer");
      if (seg) {
        return {
          root: seg.querySelector?.("#segments-container") || seg,
          layout: "in-this-video-description",
          selector: "ytd-video-description-transcript-section-renderer",
          visible: isElementVisible(section),
          segCount: collectSegmentNodes(seg).length,
        };
      }
    }

    const panels = document.querySelectorAll(
      "ytd-structured-description-content-panel, ytd-expandable-video-description-body-renderer, #structured-description, ytd-watch-metadata"
    );
    for (const panelEl of panels) {
      const sample = (panelEl.textContent || "").slice(0, 500);
      if (!/in this video/i.test(sample) && !/subtitles/i.test(sample)) continue;
      const seg = panelEl.querySelector(
        "#segments-container, ytd-transcript-segment-list-renderer, ytd-transcript-search-panel-renderer"
      );
      if (seg) {
        return {
          root: seg.querySelector?.("#segments-container") || seg,
          layout: "in-this-video",
          selector: "structured-description",
          visible: isElementVisible(panelEl),
          segCount: collectSegmentNodes(seg).length,
        };
      }
    }

    return null;
  }

  async function expandDescriptionIfNeeded() {
    const moreCandidates = Array.from(
      document.querySelectorAll(
        'tp-yt-paper-button#expand, button, yt-formatted-string, span, div'
      )
    ).filter((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      return t === "more" || t === "...more" || /^\.{3}\s*more$/i.test(t);
    });
    for (const btn of moreCandidates) {
      if (!isElementVisible(btn)) continue;
      btn.click();
      await sleep(400);
      return true;
    }
    return false;
  }

  /** Activate Transcript tab when Chapters / Subtitles is selected (new inline UI). */
  async function ensureTranscriptTabActive() {
    const scopes = [
      document.querySelector(
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]'
      ),
      document.querySelector("ytd-video-description-transcript-section-renderer"),
      document.querySelector("#structured-description"),
      document.querySelector("ytd-watch-metadata"),
      document,
    ].filter(Boolean);

    for (const scope of scopes) {
      const tabs = Array.from(
        scope.querySelectorAll(
          'button[role="tab"], yt-tab-shape, tp-yt-paper-tab, .ytChipShapeButtonShape, button'
        )
      );
      for (const tab of tabs) {
        const label = (
          tab.getAttribute("aria-label") ||
          tab.textContent ||
          ""
        ).trim();
        if (!/^transcript$/i.test(label) && !/\btranscript\b/i.test(label)) continue;
        if (/chapter/i.test(label) && !/transcript/i.test(label)) continue;
        if (tab.getAttribute("aria-selected") === "true") return false;
        tab.click();
        cgLog("ensureTranscriptTabActive: clicked tab", label);
        await sleep(500);
        return true;
      }
    }
    return false;
  }

  async function openTranscriptPanel() {
    await expandDescriptionIfNeeded();

    const openSelectors = [
      'button[aria-label="Show transcript"]',
      "ytd-video-description-transcript-section-renderer button",
    ];
    for (const sel of openSelectors) {
      const btn = document.querySelector(sel);
      if (btn && isElementVisible(btn)) {
        btn.click();
        await sleep(700);
        break;
      }
    }
    const transcriptBtns = Array.from(
      document.querySelectorAll('button[aria-label], ytd-button-renderer button')
    ).filter((btn) => /transcript/i.test(btn.getAttribute("aria-label") || ""));
    for (const btn of transcriptBtns) {
      if (isElementVisible(btn)) {
        btn.click();
        await sleep(700);
        break;
      }
    }

    await ensureTranscriptTabActive();
    await sleep(400);
  }

  function extractRowsFromSegmentsContainer(container) {
    if (!container) return [];
    const parts = [];
    for (const child of container.children) {
      const tag = (child.tagName || "").toUpperCase();
      if (tag === "YTD-TRANSCRIPT-SECTION-HEADER-RENDERER") continue;
      if (SEGMENT_NODE_SELECTORS.some((s) => child.matches?.(s))) {
        const text = getSegmentText(child);
        if (text) {
          if (!parts.length || parts[parts.length - 1] !== text) parts.push(text);
        }
        continue;
      }
      const textEl =
        child.querySelector?.(".segment-text") ||
        child.querySelector?.("yt-formatted-string.segment-text") ||
        child.querySelector?.("yt-formatted-string") ||
        child.querySelector?.("#content");
      let text = cleanSegmentText(textEl?.textContent || child.innerText || "");
      if (!text || isTimestampOnly(text) || isUiChromeLine(text)) continue;
      if (parts.length && parts[parts.length - 1] === text) continue;
      parts.push(text);
    }
    return parts;
  }

  function extractFromContainerInnerText(container) {
    if (!container?.innerText) return [];
    const lines = container.innerText
      .split("\n")
      .map((l) => cleanSegmentText(l))
      .filter(
        (l) =>
          l &&
          l.length > 1 &&
          !isTimestampOnly(l) &&
          !isUiChromeLine(l) &&
          !/^\d{1,2}:\d{2}/.test(l)
      );
    if (lines.length >= 2) return lines;
    return [];
  }

  function extractGlobalSegmentNodes() {
    const nodes = collectSegmentNodes(null);
    const parts = [];
    for (const node of nodes) {
      const text = getSegmentText(node);
      if (!text || isTimestampOnly(text) || isUiChromeLine(text)) continue;
      if (parts.length && parts[parts.length - 1] === text) continue;
      parts.push(text);
    }
    if (parts.length) {
      return { parts, rowCount: parts.length, method: "global-segment-nodes" };
    }
    return { parts: [], rowCount: 0, method: null };
  }

  function extractTranscriptRows(root) {
    const scopes = root ? [root, document.documentElement] : [document.documentElement];

    for (const scope of scopes) {
      const modern = extractModernTranscriptSegments(scope);
      if (modern.rowCount > 0) {
        cgLog("extractModernTranscriptSegments:", modern.rowCount);
        return modern;
      }
    }

    const rowSelectors = [
      "transcript-segment-view-model span[role='text']",
      ".ytSectionListRendererContents transcript-segment-view-model",
      "#segments-container ytd-transcript-segment-renderer .segment-text",
      "#segments-container ytd-transcript-segment-view-model .segment-text",
      "#segments-container ytd-transcript-segment-renderer yt-formatted-string",
      "ytd-transcript-segment-renderer yt-formatted-string.segment-text",
      "ytd-transcript-segment-renderer .segment-text",
      "ytd-transcript-segment-view-model .segment-text",
      "ytd-transcript-segment-renderer #content yt-formatted-string",
      "ytd-transcript-segment-list-renderer yt-formatted-string",
      ".ytd-transcript-segment-renderer .segment-text",
    ];

    for (const scope of scopes) {
      for (const sel of rowSelectors) {
        const nodes = [
          ...scope.querySelectorAll(sel),
          ...queryAllDeep(scope, sel),
        ];
        if (!nodes.length) continue;
        const parts = [];
        for (const n of nodes) {
          const text = cleanSegmentText(n.textContent);
          if (!text || isTimestampOnly(text) || isUiChromeLine(text)) continue;
          if (parts.length && parts[parts.length - 1] === text) continue;
          parts.push(text);
        }
        if (parts.length >= 1) {
          return { parts, rowCount: parts.length, method: sel };
        }
      }

      const container =
        scope.querySelector?.("#segments-container") ||
        (scope.id === "segments-container" ? scope : null);
      const fromContainer = extractRowsFromSegmentsContainer(container);
      if (fromContainer.length >= 1) {
        return {
          parts: fromContainer,
          rowCount: fromContainer.length,
          method: "#segments-container > children",
        };
      }

      if (container) {
        const fromText = extractFromContainerInnerText(container);
        if (fromText.length >= 2) {
          return {
            parts: fromText,
            rowCount: fromText.length,
            method: "#segments-container innerText",
          };
        }
      }
    }

    const global = extractGlobalSegmentNodes();
    if (global.rowCount > 0) return global;

    for (const scope of scopes) {
      const body = scope.querySelector?.("ytd-transcript-body-renderer");
      if (body?.innerText?.trim()) {
        const text = body.innerText.trim().replace(/\n+/g, " ");
        if (text.length >= 20) {
          return {
            parts: [text],
            rowCount: 1,
            method: "ytd-transcript-body-renderer",
          };
        }
      }
    }

    return { parts: [], rowCount: 0, method: null };
  }

  function scrapeTranscriptFromDom() {
    const panel = findTranscriptRoot();
    const root = panel?.root || null;
    const domSegmentCount = countDomSegmentNodes();
    let extracted = extractTranscriptRows(root);

    if (!extracted.parts.length) {
      extracted = extractTranscriptRows(null);
    }

    const debug = {
      rootFound: !!panel,
      layout: panel?.layout || null,
      selector: panel?.selector || null,
      rootVisible: panel?.visible ?? null,
      domSegmentNodes: domSegmentCount,
      rowCount: extracted.rowCount,
      method: extracted.method,
    };

    cgLog("scrape:", debug);

    return {
      text: extracted.parts.join(" "),
      rowCount: extracted.rowCount,
      panelDetected: !!panel || domSegmentCount > 0,
      layout: panel?.layout || null,
      method: extracted.method,
      debug,
    };
  }

  function waitForTranscriptRowsMutation(timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (hit) => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(hit);
      };

      const observer = new MutationObserver(() => {
        if (countDomSegmentNodes() > 0 || scrapeTranscriptFromDom().rowCount > 0) {
          finish(true);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  }

  async function extractTranscriptWithRetry(onStatus) {
    const started = Date.now();
    let lastDebug = null;
    let attempt = 0;

    while (Date.now() - started < TRANSCRIPT_WAIT_MS) {
      attempt += 1;
      const scraped = scrapeTranscriptFromDom();
      lastDebug = scraped.debug;

      cgLog(`attempt ${attempt}:`, scraped.debug);

      if (scraped.rowCount > 0 && scraped.text.length >= 20) {
        return { scraped, attempt, lazyLoaded: attempt > 1 };
      }

      if (scraped.panelDetected && scraped.rowCount === 0) {
        onStatus?.(`Waiting for transcript rows… (${Math.round((Date.now() - started) / 1000)}s)`);
      } else if (attempt > 1) {
        onStatus?.(`Retrying transcript extraction… (${attempt})`);
      }

      await sleep(TRANSCRIPT_POLL_MS);
    }

    const finalScrape = scrapeTranscriptFromDom();
    return {
      scraped: finalScrape,
      attempt: attempt + 1,
      lazyLoaded: attempt > 0,
      debug: finalScrape.debug || lastDebug,
    };
  }

  function parseLikeCount(raw) {
    const s = (raw || "").trim().toLowerCase().replace(/,/g, "");
    if (!s) return 0;
    const m = s.match(/^([\d.]+)\s*([km])?/);
    if (!m) return parseInt(s, 10) || 0;
    let n = parseFloat(m[1]);
    if (m[2] === "k") n *= 1000;
    if (m[2] === "m") n *= 1_000_000;
    return Math.round(n);
  }

  function normalizeText(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  /** Comments-only tuning — transcript flow does not use these. */
  const COMMENTS_FINAL_MAX = 20;
  const COMMENTS_POOL_MAX = 80;
  const COMMENTS_SCROLL_STEPS = 6;
  const COMMENTS_SCROLL_PAUSE_MS = 450;
  const COMMENTS_SORT_WAIT_MS = 1200;
  const COMMENTS_LOAD_BUDGET_MS = 5500;

  async function scrollToComments() {
    const section =
      document.querySelector("ytd-comments#comments") ||
      document.querySelector("#comments");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      await sleep(800);
    }
  }

  function getCommentsSortButton() {
    const header = document.querySelector("ytd-comments-header-renderer");
    if (!header) return null;
    return (
      header.querySelector("#sort-menu tp-yt-paper-button") ||
      header.querySelector("#sort-menu button") ||
      header.querySelector("#sort-menu yt-sort-filter-sub-menu-renderer button") ||
      header.querySelector('tp-yt-paper-button[aria-label*="Sort" i]')
    );
  }

  function detectCommentsSortLabel() {
    const btn = getCommentsSortButton();
    if (!btn) return { label: "", isTop: false, found: false };
    const span = btn.querySelector(".yt-core-attributed-string, #label, span");
    const label = normalizeText(
      span?.textContent || btn.getAttribute("aria-label") || btn.textContent || ""
    );
    const lower = label.toLowerCase();
    const isTop =
      (/top|топов|найкращ/i.test(lower) && !/newest|new\s|найнов|recent/i.test(lower)) ||
      /^top\s*comments?$/i.test(label);
    return { label, isTop, found: true };
  }

  function clickTopSortMenuItem() {
    const menuRoots = [
      ...document.querySelectorAll("ytd-menu-popup-renderer ytd-menu-service-item-renderer"),
      ...document.querySelectorAll("tp-yt-paper-listbox tp-yt-paper-item"),
      ...document.querySelectorAll("ytd-selectable-text"),
    ];
    for (const el of menuRoots) {
      const text = normalizeText(el.textContent || "");
      if (!text || text.length > 80) continue;
      const lower = text.toLowerCase();
      if (/newest|new\s|найнов|recent|пізніш/i.test(lower)) continue;
      if (
        /^top\s*comments?$/i.test(text) ||
        lower === "top" ||
        /топов|найкращ/i.test(lower)
      ) {
        const clickTarget =
          el.closest("ytd-menu-service-item-renderer") ||
          el.closest("tp-yt-paper-item") ||
          el;
        clickTarget.click();
        return true;
      }
    }
    return false;
  }

  /** Best-effort Top sort; never throws — warns in console on failure. */
  async function ensureCommentsTopSort() {
    const detected = detectCommentsSortLabel();
    cgLog("comments_sort_detected", detected);
    if (!detected.found) {
      console.warn("[ContentGraph] comments_sort: sort control not found — continuing");
      return false;
    }
    if (detected.isTop) return true;

    const btn = getCommentsSortButton();
    if (!btn) {
      console.warn("[ContentGraph] comments_sort: cannot open menu — continuing");
      return false;
    }
    try {
      btn.click();
      await sleep(320);
      if (!clickTopSortMenuItem()) {
        console.warn("[ContentGraph] comments_sort: Top menu item not found — continuing");
        document.body.click();
        return false;
      }
      cgLog("comments_sort_switched", { from: detected.label });
      await sleep(COMMENTS_SORT_WAIT_MS);
      return true;
    } catch (err) {
      console.warn("[ContentGraph] comments_sort failed — continuing", err);
      return false;
    }
  }

  function scrapeCommentFromThread(thread) {
    const authorEl =
      thread.querySelector("#author-text span") ||
      thread.querySelector("#author-text") ||
      thread.querySelector("ytd-comment-view-model #author-text");
    const textEl =
      thread.querySelector("#content-text") ||
      thread.querySelector("yt-formatted-string#content-text") ||
      thread.querySelector("#content yt-formatted-string");
    const likesEl =
      thread.querySelector("#vote-count-middle") ||
      thread.querySelector("span#vote-count-middle");

    const text = normalizeText(textEl?.textContent || "");
    const author = normalizeText(authorEl?.textContent || "Unknown");
    const likes = parseLikeCount(likesEl?.textContent || "0");

    if (text.length < 2) return null;
    if (/^(subscribe|liked|view all|show more)/i.test(text)) return null;
    return { author, text, likes };
  }

  /** Collect up to maxItems unique threads from current DOM (no final cap). */
  function scrapeCommentsPool(maxItems) {
    const threads = document.querySelectorAll("ytd-comment-thread-renderer");
    const byText = new Map();

    for (const thread of threads) {
      const item = scrapeCommentFromThread(thread);
      if (!item) continue;
      const key = item.text.toLowerCase();
      const prev = byText.get(key);
      if (!prev || item.likes > prev.likes) byText.set(key, item);
      if (byText.size >= maxItems) break;
    }
    return Array.from(byText.values());
  }

  function selectTopComments(pool, n) {
    return [...pool].sort((a, b) => b.likes - a.likes).slice(0, n);
  }

  async function scrollCommentsStep() {
    const threads = document.querySelectorAll("ytd-comment-thread-renderer");
    const last = threads[threads.length - 1];
    if (last) {
      last.scrollIntoView({ block: "end", behavior: "auto" });
      return;
    }
    const contents =
      document.querySelector("ytd-comments#comments #sections #contents") ||
      document.querySelector("ytd-item-section-renderer#sections #contents");
    if (contents) {
      contents.scrollTop += Math.max(240, contents.clientHeight * 0.75);
      return;
    }
    window.scrollBy(0, 420);
  }

  /** Gradual scroll to load more threads; bounded time/steps. */
  async function loadVisibleCommentsPool() {
    const budgetStart = Date.now();
    let lastCount = 0;
    let stagnant = 0;

    for (let step = 0; step < COMMENTS_SCROLL_STEPS; step++) {
      if (Date.now() - budgetStart > COMMENTS_LOAD_BUDGET_MS) break;

      const count = document.querySelectorAll("ytd-comment-thread-renderer").length;
      cgLog("comments_visible_loaded", { step, threads: count });

      if (count >= COMMENTS_POOL_MAX) break;
      if (count === lastCount) {
        stagnant += 1;
        if (stagnant >= 2) break;
      } else {
        stagnant = 0;
        lastCount = count;
      }

      await scrollCommentsStep();
      await sleep(COMMENTS_SCROLL_PAUSE_MS);
    }
  }

  function getPageMeta() {
    const titleEl =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1 yt-formatted-string");
    const creatorEl =
      document.querySelector("#owner #channel-name a") ||
      document.querySelector("ytd-channel-name a");

    return {
      video_url: location.href.split("&")[0],
      title: (titleEl?.textContent || document.title || "").trim(),
      creator: (creatorEl?.textContent || "").trim(),
    };
  }

  async function handleExtractTranscript() {
    setStatus("transcript", "Looking for transcript…");
    setMeta();
    cgLog("extract started", location.href);

    await openTranscriptPanel();
    const tabClicked = await ensureTranscriptTabActive();
    if (tabClicked) {
      setStatus("transcript", "Transcript tab activated — waiting for rows…");
      await sleep(400);
    }

    let detected = findTranscriptRoot();
    const domSegs = countDomSegmentNodes();
    cgLog("initial detection:", { detected, domSegs, tabClicked });

    if (detected) {
      setStatus(
        "transcript",
        `Transcript panel detected (${detected.layout})`,
        "ok"
      );
    } else if (domSegs > 0) {
      setStatus(
        "transcript",
        `Transcript rows in DOM (${domSegs}) — extracting…`,
        "ok"
      );
    } else {
      setStatus("transcript", "Transcript panel not detected — waiting…");
    }

    setStatus("transcript", "Waiting for transcript rows…");
    await waitForTranscriptRowsMutation(1200);

    const { scraped, attempt, lazyLoaded, debug } = await extractTranscriptWithRetry(
      (msg) => setStatus("transcript", msg)
    );

    transcriptText = scraped.text || "";
    const preview = panel.querySelector('[data-preview="transcript"]');

    cgLog("final:", {
      attempt,
      lazyLoaded,
      rowCount: scraped.rowCount,
      method: scraped.method,
      debug,
      chars: transcriptText.length,
    });

    if (scraped.rowCount > 0) {
      setStatus(
        "transcript",
        `Transcript rows found: ${scraped.rowCount}${lazyLoaded ? " (lazy-loaded)" : ""}`,
        "ok"
      );
      await sleep(200);
    }

    if (!transcriptText || transcriptText.length < 20) {
      preview.value = "";
      enableTranscriptActions(false);
      const d = debug || scraped.debug || {};
      const reason = [
        d.rootFound ? `layout=${d.layout}` : "no panel root",
        `dom_nodes=${d.domSegmentNodes ?? domSegs}`,
        `rows=${d.rowCount ?? 0}`,
        d.method ? `method=${d.method}` : "no selector matched",
        d.domSegmentNodes > 0 && (d.rowCount ?? 0) === 0
          ? "segments visible but text not parsed"
          : null,
      ]
        .filter(Boolean)
        .join("; ");
      setStatus(
        "transcript",
        `No transcript rows found — ${reason}. Open Transcript tab and retry.`,
        "error"
      );
      return;
    }

    preview.value =
      transcriptText.slice(0, 4000) + (transcriptText.length > 4000 ? "…" : "");
    enableTranscriptActions(true);
    setStatus(
      "transcript",
      `${scraped.rowCount} rows · ${transcriptText.length.toLocaleString()} characters extracted`,
      "ok"
    );
  }

  async function handleCopyTranscript() {
    if (!transcriptText) return;
    await navigator.clipboard.writeText(transcriptText);
    setStatus("transcript", "Copied to clipboard", "ok");
  }

  function handleExportTranscript() {
    if (!transcriptText) return;
    const meta = getPageMeta();
    const safe = (meta.title || "transcript").replace(/[^\w\-]+/g, "_").slice(0, 80);
    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe || "transcript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("transcript", "Downloaded .txt file", "ok");
  }

  async function handleSaveTranscript() {
    if (!transcriptText) return;
    const meta = getPageMeta();
    setStatus("transcript", "Saving…");

    chrome.runtime.sendMessage(
      {
        type: "SAVE_TRANSCRIPT",
        payload: {
          video_url: meta.video_url,
          title: meta.title,
          creator: meta.creator || "Unknown",
          transcript_text: transcriptText,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus("transcript", chrome.runtime.lastError.message, "error");
          return;
        }
        if (!response?.ok) {
          setStatus("transcript", response?.error || "Save failed", "error");
          return;
        }
        const r = response.result;
        const { text, statusKind } = formatTranscriptSaveStatus(r);
        setStatus("transcript", text, statusKind);
      }
    );
  }

  async function handleExtractComments() {
    setStatus("comments", "Scrolling to comments…");
    setMeta();
    try {
      await scrollToComments();
      setStatus("comments", "Sorting Top comments…");
      await ensureCommentsTopSort();
      setStatus("comments", "Loading comment threads…");
      await loadVisibleCommentsPool();
      const pool = scrapeCommentsPool(COMMENTS_POOL_MAX);
      cgLog("comments_collected", { pool: pool.length });
      commentsData = selectTopComments(pool, COMMENTS_FINAL_MAX);
      cgLog("comments_final_selected", {
        final: commentsData.length,
        topLikes: commentsData[0]?.likes ?? 0,
      });
    } catch (err) {
      console.warn("[ContentGraph] comments extract degraded", err);
      try {
        const pool = scrapeCommentsPool(COMMENTS_POOL_MAX);
        commentsData = selectTopComments(pool, COMMENTS_FINAL_MAX);
      } catch (err2) {
        console.warn("[ContentGraph] comments extract fallback failed", err2);
        commentsData = [];
      }
    }

    const preview = panel.querySelector('[data-preview="comments"]');

    if (!commentsData.length) {
      preview.value = "";
      enableCommentActions(false);
      setStatus(
        "comments",
        "No comments found — open comments on this video and retry.",
        "error"
      );
      return;
    }

    preview.value = commentsData
      .map((c, i) => `${i + 1}. [${c.likes}] ${c.author}: ${c.text.slice(0, 120)}`)
      .join("\n");
    enableCommentActions(true);
    setStatus(
      "comments",
      `${commentsData.length} top comments (by likes) extracted`,
      "ok"
    );
  }

  async function handleCopyComments() {
    if (!commentsData.length) return;
    const text = commentsData
      .map((c) => `${c.author} (${c.likes} likes): ${c.text}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setStatus("comments", "Copied to clipboard", "ok");
  }

  async function handleSaveComments() {
    if (!commentsData.length) return;
    const meta = getPageMeta();
    setStatus("comments", "Saving comments…");

    chrome.runtime.sendMessage(
      {
        type: "SAVE_COMMENTS",
        payload: {
          video_url: meta.video_url,
          title: meta.title,
          creator: meta.creator || "Unknown",
          comments: commentsData.map((c) => ({
            author: c.author,
            text: c.text,
            likes: c.likes,
          })),
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus("comments", chrome.runtime.lastError.message, "error");
          return;
        }
        if (!response?.ok) {
          setStatus("comments", response?.error || "Save failed", "error");
          return;
        }
        const r = response.result;
        const { text, statusKind } = formatCommentsSaveStatus(r);
        setStatus("comments", text, statusKind);
      }
    );
  }

  setMeta();
})();
