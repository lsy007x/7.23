// 전통 건축 구조 3D: 정면 3칸(협칸-어칸-협칸) · 맞배지붕. 단면(량가)은 structures.js의 12종에서 만든다.
// 단위 m. x = 정면(도리) 방향, z = 측면(보) 방향(앞 z=0 → 뒤 z=D), y = 높이.
import { layout, STRUCTURES, STRUCT_MEMBERS, DEFAULT_STRUCT, termIdOf } from "./structures.js";

// 3D에서 쓸 수 있는 모든 부재 id (구조 용어 포함)
export const IDS_3D = [
  "eokan", "hyeopkan", "toekan", "pyeongju", "uju_w", "gooju", "toebo", "daedulbo", "jungjongbo", "dongjaju", "jongbo",
  "daegong", "soseulhapjang", "jusimdori", "jungdori", "jongdori", "jangyeo", "changbang", "seokkarae", "matbae",
  "ryangga", "dori", "kan", ...STRUCTURES.map(termIdOf),
];

// 그룹 용어 → 구성 부재
const GROUPS3D = {
  ryangga: STRUCT_MEMBERS,
  dori: ["jusimdori", "jungdori", "jongdori"],
  kan: ["eokan", "hyeopkan", "toekan"],
  ...Object.fromEntries(STRUCTURES.map((s) => [termIdOf(s), STRUCT_MEMBERS])),
};

const X = [-5.1, -1.8, 1.8, 5.1]; // 기둥 열: 협칸 3.3 / 어칸 3.6 / 협칸 3.3
const BEAM_SIZE = { daedulbo: [0.36, 0.52], toebo: [0.26, 0.36], jongbo: [0.3, 0.4], jungjongbo: [0.32, 0.44] };

