# TAMSAEK – H

문화유산의 단어를 쉽게 이해하다. 전통 건축 용어를 **사전 정의 + 구조상 위치(도면·3D)** 로 함께 보여 주는 모바일 전용 웹입니다.

## 기능

| 화면 | 내용 |
|---|---|
| 홈 (`#/`) | TAMSAEK – H 제목, 검색창, 대주제 버튼(석조·목조·불상·사찰), AI 기능 바로가기 |
| 대주제 (`#/c/stone`) | 상단 카테고리 탭, "현재 주제 + 검색창", 소주제 버튼, 전체 용어 목록 |
| 도면 (`#/c/stone/pagoda`) | **원본 도면 위 인터랙티브 하이라이트**: 부록 HWP의 실제 도면(석탑·부도·석비·불상·기와·봉정사 극락전/대웅전 4장)을 그대로 쓰고, 라벨이나 부재를 탭하면 해당 부재만 금색 테두리로 강조되고 나머지는 어둡게 처리, 아래에 설명 패널. 확대(＋/−)·이동 가능 |
| 전통 건축 구조 (`#/c/wood/frame`) | **12가지 량가 구조를 3D로 비교**: 삼량·평사량·오량·반오량·일고주오량·칠량·일고주칠량·이고주칠량·심고주칠량·구량·일고주구량·이고주구량(참고 도식 기반 개략 모델). 구조를 고르면 모델이 바뀌고 설명 칸(도리 수·고주 위치·특징·쓰임)이 나온다. 금색 띠·화살표로 **정면(앞)** 표시, 정면 보기/지붕/해제 버튼, 같은 부재를 다시 탭하면 선택 해제 |
| AI 태깅 (`#/ai/tag`) | 답사 사진·도면·보고서 캡처 업로드 → Claude 비전이 부재를 인식해 **용어집 id로만** 태그 (신뢰도·위치 표시) |
| AI 튜터 (`#/ai/tutor`) | **RAG + 2단계 검증**: 용어집 검색 → 초안 → 초안을 문맥과 다시 대조해 근거 없는 내용 수정 → 인용 id 검사(문맥에 없는 인용 제거, 실제 인용한 용어만 출처로 표시). 확인되지 않은 부분은 따로 표시. 서버가 없으면 검색된 용어집 원문을 그대로 보여 줌 |

사찰은 입체(아이소메트릭) 배치도에서 건물을 탭해 볼 수 있습니다. "실제 사진 보기"는 구글 이미지 검색으로, 별도 "국가유산 디지털 서비스" 칸은 digital.khs.go.kr 첫 화면으로 연결됩니다(`app.js`의 `PHOTO_SITE`). 배경과 인터페이스는 흰색 기본입니다.

소주제: 석조 – 석탑·석등·부도·석비·보존 진단 / 목조 – 전통 건축 구조(3D)·주심포·다포·지붕·기와 / 불상 – 불상 각부 / 사찰 – 문·불전·기타 전각

## 실행

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # http://localhost:8080
```

- API 키는 서버에만 둡니다. 키가 없어도 검색·도면·3D는 모두 동작하고, AI 기능만 안내 메시지/용어집 원문으로 대체됩니다.
- 모델 기본값은 `claude-opus-5-5` (`TAMSAEK_MODEL`로 변경 가능). 거절 시 서버측 대체 모델(`fallbacks: "default"`)이 켜져 있습니다.
- `public/` 폴더만 정적 호스팅해도 AI를 제외한 기능은 동작합니다.

## 공개 (GitHub Pages)

`.github/workflows/pages.yml`이 `public/` 폴더를 GitHub Pages에 올립니다. AI 기능(사진 태깅·튜터 답변)은 서버가 없어 안내 문구와 용어집 원문으로 대체됩니다.

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정
2. Settings → Environments → `github-pages` → Deployment branches에 배포할 브랜치 허용(또는 그 브랜치를 기본 브랜치로 지정)
3. Actions 탭에서 "Deploy to GitHub Pages"를 실행하면 `https://<사용자>.github.io/<저장소>/` 주소가 생깁니다

## 구조

```
server.mjs            정적 파일 + /api/tag (비전 태깅, 구조화 출력) + /api/ask (RAG 튜터)
public/js/data.js     용어 지식 베이스 (검색·도면·RAG·태깅이 공유)
public/js/definitions.js 검수 엑셀에서 가져온 정의·한자·출처 (tools/import_definitions.py가 생성)
public/js/rag.js      검색/문맥 검색 (브라우저·서버 공용)
public/js/figures.js  원본 도면 9장의 라벨·부재 좌표(핫스팟)
public/js/figview.js  원본 도면 뷰어(하이라이트·확대)
public/js/regions.js  부재 면적(윤곽선) — tools/make_regions.py가 생성
public/js/diagrams.js 사찰 입체 배치도(직접 그린 SVG)
public/img/           부록에서 추출한 도면 이미지
public/js/structures.js 량가 12종 단면 데이터와 설명
public/js/model3d.js  구조별 3D 모델 생성
tutor.mjs             AI 튜터(초안→검증→인용 검사)
public/js/app.js      라우터와 화면
test/                 데이터 무결성·검색 테스트 (npm test)
```

## 용어 데이터에 대해 (중요)

- 용어 288개의 기본 정의는 `public/js/data.js`에 있고, **사용자 검수본(엑셀)의 정의·한자·출처**는 `public/js/definitions.js`가 덮어씁니다(출처는 "사용자 검수본 — …"으로 표시).
- 검수본 반영: `python3 tools/import_definitions.py <검수본.xlsx>` (openpyxl 필요). 엑셀의 '정의 필요 단어' 시트에서 '표준 정의 (입력)'·'정의 출처 (입력)'를 읽습니다. 형식은 `漢字: 정의` 또는 `정의`.
- 출처로 적힌 문헌은 앱이 존재 여부를 확인하지 않습니다. 공개 전에 직접 확인하세요.
- 도면 위 클릭 영역 좌표는 원본 이미지를 보고 수작업으로 지정했습니다. 어긋난 곳은 `public/js/figures.js`에서 수정하세요.

튜터는 이 데이터 밖의 내용을 답하지 않도록 제한되어 있으므로, 정의를 검수해 반영하면 답변 품질이 그대로 올라갑니다.
