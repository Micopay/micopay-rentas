/**
 * Demo data for Tepoztlán, Morelos, on Stellar testnet.
 *
 *  - escrow-v2 deployed with the `stellar` CLI (identities rentas-admin = admin/arbiter,
 *    rentas-plataforma = fee wallet); pass its id in ESCROW_CONTRACT_ID.
 *  - settles in MicoPay's testnet USDC (issuer GADK7…, the one the MicoPay app shows),
 *    minted with the issuer key of the USDC rehearsal (~/.micopay/ensayo-usdc.json).
 *  - two hosts and one guest with fresh testnet accounts and a USDC trustline.
 *
 * Listings are fictional demo homes, not real properties.
 *
 *   ESCROW_CONTRACT_ID=C... npm run seed -w apps/api
 */
import { Asset, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL, PG_DIR, saveKeys } from './config.js';
import { openDb } from './db.js';
import { NETWORK_PASSPHRASE } from './escrow.js';

const CONTRACT_ID = process.env.ESCROW_CONTRACT_ID ?? 'CDTZISWUVPJ7YY4PTK73XE37ZT5KYYBVKUMUZ74Z3X6BAU5RTXBBKS55';
const TOKEN_SAC = 'CCVAWF4XCJ5DLXHOFGO4TDEQBR6VJTIE5JYCZTXHCDULZ4XYH4GCVD23';
const horizon = new Horizon.Server(HORIZON_URL);

const cliSecret = (alias: string) => execSync(`stellar keys show ${alias}`, { encoding: 'utf8' }).trim();
const issuer = Keypair.fromSecret((JSON.parse(readFileSync(join(homedir(), '.micopay', 'ensayo-usdc.json'), 'utf8')) as { issuer: string }).issuer);
const asset = new Asset('USDC', issuer.publicKey());

async function account(name: string, usdc: string | null): Promise<Keypair> {
  const kp = Keypair.random();
  const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!fb.ok) throw new Error(`friendbot ${name}: ${fb.status}`);
  const acc = await horizon.loadAccount(kp.publicKey());
  const b = new TransactionBuilder(acc, { fee: '1000', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(120);
  if (usdc) b.addOperation(Operation.payment({ source: issuer.publicKey(), destination: kp.publicKey(), asset, amount: usdc }));
  const tx = b.build();
  tx.sign(kp, ...(usdc ? [issuer] : []));
  await horizon.submitTransaction(tx);
  console.log(`${name}: ${kp.publicKey()}${usdc ? ` (${usdc} USDC)` : ''}`);
  return kp;
}

const LISTINGS = [
  {
    slug: 'casa-tepozteco', host: 0, title: 'Casa Tepozteco', area: 'Barrio de San Miguel, Tepoztlán', cover: 0,
    summary: 'Stone house facing the Tepozteco hill, with a garden and terrace.',
    description: 'Three bedrooms around a garden, a terrace that looks straight at the Tepozteco pyramid, and a ten-minute walk to the market. Wood-fired temazcal on request.',
    nightly: '2800', cleaning: '450', deposit: '1500', guests: 6, bedrooms: 3, policy: 'moderate',
    amenities: ['Hill view', 'Garden', 'Wi-Fi', 'Kitchen', 'Parking'],
  },
  {
    slug: 'cabana-amatlan', host: 0, title: 'Cabaña Amatlán', area: 'Amatlán de Quetzalcóatl', cover: 1,
    summary: 'Small wooden cabin among the cliffs, for two.',
    description: 'A quiet cabin for two in Amatlán, the village where Quetzalcóatl was born according to legend. Hammocks, a fireplace and trails that start at the door.',
    nightly: '1350', cleaning: '250', deposit: '800', guests: 2, bedrooms: 1, policy: 'flexible',
    amenities: ['Fireplace', 'Hammocks', 'Trails', 'Wi-Fi'],
  },
  {
    slug: 'casa-atongo', host: 1, title: 'Casa del Valle de Atongo', area: 'Valle de Atongo', cover: 2,
    summary: 'Family house with a pool, 15 minutes from downtown.',
    description: 'Four bedrooms, a heated pool and a big garden for families or groups. Grill, ping-pong table and room for three cars.',
    nightly: '4200', cleaning: '700', deposit: '3000', guests: 8, bedrooms: 4, policy: 'strict',
    amenities: ['Pool', 'Grill', 'Garden', 'Wi-Fi', 'Parking'],
  },
  {
    slug: 'loft-centro', host: 1, title: 'Loft Centro', area: 'Centro, Tepoztlán', cover: 3,
    summary: 'Bright loft two blocks from the market and the convent.',
    description: 'An open loft with a rooftop, two blocks from the Sunday market and the Dominican convent. Ideal to walk everywhere.',
    nightly: '1600', cleaning: '300', deposit: '1000', guests: 2, bedrooms: 1, policy: 'flexible',
    amenities: ['Rooftop', 'Wi-Fi', 'Kitchen', 'Walk to market'],
  },
];

const hosts = [await account('Host Rosa', null), await account('Host Diego', null)];
const guest = await account('Guest Ana', '2000');

saveKeys({
  contractId: CONTRACT_ID,
  token: TOKEN_SAC,
  asset: { code: 'USDC', issuer: issuer.publicKey() },
  arbiter: cliSecret('rentas-admin'),
  platform: cliSecret('rentas-plataforma'),
  users: Object.fromEntries([...hosts, guest].map((k) => [k.publicKey(), k.secret()])),
});

rmSync(PG_DIR, { recursive: true, force: true });
const db = await openDb(PG_DIR);
const hostIds: number[] = [];
for (const [i, h] of hosts.entries()) {
  const [name, bio] = i === 0 ? ['Rosa Martínez', 'Born in Tepoztlán; rents two family houses.'] : ['Diego Flores', 'Moved from Mexico City in 2019; hosts families and remote workers.'];
  hostIds.push((await db.query<{ id: number }>(`INSERT INTO users (name, role, stellar_address, bio) VALUES ($1, 'host', $2, $3) RETURNING id`, [name, h.publicKey(), bio])).rows[0]!.id);
}
await db.query(`INSERT INTO users (name, role, stellar_address) VALUES ('Ana López', 'guest', $1)`, [guest.publicKey()]);
for (const l of LISTINGS) {
  await db.query(
    `INSERT INTO listings (host_id, slug, title, area, summary, description, nightly_mxn, cleaning_mxn, deposit_mxn, max_guests, bedrooms, policy, amenities, cover)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [hostIds[l.host], l.slug, l.title, l.area, l.summary, l.description, l.nightly, l.cleaning, l.deposit, l.guests, l.bedrooms, l.policy, JSON.stringify(l.amenities), l.cover],
  );
}
await db.close();
console.log(`Listo: ${LISTINGS.length} listings, escrow ${CONTRACT_ID}`);
