# GLB 뷰어

`<model-viewer>` 기반 웹 3D 뷰어. 완전 오프라인으로 로컬에서 동작합니다.

## 구성

```
glb-viewer/
├── index.html                 # 뷰어 페이지
├── model.glb                  # 3D 모델 (Untitled.glb)
├── serve.py                   # 파이썬 로컬 서버
└── lib/
    └── model-viewer.min.js    # model-viewer 라이브러리 (three.js 포함, 오프라인용)
```

## 실행

```bash
cd glb-viewer
python3 serve.py          # 기본 포트 8000
# python3 serve.py 9000   # 포트 지정
```

브라우저에서 **http://localhost:8000** 접속.

> `file://`로 직접 열면 브라우저 보안정책(CORS)으로 `.glb`와 모듈 스크립트가 차단됩니다.
> 반드시 위 로컬 서버를 통해 여세요.

## 조작

- **드래그**: 회전
- **스크롤 / 핀치**: 확대·축소
- **우클릭 드래그**: 이동(팬)
- **배경 전환** 버튼: 배경색 순환
- **시점 초기화** 버튼: 카메라 리셋

## 다른 모델 보기

`model.glb`를 원하는 파일로 교체하거나, `index.html`의 `src="./model.glb"`를 수정하세요.
