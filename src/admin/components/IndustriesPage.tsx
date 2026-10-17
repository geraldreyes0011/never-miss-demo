import { useEffect, useMemo, useRef, useState } from "react";
import { clipUrl, linkFor, voiceKey } from "../../shared/content";
import { voiceText } from "../../shared/format";
import { rankIndustries, WEAK_MATCH } from "../../shared/search";
import { useAdmin } from "../context";
import { copyText, typingInField, useToast } from "../hooks";
import { Icon } from "./Icon";

export function IndustriesPage({ detail }: { detail?: string }) {
  const { demo } = useAdmin();
  if (detail && demo.industries[detail]) return <IndustryDetail id={detail} />;
  return <IndustryGrid />;
}

function IndustryGrid() {
  const { demo, navigate } = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !typingInField(e)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const ranked = useMemo(() => rankIndustries(demo, q), [demo, q]);
  const ids = q.trim() ? ranked.filter((r) => r.s >= WEAK_MATCH).map((r) => r.id) : demo.order;
  const shown = ids.length ? ids : ranked.slice(0, 6).map((r) => r.id);
  return (
    <section className="page">
      <div className="page-head">
        <p className="lead">
          {demo.order.length} industry stories, each with 6 narrated steps. Open any one as a demo, or check
          its voice-over.
        </p>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Search: aircon, lawyer, nails…"
            aria-label="Search industries"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>/</kbd>
        </div>
      </div>
      {q.trim() && !ids.length && <p className="hint">No exact match. Closest industries:</p>}
      <ul className="ind-grid" aria-label="Industries">
        {shown.map((id) => {
          const d = demo.industries[id];
          return (
            <li key={id} className="ind-card">
              <button
                className="ind-open"
                type="button"
                onClick={() => navigate(`industries/${id}`)}
                aria-label={`${d.label}: view steps and voice-over`}
              >
                <span className="ind-swatch" style={{ background: d.business.accent }} aria-hidden="true" />
                <span className="ind-text">
                  <b>{d.label}</b>
                  <span>{d.business.name}</span>
                </span>
                {id === demo.order[0] && <span className="tag">Default</span>}
              </button>
              <div className="ind-actions">
                <a className="btn sm" href={linkFor(id)} target="_blank" rel="noreferrer">
                  <Icon name="external" />
                  Open demo
                </a>
                <button
                  className="btn sm"
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(linkFor(id));
                    toast(ok ? "ok" : "err", ok ? `Copied the ${d.label} link.` : "Couldn't copy the link.");
                  }}
                >
                  <Icon name="copy" />
                  Copy link
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function IndustryDetail({ id }: { id: string }) {
  const { demo, audio, navigate } = useAdmin();
  const toast = useToast();
  const d = demo.industries[id];
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => player.current?.pause(), []);

  function play(key: string) {
    if (!player.current) player.current = new Audio();
    const a = player.current;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      return;
    }
    const clip = audio[key];
    if (!clip) return toast("err", `No voice clip is mapped for ${key}.`);
    a.src = clipUrl(clip);
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setPlaying(null);
      toast("err", `Couldn't play ${clip}.mp3. The file may be missing; run the voice Action.`);
    };
    a.play().catch(() => setPlaying(null));
    setPlaying(key);
  }

  const lines: { key: string; title: string; text: string; meta?: string }[] = [
    { key: "intro", title: "Intro (shared)", text: demo.intro.voice ?? demo.intro.say },
    ...d.steps.map((s, i) => ({
      key: voiceKey(id, i + 1),
      title: `${i + 1}. ${s.name}`,
      text: s.voice ?? s.say,
      meta: s.time,
    })),
    { key: "outro", title: "Outro (shared)", text: demo.outro.voice ?? demo.outro.say },
  ];
  return (
    <section className="page">
      <button className="btn sm ghost back" type="button" onClick={() => navigate("industries")}>
        <Icon name="back" />
        All industries
      </button>
      <div className="ind-head">
        <span className="ind-swatch lg" style={{ background: d.business.accent }} aria-hidden="true" />
        <div>
          <h2>{d.label}</h2>
          <p className="muted">
            Example business: <b>{d.business.name}</b> · <code>{d.business.accent}</code> · link{" "}
            <code>#{id}</code>
          </p>
        </div>
        <a className="btn sm" href={linkFor(id)} target="_blank" rel="noreferrer">
          <Icon name="external" />
          Open demo
        </a>
      </div>
      <div className="panel welcome-peek">
        <span className="tag">Welcome</span>
        <b>{d.welcome.headline}</b>
      </div>
      <ol className="voice-list" aria-label="Voice-over lines">
        {lines.map((l) => (
          <li key={l.key} className={`voice-row${playing === l.key ? " playing" : ""}`}>
            <button
              className="play-btn"
              type="button"
              onClick={() => play(l.key)}
              aria-label={`${playing === l.key ? "Stop" : "Play"} voice-over: ${l.title}`}
              aria-pressed={playing === l.key}
            >
              <Icon name={playing === l.key ? "pause" : "play"} />
            </button>
            <div className="voice-text">
              <span className="voice-title">
                {l.title}
                {l.meta && <span className="muted"> · {l.meta}</span>}
              </span>
              <span>“{voiceText(l.text, demo.customer)}”</span>
            </div>
            <code className="clip-id" title="Audio clip">
              {audio[l.key] || "missing"}
            </code>
          </li>
        ))}
      </ol>
      <p className="hint">
        <Icon name="volume" /> The voice always says “your business”, never a client's name, so one recording
        works for every client.
      </p>
    </section>
  );
}
