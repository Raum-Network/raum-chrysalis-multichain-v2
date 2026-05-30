import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import type { MascotState } from '../lib/mascot';

type ChrysalisRobotMascotProps = {
  className?: string;
  state: MascotState;
};

type Orbiter = {
  angle: number;
  height: number;
  mesh: THREE.Mesh;
  radius: number;
  speed: number;
  tilt: number;
  phase: number;
};

type ConnectionLine = {
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  mesh: THREE.LineSegments;
  srcIndices: number[];
  dstIndices: number[];
};

type SceneProfile = {
  accent: string;
  bloom: number;
  glitch: number;
  primary: string;
  pulse: number;
  ringSpeed: number;
  secondary: string;
  shake: number;
  waveAmp: number;
  waveSpeed: number;
};

type RuntimeTuning = {
  accent: THREE.Color;
  bloom: number;
  glitch: number;
  primary: THREE.Color;
  pulse: number;
  ringSpeed: number;
  secondary: THREE.Color;
  shake: number;
  waveAmp: number;
  waveSpeed: number;
};

type SceneBundle = {
  bloomPass: UnrealBloomPass;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  composer: EffectComposer;
  connections: ConnectionLine;
  core: THREE.Mesh;
  coreGlow: THREE.Mesh;
  coreWire: THREE.LineSegments;
  fountain: THREE.Points;
  fountainMeta: Float32Array;
  glitchPass: GlitchPass;
  groundGrid: THREE.Mesh;
  groundWave: THREE.Mesh;
  groundWavePos: THREE.BufferAttribute;
  groundWaveMeta: Float32Array;
  orbiters: Orbiter[];
  particleRing: THREE.Points;
  pulseLight: THREE.PointLight;
  renderer: THREE.WebGLRenderer;
  rimLight: THREE.PointLight;
  scene: THREE.Scene;
  stage: THREE.Group;
  waveColors: THREE.BufferAttribute;
};

const tmpColor = new THREE.Color();
const tmpVec3 = new THREE.Vector3();

const sceneProfiles: Record<MascotState, SceneProfile> = {
  idle: {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.55, pulse: 0.18, ringSpeed: 0.38, shake: 0, glitch: 0,
    waveAmp: 0.24, waveSpeed: 0.9,
  },
  'mouse-follow': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.55, pulse: 0.22, ringSpeed: 0.42, shake: 0, glitch: 0,
    waveAmp: 0.26, waveSpeed: 1,
  },
  'terminal-listening': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.65, pulse: 0.34, ringSpeed: 0.56, shake: 0, glitch: 0,
    waveAmp: 0.34, waveSpeed: 1.3,
  },
  thinking: {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.75, pulse: 0.46, ringSpeed: 0.78, shake: 0.02, glitch: 0.35,
    waveAmp: 0.42, waveSpeed: 1.7,
  },
  'answer-ready': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.9, pulse: 0.7, ringSpeed: 0.94, shake: 0, glitch: 0,
    waveAmp: 0.48, waveSpeed: 2,
  },
  'transaction-start': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.8, pulse: 0.62, ringSpeed: 0.92, shake: 0.02, glitch: 0.2,
    waveAmp: 0.46, waveSpeed: 2.1,
  },
  'staking-action': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.95, pulse: 0.82, ringSpeed: 1.2, shake: 0.03, glitch: 0.15,
    waveAmp: 0.52, waveSpeed: 2.5,
  },
  'pending-transaction': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.75, pulse: 0.56, ringSpeed: 1.02, shake: 0.02, glitch: 0.1,
    waveAmp: 0.5, waveSpeed: 2.25,
  },
  'staking-success': {
    primary: '#27a17a', secondary: '#42c89f', accent: '#196b51',
    bloom: 1.05, pulse: 0.95, ringSpeed: 1.28, shake: 0, glitch: 0,
    waveAmp: 0.58, waveSpeed: 2.9,
  },
  error: {
    primary: '#c24d4d', secondary: '#e67373', accent: '#8f3333',
    bloom: 0.6, pulse: 0.26, ringSpeed: 0.44, shake: 0.14, glitch: 0.9,
    waveAmp: 0.56, waveSpeed: 1.5,
  },
  'bridge-cross-chain': {
    primary: '#107a6e', secondary: '#60a59d', accent: '#0a5c53',
    bloom: 0.9, pulse: 0.72, ringSpeed: 1.1, shake: 0.01, glitch: 0,
    waveAmp: 0.52, waveSpeed: 2.55,
  },
  'reward-claim': {
    primary: '#d78c36', secondary: '#fcae55', accent: '#a1631f',
    bloom: 0.95, pulse: 0.78, ringSpeed: 1.05, shake: 0, glitch: 0,
    waveAmp: 0.48, waveSpeed: 2.35,
  },
};

