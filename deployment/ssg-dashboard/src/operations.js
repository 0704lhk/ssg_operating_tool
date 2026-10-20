import { CATEGORIES, selectTasks, validDate } from './operations-data.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const key = 'ssg-operations-personal-v1';
let refreshView = () => {};
const state = { payload: null, error: '', basis: '2026-10-20', role: '', group: '', descending: false, personal: {}, storage: true };
try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) state.personal = saved; }
catch { state.storage = false; }
export function mountOperations(host, returnToSales, openWeather) {
  let active = true;
  const draw = () => {
    if (!active) return;
    const rows = state.payload ? selectTasks(state.payload.rows, state.basis, state.role) : [];
    const visible = rows.filter(row => !state.group || row.category === state.group).sort((a, b) => a.task_id.localeCompare(b.task_id) * (state.descending ? -1 : 1));
    host.innerHTML = `<aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">S</span><span>OPERATIONS<span class="brand-sub">행사 운영 데스크</span></span></a><div class="nav-caption">WORKSPACE</div><nav aria-label="주요 메뉴"><button class="nav-item" id="sales-tab">▥ 매출 비교 <i>01</i></button><button class="nav-item active" aria-current="page">☑ 운영 <i>02</i></button><button class="nav-item" id="weather-tab">☀ 날씨 <i>03</i></button></nav><div class="sidebar-bottom">교육용 가상 행사<p>기준일은 컴퓨터 날짜와 별도입니다.</p></div></aside><main><header class="topbar"><span>운영 데스크 / <b>운영</b></span><span>개인 작업 공간</span></header><div class="content operations"><section class="page-heading"><div><div class="eyebrow">EVENT OPERATIONS</div><h1>행사 운영</h1><p>행사 조건과 준비 상황을 확인하세요.</p></div><span class="status-pill">교육용 가상 데이터</span></section>
    <section class="panel event-brief"><div class="eyebrow">MOMENT ROOM</div><h2>모먼트룸 팝업스토어 — 책상 위, 작은 숲</h2><p>2026-10-23 ~ 2026-11-01 · 예제A점 5층 팝업존 · 매일 10:30~20:00</p><p>도자기 머그, 작은 트레이, 패브릭 매트</p><p><b>3만원 이상 구매 시 엽서 세트 1개 증정</b><br>매일 선착순 30명 · 1인 1회 · 준비 수량 소진 시 종료 · 별도 할인 없음</p><small>출처: B_팝업오픈/07_팝업브리프.md</small>${state.payload ? `<details><summary>07 브리프 원문 확인</summary><pre class="brief-source">${esc(state.payload.brief)}</pre></details>` : ''}</section>
    ${state.error ? `<p role="alert">${esc(state.error)}</p>` : ''}
    <section class="panel filter-panel"><div class="filters"><label class="select-field">점검 기준일<input type="date" id="operation-basis" value="${esc(state.basis)}" required></label><label class="select-field">담당 역할<select id="role-filter"><option value="">전체 역할</option>${[...new Set(state.payload?.rows.map(r => r.담당역할) || [])].sort().map(role => `<option ${role === state.role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label><label class="select-field">마감 분류<select id="group-filter"><option value="">전체 분류</option>${CATEGORIES.map(group => `<option ${group === state.group ? 'selected' : ''}>${group}</option>`).join('')}</select></label></div><p>완료·취소 제외 · 기준일 다음 날부터 2일 뒤까지 임박 · 빈 날짜는 추정하지 않음</p><p>입력: C_행사준비/08_행사준비.csv · 원본 기준일 ${esc(state.payload?.basis || '확인 중')} · 적용 기준일 <b>${esc(state.basis)}</b></p></section>
    <section class="metrics operation-metrics" aria-label="준비 분류 요약">${CATEGORIES.map((group, i) => `<article class="metric ${i === 0 ? 'accent' : ''}"><div class="metric-label">${group}</div><div class="metric-value" data-category="${group}">${rows.filter(r => r.category === group).length}<small>건</small></div></article>`).join('')}</section>
    <section class="panel details-panel"><div class="section-heading"><div><h2>미완료 준비 항목 <span id="task-count" class="count-badge">${visible.length}</span></h2><p>선택 역할 미완료 ${rows.length}건 · ${state.payload ? `원본 ${state.payload.rows.length}건 / 완료 ${state.payload.rows.filter(r => r.상태 === '완료').length} · 취소 ${state.payload.rows.filter(r => r.상태 === '취소').length}건 제외` : '원본을 불러오는 중'}</p></div><button class="button" id="sort-tasks">ID ${state.descending ? '↓' : '↑'}</button></div><div class="table-scroll"><table><thead><tr><th>확인</th><th>ID / 준비 항목</th><th>담당 역할</th><th>마감일</th><th>분류 / 상태</th><th>개인 메모</th></tr></thead><tbody>${visible.map(row => `<tr data-task-id="${esc(row.task_id)}"><td><input type="checkbox" data-check="${esc(row.task_id)}" aria-label="${esc(row.task_id)} 확인" ${state.personal[row.task_id]?.checked === true ? 'checked' : ''}></td><td><b>${esc(row.task_id)} · ${esc(row.준비항목)}</b><details><summary>확인사항</summary><p>${esc(row.확인사항)}</p><p>${esc(row.업무영역)} · 우선순위 ${esc(row.우선순위)}</p></details></td><td>${esc(row.담당역할)}</td><td>${esc(row.마감일 || '날짜 확인 필요')}</td><td><span class="status-pill">${row.category}</span><p>${esc(row.상태)}</p></td><td><input class="memo-input" data-task-note="${esc(row.task_id)}" aria-label="${esc(row.task_id)} 메모" value="${esc(state.personal[row.task_id]?.note || '')}" placeholder="메모 입력"></td></tr>`).join('')}</tbody></table>${!visible.length ? '<p class="empty">표시할 항목이 없습니다.</p>' : ''}</div></section>
    <p id="operation-storage" ${state.storage ? '' : 'role="alert"'}>${state.storage ? '확인 체크·메모는 task_id별로 이 기기·브라우저·사이트에만 저장됩니다. 팀에 공유되지 않으며 체크는 원본 완료 상태를 바꾸지 않습니다.' : '브라우저 저장 실패: 체크·메모는 현재 화면에만 유지됩니다.'}</p>
    </div></main>`;
    host.querySelector('#sales-tab').onclick = () => { active = false; returnToSales(); };
    host.querySelector('#weather-tab').onclick = () => { active = false; openWeather(); };
    host.querySelector('#operation-basis').onchange = event => { if (event.target.validity.valid && validDate(event.target.value)) { state.basis = event.target.value; draw(); } else { event.target.value = state.basis; } };
    host.querySelector('#role-filter').onchange = event => { state.role = event.target.value; draw(); };
    host.querySelector('#group-filter').onchange = event => { state.group = event.target.value; draw(); };
    host.querySelector('#sort-tasks').onclick = () => { state.descending = !state.descending; draw(); };
    const save = (id, change) => {
      state.personal[id] = { ...state.personal[id], ...change };
      try { localStorage.setItem(key, JSON.stringify(state.personal)); state.storage = true; }
      catch { state.storage = false; }
      const notice = host.querySelector('#operation-storage');
      notice.textContent = state.storage ? '확인 체크·메모 저장됨 · 이 기기·브라우저·사이트에만 저장 · 팀 공유 아님 · 원본 상태는 변경되지 않습니다.' : '브라우저 저장 실패: 체크·메모는 현재 화면에만 유지됩니다.';
      if (!state.storage) notice.setAttribute('role', 'alert');
    };
    host.querySelectorAll('[data-check]').forEach(el => { el.onchange = () => save(el.dataset.check, { checked: el.checked }); });
    host.querySelectorAll('[data-task-note]').forEach(el => { el.oninput = () => save(el.dataset.taskNote, { note: el.value }); });
  };
  refreshView = draw;
  draw();
  if (!state.payload) fetch('/api/operations').then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.message); state.payload = value; refreshView(); }).catch(error => { state.error = error.message; refreshView(); });
}
