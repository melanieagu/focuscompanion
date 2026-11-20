/* Focus Companion: task text stays local; only pact funds/times/confirmations go onchain. */
const $ = id => document.getElementById(id);
const screens = ['home', 'pact-setup', 'pact-room', 'focusing', 'complete'];
const E = window.ethers;
const CFG = window.FOCUS_CONFIG;
const STATE = { Waiting: 1, Active: 2, Settled: 3, Cancelled: 4, TimedOut: 5 };
const store = {
  get(key, fallback = null) { try { return JSON.parse(localStorage.getItem('focus:' + key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem('focus:' + key, JSON.stringify(value)); } catch { /* browsing storage optional */ } }
};
let screen = 'home', selectedSeconds = 1500, mode = 'live', signer = null, account = '', provider = null;
let contractAddress = CFG.contractAddress || store.get('contract', '');
let pactId = null, currentPact = null, demoPact = null, credit = 0n, chainOffset = 0;
let session = store.get('session'), busy = false, polling = false, binding = '', txLink = '';
const short = address => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const now = () => Math.floor(Date.now() / 1000) + (mode === 'live' ? chainOffset : 0);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
function notice(message, error = false) {
  $('notice').textContent = message; $('notice').dataset.error = String(error); $('notice').hidden = !message;
}
function show(name) { screen = name; screens.forEach(id => $(id).hidden = id !== name); }
function updateCount() {
  const count = store.get('counts', {})[new Date().toDateString()] || 0;
  $('session-count').textContent = `${count} session${count === 1 ? '' : 's'} today`;
}
function countSession(id) {
  const seen = store.get('counted', []);
  if (seen.includes(id)) return;
  const counts = store.get('counts', {}), date = new Date().toDateString();
  counts[date] = (counts[date] || 0) + 1;
  store.set('counts', counts); store.set('counted', [...seen.slice(-199), id]); updateCount();
}
function taskKey() { return `task:${contractAddress.toLowerCase()}:${pactId}:${account.toLowerCase()}`; }
function savePactReference() {
  if (mode === 'preview') store.set('preview', demoPact);
  else store.set('lastPact', { address: contractAddress, id: pactId });
  store.set('lastOpened', { mode, address: contractAddress, id: pactId });
  const url = new URL(location.href); url.search = '';
  if (mode === 'live') { url.searchParams.set('contract', contractAddress); url.searchParams.set('pact', pactId); }
  history.replaceState(null, '', url);
  $('resume-pact').hidden = !pactId;
}
function showHome() {
  if (screen === 'focusing' && session && !session.pact && !window.confirm('Leave this solo session? It will not count as completed.')) return;
  if (session && !session.pact && screen === 'focusing') { session = null; store.set('session', null); }
  show('home'); notice('');
}
function setMode(value) {
  mode = value;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === value)));
  $('mode-description').textContent = value === 'preview' ? 'Try the flow on this device. All participants and deposits are simulated.' : 'Real testnet transactions. Test ETH has no monetary value.';
  $('buddy-address').hidden = $('buddy-label').hidden = value === 'preview';
  $('network-setup').hidden = value === 'preview';
  $('create-pact').textContent = value === 'preview' ? 'Create local preview' : 'Create focus pact';
}
function updateContractLabel() {
  $('contract-address').value = contractAddress;
  $('contract-status').textContent = contractAddress ? `Configured: ${contractAddress}. Validate by connecting or opening a pact.` : 'No contract configured. Deploy once or paste an existing address.';
}
async function ensureWallet() {
  if (!E || !window.FOCUS_ARTIFACT?.bytecode) throw new Error('Live mode needs a one-time build: run npm install, then npm run build in VS Code’s terminal, and refresh. Solo focus and Local preview work now.');
  if (!window.ethereum) throw new Error('Install a browser Ethereum wallet, or use Local preview to explore the interface.');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const chain = await window.ethereum.request({ method: 'eth_chainId' });
  if (Number(chain) !== CFG.chainId) {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  }
  provider = new E.BrowserProvider(window.ethereum);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CFG.chainId) throw new Error('Switch your wallet to Ethereum Sepolia.');
  signer = await provider.getSigner(); account = await signer.getAddress();
  $('wallet-button').textContent = short(account) + ' · Sepolia';
  return signer;
}
function reader() {
  return provider || (provider = new E.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', CFG.chainId));
}
async function validateContract(address, connection) {
  if (!E.isAddress(address)) throw new Error('Enter a valid 0x contract address.');
  if (await connection.getCode(address) === '0x') throw new Error('No deployed contract at that address on Sepolia.');
  if (!window.FOCUS_ARTIFACT?.bytecode) throw new Error('Run npm install and npm run build before using live pacts.');
  const c = new E.Contract(address, window.FOCUS_ARTIFACT.abi, connection);
  if (await c.version() !== 'focus-pact-v1') throw new Error('This is not a compatible FocusPact contract.');
  // Verify executable bytecode, not just an untrusted version() response.
  const code = await connection.getCode(address);
  if (code.toLowerCase() !== window.FOCUS_ARTIFACT.deployedBytecode.toLowerCase()) throw new Error('Contract code does not match this tested build. Deploy a new instance from this app.');
  return c;
}
function friendly(error) {
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Transaction cancelled in your wallet. No success has been recorded.';
  return error.reason || error.shortMessage || error.message || 'Something went wrong. Please try again.';
}
async function action(fn) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy', 'true');
  const buttons = [...document.querySelectorAll('button')];
  const previous = buttons.map(b => b.disabled); buttons.forEach(b => b.disabled = true);
  try { await fn(); } catch (error) { console.error(error); notice(friendly(error), true); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); buttons.forEach((b, i) => b.disabled = previous[i]); if (screen === 'pact-room' && currentPact) renderRoom(); if (screen === 'complete' && session?.outcome) document.querySelectorAll('[data-outcome]').forEach(b => b.disabled = true); }
}
async function send(method, args = [], value) {
  await ensureWallet();
  const c = await validateContract(contractAddress, provider);
  notice('Confirm the transaction in your wallet…');
  const tx = await c.connect(signer)[method](...args, ...(value === undefined ? [] : [{ value }]));
  txLink = `${CFG.explorer}/tx/${tx.hash}`;
  notice('Transaction submitted. Waiting for its onchain confirmation…');
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('Transaction failed. No success has been recorded.');
  notice('Transaction confirmed on Sepolia.');
  return { c, receipt };
}
function normalize(p) {
  return { creator: p.creator, buddy: p.buddy, stake: p.stake.toString(), duration: Number(p.duration), joinBy: Number(p.joinBy), endsAt: Number(p.endsAt), refundAfter: Number(p.refundAfter), creatorConfirmed: p.creatorConfirmed, buddyConfirmed: p.buddyConfirmed, state: Number(p.state) };
}
async function refreshPact() {
  if (!pactId || polling) return;
  polling = true;
  try {
    if (mode === 'preview') {
      currentPact = demoPact;
    } else {
      const address = contractAddress, id = pactId;
      const connection = reader();
      const key = `${address}:${account}`;
      const c = binding === key ? new E.Contract(address, window.FOCUS_ARTIFACT.abi, connection) : await validateContract(address, connection);
      binding = key;
      const [p, block, balance] = await Promise.all([c.pacts(id), connection.getBlock('latest'), account ? c.credits(account) : Promise.resolve(0n)]);
      if (mode !== 'live' || address !== contractAddress || id !== pactId) return;
      if (!Number(p.state)) throw new Error('Pact not found. Check the invitation link.');
      currentPact = normalize(p); credit = balance;
      chainOffset = block.timestamp - Math.floor(Date.now() / 1000);
    }
    if (screen === 'pact-room') renderRoom();
    if (session?.pact && mode === 'live' && currentPact && currentPact.state !== STATE.Active && screen === 'focusing') {
      session = null; store.set('session', null); show('pact-room'); renderRoom();
    }
  } finally { polling = false; }
}
function renderRoom() {
  const p = currentPact; if (!p) return;
  const preview = mode === 'preview', mineCreator = preview || same(account, p.creator), mineBuddy = !preview && same(account, p.buddy);
  const participant = mineCreator || mineBuddy, t = now(), active = p.state === STATE.Active;
  const waiting = p.state === STATE.Waiting, ended = active && t >= p.endsAt;
  const closed = p.state >= STATE.Settled;
  const mineConfirmed = mineCreator ? p.creatorConfirmed : p.buddyConfirmed;
  $('preview-banner').hidden = !preview;
  $('room-eyebrow').textContent = preview ? 'A WALKTHROUGH, NOT A TRANSACTION' : 'YOUR SHARED COMMITMENT';
  $('pact-id').textContent = `${preview ? 'Preview' : 'Pact #' + pactId} · ${p.duration < 60 ? p.duration + ' sec' : p.duration / 60 + ' min'} · ${p.stake === 'preview' ? '0.0001' : E.formatEther(p.stake)} test ETH each`;
  $('creator-address').textContent = preview ? 'You · simulated' : short(p.creator);
  $('room-buddy-address').textContent = preview ? 'Buddy · simulated' : short(p.buddy);
  $('creator-status').textContent = closed ? 'Deposit unlocked' : p.creatorConfirmed ? 'Completion confirmed' : 'Deposit confirmed';
  $('buddy-status').textContent = waiting ? 'Not joined yet' : closed ? 'Deposit unlocked' : p.buddyConfirmed ? 'Completion confirmed' : 'Deposit confirmed';
  $('room-task').textContent = preview ? p.task : store.get(taskKey(), '') || 'Your own task can stay private. Focus alongside your buddy.';
  let title = 'Waiting for your buddy.', status = 'Your deposit is held. The timer starts after your invited buddy joins.';
  if (active && !ended) { title = 'A little company.'; status = 'Both deposits are held. Your shared focus session is running.'; }
  if (ended) { title = 'You showed up.'; status = t >= p.refundAfter ? 'The confirmation window ended. Unlock both deposits using the timeout refund.' : mineConfirmed ? 'Your completion is confirmed. Waiting for your buddy’s confirmation.' : 'The session ended. Confirm only if you finished what you planned.'; }
  if (p.state === STATE.Settled) { title = 'Better together.'; status = 'Both participants confirmed. Each deposit is unlocked; claim yours below.'; }
  if (p.state === STATE.Cancelled) { title = 'Another time.'; status = 'The pact was cancelled before your buddy joined. The creator’s deposit is unlocked.'; }
  if (p.state === STATE.TimedOut) { title = 'No funds left behind.'; status = 'The pact timed out. Deposits are unlocked for the original depositors.'; }
  if (!preview && !participant) status += account ? ' You are viewing a pact for two other wallets.' : ' Connect your wallet to participate.';
  if (preview && p.claimed) status = 'Preview complete. The simulated deposit was claimed. No funds moved.';
  else if (!preview && closed && participant && credit === 0n) status += ' No unclaimed credit remains for this wallet.';
  $('room-title').textContent = title; $('room-status').textContent = status;
  $('room-countdown').textContent = waiting ? `Join window: ${formatTime(Math.max(0, p.joinBy - t))}` : active ? ended ? `Refund available in ${formatTime(Math.max(0, p.refundAfter - t))}` : formatTime(Math.max(0, p.endsAt - t)) : '';
  $('invite-area').hidden = !waiting || preview;
  if (!preview) {
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('contract', contractAddress); url.searchParams.set('pact', pactId);
    $('invite-link').value = url.href;
    $('invite-note').textContent = ['localhost', '127.0.0.1', ''].includes(location.hostname) ? 'This is a local address. Publish the app before sharing with another device. Your task is not included.' : 'Your personal task is not included in this link.';
  }
  const vis = (id, condition) => $(id).hidden = !condition;
  vis('join-pact', !preview && waiting && mineBuddy && t < p.joinBy);
  vis('cancel-pact', waiting && mineCreator);
  vis('refund-pact', (waiting && t >= p.joinBy || active && t >= p.refundAfter) && participant);
  vis('view-session', active && !ended && participant);
  vis('confirm-pact', ended && t < p.refundAfter && participant && !mineConfirmed);
  vis('withdraw-pact', preview ? closed && !p.claimed : credit > 0n);
  vis('preview-join', preview && waiting);
  vis('preview-confirm', preview && ended && t < p.refundAfter && !p.buddyConfirmed);
  $('claimable').textContent = preview ? 'Simulated funds only. Use Sepolia testnet mode to make real testnet transactions.' : credit > 0n ? `${E.formatEther(credit)} test ETH available across your pacts on this contract. Claiming transfers it to your wallet.` : 'Deposits return to their original wallets. No rewards or forfeitures.';
  vis('contract-link', !preview); $('contract-link').href = `${CFG.explorer}/address/${contractAddress}`;
  vis('last-transaction', !preview && !!txLink); $('last-transaction').href = txLink; $('last-transaction').textContent = 'View last confirmed/submitted transaction ↗';
}
function startSession(task, duration, endsAt, pact = false) {
  session = { id: pact ? `${mode}:${contractAddress}:${pactId}` : `solo:${Date.now()}`, task, duration, endsAt, pact, mode, pactId, contractAddress };
  store.set('session', session); renderSession(); show('focusing'); tick();
}
function renderSession() {
  $('active-task').textContent = session.task;
  $('focus-mode').textContent = session.pact ? session.mode === 'preview' ? 'LOCAL PREVIEW · SIMULATED BUDDY' : 'FOCUSING TOGETHER · SEPOLIA PACT' : 'YOUR QUIET MOMENT';
  $('buddy-presence').hidden = !session.pact;
  $('end-session').textContent = session.pact ? 'View pact · timer keeps running' : 'End session';
}
function finishSession() {
  if (!session) return;
  countSession(session.id);
  $('recap').textContent = `${session.duration < 60 ? session.duration + ' seconds' : session.duration / 60 + ' minutes'} focused on: ${session.task}`;
  $('feedback').textContent = session.pact ? 'Your timer is complete. Your deposit is still held until the pact’s conditions are met.' : '';
  $('completion-pact').hidden = !session.pact;
  document.querySelectorAll('[data-outcome]').forEach(b => b.disabled = false);
  show('complete');
}
function tick() {
  if (screen === 'focusing' && session) {
    const t = session.pact ? now() : Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, session.endsAt - t);
    $('countdown').textContent = formatTime(remaining);
    $('progress').style.strokeDashoffset = 100 - Math.min(100, (session.duration - remaining) / session.duration * 100);
    if (!remaining) finishSession();
  }
  if (screen === 'pact-room' && currentPact) renderRoom();
  updateCount();
}
async function room() {
  if (!pactId) return;
  show('pact-room'); await refreshPact(); renderRoom();
}
$('focus-form').addEventListener('submit', event => {
  event.preventDefault(); const task = $('task').value.trim(); if (!task) return $('task').focus();
  notice(''); startSession(task, selectedSeconds, Math.floor(Date.now() / 1000) + selectedSeconds);
});
$('brand').onclick = showHome;
$('back-home').onclick = () => { session = null; store.set('session', null); show('home'); };
$('end-session').onclick = () => {
  if (session?.pact) return action(room);
  if (window.confirm('End this session early? It won’t count as completed.')) { session = null; store.set('session', null); show('home'); }
};
$('open-pact').onclick = () => { $('pact-task').value = $('task').value; $('pact-duration').value = String(selectedSeconds); show('pact-setup'); updateContractLabel(); };
$('completion-pact').onclick = () => action(room);
$('resume-pact').onclick = () => action(async () => {
  const ref = store.get('lastOpened'); if (!ref) return;
  setMode(ref.mode); contractAddress = ref.address; pactId = ref.id; binding = '';
  if (mode === 'preview') demoPact = store.get('preview');
  currentPact = null; await room();
});
$('wallet-button').onclick = () => action(async () => { await ensureWallet(); notice('Wallet connected on Sepolia.'); if (pactId) await refreshPact(); });
$('save-contract').onclick = () => action(async () => {
  await ensureWallet(); const address = $('contract-address').value.trim(); await validateContract(address, provider);
  contractAddress = E.getAddress(address); binding = ''; store.set('contract', contractAddress); updateContractLabel(); notice('Contract validated and saved on this device.');
});
$('deploy-contract').onclick = () => action(async () => {
  await ensureWallet(); notice('Approve deployment in your wallet. This spends only Sepolia test ETH for gas.');
  const factory = new E.ContractFactory(window.FOCUS_ARTIFACT.abi, window.FOCUS_ARTIFACT.bytecode, signer);
  const c = await factory.deploy(); txLink = `${CFG.explorer}/tx/${c.deploymentTransaction().hash}`;
  notice('Deploying. Waiting for confirmation…'); await c.waitForDeployment();
  contractAddress = await c.getAddress(); binding = ''; store.set('contract', contractAddress); updateContractLabel();
  notice(`Deployed on Sepolia: ${contractAddress}. Paste this address into config.js before publishing, or share it via the pact link.`);
});
$('create-form').addEventListener('submit', event => { event.preventDefault(); action(async () => {
  const task = $('pact-task').value.trim(); if (!task) throw new Error('Name your task first.');
  const duration = Number($('pact-duration').value), stake = $('pact-stake').value;
  if (mode === 'preview') {
    pactId = 'preview'; chainOffset = 0;
    demoPact = { creator: 'preview-you', buddy: 'preview-buddy', stake: 'preview', duration, joinBy: now() + 86400, endsAt: 0, refundAfter: 0, creatorConfirmed: false, buddyConfirmed: false, state: STATE.Waiting, task, claimed: false };
    currentPact = demoPact; savePactReference(); notice('Local preview created. No funds were deposited.'); return room();
  }
  if (!contractAddress) { $('network-setup').open = true; throw new Error('Deploy a testnet contract below, or enter its existing address.'); }
  const buddy = $('buddy-address').value.trim(); if (!E.isAddress(buddy)) throw new Error('Enter your buddy’s full 0x wallet address.');
  await ensureWallet(); if (same(account, buddy)) throw new Error('Invite a different wallet. Use a second account for testing.');
  const { c, receipt } = await send('createPact', [buddy, duration], E.parseEther(stake));
  const created = receipt.logs.map(log => { try { return c.interface.parseLog(log); } catch { return null; } }).find(log => log?.name === 'PactCreated');
  if (!created) throw new Error('Transaction confirmed but event not found. Check its receipt before retrying.');
  pactId = created.args.id.toString(); store.set(taskKey(), task); savePactReference(); await room();
}); });
$('join-pact').onclick = () => action(async () => {
  await ensureWallet(); await refreshPact(); if (!same(account, currentPact.buddy)) throw new Error('Switch to the invited buddy wallet.');
  await send('joinPact', [pactId], BigInt(currentPact.stake)); await room();
});
$('cancel-pact').onclick = () => action(async () => {
  if (mode === 'preview') { demoPact.state = STATE.Cancelled; store.set('preview', demoPact); }
  else await send('cancelPact', [pactId]); await room();
});
$('refund-pact').onclick = () => action(async () => {
  if (mode === 'preview') { demoPact.state = STATE.TimedOut; store.set('preview', demoPact); }
  else await send('refundTimedOut', [pactId]); await room();
});
async function confirmPact() {
  if (mode === 'preview') {
    if (now() < demoPact.endsAt || now() >= demoPact.refundAfter) throw new Error('Wait for the session to finish, or use timeout refund.');
    demoPact.creatorConfirmed = true; if (demoPact.buddyConfirmed) demoPact.state = STATE.Settled;
    store.set('preview', demoPact); notice('Preview: your completion was simulated.');
  } else await send('confirmCompletion', [pactId]);
  await room();
}
$('confirm-pact').onclick = () => action(confirmPact);
$('withdraw-pact').onclick = () => action(async () => {
  if (mode === 'preview') { demoPact.claimed = true; store.set('preview', demoPact); notice('Simulated claim complete. No funds moved.'); }
  else { await send('withdraw'); notice('Claim confirmed. Your unlocked test ETH was transferred to your wallet.'); }
  await room();
});
$('preview-join').onclick = () => {
  demoPact.state = STATE.Active; demoPact.endsAt = now() + demoPact.duration; demoPact.refundAfter = demoPact.endsAt + 600;
  store.set('preview', demoPact); currentPact = demoPact; renderRoom();
};
$('preview-confirm').onclick = () => {
  demoPact.buddyConfirmed = true; if (demoPact.creatorConfirmed) demoPact.state = STATE.Settled;
  store.set('preview', demoPact); currentPact = demoPact; renderRoom();
};
$('view-session').onclick = () => {
  const p = currentPact; const task = mode === 'preview' ? p.task : store.get(taskKey(), '') || 'Focus with my buddy';
  startSession(task, p.duration, p.endsAt, true);
};
$('copy-invite').onclick = () => action(async () => {
  try { await navigator.clipboard.writeText($('invite-link').value); notice('Invite link copied. Send it to your invited buddy.'); }
  catch { $('invite-link').select(); notice('Copy the selected link with Command+C (or Ctrl+C).'); }
});
for (const button of document.querySelectorAll('[data-seconds]')) button.onclick = () => {
  selectedSeconds = Number(button.dataset.seconds);
  document.querySelectorAll('[data-seconds]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
};
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => setMode(button.dataset.mode);
for (const button of document.querySelectorAll('[data-home]')) button.onclick = showHome;
for (const button of document.querySelectorAll('[data-outcome]')) button.onclick = () => action(async () => {
  if (session?.pact && button.dataset.outcome === 'finished') { await confirmPact(); return; }
  if (session) { session.outcome = button.dataset.outcome; store.set('session', session); }
  $('feedback').textContent = session?.pact ? 'Progress counts. Your deposit stays held until both confirm or the timeout refund becomes available. View your pact for its status.' : button.dataset.outcome === 'finished' ? 'Nicely done. Enjoy a little break!' : 'Progress counts. Take a breath—you showed up.';
  document.querySelectorAll('[data-outcome]').forEach(b => b.disabled = true);
});
if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', () => location.reload());
  window.ethereum.on('chainChanged', () => location.reload());
}
async function boot() {
  updateCount(); updateContractLabel();
  if (E && window.ethereum) {
    try {
      const [accounts, chain] = await Promise.all([window.ethereum.request({ method: 'eth_accounts' }), window.ethereum.request({ method: 'eth_chainId' })]);
      if (accounts.length && Number(chain) === CFG.chainId) { provider = new E.BrowserProvider(window.ethereum); signer = await provider.getSigner(accounts[0]); account = await signer.getAddress(); $('wallet-button').textContent = short(account) + ' · Sepolia'; }
    } catch { /* Connect wallet requests permission explicitly. */ }
  }
  const query = new URLSearchParams(location.search), address = query.get('contract'), id = query.get('pact');
  if (address && id) {
    if (!E?.isAddress(address) || !/^[1-9]\d{0,30}$/.test(id)) { notice('Invalid pact invitation.', true); return; }
    contractAddress = E.getAddress(address); pactId = id; store.set('contract', contractAddress); savePactReference();
    await room(); return;
  }
  const last = store.get('lastOpened');
  if (last) $('resume-pact').hidden = false;
  if (session && session.pact) {
    setMode(session.mode); contractAddress = session.contractAddress; pactId = session.pactId;
    if (mode === 'preview') { demoPact = store.get('preview'); if (!demoPact) { session = null; return; } }
    await refreshPact();
    if (currentPact?.state === STATE.Active) { renderSession(); show('focusing'); tick(); }
    else await room();
  } else if (session && !session.pact) { renderSession(); show('focusing'); tick(); }
}
action(boot);
setInterval(tick, 250);
setInterval(() => {
  if (pactId && ['pact-room', 'focusing', 'complete'].includes(screen) && !busy) refreshPact().catch(e => notice('Could not refresh chain state. ' + friendly(e), true));
}, 5000);
