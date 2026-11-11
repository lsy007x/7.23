#!/usr/bin/env python3
"""도면의 '괄호식 이름'(상륜부·탑신부·이수부·광배·상대석 …)이 가리키는 괄호 선을 도면 이미지에서 찾아 public/js/brackets.js로 만든다.

방법: 괄호 이름 상자에서 도면 안쪽으로 가까운 곳의 '세로로 긴 검은 선'을 찾고, 그 선과 이어진 검은 덩어리(괄호 가지 포함)를 윤곽(SVG path)으로 저장한다.
      틀·치수선과 섞이면 안 되므로, 이름 상자 높이 범위를 위아래로 넘는 구간만 쓴다.
사용법: python3 tools/make_brackets.py
"""
import json, subprocess
import cv2, numpy as np

def load():
    code = 'import("./public/js/figures.js").then(m=>console.log(JSON.stringify(m.FIGURES)))'
    return json.loads(subprocess.check_output(["node", "-e", code]))

def bracket_for(gray, s, box, W):
    x, y, w, h = box
    ink = (gray < 150).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    cx, cy = x + w / 2, y + h / 2
    left_side = cx < W / 2
    best = None
    for i in range(1, n):
        bx, by, bw, bh, area = st[i]
        bx, by, bw, bh = bx / s, by / s, bw / s, bh / s
        if bh < 40 or bw > 0.5 * W or area < 30:   # 세로로 충분히 긴 덩어리만
            continue
        # 이름 상자 옆(가로로 가까움)이고 상자의 높이 범위를 포함하거나 걸치는 덩어리
        near_x = (bx + bw >= x - 2 * h and bx <= x + w + 2 * h) or abs((bx + bw / 2) - cx) < w + 70
        spans_y = by <= cy <= by + bh
        if near_x and spans_y:
            d = abs((bx + bw / 2) - cx)
            if best is None or d < best[0]:
                best = (d, i)
    if best is None:
        return None
    m = (lab == best[1]).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    d = ""
    for c in cs:
        if cv2.contourArea(c) < 4 and len(c) < 8:
            continue
        ap = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2) / s
        d += "M" + "L".join(f"{px:.0f} {py:.0f}" for px, py in ap) + "Z"
    return d

# 하나의 긴 괄호를 여러 이름이 구간으로 나눠 쓰는 도면(괄호 가지의 y 위치를 도면에서 읽은 값)
SLICES = {
    "lantern": {6: (419, 543), 7: (536, 806), 8: (799, 915)},   # 상대석 / 중대석(간주석) / 하대석
    "stele": {0: (38, 226), 1: (216, 651), 2: (641, 888)},   # 이수부 / 비신부 / 귀부부 (왼쪽 세로 괄호선을 가지 y 기준으로 자름)
    "buddha": {1: (160, 578), 3: (570, 662), 4: (654, 846), 5: (838, 946)},   # 불신 / 상대석 / 중대석 / 하대석 (오른쪽 긴 괄호)
}

def slice_path(gray, s, box, y0, y1, W):
    """이름 상자 옆 괄호 덩어리 중 y0~y1 구간만 잘라 윤곽으로 만든다."""
    ink = (gray < 150).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    x, y, w, h = box
    best = None
    for i in range(1, n):
        bx, by, bw, bh, area = [v / s if k < 4 else v for k, v in enumerate(st[i])]
        if bh < 80 or bw > 0.5 * W: continue
        # 이름 상자와 가로로 가까운 괄호(상자 오른쪽이든 왼쪽이든)이고 구간이 걸치는 덩어리
        if abs((bx + bw / 2) - (x + w / 2)) < 0.38 * W and by <= (y0 + y1) / 2 <= by + bh:
            d = abs(bx + bw / 2 - (x + w / 2))
            if best is None or d < best[0]: best = (d, i)
    if best is None: return None
    m = (lab == best[1]).astype(np.uint8)
    m[:max(0, int(y0 * s))] = 0; m[int(y1 * s):] = 0
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    d = ""
    for c in cs:
        ap = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2) / s
        if len(ap) >= 3: d += "M" + "L".join(f"{px:.0f} {py:.0f}" for px, py in ap) + "Z"
    return d or None

def main():
    figs = load()
    out = {}
    for key, f in figs.items():
        groups = f.get("groups") or {}
        if not groups:
            continue
        gray = cv2.imread("public/" + f["src"], cv2.IMREAD_GRAYSCALE)
        s = gray.shape[1] / f["w"]
        res = {}
        for gi in groups:
            name, box, _ = f["spots"][int(gi)]
            sl = SLICES.get(key, {}).get(int(gi))
            d = slice_path(gray, s, box, sl[0], sl[1], f["w"]) if sl else bracket_for(gray, s, box, f["w"])
            if d:
                res[gi] = d
        out[key] = res
        print(key, f"괄호 {len(res)}/{len(groups)}")
    js = ("// 괄호식 이름의 원본 괄호 선 윤곽. tools/make_brackets.py가 만든 파일이므로 직접 고치지 말 것.\n"
          "export const BRACKETS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open("public/js/brackets.js", "w", encoding="utf8").write(js)
    print("public/js/brackets.js", len(js) // 1024, "KB")

main()
