import {
  a$ as MeshBasicMaterial,
} from "../../vendor/vendor.75f6e6ae65453426.js";

const BACK_SIDE = 1;

const outlineMaterial = new MeshBasicMaterial({
  color: 0x050505,
  side: BACK_SIDE,
  fog: false,
  toneMapped: false,
  depthWrite: true,
  depthTest: true,
});
outlineMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    `#include <project_vertex>
    {
      vec3 outlineN = vec3(0.0, 0.0, 1.0);
      #ifdef USE_NORMAL
        outlineN = transformedNormal;
      #endif
      float stretch = 0.012 + 0.004 * clamp(gl_Position.w * 0.02, 0.0, 3.0);
      vec2 push = outlineN.xy;
      float len = length(push);
      if (len > 1e-5) gl_Position.xy += (push / len) * stretch * gl_Position.w;
    }`,
  );
};
outlineMaterial.customProgramCacheKey = () => "glorb-toon-outline";

function hideNonMeshes(scene) {
  const hidden = [];
  scene.traverse((object) => {
    if (!object.visible) return;
    if (object.isPoints || object.isLine || object.isLineSegments || object.isSprite) {
      object.visible = false;
      hidden.push(object);
    }
  });
  return hidden;
}

function attachOutline(webgl, renderer) {
  if (renderer.__toonOutlinePass) return renderer.__toonOutlinePass;

  const originalRender = renderer.render.bind(renderer);
  let outlining = false;

  renderer.render = function toonOutlineRender(sceneObject, cameraObject) {
    originalRender(sceneObject, cameraObject);
    if (outlining) return;
    if (this.getRenderTarget()) return;
    if (!sceneObject || !sceneObject.isScene || !cameraObject) return;

    outlining = true;
    const previousAutoClear = this.autoClear;
    const previousOverride = sceneObject.overrideMaterial;
    const hidden = hideNonMeshes(sceneObject);
    this.autoClear = false;
    sceneObject.overrideMaterial = outlineMaterial;
    try {
      originalRender(sceneObject, cameraObject);
    } finally {
      sceneObject.overrideMaterial = previousOverride;
      this.autoClear = previousAutoClear;
      for (const object of hidden) object.visible = true;
      outlining = false;
    }
  };

  const api = { attached: true, kind: "inverted-hull" };
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
      return true;
    } catch (error) {
      console.error("Cartoon outline failed to attach", error);
      return false;
    }
  };

  if (tryAttach()) return webgl.toonOutline;
  webgl.hooks?.afterInit?.watchOnce?.(tryAttach);
  webgl.renderer?.hooks?.afterInit?.watchOnce?.(tryAttach);
  webgl.hooks?.beforeFrame?.watchOnce?.(tryAttach);
  const timer = window.setInterval(() => {
    if (tryAttach()) window.clearInterval(timer);
  }, 50);
  return webgl.toonOutline || null;
}
