# 기존 행사 운영 대시보드 · Vercel 배포 준비

기존 Vite 앱의 매출·운영·날씨 화면을 복사한 배포 폴더다. 새 앱을 설계하지 않았다. 검토 기준일은 2026-10-20이다.

## 앱 폴더와 빌드 설정

- Git 저장소에서 Root Directory: `deployment/ssg-dashboard`
- Framework Preset: Vite
- Node.js: 22.x
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`
- `src/`: 기존 화면과 브라우저 매출 처리 코드
- `api/weather.js`: Vercel Node 서버 함수 `/api/weather`
- `api/operations.js`: 공개 가능한 교육용 가상 준비표 응답
- `server/weather.js`: 서버 전용 OpenWeather 연결, 8초 제한, 성공 10분 메모리 캐시
- `shared/`: 비밀 없는 날씨 예제와 공개용 가상 행사 JSON. Vite public 폴더에 두지 않고 서버 함수에서 읽는다.
- `vercel.json`: Vite 빌드 및 서버 함수 15초 실행 제한, shared 자료 포함 설정

로컬 원본 파일 경로에 대한 서버 의존성을 제거했다. 업무 원본 A~E, 실제 환경 파일·인증 파일, 로그·보고서·node_modules·dist는 업로드 대상이 아니다. 가상 준비표는 제공 CSV에서 별도로 정규화한 공개용 사본 72건이며 실제 이름·고객·연락처가 없다. 매출 엑셀 원본은 포함하지 않았다. 가상 브랜드만 포함한 별도 정규화 JSON 480행을 최초 화면에서 교육용 예제로 표시한다. 전체 합계는 매출 385,287만원·목표 386,120만원이다. 파일을 직접 선택하면 예제를 교체하고 브라우저 안에서 처리한다.

## 업로드 → Import → Secret → Deploy

1. **업로드**: 이 폴더의 코드·설정·공개용 가상 JSON만 GitHub 저장소에 반영한다. `.env.example`은 `OPENWEATHER_API_KEY=` 빈 값만 허용한다. 원본과 `.env.local`은 올리지 않는다.
2. **Import**: Vercel에서 Add New → Project → Import Git Repository로 `0704lhk/ssg_operating_tool`을 선택한다. Root Directory를 `deployment/ssg-dashboard`로 지정하고 위 빌드 설정을 확인한다. 초기 배포 전에 계정·요금제와 보호 설정을 확인한다.
3. **Secret**: Project Environment Variables에 `OPENWEATHER_API_KEY`를 추가한다. 실제 값은 Vercel 설정에서만 입력하고 필요한 Production·Preview 환경에 각각 적용한다. `VITE_` 또는 공개 접두사를 붙이지 않는다. 로컬 테스트는 이 폴더의 `.env.local`에 직접 입력하고 서버를 재시작한다. 환경변수 변경은 새 배포에 적용한다.
4. **Deploy**: 접근 제한이 허용 담당자 1명에 맞게 적용되는지 확인한 뒤 직접 배포한다. Vercel Settings → Deployment Protection에서 **All Deployments**와 계정에 맞는 인증 방식을 확인한다. Standard Protection만으로는 정식 도메인 전체를 보호한다고 간주하지 않는다. 팀 멤버 전체가 자동 허용되는지, 허용 담당자 외의 계정이 접근할 수 있는지 확인한다. 공유 우회 링크를 만들지 않는다. 원하는 범위를 지원하지 않으면 배포·공유를 보류한다.

정식·미리보기·이전 배포 주소와 `/api/weather`, `/api/operations`, `/api/sales-sample` 모두 허용 담당자·비로그인·비허용 계정으로 각각 검사한다. 이 저장소에는 계정 수준 보호가 자동 적용되는 것으로 가장하는 설정을 넣지 않았다. 계정·요금제·실제 인증 동작은 사용자가 Vercel에서 확인해야 한다.

## 날씨와 저장 범위

날씨 키는 서버의 `process.env.OPENWEATHER_API_KEY`에서만 읽는다. 서울 중구 참고 좌표는 예제A점 실제 위치가 아니다. 키 누락·외부 호출 실패 시 고정된 교육용 예제와 이유를 표시한다. 실제 연결 성공·관측/조회 시각·캐시 여부와 예제를 구분한다. 성공 캐시는 서버 함수 인스턴스별 메모리이며 재시작·다중 인스턴스 사이에 공유되는 영구 캐시가 아니다. 실제 키가 없어 실제 OpenWeather 성공은 미검증이다.

체크·메모는 기기·브라우저·사이트 주소에만 저장된다. 로컬과 배포 주소 사이에 자동 이전하거나 팀 공유하지 않는다. 새 주소에서는 필요한 메모를 별도로 확인한다.

## 배포 후 직접 확인

- 매출 3파일 선택 시 정상 480행과 만원 단위, 필터·보고 저장
- 운영 2026-10-20: 지연/오늘/임박/이후/날짜 확인 12/6/12/6/6, 완료·취소 제외
- 체크·메모 저장 및 새로고침 후 ID 연결
- 날씨 실제 성공, 키 누락·실패 예제, 날짜·출처·이유·캐시 표시
- 브라우저 HTML·JS·요청·응답·로그에 실제 키가 없는지 확인
- 정식·미리보기·이전 URL과 세 API의 접근 제한

배포는 아직 실행하지 않았다. 빌드 성공과 로컬 서버 함수 검사는 실제 Vercel 배포·접근 검증을 대신하지 않는다.

## 공식 설정 근거

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Environment variables](https://vercel.com/docs/environment-variables)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js)
