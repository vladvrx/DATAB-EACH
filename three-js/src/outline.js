import {
  aT as Vector2,
  aU as Matrix4,
  b5 as Mesh,
  b6 as BufferAttribute,
  b7 as BufferGeometry,
  bC as WebGLRenderTarget,
  br as RawShaderMaterial,
  cM as Scene,
  ch as OrthographicCamera,
  ct as Texture,
} from "../../vendor/vendor.75f6e6ae65453426.js";

const DEPTH_FORMAT = 1026;
const UNSIGNED_INT_TYPE = 1014;
const NEAREST_FILTER = 1003;
const LINEAR_FILTER = 1006;
const CLAMP_TO_EDGE = 1001;

const VERTEX_SHADER = `
precision highp float;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;

varying vec2 vUv;

float sampleDepth(vec2 uv) {
  return texture2D(tDepth, clamp(uv, 0.0, 1.0)).r;
}

float viewZ(float depth) {
  return (uNear * uFar) / ((uFar - uNear) * depth - uFar);
}

void main() {
  vec3 color = texture2D(tColor, vUv).rgb;
  float depth = sampleDepth(vUv);
  if (depth > 0.9994) {
    gl_FragColor = vec4(color, 1.0);
    return;
  }

  float centerZ = abs(viewZ(depth));
  float thickness = mix(3.4, 1.35, clamp((centerZ - 4.0) / 28.0, 0.0, 1.0));
  vec2 texel = uTexel * thickness;

  float dL = sampleDepth(vUv + vec2(-texel.x, 0.0));
  float dR = sampleDepth(vUv + vec2(texel.x, 0.0));
  float dU = sampleDepth(vUv + vec2(0.0, texel.y));
  float dD = sampleDepth(vUv + vec2(0.0, -texel.y));
  float dN = min(min(dL, dR), min(dU, dD));

  float zDelta = abs(viewZ(dL) - viewZ(dR)) + abs(viewZ(dU) - viewZ(dD));
  float silhouette = 0.0;
  if (dN > 0.9994 && depth <= 0.9994) silhouette = 1.0;

  float depthEdge = step(0.045 + centerZ * 0.0075, zDelta);

  vec3 pos = vec3(vUv, depth);
  vec3 dx = dFdx(pos);
  vec3 dy = dFdy(pos);
  vec3 normal = normalize(cross(dx, dy));
  vec3 nL = normalize(cross(dFdx(vec3(vUv + vec2(-texel.x, 0.0), dL)), dFdy(vec3(vUv + vec2(-texel.x, 0.0), dL))));
  vec3 nR = normalize(cross(dFdx(vec3(vUv + vec2(texel.x, 0.0), dR)), dFdy(vec3(vUv + vec2(texel.x, 0.0), dR))));
  float crease = step(0.28, max(1.0 - dot(normal, nL), 1.0 - dot(normal, nR)));

  float neon = color.g - max(color.r, color.b);
  float water = step(0.42, neon) * step(0.55, color.g) * step(color.r, 0.35) * (1.0 - step(0.55, zDelta));
  float puff = step(0.28, color.b - max(color.r, color.g)) * step(0.5, color.b);

  float edge = max(silhouette, max(depthEdge, crease));
  edge *= 1.0 - water;
  edge *= 1.0 - puff;

  gl_FragColor = vec4(mix(color, vec3(0.02, 0.02, 0.04), edge), 1.0);
}
`;

class DepthTexture extends Texture {
  constructor(width, height) {
    super();
    this.isDepthTexture = true;
    this.image = { width, height };
    this.format = DEPTH_FORMAT;
    this.type = UNSIGNED_INT_TYPE;
    this.magFilter = NEAREST_FILTER;
    this.minFilter = NEAREST_FILTER;
    this.wrapS = CLAMP_TO_EDGE;
    this.wrapT = CLAMP_TO_EDGE;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
  }
}

function makeFullscreenMesh(material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    -1, -1, 3, -1, -1, 3,
  ]), 2));
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return mesh;
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

  const depthTexture = new DepthTexture(1, 1);
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: LINEAR_FILTER,
    magFilter: LINEAR_FILTER,
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture,
  });
  target.texture.generateMipmaps = false;
  if ("encoding" in renderer) target.texture.encoding = renderer.outputEncoding;

  const uniforms = {
    tColor: { value: target.texture },
    tDepth: { value: depthTexture },
    uTexel: { value: new Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 400 },
  };

  const material = new RawShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    fog: false,
  });
  material.extensions = { ...(material.extensions || {}), derivatives: true };

  const overlay = new Scene();
  const overlayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  overlay.add(makeFullscreenMesh(material));

  const originalRender = renderer.render.bind(renderer);
  let compositing = false;
  let dirty = false;
  let width = 0;
  let height = 0;

  function resize() {
    const next = drawingSize(webgl, renderer);
    if (next.width === width && next.height === height) return;
    width = next.width;
    height = next.height;
    depthTexture.image.width = width;
    depthTexture.image.height = height;
    depthTexture.needsUpdate = true;
    target.setSize(width, height);
    uniforms.uTexel.value.set(1 / width, 1 / height);
  }

  function copyCamera(camera) {
    if (!camera) return;
    const cam = camera.cam && camera.cam.isCamera ? camera.cam : camera;
    if (!cam.isCamera) return;
    if (typeof cam.near === "number") uniforms.uNear.value = cam.near;
    if (typeof cam.far === "number") uniforms.uFar.value = cam.far;
  }

  function composite() {
    if (!dirty || compositing) return;
    dirty = false;
    compositing = true;
    const previous = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    originalRender(overlay, overlayCamera);
    renderer.setRenderTarget(previous);
    renderer.autoClear = previousAutoClear;
    compositing = false;
  }

  renderer.render = function toonOutlineRender(sceneObject, cameraObject) {
    if (compositing) return originalRender(sceneObject, cameraObject);
    const current = this.getRenderTarget();
    if (current && current !== target) return originalRender(sceneObject, cameraObject);

    resize();
    if (current !== target) {
      this.setRenderTarget(target);
      this.clear(true, true, true);
    }
    copyCamera(cameraObject);
    originalRender(sceneObject, cameraObject);
    dirty = true;
  };

  const afterFrame = webgl.hooks?.afterFrame;
  if (afterFrame?.watch) afterFrame.watch(composite);
  else {
    const pump = () => {
      composite();
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  }
  webgl.renderer?.drawingBufferSize?.watch?.(() => resize());

  const api = { target, composite, resize, attached: true };
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
    if (!renderer) return false;
    try {
      attachOutline(webgl, renderer);
      return true;
    } catch (error) {
      console.error("Cartoon outline failed to attach", error);
      return false;
    }
  };

  if (tryAttach()) return webgl.toonOutline;
  webgl.hooks?.afterInit?.watchOnce?.(tryAttach);
  webgl.renderer?.hooks?.afterInit?.watchOnce?.(tryAttach);
  const timer = window.setInterval(() => {
    if (tryAttach()) window.clearInterval(timer);
  }, 32);
  window.setTimeout(() => window.clearInterval(timer), 20000);
  return webgl.toonOutline || null;
}
