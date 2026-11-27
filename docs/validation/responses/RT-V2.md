# RT-V2 · Product validation: The host: would you rent your home this way?

- **Issue:** #9
- **Country / general region:** Nigeria (West Africa)
- **Did you run the demo locally?** no

## 1. First read — what do you think it is?

*Read the README only up to its first `##` heading. Write this before reading anything else.*

- What does MicoPay Rentas do, in your own words?
  > It's a short-stay rental service, starting with homes in Tepoztlán, Morelos. When a guest books, their payment does not go into the company's bank account — it waits in a Stellar escrow, and the host is paid only after check-in. The cancellation rules and the damage deposit are written into that escrow contract, and the platform fee is 3 %. It says it is a testnet demo with fictional homes, and that the money in escrow is held by a contract, with MicoPay acting as arbiter in disputes.
- Who is it for?
  > Two sides: guests who want to rent a place for a few nights, and hosts who want to rent out their home.
- What problem does it solve?
  > Trust over the money, mostly. Instead of a platform holding the guest's cash and deciding what happens to it, the payment sits in an escrow contract that releases by fixed rules: the host is paid after check-in and the deposit follows the contract, not someone's judgement. That sounds like it protects the host from not getting paid and the guest from losing money.

## 2. After the full README — what did you get wrong?

- What did you misunderstand in step 1, or what surprised you?
  > From the opening I assumed "escrow" was branding for the platform holding the money the way an ordinary rental site does, with staff deciding refunds. What surprised me is that it is a real on-chain contract (`contracts/escrow-v2`, "Soroban, `soroban-sdk` 26", 16 unit tests) and, more importantly, that the cancellation tiers and the deposit are fixed at booking — the Listing page says "These rules are written into the escrow contract when you book: nobody can change them afterwards." I also did not expect step 5, "Nobody acts": after claims close, anyone can settle, and "A dispute the arbiter doesn't decide within 7 days settles the same way, so funds are never stuck." As a host that last part is the biggest surprise, because even MicoPay, as arbiter, "cannot send funds anywhere else, and the platform can never take more than its fee."
- What is still unclear?
  > How a host proves damage. Step 4 ("Disputes") and the contract functions `dispute`/`claim_damage`/`resolve` say the arbiter splits the escrow, but nowhere does the README or the Booking screen show where I attach photos or a note to support a damage claim. Also, "claims close" is the deadline that matters to a host, but the README only gives the 7-day arbiter window — it never says how long the claims window itself is in real days.

## 3. Short-term rentals where you live

- Your country / general region (no city or address needed).
  > Not answered.
- Where you live, how do people rent homes for short stays? (Airbnb, Booking, other platforms, social media groups, renting directly…)
  > Not answered.
- What fees do guests or hosts notice, and what do they think of them? A percentage is fine; no amounts of money.
  > Not answered.
- Do people book directly with the host? What makes them trust or distrust doing that?
  > Not answered.
- Are there common problems with cancellations, damage deposits or disputes?
  > Not answered.
- Do you live this yourself (as a guest or host), see it up close, or only hear about it?
  > Not answered.

## 4. Value

- **How useful does it look to you?** 1 (not at all) – 5 (very). Why?
  > 4. The parts I care about as a host — being paid after check-in, the fee being paid by the guest, and rules that cannot be renegotiated after booking — are exactly what make renting out a home stressful today. It is not a 5 because the host side still depends on the planned MicoPay app connection to actually get the money out, and there is no evidence step for damage.
- What is the most valuable part?
  > The fixed, written-down rules plus the automatic fallback. The Listing page prints the policy up front, the Booking page's "Escrow on Stellar" timeline ends with "Claims close", and if nothing happens "anyone can finish it: the host gets the stay, the guest the deposit" (the `Claims closed` panel / `settle-default`). Knowing the payout cannot be quietly held forever is worth more to me than the low fee.
- What is missing?
  > A way to submit evidence for a damage claim, and a clear host payout time. The Hosting screen shows money as "Waiting in escrow — Paid out after each check-in", but the Booking page as host only mentions "claims close", so I cannot tell whether I am paid at check-in or at the end of the window. There is also no listing verification.
