#!/usr/bin/env python3
"""figures.js의 이름 상자([x,y,w,h])를 도면의 실제 글자 크기에 맞춘다.

방법: 도면에서 긴 가로·세로 선(지시선·괄호)을 지우고 글자 획만 남긴 뒤, 기존 상자 주변에서 글자 덩어리를 찾아 그 범위로 상자를 다시 잡는다.
사용법: python3 tools/snap_boxes.py [--write]   (--write가 없으면 변경 내용만 보여 준다)
"""
import json, re, subprocess, sys
import cv2, numpy as np

PAD = 3  # 도면 좌표 기준 여백

def load():
    code = 'import("./public/js/figures.js").then(m=>console.log(JSON.stringify(m.FIGURES)))'
    return json.loads(subprocess.check_output(["node", "-e", code]))

def runs(profile, gap=1):
    """True가 이어지는 구간들 [(시작, 끝)] (gap 이하 틈은 이어 붙임)"""
    out, start, last = [], None, None
    for k, v in enumerate(profile):
        if v:
            if start is None: start = k
            last = k
        elif start is not None and k - last > gap:
            out.append((start, last)); start = None
    if start is not None: out.append((start, last))
    return out

def snap(gray, s, box, grp):
    """이름 상자를 글줄에 맞춘다.
    1) 세로: 상자 중심에 가장 가까운 '글줄'(글자 행)을 찾아 그 위아래 끝에 맞춘다. 글줄은 이웃과 한 줄 이상 떨어져 있어야 한다.
    2) 가로: 그 글줄에서 상자와 겹치는 글자 덩어리를 찾아 좌우 끝에 맞춘다(글자 사이가 넓은 '머 거 불'도 한 덩어리로 본다).
    글줄을 못 찾거나 결과가 원래 크기와 너무 다르면 건드리지 않는다(None)."""
    H, W = gray.shape
    x, y, w, h = box
    ink = (gray < 150).astype(np.uint8)
    L = max(5, int(22 * s))                     # 이보다 긴 가로·세로 선(지시선·괄호)은 글자가 아니므로 지운다
    hor = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    ver = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    txt = cv2.bitwise_and(ink, 1 - cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((3, 3), np.uint8)))
    X0, X1 = max(0, int((x - 2) * s)), min(W, int((x + w + 2) * s))
    Y0, Y1 = max(0, int((y - 0.9 * h) * s)), min(H, int((y + 1.9 * h) * s))
    sub = txt[Y0:Y1, X0:X1]
    if sub.sum() < 8: return None
    # 글줄: 행 방향 합이 있는 연속 구간 (획 사이의 1~2px 틈은 같은 줄로 본다)
    rows = runs(sub.any(axis=1), gap=max(1, int(1.5 * s)))
    cy = (y + h / 2) * s - Y0
    best = None
    for r0, r1 in rows:
        if (r1 - r0) < 5 * s: continue          # 너무 얇은 줄(선 조각)은 제외
        d = abs((r0 + r1) / 2 - cy)
        if best is None or d < best[0]: best = (d, r0, r1)
    if best is None: return None
    _, r0, r1 = best
    cols = runs(sub[r0:r1 + 1].any(axis=0), gap=int(11 * s))
    ox0, ox1 = x * s - X0, (x + w) * s - X0
    cand = [c for c in cols if min(c[1], ox1) - max(c[0], ox0) > 0]
    if not cand: return None
    c0, c1 = min(c[0] for c in cand), max(c[1] for c in cand)
    nx0, nx1 = (c0 + X0) / s - PAD, (c1 + X0) / s + PAD
    ny0, ny1 = (r0 + Y0) / s - PAD, (r1 + Y0) / s + PAD
    nb = [round(nx0), round(ny0), round(nx1 - nx0), round(ny1 - ny0)]
    if not (0.4 <= nb[2] / w <= 2.4 and 0.45 <= nb[3] / h <= 2.2):
        return "skip"
    return nb

def text_mask(gray, s):
    ink = (gray < 150).astype(np.uint8)
    L = max(5, int(22 * s))
    hor = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    ver = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    return cv2.bitwise_and(ink, 1 - cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((3, 3), np.uint8)))