export async function mountModel(el, { onPick, names, onRoof, type = DEFAULT_STRUCT }) {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const css = getComputedStyle(document.documentElement);
  const gold = new THREE.Color(css.getPropertyValue("--gold").trim() || "#d4a017");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 6; controls.maxDistance = 60;

  scene.add(new THREE.HemisphereLight(0xfff6e5, 0x6b5a45, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-8, 14, -6);
  scene.add(sun);

  const COLORS = { wood: 0x8a5a33, column: 0x9b3b2a, roof: 0x5c5f66, kan: [0x7fb59f, 0xe0b65a, 0x8ea6d6] };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cylY = (r, h) => new THREE.CylinderGeometry(r, r * 1.05, h, 20);
  const cylX = (r, len) => new THREE.CylinderGeometry(r, r, len, 16).rotateZ(Math.PI / 2);

  // ── 정면 표시 (고정): 앞쪽(z가 작은 쪽, 퇴칸이 있는 면) 금색 띠 + 화살표 + 표지
  const frontMat = new THREE.MeshBasicMaterial({ color: gold });
  const frontBar = new THREE.Mesh(box(12.4, 0.05, 0.16), frontMat);
  frontBar.position.set(0, 0.03, -0.72);
  scene.add(frontBar);
  scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.08, -3.9), 2.6, gold.getHex(), 0.9, 0.7));

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
  const frontLabel = makeLabel("정면 (앞)");
  frontLabel.position.set(0, 0.9, -4.6);
  scene.add(frontLabel);

  // ── 구조별로 다시 만드는 부분
  let pickables = [], byId = new Map(), dynamic = [], roofMeshes = [];
  let roofOn = false, current = null, curType = type, D = 6;
  const edges = [];
  let label = null;

  function addMesh(id, geo, color, pos, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: true, opacity: opts.opacity ?? 1, depthWrite: (opts.opacity ?? 1) === 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.userData = { id, baseOpacity: mat.opacity };
    scene.add(m);
    dynamic.push(m);
    if (id) { pickables.push(m); if (!byId.has(id)) byId.set(id, []); byId.get(id).push(m); }
    return m;
  }

  function clearHighlight() {
    edges.forEach((e) => { scene.remove(e); e.geometry.dispose(); }); edges.length = 0;
    if (label) { scene.remove(label); label.material.map.dispose(); label.material.dispose(); label = null; }
  }
  function clearModel() {
    clearHighlight();
    for (const o of dynamic) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    dynamic = []; pickables = []; byId = new Map(); roofMeshes = [];
  }

  function buildModel(key) {
    clearModel();
    curType = key;
    const L = layout(key);
    D = L.D;
    // 기단 (선택 대상 아님)
    addMesh(null, box(12.4, 0.5, D + 1.6), 0xbfb4a2, [0, -0.25, D / 2]).material.roughness = 1;
    // 칸 (바닥 표시)
    addMesh("hyeopkan", box(3.3, 0.04, D), COLORS.kan[1], [-3.45, 0.02, D / 2], { opacity: 0.55 });
    addMesh("eokan", box(3.6, 0.04, D), COLORS.kan[0], [0, 0.02, D / 2], { opacity: 0.55 });
    addMesh("hyeopkan", box(3.3, 0.04, D), COLORS.kan[1], [3.45, 0.02, D / 2], { opacity: 0.55 });
    for (const t of L.toe) addMesh("toekan", box(10.2, 0.04, t.z1 - t.z0), COLORS.kan[2], [0, 0.05, (t.z0 + t.z1) / 2], { opacity: 0.55 });

    for (const x of X) {
      for (const c of L.cols) {
        const corner = Math.abs(x) > 5 && c.id === "pyeongju";
        addMesh(corner ? "uju_w" : c.id, cylY(c.id === "gooju" ? 0.2 : 0.18, c.h), COLORS.column, [x, c.h / 2, c.z]);
      }
      for (const b of L.beams) {
        const [w, h] = BEAM_SIZE[b.id];
        addMesh(b.id, box(w, h, b.z1 - b.z0), COLORS.wood, [x, b.y, (b.z0 + b.z1) / 2]);
      }
      for (const p of L.posts) {
        const daegong = p.id === "daegong";
        addMesh(p.id, daegong ? box(0.2, p.y1 - p.y0, 0.5) : box(0.26, p.y1 - p.y0, 0.26), COLORS.wood, [x, (p.y0 + p.y1) / 2, p.z]);
      }
      for (const br of L.braces) {
        const len = Math.hypot(br.z1 - br.z0, br.y1 - br.y0);
        const m = addMesh(br.id, box(0.16, 0.16, len), COLORS.wood, [x, (br.y0 + br.y1) / 2, (br.z0 + br.z1) / 2]);
        m.lookAt(x, br.y1, br.z1);
      }
    }
    // 도리, 장여, 창방
    for (const p of L.purlins) {
      addMesh(p.id, cylX(p.id === "jongdori" ? 0.18 : 0.17, 12), COLORS.wood, [0, p.y, p.z]);
      if (p.id === "jusimdori") {
        addMesh("changbang", box(10.5, 0.3, 0.22), COLORS.wood, [0, 2.8, p.z]);
        addMesh("jangyeo", box(11.4, 0.16, 0.16), COLORS.wood, [0, 3.06, p.z]);
      }
    }
    // 서까래와 지붕면 (맞배지붕은 토글)
    for (const pf of L.rafters) {
      for (let x = -5.7; x <= 5.71; x += 0.6) {
        for (let i = 0; i < pf.length - 1; i++) {
          const [z1, y1] = pf[i], [z2, y2] = pf[i + 1];
          const m = addMesh("seokkarae", box(0.12, 0.12, Math.hypot(z2 - z1, y2 - y1)), COLORS.wood, [x, (y1 + y2) / 2, (z1 + z2) / 2]);
          m.lookAt(x, y2, z2);
        }
      }
      for (let i = 0; i < pf.length - 1; i++) {
        const [z1, y1] = pf[i], [z2, y2] = pf[i + 1];
        const m = addMesh("matbae", box(12.4, 0.08, Math.hypot(z2 - z1, y2 - y1)), COLORS.roof, [0, (y1 + y2) / 2 + 0.14, (z1 + z2) / 2], { opacity: 0.85 });
        m.lookAt(0, y2 + 0.14, z2);
        m.visible = roofOn;
        roofMeshes.push(m);
      }
    }
  }

  // ── 하이라이트 (금색 엣지 + 나머지 반투명)
  const edgeMat = new THREE.LineBasicMaterial({ color: gold });
  function setRoof(on) {
    roofOn = on;
    roofMeshes.forEach((m) => (m.visible = on));
    onRoof?.(on);
  }
  function select(id) {
    current = id || null;
    clearHighlight();
    const ids = id ? [id, ...(GROUPS3D[id] || [])] : [];
    const on = new Set(ids.flatMap((x) => byId.get(x) || []));
    if (id === "matbae" && !roofOn) setRoof(true);
    for (const m of dynamic) {
      const mat = m.material;
      if (!m.userData.id) continue; // 기단
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
  // 지붕을 켜고 끌 때도 현재 선택 상태를 다시 적용해, 지붕이 선택한 부재를 가리지 않게 한다
  function toggleRoof() {
    setRoof(!roofOn);
    select(current);
    return roofOn;
  }

  // ── 카메라
  const framing = () => 1.3 * Math.max(1, (D + 10) / 16); // 모델 전체가 화면에 들어오도록 약간 멀리서 본다
  function frame() {
    const f = framing();
    controls.target.set(0, 3.2, D / 2);
    camera.position.set(-11 * f, 3.2 + 5 * f, D / 2 - 16 * f);
    controls.update();
  }
  function viewFront() {
    const f = framing();
    controls.target.set(0, 3.2, D / 2);
    camera.position.set(0, 5.5 + 2 * (f - 1), D / 2 - 17 * f);
    controls.update();
  }

  // 구조 바꾸기: 모델을 다시 만들고, 같은 부재가 있으면 선택을 유지한다
  function setType(key) {
    const keep = current;
    buildModel(key);
    frame();
    select(keep && (byId.has(keep) || GROUPS3D[keep]) ? keep : null);
    return [...byId.keys()];
  }

  // ── 탭으로 부재 선택 (드래그와 구분)
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

  buildModel(type);
  frame();
  let alive = true;
  (function loop() { if (!alive) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

  return {
    select, toggleRoof, viewFront, setType,
    ids: () => [...byId.keys()],
    type: () => curType,
    dispose() { alive = false; ro.disconnect(); clearModel(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
