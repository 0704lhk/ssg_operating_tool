const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—';
const state = { weather: null, weatherError: '', loadingWeather: false };
let refreshView = () => {};
export function mountWeather(host, navigate) {
  let active = true;
  const draw = () => {
    if (!active) return;
    host.innerHTML = `<aside class="sidebar"><a class="brand" href="#weather"><span class="brand-mark">S</span><span>OPERATIONS<span class="brand-sub">행사 운영 데스크</span></span></a><div class="nav-caption">WORKSPACE</div><nav aria-label="주요 메뉴"><button class="nav-item" id="sales-tab">▥ 매출 비교 <i>01</i></button><button class="nav-item" id="operations-tab">☑ 운영 <i>02</i></button><button class="nav-item active" aria-current="page">☀ 날씨 <i>03</i></button></nav><div class="sidebar-bottom">서버 날씨 연결<p>현재 관측 · 5일 예보</p></div></aside><main><header class="topbar"><span>운영 데스크 / <b>날씨</b></span><span>개인 작업 공간</span></header><div class="content operations"><section class="page-heading"><div><div class="eyebrow">WEATHER</div><h1>날씨</h1><p>현재 관측과 5일 예보, 서버 연결 상태를 확인하세요.</p></div></section><section class="panel weather-panel" aria-label="날씨"><div class="section-heading"><div><h2>현재 · 5일 날씨</h2><p>운영 기준일과 별도로 실제 조회 시점의 날씨를 표시합니다.</p></div><div><button id="weather-refresh" class="button primary" ${state.loadingWeather ? 'disabled' : ''}>서버 날씨 조회</button> <button id="weather-sample" class="button" ${state.loadingWeather ? 'disabled' : ''}>예제 보기</button></div></div><div id="weather-content" aria-live="polite">${weatherMarkup()}</div></section></div></main>`;
    for (const tab of ['sales', 'operations']) host.querySelector(`#${tab}-tab`).onclick = () => { active = false; navigate(tab); };
    host.querySelector('#weather-refresh').onclick = () => loadWeather(false);
    host.querySelector('#weather-sample').onclick = () => loadWeather(true);
  };
  async function loadWeather(selectedSample) {
    state.loadingWeather = true; state.weatherError = ''; refreshView();
    try { const response = await fetch(`/api/weather${selectedSample ? '?mode=sample' : ''}`, { signal: AbortSignal.timeout(12000) }); if (!response.ok) throw new Error(); state.weather = await response.json(); }
    catch { state.weather = null; state.weatherError = '서버 /api/weather에 연결할 수 없습니다. 서버 실행을 확인한 뒤 다시 조회하세요. 날씨 성공으로 처리하지 않았습니다.'; }
    finally { state.loadingWeather = false; refreshView(); }
  }
  refreshView = draw;
  draw();
  // Recheck server status on entry, including after viewing a fixed sample.
  if (!state.loadingWeather) loadWeather(false);
}
function weatherMarkup() {
  if (state.weatherError) return `<p role="alert">${esc(state.weatherError)}</p>`;
  if (state.loadingWeather) return '<p>서버에서 조회 중…</p>';
  const w = state.weather;
  if (!w) return '<p>날씨를 조회하세요.</p>';
  return `<div class="weather-status ${w.mode === 'sample' ? 'sample-weather' : ''}"><b>${esc(w.status)}</b>${connectionHelp(w)}<p>${esc(w.source.name)}</p><p>${esc(w.message)} <small>(${esc(w.reason)})</small></p><p>${esc(w.location.name)} (${esc(w.location.lat)}, ${esc(w.location.lon)}) · ${esc(w.location.note)}</p><p>조회: ${esc(time(w.fetchedAt))} · 관측: ${esc(time(w.observedAt))} (Asia/Seoul)<br>캐시: ${w.cached ? '사용 (10분 이내)' : '미사용'}${w.cacheExpiresAt ? ` · 만료 ${esc(time(w.cacheExpiresAt))}` : ''}${w.attemptedAt ? ` · 서버 시도 ${esc(time(w.attemptedAt))}` : ''}</p><p>연결 상태: ${esc(w.verification)} · 모의 검사 결과는 별도 검증 보고서에 기록합니다.</p>${w.source.url ? '<a href="https://openweathermap.org/" target="_blank" rel="noreferrer">출처 OpenWeather</a>' : '<small>예제 출처: D_화면과연결/11_날씨응답_예제.json · 고정된 날짜와 시각</small>'}</div><div class="current-weather"><strong>${esc(w.current.temp)}°C</strong><span>${esc(w.current.description)} · 체감 ${esc(w.current.feelsLike)}°C · 습도 ${esc(w.current.humidity)}% · 바람 ${esc(w.current.wind)}m/s</span></div><div class="forecast-grid">${w.forecast.map(d => `<article><b>${esc(d.date)}</b><p>${esc(d.description)}</p><strong>${esc(d.min)} ~ ${esc(d.max)}°C</strong><p>강수확률 ${Math.round(d.pop * 100)}%</p><small>3시간 구간 ${esc(d.slots)}개 ${d.slots < 8 ? '· 일부 시간' : ''}</small></article>`).join('')}</div>`;
}

function connectionHelp(w) {
  if (w.mode === 'live') return '<p class="positive"><b>OpenWeather 실제 연결 성공</b></p>';
  if (w.reason === 'selected-sample') return '<p>예제 보기를 선택했습니다. 실제 연결 확인은 서버 날씨 조회를 누르세요.</p>';
  const hints = {
    'missing-key': '프로젝트 루트의 .env.local 파일에서 OPENWEATHER_API_KEY= 오른쪽에 키를 입력하세요. 저장 후 터미널에서 서버를 종료하고 npm run dev로 다시 실행한 다음 서버 날씨 조회를 누르세요.',
    'http-401': '서버의 OpenWeather 키 인증이 거부되었습니다. .env.local의 키와 OpenWeather 계정의 키 활성화 상태를 확인한 후 서버를 재시작하세요.',
    'http-429': 'OpenWeather 호출 한도를 초과했습니다. 잠시 후 다시 조회하세요.',
    'timeout': 'OpenWeather 응답이 8초를 초과했습니다. 서버의 인터넷 연결을 확인하고 다시 조회하세요.',
    'network-error': '서버에서 OpenWeather로 연결하지 못했습니다. 서버의 인터넷 연결을 확인하고 다시 조회하세요.',
    'invalid-response': 'OpenWeather 응답을 해석할 수 없습니다. 잠시 후 다시 조회하세요.'
  };
  return `<div class="weather-connection-help" role="status"><h3>실제 날씨 연결 안 됨</h3><p>${esc(hints[w.reason] || 'OpenWeather 요청이 실패했습니다. 아래 오류 사유를 확인한 뒤 다시 조회하세요.')}</p><small>현재 아래 값은 교육용 예제입니다. 키는 이 화면이나 채팅에 입력하지 마세요.</small></div>`;
}
