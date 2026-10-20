import fs from 'node:fs';

export const sample = JSON.parse(fs.readFileSync(new URL('../shared/weather-sample.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const day = seconds => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seconds * 1000));
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function createWeatherService({ getKey = () => process.env.OPENWEATHER_API_KEY, fetchImpl = fetch, now = Date.now, timeoutMs = 8000, ttlMs = 600000 } = {}) {
  let cache, pending, cacheKey;
  const fallback = (reason, message) => ({ ...structuredClone(sample), reason, message, attemptedAt: new Date(now()).toISOString(), cached: false, verification: '교육용 고정 자료 · 실제 연결 성공 아님' });
  async function retrieve(key) {
    const controller = new AbortController();
    let timer;
    try {
      const work = (async () => {
        const bodies = await Promise.all(['weather', 'forecast'].map(async endpoint => {
          const url = new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
          for (const [name, value] of Object.entries({ lat: sample.location.lat, lon: sample.location.lon, appid: key, units: 'metric', lang: 'kr' })) url.searchParams.set(name, value);
          const response = await fetchImpl(url, { signal: controller.signal });
          if (!response.ok) throw Object.assign(new Error('HTTP'), { reason: `http-${response.status}` });
          return response.json();
        }));
        const [current, forecast] = bodies;
        const validSlot = slot => finite(slot.dt) && finite(slot.main?.temp_min) && finite(slot.main?.temp_max) && finite(slot.pop) && typeof slot.weather?.[0]?.description === 'string' && finite(slot.weather[0].id);
        if (!finite(current.dt) || !finite(current.main?.temp) || !finite(current.main?.feels_like) || !finite(current.main?.humidity) || !finite(current.wind?.speed) || typeof current.weather?.[0]?.description !== 'string' || !finite(current.weather[0].id) || !Array.isArray(forecast.list) || !forecast.list.length || !forecast.list.every(validSlot)) throw Object.assign(new Error('schema'), { reason: 'invalid-response' });
        const groups = new Map();
        for (const slot of forecast.list) {
          const date = day(slot.dt);
          if (!groups.has(date)) groups.set(date, []);
          groups.get(date).push(slot);
        }
        // Five calendar dates beginning with the first supplied slot. Partial days are labelled by slot count.
        const days = [...groups].sort(([a], [b]) => a.localeCompare(b)).slice(0, 5).map(([date, slots]) => ({ date, min: Math.min(...slots.map(s => s.main.temp_min)), max: Math.max(...slots.map(s => s.main.temp_max)), pop: Math.max(...slots.map(s => s.pop)), description: slots[Math.floor(slots.length / 2)].weather[0].description, conditionId: slots[Math.floor(slots.length / 2)].weather[0].id, slots: slots.length }));
        if (days.length !== 5) throw Object.assign(new Error('forecast'), { reason: 'invalid-response' });
        return { mode: 'live', status: '실제 날씨', reason: 'live-success', message: 'OpenWeather 현재 관측과 5일 예보를 조회했습니다. 예보는 3시간 자료를 날짜별 집계하며 첫날·마지막 날은 일부 시간만 포함할 수 있습니다.', location: sample.location, source: { name: 'OpenWeather', url: 'https://openweathermap.org/' }, fetchedAt: new Date(now()).toISOString(), observedAt: new Date(current.dt * 1000).toISOString(), cached: false, verification: '실제 서버 연결 성공', current: { temp: current.main.temp, feelsLike: current.main.feels_like, humidity: current.main.humidity, wind: current.wind.speed, description: current.weather[0].description, conditionId: current.weather[0].id }, forecast: days };
      })();
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('timeout'), { reason: 'timeout' })); }, timeoutMs); });
      const result = await Promise.race([work, timeout]);
      cache = { value: result, expires: now() + ttlMs }; cacheKey = key;
      return structuredClone(result);
    } catch (error) {
      controller.abort();
      const reason = error.reason || 'network-error';
      const message = reason === 'timeout' ? 'OpenWeather 조회 시간 제한을 초과하여 예제로 대체했습니다.' : reason === 'invalid-response' ? 'OpenWeather 응답 형식이 올바르지 않아 예제로 대체했습니다.' : reason.startsWith('http-') ? `OpenWeather 응답 오류 (${reason.slice(5)})로 예제로 대체했습니다.` : 'OpenWeather 통신 실패로 예제로 대체했습니다.';
      return fallback(reason, message);
    } finally { clearTimeout(timer); }
  }
  return async ({ selectedSample = false } = {}) => {
    if (selectedSample) return fallback('selected-sample', sample.message);
    const key = getKey()?.trim();
    if (!key) { cache = undefined; return fallback('missing-key', 'OPENWEATHER_API_KEY가 없어 예제로 대체했습니다.'); }
    if (cache && cacheKey === key && now() < cache.expires) return { ...structuredClone(cache.value), cached: true, cacheExpiresAt: new Date(cache.expires).toISOString() };
    if (!pending) pending = retrieve(key).finally(() => { pending = undefined; });
    return structuredClone(await pending);
  };
}
