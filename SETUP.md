# Freedit setup checklist

Two parts:
- **Part 1: Arc** (wallets, USDC, networks, deploys, on-chain test runs). IDs `A1…`
- **Part 2: Everything else** (tools, dependencies, accounts, storage, hosting, demo assets). IDs `B1…`

Every action you take starts with **YOU:**, so you can search for it. **ME:** means I do it. Tick the boxes as you go; times are rough.

Never paste a private key, recovery phrase or password into chat. Addresses are public, so sharing those is fine.

## Order for today (Oct 12)
We're about a day behind, and the critical path is now the testnet deploy plus mainnet USDC:
1. ~~B1 move out of OneDrive~~ ✓ (now at `C:\Users\athar\Documents\DEV\freedit`) · ~~B2 git~~ ✓ · ~~B4 WSL~~ ✓ · ~~B5 Arc Foundry~~ ✓ · ~~B7 tests~~ ✓ 41/41 pass
2. ~~A1–A5 wallets, keystore, faucet~~ ✓ · ~~A8 testnet deploy~~ ✓ verified
3. → **next:** approve mockups + packages (unblocks the web app), and **A6 mainnet USDC** (unblocks the mainnet deploy)
4. **Start A6 (mainnet USDC) today**. Exchange withdrawals and KYC can take hours.
5. B9–B13 accounts, whenever you're waiting on something

---

# Part 1: Arc (wallets, money, chain)

