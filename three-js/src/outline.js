import {
  a$ as MeshBasicMaterial,
} from "../../vendor/vendor.75f6e6ae65453426.js";

const BACK_SIDE = 1;

const outlineMaterial = new MeshBasicMaterial({
  color: 0x000000,
  side: BACK_SIDE,
  fog: false,
  toneMapped: false,
  depthTest: true,
  depthWrite: false,
});
outlineMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    `#include <project_vertex>
    gl_Position.xy += normalize(transformedNormal.xy + vec2(1e-6)) * gl_Position.w * 0.003;`,
  );
};
outlineMaterial.customProgramCacheKey = () => "glorb-toon-ink";

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
  let disabled = false;

  renderer.render = function toonOutlineRender(sceneObject, cameraObject) {
    originalRender(sceneObject, cameraObject);
    if (disabled || outlining) return;
    if (this.getRenderTarget()) return;
    if (!sceneObject?.isScene || !cameraObject) return;
    outlining = true;
    const previousAutoClear = this.autoClear;
    const previousOverride = sceneObject.overrideMaterial;
    const hidden = hideNonMeshes(sceneObject);
    this.autoClear = false;
    sceneObject.overrideMaterial = outlineMaterial;
    try {
      originalRender(sceneObject, cameraObject);
    } catch (error) {
      disabled = true;
      this.render = originalRender;
      console.warn("Cartoon outline disabled", error);
    } finally {
      sceneObject.overrideMaterial = previousOverride;
      this.autoClear = previousAutoClear;
      for (const object of hidden) object.visible = true;
      outlining = false;
    }
  };

  const api = { attached: true, kind: "ink" };
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
