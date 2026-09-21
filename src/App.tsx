import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Moon,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  DATA_REPO,
  RESULTS,
  TAGS,
  artifactIssueUrl,
  artifactRecordYaml,
  fetchArxivPaper,
  fetchPaperTrustData,
  issueUrl,
  normalizeArxivId,
  normalizeDoi,
  paperVersionOptions,
  recordYaml,
  summaryProblem,
} from "./lib";
import { SafeMarkdown } from "./SafeMarkdown";
import type { ArxivPaper, PaperTrustData, PaperTrustRecord } from "./types";
import "./styles.css";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [preference, setPreference] = useState<Theme | null>(() => {
    const stored = localStorage.getItem("papertrust-theme");
    return stored === "light" || stored === "dark" ? stored : null;
  });
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const theme = preference ?? systemTheme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute("content", theme === "dark" ? "#111411" : "#f5f6f2");
  }, [theme]);

  useEffect(() => {
    if (preference) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("papertrust-theme", next);
    setPreference(next);
  }

  return { theme, toggleTheme };
}

function Shell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="site-shell">
      <header className="nav">
        <Link className="brand" to="/">
          <img className="brand-logo" src="/brand/logo-mark.svg" alt="" />
          <span>PaperTrust</span>
        </Link>
        <nav className="nav-links">
          <Link to="/about">About</Link>
          <a href={`https://github.com/${DATA_REPO}`} target="_blank" rel="noreferrer">
            Data
          </a>
          <a href="https://github.com/papertrust/papertrust" target="_blank" rel="noreferrer">
            Source
          </a>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <span>Evidence, not verdicts.</span>
        <span className="footer-actions">
          <span>Canonical records live in the public Git ledger.</span>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </span>
      </footer>
    </div>
  );
}

function SearchBox({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const id = normalizeArxivId(value);
    if (!id) {
      setError("Enter an arXiv ID or arXiv URL.");
      return;
    }
    navigate(`/paper/${id}`);
  }

  return (
    <form className="search-wrap" onSubmit={submit}>
      <div className="search-box">
        <Search size={20} />
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder="arXiv ID or URL"
          aria-label="Search by arXiv ID"
        />
        <button type="submit">
          Open paper <ArrowRight size={18} />
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function Home() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Open reproducibility ledger for computer science</div>
        <h1>
          Scientific claims deserve
          <span> inspectable evidence.</span>
        </h1>
        <p className="hero-copy">
          PaperTrust records reviewed reproductions and artifact findings without trying to decide whether a
          paper is “true.” Every accepted record is evidence-backed and preserved in a public Git history.
        </p>
        <SearchBox />
        <div className="hero-note">
          <ShieldCheck size={18} />
          Papers are indexed lazily. If an arXiv paper has never been discussed, PaperTrust stores nothing about it.
        </div>
      </section>

      <section className="principles">
        <article>
          <span className="number">01</span>
          <h2>Paper-level records</h2>
          <p>No claim graph. A record says what was attempted, what happened, and where the evidence lives.</p>
        </article>
        <article>
          <span className="number">02</span>
          <h2>Independent evidence</h2>
          <p>A persistent DOI is encouraged when independently archived evidence is available.</p>
        </article>
        <article>
          <span className="number">03</span>
          <h2>Public review trail</h2>
          <p>Issues carry submissions and discussion. Merged pull requests define the canonical ledger.</p>
        </article>
      </section>
    </>
  );
}

function ResultPill({ result }: { result?: string }) {
  if (!result) return null;
  return <span className={`result result-${result}`}>{result.replaceAll("_", " ")}</span>;
}