- What would stop you (or the person in your issue's role) from using it?
  > Not answered.

## 5. The MicoPay app

*The README section "How it connects to the MicoPay app (planned)" describes the guest paying from the MicoPay app and the host cashing out with an agent or via SPEI.*

- Does that connection make the product more useful to you? What would it change for you?
  > Yes — it is the difference between a host receiving money they can use and a host holding testnet tokens. The Hosting screen already labels the payout wallet "Balance in MicoPay" with the line "Withdraw to SPEI or cash in the MicoPay app", and the app section says the host is paid into their MicoPay account and can cash out with a MicoPay agent or send it to their bank via SPEI. It would also remove the wallet/key work for the host: approvals move to the app at `/sign-requests`, "the same path as MicoPay Café", with one identity (the Stellar address) across MicoPay products.

## 6. What confused you

- Which screen, step or term confused you, and what did you expect instead?
  > The timing of the host payout. On the Booking page the host panel says "You are paid [the stay amount] after check-in", but the same page's timeline has "Check-in" then "Claims close", and the later panel says "Nobody acted... the host gets the stay". The README line "The host is paid after check-in" and the Hosting screen's "Paid out after each check-in" push me toward "at check-in", while the timeline pushes me toward "when claims close". I expected one explicit sentence: the host is paid at check-in (by the guest releasing, or by the arbiter) and only defaults later if nobody acts. I also briefly misread the 3 % fee as coming out of the host's payout, until the Hosting screen clarified "the fee is paid by the guest".

## 7. Questions for your issue

- If you rented out your home, would it work for you to be paid after check-in with a 3 % fee? Why?
  > Yes. Being paid after check-in is what I would actually want: the guest's money is secured in escrow from the moment of booking (step 1, "Book"), so I am not chasing a transfer and I am not the one holding their cash and owing refunds. The 3 % is small next to what big platforms and local agents take for the same booking, and — the part that decides it for me — the Hosting screen says "Full price: the fee is paid by the guest", so the stay I get is the full stay. What I would still need is to know when "after check-in" actually pays out, since the money shows as "Waiting in escrow — Paid out after each check-in" until then.
- What worries you (damage, cancellations, disputes, getting your money out)?
  > - Damage: my only cover is the refundable deposit, and there is no evidence step — the Booking page just offers "Claim damage" and says "the arbiter decides how the deposit is split". If the damage is bigger than the deposit, that is on me.
  > - Cancellations: the policy is fixed at booking and "Later than that: the stay is not refunded", which protects me, but a late guest cancellation still leaves the home empty; and if I cancel, I refund the guest "in full" (host panel), so cancelling is expensive for me.
  > - Disputes: as arbiter, MicoPay can split the escrow between guest, host and platform, and if it "doesn't decide within 7 days the contract pays out by default" — which could release the booking before my damage claim is decided.
  > - Getting my money out: today it is testnet accounts and USDC; "Withdraw to SPEI or cash in the MicoPay app" is still the planned part, so until then there is nothing I can spend where I live.
- What would make you list your home here as well as, or instead of, a big platform?
  > The lower, guest-paid fee and keeping the full stay, plus rules I can read up front and that "nobody can change... afterwards", and the promise that funds are "never stuck". That would make me list here instead of an agent-led direct booking, where I hold the cash and I own the disputes. What would make me keep a big platform *as well* is demand and the guest-side safety net — if a listing turns out not to be real, a big platform rebooks the guest; MicoPay Rentas has no such guarantee and no listing verification, so guests may trust it less and I would worry about getting bookings at all.

## 8. Ideas

Up to 3. For each one: the problem it solves, then the idea.

1. **Problem:** a host has no way to attach evidence to a damage claim, so the arbiter decides the deposit with no proof. · **Idea:** capture timestamped photos at check-in and check-out and store them on the booking, so `claim_damage` and `dispute` come with something to judge.
2. **Problem:** the host payout timing is ambiguous ("after check-in" vs the "Claims close" step). · **Idea:** show an explicit host payout date or countdown on the Hosting and Booking pages, stating that the host is paid at check-in by release/arbiter and only defaults after the window.
3. **Problem:** a host cannot see how much the refundable deposit will actually cover, and it is not theirs to set. · **Idea:** show the deposit amount the host will be able to claim per booking, and let the host set it per listing, so cover matches what is in the home.