function createSpriteTexture(innerColor = 'rgba(255,255,255,0.8)', midColor = 'rgba(96,165,157,0.8)', outerColor = 'rgba(16,122,110,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.22, midColor);
  gradient.addColorStop(0.5, 'rgba(16,122,110,0.25)');
  gradient.addColorStop(1, outerColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCore() {
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      color: '#d9fbff',
      emissive: '#7cfdf0',
      emissiveIntensity: 1.2,
      metalness: 0.12,
      roughness: 0.14,
      transmission: 0.06,
    }),
  );

  const coreGlow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.4, 1),
    new THREE.MeshBasicMaterial({
      color: '#7cfdf0',
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.06,
      transparent: true,
      wireframe: true,
    }),
  );

  const coreWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.25, 1)),
    new THREE.LineBasicMaterial({
      color: '#dfffee',
      transparent: true,
      opacity: 0.6,
    }),
  );

  return { core, coreGlow, coreWire };
}

function createOrbiters() {
  const orbiters: Orbiter[] = [];
  const geos = [
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.TetrahedronGeometry(0.12, 0),
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.IcosahedronGeometry(0.09, 0),
  ];

  const rings = [
    { count: 12, radiusMin: 1.8, radiusMax: 2.2, heightSpread: 1.2, speedBase: 0.5 },
    { count: 10, radiusMin: 2.6, radiusMax: 3.1, heightSpread: 1.8, speedBase: 0.32 },
    { count: 8, radiusMin: 3.4, radiusMax: 3.9, heightSpread: 2.4, speedBase: 0.2 },
  ];

  rings.forEach((ring) => {
    for (let i = 0; i < ring.count; i += 1) {
      const geo = geos[i % geos.length];
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: '#91fff0',
          emissive: '#6be7ff',
          emissiveIntensity: 2.0 + Math.random() * 1.0,
          metalness: 0.2,
          roughness: 0.2,
        }),
      );
      orbiters.push({
        angle: Math.random() * Math.PI * 2,
        height: THREE.MathUtils.randFloatSpread(ring.heightSpread),
        mesh,
        radius: THREE.MathUtils.lerp(ring.radiusMin, ring.radiusMax, Math.random()),
        speed: ring.speedBase * (0.7 + Math.random() * 0.6),
        tilt: THREE.MathUtils.randFloatSpread(0.6),
        phase: Math.random() * Math.PI * 2,
      });
    }
  });

  return orbiters;
}

function createParticleRing(sprite: THREE.Texture) {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const radius = THREE.MathUtils.lerp(2.6, 4.2, Math.random());
    const angle = Math.random() * Math.PI * 2;
    const spread = THREE.MathUtils.randFloatSpread(0.35);
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = spread;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    sizes[i] = THREE.MathUtils.lerp(0.04, 0.12, Math.random());
    const c = new THREE.Color().setHSL(0.44, 0.5, 0.5 + Math.random() * 0.3);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: sprite,
    size: 0.08,
    transparent: true,
    vertexColors: true,
    opacity: 0.7,
  });

  const points = new THREE.Points(geometry, material);
  points.position.y = -0.6;
  return points;
}

function createGroundWave(sprite: THREE.Texture) {
  const size = 6;
  const segments = 48;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI * 0.5);
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;
  const meta = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    meta[i * 3] = x;
    meta[i * 3 + 1] = z;
    meta[i * 3 + 2] = Math.sqrt(x * x + z * z);
  }

  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = 0.1;
    colors[i * 3 + 1] = 0.5;
    colors[i * 3 + 2] = 0.45;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: '#107a6e',
      depthWrite: false,
      opacity: 0.15 + Math.random() * 0.05,
      transparent: true,
      vertexColors: true,
      wireframe: false,
    }),
  );
  mesh.position.y = -2.6;

  const gridMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.2, size * 1.2, 24, 24),
    new THREE.MeshBasicMaterial({
      color: '#60a59d',
      depthWrite: false,
      opacity: 0.06,
      transparent: true,
      wireframe: true,
    }),
  );
  gridMesh.rotation.x = -Math.PI * 0.5;
  gridMesh.position.y = -2.55;

  return { mesh, gridMesh, pos: pos as THREE.BufferAttribute, meta };
}

