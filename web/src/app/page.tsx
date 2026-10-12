import Link from "next/link";
import { Icon, Mark } from "@/components/icon";
import { ThemeToggle } from "@/components/theme";
import { explorerAddress, network } from "@/lib/network";
import { shortAddress } from "@/lib/format";

const contract = network.freedit;

const track = [
  { at: 5, a: "V1", b: "Version 1" },
  { at: 19, a: "Changes", b: "free" },
  { at: 33, a: "V2", b: "Version 2" },
  { at: 47, a: "Changes", b: "$15.00 → editor" },
  { at: 61, a: "V3", b: "Version 3" },
  { at: 77, a: "Paid", b: "$200.00 → editor", paid: true },
  { at: 93, a: "Unlocked", b: "file matches" },
];

const why = [
  { t: "Holds nothing", p: "Payments go wallet to wallet in one transaction. The contract's balance is always $0.", icon: "shield" },
  { t: "Paid revisions", p: "Free ones first. After that, each change request pays the editor on the spot.", icon: "rev" },
  { t: "Pay to unlock", p: "Clients watch a watermarked preview. The full-quality file stays private until they pay.", icon: "lock" },
  { t: "Fingerprinted", p: "Each version's SHA-256 is recorded on Arc, so the delivery is provably the approved cut.", icon: "hash" },
  { t: "No middleman", p: "No escrow agent, no AI judge. The editor keeps the file and the client keeps the money until they swap.", icon: "users" },
  { t: "USDC as gas", p: "No ETH and no extra token. Network fees are under one cent.", icon: "wallet" },
] as const;

