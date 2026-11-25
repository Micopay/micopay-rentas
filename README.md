# MicoPay Rentas

Short-term rentals in Tepoztlán, Morelos, where the booking payment waits in a Stellar escrow instead of a platform's bank account. The host is paid after check-in. The cancellation policy and the damage deposit live in the contract. The platform fee is 3 %.

**Status:** Testnet demo. The listings are fictional homes.

**Custody:** the `escrow-v2` contract holds booking funds until they are released or refunded. MicoPay acts as arbiter in disputes: it can split a booking's escrow between guest, host and platform, but cannot send funds anywhere else.

## How it connects to the MicoPay app (planned)

MicoPay Rentas is part of the [MicoPay](https://github.com/Micopay) ecosystem. **Today it runs on its own: guests and hosts sign with local testnet keys, not with the MicoPay app.** The planned connection:

- **The guest pays from the MicoPay app,** in USDC, or with cash turned into digital money through the MicoPay cash network.
- **The host is paid into their MicoPay account** and can cash out with a MicoPay agent or send it to their bank via SPEI.
- **Both approve bookings, releases and claims in the app** (`/sign-requests`), the same path as MicoPay Café.
- **One identity across MicoPay products:** the Stellar address.

## How a booking works

1. **Book.** The guest pays stay + cleaning + 3 % fee + a refundable damage deposit into `escrow-v2`, in USDC from their MicoPay account. Prices are in MXN and convert at MicoPay's USDC/MXN rate.
2. **Before check-in.**
   - If the guest cancels, the policy decides the refund (flexible, moderate or strict). The rest goes to host and platform in proportion, and the deposit always comes back.
   - If the host cancels, the guest gets everything back.
3. **After check-in.** The guest can report a problem during the stay hold. Once the hold ends (one calendar day by default), anyone can pay the host for the stay and fee; the damage deposit remains in escrow.
4. **Claims and disputes.** Until claims close, the guest can release the deposit or report a problem, and the host can claim damage. The arbiter (MicoPay) can split the deposit after the stay has been paid, but cannot take any platform fee from that deposit.
5. **Nobody acts.** After claims close, anyone can settle: the guest gets the deposit back. A dispute the arbiter doesn't decide within 7 days settles the same way, so funds are never stuck.

## Contract: `contracts/escrow-v2`

Soroban, `soroban-sdk` 26. 16 unit tests cover every path, the policy validation, and that every path leaves the escrow empty.

```
lock(id, payer, beneficiary, amount, fee, deposit, check_in, stay_hold_secs, deadline, policy)
cancel(id) · host_cancel(id) · pay_stay(id) · release(id, by) · dispute(id) · claim_damage(id)
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

**Running it outside MicoPay:** the seed needs the `stellar` CLI identities `rentas-admin` (admin and arbiter) and `rentas-plataforma` (fee wallet). It also needs the issuer key of MicoPay's testnet USDC in `~/.micopay/ensayo-usdc.json`.

**Demo clock.** `DEMO_DAY_SECS` (default 60) is how long one calendar day lasts on-chain. `STAY_HOLD_DAYS` (default 1) controls how many calendar days after check-in the stay can be paid; it is scaled by the demo clock. A stay three days ahead checks in three minutes after booking, so the whole lifecycle fits in a demo. Set `DEMO_DAY_SECS=86400` for real time. The 7-day arbiter window is not scaled.

**Signing.** In the demo, guests and hosts sign with local testnet keys. In production they approve in the MicoPay app (`/sign-requests`), the same path as MicoPay Café.

## Stack

TypeScript monorepo, Fastify API, Postgres (PGlite locally), React + Vite + Tailwind with the MicoPay app's design tokens, Stellar SDK (Soroban RPC + Horizon).

MIT license.
