# RT-V6 · Product validation: Compared with what exists today

- **Issue:** #13
- **Country / general region:** Nigeria (West Africa)
- **Did you run the demo locally?** no

## 1. First read — what do you think it is?

*Read the README only up to its first `##` heading. Write this before reading anything else.*

- What does MicoPay Rentas do, in your own words?
  > From reading up to the first heading, it appears to be a vacation and short-stay rental platform for Tepoztlán, Morelos, where guest booking payments are held securely in a Stellar escrow contract rather than entering a traditional company's bank account. Hosts only receive payment after guest check-in, while cancellation policies and damage deposits are codified directly into the contract with a 3% platform fee.
- Who is it for?
  > Guests looking for vacation or short-term rentals and property hosts who want a transparent, secure rental agreement without excessive middleman fees, initially centered around Tepoztlán, Morelos.
- What problem does it solve?
  > It solves the counterparty trust problem where guests worry that hosts will take upfront payments and cancel or deliver poor housing, and hosts worry about cancellations and property damage. It removes reliance on a traditional platform bank account to hold funds by using smart contract custody (`escrow-v2`), while keeping platform fees at 3%.

## 2. After the full README — what did you get wrong?

- What did you misunderstand in step 1, or what surprised you?
  > In step 1, I assumed the app was already fully hooked up to a consumer mobile payment app where users pay directly with regular fiat cards or bank accounts. I was surprised to learn in the section "How it connects to the MicoPay app (planned)" that today it runs standalone with local testnet keys and USDC token conversions (`1 USD = X MXN at booking`), while cash-in via local agents or bank SPEI payouts are still planned. I was also pleasantly surprised by step 5 of "How a booking works" ("Nobody acts"), which includes an automatic timeout fallback: if claims close without action, or if an arbiter fails to rule within 7 days, the contract automatically pays out the stay to the host and refunds the deposit to the guest so money is never trapped indefinitely.
- What is still unclear?
  > How dispute evidence is actually submitted and reviewed. Step 4 ("Disputes") and the contract functions `dispute(id)` and `resolve(id, ...)` mention that the arbiter splits the escrow, but neither the README nor the `BookingPage` UI shows how guests or hosts submit supporting documentation, photos, or messaging to justify why a deposit should be kept or refunded. Additionally, while the README notes a 7-day arbiter window and a demo clock (`DEMO_DAY_SECS`), it does not state how many hours or days after check-in the real-world "until claims close" deadline actually lasts.

## 3. Short-term rentals where you live

- Your country / general region (no city or address needed).
  > Nigeria (West Africa).
- Where you live, how do people rent homes for short stays? (Airbnb, Booking, other platforms, social media groups, renting directly…)
  > People primarily book short-stay apartments through direct messaging on WhatsApp or Instagram, social media property listings, local classifieds, and personal word-of-mouth recommendations. A smaller segment uses Airbnb or Booking.com, but international card limits and high platform fees push a large majority toward direct peer-to-peer arrangements settled via direct bank transfer.
- What fees do guests or hosts notice, and what do they think of them? A percentage is fine; no amounts of money.
  > On major platforms like Airbnb, guests and hosts notice combined fees that easily range from 14% to over 20%, along with unfavourable foreign exchange rates on local debit cards. In direct peer-to-peer rentals, property managers frequently demand a 10% caution fee and a 10% agency or service charge. People resent both: OTA fees feel bloated for simple bookings, while direct agent fees feel like unearned markups.
- Do people book directly with the host? What makes them trust or distrust doing that?
  > Yes, direct booking is very popular because it avoids hefty platform commissions and allows negotiating terms directly. However, it requires intense caution. People only trust direct bookings if a close friend previously stayed there or if the host has visible social media longevity. Distrust is high when dealing with unverified hosts because rental scams are frequent—scammers advertise apartments with fake or stolen photos, demand full upfront payment by bank transfer, and vanish as soon as the money is sent.
- Are there common problems with cancellations, damage deposits or disputes?
  > Constantly. Caution and damage deposits are the biggest source of disputes: hosts often delay returning deposits for weeks after checkout or invent arbitrary deductions for pre-existing wear and tear. Cancellations are equally problematic because once a host receives a direct bank transfer, guests rarely get any refund if an emergency arises, leaving guests with zero leverage.
- Do you live this yourself (as a guest or host), see it up close, or only hear about it?
  > I live this myself as a guest who frequently travels and rents short-stay apartments, and I see it up close with friends and colleagues who host and manage rental properties.

## 4. Value

- **How useful does it look to you?** 1 (not at all) – 5 (very). Why?
  > 4. It strikes the perfect balance between the trustless safety of an intermediary and the low cost of direct booking. Holding funds in `escrow-v2` until check-in and having the damage deposit automated by contract directly resolves the fear of fake listings and withheld deposits. It is not a 5 only because crypto/USDC settlement remains a usability barrier for mainstream users who are accustomed to instant local bank transfers.
