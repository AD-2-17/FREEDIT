"use client";

import { useEffect, useState } from "react";
import { keccak256, toBytes, type Address, type Hash, type Hex } from "viem";
import { useConfig } from "wagmi";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import { Notice, Spinner, TxLink } from "@/components/ui";
import { avatarText, shortAddress, shortHash, usd } from "@/lib/format";
import { saveNote } from "@/lib/meta";
import { nextRevisionCost, type Project } from "@/lib/project";
import { ensureAllowance, explainError, needsFunds, sendFreedit, usdcAllowance, usdcBalance } from "@/lib/tx";

type Phase = "idle" | "allowing" | "sending" | "done";

/** Reads the client's USDC balance and allowance once the sheet opens. */
function useFunds(owner: Address) {
  const config = useConfig();
  const [balance, setBalance] = useState<bigint>();
  const [allowance, setAllowance] = useState<bigint>();
  useEffect(() => {
    let live = true;
    Promise.all([usdcBalance(config, owner), usdcAllowance(config, owner)])
      .then(([b, a]) => { if (live) { setBalance(b); setAllowance(a); } })
      .catch(() => {});
    return () => { live = false; };
  }, [config, owner]);
  return { balance, allowance };
}

function PayStep({ n, done, now, children, tx }: { n: number; done: boolean; now: boolean; children: React.ReactNode; tx?: Hash | null }) {
  return (
    <div className={`paystep ${done ? "done" : now ? "now" : ""}`}>
      <span className="b">{done ? <Icon name="check" size="xs" /> : n}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {tx ? <TxLink hash={tx} label="tx" /> : now ? <span className="muted" style={{ fontSize: 12.5 }}>waiting</span> : null}
    </div>
  );
}

/** Two wallet confirmations: allow exactly the price (skipped if already allowed), then approveAndPay. */
export function PaySheet({ id, p, account, approvedHash, editorName, onClose, onPaid }: {
  id: bigint; p: Project; account: Address; approvedHash: Hex; editorName: string; onClose: () => void; onPaid: (hash: Hash) => void;
}) {
  const config = useConfig();
  const { balance, allowance } = useFunds(account);
  const [phase, setPhase] = useState<Phase>("idle");
  const [allowTx, setAllowTx] = useState<Hash | null>(null);
  const [error, setError] = useState<string>();
  const allowed = allowTx !== null || (allowance !== undefined && allowance >= p.price);
  const short = needsFunds(balance, p.price);

  async function pay() {
    setError(undefined);
    try {
      if (!allowed) {
        setPhase("allowing");
        setAllowTx(await ensureAllowance(config, account, p.price));
      }
      setPhase("sending");
      const { hash } = await sendFreedit(config, account, { functionName: "approveAndPay", args: [id, approvedHash] });
      setPhase("done");
      onPaid(hash);
    } catch (e) {
      setError(explainError(e));
      setPhase("idle");
    }
  }

  const busy = phase === "allowing" || phase === "sending";
  return (
    <Modal title={`Pay ${editorName}`} onClose={onClose} locked={busy}>
      <div className="row muted" style={{ fontSize: 13, marginBottom: 4 }}><span className="av">{avatarText(editorName)}</span>Pay {editorName}</div>
      <div className="amount num">{usd(p.price)}<small>USDC</small></div>
      <dl className="kv" style={{ margin: "16px 0" }}>
        <dt>For</dt><dd>Version {p.version}</dd>
        <dt>Fingerprint</dt><dd className="mono">{shortHash(approvedHash)}</dd>
        <dt>Paid to</dt><dd className="addr">{shortAddress(p.editor)}</dd>
        <dt>Freedit fee</dt><dd>$0.00</dd>
        <dt>Network fee</dt><dd>under $0.01</dd>
      </dl>
      <div className="hr" style={{ marginBottom: 16 }} />
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{allowed ? "Your wallet asks you once:" : "Your wallet asks you twice:"}</div>
      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        <PayStep n={1} done={allowed} now={!allowed} tx={allowTx}>Allow {usd(p.price)} USDC for this payment</PayStep>
        <PayStep n={2} done={phase === "done"} now={allowed && phase !== "done"}>Send the payment</PayStep>
      </div>
      {short && <div style={{ marginBottom: 12 }}><Notice tone="warn">{short}</Notice></div>}
      {error && <div style={{ marginBottom: 12 }}><Notice tone="bad">{error}</Notice></div>}
      <button type="button" className="btn primary lg block" onClick={pay} disabled={busy || !!short || balance === undefined}>
        {phase === "allowing" ? <><Spinner />Confirm the allowance…</> : phase === "sending" ? <><Spinner />Confirm the payment…</> : "Confirm in your wallet"}
      </button>
      <div className="row muted" style={{ justifyContent: "center", fontSize: 12, marginTop: 16, textAlign: "center" }}>
        <Icon name="shield" size="xs" />Money goes straight from your wallet to {editorName}&apos;s. Freedit never holds it.
      </div>
    </Modal>
  );
}

