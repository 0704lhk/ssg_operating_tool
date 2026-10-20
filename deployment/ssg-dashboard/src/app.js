import './style.css';
import * as data from './data.js';
import { mountOperations } from './operations.js';
import { mountWeather } from './weather.js';
let activeTab = ['operations', 'weather'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'sales';
function navigate(tab) { activeTab = tab; history.replaceState(null, '', `#${tab}`); render(); }

const app = document.querySelector('#app');
const STORAGE_KEY = 'ssg-sales-notes-v1';
const state = { sample: false, rows: [], filters: { stores: ['예제A점'], channel: '', week: '' }, notes: {}, busy: false, messages: [], sort: { key: 'record_id', direction: 1 } };
let storageAvailable = true;
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) state.notes = saved; } catch { storageAvailable = false; }
const fmt = value => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
const pct = value => value == null ? '—' : `${fmt(value * 100)}%`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unique = key => [...new Set(state.rows.map(row => row[key]))].sort();
const filtered = () => data.filterRows(state.rows, state.filters);
const conditionText = () => `${state.filters.stores.length ? state.filters.stores.join(', ') : '전체 점포'} · ${state.filters.channel || '전체 채널'} · ${state.filters.week || '전체 기준주'}`;

function render() {
  if (activeTab === 'weather') { mountWeather(app, navigate); return; }
  if (activeTab === 'operations') {
    mountOperations(app, () => navigate('sales'), () => navigate('weather'));
    return;
  }
  const rows = filtered();
  const sum = data.summarize(rows);
  const stores = unique('점포');
  const dates = [...new Set(rows.map(row => row['기준일']))].sort();
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#"><span class="brand-mark">S</span><span>OPERATIONS<span class="brand-sub">행사 운영 데스크</span></span></a>
      <div class="nav-caption">WORKSPACE</div>
      <nav aria-label="주요 메뉴"><a class="nav-item active" href="#"><span>▥</span> 매출 비교 <i>01</i></a><button class="nav-item" id="operations-tab"><span>☑</span> 운영 <i>02</i></button><button class="nav-item" id="weather-tab"><span>☀</span> 날씨 <i>03</i></button></nav>
      <div class="sidebar-bottom"><span class="status-dot"></span> 로컬 워크스페이스<p>교육용 가상 데이터<br>원본은 그대로 보존합니다.</p></div>
    </aside>
    <main>
      <header class="topbar"><span>운영 데스크 <span class="crumb">/</span> <b>매출 비교</b></span><span class="private-badge"><span class="status-dot"></span> 개인 작업 공간</span></header>
      <div class="content">
        <section class="page-heading"><div><div class="eyebrow">SALES OVERVIEW</div><h1>매출 비교</h1><p>흩어진 실적을 한곳에 모으고, 같은 기준으로 비교하세요.</p></div><label class="button primary upload-button" for="file-input"><span>＋</span> 실적 파일 불러오기<input id="file-input" type="file" accept=".xlsx,.xls" multiple ${state.busy ? 'disabled' : ''}></label></section>
        <section class="import-strip" aria-label="입력 자료"><div class="import-icon">▤</div><div><b>${state.rows.length ? `${state.sample ? '교육용 예제' : '원본'} ${fmt(state.rows.length)}행 연결됨` : '영업 · 온라인 · 팝업 원본을 연결하세요'}</b><p>${state.rows.length ? esc([...new Set(state.rows.map(row => row._sourceFile))].join(' · ')) : '01_영업실적.xlsx, 02_온라인실적.xlsx, 03_팝업실적.xlsx를 선택합니다.'}</p></div><span class="local-label">기기에서 처리</span></section>
        ${state.messages.length ? `<div class="messages" aria-live="polite">${state.messages.map(message => `<div class="message ${message.type}" role="${message.type === 'error' ? 'alert' : 'status'}">${esc(message.text)}</div>`).join('')}</div>` : ''}
        <section class="panel filter-panel" aria-label="조회 필터"><div class="filter-top"><h2>조회 조건</h2><button id="reset-filters" class="text-button" ${state.busy ? 'disabled' : ''}>↺ 초기화</button></div><div class="filters"><fieldset class="store-field"><legend>점포 <span>복수 선택</span></legend><div class="store-options"><label class="check-chip ${state.filters.stores.length === 0 ? 'selected' : ''}"><input type="checkbox" id="all-stores" ${state.filters.stores.length === 0 ? 'checked' : ''} ${state.busy ? 'disabled' : ''}>전체</label>${(stores.length ? stores : ['예제A점']).map(store => `<label class="check-chip ${state.filters.stores.includes(store) ? 'selected' : ''}"><input type="checkbox" name="store" value="${esc(store)}" ${state.filters.stores.includes(store) ? 'checked' : ''} ${state.busy ? 'disabled' : ''}>${esc(store)}</label>`).join('')}</div></fieldset><label class="select-field">채널<select id="channel-filter" ${state.busy ? 'disabled' : ''}><option value="">전체 채널</option>${unique('채널').map(value => `<option ${state.filters.channel === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label><label class="select-field">기준주<select id="week-filter" ${state.busy ? 'disabled' : ''}><option value="">전체 기준주</option>${unique('기준주').map(value => `<option ${state.filters.week === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label></div><div class="filter-summary"><span>${esc(conditionText())}</span><span>자료 확인일 ${dates.length ? esc(dates.length === 1 ? dates[0] : `${dates[0]} ~ ${dates.at(-1)}`) : '—'} <span class="divider">|</span> 조회 <b>${fmt(rows.length)}</b>건</span></div></section>
        <section class="metrics" aria-label="매출 요약"><article class="metric"><div class="metric-label">총 매출 <span class="metric-symbol">↗</span></div><div class="metric-value" id="sales-total">${rows.length ? fmt(sum.sales) : '—'}<small>만원</small></div><p>선택한 조건의 매출 합계</p></article><article class="metric"><div class="metric-label">총 목표 <span class="metric-symbol muted">◎</span></div><div class="metric-value" id="target-total">${rows.length ? fmt(sum.target) : '—'}<small>만원</small></div><p>목표 차이 <b class="${sum.delta >= 0 ? 'positive' : 'negative'}">${rows.length ? `${sum.delta > 0 ? '+' : ''}${fmt(sum.delta)}만원` : '—'}</b></p></article><article class="metric accent"><div class="metric-label">목표 달성률 <span class="metric-symbol">◔</span></div><div class="metric-value" id="rate-total">${rows.length ? pct(sum.rate) : '—'}</div><p>합계 매출 ÷ 합계 목표 ${rows.length && sum.target === 0 ? '· 목표 0으로 계산 제외' : ''}</p></article></section>
        <section class="panel chart-panel"><div class="section-heading"><div><h2>점포별 실적 비교</h2><p>현재 조회 조건의 매출과 목표를 비교합니다.</p></div><div class="legend"><span><i class="sales-key"></i>매출</span><span><i class="target-key"></i>목표</span><small>단위: 만원</small></div></div>${chart(rows)}</section>
        <section class="panel details-panel"><div class="section-heading"><div><h2>상세 실적 <span class="count-badge">${fmt(rows.length)}</span></h2><p>메모는 record_id에 연결되어 원본과 별도로 저장됩니다.</p></div><button id="export-report" class="button primary" ${!rows.length || state.busy ? 'disabled' : ''}>↓ 보고양식 저장 <span class="xlsx-badge">XLSX</span></button></div><div class="table-scroll">${detailTable(rows, sum)}</div><div class="table-footer"><span>금액 단위: 만원 · 달성률: 매출 ÷ 목표 · 목표 0은 —</span><span>총 ${fmt(rows.length)}건</span></div></section>
        <footer class="workspace-footer"><span>메모는 이 기기·브라우저·사이트에만 저장됩니다. 팀 공유 및 다른 주소로의 자동 이전은 지원하지 않습니다.</span><span>보고 파일은 <b>outputs/</b> 아래 새 이름으로 보관하세요.</span></footer>
        ${!storageAvailable ? '<p class="storage-error" role="alert">브라우저 저장소를 사용할 수 없어 메모가 현재 화면에만 유지됩니다.</p>' : ''}
      </div>
    </main>`;
  bind();
}

function chart(rows) {
  if (!rows.length) return '<div class="empty chart-empty"><span>▥</span><b>조회 결과 없음</b><p>실적 파일을 불러오거나 조회 조건을 변경하세요.</p></div>';
  const groups = data.groupByStore(rows);
  const max = Math.max(...groups.map(group => Math.max(group.sales, group.target)), 1);
  return `<div class="chart-grid" aria-label="점포별 매출 목표 차트">${groups.map(group => `<div class="chart-group" data-store="${esc(group.store)}" data-sales="${group.sales}" data-target="${group.target}"><div class="bar-pair"><div class="bar-column"><span>${fmt(group.sales)}</span><div class="bar sales-bar" style="height:${Math.max(2, group.sales / max * 150)}px"></div></div><div class="bar-column"><span>${fmt(group.target)}</span><div class="bar target-bar" style="height:${Math.max(2, group.target / max * 150)}px"></div></div></div><b>${esc(group.store)}</b></div>`).join('')}</div>`;
}

const headers = [['record_id', 'ID / 출처'], ['채널', '채널'], ['기준주', '기준주'], ['점포', '점포'], ['브랜드', '브랜드'], ['장르', '장르'], ['매출_만원', '매출'], ['목표_만원', '목표'], ['delta', '목표 차이'], ['rate', '달성률'], ['비용_만원', '비용'], ['net', '비용 차감액'], ['상태', '상태'], ['기준일', '자료 확인일']];
function detailTable(rows, sum) {
  if (!rows.length) return '<div class="empty table-empty"><b>조회 결과 없음</b><p>조건에 맞는 실적이 이곳에 표시됩니다.</p></div>';
  const sorted = [...rows].sort((a, b) => { const av = state.sort.key in a ? a[state.sort.key] : data.calculateRow(a)[state.sort.key]; const bv = state.sort.key in b ? b[state.sort.key] : data.calculateRow(b)[state.sort.key]; return (typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'ko')) * state.sort.direction; });
  return `<table><thead><tr>${headers.map(([key, label]) => `<th><button class="sort-button" data-sort="${key}" title="${label} 정렬">${label} <span>${state.sort.key === key ? state.sort.direction === 1 ? '↑' : '↓' : '↕'}</span></button></th>`).join('')}<th class="memo-heading">개인 메모</th></tr></thead><tbody>${sorted.map(row => { const calc = data.calculateRow(row); return `<tr data-record-id="${esc(row.record_id)}">${headers.map(([key]) => { if (key === 'record_id') return `<td><b class="row-id">${esc(row.record_id)}</b><details class="provenance"><summary>출처 보기</summary><div>${esc(row['출처'])}<br>${esc(row._sourceFile)} · ${esc(row._sourceSheet)} · ${esc(row._sourceRow)}행</div></details></td>`; if (key === 'rate') return `<td class="number ${calc.rate >= 1 ? 'positive' : ''}">${pct(calc.rate)}</td>`; if (key === 'delta' || key === 'net') return `<td class="number">${fmt(calc[key])}</td>`; if (['매출_만원', '목표_만원', '비용_만원'].includes(key)) return `<td class="number ${key === '매출_만원' ? 'strong-number' : ''}">${fmt(row[key])}</td>`; if (key === '상태') return `<td><span class="status-pill">${esc(row[key])}</span></td>`; return `<td>${esc(row[key])}</td>`; }).join('')}<td><input class="memo-input" data-note-id="${esc(row.record_id)}" aria-label="${esc(row.record_id)} 메모" placeholder="메모 입력" value="${esc(state.notes[row.record_id] || '')}"></td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="6">조회 합계 · ${fmt(rows.length)}건</td><td class="number">${fmt(sum.sales)}</td><td class="number">${fmt(sum.target)}</td><td class="number">${fmt(sum.delta)}</td><td class="number">${pct(sum.rate)}</td><td class="number">${fmt(sum.cost)}</td><td class="number">${fmt(sum.net)}</td><td colspan="3"></td></tr></tfoot></table>`;
}

function setFilters(partial) { state.filters = { ...state.filters, ...partial }; render(); }
function setNote(id, value) { state.notes[id] = String(value); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes)); } catch { storageAvailable = false; const warning = document.querySelector('.storage-error'); if (!warning) app.querySelector('.content').insertAdjacentHTML('beforeend', '<p class="storage-error" role="alert">메모 저장 실패: 현재 화면에만 유지됩니다. 보고 파일에 메모를 저장하세요.</p>'); } }

async function importFiles(files) {
  if (state.busy) return;
  state.busy = true; state.messages = []; render();
  for (const file of files) {
    try {
      const parsed = data.parseWorkbook(await file.arrayBuffer(), file.name);
      const existing = state.sample ? [] : state.rows;
      const result = data.mergeRows(existing, parsed.rows);
      const added = result.rows.length - existing.length;
      state.sample = false;
      state.rows = result.rows;
      state.messages.push({ type: 'success', text: `${file.name}: ${fmt(added)}행 추가${result.duplicateCount ? ` · 동일 ID·내용 중복 ${fmt(result.duplicateCount)}행 제외` : ''}` });
    } catch (error) { state.messages.push({ type: 'error', text: `${file.name}: ${error.message || error} · 이 파일은 반영하지 않았습니다. 기존 정상 자료는 유지됩니다.` }); }
  }
  state.busy = false; render();
}

function reportBytes() {
  const snapshot = filtered().map(row => ({ ...row }));
  if (!snapshot.length) throw new Error('저장할 조회 결과가 없습니다.');
  return data.createReport(snapshot, { ...state.notes }, { ...state.filters, stores: [...state.filters.stores] }, { sourceFiles: [...new Set(snapshot.map(row => row._sourceFile))], timezone: 'Asia/Seoul', example: true });
}

function downloadReport(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function saveReport() {
  if (state.busy || !filtered().length) return;
  const name = `매출비교_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID().slice(0, 8)}.xlsx`;
  let savedName = name;
  let saved = false;
  let fallbackReason = '';
  try {
    // Invoke within the click gesture; capture rows, filters and notes synchronously.
    let picker;
    try { picker = window.showSaveFilePicker?.({ suggestedName: name, types: [{ description: 'Excel 보고 파일', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] }); }
    catch (error) { if (error.name === 'AbortError') return; fallbackReason = '저장 위치 선택을 사용할 수 없어'; }
    const bytes = reportBytes();
    state.busy = true; render();
    if (picker) {
      try {
        const handle = await picker;
        const existing = await handle.getFile();
        if (existing.size > 0) {
          fallbackReason = '선택한 기존 파일을 보존하기 위해';
        } else {
          const writable = await handle.createWritable(); await writable.write(bytes); await writable.close();
          saved = true; savedName = handle.name;
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        fallbackReason = '브라우저에서 저장 위치 접근을 허용하지 않아';
      }
    }
    if (!saved) downloadReport(bytes, name);
    state.messages = [{ type: 'success', text: `${saved ? '보고 파일 저장 완료' : `${fallbackReason ? `${fallbackReason} ` : ''}보고 파일 다운로드 요청 완료`}: ${savedName} · outputs/ 폴더에 고유한 새 이름으로 보관하세요.` }];
  } catch (error) { state.messages = [{ type: 'error', text: `보고 저장 실패: ${error.message}` }]; }
  finally { state.busy = false; render(); }
}
function bind() {
  document.querySelector('#operations-tab').addEventListener('click', () => navigate('operations'));
  document.querySelector('#weather-tab').addEventListener('click', () => navigate('weather'));
  document.querySelector('#file-input').addEventListener('change', event => importFiles([...event.target.files]));
  document.querySelector('#all-stores').addEventListener('change', () => setFilters({ stores: [] }));
  document.querySelectorAll('input[name="store"]').forEach(input => input.addEventListener('change', () => { const selected = [...document.querySelectorAll('input[name="store"]:checked')].map(el => el.value); setFilters({ stores: selected }); }));
  document.querySelector('#channel-filter').addEventListener('change', event => setFilters({ channel: event.target.value }));
  document.querySelector('#week-filter').addEventListener('change', event => setFilters({ week: event.target.value }));
  document.querySelector('#reset-filters').addEventListener('click', () => setFilters({ stores: ['예제A점'], channel: '', week: '' }));
  document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => { state.sort = { key: button.dataset.sort, direction: state.sort.key === button.dataset.sort ? -state.sort.direction : 1 }; render(); }));
  document.querySelectorAll('[data-note-id]').forEach(input => input.addEventListener('input', () => setNote(input.dataset.noteId, input.value)));
  document.querySelector('#export-report').addEventListener('click', saveReport);
}

window.salesApp = { getState: () => ({ ...state, filtered: filtered() }), importFiles, setFilters, setNote, exportReport: reportBytes };
render();


// Public fictional snapshot only; raw input workbooks are never deployed.
fetch('/api/sales-sample').then(async response => {
  if (!response.ok) throw new Error('예제 실적 응답 오류');
  const payload = await response.json();
  if (state.rows.length || state.busy) return;
  if (!Array.isArray(payload.rows) || payload.rows.length !== 480) throw new Error('예제 실적 480행 검증 실패');
  const merged = data.mergeRows([], payload.rows);
  if (merged.rows.length !== 480) throw new Error('예제 실적 ID 검증 실패');
  state.rows = merged.rows; state.sample = true; state.filters.stores = [];
  state.messages = [{ type: 'success', text: '교육용 가상 실적 480행을 불러왔습니다. 전체 점포·전체 채널·전체 기준주 기준입니다. 직접 파일을 불러오면 예제 대신 선택한 파일을 비교합니다.' }];
  render();
}).catch(() => {
  if (!state.rows.length) { state.messages = [{ type: 'error', text: '교육용 예제 실적을 불러오지 못했습니다. 실적 파일 불러오기를 사용하거나 서버를 확인하세요.' }]; render(); }
});
