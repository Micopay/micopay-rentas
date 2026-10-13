# MicoPay Rentas — Estudio y plan v0.2 (2026-10-13)

> **Estado 2026-10-13.** Eric eligió demo funcional, escrow-v2 desde el inicio y Tepoztlán. Hecho: escrow-v2 (16 pruebas) desplegado en testnet `CDTZISWU…BKS55`, API y web (R1–R4 en versión demo, sin login con MicoPay), prueba de punta a punta en testnet con 11/11 comprobaciones. Pendiente: firma desde la app de MicoPay, fotos reales, R0 (validar con anfitriones), auditoría del contrato.

Plataforma de rentas de corto plazo, estilo Airbnb, donde el pago de la reserva queda en un escrow en Stellar y se libera al anfitrión después del check-in. Comisión baja, pago desde la app de MicoPay.

## 1. Tesis de mercado

- **Comisión de Airbnb:** modelo "host-only" de **15.5%** sobre el subtotal (noches + limpieza + extras, sin impuestos). Para México se reporta **16%** desde 2026. Fuentes: [Hostfully](https://www.hostfully.com/blog/airbnb-host-fees/), [Smoobu](https://www.smoobu.com/en/blog/airbnb-host-only-fee-increase/), [ChargeAutomation](https://chargeautomation.com/airbnb-host-fees-explained/). ⚠️ Son blogs del sector y no coinciden en las fechas de implementación. **Pendiente confirmarlo en el centro de ayuda de Airbnb.**
- **Nuestro argumento:** el escrow reemplaza la garantía que da Airbnb ("no le pagamos al anfitrión hasta después del check-in") con código en cadena. Por eso la plataforma no custodia el dinero y puede cobrar mucho menos.
- **Por qué con MicoPay:** el huésped paga desde la app (USDC, o efectivo convertido por la Red MicoPay) y el anfitrión cobra a su cuenta y puede retirar a efectivo o SPEI con lo que MicoPay ya tiene.
- **Por estudiar:** comisión objetivo (¿3–5%?), primer mercado (¿una ciudad o zona turística?), cómo conseguir los primeros anfitriones (los que ya están en Airbnb y quieren canal directo), y si se integra un calendario iCal para no duplicar reservas con Airbnb.

## 2. Flujo de una reserva

```
1. Huésped reserva       → la API cotiza (noches, limpieza, comisión) y arma lock()
2. Huésped paga          → sign-request a su app de MicoPay → fondos en escrow
                           beneficiario = anfitrión (fijo), vencimiento = checkout + N días
3. Cancelación previa    → split según la política (flexible/moderada/estricta)
4. Check-in              → el huésped confirma en la app, o pasan 24 h sin queja
5. Liberación            → árbitro (plataforma) libera: anfitrión recibe, comisión a la plataforma
6. Queja / daños         → árbitro decide el reparto entre huésped y anfitrión
7. Nadie actúa           → tras el vencimiento, cualquiera puede ejecutar el desenlace por defecto
```

## 3. ¿Sirve nuestro escrow? Análisis de `micopay/contracts/escrow`

| Necesidad de una renta | Contrato actual | ¿Alcanza? |
|---|---|---|
| Bloquear el pago con beneficiario fijo | `lock(seller, buyer, amount, platform_fee, secret_hash, timeout_minutes)` | ✅ |
| Cobro de comisión de plataforma | `platform_fee` va a `platform_wallet` al liberar | ✅ |
| Liberar sin que el anfitrión firme una transacción Soroban | `release` exige `buyer.require_auth()` | ⚠️ funciona, pero el anfitrión debe firmar (con la app de MicoPay es viable) |
| Reembolso parcial por política de cancelación | `refund` devuelve **todo** | ❌ |
| Árbitro para disputas | no existe | ❌ |
| Depósito por daños con reparto | no existe | ❌ |
| Desenlace por defecto **a favor del anfitrión** tras la estancia | tras el vencimiento solo existe el reembolso al que pagó | ❌ riesgo para el anfitrión |
| Reservas con meses de anticipación | `timeout_minutes` u32 alcanza; el estado persistente se extiende a ~30 días y se archiva si nadie lo toca | ⚠️ requiere extender el TTL periódicamente o restaurarlo |
| Varios activos | un `TokenId` por despliegue (hoy USDC y XLM como contratos separados) | ✅ con el mismo patrón |

**Conclusión:** el contrato actual sirve para un MVP con "cancelación = reembolso total o nada", pero no para un producto real.

## 4. Propuesta: contrato `escrow-v2` (compartido con MicoPay Café)

```
lock(payer, beneficiary, arbiter, amount, fee, release_after, deadline, default_to)
    payer.require_auth()          // fondos de payer → contrato
release(id)                        arbiter.require_auth()  → beneficiary + fee
split(id, to_payer, to_beneficiary) arbiter.require_auth(), to_payer + to_beneficiary == amount
cancel_by_payer(id)               payer.require_auth(), solo antes de release_after,
                                   reparto según la tabla de cancelación guardada en lock()
settle_default(id)                cualquiera, solo después de deadline → default_to
```

Invariantes:
- Los fondos solo pueden ir al `payer`, al `beneficiary` o a la comisión; el árbitro **no puede** mandarlos a un tercero.
- `default_to` se fija al bloquear: en rentas es el **anfitrión**, en café el **pagador** (rechazo de calidad = reembolso).
- Extender el TTL en cada `lock` y desde un job del backend para las reservas lejanas.

Vive en `micopay-protocol/contracts/escrow-v2` porque es una pieza del ecosistema. Las dos plataformas lo consumen por su ID de contrato.

## 5. Pendientes legales (no bloquean el MVP)

- Plataformas digitales de hospedaje en México: retención de ISR/IVA al anfitrión y reporte al SAT. Verificar tasas y obligaciones vigentes.
- Términos, aviso de privacidad, impuesto local al hospedaje por estado.

## 6. Arquitectura y fases

Misma base que MicoPay Café: `apps/api` (Fastify + Postgres propio), `apps/web` (React + Vite) e inicio de sesión con MicoPay (challenge SEP-10 enviado por `/sign-requests`). La identidad es la dirección de Stellar.

| Fase | Entrega |
|---|---|
| R0 | Validar la tesis: confirmar comisiones, entrevistar 5 anfitriones, definir la comisión |
| R1 | Monorepo, Postgres local, login con MicoPay |
| R2 | Anuncios (fotos, precio, calendario), búsqueda y disponibilidad |
| R3 | Reserva con el escrow actual (reembolso total) en testnet: el MVP |
| R4 | `escrow-v2`: políticas de cancelación, árbitro, desenlace por defecto |
| R5 | Panel del anfitrión: cobros, retiro con MicoPay, sincronización iCal |
| R6 | Conexión a micopay/backend en AWS |
