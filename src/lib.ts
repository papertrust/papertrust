import YAML from "yaml";
import type { ArxivPaper, PaperTrustData } from "./types";

export const DATA_REPO = "papertrust/papertrust-data";

export const TAGS = [
  "artifact_missing",
  "artifact_broken",
  "artifact_incomplete",
  "checkpoint_missing",
  "training_code_missing",
  "evaluation_code_missing",
  "raw_results_missing",
  "benchmark_mismatch",
  "metric_mismatch",
  "performance_mismatch",
  "training_mismatch",
  "documentation_incomplete",
  "undocumented_configuration",
  "version_mismatch",
  "independent_reproduction",
  "author_reproduction",
  "corrected",
  "resolved",
  "disputed",
] as const;

export const RESULTS = [
  "reproduced",
  "partially_reproduced",
  "not_reproduced",
  "inconclusive",
] as const;

const DOI_RE = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/;
const RAW_HTML_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>|<!--/i;
const DANGEROUS_SCHEME_RE = /(?:javascript|vbscript|data)\s*:/i;
const IMAGE_MARKDOWN_RE = /!\[/;
const RESERVED_HEADING_RE = /^### (?:arXiv ID|Paper version|Result|Tags|Summary|Evidence DOI)\s*$/m;
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g;

export function normalizeArxivId(input: string): string | null {
  let value = input.trim();
  value = value
    .replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "")
    .replace(/^arxiv:/i, "")
    .trim();

  const modern = value.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
  if (modern) return modern[1];

  const legacy = value.match(/^([a-z-]+\/\d{7})(?:v\d+)?$/i);
  return legacy ? legacy[1] : null;
}

export function normalizeDoi(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  value = value
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim();
  return DOI_RE.test(value) ? value : null;
}

export function summaryProblem(summary: string): string | null {
  const value = summary.trim();
  if (value.length < 20) return "Summary must be at least 20 characters.";
  if (value.length > 4000) return "Summary must be 4000 characters or fewer.";
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    })
  ) {
    return "Control characters are not allowed.";
  }
  if (RAW_HTML_RE.test(value)) return "Raw HTML is not allowed.";
  if (DANGEROUS_SCHEME_RE.test(value)) return "Dangerous URL schemes are not allowed.";
  if (IMAGE_MARKDOWN_RE.test(value)) return "Embedded Markdown images are not allowed.";
  if (RESERVED_HEADING_RE.test(value)) return "Reserved PaperTrust field headings are not allowed in summaries.";
  for (const match of value.matchAll(MARKDOWN_LINK_RE)) {
    try {
      const url = new URL(match[1]);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Markdown links must use HTTP or HTTPS.";
      }
    } catch {
      return "Markdown links must use absolute HTTP(S) URLs.";
    }
  }
  return null;
}

export function paperVersionOptions(latestVersion: string): string[] {
  const match = /^v([1-9]\d*)$/.exec(latestVersion);
  if (!match) return ["latest"];
  const latest = Number(match[1]);
  return Array.from({ length: latest }, (_, index) => `v${latest - index}`);
}

export async function fetchArxivPaper(id: string): Promise<ArxivPaper> {
  const response = await fetch(`/api/arxiv?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("Paper not found on arXiv.");

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const entry = doc.querySelector("entry");
  if (!entry) throw new Error("Paper not found on arXiv.");

  const text = (selector: string) =>
    entry.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  const links = Array.from(entry.querySelectorAll("link"));
  const entryId = text("id");
  const versionMatch = entryId.match(/v([1-9]\d*)$/);
  const latestVersion = versionMatch ? `v${versionMatch[1]}` : "latest";

  return {
    id,
    latestVersion,
    title: text("title"),
    summary: text("summary"),
    authors: Array.from(entry.querySelectorAll("author > name")).map((node) => ({
      name: node.textContent?.trim() ?? "",
    })),
    published: text("published"),
    updated: text("updated"),
    categories: Array.from(entry.querySelectorAll("category"))
      .map((node) => node.getAttribute("term") ?? "")
      .filter(Boolean),
    pdfUrl:
      links.find((node) => node.getAttribute("title") === "pdf")?.getAttribute("href") ??
      `https://arxiv.org/pdf/${id}`,
    absUrl:
      links.find((node) => node.getAttribute("rel") === "alternate")?.getAttribute("href") ??
      `https://arxiv.org/abs/${id}`,
  };
}

export async function fetchPaperTrustData(id: string): Promise<PaperTrustData | null> {
  const response = await fetch(`/api/record?id=${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load the PaperTrust record.");

  return YAML.parse(await response.text()) as PaperTrustData;
}

function withOptionalEvidence<T extends Record<string, unknown>>(record: T, evidence: string): T {
  const doi = normalizeDoi(evidence);
  return doi ? ({ ...record, evidence: [doi] } as T) : record;
}

export function issueUrl(params: {
  arxivId: string;
  paperVersion: string;
  result: string;
  tags: string[];
  summary: string;
  evidence: string;
}): string {
  const query = new URLSearchParams({
    template: "reproduction.yml",
    title: `[Reproduction] arXiv:${params.arxivId} ${params.paperVersion}`,
    arxiv: params.arxivId,
    paper_version: params.paperVersion,
    result: params.result,
    tags: params.tags.join(", "),
    summary: params.summary.trim(),
  });
  const doi = normalizeDoi(params.evidence);
  if (doi) query.set("evidence", doi);

  return `https://github.com/${DATA_REPO}/issues/new?${query}`;
}

export function artifactIssueUrl(params: {
  arxivId: string;
  paperVersion: string;
  tags: string[];
  summary: string;
  evidence: string;
}): string {
  const query = new URLSearchParams({
    template: "artifact-review.yml",
    title: `[Artifact review] arXiv:${params.arxivId} ${params.paperVersion}`,
    arxiv: params.arxivId,
    paper_version: params.paperVersion,
    tags: params.tags.join(", "),
    summary: params.summary.trim(),
  });
  const doi = normalizeDoi(params.evidence);
  if (doi) query.set("evidence", doi);

  return `https://github.com/${DATA_REPO}/issues/new?${query}`;
}

export function recordYaml(params: {
  paperVersion: string;
  result: string;
  tags: string[];
  summary: string;
  evidence: string;
}) {
  return YAML.stringify({
    records: [
      withOptionalEvidence(
        {
          type: "reproduction",
          paper_version: params.paperVersion,
          result: params.result,
          tags: params.tags,
          summary: params.summary.trim(),
        },
        params.evidence,
      ),
    ],
  });
}

export function artifactRecordYaml(params: {
  paperVersion: string;
  tags: string[];
  summary: string;
  evidence: string;
}) {
  return YAML.stringify({
    records: [
      withOptionalEvidence(
        {
          type: "artifact_review",
          paper_version: params.paperVersion,
          tags: params.tags,
          summary: params.summary.trim(),
        },
        params.evidence,
      ),
    ],
  });
}
