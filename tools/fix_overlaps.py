#!/usr/bin/env python3
"""이름 상자끼리 겹치지 않게 한다(figures.js의 [x,y,w,h]를 수정).

앱은 상자를 여백 PAD(1px)만큼 넓혀 그리므로, 여백을 포함해 겹치는 두 상자는 경계에서 서로 양보하게 줄인다.
세로로 쌓인 이름은 위·아래 경계를, 가로로 나란한 이름은 좌·우 경계를 나눈다. 상자가 너무 작아지면(높이·너비 5 미만) 건드리지 않는다.
사용법: python3 tools/fix_overlaps.py [--write]
"""
import json, math, re, subprocess, sys
PAD = 1
def load():
    code = 'import("./public/js/figures.js").then(m=>console.log(JSON.stringify(m.FIGURES)))'
    return json.loads(subprocess.check_output(["node", "-e", code]))

def overlaps(spots):
    out = []
    for i in range(len(spots)):
        for j in range(i + 1, len(spots)):
            a, b = spots[i], spots[j]
            ox = min(a[0] + a[2], b[0] + b[2]) + PAD - max(a[0], b[0]) + PAD
            oy = min(a[1] + a[3], b[1] + b[3]) + PAD - max(a[1], b[1]) + PAD
            if ox > 0 and oy > 0: out.append((i, j, ox, oy))
    return out

def resolve(boxes):
    boxes = [list(b) for b in boxes]
    for _ in range(6):
        ov = overlaps(boxes)
        if not ov: break
        for i, j, ox, oy in ov:
            a, b = boxes[i], boxes[j]
            if oy <= ox:                                 # 세로로 쌓임: 위쪽 상자는 아래를, 아래쪽 상자는 위를 줄인다
                up, lo = (a, b) if a[1] + a[3] / 2 <= b[1] + b[3] / 2 else (b, a)
                cut = math.ceil(oy / 2)
                if up[3] - cut >= 5 and lo[3] - cut >= 5:
                    up[3] -= cut; lo[1] += cut; lo[3] -= cut
            else:                                        # 가로로 나란함
                le, ri = (a, b) if a[0] + a[2] / 2 <= b[0] + b[2] / 2 else (b, a)
                cut = math.ceil(ox / 2)
                if le[2] - cut >= 5 and ri[2] - cut >= 5:
                    le[2] -= cut; ri[0] += cut; ri[2] -= cut
    return boxes

def main():
    write = "--write" in sys.argv
    figs = load()
    out = open("public/js/figures.js", encoding="utf8").read()
    before = after = 0
    for key, f in figs.items():
        boxes = [sp[1] for sp in f["spots"]]
        before += len(overlaps(boxes))
        new = resolve(boxes)
        left = overlaps(new); after += len(left)
        m = re.search(r"\n  %s: \{\n.*?\n  \},\n" % key, out, re.S)
        blk = m.group(0)
        pat = re.compile(r'(\["[^"]+", )\[(-?\d+), (-?\d+), (\d+), (\d+)\]')
        found = list(pat.finditer(blk)); assert len(found) == len(new), key
        parts, last = [], 0
        for mm, nb in zip(found, new):
            parts.append(blk[last:mm.start()] + mm.group(1) + "[" + ", ".join(map(str, nb)) + "]"); last = mm.end()
        parts.append(blk[last:])
        out = out[:m.start()] + "".join(parts) + out[m.end():]
        for i, j, ox, oy in left: print(f"  남음 {key}: {f['spots'][i][0]} / {f['spots'][j][0]}")
    print(f"겹침 {before}쌍 → {after}쌍")
    if write: open("public/js/figures.js", "w", encoding="utf8").write(out); print("figures.js 갱신")

main()
