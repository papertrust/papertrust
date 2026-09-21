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

  return {
    id,
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

  const parsed = YAML.parse(await response.text()) as PaperTrustData;
  return parsed;
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
    evidence: params.evidence.trim(),
  });

  return `https://github.com/${DATA_REPO}/issues/new?${query}`;
}

export function artifactIssueUrl(params: {
  arxivId: string;
  tags: string[];
  summary: string;
  evidence: string;
}): string {
  const query = new URLSearchParams({
    template: "artifact-review.yml",
    title: `[Artifact review] arXiv:${params.arxivId}`,
    arxiv: params.arxivId,
    tags: params.tags.join(", "),
    summary: params.summary.trim(),
    evidence: params.evidence.trim(),
  });

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
      {
        type: "reproduction",
        paper_version: params.paperVersion,
        result: params.result,
        tags: params.tags,
        summary: params.summary.trim(),
        evidence: [params.evidence.trim()],
      },
    ],
  });
}

export function artifactRecordYaml(params: {
  tags: string[];
  summary: string;
  evidence: string;
}) {
  return YAML.stringify({
    records: [
      {
        type: "artifact_review",
        tags: params.tags,
        summary: params.summary.trim(),
        evidence: [params.evidence.trim()],
      },
    ],
  });
}
