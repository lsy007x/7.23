# Hallmark — 설치됨 (사용 안내)

[Hallmark](https://github.com/Nutlope/hallmark) v2 디자인 스킬이 이 프로젝트에 설치되어 있습니다.
"AI 티 나는" 웹페이지 대신, 디자인된 것처럼 보이는 페이지를 만들어 줍니다. (Powered by Together AI)

- 스킬 본체: `.claude/skills/hallmark/` (SKILL.md + references 50개 테마 + scripts)
- 이 세션에서 바로 `hallmark` 스킬로 등록되어 사용 가능합니다.

## 사용법

- 새 페이지: **`/hallmark <원하는 것>`** 또는 그냥 "use hallmark to build ..."
  예) `/hallmark 요가 스튜디오 예약 페이지`
- 커스텀(테마 없이 자유 디자인): 프롬프트에 **custom** 포함
- 기존 페이지 리디자인/감사(Hallmark를 명시해야만 동작):
  - `/hallmark redesign <경로>` — 내용·동작은 유지하고 디자인/레이아웃만 재구성
  - `/hallmark audit <경로>` — 문제점만 보고
- 아무 페이지나 린트: `node .claude/skills/hallmark/scripts/sloplint.mjs <파일> --render`

## 브라우저 렌더 검사 (선택, 이 환경에서 설정됨)

정적 린트·테마 기능은 Node만으로 동작합니다. 8개 화면 폭에서 렌더링해 검사하는
`sloplint --render`와 스크린샷(`capture.mjs`)은 Chrome + puppeteer-core가 필요합니다.

- Chromium: `/opt/pw-browsers/chromium` (환경에 기본 포함)
- puppeteer-core: `npm i -g puppeteer-core` (세션이 새로 뜨면 다시 필요할 수 있음)
- root로 Chrome이 실행되므로 `--no-sandbox` 래퍼를 둠: `.claude/chrome-nosandbox.sh`
- 실행 시: `export CHROME_PATH="$PWD/.claude/chrome-nosandbox.sh"` 후 스크립트 실행

## Together AI 이미지 comp (선택)

텍스처·이미지 comp 생성 단계(`imagegen.mjs`)는 `TOGETHER_API_KEY`(api.together.xyz)가
있을 때만 동작합니다. 없어도 나머지 기능은 모두 작동합니다. 키를 넣고 싶으면 알려주세요.

출처/문서: https://github.com/Nutlope/hallmark · https://www.usehallmark.com
