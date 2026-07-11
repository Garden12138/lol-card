import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { ChampionCard, SkinEdition } from '../types/cards';
import {
  CardTextureError,
  createCardTextureCanvases,
  type CardTextureCanvases,
} from '../lib/cardTexture';
import {
  CARD_RELIEF_FRAGMENT_SHADER,
  CARD_RELIEF_VERTEX_SHADER,
  resolveReliefStrength,
  resolveReliefViewShift,
} from '../lib/cardRelief';

const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 1000;
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.36;
const MAX_TILT_X = 0.72;
const MAX_TILT_Y = 0.82;

type RenderMode = 'loading' | 'webgl' | 'fallback';
export type CardSide = 'front' | 'back';

export interface CardExportResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  side: CardSide;
}

export interface CardViewer3DProps {
  champion: ChampionCard;
  skin: SkinEdition;
  className?: string;
  fullscreen?: boolean;
  onRequestFullscreen?: () => void;
  onExport?: (result: CardExportResult) => void;
  onExportError?: (error: Error) => void;
}

interface ViewState {
  rotationX: number;
  rotationY: number;
  targetTiltX: number;
  targetTiltY: number;
  velocityX: number;
  velocityY: number;
  scale: number;
  targetScale: number;
  sideBack: boolean;
}

interface ViewerController {
  pointerDown: (x: number, y: number, time: number) => void;
  pointerMove: (x: number, y: number, time: number) => void;
  pointerUp: () => void;
  toggleSide: () => CardSide;
  zoomBy: (amount: number) => number;
  nudge: (x: number, y: number) => void;
  reset: () => void;
  setReducedMotion: (reduced: boolean) => void;
  exportPng: () => Promise<Blob>;
}

interface PointerSample {
  active: boolean;
  x: number;
  y: number;
  time: number;
}

