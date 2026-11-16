#!/usr/bin/env python3
"""검수 엑셀 → public/js/definitions.js

사용법: python3 tools/import_definitions.py <검수본.xlsx>
엑셀의 '정의 필요 단어'·'정의 있음(원문)' 시트에서 단어별 '표준 정의 (입력)'·'정의 출처 (입력)'와
'대표 연결 문화재'·'연결 문화재 근거 출처'를 읽어 단어 이름을 키로 하는 definitions.js를 만든다.
앱(data.js)이 이 값으로 설명·한자·출처·대표 문화유산을 덮어쓴다.

입력 칸 형식: "漢字: 정의" 또는 "정의". 앞부분에 한자가 있으면 한자로 읽는다.
(openpyxl 필요: pip install openpyxl)
"""
import json, re, sys
import openpyxl

CJK = re.compile(r"[一-鿿]")
HANGUL_IN_PAREN = re.compile(r"\s*\([^)]*[가-힣][^)]*\)")

def split_hanja(text):
    """'中臺石괴임: 하대석 위…' → ('中臺石괴임', '하대석 위…'). 한자 접두가 없으면 (None, text)."""
    head, sep, body = text.partition(": ")
    if sep and CJK.search(head) and len(head) <= 24:
        return HANGUL_IN_PAREN.sub("", head).strip(), body.strip()
    return None, text.strip()

GRADE = re.compile(r"\s+\(([^()]+)\)$")

def split_heritage(text):
    """'경복궁 근정전 (국보) / 서울 숭례문 (국보)' → [{'name': '경복궁 근정전', 'grade': '국보'}, …]"""
    out = []
    for part in str(text or "").split(" / "):
        part = part.strip()
        if not part:
            continue
        m = GRADE.search(part)
        out.append({"name": part[:m.start()], "grade": m.group(1)} if m else {"name": part})
    return out

def main(path):
    wb = openpyxl.load_workbook(path)
    defs = {}
    for sheet in ("정의 필요 단어", "정의 있음(원문)"):
        if sheet not in wb.sheetnames:
            continue
        ws = wb[sheet]
        header = [c.value for c in ws[1]]
        col = lambda name: header.index(name) if name in header else None
        c_name, c_text, c_src = col("단어"), col("표준 정의 (입력)"), col("정의 출처 (입력)")
        c_her = next((i for i, h in enumerate(header) if h and str(h).startswith("대표 연결 문화재")), None)
        c_hsrc = next((i for i, h in enumerate(header) if h and str(h).startswith("연결 문화재 근거 출처")), None)
        get = lambda row, i: row[i] if i is not None and i < len(row) else None
        for row in ws.iter_rows(min_row=2, values_only=True):
            name, text, src = get(row, c_name), get(row, c_text), get(row, c_src)
            if not name or not text or not str(text).strip():
                continue  # 비워 둔 칸은 기존 설명을 그대로 둔다
            hanja, desc = split_hanja(str(text))
            heritage = split_heritage(get(row, c_her))
            hsrc = get(row, c_hsrc)
            defs[str(name).strip()] = {k: v for k, v in {
                "hanja": hanja, "desc": desc,
                "source": f"사용자 검수본 — {str(src).strip()}" if src else "사용자 검수본",
                "heritage": heritage, "heritageSource": str(hsrc).strip() if hsrc else None,
            }.items() if v}
    out = ("// 사용자 검수본(엑셀)에서 가져온 정의·출처. tools/import_definitions.py로 만든 파일이므로 직접 고치지 말고 엑셀을 고쳐 다시 가져오세요.\n"
           "// 키 = 단어 이름. data.js가 같은 이름의 용어에 desc·hanja·source·heritage를 덮어쓴다.\n"
           "export const DEFINITIONS = " + json.dumps(defs, ensure_ascii=False, indent=1) + ";\n")
    open("public/js/definitions.js", "w", encoding="utf8").write(out)
    print(f"{len(defs)}개 단어 → public/js/definitions.js")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
