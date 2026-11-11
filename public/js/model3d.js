// 목조 건축 3D 매핑: 정면 3칸(협칸-어칸-협칸) · 1고주 5량가 · 맞배지붕
// 단위 m. x = 정면(도리) 방향, z = 측면(보) 방향(앞 z=0 → 뒤 z=6), y = 높이.
import { MEMBERS } from "./diagrams.js";

// 3D에만 있는 그룹 (그룹 용어 → 구성 부재)
const GROUPS3D = {
  ...MEMBERS,
  dori: ["jusimdori", "jungdori", "jongdori"],
  ryang5: ["jusimdori", "jungdori", "jongdori", "daedulbo", "jongbo", "dongjaju", "daegong"],
  ryangga: ["jusimdori", "jungdori", "jongdori", "daedulbo", "jongbo", "dongjaju", "daegong", "toebo", "gooju"],
  il_goju_5ryang: ["gooju", "toebo", "daedulbo", "dongjaju", "jongbo", "daegong", "jusimdori", "jungdori", "jongdori"],
  kan: ["eokan", "hyeopkan", "toekan"],
};

export const IDS_3D = [
  "eokan", "hyeopkan", "toekan", "pyeongju", "uju_w", "gooju", "toebo", "daedulbo", "dongjaju", "jongbo",
  "daegong", "jusimdori", "jungdori", "jongdori", "jangyeo", "changbang", "seokkarae", "matbae",
  "il_goju_5ryang", "ryang5", "ryangga", "dori", "kan",
];

