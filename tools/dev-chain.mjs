// Starts a local chain on http://127.0.0.1:8545 with the contract deployed and a small demo shop,
// so the app can be tried end to end without spending anything: http://localhost:4604/?net=local
// Usage (from the project root): node tools/compile.mjs && node tools/dev-chain.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/Stockroom.json'), 'utf8'));
// The address CONFIG.networks.local.contract in index.html expects (first deployment of ganache's deterministic account 0).
const EXPECTED = '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab';

const server = ganache.server({ logging: { quiet: true }, chain: { hardfork: 'merge', chainId: 1337 }, wallet: { deterministic: true } });
await server.listen(8545);

const provider = new BrowserProvider(server.provider);
const [owner, demo] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);
const contract = await (await new ContractFactory(abi, bytecode, owner).deploy()).waitForDeployment();
const address = await contract.getAddress();
assert.equal(address, EXPECTED, 'unexpected contract address');

const shop = contract.connect(demo);
await (await shop.addProduct('Oat Milk 1L', 'OAT-1L', 30, 12)).wait();
await (await shop.addProduct('House Espresso Beans 250g', 'ESP-250', 9, 10)).wait();
await (await shop.adjustStock(0, 12, 0)).wait();
await (await shop.adjustStock(0, -5, 1)).wait();

console.log(`local chain ready on http://127.0.0.1:8545 (chain ID 1337)
contract   ${address}
wallet     ${owner.address}  (empty stockroom)
demo shop  ${demo.address}
Press Ctrl+C to stop.`);
