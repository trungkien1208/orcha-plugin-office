import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART } from "./art.generated";

type Props = { target: RefObject<HTMLButtonElement | null>; phase: string; calm: boolean; onReady: () => void };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** A real hinged slab and perspective dolly. This renderer is disposed when reception closes. */
export default function ReceptionDoor({ target, phase, calm, onReady }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useRef({ phase, at: performance.now(), calm });
  const restart = useRef<() => void>(() => undefined);
  useEffect(() => {
    motion.current = { phase, at: performance.now(), calm };
    restart.current();
  }, [phase, calm]);
  useEffect(() => {
    if (!canvas.current) return;
    let live = true,
      request = 0,
      renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas.current,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.035, 40);
    const resources: { dispose: () => void }[] = [];
    const material = (color: string, metalness = 0, roughness = 0.82) => {
      const value = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      resources.push(value);
      return value;
    };
    const paint = material("#5b7058"),
      edge = material("#354b3b"),
      trim = material("#7d8a6b"),
      wall = material("#e8dfc9"),
      brass = material("#b59a60", 0.65, 0.36),
      glass = material("#b8c5ad", 0.08, 0.36),
      panel = material("#50674e"),
      plinth = material("#b5a98a");
    const box = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const geometry = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.012, d * 0.16));
      resources.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const plane = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const geometry = new THREE.PlaneGeometry(w, h);
      resources.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (
      parent: THREE.Object3D,
      r: number,
      h: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const geometry = new THREE.CylinderGeometry(r, r, h, 12);
      resources.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const text = (label: string, color: string, bg?: string, size = 46) => {
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 128;
      const ctx = cv.getContext("2d");
      if (ctx) {
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, 512, 128);
        }
        ctx.fillStyle = color;
        ctx.font = `600 ${size}px "IBM Plex Sans",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 256, 66);
      }
      const texture = new THREE.CanvasTexture(cv);
      texture.colorSpace = THREE.SRGBColorSpace;
      resources.push(texture);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: !bg, side: THREE.DoubleSide });
      resources.push(mat);
      return mat;
    };
    const studio = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = generator.fromScene(studio, 0.08);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.32;
    resources.push(environment);
    studio.dispose();
    generator.dispose();
    const hemi = new THREE.HemisphereLight(0xfff8e5, 0x727d69, 1.8);
    scene.add(hemi);
    const light = new THREE.DirectionalLight(0xfff4d8, 2.2);
    light.position.set(-3, 6, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -4;
    light.shadow.camera.right = 4;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -1;
    light.shadow.normalBias = 0.025;
    light.shadow.bias = -0.0002;
    scene.add(light);
    // Masonry surrounds an actual opening; there is no office image behind the glass.
    box(scene, 0.72, 3.8, 0.24, -1.46, 1.83, -0.12, wall);
    box(scene, 0.72, 3.8, 0.24, 1.46, 1.83, -0.12, wall);
    box(scene, 2.22, 0.35, 0.24, 0, 3.56, -0.12, wall);
    box(scene, 0.72, 0.16, 0.28, -1.46, 0.08, -0.08, plinth);
    box(scene, 0.72, 0.16, 0.28, 1.46, 0.08, -0.08, plinth);
    box(scene, 0.15, 3.42, 0.23, -1.055, 1.71, 0.05, edge);
    box(scene, 0.15, 3.42, 0.23, 1.055, 1.71, 0.05, edge);
    box(scene, 2.26, 0.14, 0.23, 0, 3.43, 0.05, edge);
    box(scene, 0.035, 3.45, 0.035, -1.15, 1.72, 0.185, trim);
    box(scene, 0.035, 3.45, 0.035, 1.15, 1.72, 0.185, trim);
    box(scene, 2.33, 0.035, 0.035, 0, 3.46, 0.185, trim);
    box(scene, 2.16, 0.045, 0.36, 0, 0.018, 0.045, plinth);
    const hinge = new THREE.Group();
    hinge.position.set(-0.965, 0.035, 0);
    scene.add(hinge);
    // A timber frame surrounds a separate inset glazing panel, with a solid lower panel.
    box(hinge, 0.12, 3.29, 0.105, 0.06, 1.645, 0, paint);
    box(hinge, 0.12, 3.29, 0.105, 1.87, 1.645, 0, paint);
    box(hinge, 1.81, 0.13, 0.105, 0.965, 3.225, 0, paint);
    box(hinge, 1.81, 0.13, 0.105, 0.965, 0.065, 0, paint);
    box(hinge, 1.81, 0.64, 0.09, 0.965, 0.45, 0, panel);
    box(hinge, 1.81, 0.1, 0.105, 0.965, 0.84, 0, paint);
    box(hinge, 1.67, 2.25, 0.035, 0.965, 2.025, -0.012, glass);
    for (const x of [0.15, 1.78]) box(hinge, 0.035, 2.31, 0.035, x, 2.025, 0.052, edge);
    for (const y of [0.88, 3.17]) box(hinge, 1.66, 0.035, 0.035, 0.965, y, 0.052, edge);
    box(hinge, 1.68, 0.055, 0.018, 0.965, 0.16, 0.064, brass);
    for (const y of [0.43, 1.65, 2.87]) cylinder(scene, 0.032, 0.12, -0.967, y, 0.055, brass);
    cylinder(hinge, 0.024, 0.47, 1.81, 1.62, 0.19, brass);
    for (const y of [1.435, 1.805]) {
      const mount = cylinder(hinge, 0.016, 0.14, 1.81, y, 0.12, brass);
      mount.rotation.x = Math.PI / 2;
    }
    plane(hinge, 1.26, 0.28, 0.965, 2.38, 0.024, text("easy job", "#405641", undefined, 72));
    plane(hinge, 1.22, 0.13, 0.965, 2.16, 0.024, text("THE AGENT OFFICE", "#52674c", undefined, 28));
    plane(scene, 1.55, 0.17, 0, 3.68, 0.035, text("NO. 01     THE AGENT OFFICE", "#626b54", undefined, 30));
    const sign = new THREE.Group();
    sign.position.set(0.965, 1.57, 0.1);
    hinge.add(sign);
    box(sign, 0.79, 0.245, 0.035, 0, 0, 0, material("#efe0b7"));
    plane(sign, 0.76, 0.225, 0, 0, 0.019, text("CLOSED", "#655334", "#efe0b7", 48));
    const open = plane(sign, 0.76, 0.225, 0, 0, -0.019, text("OPEN", "#f5ebd0", "#365f43", 48));
    open.rotation.y = Math.PI;
    const cordGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.66, 1.7, 0.1),
      new THREE.Vector3(0.965, 2.0, 0.03),
      new THREE.Vector3(1.27, 1.7, 0.1),
    ]);
    resources.push(cordGeo);
    const cordMat = new THREE.LineBasicMaterial({ color: 0x6c745c });
    resources.push(cordMat);
    hinge.add(new THREE.Line(cordGeo, cordMat));
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.13 });
    resources.push(shadowMat);
    const shadow = plane(scene, 12, 14, 0, -0.011, -1, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    box(scene, 2.2, 0.06, 7, 0, -0.06, -3.5, material("#b8baa4"));
    box(scene, 2.2, 3.3, 0.1, 0, 1.65, -4.8, material("#d1d0b9"));
    box(scene, 0.12, 3.3, 5, -1.12, 1.65, -2.5, wall);
    box(scene, 0.12, 3.3, 5, 1.12, 1.65, -2.5, wall);
    const loader = new THREE.TextureLoader();
    void loader
      .loadAsync(officeAssetUrl(LANDING_ART.logo))
      .then((texture) => {
        if (!live) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        resources.push(texture);
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.03 });
        resources.push(mat);
        plane(hinge, 0.43, 0.43, 0.965, 2.82, 0.026, mat);
        restart.current();
      })
      .catch(() => undefined);
    let width = 0,
      height = 0,
      zoomStart = 0,
      lastPhase = "",
      distance = 7,
      zoomDistance = 7,
      signStarted = Infinity,
      announced = false;
    const render = (now: number) => {
      if (!live || !target.current) return;
      const state = motion.current,
        currentPhase = state.phase,
        elapsed = now - state.at;
      if (width !== innerWidth || height !== innerHeight) {
        width = innerWidth;
        height = innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const rect = target.current.getBoundingClientRect();
      if (currentPhase !== lastPhase) {
        if (currentPhase === "idle") signStarted = Infinity;
        else if (!Number.isFinite(signStarted)) signStarted = now;
        if (currentPhase === "zooming") {
          zoomStart = now;
          zoomDistance = distance;
        }
        lastPhase = currentPhase;
      }
      const scale = Math.min(rect.width / 2.62, rect.height / 3.94);
      if (currentPhase !== "zooming" && currentPhase !== "revealing")
        distance = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, scale));
      const zoom =
        currentPhase === "revealing" ? 1 : currentPhase === "zooming" ? Math.min(1, (now - zoomStart) / 1150) : 0;
      const travel = zoom * zoom * (3 - 2 * zoom);
      camera.position.set(0, 1.73, zoom ? THREE.MathUtils.lerp(zoomDistance, -0.58, travel) : distance);
      camera.lookAt(0, 1.73, -8);
      const centerX = rect.left + rect.width / 2,
        centerY = rect.top + rect.height * 0.48;
      camera.setViewOffset(
        width,
        height,
        (width / 2 - centerX) * (1 - travel),
        (height / 2 - centerY) * (1 - travel),
        width,
        height,
      );
      const opened =
        currentPhase === "opening"
          ? ease(Math.min(1, elapsed / 1250))
          : currentPhase === "zooming" || currentPhase === "revealing"
            ? 1
            : 0;
      hinge.rotation.y = opened * Math.PI * 0.54;
      sign.rotation.y = currentPhase === "idle" ? 0 : Math.PI * ease(Math.min(1, (now - signStarted) / 500));
      sign.rotation.z =
        currentPhase === "idle"
          ? -0.035
          : Math.sin((now - signStarted) / 130) * Math.exp(-(now - signStarted) / 550) * 0.045;
      renderer.render(scene, camera);
      if (!announced) {
        announced = true;
        onReady();
      }
      if (canvas.current) {
        canvas.current.dataset.phase = currentPhase;
        canvas.current.dataset.cameraZ = camera.position.z.toFixed(3);
        canvas.current.dataset.hinge = hinge.rotation.y.toFixed(3);
      }
      const animate =
        !state.calm &&
        ((currentPhase !== "idle" && currentPhase !== "loading") || (currentPhase === "loading" && elapsed < 600));
      if (animate) request = requestAnimationFrame(render);
    };
    const start = () => {
      cancelAnimationFrame(request);
      if (!document.hidden) request = requestAnimationFrame(render);
    };
    restart.current = start;
    const resize = new ResizeObserver(start);
    if (target.current) resize.observe(target.current);
    window.addEventListener("resize", start);
    document.addEventListener("visibilitychange", start);
    void document.fonts.ready.then(() => {
      if (live) start();
    });
    return () => {
      live = false;
      cancelAnimationFrame(request);
      resize.disconnect();
      window.removeEventListener("resize", start);
      document.removeEventListener("visibilitychange", start);
      for (const resource of resources) resource.dispose();
      light.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      restart.current = () => undefined;
    };
  }, [target, onReady]);
  return <canvas ref={canvas} className="reception-door-stage" tabIndex={-1} aria-hidden="true" />;
}
