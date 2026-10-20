import * as XLSX from 'xlsx';

export const CHANNEL_FILES = Object.freeze({
  영업: '01_영업실적.xlsx', 온라인: '02_온라인실적.xlsx', 팝업: '03_팝업실적.xlsx'
});
export const REQUIRED = Object.freeze([
  'record_id', '기준주', '점포', '브랜드', '장르', '채널',
  '매출_만원', '목표_만원', '비용_만원', '상태', '출처', '기준일'
]);
export const REPORT_HEADERS = Object.freeze([
  'record_id', '채널', '기준주', '점포', '브랜드', '장르',
  '매출_만원', '목표_만원', '목표차이_만원', '달성률',
  '비용_만원', '비용차감액_만원', '상태', '메모', '출처', '기준일'
]);
const ALIASES = {
  record_id: ['record_id', '레코드ID', '기록번호'],
  기준주: ['기준주', '주차', '주간기준일'],
  점포: ['점포', '점포명', '영업점'],
  브랜드: ['브랜드', '브랜드명', '행사브랜드'],
  장르: ['장르', '카테고리', '상품군'],
  채널: ['채널', '유통채널', '판매채널'],
  매출_만원: ['매출_만원', '실적(만원)', '매출액_만원'],
  목표_만원: ['목표_만원', '목표매출(만원)', '목표액_만원'],
  비용_만원: ['비용_만원', '집행비용(만원)', '사용비용_만원'],
  상태: ['상태', '진행상태', '진행현황'],
  출처: ['출처', '근거자료', '자료출처'],
  기준일: ['기준일', '확인일', '기준일자']
};
const NUMBERS = ['매출_만원', '목표_만원', '비용_만원'];
const FILTER_FIELDS = ['점포', '채널', '기준주', '브랜드', '장르'];
const blank = value => value === '' || value === null || value === undefined;
const text = value => String(value ?? '').trim();
const location = row => `${row.__sourceFile || '입력 자료'} · 원본 ${row.__row || '?'}행`;

function fail(filename, message, row) {
  throw new Error(`${filename}${row ? ` · 원본 ${row}행` : ''}: ${message}`);
}

function readBook(buffer, filename) {
  try { return XLSX.read(buffer, { type: 'array', cellDates: false }); }
  catch { fail(filename, 'Excel 파일을 읽을 수 없습니다. .xlsx 파일을 확인해 주세요.'); }
}

function dateValue(value) {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const valueText = text(value);
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(valueText);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : valueText;
}

function numericValue(value, filename, row, field) {
  if (blank(value) || typeof value === 'boolean') fail(filename, `${field} 값이 없거나 숫자가 아닙니다.`, row);
  const normalized = typeof value === 'string' ? value.trim().replaceAll(',', '') : value;
  if (normalized === '' || !['number', 'string'].includes(typeof normalized)) fail(filename, `${field} 값이 숫자가 아닙니다.`, row);
  const number = Number(normalized);
  if (!Number.isFinite(number)) fail(filename, `${field} 값이 숫자가 아닙니다.`, row);
  return number;
}

/** Read only the 원본 sheet; aliases are matched by name, never by position. */
export function parseWorkbook(buffer, filename) {
  const wb = readBook(buffer, filename);
  const baseName = filename.split(/[\\/]/).pop().normalize('NFC');
  // This named teaching fixture has its own sheet solely to exercise missing columns.
  const sheet = wb.Sheets['원본'] || (baseName === '05_오류_열누락.xlsx' ? wb.Sheets['오류원본'] : undefined);
  if (!sheet) fail(filename, '필수 시트 「원본」이 없습니다.');
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  if (!matrix.length) fail(filename, '원본 시트에 열 이름이 없습니다.');
  const headers = matrix[0].map(text);
  const namedHeaders = headers.filter(Boolean);
  const duplicates = namedHeaders.filter((header, index) => namedHeaders.indexOf(header) !== index);
  if (duplicates.length) fail(filename, `중복 열 이름: ${[...new Set(duplicates)].join(', ')}`);
  const positions = {};
  const missing = [];
  for (const field of REQUIRED) {
    const matches = headers.map((header, index) => ALIASES[field].includes(header) ? index : -1).filter(index => index >= 0);
    if (matches.length > 1) fail(filename, `같은 의미의 열이 중복되었습니다: ${field}`);
    if (!matches.length) missing.push(field);
    else positions[field] = matches[0];
  }
  if (missing.length) fail(filename, `필수 열 누락: ${missing.join(', ')}`);
  const expectedChannel = baseName.startsWith('01_') ? '영업' : baseName.startsWith('02_') ? '온라인' : baseName.startsWith('03_') ? '팝업' : null;
  const records = [];
  const ids = new Set();
  let channel;
  for (let index = 1; index < matrix.length; index++) {
    const source = matrix[index];
    if (!source.some(value => !blank(value))) continue;
    const row = index + 1;
    const record = Object.fromEntries(REQUIRED.map(field => [field, text(source[positions[field]])]));
    record.__sourceFile = filename;
    record.__row = row;
    if (!record.record_id) fail(filename, 'record_id가 비어 있습니다.', row);
    if (ids.has(record.record_id)) fail(filename, `중복 record_id: ${record.record_id}`, row);
    ids.add(record.record_id);
    for (const field of NUMBERS) record[field] = numericValue(source[positions[field]], filename, row, field);
    for (const field of ['기준주', '기준일']) record[field] = dateValue(source[positions[field]]);
    if (!Object.hasOwn(CHANNEL_FILES, record.채널)) fail(filename, `알 수 없는 채널 값: ${record.채널 || '(빈 값)'}`, row);
    if (expectedChannel && record.채널 !== expectedChannel) fail(filename, `파일명과 채널 불일치: ${expectedChannel} 파일에 ${record.채널} 채널이 있습니다.`, row);
    if (channel && record.채널 !== channel) fail(filename, `한 파일에 여러 채널이 있습니다: ${channel}, ${record.채널}`, row);
    channel = record.채널;
    records.push(record);
  }
  if (!records.length) fail(filename, '기록 행이 없습니다.');
  return { channel, records };
}

