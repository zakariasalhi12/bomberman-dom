import componentStack from './componentStack.js';
import { componentStates, componentIndexes } from './state.js';

function useRef(initialValue) {
    const currentComponent = componentStack.current;
    if (!currentComponent) {
        console.error("useRef called outside component context");
        return { current: initialValue };
    }

    if (!componentStates.has(currentComponent)) {
        componentStates.set(currentComponent, { states: [], vdom: null, refs: [] });
    }

    const componentState = componentStates.get(currentComponent);
    if (!componentState.refs) {
        componentState.refs = [];
    }

    const refIndex = componentIndexes.get(currentComponent) || 0;

    if (!componentState.refs[refIndex]) {
        componentState.refs[refIndex] = { current: initialValue };
    }

    componentIndexes.set(currentComponent, refIndex + 1);
    return componentState.refs[refIndex];
}

export { useRef };


