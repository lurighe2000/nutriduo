import {
  AnimationAction,
  AnimationMixer,
  AmbientLight,
  DirectionalLight,
  LoopOnce,
  LoopRepeat,
  Mesh,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type Character = "stitch" | "angel";
export type ViewAngle = "front" | "threeQuarter" | "side" | "back";
export type Motion =
  | "idle"
  | "wave"
  | "look"
  | "scratch"
  | "nose"
  | "point"
  | "celebrate"
  | "sad"
  | "dance"
  | "headstand"
  | "reference";

export async function createCharacter(
  host: HTMLElement,
  character: Character,
  signal: AbortSignal,
  onMotion?: (motion: Motion) => void,
) {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.65, 1.65, 1.65, -1.65, 0.1, 30);
  camera.position.set(0, 1.5, 7);
  camera.lookAt(0, 1.2, 0);
  scene.add(new AmbientLight(0xffffff, 1.9));
  const key = new DirectionalLight(0xfff5ee, 2.4);
  key.position.set(3, 5, 5);
  const fill = new DirectionalLight(0xd7eaff, 1.6);
  fill.position.set(-3, 2, 2);
  scene.add(key, fill);
  let disposed = false;
  let frame = 0;
  let mixer: AnimationMixer | undefined;
  let visible = true;
  let paused = false;
  let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active: AnimationAction | undefined;
  let queued: Motion | undefined;
  let actions = new Map<string, AnimationAction>();
  const disposeScene = () => {
    const textures = new Set<Texture>();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material))
          if (value instanceof Texture) textures.add(value);
        material.dispose();
      }
    });
    for (const texture of textures) texture.dispose();
  };
  const resize = () => {
    const width = host.clientWidth || 280;
    const height = host.clientHeight || 280;
    const aspect = width / height;
    camera.left = -1.65 * aspect;
    camera.right = 1.65 * aspect;
    camera.top = 1.65;
    camera.bottom = -1.65;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };
  const play = (motion: Motion) => {
    if ((reduced || paused) && motion !== "idle") return false;
    if (
      active?.getClip().name === "headstand" &&
      active.time < active.getClip().duration - 0.15
    ) {
      queued = motion;
      return true;
    }
    const next = actions.get(motion);
    if (!next || next === active) return false;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(
      motion === "idle" ? LoopRepeat : LoopOnce,
      motion === "idle" ? Infinity : 1,
    );
    next.clampWhenFinished = motion !== "idle";
    if (active) active.crossFadeTo(next, 0.38, false);
    next.play();
    active = next;
    onMotion?.(motion);
    if (reduced || paused) {
      // Keep the resting pose when motion has been disabled.
      if (motion === "idle") mixer?.setTime(0);
      renderer.render(scene, camera);
    }
    return true;
  };
  const onFinished = (event: { action: AnimationAction }) => {
    if (event.action === active) {
      const next = queued || "idle";
      queued = undefined;
      play(next);
    }
  };
  let last = 0;
  const shouldRun = () =>
    actions.size > 0 &&
    visible &&
    !document.hidden &&
    !paused &&
    !reduced &&
    !disposed;
  const synchronizeLoop = () => {
    if (!shouldRun()) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else if (!frame) frame = requestAnimationFrame(render);
  };
  const render = (now: number) => {
    frame = 0;
    if (disposed) return;
    const delta = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (shouldRun()) {
      mixer?.update(delta);
      renderer.render(scene, camera);
    }
    synchronizeLoop();
  };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotionChange = () => {
    reduced = media.matches;
    play("idle");
    if (reduced) {
      mixer?.setTime(0);
      renderer.render(scene, camera);
    }
    synchronizeLoop();
  };
  const onLost = (event: Event) => {
    event.preventDefault();
    host.dispatchEvent(new CustomEvent("mascot-error"));
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    synchronizeLoop();
  });
  const resizer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resizer.disconnect();
    media.removeEventListener("change", onMotionChange);
    document.removeEventListener("visibilitychange", synchronizeLoop);
    renderer.domElement.removeEventListener("webglcontextlost", onLost);
    mixer?.removeEventListener("finished", onFinished);
    mixer?.stopAllAction();
    if (mixer) mixer.uncacheRoot(mixer.getRoot());
    actions.clear();
    disposeScene();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    const revision = import.meta.env.DEV ? Date.now() : "20261015-1";
    const asset = character === "angel" ? "angel-sculpt" : "stitch";
    const gltf = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}mascots/${asset}.glb?v=${revision}`,
    );
    scene.add(gltf.scene);
    if (signal.aborted) {
      disposeScene();
      throw new DOMException("Aborted", "AbortError");
    }
    mixer = new AnimationMixer(gltf.scene);
    actions = new Map(
      gltf.animations.map((clip) => [clip.name, mixer!.clipAction(clip)]),
    );
    mixer.addEventListener("finished", onFinished);
    play("idle");
    mixer.update(0);
    host.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    resize();
    observer.observe(host);
    resizer.observe(host);
    media.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", synchronizeLoop);
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    synchronizeLoop();
    return {
      play,
      setPaused(value: boolean) {
        paused = value;
        synchronizeLoop();
      },
      setView(view: ViewAngle) {
        if (disposed) return;
        const angle = {
          front: 0,
          threeQuarter: Math.PI / 4,
          side: Math.PI / 2,
          back: Math.PI,
        }[view];
        camera.position.set(Math.sin(angle) * 7, 1.5, Math.cos(angle) * 7);
        camera.lookAt(0, 1.2, 0);
        renderer.render(scene, camera);
      },
      motions: [...actions.keys()],
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
