# Submission draft — review against your final tested build

Project name: **Focus Companion** (working title)
Main track: **Consumer Applications**
Chain award: **None** for the current Sepolia build
Bounties: **None** for this scope
Team members: **Add your name and any actual teammates**

## What did you build?

Focus Companion pairs a friendly dinosaur with a quiet focus timer and optional shared focus pacts. Two friends can make equal refundable deposits, focus against one shared end time, report completion, and reclaim their deposits. Solo mode works without a wallet.

**Only retain claims about the live pact after deploying and testing it.** The app also includes a clearly labeled local simulation for exploring the flow without funds.

## What problem does it solve?

Beginning and following through on a task can feel isolating. The product combines a companion users can feel attached to with a small shared commitment, giving friends a reason to show up together while keeping the focus screen calm.

This is a product hypothesis, not a measured claim of improved productivity. No user-study results are claimed.

## How does it work?

The frontend is HTML, CSS and JavaScript. Solo timers use absolute end times and local persistence. Shared pacts use an Ethereum Sepolia smart contract: a creator deposits test ETH and invites a specific wallet, whose matching deposit begins the shared timer. Both participants self-report completion to unlock their own deposits. Waiting pacts can be cancelled; timeouts prevent missing participants from locking deposits indefinitely. Credits are withdrawn separately by their original wallets.

Task descriptions stay on the device. Addresses, amounts and pact states are public onchain. The contract does not verify attention or work, and there are no forfeitures, profits or prizes.

## What makes it unique?

The design centers the experience of working with a little companion, rather than a dense productivity dashboard. The dinosaur rests while users focus and celebrates afterward. The optional pact adds a transparent shared deposit lifecycle without making wallet use mandatory for solo focus.

Do not claim this is the first such app or a proven behavior-change mechanism.

## What would you build next?

Embedded-wallet onboarding, sponsored testnet gas, friendlier invitations, configurable commitment rules informed by user research, and small, accessible companion animations. Research would evaluate whether the shared ritual is useful enough to bring people back.

## Technology

HTML, CSS, JavaScript, ethers 6.16.0, Solidity 0.8.30, Ethereum Sepolia; Ganache for local contract tests. AI assistance was used in implementation and visual development. No Gemini or other bounty APIs are used.

## Required links — fill in before submitting

- Public GitHub repository: **ADD ACTUAL LINK**
- Working application: **ADD ACTUAL LINK**
- 2–3 minute demo video: **ADD ACTUAL LINK**
- Sepolia contract address: **ADD DEPLOYED ADDRESS**
- Deployment and successful pact/claim transactions: **ADD ACTUAL EXPLORER LINKS**

## Final checks

- [ ] npm build succeeds and the supplied contract tests pass locally.
- [ ] Both wallets complete a real Sepolia pact and claim refunds.
- [ ] Cancellation and timeout paths are tested.
- [ ] Published config contains the right deployment address.
- [ ] Public app works from a second device/browser.
- [ ] Repository includes code, generated ABI/vendor bundle, contract address and setup instructions, with no secrets.
- [ ] Written claims match what works in the video; simulation is not presented as onchain.
- [ ] Video is 2–3 minutes and accessible to judges.
- [ ] Main track and opt-ins match the actual implementation.
- [ ] Submit before Nov. 20, 10 a.m. Pacific / noon Central; plan to attend the required in-person closing ceremony for prize eligibility.
