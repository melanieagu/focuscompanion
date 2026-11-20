const assert = require('node:assert/strict');
const ganache = require('ganache');
const { ethers } = require('ethers');
require('../scripts/build.cjs');
const artifact = require('../build/FocusPact.json');
async function main() {
  const rpc = ganache.provider({ chain: { chainId: 31337 }, logging: { quiet: true }, wallet: { totalAccounts: 4 } });
  const provider = new ethers.BrowserProvider(rpc, undefined, { cacheTimeout: -1 }); provider.pollingInterval = 20;
  const [a,b,outsider] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
  const aa = await a.getAddress(), bb = await b.getAddress();
  const c = await new ethers.ContractFactory(artifact.abi,artifact.bytecode,a).deploy(); await c.waitForDeployment();
  const stake = ethers.parseEther('0.0001');
  const tx = async promise => (await promise).wait();
  const reject = async fn => assert.rejects(fn);
  const advance = async seconds => { await rpc.request({method:'evm_increaseTime',params:[seconds]}); await rpc.request({method:'evm_mine',params:[]}); };
  const create = async () => { const id=await c.nextId(); await tx(c.createPact(bb,10,{value:stake})); return id; };
  let passed=0;
  const test = async (name,fn) => {await fn(); console.log('PASS',++passed,name);};
  await test('invalid deposits, self-invites and durations are rejected',async()=>{
    await reject(()=>c.createPact(bb,10)); await reject(()=>c.createPact(aa,10,{value:stake}));
    await reject(()=>c.createPact(bb,9,{value:stake})); await reject(()=>c.createPact(bb,7201,{value:stake}));
  });
  const id=await create();
  await test('only invited buddy with exact deposit can join',async()=>{
    assert.equal((await c.pacts(id)).state,1n);
    await reject(()=>c.connect(outsider).joinPact(id,{value:stake}));
    await reject(()=>c.connect(b).joinPact(id,{value:stake+1n}));
    await tx(c.connect(b).joinPact(id,{value:stake}));
    const p=await c.pacts(id); assert.equal(p.state,2n); assert.equal(p.refundAfter-p.endsAt,600n);
  });
  await test('no early confirmations, cancellations, duplicate joins or early refunds',async()=>{
    await reject(()=>c.confirmCompletion(id)); await reject(()=>c.cancelPact(id));
    await reject(()=>c.connect(b).joinPact(id,{value:stake})); await reject(()=>c.refundTimedOut(id));
  });
  await advance(11);
  await test('outsiders cannot confirm; one confirmation does not release funds',async()=>{
    await reject(()=>c.connect(outsider).confirmCompletion(id));
    await tx(c.confirmCompletion(id,{gasLimit:200000}));
    assert.equal(await c.credits(aa),0n); assert.equal((await c.pacts(id)).state,2n);
    await reject(()=>c.confirmCompletion(id));
  });
  await test('both confirmations credit each participant exactly once',async()=>{
    await tx(c.connect(b).confirmCompletion(id,{gasLimit:200000}));
    assert.equal((await c.pacts(id)).state,3n);
    assert.equal(await c.credits(aa),stake); assert.equal(await c.credits(bb),stake);
    await reject(()=>c.refundTimedOut(id)); await reject(()=>c.connect(b).confirmCompletion(id));
  });
  await test('withdrawals clear credits and duplicate claims fail',async()=>{
    await tx(c.withdraw()); assert.equal(await c.credits(aa),0n); await reject(()=>c.withdraw());
    await tx(c.connect(b).withdraw()); assert.equal(await c.credits(bb),0n);
  });
  await test('waiting creator can cancel and then buddy cannot join',async()=>{
    const n=await create(); await reject(()=>c.connect(b).cancelPact(n)); await tx(c.cancelPact(n));
    assert.equal(await c.credits(aa),stake); await reject(()=>c.connect(b).joinPact(n,{value:stake}));
    await tx(c.withdraw({gasLimit:100000}));
  });
  await test('expired invitation returns creator deposit',async()=>{
    const n=await create(); await advance(86401);
    await reject(()=>c.connect(b).joinPact(n,{value:stake})); await tx(c.connect(outsider).refundTimedOut(n));
    assert.equal((await c.pacts(n)).state,5n); assert.equal(await c.credits(aa),stake);
    await tx(c.withdraw({gasLimit:100000}));
  });
  await test('missing confirmation cannot lock either deposit past timeout',async()=>{
    const n=await create(); await tx(c.connect(b).joinPact(n,{value:stake})); await advance(11);
    await tx(c.confirmCompletion(n,{gasLimit:200000})); await advance(600);
    await reject(()=>c.connect(b).confirmCompletion(n)); await tx(c.connect(outsider).refundTimedOut(n,{gasLimit:200000}));
    assert.equal(await c.credits(aa),stake); assert.equal(await c.credits(bb),stake);
    await reject(()=>c.refundTimedOut(n));
    await tx(c.withdraw({gasLimit:100000})); await tx(c.connect(b).withdraw({gasLimit:100000}));
    const balance=await rpc.request({method:'eth_getBalance',params:[c.target,'latest']}); assert.equal(BigInt(balance),0n);
  });
  await test('operations on nonexistent pacts fail',async()=>{
    await reject(()=>c.joinPact(99999,{value:stake})); await reject(()=>c.confirmCompletion(99999)); await reject(()=>c.refundTimedOut(99999));
  });
  await test('rejecting receiver cannot block another participant’s claim',async()=>{
    const solc=require('solc');
    const source='pragma solidity ^0.8.24; interface I{function joinPact(uint256)external payable;function withdraw()external;} contract R{function join(address c,uint256 id)external payable{I(c).joinPact{value:msg.value}(id);}function claim(address c)external{I(c).withdraw();}receive()external payable{revert("no");}}';
    const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'R.sol':{content:source}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
    const art=out.contracts['R.sol'].R;
    const r=await new ethers.ContractFactory(art.abi,'0x'+art.evm.bytecode.object,a).deploy(); await r.waitForDeployment();
    const n=await c.nextId(); await tx(c.createPact(r.target,10,{value:stake})); await tx(r.join(c.target,n,{value:stake}));
    await advance(611); await tx(c.refundTimedOut(n)); await reject(()=>r.claim(c.target));
    assert.equal(await c.credits(r.target),stake); await tx(c.withdraw({gasLimit:100000})); assert.equal(await c.credits(aa),0n);
  });
  console.log(`\n${passed} integration groups passed.`); await rpc.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
