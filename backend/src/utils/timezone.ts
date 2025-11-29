import moment from 'moment-timezone';

export type BrazilMoment = ReturnType<typeof moment>;

export const BRAZIL_TZ = 'America/Sao_Paulo';
const BRAZIL_FORMATS = [
  moment.ISO_8601,
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DD HH:mm',
];

export function parseBrazilDateTime(value: string | Date): BrazilMoment {
  if (value instanceof Date) {
    return moment(value).tz(BRAZIL_TZ);
  }

  const parsed = moment.tz(value, BRAZIL_FORMATS as any, true, BRAZIL_TZ);
  if (!parsed.isValid()) {
    throw new Error('Data inválida');
  }
  return parsed;
}

export function parseBrazilDate(value: string): BrazilMoment {
  const parsed = moment.tz(value, ['YYYY-MM-DD', moment.ISO_8601] as any, true, BRAZIL_TZ);
  if (!parsed.isValid()) {
    throw new Error('Data inválida');
  }
  return parsed;
}

export function formatBrazilDate(value: string | Date, format = 'DD/MM/YYYY HH:mm'): string {
  return parseBrazilDateTime(value).format(format);
}

export function toBrazilDate(value: string | Date): Date {
  return parseBrazilDateTime(value).toDate();
}

