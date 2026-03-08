import fs from 'fs';
import path from 'path';

export interface RawElement {
  id: string;
  name: string;
}

export interface RawProduct {
  id: string;
  tier: number;
}

function parseCsv<T>(filename: string): T[] {
  const filepath = path.resolve(__dirname, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });
    return obj as unknown as T;
  });
}

export function loadMetalElements(): RawElement[] {
  return parseCsv<RawElement>('metal_elements.csv');
}

export function loadOrganicElements(): RawElement[] {
  return parseCsv<RawElement>('organic_elements.csv');
}

export function loadMetalProducts(): RawProduct[] {
  return parseCsv<RawProduct>('metal_products.csv');
}

export function loadOrganicProducts(): RawProduct[] {
  return parseCsv<RawProduct>('organic_products.csv');
}
