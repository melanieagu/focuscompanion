# Focus Companion

A little dinosaur keeps you company while you work. Solo sessions are free of wallet prompts. For shared accountability, two friends can put equal **Sepolia test ETH** deposits into a refundable focus pact, run a shared session, report completion, and reclaim their deposits.

**Prototype status:** application code and Solidity source are included. Public testnet deployment is not configured. Read [START_HERE.md](START_HERE.md) for setup, validation, and submission steps.

## Run

Node.js 20+. In this folder:

```sh
npm install
npm run build
npm test
npm run test:ui
npm start
```

Visit http://localhost:3000. Local preview and solo mode work with `npm start` even before installing. Live mode requires the compiler build and a Sepolia wallet. The build vendors ethers locally; the site does not download remote wallet code at runtime.

## Three distinct experiences

| Experience | Wallet | Blockchain | Funds |
|---|---|---|---|
| Solo focus | None | None | None |
| Local preview | None | None; explicitly simulated | None |
| Sepolia focus pact | Browser wallet | FocusPact contract | Free test ETH deposits and gas |

Do not describe Local preview as an onchain demo.

## Pact lifecycle

1. A creator specifies a distinct invited wallet and 10–7200 seconds, and deposits >0 to 0.01 test ETH.
2. Only that wallet can join, with the exact matching deposit, within 24 hours.
3. The join transaction starts the session. Its block timestamp defines `endsAt` and a 10-minute confirmation window.
4. After `endsAt` and before `refundAfter`, each participant may report their own completion once.
5. Both confirmations settle the pact and credit each wallet with its original deposit.
6. Each wallet separately calls `withdraw()` to receive its credited test ETH.

Alternative paths:

- Creator may cancel any waiting pact, reclaiming their credit.
- After 24 hours without a join, anyone can unlock the creator’s timeout credit.
- After an active session’s 10-minute confirmation window expires, anyone can unlock both original deposits, whether zero or one participant confirmed.
- None of these paths confiscates or awards the other person’s deposit. Gas fees are separate.

## Architecture

- **`index.html` / `style.css`:** responsive blue-and-cream UI; original user-provided dinosaur assets; home, focus, completion, setup, and pact-room states.
- **`script.js`:** solo timer, local persistence, explicit local simulation, wallet connections, contract actions, receipt checks, 5-second chain polling, and invite links. A clock offset from the latest block assists display; contract time is authoritative.
- **`contracts/FocusPact.sol`:** equal native test ETH escrow, invited-wallet join, self-reported confirmations, timeout/cancellation, and pull withdrawals. No owner/admin privileges, token, fees, or prize pool. Constructor permits Sepolia (11155111) and local chain 31337 only.
- **`config.js`:** deployment address and Sepolia explorer configuration. Paste your deployed address before publishing.
- **`scripts/build.cjs`:** solc 0.8.30 compilation with optimizer 200 and Paris EVM target; generates ABI, bytecode and expected runtime. Copies pinned ethers 6.16.0 into `vendor/`.
- **`contract-artifact.js`:** generated browser ABI/bytecode; initially an explicit unbuilt placeholder. Live mode is blocked until building.
- **`scripts/serve.cjs`:** dependency-free local static server; production can be any HTTPS static host.
- **`tests/contract.cjs`:** integration suite using Ganache chain 31337. Covers invalid deposits/participants/durations, session timing, duplicate actions, confirmations, full refunds, expired invitation, active timeout, and a rejecting recipient.
- **`tests/ui-logic.cjs`:** dependency-free state tests for solo and preview modes. DOM stub only; no visual rendering or real wallet integration.

## What is onchain?

Wallet addresses, deposit amounts, durations, timestamps, confirmations, states, events and withdrawal credits. Task descriptions stay in this device’s local storage and never enter contract calls or invite links. Wallet addresses and onchain activity are public. Daily counts are per browser/device, not verified productivity records.

## Trust and limitations

- Completion is **honest self-reporting**, not attention or task verification. Anyone can use developer tools to alter the local timer, but the contract enforces its own timestamps and conditions.
- Deposits remain refundable after timeout. This prototype offers a shared ritual and commitment, not enforceable penalties for distraction.
- Uses a conventional browser wallet; embedded login and sponsored gas are future improvements. Do not claim wallet complexity has already been abstracted away.
- The public RPC can be unavailable or rate-limited. Wallet confirmation and chain receipts are required for successful state changes; refresh failures do not imply settlement.
- A runtime-bytecode comparison is used before transactions so invite links cannot silently direct deposits to a different implementation. Use builds with the exact compiler settings above.
- Rejected/failed transactions do not trigger successful UI states. Funds are withdrawn using checks-effects-interactions. A recipient rejecting ETH cannot block the other wallet’s claim.
- **Unaudited hackathon testnet prototype. Not for real funds.** The constructor rejects mainnet deployment; the browser permits Sepolia only.
- Browser tabs may throttle rendering. The countdown derives from an absolute end time rather than decrementing on every tick. Solo sessions and live pact references recover after reload.
- Gifting, custom avatars, streaming, productivity surveillance, NFTs, and Gemini integration are not included.

## Deployment record — complete after deploying

- Chain: Ethereum Sepolia (11155111)
- Contract address: **NOT DEPLOYED — add your address here**
- Deployment transaction: **Add actual explorer link**
- Public app: **Add actual URL**
- Public repository: **Add actual URL**

This targets Consumer Applications, with **no chain award or sponsor bounty claimed** by default. Sepolia is not Solana or Arc.

## Validation record

In the build workspace: JS syntax checks and all six app-state test groups passed. A graphical browser could not launch under the workspace restrictions. npm package downloads were blocked, so **Solidity compilation/integration execution and wallet integration remain unverified here**. Run the included build and tests locally, then exercise both wallets on the public testnet before submission. Do not claim unrun tests passed.

## Useful official references

- Ethereum networks: https://ethereum.org/developers/docs/networks/
- ethers v6: https://docs.ethers.org/v6/single-page/
- Solidity: https://docs.soliditylang.org/
- Browser-wallet deployment alternative: https://remix-ide.readthedocs.io/en/latest/run.html

## Attribution

Original concept, visual direction and uploaded dinosaur artwork supplied by the project author, with AI assistance for implementation and image creation. Confirm that the final submitted assets are the versions you created or have permission to use. ethers is MIT licensed; its license is copied into `vendor/` during build. Local build/test dependencies retain their own licenses.