- What is the most valuable part?
  > The transparent 3% platform fee (README line 3) combined with the smart contract custody of the damage deposit ("The cancellation policy and the damage deposit live in the contract", and step 2 of "How a booking works" where "the deposit always comes back" unless claimed). In direct bookings, hosts hold the deposit hostage; here, neither party can unilaterally take it.
- What is missing?
  > A photo/video evidence upload step for damage claims and dispute reporting on the `BookingPage`, plus an on-chain host reputation score or property verification badge so guests know the physical house has been inspected.
- What would stop you (or the person in your issue's role) from using it?
  > Having to manually manage Stellar wallets, secret keys, or purchase USDC on an exchange. Without the planned MicoPay app connection supporting local cash agents or bank transfers, most everyday guests and hosts I know would give up before completing the checkout step.

## 5. The MicoPay app

*The README section "How it connects to the MicoPay app (planned)" describes the guest paying from the MicoPay app and the host cashing out with an agent or via SPEI.*

- Does that connection make the product more useful to you? What would it change for you?
  > Yes, it completely transforms the product from a niche crypto prototype into a practical everyday rental platform. Being able to pay from the MicoPay app using local currency or cash-in agents, and having hosts withdraw to their bank account via SPEI (or equivalent local fast-payment rails), removes the entire crypto learning curve while retaining the escrow protection under the hood.

## 6. What confused you

- Which screen, step or term confused you, and what did you expect instead?
  > On the `BookingPage` screen under the "Escrow on Stellar" timeline, the second node is "Check-in" and the third is "Claims close". The README says "The host is paid after check-in", but on the action panel, the prompt says "If you do nothing, the contract pays the host when claims close." This made me wonder if the host receives payment immediately at check-in or only when claims close. I expected a clearer UI indicator explaining that payment unlocks for guest release at check-in, but auto-settles only once the claims window expires.

## 7. Questions for your issue

- Compared with Airbnb, booking directly with the host, or a social media group, why would you switch to this, or not?
  > - **Compared with Airbnb:** I would switch to MicoPay Rentas because of the dramatically lower fee (3% vs. 14–20%+ on Airbnb) and the impartial escrow model where the platform cannot arbitrarily redirect my money ("cannot send funds anywhere else, and the platform can never take more than its fee"). The reason I might hesitate to switch immediately is Airbnb's comprehensive guest guarantees (emergency alternative accommodation if a host cancels last minute).
  > - **Compared with direct booking / social media groups:** I would switch to MicoPay Rentas in a heartbeat. Booking directly via WhatsApp or Instagram offers low fees but zero security: hosts demand 100% upfront bank transfers and often refuse to return damage deposits. MicoPay Rentas gives the low fees of a direct relationship while protecting both parties with `escrow-v2` and impartial arbitration.
- Which matters more to you: a lower fee, or the guarantees of a big platform? Why?
  > A lower fee matters more for regular domestic trips and stays with verified or returning hosts, because losing 15–20% on every booking to a corporate platform feels unreasonable when all they do is process the payment. However, for a one-off trip to an unfamiliar city, a big platform's guarantees (such as emergency rebooking if a listing does not exist) carry significant weight. MicoPay Rentas offers the best compromise by providing hard smart-contract payment guarantees at a fraction of the cost (3%), making high platform markups unnecessary.
- What would it have to do much better than what you use today?
  > It would have to handle dispute turnaround and deposit returns much faster and more transparently than traditional platforms. On big platforms, disputes are handled by distant customer support agents following rigid, opaque scripts that often leave both guests and hosts frustrated. On MicoPay Rentas, the 7-day arbiter window and automatic settlement fallback ("A dispute the arbiter doesn't decide within 7 days settles the same way, so funds are never stuck") provide algorithmic predictability. If it pairs that with instant photo evidence submission and responsive local arbitration, it would be significantly better than both Airbnb and direct informal agreements.

## 8. Ideas

Up to 3. For each one: the problem it solves, then the idea.

1. **Problem:** If a host fails to provide check-in instructions or the property does not exist upon arrival, the guest is stranded in a strange location without immediate funds to book elsewhere. · **Idea:** Implement a check-in verification code or check-in check: if the host does not confirm check-in within a 2-hour window after the scheduled time, the guest can cancel with an immediate 100% refund from escrow rather than waiting for an arbiter dispute.
2. **Problem:** When a guest clicks "Report a problem" or a host clicks "Claim damage" on the `BookingPage`, there is no structured field to attach photos, receipts, or notes, forcing arbitration to occur out-of-band without clear evidence. · **Idea:** Add an integrated photo upload and damage claim modal in `BookingPage.tsx` where parties upload timestamped photos at check-in and checkout to substantiate claims before the arbiter reviews the split.
3. **Problem:** Hosts who find guests through social media groups (e.g., WhatsApp, Instagram, Facebook) want escrow protection without needing to rebuild their entire listing workflow or switch platforms. · **Idea:** Add a "Share Booking Agreement Link" feature on `ListingPage.tsx` that generates a custom escrow payment link with pre-agreed dates and pricing that a host can send directly to a client on social media to close a direct booking safely.
