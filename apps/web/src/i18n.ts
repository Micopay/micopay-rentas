/* Minimal i18n, ported from MicoPay Café: the Spanish text is the key, English
   is a translation layer and the default language. `{name}` placeholders are
   interpolated. Data from the database (listing titles, descriptions) is not
   translated. Language precedence: ?lang= > saved choice > English. ?lang=
   wins even when storage is denied. */
export type Lang = 'es' | 'en';

const KEY = 'rentas.lang';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => { try { return window.localStorage; } catch { return null; } };

export function initialLang(search: string, store: Store | null): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (q === 'es' || q === 'en') {
    try { store?.setItem(KEY, q); } catch { /* denied storage: ?lang= still wins */ }
    return q;
  }
  try {
    const saved = store?.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* denied storage: default */ }
  return 'en';
}

export const lang: Lang = typeof window === 'undefined' ? 'en' : initialLang(window.location.search, storage());
export const locale = lang === 'en' ? 'en-US' : 'es-MX';
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Saves the choice and reloads without ?lang=, as café does. */
export function setLang(l: Lang) {
  try { storage()?.setItem(KEY, l); } catch { /* the reload below keeps it via ?lang= */ }
  const url = new URL(window.location.href);
  if (storage()) url.searchParams.delete('lang'); else url.searchParams.set('lang', l);
  window.location.replace(url.toString());
}

