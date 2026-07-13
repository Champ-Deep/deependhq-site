"use client";
// LiveRepos : live GitHub repo cards. Port of LiveRepos and RepoCard from
// CommandPage.jsx. Same endpoint, same 6 second abort, same curated fallback
// list when the API is unreachable.

import { useEffect, useState } from "react";
import { langColor, relTime } from "./flair";

const REPO_SHOW = [
  { m: "champmail", n: "ChampMail", d: "email outreach automation. human-cadence sending, self-hosted smtp.", lang: "Python" },
  { m: "champdf", n: "ChamPDF", d: "pdf extraction and processing for the presales floor.", lang: "JavaScript" },
  { m: "champiq", n: "Champ IQ", d: "the ai sdr orchestration layer. graph-driven prospecting.", lang: "Python" },
  { m: "champlens", n: "ChampLens", d: "qr-to-video ar business cards. scan a card, meet a person.", lang: "TypeScript" },
  { m: "champcms", n: "ChampCMS", d: "full-stack astro cms on cloudflare. d1, r2, passkeys, tiptap.", lang: "TypeScript" },
  { m: "graphiti-knowledge-graph", n: "ChampGraph", d: "knowledge graph per prospect. the brain behind the ai sdr.", lang: "Python" },
  { m: "lakestream", n: "LakeStream", d: "template-based web scraper for b2b enrichment.", lang: "Python" },
  { m: "b2b-pulse", n: "B2B Pulse", d: "linkedin + meta engagement automator. runs the daily social triage.", lang: "Python" },
  { m: "champvideo", n: "ChampVideo", d: "automated avatar video studio for the group brands.", lang: "TypeScript" },
  { m: "champquest", n: "ChampQuest", d: "task tracking, reborn as a ranch scavenger rpg.", lang: "JavaScript" },
  { m: "event-scout", n: "Event Scout", d: "mobile pwa for event contact capture plus ai chat.", lang: "HTML" },
  { m: "deependhq-site", n: "deependhq-site", d: "this site. no-build react on cloudflare, self-publishing daily.", lang: "JavaScript" },
];

interface GitHubRepo {
  name?: string | null;
  description?: string | null;
  language?: string | null;
  pushed_at?: string | null;
  html_url?: string | null;
}

interface RepoView {
  name: string;
  desc: string;
  lang: string | null;
  updated: string | null;
  url: string;
}

const RepoCard = ({ name, desc, lang, updated, url }: RepoView) => (
  <a className="cc-repo" href={url || "https://github.com/Champ-Deep"} target="_blank" rel="noreferrer">
    <div className="cc-repo-top">
      <span className="cc-repo-name">{name}</span>
      <span className="cc-repo-meta" aria-hidden="true">
        ↗
      </span>
    </div>
    <div className="cc-repo-desc">{desc}</div>
    <div className="cc-repo-meta">
      <span>
        <span className="cc-lang-dot" style={{ background: langColor(lang) }} />
        {lang || "code"}
      </span>
      {updated && <span>pushed {updated}</span>}
    </div>
  </a>
);

export function LiveRepos() {
  const [repos, setRepos] = useState<RepoView[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch("https://api.github.com/users/Champ-Deep/repos?per_page=100&sort=pushed", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((data) => {
        if (!alive || !Array.isArray(data)) {
          setRepos([]);
          return;
        }
        const list = data as GitHubRepo[];
        setCount(list.length);
        const byName: Record<string, GitHubRepo> = {};
        list.forEach((r) => {
          byName[(r.name || "").toLowerCase()] = r;
        });
        setRepos(
          REPO_SHOW.map((s) => {
            const r = byName[s.m];
            return r
              ? {
                  name: s.n,
                  desc: s.d || r.description || "",
                  lang: r.language || s.lang,
                  updated: relTime(r.pushed_at),
                  url: r.html_url || "https://github.com/Champ-Deep",
                }
              : { name: s.n, desc: s.d, lang: s.lang, updated: null, url: "https://github.com/Champ-Deep" };
          })
        );
      })
      .catch(() => {
        if (alive) setRepos([]);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);
  const fallback: RepoView[] = REPO_SHOW.map((s) => ({
    name: s.n,
    desc: s.d,
    lang: s.lang,
    updated: null,
    url: "https://github.com/Champ-Deep",
  }));
  const list = repos === null ? null : repos.length ? repos : fallback;
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Live from the workshop</h2>
        <span className="cc-badge live">github</span>
        <span className="cc-sec-note">{count ? count + " public repos" : "pulled live from github.com/Champ-Deep"}</span>
      </div>
      <div className="cc-repos">
        {list === null
          ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="cc-repo-skel" />)
          : list.map((r) => <RepoCard key={r.name} {...r} />)}
      </div>
    </div>
  );
}
