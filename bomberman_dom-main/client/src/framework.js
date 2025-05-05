import { MyEventSystem } from "./event.js";
import {render,updateRender } from './vdom.js'
const Framework = (function () {
  const state = [];
  let stateIndex = 0;

  function useState(initialValue) {
    const currentIndex = stateIndex;
    state[currentIndex] = state[currentIndex] !== undefined ? state[currentIndex] : initialValue;

    function setState(newValue) {
      state[currentIndex] = newValue;
    }

    stateIndex++;

    return [state[currentIndex], setState];
  }

  function jsx(tag, attrs, ...children) {
    if (typeof tag === "function") {
      return tag({ ...attrs, children });
    }

    return { tag, attrs: attrs || {}, children };
  }

  function createElement(node) {
    if (["string", "number"].includes(typeof node)) {
      return document.createTextNode(node.toString());
    }

    const element = document.createElement(node.tag);

    for (const [key, value] of Object.entries(node.attrs)) {
      if (key.startsWith("on") && typeof value === "function") {
        MyEventSystem.addEventListener(element, key.slice(2).toLowerCase(), value);
      } else if (key === 'ref' && typeof  value === 'object') {
        value.current = element;
        //continue;
      } else {
        if (key === 'className') {
          element.setAttribute('class', value);
        } else {
          element.setAttribute(key, value);
        }
      }
    }

    for (const child of node.children.flat()) {
      element.appendChild(createElement(child));
    }

    return element;
  }

  let rootContainer = null;
  let App = null;

 

  return {
    jsx,
    createElement,
    useState,
    setApp: function (app) {
      App = app;
    },
  };
})();

export const { useState, useEffect, jsx, createElement, setApp } = Framework;
