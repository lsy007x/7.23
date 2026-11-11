#!/usr/bin/env python3
"""검수 엑셀 → public/js/definitions.js

사용법: python3 tools/import_definitions.py <검수본.xlsx>
엑셀의 '정의 필요 단어' 시트에서 단어별 '표준 정의 (입력)'·'정의 출처 (입력)'를 읽어
단어 이름을 키로 하는 definitions.js를 만든다. 앱(data.js)이 이 값으로 설명·한자·출처를 덮어쓴다.

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

def main(path):
    ws = openpyxl.load_workbook(path)["정의 필요 단어"]
    header = [c.value for c in ws[1]]
    col = {name: header.index(name) for name in ("단어", "표준 정의 (입력)", "정의 출처 (입력)")}
    defs = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        name, text, src = (row[col[k]] for k in ("단어", "표준 정의 (입력)", "정의 출처 (입력)"))
        if not name or not text or not str(text).strip():
            continue  # 비워 둔 칸은 기존 설명을 그대로 둔다
        hanja, desc = split_hanja(str(text))
        defs[str(name).strip()] = {k: v for k, v in {"hanja": hanja, "desc": desc, "source": f"사용자 검수본 — {str(src).strip()}" if src else "사용자 검수본"}.items() if v}
    out = ("// 사용자 검수본(엑셀)에서 가져온 정의·출처. tools/import_definitions.py로 만든 파일이므로 직접 고치지 말고 엑셀을 고쳐 다시 가져오세요.\n"
           "// 키 = 단어 이름. data.js가 같은 이름의 용어에 desc·hanja·source를 덮어쓴다.\n"
           "export const DEFINITIONS = " + json.dumps(defs, ensure_ascii=False, indent=1) + ";\n")
    open("public/js/definitions.js", "w", encoding="utf8").write(out)
    print(f"{len(defs)}개 단어 → public/js/definitions.js")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
