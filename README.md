# BOT Stockroom

A tiny inventory log for small shops. Every restock, sale or correction is stamped on BOT Chain, so your stock history can't be quietly edited.

*No tokens, no payments, no admin, no personal data. Everything stored is public, so use demo products.*

## Status

| | |
|---|---|
| Live site | https://www.botstockroom.website/ |
| Contract (BOT Chain mainnet, chain ID 677) | [`0xa25771b68d4d8492fef3c2b9AF0e2a545C5E00B7`](https://scan.botchain.ai/address/0xa25771b68d4d8492fef3c2b9AF0e2a545C5E00B7) |
| Contract (testnet, chain ID 968) | _not deployed yet_ |

## Project layout

- `index.html` — the whole frontend (ethers.js v6 from CDN, no build step, no backend)
- `contracts/Stockroom.sol` — the contract (Solidity ^0.8.20)
- `deploy.html` — one-click deploy from MetaMask
- `build/` — compiled ABI and bytecode, plus the standard JSON input for explorer verification
- `tools/` — scripts that compile the contract and test it
- `images/bot-chain-black.png` — the BOT Chain logo used in the footer

## Run locally

```bash
python3 -m http.server 4604
```

Then open http://localhost:4604. Until a contract address is configured the site runs in *preview mode*: changes are saved in this browser's localStorage, so every screen can be reviewed before deploying. "View demo shop" shows built-in sample data until `CONFIG.demoShop` is set.

## 1. Deploy the contract

Compiled with Solidity 0.8.20, optimizer 200 runs, EVM `paris`.

1. Run the site locally and open http://localhost:4604/deploy.html in a browser with MetaMask.
2. Click **Deploy to Testnet (968)**, confirm in MetaMask, then try the app at http://localhost:4604/?net=testnet. On localhost the app picks up the address you just deployed.
3. Click **Deploy to Mainnet (677)**.
4. Paste each address into the matching `contract: ''` field in `CONFIG.networks` near the top of the script in `index.html`, and into the Status table above. That one constant feeds the app, the footer and the explorer link.
5. Optional: add a few demo products from one wallet and put that wallet's address in `CONFIG.demoShop`, so "View demo shop" opens a real on-chain stockroom.

Or use Remix: paste `contracts/Stockroom.sol` into https://remix.ethereum.org, compile with 0.8.20 and EVM version `paris`, deploy with *Injected Provider – MetaMask*.

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| Mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |

To verify the source on the explorer, use "Standard JSON input" with `build/Stockroom.standard-input.json` and compiler `v0.8.20+commit.a1b79de6`.

## 2. Publish the site

GitHub Pages serves the `gh-pages` branch, so publish with `git push origin main:gh-pages` after pushing `main`. For a custom domain, add it under Settings → Pages, which creates the `CNAME` file. The public view is `https://<your-domain>/?shop=<wallet address>`.

## How it works

- Each wallet has its own stockroom. Only that wallet can add products or change stock.
- A change can't take a quantity below zero. The app checks before sending and the contract reverts anyway.
- Every change stores the delta, the quantity after, a reason (Restock, Sale, Damaged, Correction) and the block time. History is append-only.
- A product is LOW when its quantity is at or below its low-stock level. This is worked out in the UI.
- The "tx ↗" links in a product's history come from the contract's `StockChanged` events, which line up one-to-one with the stored history.

## Contract tools

```bash
npm --prefix tools install
node tools/compile.mjs        # writes build/
node tools/test-contract.mjs  # runs the contract on an in-memory chain
```
