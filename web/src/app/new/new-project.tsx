"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { decodeEventLog, isAddress, type Address } from "viem";
import { useConfig, useConnection } from "wagmi";
import { Icon } from "@/components/icon";
import { Notice, Spinner } from "@/components/ui";
import { freeditAbi } from "@/lib/abi/freedit";
import { parseUsd, shortAddress, usd } from "@/lib/format";
import { useSignIn } from "@/lib/api";
import { pushProjectMeta, saveProjectMeta } from "@/lib/meta";
import { chain, network } from "@/lib/network";
import { explainError, sendFreedit } from "@/lib/tx";

function amountOrError(raw: string, allowZero: boolean): { value?: bigint; error?: string } {
  if (!raw.trim()) return { error: "Required" };
  try {
    const value = parseUsd(raw);
    if (!allowZero && value === 0n) return { error: "Must be more than $0" };
    return { value };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function NewProject() {
  const router = useRouter();
  const config = useConfig();
  const { address, chainId, isConnected } = useConnection();
  const [title, setTitle] = useState("");
  const [editorName, setEditorName] = useState("");
  const [client, setClient] = useState("");
  const [clientName, setClientName] = useState("");
  const [price, setPrice] = useState("");
  const [free, setFree] = useState(1);
  const [fee, setFee] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const { signIn, storage } = useSignIn();
  const [error, setError] = useState<string>();

  const clientTrim = client.trim();
  const clientError = !clientTrim
    ? "Required"
    : !isAddress(clientTrim)
      ? "That isn't a wallet address. It starts with 0x and has 42 characters."
      : address && clientTrim.toLowerCase() === address.toLowerCase()
        ? "That's your own wallet. Enter your client's."
        : undefined;
  const priceR = amountOrError(price, false);
  const feeR = amountOrError(fee || "0", true);
  const valid = !clientError && priceR.value !== undefined && feeR.value !== undefined;
  const ready = isConnected && chainId === chain.id && !!network.freedit;

  async function create() {
    setTouched(true);
    setError(undefined);
    if (!valid || !address || !ready) return;
    setBusy(true);
    try {
      // Sign in first (free) so the title and names can be shared with the client right after creation.
      if (storage) {
        setSigning(true);
        await signIn();
        setSigning(false);
      }
      const { receipt } = await sendFreedit(config, address, {
        functionName: "createProject",
        args: [clientTrim as Address, priceR.value!, free, feeR.value!],
      });
      const created = receipt.logs
        .map((l) => { try { return decodeEventLog({ abi: freeditAbi, data: l.data, topics: l.topics }); } catch { return undefined; } })
        .find((ev) => ev?.eventName === "ProjectCreated");
      const id = created && created.eventName === "ProjectCreated" ? created.args.id : undefined;
      if (id === undefined) throw new Error("Project created, but its number wasn't found. Open your dashboard to see it.");
      const labels = {
        title: title.trim() || undefined,
        clientName: clientName.trim() || undefined,
        editorName: editorName.trim() || undefined,
      };
      saveProjectMeta(id, labels);
      // Shared labels are a nice-to-have: the project exists on Arc either way, so a failure here doesn't block.
      if (storage) await pushProjectMeta(id, labels).catch(() => {});
      router.push(`/p/${id}/upload`);
    } catch (e) {
      setError(explainError(e));
      setBusy(false);
      setSigning(false);
    }
  }

  const show = (err?: string) => touched && err;
  const who = clientName.trim() || (isAddress(clientTrim) ? shortAddress(clientTrim) : "Your client");

  return (
    <form className="split" onSubmit={(e) => { e.preventDefault(); create(); }} noValidate>
      <div className="form">
        <div><h1 className="title">New project</h1><div className="sub">Set the terms once. Your client sees exactly these, and they can&apos;t be changed later.</div></div>

        <div className="grid2">
          <div>
            <label className="label" htmlFor="title">Project title</label>
            <div className="field"><input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali launch reel · 45 s" maxLength={80} /></div>
          </div>
          <div>
            <label className="label" htmlFor="editorName">Your name</label>
            <div className="field"><input id="editorName" value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Kavya Menon" maxLength={60} /></div>
            <div className="help">Your client sees this instead of your wallet address.</div>
          </div>
        </div>

        <div className="grid2">
          <div>
            <label className="label" htmlFor="client">Client wallet</label>
            <div className={`field ${show(clientError) ? "invalid" : ""}`}>
              <input id="client" className="mono" value={client} onChange={(e) => setClient(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-invalid={!!show(clientError)} aria-describedby="client-help" />
            </div>
            <div id="client-help" className={`help ${show(clientError) ? "bad" : !clientError ? "ok" : ""}`}>
              {show(clientError) ? clientError : !clientError ? <><Icon name="check" size="xs" />Valid address, not your own</> : "The wallet your client pays from. The project appears on their dashboard automatically."}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="clientName">Client name</label>
            <div className="field"><input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Bramble & Rye" maxLength={60} /></div>
            <div className="help">Shown on the review page.</div>
          </div>
        </div>

        <div className="grid3">
          <div>
            <label className="label" htmlFor="price">Price</label>
            <div className={`field ${show(priceR.error) ? "invalid" : ""}`}><input id="price" inputMode="decimal" className="num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="200.00" /><span className="suffix">USDC</span></div>
            <div className={`help ${show(priceR.error) ? "bad" : ""}`}>{show(priceR.error) || "Paid when the client approves."}</div>
          </div>
          <div>
            <span className="label" id="free-label">Free revisions</span>
            <div className="field stepper" role="group" aria-labelledby="free-label">
              <button type="button" aria-label="One fewer" onClick={() => setFree(Math.max(0, free - 1))}><Icon name="minus" size="sm" /></button>
              <span className="num" aria-live="polite">{free}</span>
              <button type="button" aria-label="One more" onClick={() => setFree(Math.min(255, free + 1))}><Icon name="plus" size="sm" /></button>
            </div>
            <div className="help">Before fees start.</div>
          </div>
          <div>
            <label className="label" htmlFor="fee">Fee per extra revision</label>
            <div className={`field ${show(feeR.error) ? "invalid" : ""}`}><input id="fee" inputMode="decimal" className="num" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="15.00" /><span className="suffix">USDC</span></div>
            <div className={`help ${show(feeR.error) ? "bad" : ""}`}>{show(feeR.error) || "Paid when they ask. 0 keeps them free."}</div>
          </div>
        </div>
      </div>

      <aside className="card" style={{ padding: 20, alignSelf: "start" }}>
        <div className="over" style={{ marginBottom: 10 }}>Summary</div>
        <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, marginBottom: 16 }}>
          {who} pays <b>{priceR.value !== undefined ? usd(priceR.value) : "$—"}</b> when they approve.{" "}
          {free === 0 ? "Every revision" : free === 1 ? "The first revision is free, then each one" : `The first ${free} revisions are free, then each one`}{" "}
          costs <b>{feeR.value !== undefined ? usd(feeR.value) : "$—"}</b>.
        </div>
        <dl className="kv" style={{ marginBottom: 18 }}>
          <dt>Paid to</dt><dd>{address ? <>You · <span className="addr">{shortAddress(address)}</span></> : <span className="muted">Your wallet</span>}</dd>
          <dt>Network</dt><dd>{network.label}</dd>
          <dt>Freedit fee</dt><dd>$0.00</dd>
          <dt>Network fee</dt><dd>under $0.01</dd>
        </dl>
        {error && <div style={{ marginBottom: 12 }}><Notice tone="bad">{error}</Notice></div>}
        <button type="submit" className="btn primary lg block" disabled={busy || !ready}>
          {signing ? <><Spinner />Sign in with your wallet…</> : busy ? <><Spinner />Confirm in your wallet…</> : "Create project"}
        </button>
        <div className="help" style={{ justifyContent: "center", marginTop: 10, textAlign: "center" }}>
          {!isConnected ? "Connect your wallet (top right) to create a project." : chainId !== chain.id ? `Switch your wallet to ${network.label} (top right).` : storage ? "Your wallet asks you to sign in (free), then confirm once. Terms can't be changed later." : "Your wallet asks you to confirm once. Terms can't be changed later."}
        </div>
      </aside>
    </form>
  );
}