export async function mountModel(el, { onPick, names }) {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const css = getComputedStyle(document.documentElement);
  const gold = new THREE.Color(css.getPropertyValue("--gold").trim() || "#d4a017");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(-11, 8, -13);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3, 3);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 6; controls.maxDistance = 40;

  scene.add(new THREE.HemisphereLight(0xfff6e5, 0x6b5a45, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-8, 14, -6);
  scene.add(sun);

  const COLORS = { wood: 0x8a5a33, column: 0x9b3b2a, floor: 0xd9cdb6, roof: 0x5c5f66, kan: [0x7fb59f, 0xe0b65a, 0x8ea6d6] };
  const pickables = [];
  const byId = new Map();

  function addMesh(id, geo, color, pos, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: true, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, depthWrite: (opts.opacity ?? 1) === 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (opts.rot) m.rotation.set(...opts.rot);
    m.userData = { id, baseOpacity: mat.opacity, baseColor: new THREE.Color(color) };
    scene.add(m);
    pickables.push(m);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(m);
    return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cylY = (r, h) => new THREE.CylinderGeometry(r, r * 1.05, h, 20);
  const cylX = (r, len) => new THREE.CylinderGeometry(r, r, len, 16).rotateZ(Math.PI / 2);

  // 기단(비대화형)
  const base = new THREE.Mesh(box(12.4, 0.5, 7.6), new THREE.MeshStandardMaterial({ color: 0xbfb4a2, roughness: 1 }));
  base.position.set(0, -0.25, 3);
  scene.add(base);

  const X = [-5.1, -1.8, 1.8, 5.1];          // 기둥 열: 협칸 3.3 / 어칸 3.6 / 협칸 3.3
  const Z_FRONT = 0, Z_GOJU = 1.5, Z_DONG = 4.5, Z_BACK = 6, Z_RIDGE = 3;

  // 칸(바닥 표시)
  addMesh("hyeopkan", box(3.3, 0.04, 6), COLORS.kan[1], [-3.45, 0.02, 3], { opacity: 0.55 });
  addMesh("eokan", box(3.6, 0.04, 6), COLORS.kan[0], [0, 0.02, 3], { opacity: 0.55 });
  addMesh("hyeopkan", box(3.3, 0.04, 6), COLORS.kan[1], [3.45, 0.02, 3], { opacity: 0.55 });
  addMesh("toekan", box(10.2, 0.04, 1.5), COLORS.kan[2], [0, 0.05, 0.75], { opacity: 0.55 });

  for (const x of X) {
    const corner = Math.abs(x) > 5;
    // 평주 / 귀기둥 (높이 3.0)
    for (const z of [Z_FRONT, Z_BACK]) addMesh(corner ? "uju_w" : "pyeongju", cylY(0.18, 3), COLORS.column, [x, 1.5, z]);
    // 고주 (높이 4.65, 중도리·종보 높이까지)
    addMesh("gooju", cylY(0.2, 4.65), COLORS.column, [x, 4.65 / 2, Z_GOJU]);
    // 퇴보: 평주(앞) ↔ 고주
    addMesh("toebo", box(0.26, 0.36, 1.7), COLORS.wood, [x, 3.05, (Z_FRONT + Z_GOJU) / 2]);
    // 대들보: 고주 ↔ 평주(뒤)
    addMesh("daedulbo", box(0.36, 0.52, 4.8), COLORS.wood, [x, 3.05, (Z_GOJU + Z_BACK) / 2]);
    // 동자주: 대들보 위, 종보 뒤끝을 받음
    addMesh("dongjaju", box(0.26, 1.05, 0.26), COLORS.wood, [x, 3.8, Z_DONG]);
    // 종보: 고주 머리 ↔ 동자주
    addMesh("jongbo", box(0.3, 0.4, 3.4), COLORS.wood, [x, 4.45, (Z_GOJU + Z_DONG) / 2]);
    // 대공: 종보 위, 종도리를 받음
    addMesh("daegong", box(0.2, 1.2, 0.5), COLORS.wood, [x, 5.25, Z_RIDGE]);
  }
  // 창방(앞·뒤), 장여, 도리
  for (const z of [Z_FRONT, Z_BACK]) {
    addMesh("changbang", box(10.5, 0.3, 0.22), COLORS.wood, [0, 2.8, z]);
    addMesh("jangyeo", box(11.4, 0.16, 0.16), COLORS.wood, [0, 3.06, z]);
    addMesh("jusimdori", cylX(0.17, 12), COLORS.wood, [0, 3.3, z]);
  }
  for (const z of [Z_GOJU, Z_DONG]) addMesh("jungdori", cylX(0.17, 12), COLORS.wood, [0, 4.82, z]);
  addMesh("jongdori", cylX(0.18, 12), COLORS.wood, [0, 6.0, Z_RIDGE]);

  // 서까래: 종도리→중도리→주심도리→처마
  const prof = [[Z_RIDGE, 6.15], [Z_GOJU, 4.97], [Z_FRONT, 3.45], [-1.3, 2.75]];
  const profBack = prof.map(([z, y]) => [6 - z, y]);
  for (const pf of [prof, profBack]) {
    for (let x = -5.7; x <= 5.71; x += 0.6) {
      for (let i = 0; i < pf.length - 1; i++) {
        const [z1, y1] = pf[i], [z2, y2] = pf[i + 1];
        const len = Math.hypot(z2 - z1, y2 - y1);
        const g = box(0.12, 0.12, len);
        const m = addMesh("seokkarae", g, COLORS.wood, [x, (y1 + y2) / 2, (z1 + z2) / 2]);
        m.lookAt(x, y2, z2); // 상자의 z축(길이)을 다음 점으로 향하게
      }
    }
  }
  // 맞배지붕 면 (기본 숨김, 토글)
  const roofMeshes = [];
  for (const pf of [prof, profBack]) {
    for (let i = 0; i < pf.length - 1; i++) {
      const [z1, y1] = pf[i], [z2, y2] = pf[i + 1];
      const len = Math.hypot(z2 - z1, y2 - y1);
      const m = addMesh("matbae", box(12.4, 0.08, len), COLORS.roof, [0, (y1 + y2) / 2 + 0.14, (z1 + z2) / 2], { opacity: 0.85 });
      m.lookAt(0, y2 + 0.14, z2);
      roofMeshes.push(m);
    }
  }
  let roofOn = false;
  roofMeshes.forEach((m) => (m.visible = false));

  // 하이라이트 (금색 엣지 + 나머지 반투명)
  const edgeMat = new THREE.LineBasicMaterial({ color: gold });
  const edges = [];
  let label = null;
  function makeLabel(text) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const f = 44;
    ctx.font = `700 ${f}px "Noto Sans KR", sans-serif`;
    c.width = Math.ceil(ctx.measureText(text).width) + 40; c.height = f + 28;
    ctx.font = `700 ${f}px "Noto Sans KR", sans-serif`;
    ctx.fillStyle = "rgba(31,26,20,.85)"; ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 16); ctx.fill();
    ctx.fillStyle = "#d4a017"; ctx.textBaseline = "middle"; ctx.fillText(text, 20, c.height / 2 + 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(c.width / c.height * 0.7, 0.7, 1);
    sp.renderOrder = 10;
    return sp;
  }
  function select(id) {
    edges.forEach((e) => scene.remove(e)); edges.length = 0;
    if (label) { scene.remove(label); label = null; }
    const ids = id ? [id, ...(GROUPS3D[id] || [])] : [];
    const on = new Set(ids.flatMap((x) => byId.get(x) || []));
    if (id === "matbae" && !roofOn) toggleRoof(true);
    for (const m of pickables) {
      const mat = m.material;
      if (!id) { mat.opacity = m.userData.baseOpacity; mat.emissive.setRGB(0, 0, 0); mat.depthWrite = mat.opacity === 1; continue; }
      if (on.has(m)) { mat.opacity = Math.max(m.userData.baseOpacity, 0.9); mat.emissive.copy(gold).multiplyScalar(0.45); mat.depthWrite = true; }
      else { mat.opacity = 0.1; mat.emissive.setRGB(0, 0, 0); mat.depthWrite = false; }
    }
    if (!on.size) return false;
    const bb = new THREE.Box3();
    for (const m of on) {
      if (!m.visible) continue;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), edgeMat);
      e.position.copy(m.position); e.rotation.copy(m.rotation);
      scene.add(e); edges.push(e);
      bb.expandByObject(m);
    }
    if (!bb.isEmpty()) {
      label = makeLabel(names[id] || id);
      const c = bb.getCenter(new THREE.Vector3());
      label.position.set(c.x, bb.max.y + 0.7, c.z);
      scene.add(label);
    }
    return true;
  }
  function toggleRoof(force) {
    roofOn = force ?? !roofOn;
    roofMeshes.forEach((m) => (m.visible = roofOn));
    return roofOn;
  }

  // 탭으로 부재 선택 (드래그와 구분)
  const ray = new THREE.Raycaster();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(pickables.filter((m) => m.visible && m.material.opacity > 0.2))[0];
    onPick(hit ? hit.object.userData.id : null);
  });

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  let alive = true;
  (function loop() { if (!alive) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

  return {
    select, toggleRoof,
    dispose() { alive = false; ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
