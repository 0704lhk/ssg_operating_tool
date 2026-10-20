import * as XLSX from 'xlsx/xlsx.mjs';

export const STANDARD_COLUMNS = ['record_id', '기준주', '점포', '브랜드', '장르', '채널', '매출_만원', '목표_만원', '비용_만원', '상태', '출처', '기준일'];
export const REPORT_COLUMNS = ['record_id', '채널', '기준주', '점포', '브랜드', '장르', '매출_만원', '목표_만원', '목표차이_만원', '달성률', '비용_만원', '비용차감액_만원', '상태', '메모', '출처', '기준일'];

const ALIASES = [
  ['record_id', '레코드ID', '기록번호'], ['기준주', '주차', '주간기준일'],
  ['점포', '점포명', '영업점'], ['브랜드', '브랜드명', '행사브랜드'],
  ['장르', '카테고리', '상품군'], ['채널', '유통채널', '판매채널'],
  ['매출_만원', '실적(만원)', '매출액_만원'], ['목표_만원', '목표매출(만원)', '목표액_만원'],
  ['비용_만원', '집행비용(만원)', '사용비용_만원'], ['상태', '진행상태', '진행현황'],
  ['출처', '근거자료', '자료출처'], ['기준일', '확인일', '기준일자'],
];
const CHANNELS = ['영업', '온라인', '팝업'];
const NUMBERS = new Set(['매출_만원', '목표_만원', '비용_만원']);
const DATES = new Set(['기준주', '기준일']);
const blank = value => value == null || (typeof value === 'string' && value.trim() === '');
const fail = (file, row, message) => { throw new Error(`${file} · 원본 시트 · ${row}행: ${message}`); };

