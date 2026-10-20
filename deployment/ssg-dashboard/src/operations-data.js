import * as XLSX from 'xlsx/xlsx.mjs';

export const CATEGORIES = ['지연', '오늘 마감', '2일 내 임박', '이후', '날짜 확인 필요'];
export const TASK_COLUMNS = ['task_id', '행사명', '업무영역', '준비항목', '담당역할', '마감일', '상태', '우선순위', '확인사항', '점검기준일', '자료구분'];
export const EVENT = Object.freeze({ brand: '모먼트룸', title: '책상 위, 작은 숲', period: '2026-10-23 ~ 2026-11-01', place: '예제A점 5층 팝업존', hours: '매일 10:30 ~ 20:00', products: '도자기 머그, 작은 트레이, 패브릭 매트', benefit: '3만원 이상 구매 시 엽서 세트 1개 증정 · 매일 선착순 30명 · 1인 1회 · 준비 수량 소진 시 종료 · 별도 할인 없음', source: 'B_팝업오픈/07_팝업브리프.md' });

export function parseTasks(text, fileName = '08_행사준비.csv') {
  const book = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  const grid = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const headers = grid[0] || [];
  for (const name of TASK_COLUMNS) {
    if (headers.filter(header => header === name).length !== 1) throw new Error(`${fileName} 1행: 필수 열 '${name}' 누락 또는 중복`);
  }
  const rows = grid.slice(1).map((cells, index) => ({ cells, line: index + 2 })).filter(({ cells }) => cells.some(value => value !== '')).map(({ cells, line }) => ({ ...Object.fromEntries(TASK_COLUMNS.map(name => [name, String(cells[headers.indexOf(name)] ?? '')])), _sourceFile: fileName, _sourceRow: line }));
  validateTasks(rows);
  return { rows, basis: rows[0].점검기준일, fileName };
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateTasks(rows) {
  const ids = new Set();
  const states = ['완료', '취소', '미착수', '진행 중', '검토 대기'];
  for (const [index, row] of rows.entries()) {
    const fail = message => { throw new Error(`${row._sourceFile || '08_행사준비.csv'} ${row._sourceRow || index + 2}행: ${message}`); };
    if (!row.task_id?.trim() || ids.has(row.task_id)) fail('빈 ID 또는 중복 task_id');
    ids.add(row.task_id);
    if (!states.includes(row.상태)) fail('알 수 없는 상태');
    if (!row.담당역할?.trim()) fail('담당역할 누락');
    if (!validDate(row.점검기준일)) fail('점검기준일 오류');
    if (row.마감일 && !validDate(row.마감일)) fail('마감일 오류');
  }
  if (!rows.length || new Set(rows.map(row => row.점검기준일)).size !== 1) throw new Error('점검기준일 누락 또는 혼재');
  return rows;
}
export function category(row, basis) {
  if (!validDate(basis)) throw new Error('기준일 오류');
  if (['완료', '취소'].includes(row.상태)) return null;
  if (!['미착수', '진행 중', '검토 대기'].includes(row.상태)) throw new Error('알 수 없는 상태');
  if (!row.마감일) return CATEGORIES[4];
  if (!validDate(row.마감일)) throw new Error('마감일 오류');
  const days = (Date.parse(row.마감일) - Date.parse(basis)) / 86400000;
  return CATEGORIES[days < 0 ? 0 : days === 0 ? 1 : days <= 2 ? 2 : 3];
}
export function selectTasks(rows, basis, role = '', group = '') {
  return rows.map(row => ({ ...row, category: category(row, basis) }))
    .filter(row => row.category && (!role || row.담당역할 === role) && (!group || row.category === group));
}
