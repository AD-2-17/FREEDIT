# STATUS

_Last updated: 2026-10-12, Phase 1 (contract + tests): code written, tests not yet run. As of 10-12, git, WSL and Arc Foundry are still not installed._

## Done
- Read and verified the Arc docs: chain IDs, RPCs, USDC address and decimals, 20 gwei floor, zero-address rule, Memo, Arc Foundry install (see CLAUDE.md → Arc facts)
- `SETUP.md` checklist (S0–S15)
- `contracts/src/Freedit.sol`: the contract, no custody, no admin
- Tests: 30+ unit tests covering every required case, a fuzz test on fee accounting, 3 invariants (zero custody, exact editor income, conservation), 3 Arc-fork tests (decimals, full flow with real USDC, blocklisted editor)
- `contracts/script/Deploy.s.sol` (refuses non-Arc chains)
- `CLAUDE.md` (Arc facts, design, decisions), `.gitignore`
- `docs/mockups/` wireframes for all 7 pages (for approval)

## Next
1. Once Arc Foundry is ready: `arc-forge soldeer install`, then `arc-forge test`. Fix anything that fails; run the fork tests.
2. Phase 2: testnet deploy and explorer verification (you run the deploy command).
3. Phase 3: frontend, after you approve the mockups.

## Blockers
- Arc Foundry is not installed (needs WSL). Tests can't run until SETUP B4 and B5 are done.
- git is not installed (SETUP B2).
- Schedule: about 1 day behind the Oct 11 plan. Critical path: B4/B5 (tests → testnet deploy) and A6 (mainnet USDC).

## YOU: actions pending
(SETUP.md was reorganized on 10-12: Part 1 = Arc `A1–A11`, Part 2 = everything else `B1–B16`)
- [ ] YOU: B1 (move the folder out of OneDrive), right after this turn
- [ ] YOU: B2 (git), B4 (WSL), B5 (Arc Foundry) → then tell me "arc-forge ready"
- [ ] YOU: A1–A5 (two wallets, Arc networks, deployer keystore, faucet) → send me the 3 addresses
- [ ] YOU: A6–A7 (mainnet USDC from India, then split it): start today
- [ ] YOU: B9–B13 (GitHub, X, DoraHacks, Vercel, Supabase)
- [ ] YOU: B15 (demo video files: 3 versions, preview + full, each under 50 MB)
- [ ] YOU: OK `@tanstack/react-query` and `@noble/hashes` (SETUP B8)
- [ ] YOU: review `docs/mockups/index.html` and approve it, or tell me what to change

## Addresses (public)
| Role | Address |
|---|---|
| deployer | _send me after A4_ |
| Freedit Editor (demo) | _send me after A1_ |
| Freedit Client (demo) | _send me after A2_ |