export function translate(l: Lang, s: string, vars?: Record<string, string | number>): string {
  let out = l === 'en' ? EN[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export const t = (s: string, vars?: Record<string, string | number>) => translate(lang, s, vars);

export const EN: Record<string, string> = {
  // chrome
  'Estancias': 'Stays',
  'Mis viajes': 'My trips',
  'Anfitrión': 'Hosting',
  'Disputas': 'Disputes',
  'Actuando como': 'Acting as',
  'huésped': 'guest',
  'anfitrión': 'host',
  'árbitro': 'arbiter',
  'No se pudieron cargar los usuarios · Reintentar': 'Failed to load users · Retry',
  'No se pudo cargar la configuración.': 'Failed to load config.',
  'Reintentar': 'Retry',
  'Demo en testnet · reloj de demo: 1 día calendario = {secs} s en la cadena, así que el check-in y los pagos ocurren en minutos': 'Testnet demo · demo clock: 1 calendar day = {secs} s on-chain, so check-in and payouts happen within minutes',
  'Los pagos los retiene el contrato escrow-v2 en Stellar testnet': 'Payments are held by the escrow-v2 contract on Stellar testnet',
  'Los alojamientos son casas de demostración ficticias.': 'Listings are fictional demo homes.',
  'Idioma': 'Language',

  // shared states
  'Cargando…': 'Loading…',
  'Cámbiate a una cuenta de huésped (arriba a la derecha) para ver tus viajes.': 'Switch to a guest account (top right) to view your trips.',
  'Cámbiate a una cuenta de anfitrión (arriba a la derecha) para ver tu panel.': 'Switch to a host account (top right) to view your hosting dashboard.',
  'Cámbiate al árbitro de MicoPay (arriba a la derecha) para ver las disputas.': 'Switch to the MicoPay arbiter (top right) to view disputes.',
  'Algo salió mal. Inténtalo de nuevo.': 'Something went wrong. Please try again.',
  'Esas fechas ya están reservadas': 'Those dates are already booked',
  'Reserva no encontrada': 'Booking not found',
  'Alojamiento no encontrado': 'Listing not found',

  // statuses and policies (stable keys)
  'En garantía': 'In escrow',
  'Estancia pagada': 'Stay paid',
  'En disputa': 'Disputed',
  'Pagado': 'Paid out',
  'Resuelto': 'Resolved',
  'Cancelado': 'Cancelled',
  'Flexible': 'Flexible',
  'Moderada': 'Moderate',
  'Estricta': 'Strict',

  // home
  'Reserva directo con el anfitrión. Paga a una garantía, no a un intermediario.': 'Book directly with the host. Pay into an escrow, not a middleman.',
  'Cómo funciona': 'How it works',
  'Pagas desde tu app de MicoPay a una garantía en Stellar.': 'You pay from your MicoPay app into a Stellar escrow.',
  'Al anfitrión se le paga después del check-in, no antes.': 'The host is paid after check-in, not before.',
  'Cancela según la política, reclama daños o deja que el contrato pague solo.': 'Cancel by the policy, dispute damage, or let the contract pay out on its own.',
  'Una sola comisión de la plataforma:': 'One platform fee:',
  ', que ves antes de reservar.': ', shown before you book.',
  '/ noche': '/ night',
  '{n} huéspedes': '{n} guests',
  'No hay alojamientos disponibles.': 'No listings available.',

  // listing
  '{n} recámaras · hasta {max}': '{n} bedrooms · up to {max}',
  '1 recámara · hasta {max}': '1 bedroom · up to {max}',
  'Política de cancelación · {policy}': 'Cancellation policy · {policy}',
  'Cancela al menos <b>{days} días</b> antes del check-in: te devolvemos <b>{pct}%</b> de la estancia y la comisión.': 'Cancel at least <b>{days} days</b> before check-in: <b>{pct}%</b> of the stay and fee back.',
  'Cancela al menos <b>1 día</b> antes del check-in: te devolvemos <b>{pct}%</b> de la estancia y la comisión.': 'Cancel at least <b>1 day</b> before check-in: <b>{pct}%</b> of the stay and fee back.',
  'Después de eso, la estancia no se reembolsa. El depósito por daños siempre vuelve si cancelas.': 'Later than that: the stay is not refunded. The damage deposit always comes back if you cancel.',
  'Si cancela el anfitrión, te devolvemos todo.': 'If the host cancels, you get everything back.',
  'Estas reglas quedan escritas en el contrato de garantía al reservar: nadie puede cambiarlas después.': 'These rules are written into the escrow contract when you book: nobody can change them afterwards.',
  'Tu anfitrión': 'Your host',
  'Llegada': 'Check-in',
  'Salida': 'Check-out',
  'Huéspedes': 'Guests',
  '{price} × {n} noches': '{price} × {n} nights',
  '{price} × 1 noche': '{price} × 1 night',
  'Limpieza': 'Cleaning',
  'Comisión de MicoPay ({pct}%)': 'MicoPay fee ({pct}%)',
  'Depósito por daños (reembolsable)': 'Damage deposit (refundable)',
  'A la garantía': 'Into escrow',
  '≈ {amount} a 1 USD = {rate} MXN': '≈ {amount} at 1 USD = {rate} MXN',
  'El anfitrión recibe <b>{amount}</b> después del check-in. El depósito vuelve después de la salida, salvo que haya un reclamo por daños.': 'The host receives <b>{amount}</b> after check-in. The deposit comes back after check-out unless there is a damage claim.',
  'Esas fechas ya no están disponibles. Elige otras fechas.': 'Those dates are no longer available. Please choose different dates.',
  'Bloqueando en la garantía de Stellar…': 'Locking in escrow on Stellar…',
  'Reservar y pagar a la garantía': 'Book and pay into escrow',
  'Cámbiate al huésped (arriba a la derecha) para reservar.': 'Switch to the guest (top right) to book.',
  'Demo: firma la llave de testnet del huésped. En producción lo apruebas en tu app de MicoPay.': "Demo: the guest's testnet key signs. In production you approve it in your MicoPay app.",

  // calendar
  'Calendario': 'Calendar',
  'Mes anterior': 'Previous month',
  'Mes siguiente': 'Next month',
  'Sin reserva registrada': 'No booking registered',
  'Reservado': 'Booked',
  'Seleccionado': 'Selected',
  'reservado': 'booked',
  'reservado desde este día; puede ser tu salida': 'booked from this day, can be your check-out',
  'seleccionado': 'selected',
  'dentro del rango elegido': 'in selected range',
  'sin reserva registrada': 'no booking registered',
  'Do': 'Su', 'Lu': 'Mo', 'Ma': 'Tu', 'Mi': 'We', 'Ju': 'Th', 'Vi': 'Fr', 'Sá': 'Sa',

  // lists
  '{n} noches': '{n} nights',
  '1 noche': '1 night',
  'anfitrión {name}': 'host {name}',
  'huésped {name}': 'guest {name}',
  'Aún no tienes viajes.': 'No trips yet.',
  'Aún no hay reservas.': 'No bookings yet.',
  'No hay disputas abiertas.': 'No open disputes.',
  'Anfitrión · {name}': 'Hosting · {name}',
  'Saldo en MicoPay': 'Balance in MicoPay',
  'Retira por SPEI o en efectivo en la app de MicoPay': 'Withdraw to SPEI or cash in the MicoPay app',
  'Esperando en la garantía': 'Waiting in escrow',
  'Estancias aún sin pagar; se pagan al terminar la retención tras el check-in': 'Stays not paid out yet; paid after the hold that follows check-in',
  'Pagado (estancias)': 'Paid out (stays)',
  'Precio completo: la comisión la paga el huésped': 'Full price: the fee is paid by the guest',
  'El árbitro puede repartir una reserva en disputa entre huésped y anfitrión. No puede enviar fondos a nadie más y, si no decide en 7 días, el contrato paga solo.': "The arbiter can split a disputed booking between guest and host. It can't send funds anywhere else, and if it doesn't decide within 7 days the contract pays out on its own.",
  'Todas las reservas': 'All bookings',

  // booking page: events
  'Pagado a la garantía': 'Paid into escrow',
  'Estancia pagada al anfitrión': 'Stay paid to the host',
  'Cancelada por el huésped': 'Cancelled by the guest',
  'Cancelada por el anfitrión': 'Cancelled by the host',
  'Liberado al anfitrión': 'Released to the host',
  'El huésped reportó un problema': 'Guest reported a problem',
  'El anfitrión reclamó daños': 'Host claimed damage',
  'El árbitro repartió la garantía': 'Arbiter split the escrow',
  'Pagado por defecto después del plazo': 'Paid out by default after the deadline',

  // booking page
  '{n} huéspedes · Huésped {guest} · Anfitrión {host}': '{n} guests · Guest {guest} · Host {host}',
  'Garantía en Stellar': 'Escrow on Stellar',
  'Reserva cancelada': 'Booking cancelled',
  'Pago de la estancia': 'Stay paid to host',
  'Cierre de reclamos': 'Claims close',
  'hecho': 'done',
  'en {time}': 'in {time}',
  'Reloj de demo: las fechas en la cadena corren a {secs} s por día calendario.': 'Demo clock: the on-chain dates run at {secs} s per calendar day.',
  'Estancia (para el anfitrión)': 'Stay (to the host)',
  'Comisión de MicoPay': 'MicoPay fee',
  'Depósito por daños': 'Damage deposit',
  'Total al reservar': 'Total at booking',
  'Bloqueado': 'Locked',
  '1 USD = {rate} MXN al reservar': '1 USD = {rate} MXN at booking',
  'Leído del contrato hace un momento': 'Read from the contract just now',
  'estado {status} · monto {amount} · comisión {fee} · depósito {deposit} USDC': 'status {status} · amount {amount} · fee {fee} · deposit {deposit} USDC',
  'id de reserva {id} = SHA-256 de los términos de la reserva': 'booking id {id} = SHA-256 of the booking terms',
  'Historial': 'History',
  'Cancelada': 'Cancelled',
  'La reserva se canceló y se procesó el reembolso del huésped. Cada movimiento está en el historial con su transacción de Stellar.': "The booking was cancelled and the guest's refund was processed. Every movement is in the history with its Stellar transaction.",
  'El anfitrión recibió el pago de la estancia y se devolvió el depósito del huésped.': "The host received the stay payment and the guest's deposit has been returned.",
  'La decisión del árbitro ya se pagó. Cada movimiento está en el historial con su transacción de Stellar.': "The arbiter's decision has been paid out. Every movement is in the history with its Stellar transaction.",
  'Cancelar': 'Cancel',
  'Si cancelas ahora te devolvemos <b>{amount}</b>: {pct}% de la estancia y la comisión, más todo el depósito.': 'Cancelling now returns <b>{amount}</b>: {pct}% of the stay and fee, plus the full deposit.',
  'Cancelando…': 'Cancelling…',
  'Cancelar reserva': 'Cancel booking',
  'Tu estancia': 'Your stay',
  'El depósito sigue retenido y vuelve cuando cierran los reclamos o cuando lo liberas.': 'The deposit is still held and is returned when claims close or when you release it.',
  '¿Algo mal con el lugar? Repórtalo antes del {date}; después, al anfitrión se le paga la estancia.': 'Something wrong with the place? Report it before {date}; after that the host is paid for the stay.',
  'Terminó la retención de la estancia. Ya se le puede pagar al anfitrión; el depósito por daños sigue en la garantía durante el periodo de reclamos.': 'The stay hold has ended. The host can be paid now; the damage deposit will remain in escrow through the claims window.',
  'Liberando…': 'Releasing…',
  'Liberar el depósito': 'Release the deposit',
  'Liberar el pago al anfitrión': 'Release payment to host',
  'Abriendo…': 'Opening…',
  'Reportar un problema': 'Report a problem',
  'Acciones del anfitrión': 'Host actions',
  '¿Algo dañado? Reclámalo antes del cierre de reclamos: el árbitro decide cómo se reparte el depósito.': 'Something damaged? Claim it before claims close: the arbiter decides how the deposit is split.',
  'Reclamando…': 'Claiming…',
  'Reclamar daños': 'Claim damage',
  'Recibes {amount} cuando termina la retención de la estancia.': 'You are paid {amount} after the stay hold ends.',
  'Cancelar y reembolsar todo al huésped': 'Cancel and refund the guest in full',
  'Pagar la estancia': 'Stay payment',
  'Pagando al anfitrión…': 'Paying the host…',
  'Pagar al anfitrión': 'Pay the host',
  'Resolver disputa': 'Resolve dispute',
  'Reparte solo el depósito de {amount}. La parte de la plataforma es MX$0.00.': 'Split the {amount} deposit only. The platform share is fixed at MX$0.00.',
  'Reparte los {amount} en garantía. La plataforma puede quedarse como máximo con su comisión.': 'Split the {amount} in escrow. The platform can keep at most its fee.',
  'Para el huésped (MXN)': 'To guest (MXN)',
  'Para el anfitrión (MXN)': 'To host (MXN)',
  'Para la plataforma (MXN)': 'To platform (MXN)',
  'Llenar: sin daños': 'Fill: no damage',
  'Suma {sum} de {total}': 'Sum {sum} of {total}',
  'Pagando…': 'Paying out…',
  'Resolver y pagar': 'Resolve and pay out',
  'Árbitro': 'Arbiter',
  'Liberar al anfitrión': 'Release to host',
  'Reclamos cerrados': 'Claims closed',
  'Cerraron los reclamos. Cualquiera puede liquidar la reserva; la estancia ya se pagó, así que el huésped recupera el depósito.': 'Claims have closed. Anyone can settle the booking; the stay was already paid, so the guest gets the deposit back.',
  'Cerraron los reclamos. Cualquiera puede liquidar la reserva; el anfitrión recibe la estancia y el huésped el depósito.': 'Claims have closed. Anyone can settle the booking; the host gets the stay and the guest gets the deposit.',
  'Liquidar por defecto': 'Settle by default',
  'El anfitrión ya recibió el pago de la estancia. El depósito por daños sigue en la garantía mientras MicoPay revisa el reclamo.': 'The host has been paid for the stay. The damage deposit remains in escrow while MicoPay reviews the claim.',
  'El pago sigue en la garantía mientras MicoPay revisa el reclamo.': 'The payment is still in escrow while MicoPay reviews the claim.',
  'Si el árbitro no decide en 7 días, el contrato paga por defecto.': "If the arbiter doesn't decide within 7 days, the contract pays out by default.",
};