function RecordCard({ record }: { record: PaperTrustRecord }) {
  return (
    <article className="record-card">
      <div className="record-head">
        <div>
          <span className="record-type">{record.type.replaceAll("_", " ")}</span>
          {record.paper_version && <span className="paper-version">{record.paper_version}</span>}
        </div>
        <ResultPill result={record.result} />
      </div>
      <SafeMarkdown>{record.summary}</SafeMarkdown>
      {!!record.tags?.length && (
        <div className="tag-list">
          {record.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}
      {!!record.evidence?.length && (
        <div className="evidence">
          {record.evidence.map((doi) => (
            <a key={doi} href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
              Evidence · {doi} <ExternalLink size={14} />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function PaperPageContent({ id }: { id: string }) {
  const [paper, setPaper] = useState<ArxivPaper | null>(null);
  const [data, setData] = useState<PaperTrustData | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchArxivPaper(id), fetchPaperTrustData(id)])
      .then(([paperResult, dataResult]) => {
        if (!active) return;
        setError("");
        setPaper(paperResult);
        setData(dataResult);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load paper.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <section className="page narrow">
        <div className="notice error-notice">
          <CircleAlert />
          <div>
            <h2>Could not load this paper</h2>
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!paper || data === undefined) {
    return (
      <section className="page narrow">
        <div className="loading">Resolving arXiv metadata and PaperTrust records…</div>
      </section>
    );
  }

  return (
    <section className="page paper-page">
      <div className="paper-kicker">
        <span>arXiv:{id}</span>
        {paper.categories.slice(0, 3).map((category) => (
          <span key={category}>{category}</span>
        ))}
      </div>
      <h1 className="paper-title">{paper.title}</h1>
      <p className="authors">{paper.authors.map((author) => author.name).join(" · ")}</p>
      <div className="paper-actions">
        <a className="button ghost" href={paper.absUrl} target="_blank" rel="noreferrer">
          arXiv <ExternalLink size={16} />
        </a>
        <Link className="button" to={`/submit/reproduction?paper=${encodeURIComponent(id)}`}>
          Submit reproduction <ChevronRight size={17} />
        </Link>
        <Link className="button ghost" to={`/submit/artifact-review?paper=${encodeURIComponent(id)}`}>
          Review artifacts
        </Link>
      </div>

      <div className="paper-grid">
        <div>
          <section className="section-block">
            <div className="section-title">
              <div>
                <span className="section-label">PaperTrust ledger</span>
                <h2>Reviewed records</h2>
              </div>
              <span className="count">{data?.records.length ?? 0}</span>
            </div>
            {data?.records.length ? (
              <div className="records">
                {data.records.map((record, index) => (
                  <RecordCard record={record} key={index} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileCheck2 size={24} />
                <h3>No PaperTrust record yet</h3>
                <p>This paper is not indexed in the ledger until a reviewed community record is merged.</p>
                <Link to={`/submit/reproduction?paper=${encodeURIComponent(id)}`}>
                  Be the first to submit a reproduction <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </section>
        </div>
        <aside>
          <div className="side-card">
            <span className="section-label">About this view</span>
            <p>
              Paper metadata comes from arXiv. PaperTrust stores only reviewed reproducibility records and evidence
              references.
            </p>
          </div>
          <div className="side-card">
            <span className="section-label">Abstract</span>
            <p className="abstract">{paper.summary}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function PaperPage() {
  const { "*": rawId } = useParams();
  const id = rawId ? decodeURIComponent(rawId) : "";
  return <PaperPageContent key={id} id={id} />;
}

function usePaperVersions(arxivId: string) {
  const normalized = normalizeArxivId(arxivId);
  const [latestVersion, setLatestVersion] = useState("latest");

  useEffect(() => {
    if (!normalized) return;

    let active = true;
    fetchArxivPaper(normalized)
      .then((paper) => {
        if (active) setLatestVersion(paper.latestVersion);
      })
      .catch(() => {
        if (active) setLatestVersion("latest");
      });

    return () => {
      active = false;
    };
  }, [normalized]);

  return {
    latestVersion,
    options: useMemo(() => paperVersionOptions(latestVersion), [latestVersion]),
  };
}

function VersionSelect({
  arxivId,
  value,
  onChange,
}: {
  arxivId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { latestVersion, options } = usePaperVersions(arxivId);

  useEffect(() => {
    if (latestVersion !== "latest" && (value === "latest" || !options.includes(value))) {
      onChange(latestVersion);
    }
  }, [latestVersion, onChange, options, value]);

  const rendered = latestVersion === "latest" ? ["latest"] : options;
  return (
    <label>
      <span>Paper version</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {rendered.map((version, index) => (
          <option key={version} value={version}>
            {index === 0 && latestVersion !== "latest" ? `${version} (latest)` : version}
          </option>
        ))}
      </select>
      <small>Defaults to the current arXiv version; canonical records always store an exact version.</small>
    </label>
  );
}

function SubmissionPage() {
  const [search] = useSearchParams();
  const preset = normalizeArxivId(search.get("paper") ?? "") ?? "";
  const [arxivId, setArxivId] = useState(preset);
  const [paperVersion, setPaperVersion] = useState("latest");
  const [result, setResult] = useState<(typeof RESULTS)[number]>("reproduced");
  const [tags, setTags] = useState<string[]>(["independent_reproduction"]);
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [yamlOpen, setYamlOpen] = useState(false);

  const summaryError = summary ? summaryProblem(summary) : null;
  const doiValid = !evidence.trim() || normalizeDoi(evidence) !== null;
  const valid = useMemo(
    () =>
      !!normalizeArxivId(arxivId) &&
      (paperVersion === "latest" || /^v[1-9]\d*$/.test(paperVersion)) &&
      !summaryProblem(summary) &&
      doiValid &&
      tags.length > 0,
    [arxivId, paperVersion, summary, doiValid, tags],
  );

  const normalized = normalizeArxivId(arxivId) ?? "";
  const url = valid
    ? issueUrl({ arxivId: normalized, paperVersion, result, tags, summary, evidence })
    : "#";
  const yaml = recordYaml({ paperVersion, result, tags, summary, evidence });

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  return (
    <section className="page submit-page">
      <div className="submit-heading">
        <div className="eyebrow">Community submission</div>
        <h1>Submit a reproduction</h1>
        <p>
          PaperTrust fills GitHub's structured issue form for you. Review the pre-filled fields on GitHub and submit
          the issue from your own account; only a reviewed and merged data change becomes canonical.
        </p>
      </div>

      <div className="form-card">
        <label>
          <span>arXiv ID</span>
          <input value={arxivId} onChange={(event) => setArxivId(event.target.value)} placeholder="2511.15927" />
        </label>
        <VersionSelect arxivId={arxivId} value={paperVersion} onChange={setPaperVersion} />
        <label>
          <span>Outcome</span>
          <select
            value={result}
            onChange={(event) => setResult(event.target.value as (typeof RESULTS)[number])}
          >
            {RESULTS.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Tags</legend>
          <p>Select structured attributes that make this record statistically useful.</p>
          <div className="tag-picker">
            {TAGS.map((tag) => (
              <button
                type="button"
                className={tags.includes(tag) ? "tag-choice active" : "tag-choice"}
                onClick={() => toggleTag(tag)}
                key={tag}
              >
                {tags.includes(tag) && <Check size={14} />}
                {tag.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Summary</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe what was reproduced, the important setup details, and the observed result."
            rows={7}
          />
          <small className={summaryError ? "form-error" : undefined}>
            {summaryError ?? `${summary.trim().length}/4000 · Markdown supported`}
          </small>
        </label>

        {summary.trim() && !summaryError && (
          <div className="markdown-preview">
            <span className="section-label">Preview</span>
            <SafeMarkdown>{summary}</SafeMarkdown>
          </div>
        )}

        <label>
          <span>Evidence DOI <em>optional</em></span>
          <input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="10.5281/zenodo.1234567"
          />
          <small className={!doiValid ? "form-error" : undefined}>
            {!doiValid
              ? "Enter a valid DOI or leave this field blank."
              : "Optional but encouraged when independently archived evidence is available."}
          </small>
        </label>

        <div className="submit-actions">
          <a
            className={valid ? "button primary wide" : "button primary wide disabled"}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!valid}
            onClick={(event) => !valid && event.preventDefault()}
          >
            Review and submit on GitHub
          </a>
          <button className="button ghost wide" type="button" onClick={() => setYamlOpen((value) => !value)}>
            {yamlOpen ? "Hide" : "Preview"} canonical record
          </button>
        </div>

        {yamlOpen && <pre className="yaml-preview">{yaml}</pre>}
      </div>
    </section>
  );
}


function ArtifactSubmissionPage() {
  const [search] = useSearchParams();
  const preset = normalizeArxivId(search.get("paper") ?? "") ?? "";
  const [arxivId, setArxivId] = useState(preset);
  const [paperVersion, setPaperVersion] = useState("latest");
  const [tags, setTags] = useState<string[]>(["checkpoint_missing"]);
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [yamlOpen, setYamlOpen] = useState(false);

  const summaryError = summary ? summaryProblem(summary) : null;
  const doiValid = !evidence.trim() || normalizeDoi(evidence) !== null;
  const valid = useMemo(
    () =>
      !!normalizeArxivId(arxivId) &&
      (paperVersion === "latest" || /^v[1-9]\d*$/.test(paperVersion)) &&
      !summaryProblem(summary) &&
      doiValid &&
      tags.length > 0,
    [arxivId, paperVersion, summary, doiValid, tags],
  );

  const normalized = normalizeArxivId(arxivId) ?? "";
  const url = valid
    ? artifactIssueUrl({ arxivId: normalized, paperVersion, tags, summary, evidence })
    : "#";
  const yaml = artifactRecordYaml({ paperVersion, tags, summary, evidence });

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  return (
    <section className="page submit-page">
      <div className="submit-heading">
        <div className="eyebrow">Community submission</div>
        <h1>Submit an artifact review</h1>
        <p>
          Record verifiable facts about the public artifacts available for a paper. Missing artifacts are not
          treated as evidence of misconduct; PaperTrust pre-fills the GitHub form so you only need to review and
          submit it.
        </p>
      </div>

      <div className="form-card">
        <label>
          <span>arXiv ID</span>
          <input value={arxivId} onChange={(event) => setArxivId(event.target.value)} placeholder="2511.15927" />
        </label>

        <VersionSelect arxivId={arxivId} value={paperVersion} onChange={setPaperVersion} />

        <fieldset>
          <legend>Tags</legend>
          <p>Select the structured artifact findings supported by your archived evidence.</p>
          <div className="tag-picker">
            {TAGS.map((tag) => (
              <button
                type="button"
                className={tags.includes(tag) ? "tag-choice active" : "tag-choice"}
                onClick={() => toggleTag(tag)}
                key={tag}
              >
                {tags.includes(tag) && <Check size={14} />}
                {tag.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Summary</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="State what official resources were checked and what public artifacts were or were not found."
            rows={7}
          />
          <small className={summaryError ? "form-error" : undefined}>
            {summaryError ?? `${summary.trim().length}/4000 · Markdown supported`}
          </small>
        </label>

        {summary.trim() && !summaryError && (
          <div className="markdown-preview">
            <span className="section-label">Preview</span>
            <SafeMarkdown>{summary}</SafeMarkdown>
          </div>
        )}

        <label>
          <span>Evidence DOI <em>optional</em></span>
          <input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="10.5281/zenodo.1234567"
          />
          <small className={!doiValid ? "form-error" : undefined}>
            {!doiValid
              ? "Enter a valid DOI or leave this field blank."
              : "Optional but encouraged when independently archived evidence is available."}
          </small>
        </label>

        <div className="submit-actions">
          <a
            className={valid ? "button primary wide" : "button primary wide disabled"}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!valid}
            onClick={(event) => !valid && event.preventDefault()}
          >
            Review and submit on GitHub
          </a>
          <button className="button ghost wide" type="button" onClick={() => setYamlOpen((value) => !value)}>
            {yamlOpen ? "Hide" : "Preview"} canonical record
          </button>
        </div>

        {yamlOpen && <pre className="yaml-preview">{yaml}</pre>}
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="page narrow prose">
      <div className="eyebrow">Method</div>
      <h1>Evidence, not verdicts.</h1>
      <p>
        PaperTrust is a public record of reviewed reproduction attempts and artifact findings. It does not assign a
        trust score, decide whether a paper is true, or infer misconduct from missing artifacts.
      </p>
      <h2>What is canonical?</h2>
      <p>
        GitHub issues carry submissions and discussion. Pull requests carry reviewed changes. Only data merged into
        the public <code>papertrust-data</code> repository is canonical.
      </p>
      <h2>What is stored?</h2>
      <p>
        Only PaperTrust-specific records: record type, the exact paper version, structured result and tags, a Markdown
        summary, and optional persistent evidence references. arXiv metadata is resolved on demand.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/paper/*" element={<PaperPage />} />
          <Route path="/submit/reproduction" element={<SubmissionPage />} />
          <Route path="/submit/artifact-review" element={<ArtifactSubmissionPage />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