def rows_in(txt, s, box):
    """상자 안에서 글자가 있는 글줄 수(이웃 글줄을 함께 잡았는지 판정)"""
    x, y, w, h = box
    sub = txt[max(0, int((y + 1) * s)):int((y + h - 1) * s), max(0, int(x * s)):int((x + w) * s)]
    return [r for r in runs(sub.any(axis=1), gap=max(1, int(1.5 * s))) if (r[1] - r[0]) >= 5 * s]

# 글자가 크고 간격이 넉넉해서 자동 보정이 안전한 도면만 대상으로 한다.
# 목조 4개 도면(geungnak1/2, daeung1/2)은 글줄이 촘촘하고 지시선이 글자에 닿아, 이웃 글줄을 함께 잡는 경우가 있어 자동 보정하지 않는다.
SAFE = {"lantern", "pagoda", "budo", "stele", "buddha", "giwa"}

def main():
    write = "--write" in sys.argv
    figs = load()
    out = open("public/js/figures.js", encoding="utf8").read()
    changed = skipped = same = 0
    line_h = {}
    for key, f in figs.items():
        gray = cv2.imread("public/" + f["src"], cv2.IMREAD_GRAYSCALE)
        sc = gray.shape[1] / f["w"]
        hs = [r[3] for r in (snap(gray, sc, sp[1], False) for sp in f["spots"]) if isinstance(r, list)]
        line_h[key] = float(np.percentile(hs, 40)) if hs else 0   # 낮은 쪽 값: 두 줄이 합쳐진 큰 것을 기준에서 배제
    for key, f in figs.items():
        if key not in SAFE:
            continue
        gray = cv2.imread("public/" + f["src"], cv2.IMREAD_GRAYSCALE)
        s = gray.shape[1] / f["w"]
        txt = text_mask(gray, s)
        m = re.search(r"\n  %s: \{\n.*?\n  \},\n" % key, out, re.S)
        blk = m.group(0)
        pat = re.compile(r'(\["[^"]+", )\[(-?\d+), (-?\d+), (\d+), (\d+)\]')
        found = list(pat.finditer(blk))
        assert len(found) == len(f["spots"]), (key, len(found), len(f["spots"]))
        pieces, last = [], 0
        for k, mm in enumerate(found):
            old = [int(v) for v in mm.groups()[1:]]
            res = snap(gray, s, old, str(k) in f.get("groups", {}))
            new = old
            if res in ("skip", None):
                skipped += 1; print(f"  보류 {key}[{k}] {f['spots'][k][0]} (자동 보정 불확실, 기존 유지)")
            elif res[3] > 1.75 * max(old[3], line_h[key]) or res[2] > 1.8 * old[2]:
                # 한 글줄의 높이(도면마다 다름)보다 눈에 띄게 크면 이웃 글줄을 함께 잡은 것
                skipped += 1; print(f"  보류 {key}[{k}] {f['spots'][k][0]} (너무 커짐 {old[2]}x{old[3]}→{res[2]}x{res[3]}, 기존 유지)")
            elif len(rows_in(txt, s, res)) != 1:
                # 보정한 상자 안에 글줄이 정확히 한 줄이어야 한다. 이웃 글줄이 섞이면 보류.
                skipped += 1; print(f"  보류 {key}[{k}] {f['spots'][k][0]} (글줄 {len(rows_in(txt, s, res))}개, 기존 유지)")
            elif max(abs(a - b) for a, b in zip(old, res)) <= 2:
                same += 1
            else:
                changed += 1; new = res
            pieces.append(blk[last:mm.start()] + mm.group(1) + "[" + ", ".join(map(str, new)) + "]"); last = mm.end()
        pieces.append(blk[last:])
        out = out[:m.start()] + "".join(pieces) + out[m.end():]
    print(f"보정 {changed}개, 이미 맞음 {same}개, 보류 {skipped}개")
    if write:
        open("public/js/figures.js", "w", encoding="utf8").write(out)
        print("figures.js 갱신")

main()