### A1: Editor wallet (10 min)
- [ ] YOU: in your main Chrome profile, install MetaMask (https://metamask.io/download) or Rabby (https://rabby.io). Write the recovery phrase on paper only.
- [ ] YOU: rename the account to **Freedit Editor**.

### A2: Client wallet, a separate wallet in a second browser profile (10 min)
Why separate: in real life the editor and client are different people, the contract rejects editor == client, and the demo video looks best with Editor and Client windows side by side, each signed in.
- [ ] YOU: Chrome → profile icon → **Add** → name it "Freedit Client"
- [ ] YOU: install MetaMask in that profile → **Create a new wallet** (a new recovery phrase, also on paper) → rename the account to **Freedit Client**

### A3: Add Arc networks to both wallets (5 min)
MetaMask → network menu → **Add a custom network**. Values from docs.arc.io/arc/references/connect-to-arc.

| Field | Arc Testnet | Arc Mainnet |
|---|---|---|
| Network name | Arc Testnet | Arc |
| RPC URL | `https://rpc.testnet.arc.io` | `https://rpc.mainnet.arc.io` |
| Chain ID | `5042002` | `5042` |
| Currency symbol | `USDC` | `USDC` |
| Block explorer | `https://explorer.testnet.arc.io` | `https://explorer.arc.io` |

- [ ] YOU: add both networks in the Editor wallet
- [ ] YOU: add both networks in the Client wallet
- Note: the wallet shows USDC as the gas token with 18 decimals. That's correct, and it's the **same balance** as the USDC token `0x3600…0000`, so don't import that token separately.

### A4: Deployer wallet, an encrypted keystore (5 min). Needs B5 first.
Why a keystore instead of a plaintext `.env`: it's encrypted, lives in Ubuntu's home folder (outside the repo and OneDrive), and asks for a password on every deploy. The deployer has **zero** powers in the contract; it only pays deploy gas.
- [ ] YOU (Ubuntu terminal):
  ```bash
  mkdir -p ~/.foundry/keystores
  arc-cast wallet new ~/.foundry/keystores deployer
  ```
  Set a password and keep it in your password manager. If the syntax is rejected, run `arc-cast wallet new --help` and tell me what it says.
- [ ] YOU: `arc-cast wallet address --account deployer` → copy the address

### A5: Testnet USDC (5 min, then a 2-hour cooldown)
- [ ] YOU: https://faucet.circle.com → **Arc Testnet** → paste an address → captcha → **Send 20 USDC**
- [ ] YOU: repeat for **Editor**, **Client** and **deployer** (limit: 20 USDC per address every 2 hours)
- [ ] YOU: send me the 3 **addresses** (public). I'll put them in STATUS.md.
- On testnet we'll use small terms that fit 20 USDC: price $12.00, 1 free revision, $2.00 per extra revision.

### A6: Mainnet USDC on Arc from India (30 min to 1 day, start today)
**Amount:** about $15 in total. Withdraw it all to the **Client** wallet, then do A7.

**Route A: direct withdrawal on the Arc network (best)**
1. [ ] YOU: on an exchange you can legally use from India (FIU-IND registered), buy USDC. Typical path: INR → USDT (INR deposit or P2P) → convert to USDC on spot.
2. [ ] YOU: Withdraw → USDC → in the **network** dropdown look for **Arc / ARC / USDC (Arc Mainnet)**. Reported support (unverified; the dropdown is the truth):
   - Bitget: USDC-ARC withdrawals announced as open ([Bitget](https://www.bitget.com/support/articles/12560603895369))
   - Kraken: deposits and withdrawals ([Kraken](https://blog.kraken.com/product/new-features/usdc-on-arc-deposits-and-withdrawals-now-available)). Check whether it serves India.
   - KuCoin: **deposits only** as of Sep 17 ([KuCoin](https://www.kucoin.com/announcement/en-usdc-on-arc-mainnet-is-now-supported-on-kucoin))
   - Binance: launch partner, withdrawals unconfirmed ([HackerNoon](https://hackernoon.com/circles-arc-goes-live-with-kucoin-binance-and-kraken-as-stablecoin-rails-go-mainstream))
3. [ ] YOU: withdraw the minimum first to the **Client** address → check it on https://explorer.arc.io → then withdraw the rest

**Route B: via Base + Circle CCTP (if no exchange lists Arc)**
1. [ ] YOU: withdraw USDC on **Base** to your Client address, plus about $1 of ETH on Base (Base gas is paid in ETH)
2. [ ] YOU: bridge Base → Arc with a CCTP bridge UI. Candidates I found but have **not verified** (all third-party): `bridge.arcexplorer.org`, `cctpbridge.app` (0.25% fee), `xylonet.xyz/bridge`, and LI.FI/Jumper. Check the page says **Arc Mainnet (chain 5042)**, and try $2 first.
3. Never send USDC straight to a CCTP or Gateway contract address.

**Route C: fastest.** A friend who already has USDC on Arc sends $15 to your Client address, and you repay them over UPI.

### A7: Fund the three wallets on mainnet (3 min)
From the wallet that already holds USDC **on Arc mainnet** (network "Arc", chain 5042), send USDC to:
- [ ] YOU: **deployer** `0x1037729af7ccCFFD038005acA26aaa2F5DAA0866`: **$1.00** (the deploy costs ≈ $0.04–0.08)
- [ ] YOU: **Editor** `0xa8AeBCFB34a669BFF1127D10f97C36C5d992fB8B`: **$1.00** (gas for create + uploads)
- [ ] YOU: **Client** `0x2C1c06E6Cf809Ce06eDC383dAe97BF15fe5986De`: **$7.00** (live example: $5 price + one $0.50 paid revision + gas)
- Send nothing **from** the deployer before the deploy: as its first mainnet transaction, Freedit lands at the same address as on testnet.
- If your USDC is on another network (Base, Ethereum…), stop and tell me: it needs a bridge first (A6 route B).
- [ ] YOU: check all three balances on https://explorer.arc.io

### A8: Testnet deploy ✓ done 10-12: `0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`, verified
- [ ] YOU: run the deploy command I give you in the Ubuntu terminal (it asks for the keystore password)
- [ ] YOU: open the contract on https://explorer.testnet.arc.io and check the **Contract** tab shows verified source
- ME: record the address in CLAUDE.md and the app config

### A9: Full flow on testnet (Phase 5, 20 min)
- [ ] YOU (Editor window): create a project for the Client address → upload V1 → sign each wallet prompt
- [ ] YOU (Client window): free revision → (Editor uploads V2) → paid revision (allow USDC, then confirm) → approve & pay → download → fingerprint check ✓
- [ ] YOU: open each transaction link and confirm it on the explorer

### A10: Mainnet deploy (Phase 6, 5 min). Needs A7 and your OK on my security review.
- [ ] YOU: read my security review → reply "ok to deploy"
- [ ] YOU (Ubuntu terminal; asks for the keystore password):
  ```bash
  cd /mnt/c/Users/athar/Documents/DEV/freedit/contracts
  arc-forge script script/Deploy.s.sol --rpc-url arc_mainnet --account deployer --broadcast --verify --verifier sourcify
  ```
  Verification goes to Sourcify because the mainnet explorer API blocks command-line tools (10-12). If only the verify step fails, the contract is still deployed: tell me and I’ll rerun verification (no keys needed).
- [ ] YOU: paste me the output lines `Freedit:` and the transaction hash (public)

### A11: Full flow on mainnet = the live example project (Phase 7, 20 min)
- [ ] YOU: same as A9 with real USDC and small terms: price **$5.00**, 1 free revision, **$0.50** per extra revision
- This project becomes the "real example project on mainnet" linked from the landing page, the README and the DoraHacks submission.

---

# Part 2: Everything else (tools, dependencies, accounts, storage, hosting, demo)

### B1: Move the project out of OneDrive ✓ done 10-12
It ended up at `C:\Users\athar\Documents\DEV\freedit` (WSL: `/mnt/c/Users/athar/Documents/DEV/freedit`), not `C:\dev\freedit`. That's fine; it isn't synced. The OneDrive copy still exists. Delete it once you're happy (STATUS.md).
Why it had to move: OneDrive tries to upload `node_modules` (100k+ files) and lock files during `npm install` / `next build`, which causes random `EPERM` errors.
- [x] Copied out of OneDrive. Open Claude Code in `C:\Users\athar\Documents\DEV\freedit` from now on.

### B2: Git for Windows ✓ done (2.56.0, identity set; repo initialized on `main` 10-12)
- [ ] YOU: `winget install --id Git.Git -e --source winget`
- [ ] YOU: reopen the terminal → `git --version`
- [ ] YOU: set your identity. For a private email, use GitHub's noreply address (GitHub → Settings → Emails):
  ```powershell
  git config --global user.name "Your Name"
  git config --global user.email "your-id+username@users.noreply.github.com"
  ```

### B3: Node.js (done ✓)
Node v24.20.0 and npm 11.19.0 are installed. Next.js 16 needs Node ≥ 20.9.

### B4: WSL + Ubuntu ✓ done (WSL 2, user `athar`)
Why: Arc Foundry ships only Linux and macOS binaries; the Arc docs say Windows must use WSL. Virtualization is already on, so this will work.
- [ ] YOU: PowerShell **as Administrator** → `wsl --install -d Ubuntu-24.04`
- [ ] YOU: reboot → Ubuntu opens → choose a Linux username and password (the `sudo` password, so keep it)
- [ ] YOU: normal PowerShell → `wsl -l -v` → should show `Ubuntu-24.04`, VERSION `2`
- Docs: https://learn.microsoft.com/en-us/windows/wsl/install

### B5: Arc Foundry inside Ubuntu ✓ done (`~/.local/bin/arc-{forge,cast,anvil}`, reports `1.7.1-dev`)
Release **v0.8.0-2** (Sep 18, 2026), https://github.com/circlefin/arc-foundry/releases, x86_64 build.
- [ ] YOU (Ubuntu terminal):
  ```bash
  mkdir -p ~/arc-foundry && cd ~/arc-foundry
  curl -LO https://github.com/circlefin/arc-foundry/releases/download/v0.8.0-2/arc-foundry-v0.8.0-2-x86_64-unknown-linux-gnu.tar.gz
  curl -LO https://github.com/circlefin/arc-foundry/releases/download/v0.8.0-2/arc-foundry-v0.8.0-2-x86_64-unknown-linux-gnu.tar.gz.sha256
  cat *.sha256; sha256sum *.tar.gz
  ```
- [ ] YOU: check the two hashes match (if they don't, stop and tell me), then:
  ```bash
  tar -xzf arc-foundry-v0.8.0-2-x86_64-unknown-linux-gnu.tar.gz
  mkdir -p ~/.local/bin
  mv forge ~/.local/bin/arc-forge && mv cast ~/.local/bin/arc-cast && mv anvil ~/.local/bin/arc-anvil
  grep -q 'HOME/.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  source ~/.bashrc
  arc-forge --version
  ```
  If `mv` says "No such file", run `ls -R` and paste me the output.
- [ ] YOU: tell me **"arc-forge ready"**

### B6: Docs MCP for Claude Code (optional)
- Done differently: the Circle docs MCP `circle` (`https://api.circle.com/v1/codegen/mcp`) is set up in **WSL** Claude Code. It covers developers.circle.com, not the Arc Foundry pages, so I still read docs.arc.io directly for those.
- Optional: to also have it in the Windows desktop app, run once in PowerShell: `claude mcp add --transport http --scope user circle https://api.circle.com/v1/codegen/mcp` (that's Windows' config, so it isn't a duplicate of the WSL one). Not needed for the build.

### B7: Contract dependencies ✓ done 10-12 (41/41 tests pass)
- ME: `arc-forge soldeer install` → `forge-std 1.16.2`, `@openzeppelin-contracts 5.6.1` (pinned in `contracts/foundry.toml`)
- ME: `arc-forge test` → I report pass/fail

### B8: Web app dependencies (ME, in Phase 3)
I install these with `npm install` in `web/`:

| Package | Why | Status |
|---|---|---|
| `next`, `react`, `react-dom`, `typescript`, `@types/*` | the app | in the brief ✓ |
| `tailwindcss`, `@tailwindcss/postcss` | styling | in the brief ✓ |
| `wagmi`, `viem` | wallet connection and Arc reads/writes; Sign-In with Ethereum is built into viem, so no extra SIWE package | in the brief ✓ |
| `@tanstack/react-query` | required by wagmi (it won't run without it) | needs your OK |
| `@supabase/supabase-js` | storage and database from the server | in the brief ✓ |
| `@noble/hashes` | SHA-256 in chunks, so a big video doesn't freeze the browser (already inside viem; I'd list it directly) | needs your OK |

Fonts (Geist or Inter) come through `next/font`, so there's no extra package.

### B9: GitHub (5 min)
- [ ] YOU: create a **public** repo named `freedit` at https://github.com/new, with README, license and .gitignore all unticked
- [ ] YOU: send me your GitHub username
- ME: `git init` and the first commit after B2; you push when I say (one command)

### B10: X as your public builder profile (5 min)
- [ ] YOU: public account, bio says what you build, links your GitHub
- [ ] YOU: send me your X handle (for the README and launch post)

### B11: DoraHacks (5 min)
- [ ] YOU: sign in at https://dorahacks.io → open https://dorahacks.io/hackathon/arc-microgrants/detail → look at the submission form and tell me if it asks for anything beyond: description, repo, live link, contract address, demo video, builder profile

### B12: Vercel (3 min now, 10 min in Phase 4)
- [ ] YOU: sign up at https://vercel.com/signup with GitHub (Hobby plan)
- Later (Phase 4): YOU import the `freedit` repo → Root Directory `web` → paste the env vars from B14 → Deploy. I'll give exact clicks.

### B13: Supabase (10 min now, 10 min in Phase 4)
- [ ] YOU: https://supabase.com/dashboard → New project → name `freedit`, region **South Asia (Mumbai)**, strong database password (save it in your password manager)
- Later (Phase 4): YOU paste one SQL script I write into SQL Editor → Run. It creates the tables (profiles, project titles, comments, activity) and two storage buckets (`previews` for watermarked clips, `finals` **private** for full files).
- Free-plan limits: **50 MB max per file** ([docs](https://supabase.com/docs/guides/storage/uploads/file-limits)); the project pauses after a week of inactivity.

### B13b: Supabase setup for Phase 4
- [x] Project `freedit` (ref `jqnajstukifkmictupnm`, Mumbai) created and schema applied through the Supabase connector (10-12)
- [x] `SUPABASE_URL=https://jqnajstukifkmictupnm.supabase.co` written to `web\.env.local`
- [ ] YOU: https://supabase.com/dashboard/project/jqnajstukifkmictupnm/settings/api-keys → reveal the **service_role** (or "secret") key → paste after `SUPABASE_SERVICE_ROLE_KEY=` in `web\.env.local`. This key can read and write everything: keep it only in that file and in Vercel, never in chat or code.
- [ ] YOU: restart `npm run dev`, then tell me "supabase keys in"

### B12b: Vercel deploy (YOU, 10 min, after the GitHub push)
- [ ] YOU: https://vercel.com/new → **Import** the `freedit` GitHub repo
- [ ] YOU: **Root Directory** → `web` (Framework: Next.js is detected)
- [ ] YOU: **Environment Variables**: `NEXT_PUBLIC_ARC_NETWORK` = `testnet`, `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g. `https://freedit.vercel.app`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as `.env.local`), `SESSION_SECRET` (a **new** one: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] YOU: **Deploy** → send me the URL. If you set `NEXT_PUBLIC_SITE_URL` before knowing the URL, fix it and redeploy.

### B12c: Custom domain (10 min + DNS wait). Needed: MetaMask warns on every `*.vercel.app` site
MetaMask's site scanner labels **all** `*.vercel.app` addresses "wallet drainer" (checked 10-12, even names nobody uses), so every visitor sees a red warning when they connect. A domain of your own is clean. Unregistered on 10-12: `freedit.xyz`, `freedit.app`, `freedit.io`, `freedit.video`, `usefreedit.com` (`getfreedit.com` is taken). `.app` and `.dev` only work over HTTPS, which Vercel provides.
- [ ] YOU: buy one. Easiest: Vercel → **Domains** (top menu) → **Buy**. DNS is then set up for you. Any registrar works (Namecheap, Porkbun, Cloudflare); check the price at checkout, since some short names are "premium".
- [ ] YOU: Vercel → project `freedit` → **Settings → Domains → Add** → type the domain → **Add**. If you bought it elsewhere, copy the DNS records Vercel shows into your registrar and wait until Vercel shows **Valid Configuration**.
- [ ] YOU: **Settings → Environment Variables** → edit `NEXT_PUBLIC_SITE_URL` → `https://<your domain>` (no trailing slash) → **Save** → **Deployments** → latest → **⋯ → Redeploy**
- [ ] YOU: tell me the domain. ME: check MetaMask's scanner answers `NONE` for it, that `freedit-one.vercel.app` now forwards to it, and update the docs.

### B14: Environment variables (Phase 3–4)
You paste these into `web/.env.local` (gitignored) and into Vercel → Project → Settings → Environment Variables. **The server needs no private key**: it only reads the chain and checks wallet signatures.

| Variable | What it is | Where to get it | Phase |
|---|---|---|---|
| `NEXT_PUBLIC_ARC_NETWORK` | `testnet` or `mainnet` | you choose | 3 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, your Vercel URL in prod | Vercel → Project → Domains | 4 |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | Supabase → Project Settings → Data API | 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only secret (never prefix with `NEXT_PUBLIC_`) | Supabase → Project Settings → API Keys → `service_role` / secret | 4 |
| `SESSION_SECRET` | signs login cookies | run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 4 |

Contract addresses are public and committed in `web/src/config/deployments.ts`, so they aren't env vars.

### B15: Demo video files (30 min, before Phase 5)
For each version, the app needs a **watermarked preview** and a **clean full-quality file**, each **under 50 MB**.
- [ ] YOU: pick one 30–45 s clip: your own phone footage, or free stock from https://www.pexels.com/videos/
- [ ] YOU: make **3 versions** (V1, V2, V3) with small visible differences (another title card, a cut moved, music louder) so revisions look real
- [ ] YOU: for each version export (a) a 720p MP4 with a text watermark like "PREVIEW · <editor name>" and (b) a clean 1080p MP4. Free tools: **Clipchamp** (built into Windows 11) or DaVinci Resolve.
- [ ] YOU: name them `v1_preview.mp4`, `v1_final.mp4`, … and keep them in a folder **outside** the repo

### B16: Screen recorder for the 60–90 s demo (5 min)
- [ ] YOU: use the Windows **Snipping Tool** screen recording (`Win + Shift + R`, built in) or OBS Studio (https://obsproject.com)
- [ ] YOU: upload the final video to YouTube as **Unlisted** (or post it on X) for the DoraHacks submission