/** Transactional append: a rejected file cannot remove or change valid rows. */
export function appendRecords(existing, incoming) {
  const seen = new Map();
  for (const row of [...existing, ...incoming]) {
    const id = text(row.record_id);
    if (!id) throw new Error(`${location(row)}: record_id가 비어 있습니다.`);
    if (seen.has(id)) throw new Error(`${location(row)}: 중복 record_id ${id} · 기존 출처 ${location(seen.get(id))}. 중복 파일은 반영하지 않았습니다.`);
    seen.set(id, row);
  }
  return [...existing, ...incoming];
}

export function filterRows(rows, filters = {}) {
  return rows.filter(row => FILTER_FIELDS.every(field => {
    const selected = filters[field];
    return Array.isArray(selected) ? selected.length === 0 || selected.includes(row[field]) : !selected || row[field] === selected;
  }));
}

export function summarize(rows) {
  let revenue = 0;
  let target = 0;
  const stores = new Map();
  for (const row of rows) {
    revenue += row.매출_만원;
    target += row.목표_만원;
    stores.set(row.점포, (stores.get(row.점포) || 0) + row.매출_만원);
  }
  return {
    revenue, target, rate: target === 0 ? null : revenue / target,
    stores: [...stores].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([name, value]) => ({ name, value }))
  };
}

function validateReportHeaders(headers) {
  if (headers.length !== REPORT_HEADERS.length || headers.some((header, index) => header !== REPORT_HEADERS[index])) {
    throw new Error('04_보고양식.xlsx: 보고 시트 첫 행은 지정된 16개 열과 이름·순서가 같아야 합니다.');
  }
}

export function readTemplate(buffer) {
  const wb = readBook(buffer, '04_보고양식.xlsx');
  if (!wb.Sheets['보고']) throw new Error('04_보고양식.xlsx: 필수 시트 「보고」가 없습니다.');
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets['보고'], { header: 1, defval: '', raw: true });
  const headers = matrix[0] || [];
  validateReportHeaders(headers);
  return headers;
}

/** Create a new workbook, retaining the template's exact 16-column contract. */
export function buildReport(rows, headers, memos = {}) {
  validateReportHeaders(headers);
  const output = rows.map(row => {
    const memo = memos instanceof Map ? memos.get(row.record_id) : Object.hasOwn(memos, row.record_id) ? memos[row.record_id] : '';
    const values = {
      ...row,
      목표차이_만원: row.매출_만원 - row.목표_만원,
      달성률: row.목표_만원 === 0 ? null : row.매출_만원 / row.목표_만원,
      비용차감액_만원: row.매출_만원 - row.비용_만원,
      메모: String(memo ?? '')
    };
    return headers.map(header => values[header]);
  });
  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...output]);
  sheet['!cols'] = headers.map(header => ({ wch: header === '메모' || header === '출처' ? 32 : header.includes('만원') ? 18 : 20 }));
  for (let r = 1; r <= output.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === 'n') cell.z = headers[c] === '달성률' ? '0.0%' : '#,##0.##';
    }
  }
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: output.length, c: headers.length - 1 } }) };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '보고');
  return workbook;
}
