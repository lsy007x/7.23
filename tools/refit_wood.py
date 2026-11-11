#!/usr/bin/env python3
"""목조 단면도 4장(극락전·대웅전)의 이름 상자를, 상자 자기 범위 안의 글줄에 맞춰 세로로 다시 잡는다.

snap_boxes.py는 글줄이 촘촘한 이 도면들에서 이웃 글줄을 함께 잡는 일이 있어 쓰지 않는다. 여기서는
  · 상자의 가로 범위 안에서만 글줄을 찾고(이웃 열은 보지 않는다),
  · 상자 중심에서 4(도면 좌표) 이내인 글줄만 쓰며,
  · 결과 높이가 8~17일 때만 바꾼다.
조건에 안 맞으면 그대로 둔다. 사용 후 tools/fix_overlaps.py를 다시 돌릴 것.
사용법: python3 tools/refit_wood.py [--write]
"""
import json, re, subprocess, sys
import cv2, numpy as np
WOOD = ["geungnak1", "geungnak2", "daeung1", "daeung2"]
def load():
    code = 'import("./public/js/figures.js").then(m=>console.log(JSON.stringify(m.FIGURES)))'
    return json.loads(subprocess.check_output(["node", "-e", code]))
def runs(v, gap):
    out, st, last = [], None, None
    for k, b in enumerate(v):
        if b:
            if st is None: st = k
            last = k
        elif st is not None and k - last > gap: out.append((st, last)); st = None
    if st is not None: out.append((st, last))
    return out
def main():
    write = "--write" in sys.argv
    figs = load(); src = open("public/js/figures.js", encoding="utf8").read()
    chg = keep = 0
    for key in WOOD:
        f = figs[key]
        g = cv2.imread("public/" + f["src"], cv2.IMREAD_GRAYSCALE); s = g.shape[1] / f["w"]
        ink = (g < 150).astype(np.uint8); L = max(5, int(22 * s))
        hor = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
        ver = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
        txt = cv2.bitwise_and(ink, 1 - cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((3, 3), np.uint8)))
        m = re.search(r"\n  %s: \{\n.*?\n  \},\n" % key, src, re.S); blk = m.group(0)
        pat = re.compile(r'(\["[^"]+", )\[(-?\d+), (-?\d+), (\d+), (\d+)\]')
        found = list(pat.finditer(blk)); parts, last = [], 0
        for mm, sp in zip(found, f["spots"]):
            x, y, w, h = sp[1]; new = [x, y, w, h]
            X0, X1 = int((x + 2) * s), int((x + w - 2) * s)
            Y0, Y1 = max(0, int((y - 8) * s)), int((y + h + 8) * s)
            sub = txt[Y0:Y1, X0:X1]
            rr = [r for r in runs(sub.any(axis=1), max(1, int(1.2 * s))) if r[1] - r[0] >= 4 * s]
            cy = (y + h / 2) * s - Y0
            cand = [r for r in rr if abs((r[0] + r[1]) / 2 - cy) <= 4 * s]
            if len(cand) == 1:
                r0, r1 = cand[0]; ny = round((r0 + Y0) / s) - 1; nh = round((r1 - r0) / s) + 2
                if 8 <= nh <= 17 and (ny != y or nh != h): new[1], new[3] = ny, nh; chg += 1
                else: keep += 1
            else: keep += 1
            parts.append(blk[last:mm.start()] + mm.group(1) + "[" + ", ".join(map(str, new)) + "]"); last = mm.end()
        parts.append(blk[last:]); src = src[:m.start()] + "".join(parts) + src[m.end():]
    print(f"조정 {chg}개, 그대로 {keep}개")
    if write: open("public/js/figures.js", "w", encoding="utf8").write(src); print("figures.js 갱신")
main()