function isoDate(value, date1904) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || (!date1904 && value === 60)) return null;
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
    value = `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? value : null;
}

/** Parse a whole file before returning any rows. No input workbook is mutated. */
export function parseWorkbook(buffer, fileName = '선택한 파일.xlsx') {
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'array', cellDates: false }); }
  catch { fail(fileName, 1, '엑셀 파일을 읽을 수 없습니다.'); }
  const sheet = workbook.Sheets['원본'];
  if (!sheet) fail(fileName, 1, '필수 시트 ‘원본’이 없습니다.');
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true });
  const headers = (grid[0] || []).map(value => value == null ? '' : String(value).trim());
  const indexes = {};
  STANDARD_COLUMNS.forEach((name, index) => {
    const found = headers.flatMap((header, column) => ALIASES[index].includes(header) ? [column] : []);
    if (!found.length) fail(fileName, 1, `필수 열 ‘${name}’ 누락 (허용 이름: ${ALIASES[index].join(', ')})`);
    if (found.length > 1) fail(fileName, 1, `‘${name}’ 열이 모호합니다. 열 ${found.map(column => XLSX.utils.encode_col(column)).join(', ')} 중 하나만 제공하세요.`);
    indexes[name] = found[0];
  });
  const prefix = /^(0[123])(?:_|\b)/.exec(fileName.split(/[\\/]/).pop());
  const idSchema = ALIASES[0].indexOf(headers[indexes.record_id]);
  const expectedChannel = CHANNELS[prefix ? Number(prefix[1]) - 1 : idSchema];
  const data = grid.slice(1).map((cells, index) => ({ cells, rowNumber: index + 2 }))
    .filter(({ cells }) => cells.some(value => !blank(value)));
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const rows = data.map(({ cells, rowNumber }) => {
    const row = {};
    STANDARD_COLUMNS.forEach(name => {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: indexes[name] })];
      if (cell?.f || cell?.t === 'e') fail(fileName, rowNumber, `‘${name}’에는 수식·오류 대신 확정된 값을 입력하세요.`);
      const value = cells[indexes[name]];
      if (blank(value)) fail(fileName, rowNumber, `‘${name}’ 값이 비어 있습니다.`);
      if (NUMBERS.has(name)) {
        if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) {
          fail(fileName, rowNumber, `‘${name}’ 숫자가 올바르지 않습니다.`);
        }
        const number = Number(value);
        if (!Number.isFinite(number)) fail(fileName, rowNumber, `‘${name}’는 유한한 숫자여야 합니다.`);
        row[name] = number;
      } else if (DATES.has(name)) {
        const date = isoDate(value, date1904);
        if (!date) fail(fileName, rowNumber, `‘${name}’ 날짜가 올바르지 않습니다. YYYY-MM-DD 또는 엑셀 날짜를 사용하세요.`);
        row[name] = date;
      } else {
        if (typeof value !== 'string') fail(fileName, rowNumber, `‘${name}’는 문자 값이어야 합니다.`);
        row[name] = value;
      }
    });
    if (row.채널 !== expectedChannel) fail(fileName, rowNumber, `채널 불일치: 기대 ‘${expectedChannel}’, 입력 ‘${row.채널}’`);
    return { ...row, _sourceFile: fileName, _sourceSheet: '원본', _sourceRow: rowNumber };
  });
  if (rows.length !== 160) fail(fileName, data.at(-1)?.rowNumber || 2, `행 수 불일치: 기대 160행, 입력 ${rows.length}행 (빈 행 제외)`);
  // Conflicts within this file also reject the complete import. Identical IDs are
  // deliberately retained here so mergeRows can report their duplicate count.
  mergeRows([], rows);
  return { rows, warnings: [], fileName };
}

export function mergeRows(existing, incoming) {
  const rows = [...existing];
  const byId = new Map(existing.map(row => [row.record_id, row]));
  let duplicateCount = 0;
  for (const row of incoming) {
    if (blank(row.record_id)) fail(row._sourceFile || '입력 파일', row._sourceRow || '?', 'record_id 값이 비어 있습니다.');
    const previous = byId.get(row.record_id);
    if (previous) {
      const differences = STANDARD_COLUMNS.filter(name => previous[name] !== row[name]);
      if (differences.length) fail(row._sourceFile || '입력 파일', row._sourceRow || '?', `ID ‘${row.record_id}’ 충돌: ${differences.join(', ')} 값이 다릅니다. 파일 전체를 반영하지 않습니다.`);
      duplicateCount += 1;
    } else {
      byId.set(row.record_id, row);
      rows.push(row);
    }
  }
  return { rows, duplicateCount };
}

export function filterRows(rows, { stores = [], channel = '', week = '' } = {}) {
  return rows.filter(row => (!stores.length || stores.includes(row.점포)) && (!channel || row.채널 === channel) && (!week || row.기준주 === week));
}

export function calculateRow(row) {
  return { delta: row.매출_만원 - row.목표_만원, net: row.매출_만원 - row.비용_만원, rate: row.목표_만원 === 0 ? null : row.매출_만원 / row.목표_만원 };
}

export function summarize(rows) {
  const totals = rows.reduce((sum, row) => ({ count: sum.count + 1, sales: sum.sales + row.매출_만원, target: sum.target + row.목표_만원, cost: sum.cost + row.비용_만원 }), { count: 0, sales: 0, target: 0, cost: 0 });
  return { ...totals, delta: totals.sales - totals.target, net: totals.sales - totals.cost, rate: totals.target === 0 ? null : totals.sales / totals.target };
}

export function groupByStore(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.점포)) groups.set(row.점포, []);
    groups.get(row.점포).push(row);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([store, values]) => ({ store, ...summarize(values) }));
}

/** Report detail contains only filtered records, with no extra total/detail rows. */
export function createReport(rows, notes = {}, filters = {}, options = {}) {
  const noteFor = id => notes instanceof Map ? notes.get(id) || '' : Object.prototype.hasOwnProperty.call(notes, id) ? notes[id] : '';
  const grid = [REPORT_COLUMNS, ...rows.map(row => {
    const calculated = calculateRow(row);
    return [row.record_id, row.채널, row.기준주, row.점포, row.브랜드, row.장르, row.매출_만원, row.목표_만원,
      calculated.delta, calculated.rate, row.비용_만원, calculated.net, row.상태, String(noteFor(row.record_id)), row.출처, row.기준일];
  })];
  const report = XLSX.utils.aoa_to_sheet(grid);
  report['!cols'] = REPORT_COLUMNS.map(name => ({ wch: name === '메모' ? 42 : name === 'record_id' || name === '출처' ? 28 : 17 }));
  report['!autofilter'] = { ref: report['!ref'] };
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    for (const column of ['G', 'H', 'I', 'K', 'L']) report[`${column}${excelRow}`].z = '#,##0.00';
    if (row.목표_만원 === 0) delete report[`J${excelRow}`];
    else report[`J${excelRow}`].z = '0.00%';
  });
  const summary = summarize(rows);
  const unique = name => [...new Set(rows.map(row => row[name]))].sort().join(', ');
  const conditions = XLSX.utils.aoa_to_sheet([
    ['항목', '내용'], ['자료 종류', '교육용 가상 데이터'], ['금액 단위', '만원'],
    ['저장 시각 (Asia/Seoul)', options.createdAt || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date())],
    ['점포 필터', filters.stores?.length ? filters.stores.join(', ') : '전체'], ['채널 필터', filters.channel || '전체'], ['기준주 필터', filters.week || '전체'],
    ['자료 기준일 (원본 확인일)', unique('기준일')], ['포함 기준주', unique('기준주')], ['입력 파일', unique('_sourceFile')], ['원본 출처 필드', unique('출처')],
    ['조회 건수', summary.count], ['매출 합계 (만원)', summary.sales], ['목표 합계 (만원)', summary.target], ['비용 합계 (만원)', summary.cost],
    ['목표 차이 합계 (만원)', summary.delta], ['비용 차감액 합계 (만원)', summary.net], ['합계 달성률', summary.rate],
    ['목표 차이', '매출 − 목표'], ['비용 차감액', '매출 − 비용'], ['달성률', '매출 ÷ 목표; 합계는 합계 매출 ÷ 합계 목표'],
    ['목표 0 처리', '달성률 셀에 값과 수식이 없는 빈 셀'], ['중복 처리', '동일 record_id·동일 표준 12필드 1회 반영; 내용 충돌 파일 반영 취소'],
    ['메모', 'record_id 연결. 해당 기기·브라우저·사이트 저장, 팀 공유 아님'], ['날씨 예제 사용', '미사용 (1단계 매출 비교)'], ['원본 보존', '입력 파일은 브라우저 메모리에서 읽고 변경하지 않음'],
  ]);
  conditions['!cols'] = [{ wch: 32 }, { wch: 100 }];
  if (summary.rate !== null) conditions.B18.z = '0.00%';
  else delete conditions.B18;
  const provenance = XLSX.utils.aoa_to_sheet([['record_id', '입력 파일', '시트', '원본 행', '원본 출처'], ...rows.map(row => [row.record_id, row._sourceFile, row._sourceSheet, row._sourceRow, row.출처])]);
  provenance['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 34 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, report, '보고');
  XLSX.utils.book_append_sheet(workbook, conditions, '보고조건');
  XLSX.utils.book_append_sheet(workbook, provenance, '입력출처');
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
}
