import { MyEventSystem } from "./event.js";
import { createElement } from "./framework.js";

export function diffAttrs(oldAttrs, newAttrs) {
  const patches = [];

  for (const [key, value] of Object.entries(newAttrs)) {
    if (oldAttrs[key] !== value) {
      patches.push(key, value);
    }
  }

  for (const key in oldAttrs) {
    if (!(key in newAttrs)) {
      patches.push(key, null);
    }
  }

  return patches;
}

export function diffChildren(oldChildren = [], newChildren = []) {
  const patches = [];

  const commonLength = Math.min(oldChildren.length, newChildren.length);

  for (let i = 0; i < commonLength; i++) {
    patches[i] = diff(oldChildren[i], newChildren[i]);
  }

  for (let i = commonLength; i < newChildren.length; i++) {
    patches[i] = { type: "CREATE", newNode: newChildren[i] };
  }

  for (let i = commonLength; i < oldChildren.length; i++) {
    patches[i] = { type: "REMOVE" };
  }

  return patches;
}

export function patchAttrs(el, attrsPatches) {
  if (!attrsPatches || attrsPatches.length === 0) return;

  for (let i = 0; i < attrsPatches.length; i += 2) {
    const key = attrsPatches[i];
    const value = attrsPatches[i + 1];

    if (value === null) {
      el.removeAttribute(key);
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventType = key.substring(2).toLowerCase();
      // if (el._listeners && el._listeners[eventType]) {
      //   el.removeEventListener(eventType, el._listeners[eventType]);
      // }
      MyEventSystem.addEventListener(el, eventType, value);
      el._listeners = el._listeners || {};
      el._listeners[eventType] = value;
    } else {
      el.setAttribute(key, value);
    }
  }
}

export function diff(oldNode, newNode) {
  if (!oldNode) {
    return { type: "CREATE", newNode };
  }

  if (!newNode) {
    return { type: "REMOVE" };
  }

  if (typeof oldNode !== typeof newNode) {
    return { type: "REPLACE", newNode };
  }

  if (typeof newNode === "string") {
    if (oldNode !== newNode) {
      return { type: "REPLACE", newNode };
    }
    return null;
  }

  if (oldNode.tag !== newNode.tag) {
    return { type: "REPLACE", newNode };
  }

  const attrsPatches = diffAttrs(oldNode.attrs || {}, newNode.attrs || {});
  const childrenPatches = diffChildren(oldNode.children, newNode.children);

  if (
    attrsPatches.length === 0 &&
    childrenPatches.every((patch) => patch === null)
  ) {
    return null;
  }

  return {
    type: "UPDATE",
    attrsPatches,
    childrenPatches,
  };
}

export function patch(parent, patches, index = 0) {
  if (!patches) return;

  const el = parent.childNodes[index];

  switch (patches.type) {
    case "CREATE":
      parent.appendChild(createElement(patches.newNode));
      break;
    case "REMOVE":
      parent.removeChild(el);
      break;
    case "REPLACE":
      parent.replaceChild(createElement(patches.newNode), el);
      break;
    case "UPDATE":
      patchAttrs(el, patches.attrsPatches);

      patches.childrenPatches.forEach((childPatch, i) => {
        patch(el, childPatch, i);
      });
      break;
  }
}

export function render(vNode, container) {
  container.innerHTML = "";

  const element = createElement(vNode);
  container.appendChild(element);

  container._vdom = vNode;

  return element;
}

export function updateRender(newVNode, container) {
  const oldVNode = container._vdom;
  if (!oldVNode) {
    render(newVNode, container);
    return;
  }
  const patches = diff(oldVNode, newVNode);

  patch(container, patches, 0);

  container._vdom = newVNode;
}