function createFountain(sprite: THREE.Texture) {
  const count = 400;
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(1.2);
    positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(0.5);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(1.2);
    meta[i * 4] = positions[i * 3];
    meta[i * 4 + 1] = Math.random() * 3 + 1;
    meta[i * 4 + 2] = 0.3 + Math.random() * 0.7;
    meta[i * 4 + 3] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      alphaTest: 0.01,
      blending: THREE.AdditiveBlending,
      color: '#7cfdf0',
      depthWrite: false,
      map: sprite,
      opacity: 0.5,
      size: 0.06,
      transparent: true,
    }),
  );
  return { meta, points };
}

function createConnectionNetwork(orbiters: Orbiter[], maxDist: number) {
  const orbiterCount = orbiters.length;
  const totalLines = orbiterCount * (orbiterCount - 1) / 2;
  const positions = new Float32Array(totalLines * 6);
  const colors = new Float32Array(totalLines * 6);
  const srcIndices: number[] = [];
  const dstIndices: number[] = [];
  let idx = 0;

  for (let i = 0; i < orbiterCount; i += 1) {
    for (let j = i + 1; j < orbiterCount; j += 1) {
      srcIndices.push(i);
      dstIndices.push(j);
      positions[idx * 6] = 0;
      positions[idx * 6 + 1] = 0;
      positions[idx * 6 + 2] = 0;
      positions[idx * 6 + 3] = 0;
      positions[idx * 6 + 4] = 0;
      positions[idx * 6 + 5] = 0;
      colors[idx * 6] = 0.4;
      colors[idx * 6 + 1] = 0.9;
      colors[idx * 6 + 2] = 0.85;
      colors[idx * 6 + 3] = 0.4;
      colors[idx * 6 + 4] = 0.9;
      colors[idx * 6 + 5] = 0.85;
      idx += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.25,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.LineSegments(geometry, material);
  return { geometry, material, mesh, srcIndices, dstIndices, maxDist };
}

function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer, composer: EffectComposer) {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh.material ?? null) as THREE.Material | THREE.Material[] | null;
    if (Array.isArray(mat)) mat.forEach((entry) => entry.dispose());
    else mat?.dispose();
  });
  composer.dispose();
  renderer.dispose();
}

function setMaterialTint(material: THREE.Material, primary: THREE.Color, secondary: THREE.Color, intensity: number) {
  const target = material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.LineBasicMaterial;
  if ('color' in target && target.color) target.color.copy(primary);
  if ('emissive' in target && target.emissive) target.emissive.copy(secondary);
  if ('emissiveIntensity' in target) target.emissiveIntensity = intensity;
}

function getKickForState(state: MascotState) {
  switch (state) {
    case 'answer-ready':
    case 'staking-success':
      return 0.95;
    case 'staking-action':
    case 'reward-claim':
    case 'bridge-cross-chain':
      return 0.72;
    case 'transaction-start':
    case 'pending-transaction':
    case 'thinking':
      return 0.48;
    case 'error':
      return 0.28;
    default:
      return 0.18;
  }
}

const connColorTmp = new THREE.Color();

