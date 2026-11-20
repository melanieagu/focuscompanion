# 2–3 minute demo outline

Record your real app. Use a 10-second pact for the recording. Do one complete rehearsal first with both wallets funded. Build, test, deploy, and publish before recording. An AI-written narration is fine; the screen capture must reflect functionality that actually runs.

## 0:00–0:20 — Problem and idea

“Starting a task is often harder when you’re working alone. Focus Companion gives you a little dinosaur for company and a shared commitment with a friend.”

Show the home screen and type a real task. Keep personal messages, wallet recovery phrases and unrelated tabs out of frame.

## 0:20–0:40 — Basic consumer experience

Start the solo timer briefly. Show the resting dinosaur. Explain: “Solo focus works without a wallet. The interface stays quiet while I work.” Exit the solo session.

## 0:40–1:20 — The actual onchain pact

Open “Focus with a buddy,” with Sepolia testnet selected. Show the configured deployment address/explorer. Explain: “For a shared pact, we each set aside the same small deposit of test ETH. Only the invited wallet can join.”

Create a 10-second pact, show the confirmed deposit and invite link. Switch to the prepared second wallet, join and wait for its receipt. You may trim loading time, but label edits such as “transaction wait shortened.” Do not simulate a receipt.

## 1:20–1:50 — Focus and completion

Show both deposits held and the shared countdown. “The join transaction sets one shared end time. At the end, we each report completion. This is an honesty-based pact; it does not verify that someone studied.”

Wait for the 10-second session and confirm from both actual wallets.

## 1:50–2:20 — Refund and evidence

Show settled status, claim each deposit, and open an actual claim transaction in the explorer. “Our original deposits are returned through separate claims. If someone disappears, the contract has a timeout refund. There are no penalties or rewards in this prototype.”

## 2:20–2:40 — Scope and next steps

“Today it supports a focus companion, solo sessions, and refundable two-person testnet pacts. Next I would simplify onboarding with embedded wallets and sponsored gas, and test whether shared commitments help people return.”

End with the real app and repository URLs. Upload to YouTube as unlisted or Drive with judge-accessible permissions.

## If the live integration is not working

Do not describe a Local preview recording as blockchain functionality. It is explicitly labeled simulation. Fix the deployment/integration before claiming the project satisfies the onchain requirement, or clearly explain what remains incomplete. Never fake a successful deposit or claim.
