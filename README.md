# MicoPay Rentas

Short-term rentals in Tepoztlán, Morelos, where the booking payment waits in a Stellar escrow instead of a platform's bank account. The host is paid after check-in. The cancellation policy and the damage deposit live in the contract. The platform fee is 3 %.

Testnet demo. The listings are fictional homes.

## How a booking works

1. **Book.** The guest pays stay + cleaning + 3 % fee + a refundable damage deposit into `escrow-v2`, in USDC from their MicoPay account. Prices are in MXN and convert at MicoPay's USDC/MXN rate.
2. **Before check-in.**
   - If the guest cancels, the policy decides the refund (flexible, moderate or strict). The rest goes to host and platform in proportion, and the deposit always comes back.
   - If the host cancels, the guest gets everything back.
3. **After check-in.** The guest can release the payment, or report a problem until claims close. The host can claim damage in the same window.
4. **Disputes.** The arbiter (MicoPay) splits the escrow between guest, host and platform. It cannot send funds anywhere else, and the platform can never take more than its fee.
5. **Nobody acts.** After claims close, anyone can settle: the host gets the stay and the guest the deposit. A dispute the arbiter doesn't decide within 7 days settles the same way, so funds are never stuck.

## Contract: `contracts/escrow-v2`

Soroban, `soroban-sdk` 26. 16 unit tests cover every path, the policy validation, and that every path leaves the escrow empty.

```
lock(id, payer, beneficiary, amount, fee, deposit, check_in, deadline, policy)
cancel(id) · host_cancel(id) · release(id, by) · dispute(id) · claim_damage(id)
resolve(id, to_payer, to_beneficiary, to_platform) · settle_default(id) · bump(id)
```

Testnet deployment:
- Contract: `CDTZISWUVPJ7YY4PTK73XE37ZT5KYYBVKUMUZ74Z3X6BAU5RTXBBKS55`
- Token: MicoPay's testnet USDC
- Arbiter window: 7 days

The booking `id` is the SHA-256 of the booking terms plus a random salt.

## Run it

```
npm install
ESCROW_CONTRACT_ID=CDTZ… npm run seed   # testnet accounts, USDC, listings
npm run dev:api                         # http://127.0.0.1:8797
npm run dev:web                         # http://localhost:5190
npx tsx apps/api/test/e2e.ts            # every escrow path on testnet (~6 min)
cd contracts/escrow-v2 && cargo test
```

The seed needs the `stellar` CLI identities `rentas-admin` (admin and arbiter) and `rentas-plataforma` (fee wallet). It also needs the issuer key of MicoPay's testnet USDC in `~/.micopay/ensayo-usdc.json`.

**Demo clock.** `DEMO_DAY_SECS` (default 60) is how long one calendar day lasts on-chain. A stay three days ahead checks in three minutes after booking, so the whole lifecycle fits in a demo. Set it to `86400` for real time. The 7-day arbiter window is not scaled.

**Signing.** In the demo, guests and hosts sign with local testnet keys. In production they approve in the MicoPay app (`/sign-requests`), the same path as MicoPay Café.

## Stack

TypeScript monorepo, Fastify API, Postgres (PGlite locally), React + Vite + Tailwind with the MicoPay app's design tokens, Stellar SDK (Soroban RPC + Horizon).

MIT license.
