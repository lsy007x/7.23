피란수도 부산 (1950–1953) — 온톨로지 설계 워크숍 실습 데이터
================================================================

DH 이해하기 III · 1일차 3.[워크숍] / 2일차 네트워크 실습 용

[파일 구성]
- places.csv   장소 데이터 (지도용).       컬럼: id, name, lat, lng, type, desc
- events.csv   사건 데이터 (타임라인용).   컬럼: id, date, title, place, desc
- triples.csv  관계 데이터 (사람이 읽는 형태). 컬럼: subject, predicate, object
- nodes.csv    네트워크 노드.              컬럼: id, label, class
- edges.csv    네트워크 엣지.              컬럼: source, target, relation
- texts.txt    서술형 본문 (워드클라우드용). 문단 형식의 원작 텍스트

[triples.csv vs nodes/edges.csv]
- triples.csv 는 '주어-서술어-목적어'를 사람이 읽기 쉽게 이름으로 적은 버전입니다.
- nodes.csv / edges.csv 는 같은 내용을 '컴퓨터가 그리기 쉽게' id로 바꾼 버전입니다.
  edges.csv 의 source·target 은 nodes.csv 의 id 를 가리킵니다.
- 즉, 같은 관계망을 두 형식으로 담았습니다. 강의 흐름:
  ④ 관계 설계(triples) → 코드용 데이터(nodes/edges) → 네트워크 시각화

[id 설계 — 파일 간 조인]
- 장소 id(p1,p2,…)와 사건 id(e1,e3,…)는 places.csv / events.csv 와 '동일'합니다.
  → 지도·타임라인·네트워크가 같은 개체를 공유하도록 설계했습니다.
- 인물 per1~per5, 집단 grp1(피란민), 작품 w1·w2, 기관 org1·org2 는 네트워크 전용 id.
- 참고: 자갈치시장(p6)은 관계(triple)에 등장하지 않아 nodes.csv 에는 넣지 않았습니다.
  (네트워크의 노드 = 관계에 실제로 참여한 개체)

[클래스(class) 목록]
- Person(인물) / Place(장소) / Event(사건) / Work(작품·물품)
  + Group(피란민 같은 집단) + Organization(정부·헌책방 같은 기관)
  → 실제 데이터는 4개 기본 클래스만으로 부족할 때가 많다는 점을 함께 보여줍니다.

[바로 실습해 보기 — 바이브 코딩 프롬프트 예]
  · 지도:        "places.csv를 Leaflet 지도에 마커로 찍어줘. 부산 중심, 클릭하면 desc 팝업."
  · 타임라인:    "events.csv로 vis-timeline 연표를 만들어줘. 항목 클릭 시 desc 표시."
  · 네트워크:    "nodes.csv와 edges.csv로 vis-network 관계망을 그려줘.
                  class별로 노드 색을 다르게, 노드 크기는 연결 수(degree)에 비례,
                  엣지에 relation 라벨 표시. 라이브러리는 알아서 설치하고 로컬에서 열어줘."
  · 워드클라우드: "texts.txt의 한국어 단어 빈도로 워드클라우드를 그려줘(불용어 제외, 상위 80개)."

[주의]
- 이 데이터는 '교육용 예시'입니다. 좌표는 근사값이며, 일부 인물·사건 정보는
  워크숍 흐름에 맞춰 단순화했습니다. 실제 프로젝트에서는 출처를 확인하고
  각 데이터에 source(출처) 속성을 함께 기록하세요.
- 원산은 현재 북한에 있어 지도에서 멀리 떨어져 표시됩니다. 지도 초기 화면을
  부산 중심으로 두거나, 필요 시 제외하고 사용하세요.