function initialView(): ViewState {
  return {
    rotationX: -0.04,
    rotationY: 0,
    targetTiltX: -0.04,
    targetTiltY: 0,
    velocityX: 0,
    velocityY: 0,
    scale: 1,
    targetScale: 1,
    sideBack: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function errorFrom(value: unknown): Error {
  return value instanceof Error ? value : new Error('卡片渲染发生未知错误。');
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('浏览器未能生成 PNG 文件。'));
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function exportFileName(champion: ChampionCard, skin: SkinEdition, side: CardSide): string {
  const safeChampionId = champion.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${safeChampionId}-${skin.num}-${side}.png`;
}

async function exportFallbackCanvas(
  textures: CardTextureCanvases,
  view: ViewState,
): Promise<Blob> {
  const output = document.createElement('canvas');
  output.width = EXPORT_WIDTH;
  output.height = EXPORT_HEIGHT;
  const context = output.getContext('2d');
  if (!context) throw new Error('当前浏览器无法创建导出画布。');

  const background = context.createRadialGradient(800, 470, 20, 800, 470, 950);
  background.addColorStop(0, '#153746');
  background.addColorStop(.45, '#091925');
  background.addColorStop(1, '#030910');
  context.fillStyle = background;
  context.fillRect(0, 0, output.width, output.height);

  const source = view.sideBack ? textures.back : textures.front;
  const baseHeight = 870;
  const baseWidth = baseHeight * (source.width / source.height);
  const tiltX = view.targetTiltX;
  const tiltY = view.targetTiltY;
  const horizontal = Math.max(.12, Math.abs(Math.cos(tiltY)));
  const vertical = Math.max(.35, Math.abs(Math.cos(tiltX)));

  context.save();
  context.translate(output.width / 2, output.height / 2);
  context.shadowColor = 'rgba(0, 0, 0, .72)';
  context.shadowBlur = 54;
  context.shadowOffsetY = 25;
  context.transform(
    view.targetScale * horizontal,
    Math.sin(tiltX) * .08,
    -Math.sin(tiltY) * .08,
    view.targetScale * vertical,
    0,
    0,
  );
  context.drawImage(source, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight);
  context.restore();
  return canvasToBlob(output);
}

function TextureFaceCanvas({ source }: { source: HTMLCanvasElement }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
  }, [source]);

  return (
    <canvas
      ref={canvasRef}
      width={source.width}
      height={source.height}
      className="h-full w-full"
      aria-hidden="true"
    />
  );
}

function FallbackCard({
  champion,
  skin,
  view,
  textures,
}: {
  champion: ChampionCard;
  skin: SkinEdition;
  view: ViewState;
  textures?: CardTextureCanvases;
}) {
  const abilities = [champion.passive, ...champion.spells].slice(0, 5);
  const transform = `perspective(1100px) rotateX(${view.targetTiltX}rad) rotateY(${
    view.targetTiltY + (view.sideBack ? Math.PI : 0)
  }rad) scale(${view.targetScale})`;
  const faceStyle: CSSProperties = {
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#173a49_0%,#081722_48%,#030a11_100%)] p-8">
      <div
        className="relative aspect-[3/5] h-[82%] max-w-[78%] rounded-[1.35rem] transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform }}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-[1.35rem] border-[3px] border-[#d9bd78] bg-[#07131f] shadow-2xl ring-[10px] ring-[#17303b]"
          style={faceStyle}
        >
          {textures ? (
            <TextureFaceCanvas source={textures.front} />
          ) : (
            <>
              <img
                key={skin.loadingUrl}
                className="h-full w-full object-cover"
                src={skin.loadingUrl}
                alt=""
                draggable={false}
                crossOrigin="anonymous"
                onError={(event) => {
                  const image = event.currentTarget;
                  if (image.dataset.fallback === 'true') return;
                  image.dataset.fallback = 'true';
                  image.src = skin.splashUrl;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020912] via-[#020912dd] to-transparent px-5 pb-7 pt-24 text-center">
                <p className="font-serif text-3xl font-bold text-[#f5e8bd]">{champion.title}</p>
                <p className="mt-1 text-xs tracking-[.28em] text-[#d7dedb]">{champion.name}</p>
                <p className="mt-4 border-t border-[#d9bd7866] pt-3 text-sm text-[#f4ead7]">
                  {skin.isBase ? '经典造型' : skin.name}
                </p>
              </div>
            </>
          )}
        </div>

        <div
          className={`absolute inset-0 overflow-hidden rounded-[1.35rem] border-[3px] border-[#d9bd78] bg-[linear-gradient(145deg,#0d2936,#06101b_55%,#12303e)] shadow-2xl ring-[10px] ring-[#17303b] [transform:rotateY(180deg)] ${
            textures ? '' : 'flex flex-col px-6 py-8 text-center'
          }`}
          style={faceStyle}
        >
          {textures ? (
            <TextureFaceCanvas source={textures.back} />
          ) : (
            <>
              <p className="text-[10px] tracking-[.36em] text-[#64e6dd]">CHAMPION DOSSIER</p>
              <h3 className="mt-3 font-serif text-3xl font-bold text-[#f5e8bd]">{champion.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{champion.name}</p>
              <p className="mt-3 text-xs tracking-[.2em] text-[#d9bd78]">{champion.tags.join(' · ')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left text-xs text-slate-300">
                {[
                  ['攻击', champion.info.attack],
                  ['防御', champion.info.defense],
                  ['法术', champion.info.magic],
                  ['难度', champion.info.difficulty],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span className="flex justify-between"><span>{label}</span><span>{value}</span></span>
                    <span className="mt-1 block h-1.5 rounded-full bg-[#64e6dd22]">
                      <span
                        className="block h-full rounded-full bg-[#64e6dd]"
                        style={{ width: `${Number(value) * 10}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-7 grid grid-cols-5 gap-2">
                {abilities.map((ability) => (
                  <div key={ability.slot} className="min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-[#d9bd78] bg-[#102a37]">
                      <img className="h-full w-full object-cover" src={ability.iconUrl} alt="" draggable={false} />
                      <span className="absolute right-0 top-0 rounded-bl bg-[#d9bd78] px-1 text-[9px] font-bold text-[#06101b]">
                        {ability.slot}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-slate-300">{ability.name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-7 line-clamp-6 text-left text-xs leading-5 text-slate-300">{champion.lore}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CardViewer3D({
  champion,
  skin,
  className = '',
  fullscreen = false,
  onRequestFullscreen,
  onExport,
  onExportError,
}: CardViewer3DProps) {
  const descriptionId = useId();
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ViewerController | null>(null);
  const texturesRef = useRef<CardTextureCanvases | null>(null);
  const viewRef = useRef<ViewState>(initialView());
  const fallbackPointerRef = useRef<PointerSample>({ active: false, x: 0, y: 0, time: 0 });
  const fallbackRafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const [renderMode, setRenderMode] = useState<RenderMode>('loading');
  const [face, setFace] = useState<CardSide>('front');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [fallbackVersion, setFallbackVersion] = useState(0);
  const [statusMessage, setStatusMessage] = useState('正在装裱卡牌…');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotionRef.current = query.matches;
      controllerRef.current?.setReducedMotion(query.matches);
      if (query.matches && fallbackRafRef.current !== null) {
        cancelAnimationFrame(fallbackRafRef.current);
        fallbackRafRef.current = null;
      }
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    if (fallbackRafRef.current !== null) cancelAnimationFrame(fallbackRafRef.current);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const abortController = new AbortController();
    let cancelled = false;
    let release = () => {};
    const view = initialView();
    viewRef.current = view;
    controllerRef.current = null;
    texturesRef.current = null;
    setRenderMode('loading');
    setFace('front');
    setZoomPercent(100);
    setExportError(null);
    setStatusMessage('正在装裱卡牌…');

    const initialize = async () => {
      try {
        const textures = await createCardTextureCanvases(champion, skin, abortController.signal);
        if (cancelled) return;
        texturesRef.current = textures;

        const partialCleanup: Array<() => void> = [];
        const releasePartialWebgl = () => {
          while (partialCleanup.length > 0) {
            try {
              partialCleanup.pop()?.();
            } catch {
              // Best-effort cleanup for a renderer that failed during initialization.
            }
          }
        };

        try {
          const THREE = await import('three');
          if (cancelled) return;

          const renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
          });
          partialCleanup.push(() => {
            renderer.dispose();
            renderer.forceContextLoss();
            if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
          });
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.setClearColor(0x05101a, 1);
          renderer.domElement.className = 'block h-full w-full touch-none';
          renderer.domElement.setAttribute('aria-hidden', 'true');
          host.replaceChildren(renderer.domElement);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
          camera.position.set(0, 0, 8.2);

          const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          const artworkTexture = new THREE.CanvasTexture(textures.artwork);
          partialCleanup.push(() => artworkTexture.dispose());
          const depthTexture = new THREE.CanvasTexture(textures.depth);
          partialCleanup.push(() => depthTexture.dispose());
          const overlayTexture = new THREE.CanvasTexture(textures.overlay);
          partialCleanup.push(() => overlayTexture.dispose());
          const backTexture = new THREE.CanvasTexture(textures.back);
          partialCleanup.push(() => backTexture.dispose());
          for (const texture of [artworkTexture, overlayTexture, backTexture]) {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = maxAnisotropy;
          }
          depthTexture.colorSpace = THREE.NoColorSpace;
          depthTexture.minFilter = THREE.LinearFilter;
          depthTexture.magFilter = THREE.LinearFilter;
          depthTexture.generateMipmaps = false;
          const sideMaterial = new THREE.MeshStandardMaterial({
            color: 0xb89955,
            metalness: .78,
            roughness: .3,
          });
          partialCleanup.push(() => sideMaterial.dispose());
          const frontMaterial = new THREE.MeshBasicMaterial({ color: 0x06101b });
          partialCleanup.push(() => frontMaterial.dispose());
          const backMaterial = new THREE.MeshBasicMaterial({ map: backTexture });
          partialCleanup.push(() => backMaterial.dispose());
          const defaultReliefStrength = resolveReliefStrength(textures.depthConfidence, false);
          const artworkMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uArtwork: { value: artworkTexture },
              uDepth: { value: depthTexture },
              uDepthTexel: {
                value: new THREE.Vector2(1 / textures.depth.width, 1 / textures.depth.height),
              },
              uViewShift: { value: new THREE.Vector2(0, 0) },
              uViewDir: { value: new THREE.Vector3(0, 0, 1) },
              uLightDir: { value: new THREE.Vector3(.25, .32, 1).normalize() },
              uParallaxStrength: { value: defaultReliefStrength.parallax },
              uNormalStrength: { value: defaultReliefStrength.normal },
            },
            vertexShader: CARD_RELIEF_VERTEX_SHADER,
            fragmentShader: CARD_RELIEF_FRAGMENT_SHADER,
          });
          partialCleanup.push(() => artworkMaterial.dispose());
          const overlayMaterial = new THREE.MeshBasicMaterial({
            map: overlayTexture,
            transparent: true,
            depthWrite: false,
            alphaTest: .005,
            toneMapped: false,
          });
          partialCleanup.push(() => overlayMaterial.dispose());
          const geometry = new THREE.BoxGeometry(2.62, 4.62, .09, 1, 1, 1);
          partialCleanup.push(() => geometry.dispose());
          const body = new THREE.Mesh(geometry, [
            sideMaterial,
            sideMaterial,
            sideMaterial,
            sideMaterial,
            frontMaterial,
            backMaterial,
          ]);
          const artworkGeometry = new THREE.PlaneGeometry(2.58, 4.55, 1, 1);
          partialCleanup.push(() => artworkGeometry.dispose());
          const overlayGeometry = new THREE.PlaneGeometry(2.62, 4.62, 1, 1);
          partialCleanup.push(() => overlayGeometry.dispose());
          const artworkMesh = new THREE.Mesh(artworkGeometry, artworkMaterial);
          artworkMesh.position.z = .051;
          artworkMesh.renderOrder = 1;
          const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
          overlayMesh.position.z = .058;
          overlayMesh.renderOrder = 2;
          const mesh = new THREE.Group();
          mesh.add(body, artworkMesh, overlayMesh);
          mesh.rotation.order = 'XYZ';
          scene.add(mesh);
          scene.add(new THREE.HemisphereLight(0xb9ffff, 0x13202b, 2.2));
          const keyLight = new THREE.DirectionalLight(0xffe6aa, 3.4);
          keyLight.position.set(3, 4, 6);
          scene.add(keyLight);

          let disposed = false;
          let animationFrame: number | null = null;
          partialCleanup.push(() => {
            disposed = true;
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
          });
          let previousFrame = performance.now();
          let reducedMotion = reducedMotionRef.current;
          const pointer: PointerSample = { active: false, x: 0, y: 0, time: 0 };
          const worldPosition = new THREE.Vector3();
          const worldQuaternion = new THREE.Quaternion();
          const inverseQuaternion = new THREE.Quaternion();
          const localView = new THREE.Vector3();
          const localLight = new THREE.Vector3();
          const viewShiftUniform = artworkMaterial.uniforms.uViewShift!.value;
          const viewDirectionUniform = artworkMaterial.uniforms.uViewDir!.value;
          const lightDirectionUniform = artworkMaterial.uniforms.uLightDir!.value;

          const desiredRotationY = () => view.targetTiltY + (view.sideBack ? Math.PI : 0);
          const renderNow = () => {
            mesh.rotation.x = view.rotationX;
            mesh.rotation.y = view.rotationY;
            mesh.scale.setScalar(view.scale);
            mesh.updateWorldMatrix(true, true);
            mesh.getWorldPosition(worldPosition);
            mesh.getWorldQuaternion(worldQuaternion);
            inverseQuaternion.copy(worldQuaternion).invert();
            localView
              .copy(camera.position)
              .sub(worldPosition)
              .normalize()
              .applyQuaternion(inverseQuaternion);
            const reliefViewShift = resolveReliefViewShift(localView, reducedMotion);
            viewShiftUniform.set(reliefViewShift.x, reliefViewShift.y);
            localLight
              .copy(keyLight.position)
              .sub(worldPosition)
              .normalize()
              .applyQuaternion(inverseQuaternion);
            viewDirectionUniform.copy(localView);
            lightDirectionUniform.copy(localLight);
            const reliefStrength = resolveReliefStrength(textures.depthConfidence, reducedMotion);
            artworkMaterial.uniforms.uParallaxStrength!.value = reliefStrength.parallax;
            artworkMaterial.uniforms.uNormalStrength!.value = reliefStrength.normal;
            if (import.meta.env.DEV) {
              renderer.domElement.dataset.parallaxShift =
                `${viewShiftUniform.x.toFixed(3)},${viewShiftUniform.y.toFixed(3)}`;
            }
            renderer.render(scene, camera);
          };

          const tick = (now: number) => {
            animationFrame = null;
            if (disposed) return;
            const delta = Math.min(34, Math.max(1, now - previousFrame));
            previousFrame = now;

            if (!pointer.active && !reducedMotion) {
              view.targetTiltX = clamp(view.targetTiltX + view.velocityX * delta, -MAX_TILT_X, MAX_TILT_X);
              view.targetTiltY = clamp(view.targetTiltY + view.velocityY * delta, -MAX_TILT_Y, MAX_TILT_Y);
              const decay = Math.pow(.9, delta / 16.67);
              view.velocityX *= decay;
              view.velocityY *= decay;
            }

            const response = reducedMotion ? 1 : 1 - Math.pow(.0015, delta / 1000);
            view.rotationX += (view.targetTiltX - view.rotationX) * response;
            view.rotationY += (desiredRotationY() - view.rotationY) * response;
            view.scale += (view.targetScale - view.scale) * response;
            renderNow();

            const moving =
              Math.abs(view.velocityX) > .00002 ||
              Math.abs(view.velocityY) > .00002 ||
              Math.abs(view.targetTiltX - view.rotationX) > .0002 ||
              Math.abs(desiredRotationY() - view.rotationY) > .0002 ||
              Math.abs(view.targetScale - view.scale) > .0002;
            if (moving) animationFrame = requestAnimationFrame(tick);
          };

          const requestRender = () => {
            if (animationFrame === null && !disposed) {
              previousFrame = performance.now();
              animationFrame = requestAnimationFrame(tick);
            }
          };

          const resize = () => {
            if (disposed) return;
            const bounds = host.getBoundingClientRect();
            const width = Math.max(1, Math.round(bounds.width));
            const height = Math.max(1, Math.round(bounds.height));
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderNow();
          };
          const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
          resizeObserver?.observe(host);
          window.addEventListener('resize', resize);
          partialCleanup.push(() => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', resize);
          });
          resize();

          const controller: ViewerController = {
            pointerDown(x, y, time) {
              pointer.active = true;
              pointer.x = x;
              pointer.y = y;
              pointer.time = time;
              view.velocityX = 0;
              view.velocityY = 0;
            },
            pointerMove(x, y, time) {
              if (!pointer.active) return;
              const elapsed = Math.max(8, time - pointer.time);
              const deltaX = x - pointer.x;
              const deltaY = y - pointer.y;
              const nextX = clamp(view.targetTiltX + deltaY * .008, -MAX_TILT_X, MAX_TILT_X);
              const nextY = clamp(view.targetTiltY + deltaX * .008, -MAX_TILT_Y, MAX_TILT_Y);
              view.velocityX = reducedMotion ? 0 : (nextX - view.targetTiltX) / elapsed;
              view.velocityY = reducedMotion ? 0 : (nextY - view.targetTiltY) / elapsed;
              view.targetTiltX = nextX;
              view.targetTiltY = nextY;
              if (reducedMotion) {
                view.rotationX = nextX;
                view.rotationY = desiredRotationY();
              }
              pointer.x = x;
              pointer.y = y;
              pointer.time = time;
              requestRender();
            },
            pointerUp() {
              pointer.active = false;
              if (reducedMotion) {
                view.velocityX = 0;
                view.velocityY = 0;
              }
              requestRender();
            },
            toggleSide() {
              view.sideBack = !view.sideBack;
              view.velocityX = 0;
              view.velocityY = 0;
              if (reducedMotion) view.rotationY = desiredRotationY();
              requestRender();
              return view.sideBack ? 'back' : 'front';
            },
            zoomBy(amount) {
              view.targetScale = clamp(view.targetScale + amount, MIN_SCALE, MAX_SCALE);
              if (reducedMotion) view.scale = view.targetScale;
              requestRender();
              return view.targetScale;
            },
            nudge(x, y) {
              view.targetTiltX = clamp(view.targetTiltX + x, -MAX_TILT_X, MAX_TILT_X);
              view.targetTiltY = clamp(view.targetTiltY + y, -MAX_TILT_Y, MAX_TILT_Y);
              view.velocityX = 0;
              view.velocityY = 0;
              if (reducedMotion) {
                view.rotationX = view.targetTiltX;
                view.rotationY = desiredRotationY();
              }
              requestRender();
            },
            reset() {
              Object.assign(view, initialView());
              if (reducedMotion) {
                view.rotationX = view.targetTiltX;
                view.rotationY = 0;
                view.scale = 1;
              }
              requestRender();
            },
            setReducedMotion(reduced) {
              reducedMotion = reduced;
              if (reduced) {
                view.velocityX = 0;
                view.velocityY = 0;
                view.rotationX = view.targetTiltX;
                view.rotationY = desiredRotationY();
                view.scale = view.targetScale;
              }
              requestRender();
            },
            async exportPng() {
              const previousSize = renderer.getSize(new THREE.Vector2());
              const previousPixelRatio = renderer.getPixelRatio();
              const previousAspect = camera.aspect;
              try {
                renderer.setPixelRatio(1);
                renderer.setSize(EXPORT_WIDTH, EXPORT_HEIGHT, false);
                camera.aspect = EXPORT_WIDTH / EXPORT_HEIGHT;
                camera.updateProjectionMatrix();
                renderNow();
                return await canvasToBlob(renderer.domElement);
              } finally {
                renderer.setPixelRatio(previousPixelRatio);
                renderer.setSize(previousSize.x, previousSize.y, false);
                camera.aspect = previousAspect;
                camera.updateProjectionMatrix();
                renderNow();
              }
            },
          };

          controllerRef.current = controller;
          setRenderMode('webgl');
          setStatusMessage('景深卡片已就绪。拖动可观察人物与背景的立体视差，滚轮可缩放。');
          requestRender();

          release = () => {
            disposed = true;
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', resize);
            controllerRef.current = null;
            scene.remove(mesh);
            geometry.dispose();
            artworkGeometry.dispose();
            overlayGeometry.dispose();
            sideMaterial.dispose();
            frontMaterial.dispose();
            backMaterial.dispose();
            artworkMaterial.dispose();
            overlayMaterial.dispose();
            artworkTexture.dispose();
            depthTexture.dispose();
            overlayTexture.dispose();
            backTexture.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
          };
          partialCleanup.length = 0;
        } catch (webglError) {
          releasePartialWebgl();
          if (cancelled) return;
          console.info('WebGL 卡片初始化失败，已切换为 CSS 卡片。', webglError);
          setRenderMode('fallback');
          setStatusMessage('WebGL 不可用，已切换到兼容预览。');
        }
      } catch (textureError) {
        if (cancelled || (textureError instanceof DOMException && textureError.name === 'AbortError')) return;
        console.info('卡面纹理创建失败，已切换为 CSS 卡片。', textureError);
        setRenderMode('fallback');
        const message = errorFrom(textureError).message;
        setStatusMessage(`${message} 已切换到兼容预览。`);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      abortController.abort();
      release();
      controllerRef.current = null;
      texturesRef.current = null;
      host.replaceChildren();
    };
  }, [champion, skin]);

  const refreshFallback = () => setFallbackVersion((version) => version + 1);

  const stopFallbackInertia = useCallback(() => {
    if (fallbackRafRef.current !== null) {
      cancelAnimationFrame(fallbackRafRef.current);
      fallbackRafRef.current = null;
    }
  }, []);

  const startFallbackInertia = useCallback(() => {
    stopFallbackInertia();
    if (reducedMotionRef.current) return;
    let previous = performance.now();
    const step = (now: number) => {
      const view = viewRef.current;
      const delta = Math.min(34, Math.max(1, now - previous));
      previous = now;
      view.targetTiltX = clamp(view.targetTiltX + view.velocityX * delta, -MAX_TILT_X, MAX_TILT_X);
      view.targetTiltY = clamp(view.targetTiltY + view.velocityY * delta, -MAX_TILT_Y, MAX_TILT_Y);
      const decay = Math.pow(.89, delta / 16.67);
      view.velocityX *= decay;
      view.velocityY *= decay;
      setFallbackVersion((version) => version + 1);
      if (Math.abs(view.velocityX) > .00003 || Math.abs(view.velocityY) > .00003) {
        fallbackRafRef.current = requestAnimationFrame(step);
      } else {
        fallbackRafRef.current = null;
      }
    };
    fallbackRafRef.current = requestAnimationFrame(step);
  }, [stopFallbackInertia]);

  const toggleSide = () => {
    const controller = controllerRef.current;
    if (controller) {
      setFace(controller.toggleSide());
    } else {
      const view = viewRef.current;
      view.sideBack = !view.sideBack;
      view.velocityX = 0;
      view.velocityY = 0;
      setFace(view.sideBack ? 'back' : 'front');
      refreshFallback();
    }
  };

  const changeZoom = (amount: number) => {
    const controller = controllerRef.current;
    const scale = controller
      ? controller.zoomBy(amount)
      : (viewRef.current.targetScale = clamp(viewRef.current.targetScale + amount, MIN_SCALE, MAX_SCALE));
    setZoomPercent(Math.round(scale * 100));
    if (!controller) refreshFallback();
  };

  const resetView = () => {
    stopFallbackInertia();
    const controller = controllerRef.current;
    if (controller) controller.reset();
    else {
      viewRef.current = initialView();
      refreshFallback();
    }
    setFace('front');
    setZoomPercent(100);
  };

  const nudge = (x: number, y: number) => {
    const controller = controllerRef.current;
    if (controller) controller.nudge(x, y);
    else {
      const view = viewRef.current;
      view.targetTiltX = clamp(view.targetTiltX + x, -MAX_TILT_X, MAX_TILT_X);
      view.targetTiltY = clamp(view.targetTiltY + y, -MAX_TILT_Y, MAX_TILT_Y);
      view.velocityX = 0;
      view.velocityY = 0;
      refreshFallback();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    stopFallbackInertia();
    if (controllerRef.current) {
      controllerRef.current.pointerDown(event.clientX, event.clientY, event.timeStamp);
    } else {
      fallbackPointerRef.current = {
        active: true,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
      };
      viewRef.current.velocityX = 0;
      viewRef.current.velocityY = 0;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (controllerRef.current) {
      controllerRef.current.pointerMove(event.clientX, event.clientY, event.timeStamp);
      return;
    }
    const pointer = fallbackPointerRef.current;
    if (!pointer.active) return;
    const view = viewRef.current;
    const elapsed = Math.max(8, event.timeStamp - pointer.time);
    const nextX = clamp(view.targetTiltX + (event.clientY - pointer.y) * .008, -MAX_TILT_X, MAX_TILT_X);
    const nextY = clamp(view.targetTiltY + (event.clientX - pointer.x) * .008, -MAX_TILT_Y, MAX_TILT_Y);
    view.velocityX = reducedMotionRef.current ? 0 : (nextX - view.targetTiltX) / elapsed;
    view.velocityY = reducedMotionRef.current ? 0 : (nextY - view.targetTiltY) / elapsed;
    view.targetTiltX = nextX;
    view.targetTiltY = nextY;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.time = event.timeStamp;
    refreshFallback();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (controllerRef.current) controllerRef.current.pointerUp();
    else {
      fallbackPointerRef.current.active = false;
      startFallbackInertia();
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    changeZoom(-event.deltaY * .0007);
  };

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      let blob: Blob;
      if (controllerRef.current) {
        blob = await controllerRef.current.exportPng();
      } else {
        let textures = texturesRef.current;
        if (!textures) {
          textures = await createCardTextureCanvases(champion, skin);
          texturesRef.current = textures;
        }
        blob = await exportFallbackCanvas(textures, viewRef.current);
      }
      const side: CardSide = viewRef.current.sideBack ? 'back' : 'front';
      const fileName = exportFileName(champion, skin, side);
      downloadBlob(blob, fileName);
      onExport?.({ blob, fileName, width: EXPORT_WIDTH, height: EXPORT_HEIGHT, side });
      setStatusMessage(`已导出 ${fileName}`);
    } catch (value) {
      const error = errorFrom(value);
      const corsHint =
        value instanceof CardTextureError && value.sourceUrl
          ? ' 官方素材服务器未允许跨域导出，请稍后重试或打开原画。'
          : '';
      setExportError(`${error.message}${corsHint}`);
      onExportError?.(error);
    } finally {
      setIsExporting(false);
    }
  }, [champion, isExporting, onExport, onExportError, skin]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const key = event.key.toLowerCase();
    if (key === 'arrowleft') nudge(0, -.12);
    else if (key === 'arrowright') nudge(0, .12);
    else if (key === 'arrowup') nudge(-.1, 0);
    else if (key === 'arrowdown') nudge(.1, 0);
    else if (key === ' ' || key === 'f') toggleSide();
    else if (key === '+' || key === '=') changeZoom(.08);
    else if (key === '-' || key === '_') changeZoom(-.08);
    else if (key === '0' || key === 'r') resetView();
    else if (key === 'e') void handleExport();
    else return;
    event.preventDefault();
  };

  const controlsDisabled = renderMode === 'loading';
  const controlClass =
    'min-h-11 rounded-lg border border-[#d9bd7855] bg-[#0a1b27dd] px-3 text-sm text-[#f4ead7] transition hover:border-[#d9bd78] hover:bg-[#102a38] disabled:cursor-wait disabled:opacity-45';

  return (
    <section
      className={`relative ${className}`}
      aria-label={`${champion.title} ${skin.name} 卡片鉴赏`}
      data-artwork-fit={texturesRef.current?.artworkFit.mode ?? renderMode}
      data-depth-effect={renderMode === 'webgl' ? 'relief-parallax' : renderMode}
      data-depth-confidence={texturesRef.current?.depthConfidence?.toFixed(2)}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-[#d9bd7833] bg-[#05101a] shadow-[0_28px_90px_rgba(0,0,0,.46)] ${
          fullscreen ? 'h-[calc(100dvh-8.5rem)] min-h-[420px]' : 'h-[min(66vh,680px)] min-h-[430px]'
        } cursor-grab touch-none focus-visible:cursor-grabbing`}
        tabIndex={0}
        role="group"
        aria-describedby={descriptionId}
        aria-label={`可交互的${champion.title}卡片预览，当前为${face === 'front' ? '正面' : '背面'}`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div ref={canvasHostRef} className="absolute inset-0" aria-hidden="true" />
        {(renderMode === 'loading' || renderMode === 'fallback') && (
          <FallbackCard
            champion={champion}
            skin={skin}
            view={viewRef.current}
            textures={texturesRef.current ?? undefined}
          />
        )}
        {renderMode === 'loading' && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#d9bd7855] bg-[#04111bd9] px-3 py-1 text-[11px] tracking-[.12em] text-[#ead79f]">
            正在装裱 3D 卡面…
          </span>
        )}
        {renderMode === 'fallback' && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#64e6dd55] bg-[#04111bd9] px-3 py-1 text-[11px] text-[#8bece6]">
            兼容预览
          </span>
        )}
      </div>

      <p id={descriptionId} className="sr-only">
        预览获得焦点后，可用方向键旋转，F 或空格翻面，加减号缩放，R 重置，E 导出 PNG。
      </p>

      <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#d9bd7833] bg-[#06121eef] p-2 shadow-xl backdrop-blur">
        <button type="button" className={controlClass} onClick={toggleSide} disabled={controlsDisabled} aria-pressed={face === 'back'}>
          {face === 'front' ? '查看背面' : '查看正面'}
        </button>
        <button type="button" className={controlClass} onClick={() => changeZoom(-.1)} disabled={controlsDisabled} aria-label="缩小卡片">
          −
        </button>
        <output className="min-w-14 text-center text-xs tabular-nums text-slate-400" aria-label="当前缩放比例">
          {zoomPercent}%
        </output>
        <button type="button" className={controlClass} onClick={() => changeZoom(.1)} disabled={controlsDisabled} aria-label="放大卡片">
          ＋
        </button>
        <button type="button" className={controlClass} onClick={resetView} disabled={controlsDisabled}>
          重置视角
        </button>
        <button type="button" className={controlClass} onClick={() => void handleExport()} disabled={controlsDisabled || isExporting}>
          {isExporting ? '正在导出…' : '下载 PNG'}
        </button>
        {onRequestFullscreen && (
          <button
            type="button"
            className={`${controlClass} sm:ml-auto`}
            onClick={onRequestFullscreen}
            aria-pressed={fullscreen}
            disabled={controlsDisabled}
          >
            {fullscreen ? '退出专注' : '全屏专注'}
          </button>
        )}
      </div>

      <p className="mt-2 min-h-5 text-xs text-slate-500" role="status" aria-live="polite">
        {statusMessage} {renderMode !== 'loading' && `当前${face === 'front' ? '正面' : '背面'}，缩放 ${zoomPercent}%。`}
      </p>
      {exportError && (
        <p className="mt-2 rounded-lg border border-red-400/25 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
          {exportError}{' '}
          <a className="underline underline-offset-2" href={skin.splashUrl || skin.loadingUrl} target="_blank" rel="noreferrer">
            打开官方原画
          </a>
        </p>
      )}
    </section>
  );
}

export default CardViewer3D;
