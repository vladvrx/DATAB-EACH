import {
  aT as Vector2,
  b5 as Mesh,
  b6 as BufferAttribute,
  b7 as BufferGeometry,
  br as RawShaderMaterial,
  cM as Scene,
  cg as OrthographicCamera,
  ct as Texture,
} from "../../vendor/vendor.75f6e6ae65453426.js";

const LINEAR_FILTER = 1006;
const CLAMP_TO_EDGE = 1001;
const RGBA_FORMAT = 1023;

const VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D tColor;
uniform vec2 uTexel;
varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 color = texture2D(tColor, vUv).rgb;
  float c = luma(color);
  float l = luma(texture2D(tColor, vUv + vec2(-uTexel.x, 0.0)).rgb);
  float r = luma(texture2D(tColor, vUv + vec2( uTexel.x, 0.0)).rgb);
  float d = luma(texture2D(tColor, vUv + vec2(0.0, -uTexel.y)).rgb);
  float u = luma(texture2D(tColor, vUv + vec2(0.0,  uTexel.y)).rgb);
  float edge = smoothstep(0.04, 0.12, abs(r - l) + abs(u - d));
  float neon = color.g - max(color.r, color.b);
  edge *= 1.0 - step(0.45, neon) * step(0.58, color.g) * 0.85;
  gl_FragColor = vec4(0.0, 0.0, 0.0, edge);
}
`;

class FramebufferTexture extends Texture {
  constructor(width, height) {
    super({ width, height });
    this.isFramebufferTexture = true;
    this.format = RGBA_FORMAT;
    this.magFilter = LINEAR_FILTER;
    this.minFilter = LINEAR_FILTER;
    this.wrapS = CLAMP_TO_EDGE;
    this.wrapT = CLAMP_TO_EDGE;
    this.generateMipmaps = false;
    this.flipY = false;
    this.needsUpdate = true;
  }
}

function drawingSize(webgl, renderer) {
  const size = webgl?.renderer?.drawingBufferSize?.value;
  if (size?.x && size?.y) return { width: Math.max(1, size.x | 0), height: Math.max(1, size.y | 0) };
  const fallback = new Vector2();
  renderer.getDrawingBufferSize(fallback);
  return { width: Math.max(1, fallback.x | 0), height: Math.max(1, fallback.y | 0) };
}

function attachOutline(webgl, renderer) {
  if (renderer.__toonOutlinePass) return renderer.__toonOutlinePass;
  if (typeof renderer.copyFramebufferToTexture !== "function") return null;

  const color = new FramebufferTexture(1, 1);
  const origin = new Vector2(0, 0);
  const uniforms = {
    tColor: { value: color },
    uTexel: { value: new Vector2(1, 1) },
  };
  const material = new RawShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    -1, -1, 0, 3, -1, 0, -1, 3, 0,
  ]), 3));
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  const overlay = new Scene();
  overlay.add(mesh);
  const overlayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const originalRender = renderer.render.bind(renderer);
  let stamping = false;
  let disabled = false;
  let width = 0;
  let height = 0;

  function resize() {
    const next = drawingSize(webgl, renderer);
    if (next.width === width && next.height === height) return;
    width = next.width;
    height = next.height;
    color.image.width = width;
    color.image.height = height;
    color.needsUpdate = true;
    uniforms.uTexel.value.set(1 / width, 1 / height);
  }

  renderer.render = function toonOutlineRender(sceneObject, cameraObject) {
    originalRender(sceneObject, cameraObject);
    if (disabled || stamping) return;
    if (this.getRenderTarget()) return;
    if (sceneObject === overlay) return;
    try {
      resize();
      this.copyFramebufferToTexture(origin, color);
      stamping = true;
      const previousAutoClear = this.autoClear;
      this.autoClear = false;
      originalRender(overlay, overlayCamera);
      this.autoClear = previousAutoClear;
      stamping = false;
    } catch (error) {
      stamping = false;
      disabled = true;
      this.render = originalRender;
      console.warn("Cartoon outline disabled", error);
    }
  };

  webgl.renderer?.drawingBufferSize?.watch?.(() => {
    width = 0;
    height = 0;
  });

  const api = { attached: true, kind: "overlay" };
  renderer.__toonOutlinePass = api;
  webgl.toonOutline = api;
  window.__TOON_OUTLINE__ = api;
  return api;
}

export function installCartoonOutline(webgl) {
  if (!webgl) return null;
  if (webgl.toonOutline?.attached) return webgl.toonOutline;

  const tryAttach = () => {
    const renderer = webgl.threeRenderer || webgl.renderer?.instance;
    if (!renderer || typeof renderer.render !== "function") return false;
    try {
      attachOutline(webgl, renderer);
      return !!webgl.toonOutline?.attached;
    } catch (error) {
      console.warn("Cartoon outline skipped", error);
      return true;
    }
  };

  if (tryAttach()) return webgl.toonOutline;
  webgl.hooks?.afterInit?.watchOnce?.(tryAttach);
  webgl.renderer?.hooks?.afterInit?.watchOnce?.(tryAttach);
  const timer = window.setInterval(() => {
    if (tryAttach()) window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 4000);
  return webgl.toonOutline || null;
}
