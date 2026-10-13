/* Material Symbols empaquetados (subset de la app de MicoPay). Solo existen los
   nombres del subset: home, payments, receipt_long, savings, person,
   account_balance, open_in_new, check_circle, add_circle, verified, lock... */
export function Icon({ name, filled = false, size = 22, className = '' }: { name: string; filled?: boolean; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
}
