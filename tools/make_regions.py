#!/usr/bin/env python3
"""도면 이미지에서 부재의 '면적'을 찾아 public/js/regions.js를 만든다.

방법: 도면의 검은 선을 약간 굵게 해서 틈을 막고, 라벨 지시선이 가리키는 점(figures.js의 pts)이 속한 '선으로 둘러싸인 칸'을
      찾아 윤곽선(SVG path)으로 저장한다. 자동 결과가 어긋나는 부재가 많아서, 눈으로 확인한 것만 아래 KEEP에 적었다.
      KEEP에 없는 부재는 기존처럼 점으로 표시된다.

사용법: python3 tools/make_regions.py   (opencv-python-headless, numpy 필요)
이미지나 figures.js의 클릭 영역을 바꿨다면 다시 실행해서 KEEP의 번호(순서)와 이름이 맞는지 확인할 것.
"""
import json, subprocess, sys
import cv2, numpy as np

# 도면 → [(spot 번호, 이름)]  ※ 이름은 figures.js의 해당 순번과 같은지 검사한다
KEEP = {
    "pagoda": [(11, "노반"), (15, "층급받침"), (16, "옥개석"), (17, "탑신석"), (20, "옥신괴임"), (21, "상대갑석"),
               (24, "중석받침"), (25, "하대갑석"), (27, "하대저석"), (28, "지대석"), (29, "탱주")],
    "stele": [(1, "비신"), (6, "제액"), (12, "비신"), (14, "비좌"), (15, "여의보주"), (17, "귀갑문")],
    "buddha": [(19, "가부좌"), (18, "촉지인"), (20, "앙련"), (27, "하대괴임"), (28, "지대석")],
    "lantern": [(5, "화사석"), (6, "상대석(석등)"), (7, "간주석"), (8, "하대석(석등)"), (9, "지대석")],
    "budo": [(3, "보주"), (4, "보개"), (11, "문비"), (12, "탑신괴임"), (13, "상대석"), (14, "중대석"), (16, "하대석")],
    "giwa": [(2, "적새"), (3, "부고"), (4, "착고"), (5, "수키와")],
}

def dump_js():
    code = ('Promise.all([import("./public/js/figures.js"),import("./public/js/data.js")]).then(([f,d])=>'
            'console.log(JSON.stringify({figs:f.FIGURES,ids:Object.fromEntries(Object.entries(d.TERM_BY_NAME).map(([k,v])=>[k,v.id]))})))')
    return json.loads(subprocess.check_output(["node", "-e", code]))

def region_paths(gray, scale, points, r=2, max_frac=0.2, search=14):
    H, W = gray.shape
    ink = (gray < 150).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    free = (cv2.dilate(ink, k) == 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    paths = []
    for px, py in points:
        X, Y = int(px * scale), int(py * scale)
        if not (0 <= X < W and 0 <= Y < H):
            continue
        L = lab[Y, X]
        if L == 0 or L in border:
            L = None
            for d in range(1, search + 1):
                sub = lab[max(0, Y - d):Y + d + 1, max(0, X - d):X + d + 1]
                cand = [c for c in np.unique(sub) if c != 0 and c not in border and stats[c, cv2.CC_STAT_AREA] > 30]
                if cand:
                    L = max(cand, key=lambda c: (sub == c).sum()); break
            if L is None:
                continue
        if stats[L, cv2.CC_STAT_AREA] > max_frac * W * H:
            continue
        m = cv2.dilate((lab == L).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 3, 2 * r + 3)))
        cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        d = ""
        for c in cs:
            if cv2.contourArea(c) < 12:
                continue
            ap = cv2.approxPolyDP(c, 1.2, True).reshape(-1, 2) / scale
            d += "M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in ap) + "Z"
        if d:
            paths.append(d)
    return paths

def main():
    data = dump_js()
    out = {}
    for key, keep in KEEP.items():
        f = data["figs"][key]
        gray = cv2.imread("public/" + f["src"], cv2.IMREAD_GRAYSCALE)
        scale = gray.shape[1] / f["w"]
        regs = {}
        for idx, name in keep:
            spot = f["spots"][idx]
            if spot[0] != name:
                sys.exit(f"{key}[{idx}] 이름 불일치: figures.js는 '{spot[0]}', KEEP은 '{name}'")
            tid = data["ids"][name]
            for d in region_paths(gray, scale, spot[2]):
                if d not in regs.setdefault(tid, []):  # 같은 용어가 두 곳에 표시된 경우 중복 제거
                    regs[tid].append(d)
        out[key] = {t: p for t, p in regs.items() if p}
        print(key, f"{len(out[key])}/{len(set(n for _, n in keep))}개 부재")
    js = ("// 도면에서 부재의 면적(윤곽선)을 찾은 결과. tools/make_regions.py가 만든 파일이므로 직접 고치지 말 것.\n"
          "// 도면 → 용어 id → SVG path 목록(도면 좌표계). 여기에 없는 부재는 점으로 표시된다.\n"
          "export const REGIONS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open("public/js/regions.js", "w", encoding="utf8").write(js)
    print("public/js/regions.js", len(js) // 1024, "KB")

main()
