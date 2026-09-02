import {
  c as resolveComponent,
  f as createVNode,
  I as Fragment,
} from "../../vendor/vendor.75f6e6ae65453426.js";

export const ThreeJsRoot = {
  name: "ThreeJsApp",
  render() {
    const NotificationCenter = resolveComponent("NotificationCenter");
    const NiceRouterView = resolveComponent("NiceRouterView");
    const WebGL = resolveComponent("WebGL");
    return createVNode(Fragment, null, [
      createVNode("main", { class: "ui" }, [
        createVNode(NotificationCenter),
        createVNode(NiceRouterView, { prefix: "page" }),
        createVNode("div", { id: "threejs-hud" }),
      ]),
      createVNode(WebGL),
    ]);
  },
};
