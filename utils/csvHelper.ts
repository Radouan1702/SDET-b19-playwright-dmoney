import fs from 'node:fs';
import path from 'node:path';

export function todayStamp(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string): string => {
    const escaped = cell.replace(/"/g, '""');
    return /[",\n]/.test(cell) ? `"${escaped}"` : escaped;
  };
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function saveCsv(filePath: string, headers: string[], rows: string[][]): string {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, toCsv(headers, rows), 'utf8');
  return absolutePath;
}

export function selfStatementFileName(): string {
  return `self_statement_${todayStamp()}.csv`;
}

export function readCsv(filePath: string): { headers: string[]; rows: string[][] } {
  const content = fs.readFileSync(filePath, 'utf8');
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(cell);
      cell = '';
    } else if (character === '\n') {
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }
  if (cell.length > 0 || record.length > 0 || content.endsWith(',')) {
    record.push(cell);
    records.push(record);
  }

  const [headers = [], ...rows] = records;
  return { headers, rows };
}