export default function ChrysalisRobotMascot({ className = '', state }: ChrysalisRobotMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneBundle | null>(null);
  const frameRef = useRef<number | null>(null);
  const pulseRef = useRef(0.2);
  const currentStateRef = useRef<MascotState>(state);
  const pointerRef = useRef({ currentX: 0, currentY: 0, targetX: 0, targetY: 0 });
  const runtimeRef = useRef<RuntimeTuning>({
    accent: new THREE.Color(sceneProfiles.idle.accent),
    bloom: sceneProfiles.idle.bloom,
    glitch: 0,
    primary: new THREE.Color(sceneProfiles.idle.primary),
    pulse: sceneProfiles.idle.pulse,
    ringSpeed: sceneProfiles.idle.ringSpeed,
    secondary: new THREE.Color(sceneProfiles.idle.secondary),
    shake: 0,
    waveAmp: sceneProfiles.idle.waveAmp,
    waveSpeed: sceneProfiles.idle.waveSpeed,
  });

  useEffect(() => {
    currentStateRef.current = state;
    pulseRef.current = Math.max(pulseRef.current, getKickForState(state));
  }, [state]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#041014', 0.045);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.35, 8.2);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.85, 0.1);
    composer.addPass(bloomPass);
    const glitchPass = new GlitchPass();
    glitchPass.goWild = false;
    glitchPass.enabled = false;
    composer.addPass(glitchPass);

    const ambient = new THREE.HemisphereLight('#8dfdf0', '#031116', 1.35);
    const pulseLight = new THREE.PointLight('#7cfdf0', 38, 18, 2);
    pulseLight.position.set(0, 0, 1.2);
    const rimLight = new THREE.PointLight('#60a59d', 14, 20, 2);
    rimLight.position.set(-4.8, 3.2, 6.6);
    scene.add(ambient, pulseLight, rimLight);

    const sprite = createSpriteTexture();
    const stage = new THREE.Group();
    scene.add(stage);

    const { core, coreGlow, coreWire } = createCore();
    stage.add(core, coreGlow, coreWire);

    const orbiters = createOrbiters();
    orbiters.forEach((o) => stage.add(o.mesh));

    const particleRing = createParticleRing(sprite);
    stage.add(particleRing);

    const { mesh: groundWave, gridMesh, pos: groundWavePos, meta: groundWaveMeta } = createGroundWave(sprite);
    stage.add(groundWave);
    stage.add(gridMesh);

    const { meta: fountainMeta, points: fountain } = createFountain(sprite);
    stage.add(fountain);

    const connections = createConnectionNetwork(orbiters, 3.5);
    stage.add(connections.mesh);

    const bundle: SceneBundle = {
      bloomPass,
      camera,
      clock: new THREE.Clock(),
      composer,
      connections,
      core,
      coreGlow,
      coreWire,
      fountain,
      fountainMeta,
      glitchPass,
      groundGrid: gridMesh,
      groundWave,
      groundWavePos,
      groundWaveMeta,
      orbiters,
      particleRing,
      pulseLight,
      renderer,
      rimLight,
      scene,
      stage,
      waveColors: groundWave.geometry.getAttribute('color') as THREE.BufferAttribute,
    };
    sceneRef.current = bundle;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate);
      const cur = sceneRef.current;
      if (!cur) return;

      const delta = Math.min(cur.clock.getDelta(), 0.05);
      const elapsed = cur.clock.elapsedTime;
      const targetProfile = sceneProfiles[currentStateRef.current];
      const rt = runtimeRef.current;

      rt.primary.lerp(tmpColor.set(targetProfile.primary), 0.075);
      rt.secondary.lerp(tmpColor.set(targetProfile.secondary), 0.075);
      rt.accent.lerp(tmpColor.set(targetProfile.accent), 0.075);
      rt.bloom = THREE.MathUtils.lerp(rt.bloom, targetProfile.bloom, 0.075);
      rt.pulse = THREE.MathUtils.lerp(rt.pulse, targetProfile.pulse, 0.075);
      rt.ringSpeed = THREE.MathUtils.lerp(rt.ringSpeed, targetProfile.ringSpeed, 0.075);
      rt.shake = THREE.MathUtils.lerp(rt.shake, targetProfile.shake, 0.1);
      rt.glitch = THREE.MathUtils.lerp(rt.glitch, targetProfile.glitch, 0.08);
      rt.waveAmp = THREE.MathUtils.lerp(rt.waveAmp, targetProfile.waveAmp, 0.075);
      rt.waveSpeed = THREE.MathUtils.lerp(rt.waveSpeed, targetProfile.waveSpeed, 0.075);

      pointerRef.current.currentX += (pointerRef.current.targetX - pointerRef.current.currentX) * 0.06;
      pointerRef.current.currentY += (pointerRef.current.targetY - pointerRef.current.currentY) * 0.06;
      pulseRef.current = Math.max(0.05, pulseRef.current - delta * 0.28);
      const pulseWave = Math.sin(elapsed * (1.8 + rt.waveSpeed * 0.18)) * 0.5 + 0.5;
      const energy = rt.pulse + pulseRef.current * 0.82;

      cur.bloomPass.strength = rt.bloom + pulseRef.current * 0.66;
      cur.bloomPass.radius = 0.75 + rt.pulse * 0.1;
      cur.bloomPass.threshold = 0.08;

      if (rt.glitch > 0.01) {
        cur.glitchPass.enabled = true;
        cur.glitchPass.goWild = rt.glitch > 0.6;
        (cur.glitchPass as any).curF = Math.min(1, rt.glitch * 1.2);
      } else {
        cur.glitchPass.enabled = false;
      }

      ambient.color.copy(rt.primary);
      ambient.groundColor.copy(rt.accent).multiplyScalar(0.2);
      ambient.intensity = 1.2 + energy * 0.32;
      pulseLight.color.copy(rt.secondary);
      pulseLight.intensity = 26 + energy * 22;
      pulseLight.distance = 17 + energy * 4;
      const rimMat = rimLight as THREE.PointLight;
      rimMat.color.copy(rt.accent);

      const px = pointerRef.current.currentX;
      const py = pointerRef.current.currentY;
      stage.position.x = px * 0.42 + Math.sin(elapsed * 0.4) * 0.08;
      stage.position.y = py * -0.28 + Math.sin(elapsed * 1.1) * 0.12;
      stage.position.z = Math.sin(elapsed * 0.55) * 0.16;
      stage.rotation.x = py * 0.12 + Math.sin(elapsed * 0.6) * 0.04;
      stage.rotation.y = px * 0.24 + Math.sin(elapsed * 0.38) * 0.08;
      stage.rotation.z = Math.sin(elapsed * 0.22) * 0.04;

      if (rt.shake > 0.001) {
        stage.position.x += Math.sin(elapsed * 27) * rt.shake * 0.18;
        stage.position.y += Math.cos(elapsed * 22) * rt.shake * 0.14;
      }

      // Core
      core.rotation.x += delta * (0.4 + rt.ringSpeed * 0.34);
      core.rotation.y += delta * (0.58 + rt.ringSpeed * 0.42);
      const coreScale = 1 + pulseWave * 0.08 + energy * 0.05;
      core.scale.setScalar(coreScale);
      setMaterialTint(core.material, rt.primary, rt.secondary, 1.4 + energy * 0.9);

      coreGlow.rotation.x -= delta * 0.15;
      coreGlow.rotation.z += delta * 0.22;
      coreGlow.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.04 + energy * 0.06);
      (coreGlow.material as THREE.MeshBasicMaterial).color.copy(rt.secondary);
      (coreGlow.material as THREE.MeshBasicMaterial).opacity = 0.06 + energy * 0.08;

      const wireMat = coreWire.material as THREE.LineBasicMaterial;
      wireMat.color.copy(rt.secondary);
      wireMat.opacity = 0.4 + energy * 0.35;
      coreWire.rotation.x -= delta * 0.2;
      coreWire.rotation.y -= delta * 0.24;

      // Orbiters
      const orbiterPositions: THREE.Vector3[] = [];
      cur.orbiters.forEach((orb, index) => {
        const orbitalSpeed = orb.speed * (0.4 + rt.ringSpeed * 0.7);
        const angle = orb.angle + elapsed * orbitalSpeed * (index % 2 === 0 ? 1 : -1);
        const yWave = orb.height + Math.sin(elapsed * 1.4 + orb.phase) * 0.4 * rt.waveAmp;
        const r = orb.radius * (1 + Math.sin(elapsed * 0.3 + orb.phase) * 0.04);
        orb.mesh.position.set(
          Math.cos(angle + orb.tilt) * r,
          yWave,
          Math.sin(angle) * r * 0.78,
        );
        orb.mesh.rotation.x += delta * orbitalSpeed * 0.9;
        orb.mesh.rotation.y += delta * orbitalSpeed * 1.1;
        orb.mesh.rotation.z += delta * orbitalSpeed * 0.5;
        const orbScale = 0.8 + pulseWave * 0.25 + (index % 3) * 0.04;
        orb.mesh.scale.setScalar(orbScale);
        setMaterialTint(orb.mesh.material, rt.primary, rt.secondary, 1.0 + energy * 0.7);
        orbiterPositions.push(orb.mesh.position.clone());
      });

      // Connection network
      const connPos = cur.connections.geometry.getAttribute('position') as THREE.BufferAttribute;
      const connColor = cur.connections.geometry.getAttribute('color') as THREE.BufferAttribute;
      const connArr = connPos.array as Float32Array;
      const colArr = connColor.array as Float32Array;
      let visibleCount = 0;
      const corePos = new THREE.Vector3(0, 0, 0);

      for (let k = 0; k < cur.connections.srcIndices.length; k += 1) {
        const i = cur.connections.srcIndices[k];
        const j = cur.connections.dstIndices[k];
        const a = orbiterPositions[i];
        const b = orbiterPositions[j];
        const dist = a.distanceTo(b);

        if (dist < cur.connections.maxDist * (0.7 + rt.pulse * 0.3)) {
          const alpha = 1 - dist / cur.connections.maxDist;
          connArr[visibleCount * 6] = a.x;
          connArr[visibleCount * 6 + 1] = a.y;
          connArr[visibleCount * 6 + 2] = a.z;
          connArr[visibleCount * 6 + 3] = b.x;
          connArr[visibleCount * 6 + 4] = b.y;
          connArr[visibleCount * 6 + 5] = b.z;

          connColorTmp.copy(rt.secondary).lerp(rt.primary, alpha * 0.5);
          colArr[visibleCount * 6] = connColorTmp.r * alpha;
          colArr[visibleCount * 6 + 1] = connColorTmp.g * alpha;
          colArr[visibleCount * 6 + 2] = connColorTmp.b * alpha;
          colArr[visibleCount * 6 + 3] = connColorTmp.r * alpha * 0.6;
          colArr[visibleCount * 6 + 4] = connColorTmp.g * alpha * 0.6;
          colArr[visibleCount * 6 + 5] = connColorTmp.b * alpha * 0.6;
          visibleCount += 1;
        }
      }

      // Also connect nearest orbiter to core
      if (orbiterPositions.length > 0) {
        let nearestDist = Infinity;
        let nearestOrb = orbiterPositions[0];
        for (const op of orbiterPositions) {
          const d = op.distanceTo(corePos);
          if (d < nearestDist) { nearestDist = d; nearestOrb = op; }
        }
        if (nearestDist < 4) {
          const alpha = 1 - nearestDist / 4;
          connArr[visibleCount * 6] = 0;
          connArr[visibleCount * 6 + 1] = 0;
          connArr[visibleCount * 6 + 2] = 0;
          connArr[visibleCount * 6 + 3] = nearestOrb.x;
          connArr[visibleCount * 6 + 4] = nearestOrb.y;
          connArr[visibleCount * 6 + 5] = nearestOrb.z;
          const ca = rt.secondary.r * alpha * 0.5;
          colArr[visibleCount * 6] = ca;
          colArr[visibleCount * 6 + 1] = rt.secondary.g * alpha * 0.5;
          colArr[visibleCount * 6 + 2] = rt.secondary.b * alpha * 0.5;
          colArr[visibleCount * 6 + 3] = ca * 0.4;
          colArr[visibleCount * 6 + 4] = rt.secondary.g * alpha * 0.4;
          colArr[visibleCount * 6 + 5] = rt.secondary.b * alpha * 0.4;
          visibleCount += 1;
        }
      }

      connPos.needsUpdate = true;
      connColor.needsUpdate = true;
      cur.connections.geometry.setDrawRange(0, visibleCount * 2);
      cur.connections.material.opacity = 0.15 + rt.pulse * 0.2;

      // Particle ring
      const ringPos = cur.particleRing.geometry.getAttribute('position') as THREE.BufferAttribute;
      const ringArr = ringPos.array as Float32Array;
      const ringCount = ringArr.length / 3;
      for (let i = 0; i < ringCount; i += 1) {
        const x = ringArr[i * 3];
        const baseAngle = Math.atan2(ringArr[i * 3 + 2], ringArr[i * 3]);
        const newAngle = baseAngle + delta * rt.ringSpeed * 0.12 * (i % 2 === 0 ? 1 : -1);
        const radius = Math.sqrt(x * x + ringArr[i * 3 + 2] * ringArr[i * 3 + 2]);
        ringArr[i * 3] = Math.cos(newAngle) * radius;
        ringArr[i * 3 + 2] = Math.sin(newAngle) * radius;
        ringArr[i * 3 + 1] += Math.sin(elapsed * 0.5 + i * 0.01) * delta * 0.1;
      }
      ringPos.needsUpdate = true;
      const ringMat = cur.particleRing.material as THREE.PointsMaterial;
      ringMat.color.copy(rt.secondary);
      ringMat.size = 0.06 + energy * 0.04;

      // Ground wave — vertex displacement inspired by three.js webgl_shaders_ocean
      const gPos = cur.groundWavePos;
      const gArr = gPos.array as Float32Array;
      const gCol = cur.waveColors.array as Float32Array;
      for (let i = 0; i < cur.groundWaveMeta.length / 3; i += 1) {
        const x = cur.groundWaveMeta[i * 3];
        const z = cur.groundWaveMeta[i * 3 + 1];
        const dist = cur.groundWaveMeta[i * 3 + 2];
        const wave =
          Math.sin(dist * 1.6 - elapsed * rt.waveSpeed * 2.2) * rt.waveAmp * 0.2
          + Math.cos((x * 0.7 + z * 1.0) * 0.8 + elapsed * rt.waveSpeed * 1.1) * rt.waveAmp * 0.1;
        gArr[i * 3 + 1] = wave;

        const mix = THREE.MathUtils.clamp((wave / Math.max(rt.waveAmp * 0.3, 0.01) + 1) * 0.5, 0, 1);
        gCol[i * 3] = rt.primary.r + (rt.secondary.r - rt.primary.r) * mix;
        gCol[i * 3 + 1] = rt.primary.g + (rt.secondary.g - rt.primary.g) * mix;
        gCol[i * 3 + 2] = rt.primary.b + (rt.accent.b - rt.primary.b) * mix * 0.6;
      }
      gPos.needsUpdate = true;
      cur.waveColors.needsUpdate = true;
      (cur.groundWave.material as THREE.MeshBasicMaterial).color.copy(rt.primary);
      (cur.groundWave.material as THREE.MeshBasicMaterial).opacity = 0.1 + energy * 0.08;
      cur.groundGrid.material.opacity = 0.04 + rt.pulse * 0.04;
      (cur.groundGrid.material as THREE.MeshBasicMaterial).color.copy(rt.secondary);

      // Fountain particles
      const fPos = cur.fountain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const fArr = fPos.array as Float32Array;
      for (let i = 0; i < cur.fountainMeta.length / 4; i += 1) {
        const originX = cur.fountainMeta[i * 4];
        const maxH = cur.fountainMeta[i * 4 + 1];
        const spd = cur.fountainMeta[i * 4 + 2];
        const phase = cur.fountainMeta[i * 4 + 3];
        const t = (elapsed * spd * (0.3 + rt.ringSpeed * 0.2) + phase) % 1;
        const height = t * maxH;
        const spread = Math.sin(t * Math.PI) * 0.4 * (1 + rt.pulse * 0.5);
        fArr[i * 3] = originX + Math.sin(phase + elapsed * 0.5) * spread;
        fArr[i * 3 + 1] = height;
        fArr[i * 3 + 2] = Math.cos(phase + elapsed * 0.4) * spread;
      }
      fPos.needsUpdate = true;
      const fMat = cur.fountain.material as THREE.PointsMaterial;
      fMat.color.copy(rt.secondary);
      fMat.opacity = 0.2 + energy * 0.25;
      fMat.size = 0.04 + energy * 0.03;

      // Camera
      camera.position.x = px * 0.36;
      camera.position.y = 0.3 + py * -0.2;
      camera.lookAt(0, 0.1, 0);

      cur.composer.render();
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      disposeScene(scene, renderer, composer);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerRef.current.targetX = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointerRef.current.targetY = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={hostRef}
      className={`robot-mascot-dock pointer-events-none relative h-full w-full overflow-hidden rounded-[26px] border border-cyan-100/20 bg-[#041014] shadow-[0_26px_64px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(124,253,240,0.16),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(182,156,255,0.14),transparent_24%),radial-gradient(circle_at_32%_74%,rgba(255,211,123,0.08),transparent_26%),linear-gradient(180deg,#0a1c22_0%,#041014_54%,#020709_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.024)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:30px_30px] opacity-45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,253,240,0.12),transparent_48%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-inset ring-cyan-100/15" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/25 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-50/70">
        chrysalis field
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full border border-cyan-100/10 bg-black/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100/55">
        {state.replaceAll('-', ' ')}
      </div>
    </div>
  );
}
