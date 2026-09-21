import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  GitPullRequest,
  Fingerprint,
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

const SITE_ORIGIN = "https://papertrust.org";
const DEFAULT_DESCRIPTION =
  "PaperTrust — an open, evidence-backed reproducibility ledger for computer-science papers.";

function upsertHeadMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setDocumentSeo({
  title,
  description,
  canonical,
  robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  ogType = "website",
}: {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  ogType?: string;
}) {
  document.title = title;
  upsertHeadMeta("name", "description", description);
  upsertHeadMeta("name", "robots", robots);
  upsertHeadMeta("property", "og:title", title);
  upsertHeadMeta("property", "og:description", description);
  upsertHeadMeta("property", "og:url", canonical);
  upsertHeadMeta("property", "og:type", ogType);
  upsertHeadMeta("property", "og:image", `${SITE_ORIGIN}/brand/logo-512.png`);
  upsertHeadMeta("name", "twitter:card", "summary");
  upsertHeadMeta("name", "twitter:title", title);
  upsertHeadMeta("name", "twitter:description", description);
  upsertHeadMeta("name", "twitter:image", `${SITE_ORIGIN}/brand/logo-512.png`);

  let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    document.head.append(canonicalLink);
  }
  canonicalLink.href = canonical;
}

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
    themeColor?.setAttribute("content", theme === "dark" ? "#111b17" : "#f8f7f3");
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
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);

    if (pathname === "/") {
      setDocumentSeo({
        title: "PaperTrust",
        description: DEFAULT_DESCRIPTION,
        canonical: `${SITE_ORIGIN}/`,
      });
    } else if (pathname === "/about") {
      setDocumentSeo({
        title: "About · PaperTrust",
        description:
          "Why PaperTrust preserves reviewed reproduction evidence, artifact findings, and the technical history around scientific claims.",
        canonical: `${SITE_ORIGIN}/about`,
      });
    } else if (pathname.startsWith("/submit/")) {
      const artifact = pathname === "/submit/artifact-review";
      setDocumentSeo({
        title: artifact ? "Review artifacts · PaperTrust" : "Submit a reproduction · PaperTrust",
        description: artifact
          ? "Submit an artifact availability review to the PaperTrust public evidence ledger."
          : "Submit a reproduction result to the PaperTrust public evidence ledger.",
        canonical: `${SITE_ORIGIN}${pathname}`,
        robots: "noindex,follow",
      });
    } else if (!pathname.startsWith("/paper/")) {
      setDocumentSeo({
        title: "Page not found · PaperTrust",
        description: "This address does not point to a PaperTrust page.",
        canonical: `${SITE_ORIGIN}${pathname}`,
        robots: "noindex,follow",
      });
    }
  }, [pathname]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="nav">
        <Link className="brand" to="/">
          <img className="brand-logo" src="/brand/logo-mark.svg" alt="" />
          <span>PaperTrust</span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/about" aria-current={pathname === "/about" ? "page" : undefined}>About</Link>
          <a href={`https://github.com/${DATA_REPO}`} target="_blank" rel="noreferrer">
            Data <ArrowUpRight size={13} />
          </a>
          <a href="https://github.com/papertrust/papertrust" target="_blank" rel="noreferrer">
            Source <ArrowUpRight size={13} />
          </a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer>
        <Link className="footer-brand" to="/"><img src="/brand/logo-mark.svg" alt="" />PaperTrust<span>Evidence, not verdicts.</span></Link>
        <span className="footer-actions">
          <span>Open records. Lasting evidence.</span>
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
    <form className="search-wrap" onSubmit={submit} role="search">
      <label className="search-label" htmlFor="paper-search">Find a paper. Explore the evidence.</label>
      <div className="search-box">
        <Search size={20} />
        <input
          id="paper-search"
          aria-invalid={!!error}
          aria-describedby={error ? "search-error" : "search-hint"}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder="Paste an arXiv ID or URL"
          aria-label="Search by arXiv ID"
        />
        <button type="submit">
          Open paper <ArrowRight size={18} />
        </button>
      </div>
      {error && <p id="search-error" className="form-error" role="alert">{error}</p>}
      <p className="search-hint" id="search-hint">Accepts arXiv identifiers and links · format: YYMM.NNNNN</p>
    </form>
  );
}

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span className="status-dot" />An open ledger for computer science</div>
          <h1>Scientific claims.<br /><span>Inspectable evidence.</span></h1>
          <p className="hero-copy">
            A shared record of what holds up, what falls short, and what remains
            to be reproduced. Built around evidence. Open to everyone.
          </p>
          <SearchBox />
          <div className="hero-links">
            <Link to="/about">How PaperTrust works <ArrowRight size={15} /></Link>
            <span><ShieldCheck size={15} /> Publicly reviewed records</span>
          </div>
        </div>
        <figure className="ledger-figure">
          <div className="figure-heading"><span>THE EVIDENCE LEDGER</span><span>FIG. 01</span></div>
          <div className="ledger-sheet">
            <div className="sheet-heading"><BookOpen size={20} /><span>One paper.<br /><strong>A traceable record.</strong></span><span className="sheet-index">[ P ]</span></div>
            <div className="ledger-entry"><span className="entry-index">01</span><div><h3>Reproduction</h3><p>Methods, conditions &amp; observed results</p></div><FileCheck2 size={18} /></div>
            <div className="ledger-entry"><span className="entry-index">02</span><div><h3>Artifact review</h3><p>Code, data &amp; model availability</p></div><Search size={18} /></div>
            <div className="ledger-entry"><span className="entry-index">03</span><div><h3>Persistent evidence</h3><p>Independent, citable references</p></div><Fingerprint size={18} /></div>
            <div className="sheet-foot"><GitPullRequest size={15} /><span>Reviewed in public. Preserved in Git.</span></div>
          </div>
          <figcaption><span className="figure-rule" />Evidence, not verdicts.<br />A record to inspect, never a score to trust.</figcaption>
        </figure>
      </section>

      <section className="principles" aria-labelledby="principles-title">
        <div className="principles-intro"><span className="eyebrow">THE PRINCIPLES</span><h2 id="principles-title">Clarity at every step.</h2><p>From an independent attempt<br />to a shared scientific record.</p></div>
        <article><span className="number">01 / DOCUMENT</span><h3>Specific by design.</h3><p>What was attempted, which version was used, and what actually happened. Every record starts with the details.</p></article>
        <article><span className="number">02 / SUBSTANTIATE</span><h3>Evidence comes first.</h3><p>Connect findings to inspectable sources. Persistent DOIs are encouraged for independently archived evidence.</p></article>
        <article><span className="number">03 / REVIEW</span><h3>Open to scrutiny.</h3><p>Submissions are discussed in public. Only reviewed, merged changes enter the canonical ledger.</p></article>
      </section>

      <section className="contribute">
        <div><span className="eyebrow">SCIENCE IS A COLLECTIVE EFFORT</span><h2>Make your findings part of the record.</h2><p>Reproduced a result? Checked the artifacts? Share what you found.</p></div>
        <div className="contribute-actions"><Link className="button" to="/submit/reproduction">Submit a reproduction <ArrowUpRight size={17} /></Link></div>
      </section>
    </div>
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

  useEffect(() => {
    const canonicalPath = id.split("/").map(encodeURIComponent).join("/");

    if (error) {
      setDocumentSeo({
        title: `arXiv:${id} · PaperTrust`,
        description: `PaperTrust evidence page for arXiv:${id}. Paper metadata could not be loaded.`,
        canonical: `${SITE_ORIGIN}/paper/${canonicalPath}`,
        robots: "noindex,follow",
      });
      return;
    }

    if (!paper || data === undefined) return;
    const count = data?.records.length ?? 0;
    const recordPhrase = count === 1 ? "1 reviewed PaperTrust record" : `${count} reviewed PaperTrust records`;
    setDocumentSeo({
      title: `${paper.title} · PaperTrust`,
      description: `${paper.title} — arXiv:${id}. ${recordPhrase} with reproducibility and artifact evidence.`.slice(0, 300),
      canonical: `${SITE_ORIGIN}/paper/${canonicalPath}`,
      robots: count
        ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
        : "noindex,follow",
      ogType: "article",
    });
  }, [data, error, id, paper]);

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
        <div className="loading" role="status"><span className="loading-mark" /><h2>Opening the record</h2><p>Resolving arXiv metadata and PaperTrust records…</p></div>
      </section>
    );
  }

  return (
    <section className="page paper-page">
      <Link className="back-link" to="/">← Find another paper</Link>
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
      <Link className="back-link" to={preset ? `/paper/${preset}` : "/"}>{preset ? "← Back to paper" : "← Back to the ledger"}</Link>
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
          <input value={arxivId} onChange={(event) => setArxivId(event.target.value)} placeholder="YYMM.NNNNN" />
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
                aria-pressed={tags.includes(tag)}
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
          <button className="button ghost wide" type="button" aria-expanded={yamlOpen} onClick={() => setYamlOpen((value) => !value)}>
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
      <Link className="back-link" to={preset ? `/paper/${preset}` : "/"}>{preset ? "← Back to paper" : "← Back to the ledger"}</Link>
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
          <input value={arxivId} onChange={(event) => setArxivId(event.target.value)} placeholder="YYMM.NNNNN" />
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
                aria-pressed={tags.includes(tag)}
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
          <button className="button ghost wide" type="button" aria-expanded={yamlOpen} onClick={() => setYamlOpen((value) => !value)}>
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
      <div className="eyebrow">Why PaperTrust exists</div>
      <h1>A longer memory for scientific evidence.</h1>
      <p>
        Science has a long memory for citations and a surprisingly short one for details. A paper can travel quickly
        through a field while the evidence around it is scattered across repositories, issue threads, lab notes,
        benchmark scripts, revised checkpoints, and conversations that are difficult to find a year later. Someone
        returning to the work often has to reconstruct that history from fragments.
      </p>
      <p>
        Those fragments matter. Reproducibility is rarely a single yes-or-no event: a result may depend on an exact
        paper version, an undocumented flag, a particular evaluation script, a dataset revision, or an artifact that
        appeared months after publication. Failed attempts can be informative. So can partial successes, corrections,
        and careful reports that simply establish what was publicly available at a given moment.
      </p>

      <div className="about-rule"><BookOpen size={20} /><span>A shared scientific record, built in the open.</span></div>

      <h2>The gap we want to close</h2>
      <p>
        The formal literature is very good at preserving claims, arguments, and credit. The living technical history
        around a paper has fewer durable places to go. Independent reproduction work is often buried in personal
        repositories or short-lived discussion threads; negative results are especially easy to lose. The next person
        then pays the same investigative cost again.
      </p>
      <p>
        PaperTrust gives that work a small, durable home. Each record is scoped to a specific paper version and says
        what was checked, what happened, and where the supporting evidence can be inspected. The canonical ledger is
        plain data in Git. Submissions arrive through public issues, proposed changes are reviewed as pull requests,
        and the merged history remains available for anyone to audit.
      </p>

      <h2>Evidence should keep its context</h2>
      <p>
        A single score would compress away much of what makes reproducibility evidence useful. Conditions change,
        artifacts improve, software rots, and two careful groups can reach different outcomes for understandable
        reasons. PaperTrust keeps the underlying observations visible so readers can weigh them in context. Records can
        coexist, be challenged, and be followed by later evidence without erasing the path that led there.
      </p>
      <p>
        That is also why the ledger stores relatively little: record type, exact paper version, structured result and
        tags, a written summary, and optional persistent evidence references. arXiv remains the source for paper
        metadata. Git remains the source for authorship, review history, and change history. Keeping those boundaries
        clear makes the record easier to inspect and harder to quietly rewrite.
      </p>

      <h2>The academic world we hope for</h2>
      <p>
        We would like reproducibility work to feel like a first-class scholarly contribution. We would like corrections
        to be ordinary, negative results to remain discoverable, and released artifacts to stay connected to the claims
        they support. A researcher encountering an unfamiliar paper should be able to see more than its citation count:
        what others tried, which version they used, what evidence survived, and where uncertainty still remains.
      </p>
      <p>
        Scrutiny can be a form of care for the scientific record. Done well, it helps good work age gracefully and
        gives future work firmer ground. Our hope is modest: a literature with a longer memory, a shorter distance
        between claim and evidence, and a little less knowledge lost between publication and replication. PaperTrust is
        one small piece of infrastructure toward that world.
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
          <Route path="*" element={<section className="page narrow prose"><div className="eyebrow">404 / Page not found</div><h1>A page yet to be written.</h1><p>This address does not point to a PaperTrust page.</p><Link className="button" to="/">Back to the ledger <ArrowRight size={16} /></Link></section>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