export default function Landing() {
  return (
    <main className="lx">
      {/* 00:01 hero */}
      <section className="lx-sheet" aria-labelledby="hero-title">
        <nav className="lx-nav" aria-label="Main">
          <span className="row g12">
            <Link href="/" className="brand"><Mark />Freedit</Link>
            <span className="muted hide-md" style={{ fontSize: 12.5 }}>Paid revisions · on Arc</span>
          </span>
          <span className="row" style={{ gap: 22 }}>
            <span className="row lx-links" style={{ gap: 22 }}>
              <a href="#how">How it works</a><a href="#proof">Proof</a><a href="#why">Why Freedit</a>
            </span>
            <Link href="/dashboard" className="lx-hl row" style={{ gap: 4 }}>Launch app <Icon name="arrow" size="xs" /></Link>
            <ThemeToggle />
          </span>
        </nav>

        <div className="lx-eyebrow"><span>Freedit</span><span className="rule" /><span>for video editors</span></div>
        <h1 id="hero-title" className="lx-giant" style={{ fontSize: "clamp(44px, 8.2vw, 104px)" }}>
          Paid revisions.<br />Pay-to-unlock delivery.
        </h1>

        <div className="lx-hero">
          <div>
            <p className="lx-sub">Get paid for every revision past the free ones, and deliver the final cut only when it&apos;s paid. Freedit never touches the money.</p>
            <div className="row g16 wrap">
              <Link href="/new" className="btn primary lg">Create a project</Link>
              <a href="#proof" className="link">See how it&apos;s proven <Icon name="arrow" size="sm" /></a>
            </div>
          </div>
          <div className="card" style={{ padding: 16, boxShadow: "var(--shadow)", background: "var(--bg)" }} aria-label="Example project card">
            <div className="between" style={{ fontSize: 12.5 }}>
              <span className="mono muted">Example project</span>
              <span className="st" style={{ fontSize: 12.5 }}><i className="dot" style={{ ["--c" as string]: "var(--accent)" }} />Awaiting approval</span>
            </div>
            <div className="strong" style={{ margin: "10px 0 2px" }}>Diwali launch reel · V3</div>
            <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
              <span className="num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.03em" }}>$200.00</span>
              <span className="muted" style={{ fontSize: 12.5 }}>USDC · paid on approval</span>
            </div>
            <dl className="kv" style={{ gridTemplateColumns: "96px 1fr", margin: "12px 0 14px", fontSize: 12.5 }}>
              <dt>Revisions</dt><dd className="row"><span className="meter"><i className="on" /><i className="paid" /></span>1 free · 1 paid</dd>
              <dt>Final file</dt><dd className="row"><Icon name="lock" size="xs" />Locked until paid</dd>
            </dl>
            <span className="btn primary block" aria-hidden="true">Approve &amp; pay $200.00</span>
          </div>
        </div>

        <div className="lx-track-wrap">
          <div className="lx-track" role="img" aria-label="A project's life: version 1, a free revision, version 2, a paid revision, version 3, payment, file unlocked">
            <div className="line" /><div className="done" />
            {track.map((m) => (
              <div key={m.at} className={`lx-mk ${m.paid ? "paid" : ""}`} style={{ left: `${m.at}%` }}>
                <span className="a">{m.a}</span><i /><span className="b">{m.b}</span>
              </div>
            ))}
            <div className="lx-playhead" style={{ left: "77%" }} />
          </div>
        </div>

        <div className="lx-meta">
          <span className="row"><i className="dot" style={{ ["--c" as string]: "var(--ok)" }} />Live on {network.label}</span>
          {contract && (
            <span className="row">Contract <a className="link mono" href={explorerAddress(contract)} target="_blank" rel="noreferrer">{shortAddress(contract)} <Icon name="ext" size="xs" /></a></span>
          )}
          <span>$0 platform fee · network fee under $0.01</span>
          <a href="#problem" className="row hide-sm" style={{ textDecoration: "none" }}>Scroll <Icon name="down" size="xs" /></a>
        </div>
      </section>

      {/* 00:02 problem */}
      <section id="problem" className="lx-sheet" aria-labelledby="problem-title">
        <div className="lx-label"><span className="tc2">00:02</span><span className="rule" /><span id="problem-title">The problem</span></div>
        <p className="lx-statement">
          Editors do &quot;one last change&quot; <em>for free, again and again.</em> Clients pay up front and get a file that{" "}
          <em>isn&apos;t the one they approved.</em> Nobody trusts the handoff.
        </p>
        <div className="lx-cols2">
          <div><b>Editors</b> deliver the final file, then the client goes quiet. Revision seven was never part of the price.</div>
          <div><b>Clients</b> pay before seeing the final file, then can&apos;t tell whether it&apos;s really the version they signed off on.</div>
        </div>
      </section>

      {/* 00:03 how it works */}
      <section id="how" className="lx-sheet" aria-labelledby="how-title">
        <div className="lx-label"><span className="tc2">00:03</span><span className="rule" />How it works</div>
        <h2 id="how-title" className="lx-h">Four steps.<br />Nothing held.</h2>
        <div className="lx-steps">
          <div><div className="lx-num">01</div><b>Set the terms</b><p>Price, free revisions and the fee for each extra one. Share one link with your client.</p></div>
          <div><div className="lx-num">02</div><b>Upload a version</b><p>A watermarked preview to watch, and the full file kept private. Its fingerprint goes on Arc.</p></div>
          <div><div className="lx-num">03</div><b>Review and revise</b><p>Free revisions first. After that, each change request pays the editor on the spot.</p></div>
          <div><div className="lx-num">04</div><b>Approve and unlock</b><p>The client pays the editor directly and the final file unlocks. It must match the fingerprint.</p></div>
        </div>
      </section>

      {/* 00:04 proof */}
      <section id="proof" className="lx-sheet proof" aria-labelledby="proof-title">
        <div className="lx-label" style={{ color: "#8b8b95" }}><span className="tc2" style={{ color: "#ededf0" }}>00:04</span><span className="rule" />The proof</div>
        <div className="lx-proof-grid">
          <div>
            <h2 id="proof-title" className="lx-h">The file you approved.<br />Byte for byte.</h2>
            <p style={{ color: "#b6b6be", fontSize: 16, lineHeight: 1.55, margin: "22px 0 26px", maxWidth: 440 }}>
              Every version&apos;s SHA-256 fingerprint is written to Arc when it&apos;s uploaded. After paying, your browser fingerprints the
              download and compares. Change one frame and it won&apos;t match.
            </p>
            <div className="row wrap" style={{ gap: 28, fontSize: 13 }}>
              <div>
                <div style={{ color: "#8b8b95" }}>Freedit contract balance</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", color: "#ededf0" }}>$0.00 <span style={{ fontSize: 13, fontWeight: 500, color: "#8b8b95" }}>always</span></div>
              </div>
              <div>
                <div style={{ color: "#8b8b95" }}>Platform fee</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", color: "#ededf0" }}>$0.00</div>
              </div>
            </div>
          </div>
          <div className="lx-log" aria-label="Example of the events a project records on Arc">
            <div style={{ marginBottom: 8, color: "#8b8b95" }}><i className="dot" style={{ ["--c" as string]: "#3ecf8e", marginRight: 8 }} />example · what a project records on Arc</div>
            <div><span className="ev">ProjectCreated</span>$200.00 · 1 free · then $15.00</div>
            <div><span className="ev">VersionSubmitted</span>V1 · 5c1e…a04b</div>
            <div><span className="ev">RevisionRequested</span>#1 · free</div>
            <div><span className="ev">VersionSubmitted</span>V2 · 03ab…77f1</div>
            <div><span className="ev">RevisionRequested</span>#2 · <span className="hl">$15.00 → editor</span></div>
            <div><span className="ev">VersionSubmitted</span>V3 · 9f2c…e1d0</div>
            <div><span className="ev">Paid</span><span className="hl">$200.00 → editor</span></div>
            <div className="ok" style={{ marginTop: 6 }}>✓ download sha-256 = 9f2c…e1d0 · match</div>
          </div>
        </div>
      </section>

      {/* 00:05 why */}
      <section id="why" className="lx-sheet" aria-labelledby="why-title">
        <div className="lx-label"><span className="tc2">00:05</span><span className="rule" /><span id="why-title">Why Freedit</span></div>
        <div className="lx-rows">
          {why.map((w, i) => (
            <div key={w.t}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">{w.t}</span>
              <p>{w.p}</p>
              <span className="faint"><Icon name={w.icon} size="lg" /></span>
            </div>
          ))}
        </div>
      </section>

      {/* 00:06 not an escrow */}
      <section className="lx-sheet" aria-labelledby="escrow-title">
        <div className="lx-label"><span className="tc2">00:06</span><span className="rule" />Not an escrow</div>
        <h2 id="escrow-title" className="lx-h">Nobody holds the money.<br />Not even us.</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="lx-cmp">
            <thead><tr><th scope="col"><span className="sr-only">Question</span></th><th scope="col">Escrow apps</th><th scope="col">Freedit</th></tr></thead>
            <tbody>
              <tr><td>Who holds the money</td><td>A contract holds it until someone releases it</td><td className="us">Nobody. The client pays the editor directly</td></tr>
              <tr><td>Who settles a dispute</td><td>An arbiter or an AI agent decides</td><td className="us">Each side keeps what it controls until they swap</td></tr>
              <tr><td>Revisions</td><td>Not part of the deal</td><td className="us">Free ones, then paid on the spot</td></tr>
              <tr><td>The final file</td><td>Delivered before the money moves</td><td className="us">Locked until paid, then fingerprint-checked</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 00:07 get started */}
      <section className="lx-sheet cta" aria-labelledby="cta-title">
        <div className="lx-label" style={{ color: "rgba(255,255,255,.75)", marginTop: 24 }}><span className="tc2" style={{ color: "#fff" }}>00:07</span><span className="rule" />Get started</div>
        <h2 id="cta-title" className="lx-cta">Stop chasing invoices.<br />Start shipping cuts.</h2>
        <div className="between wrap" style={{ marginTop: 40 }}>
          <Link href="/new" className="row" style={{ gap: 16, color: "#fff", textDecoration: "none" }}>
            <span className="lx-round"><Icon name="arrow" size="lg" /></span>
            <span style={{ fontSize: 18, fontWeight: 500 }}>Create a project</span>
          </Link>
          {contract && (
            <a href={explorerAddress(contract)} target="_blank" rel="noreferrer" className="row" style={{ color: "#fff", gap: 6, textDecoration: "none" }}>
              Read the contract on Arc <Icon name="ext" size="sm" />
            </a>
          )}
        </div>
        <footer className="lx-foot">
          <span>Freedit © 2026 · Built for Arc Microgrants</span>
          <span className="row" style={{ gap: 20 }}>
            <Link href="/dashboard">Projects</Link>
            <Link href="/new">New project</Link>
            {contract && <a href={explorerAddress(contract)} target="_blank" rel="noreferrer">Contract ↗</a>}
          </span>
        </footer>
      </section>
    </main>
  );
}