/** Ask for changes: the note is hashed on-chain; free while free revisions remain, otherwise the fee goes to the editor now. */
export function ChangesSheet({ id, p, account, editorName, onClose, onDone }: {
  id: bigint; p: Project; account: Address; editorName: string; onClose: () => void; onDone: () => void;
}) {
  const config = useConfig();
  const cost = nextRevisionCost(p);
  const { balance, allowance } = useFunds(account);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [allowTx, setAllowTx] = useState<Hash | null>(null);
  const [error, setError] = useState<string>();
  const needsAllowance = cost > 0n && allowTx === null && (allowance === undefined || allowance < cost);
  const short = cost > 0n ? needsFunds(balance, cost) : undefined;
  const freeLeft = Math.max(0, p.freeRevisions - p.revisionsUsed);

  async function send() {
    setError(undefined);
    if (!note.trim()) return setError("Write what you'd like changed.");
    try {
      if (needsAllowance) {
        setPhase("allowing");
        setAllowTx(await ensureAllowance(config, account, cost));
      }
      setPhase("sending");
      const noteHash = keccak256(toBytes(note.trim()));
      saveNote(noteHash, note.trim());
      await sendFreedit(config, account, { functionName: "requestRevision", args: [id, noteHash] });
      setPhase("done");
      onDone();
    } catch (e) {
      setError(explainError(e));
      setPhase("idle");
    }
  }

  const busy = phase === "allowing" || phase === "sending";
  return (
    <Modal title="Request changes" onClose={onClose} locked={busy}>
      <h2 className="title" style={{ fontSize: 18 }}>Request changes to V{p.version}</h2>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 16px" }}>
        {cost === 0n
          ? `Free: you have ${freeLeft} free revision${freeLeft === 1 ? "" : "s"} left.`
          : `This revision costs ${usd(cost)}, paid directly to ${editorName} when you send it.`}
      </p>
      <label className="label" htmlFor="note">What should change?</label>
      <div className="field area" style={{ marginBottom: 6 }}>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={"00:12 swap the b-roll for the market shots\n00:31 music a little louder"} autoFocus />
      </div>
      <div className="help" style={{ marginBottom: 16 }}>Add timecodes so the editor knows where. Only a fingerprint of this note goes on Arc.</div>
      {cost > 0n && (
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <PayStep n={1} done={!needsAllowance} now={needsAllowance} tx={allowTx}>Allow {usd(cost)} USDC for this revision</PayStep>
          <PayStep n={2} done={phase === "done"} now={!needsAllowance && phase !== "done"}>Send the request and the fee</PayStep>
        </div>
      )}
      {short && <div style={{ marginBottom: 12 }}><Notice tone="warn">{short}</Notice></div>}
      {error && <div style={{ marginBottom: 12 }}><Notice tone="bad">{error}</Notice></div>}
      <button type="button" className="btn primary lg block" onClick={send} disabled={busy || !!short}>
        {phase === "allowing" ? <><Spinner />Confirm the allowance…</> : phase === "sending" ? <><Spinner />Confirm in your wallet…</> : cost === 0n ? "Send request · free" : `Send request · ${usd(cost)}`}
      </button>
    </Modal>
  );
}
