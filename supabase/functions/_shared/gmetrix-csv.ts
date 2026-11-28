export const MAX_GMETRIX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_GMETRIX_CSV_ROWS = 2000;
export const EXPO_PUSH_BATCH_LIMIT = 100;
export const GMETRIX_MY_KEYS_DEEP_LINK = 'myccs://certifications/my-keys' as const;
export const GMETRIX_PUSH_TITLE = 'GMetrix Key Ready';
export const GMETRIX_PUSH_BODY =
  'Your GMetrix certification key is ready. Open MyCCS to view it.';
export const REJECTED_CSV_HEADER = 'row_number,email,reason';

export const INSTITUTIONAL_EMAIL_REGEX = /^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$/;
export const EXPO_PUSH_TOKEN_REGEX =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,128}\]$/;

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;
const STRIP_CSV_CONTROL_CHARS_REGEX = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const FORMULA_PREFIX_REGEX = /^[\s\t\r]*[=+\-@]|^[\t\r]/;
export const MAX_KEY_CODE_LENGTH = 128;

const EMAIL_HEADER_ALIASES = new Set([
  'email',
  'institutional_email',
  'student_email',
  'lpu_email',
]);

const KEY_CODE_HEADER_ALIASES = new Set([
  'key_code',
  'key',
  'access_key',
  'gmetrix_key',
  'code',
  'access_code',
]);

export type RejectedRowReason =
  | 'invalid_email'
  | 'missing_key_code'
  | 'invalid_key_code'
  | 'duplicate_key_in_csv'
  | 'unregistered_student'
  | 'duplicate_key_existing';

export interface RejectedRow {
  rowNumber: number;
  email: string;
  reason: RejectedRowReason;
}

export interface ParsedGMetrixCsvRow {
  rowNumber: number;
  email: string;
  keyCode: string;
}

export type ParseGMetrixCsvResult =
  | { ok: true; rows: ParsedGMetrixCsvRow[] }
  | { ok: false; error: string };

export function normalizeInstitutionalEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

export function isInstitutionalEmail(rawEmail: string): boolean {
  return INSTITUTIONAL_EMAIL_REGEX.test(normalizeInstitutionalEmail(rawEmail));
}

export function normalizeGMetrixKeyCode(raw: string): string {
  return raw.trim();
}

export function isValidGMetrixKeyCode(raw: string): boolean {
  const trimmed = normalizeGMetrixKeyCode(raw);
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_KEY_CODE_LENGTH &&
    !CONTROL_CHAR_REGEX.test(trimmed)
  );
}

export function canonicalizeGMetrixKeyForHash(raw: string): string {
  return normalizeGMetrixKeyCode(raw).toUpperCase();
}

export function isValidExpoPushToken(rawToken: string): boolean {
  return EXPO_PUSH_TOKEN_REGEX.test(rawToken.trim());
}

function normalizeHeaderName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function parseGMetrixCsv(csvText: string): ParseGMetrixCsvResult {
  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  if (cleaned.trim().length === 0) {
    return { ok: false, error: 'CSV file is empty.' };
  }

  let hasHeader = false;
  let emailIndex = -1;
  let keyCodeIndex = -1;
  const rows: ParsedGMetrixCsvRow[] = [];

  const consumeRecord = (rowNumber: number, fields: string[]): string | null => {
    if (!hasHeader) {
      hasHeader = true;
      const headerFields = fields.map(normalizeHeaderName);
      emailIndex = headerFields.findIndex((header) => EMAIL_HEADER_ALIASES.has(header));
      keyCodeIndex = headerFields.findIndex((header) => KEY_CODE_HEADER_ALIASES.has(header));
      if (emailIndex === -1 || keyCodeIndex === -1) {
        return 'CSV header must include both email and key_code columns.';
      }
      return null;
    }

    if (fields.every((cell) => cell.trim() === '')) {
      return null;
    }

    if (rows.length >= MAX_GMETRIX_CSV_ROWS) {
      return `CSV exceeds the maximum limit of ${MAX_GMETRIX_CSV_ROWS} rows.`;
    }

    rows.push({
      rowNumber,
      email: (fields[emailIndex] ?? '').trim(),
      keyCode: (fields[keyCodeIndex] ?? '').trim(),
    });
    return null;
  };

  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let justClosedQuote = false;
  let currentLine = 1;
  let recordStartLine = 1;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else if (ch === '\r') {
        currentField += '\n';
        currentLine += 1;
        if (cleaned[i + 1] === '\n') {
          i += 1;
        }
      } else if (ch === '\n') {
        currentField += '\n';
        currentLine += 1;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (justClosedQuote) {
      if (ch === ',') {
        currentRecord.push(currentField);
        currentField = '';
        justClosedQuote = false;
        continue;
      }
      if (ch === '\r' || ch === '\n') {
        currentRecord.push(currentField);
        const err = consumeRecord(recordStartLine, currentRecord);
        if (err !== null) {
          return { ok: false, error: err };
        }
        currentRecord = [];
        currentField = '';
        justClosedQuote = false;
        if (ch === '\r' && cleaned[i + 1] === '\n') {
          i += 1;
        }
        currentLine += 1;
        recordStartLine = currentLine;
        continue;
      }
      return {
        ok: false,
        error: `Malformed CSV: unexpected character after closing quote on row ${currentLine}.`,
      };
    }

    if (ch === '"') {
      if (currentField.length === 0) {
        inQuotes = true;
      } else {
        return {
          ok: false,
          error: `Malformed CSV: unexpected quote in unquoted field on row ${currentLine}.`,
        };
      }
    } else if (ch === ',') {
      currentRecord.push(currentField);
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      currentRecord.push(currentField);
      const err = consumeRecord(recordStartLine, currentRecord);
      if (err !== null) {
        return { ok: false, error: err };
      }
      currentRecord = [];
      currentField = '';
      if (ch === '\r' && cleaned[i + 1] === '\n') {
        i += 1;
      }
      currentLine += 1;
      recordStartLine = currentLine;
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    return { ok: false, error: 'Malformed CSV: unclosed quoted field.' };
  }

  if (currentRecord.length > 0 || currentField.length > 0 || justClosedQuote) {
    currentRecord.push(currentField);
    const err = consumeRecord(recordStartLine, currentRecord);
    if (err !== null) {
      return { ok: false, error: err };
    }
  }

  if (!hasHeader) {
    return { ok: false, error: 'CSV file is empty.' };
  }

  if (rows.length === 0) {
    return { ok: false, error: 'CSV contains no data rows.' };
  }

  return { ok: true, rows };
}

export function sanitizeCsvCell(value: string): string {
  const stripped = value.replace(STRIP_CSV_CONTROL_CHARS_REGEX, '');
  const formulaSafe = FORMULA_PREFIX_REGEX.test(stripped) ? `'${stripped}` : stripped;
  const singleLine = formulaSafe.replace(/\r\n|\r|\n/g, ' ');
  if (/[,"\r\n]/.test(singleLine)) {
    return `"${singleLine.replace(/"/g, '""')}"`;
  }
  return singleLine;
}

export function buildRejectedRowsCsv(rows: readonly RejectedRow[]): string {
  const lines = [REJECTED_CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [String(row.rowNumber), sanitizeCsvCell(row.email), sanitizeCsvCell(row.reason)].join(',')
    );
  }
  return lines.join('\n');
}
