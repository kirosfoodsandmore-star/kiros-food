// Minimal CSV writer for report exports. Values are quoted when needed; a UTF-8 BOM makes Excel
// open the file with the right encoding.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
