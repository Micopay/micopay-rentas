import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EN, initialLang, translate } from './i18n';

/** In-memory storage; `deny` makes every call throw like a blocked localStorage. */
function store(deny = false) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => { if (deny) throw new Error('denied'); return m.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (deny) throw new Error('denied'); m.set(k, v); },
  };
}

describe('language choice', () => {
  it('?lang= wins over the saved choice', () => {
    const s = store();
    s.setItem('rentas.lang', 'en');
    expect(initialLang('?lang=es', s)).toBe('es');
  });

  it('persists the choice for the next visit', () => {
    const s = store();
    expect(initialLang('?lang=es', s)).toBe('es');
    expect(initialLang('', s)).toBe('es');
  });

  it('?lang= still wins when storage is denied', () => {
    expect(initialLang('?lang=es', store(true))).toBe('es');
    expect(initialLang('', store(true))).toBe('en');
    expect(initialLang('?lang=es', null)).toBe('es');
  });

  it('defaults to English and ignores unknown values', () => {
    expect(initialLang('?lang=fr', store())).toBe('en');
  });
});

describe('translate', () => {
  it('interpolates placeholders in both languages', () => {
    expect(translate('es', '{n} noches', { n: 3 })).toBe('3 noches');
    expect(translate('en', '{n} noches', { n: 3 })).toBe('3 nights');
    expect(translate('en', 'Suma {sum} de {total}', { sum: 'A', total: 'B' })).toBe('Sum A of B');
  });

  it('falls back to the key when there is no English entry', () => {
    expect(translate('en', 'Casa Ejemplo')).toBe('Casa Ejemplo');
  });
});

const sources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

describe('translation coverage', () => {
  it('every literal t() key has an English entry', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
          const arg = node.arguments[0];
          if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && !(arg.text in EN)) {
            missing.push(`${file}:${source.getLineAndCharacterOfPosition(arg.getStart()).line + 1} "${arg.text}"`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });

  it('keys used through lookup tables have English entries', () => {
    const tables = ['En garantía', 'Estancia pagada', 'En disputa', 'Pagado', 'Resuelto', 'Cancelado', 'Flexible', 'Moderada', 'Estricta',
      'Pagado a la garantía', 'Estancia pagada al anfitrión', 'Cancelada por el huésped', 'Cancelada por el anfitrión', 'Liberado al anfitrión',
      'El huésped reportó un problema', 'El anfitrión reclamó daños', 'El árbitro repartió la garantía', 'Pagado por defecto después del plazo',
      'Reserva cancelada', 'Llegada', 'Pago de la estancia', 'Cierre de reclamos', 'Total al reservar', 'Bloqueado',
      'Para el huésped (MXN)', 'Para el anfitrión (MXN)', 'Para la plataforma (MXN)', 'Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá',
      'reservado', 'reservado desde este día; puede ser tu salida', 'seleccionado', 'dentro del rango elegido', 'sin reserva registrada',
      'Esas fechas ya están reservadas', 'Reserva no encontrada', 'Alojamiento no encontrado', 'Algo salió mal. Inténtalo de nuevo.'];
    expect(tables.filter((k) => !(k in EN))).toEqual([]);
  });
});
