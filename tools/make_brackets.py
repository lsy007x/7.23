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


def _runs(v):
    out, st = [], None
    for k, b in enumerate(v):
        if b and st is None: st = k
        if not b and st is not None: out.append((st, k - 1)); st = None
    if st is not None: out.append((st, len(v) - 1))
    return out

def finalize(m, s):
    """괄호 마스크 → 깨끗한 윤곽 path.
    직선 괄호(세로선 + 끝 가로획)는 인쇄 망점 잡티를 지우고 선 위치·굵기·가로획을 측정해 막대로 다시 만든다.
    곡선 괄호({ } 모양)는 가우시안으로 매끈하게 한 뒤 윤곽을 딴다."""
    H, W = m.shape
    ys, xs = np.where(m)
    if len(xs) == 0: return ""
    y0, y1 = ys.min(), ys.max()
    xc = int(np.bincount(xs).argmax())               # 가장 진한 세로 열 = 괄호 세로선
    widths, ticks = [], []
    for y in range(y0, y1 + 1):
        row = m[y]
        if not row[xc]:
            # 세로선이 끊긴 행: 가까운 열에서 찾는다
            near = [x for x in range(max(0, xc - 3), min(W, xc + 4)) if row[x]]
            if not near: continue
            xi = near[0]
        else: xi = xc
        l = r = xi
        while l > 0 and row[l - 1]: l -= 1
        while r < W - 1 and row[r + 1]: r += 1
        widths.append((y, l, r))
    if not widths: return ""
    wb = float(np.median([r - l + 1 for _, l, r in widths]))
    wide = [(y, l, r) for y, l, r in widths if (r - l + 1) > 3 * wb + 4 * s]
    # 가로획 묶음
    spans, cur = [], []
    for y, l, r in wide:
        if cur and y - cur[-1][0] > 2: spans.append(cur); cur = []
        cur.append((y, l, r))
    if cur: spans.append(cur)
    # 선 위치를 직선으로 맞춘다(원본 괄호선이 약간 기울어진 도면이 있다). 곡선({ })이면 잔차가 크다.
    wide_y = {y for y, _, _ in wide}
    pts = [(y, (l + r) / 2) for y, l, r in widths if y not in wide_y]
    a_fit = b_fit = 0.0; res = 0.0
    if len(pts) >= 5:
        yy = np.array([p[0] for p in pts], float); cc = np.array([p[1] for p in pts], float)
        a_fit, b_fit = np.polyfit(yy, cc, 1); res = float(np.abs(cc - (a_fit * yy + b_fit)).max())
    is_bar = wb <= 7 * s and len(spans) <= 4 and len(pts) >= 5 and res <= 2.5 * wb + 1.5 * s
    out = np.zeros_like(m, dtype=np.uint8)
    if is_bar:
        half = max(1.0, wb / 2)
        quad = np.array([[a_fit * y0 + b_fit - half, y0], [a_fit * y0 + b_fit + half, y0],
                         [a_fit * y1 + b_fit + half, y1], [a_fit * y1 + b_fit - half, y1]], np.float32)
        cv2.fillPoly(out, [np.round(quad).astype(np.int32)], 1)
        for sp in spans:
            ya, yb = sp[0][0], sp[-1][0]
            xa, xb = min(l for _, l, _ in sp), max(r for _, _, r in sp)
            out[ya:yb + 1, xa:xb + 1] = 1
        # 막대로 그렸을 때 원본 잉크가 많이 남으면 곡선 괄호다
        grown = cv2.dilate(out, np.ones((int(2 * s) + 1, int(2 * s) + 1), np.uint8))
        leftover = float((m.astype(bool) & ~grown.astype(bool)).sum()) / max(1, int(m.sum()))
        if DEBUG: print(f"    막대 판정 잉크 잔여 {leftover:.3f}")
        if leftover > 0.02:
            is_bar = False
    if not is_bar:
        f = cv2.GaussianBlur(m.astype(np.float32), (0, 0), max(1.0, 0.9 * s))
        out = (f > 0.45).astype(np.uint8)
    cs, _ = cv2.findContours(out, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    d = ""
    for c in cs:
        ap = cv2.approxPolyDP(c, 0.8 if is_bar else 1.0, True).reshape(-1, 2) / s
        if len(ap) >= 3: d += "M" + "L".join(f"{px:.1f} {py:.1f}" for px, py in ap) + "Z"
    return d

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
    return finalize(m, s)

# 하나의 긴 괄호를 여러 이름이 구간으로 나눠 쓰는 도면(괄호 가지의 y 위치를 도면에서 읽은 값)
SLICES = {
    "lantern": {6: (419, 543), 7: (536, 806), 8: (799, 915)},   # 상대석 / 중대석(간주석) / 하대석
    "pagoda": {0: (28, 244), 1: (238, 502, 0, 112), 2: (503, 676, 60, 112)},   # 옥개석·탑신석의 작은 괄호는 본체와 붙어 있어 정확히 떼어낼 수 없으므로 만들지 않는다   # 상륜부 / 탑신부 / 기단부 (상륜부·탑신부 괄호는 서로 붙어 있어 y로 자른다)
    "stele": {0: (38, 226), 1: (216, 651), 2: (641, 888)},   # 이수부 / 비신부 / 귀부부 (왼쪽 세로 괄호선을 가지 y 기준으로 자름)
    "buddha": {1: (160, 578), 3: (570, 662), 4: (654, 846), 5: (838, 946)},   # 불신 / 상대석 / 중대석 / 하대석 (오른쪽 긴 괄호)
}

# 괄호를 만들지 않는 이름(괄호가 본체 그림과 붙어 있어 정확히 떼어낼 수 없는 것)
DEBUG = False
SKIP = {"pagoda": {16, 17}}

def slice_path(gray, s, box, y0, y1, W, x0=None, x1=None):
    """이름 상자 옆 괄호 덩어리 중 y0~y1 구간만 잘라 윤곽으로 만든다."""
    ink = (gray < 150).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    x, y, w, h = box
    best = None
    for i in range(1, n):
        bx, by, bw, bh, area = [v / s if k < 4 else v for k, v in enumerate(st[i])]
        if bh < 80 or (bw > 0.5 * W and x1 is None): continue   # x 범위를 준 경우는 본체와 붙은 괄호도 허용(x로 잘라낸다)
        # 이름 상자와 가로로 가까운 괄호(상자 오른쪽이든 왼쪽이든)이고 구간이 걸치는 덩어리
        if abs((bx + bw / 2) - (x + w / 2)) < 0.38 * W and by <= (y0 + y1) / 2 <= by + bh:
            d = abs(bx + bw / 2 - (x + w / 2))
            if best is None or d < best[0]: best = (d, i)
    if best is None: return None
    m = (lab == best[1]).astype(np.uint8)
    m[:max(0, int(y0 * s))] = 0; m[int(y1 * s):] = 0
    if x0 is not None: m[:, :max(0, int(x0 * s))] = 0
    if x1 is not None: m[:, int(x1 * s):] = 0
    return finalize(m, s) or None

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
            if int(gi) in SKIP.get(key, ()):
                continue
            sl = SLICES.get(key, {}).get(int(gi))
            d = slice_path(gray, s, box, *sl[:2], f["w"], *sl[2:]) if sl else bracket_for(gray, s, box, f["w"])
            if d:
                res[gi] = d
        out[key] = res
        print(key, f"괄호 {len(res)}/{len(groups)}")
    js = ("// 괄호식 이름의 원본 괄호 선 윤곽. tools/make_brackets.py가 만든 파일이므로 직접 고치지 말 것.\n"
          "export const BRACKETS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open("public/js/brackets.js", "w", encoding="utf8").write(js)
    print("public/js/brackets.js", len(js) // 1024, "KB")

main()
