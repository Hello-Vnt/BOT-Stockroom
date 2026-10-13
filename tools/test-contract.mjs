// Runs the compiled contract on an in-memory chain and checks the add → adjust → read round trip.
// Usage (from the project root): node tools/compile.mjs && node tools/test-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/Stockroom.json'), 'utf8'));

const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'merge' } }));
const [alice, bob] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);

const contract = await (await new ContractFactory(abi, bytecode, alice).deploy()).waitForDeployment();
const events = (receipt) => receipt.logs.map((l) => contract.interface.parseLog(l));

// addProduct logs the starting quantity as the first change
const added = await (await contract.addProduct('Oat Milk 1L', 'OAT-1L', 30, 10)).wait();
console.log(`addProduct gas: ${added.gasUsed}`);
assert.deepEqual(events(added).map((e) => e.name), ['ProductAdded', 'StockChanged']);
assert.equal(events(added)[0].args.id, 0n);
assert.equal(events(added)[0].args.shop, alice.address);

let [product] = await contract.getProducts(alice.address);
assert.deepEqual([product.name, product.sku, product.qty, product.lowAt], ['Oat Milk 1L', 'OAT-1L', 30n, 10n]);
let log = await contract.getHistory(alice.address, 0);
assert.equal(log.length, 1);
assert.deepEqual([log[0].delta, log[0].qtyAfter, log[0].reason], [30n, 30n, 0n]);

// restock, then a sale
const restock = await (await contract.adjustStock(0, 12, 0)).wait();
console.log(`adjustStock gas: ${restock.gasUsed}`);
assert.deepEqual([...events(restock)[0].args].slice(2), [12n, 42n, 0n]);
await (await contract.adjustStock(0, -40, 1)).wait();

[product] = await contract.getProducts(alice.address);
assert.equal(product.qty, 2n);
log = await contract.getHistory(alice.address, 0);
assert.deepEqual(log.map((c) => [c.delta, c.qtyAfter, c.reason]), [[30n, 30n, 0n], [12n, 42n, 0n], [-40n, 2n, 1n]]);
// "at" collides with Array.prototype.at on an ethers Result, so read it by position
assert.ok(log.every((c) => c[3] > 0n));

// each wallet has its own stockroom
await (await contract.connect(bob).addProduct('Bob Tea', '', 0, 0)).wait();
assert.equal((await contract.getProducts(alice.address)).length, 1);
assert.equal((await contract.getProducts(bob.address)).length, 1);
assert.equal((await contract.getProducts(provider.getSigner(2).then((s) => s.address))).length, 0);

// StockChanged logs line up one-to-one with the history, which the UI relies on for tx links
const logs = await contract.queryFilter(contract.filters.StockChanged(alice.address, 0));
assert.deepEqual(logs.map((l) => l.args.qtyAfter), log.map((c) => c.qtyAfter));

const reverts = async (call, name) => {
  await assert.rejects(call, (e) => e.revert?.name === name, `expected ${name}`);
};
await reverts(contract.adjustStock.staticCall(0, -3, 1), 'BelowZero');
await reverts(contract.adjustStock.staticCall(0, 0, 0), 'ZeroDelta');
await reverts(contract.adjustStock.staticCall(0, 1, 4), 'InvalidReason');
await reverts(contract.adjustStock.staticCall(1, 1, 0), 'ProductNotFound');
await reverts(contract.connect(bob).adjustStock.staticCall(1, 1, 0), 'ProductNotFound');
await reverts(contract.adjustStock.staticCall(0, 2147483647, 0), 'QuantityTooLarge');
await reverts(contract.addProduct.staticCall('', 'X', 1, 1), 'EmptyName');
await reverts(contract.addProduct.staticCall('x'.repeat(65), 'X', 1, 1), 'TextTooLong');
await reverts(contract.addProduct.staticCall('X', 'x'.repeat(33), 1, 1), 'TextTooLong');
await reverts(contract.addProduct.staticCall('X', 'X', 2147483648, 1), 'QuantityTooLarge');

// emptying a product is allowed; going past empty is not
await (await contract.adjustStock(0, -2, 2)).wait();
assert.equal((await contract.getProducts(alice.address))[0].qty, 0n);
await reverts(contract.adjustStock.staticCall(0, -1, 1), 'BelowZero');

console.log('contract tests passed');
