import componentStack from "./componentStack.js";

// Store effect data per component
class EffectStore {
    constructor() {
        this.effects = new Map(); // effectId -> { callback, deps, lastRun }
        this.cleanups = new Map(); // effectId -> cleanup function
        this.oldDeps = new Map(); // effectId -> previous dependencies
        this.effectCount = 0; // Track number of effects
        this.mountEffects = new Set(); // Store mount effects separately
    }

    getNextEffectId() {
        return this.effectCount++;
    }

    reset() {
        this.effectCount = 0;
    }
}

let componentEffects = new Map(); // component -> EffectStore
let afterRenderEffects = new Map(); // component -> effects to run after render
let mountedComponents = new Set(); // Track mounted components

export function isPlainObject(obj) {
    return obj !== null && typeof obj === "object" && obj.constructor === Object;
}

export function shallowEqualObjects(a, b) {
    if (!isPlainObject(a) || !isPlainObject(b)) return a === b;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => a[key] === b[key]);
}

export function deepEqual(a, b) {
    if (a === b) return true;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((val, i) => deepEqual(val, b[i]));
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every(key => deepEqual(a[key], b[key]));
    }

    return false;
}

export function areDepsEqual(newDeps, oldDeps) {
    if (!newDeps || !oldDeps) return false;
    if (newDeps.length !== oldDeps.length) return false;
    return newDeps.every((dep, i) => deepEqual(dep, oldDeps[i]));
}

export function Watch(callback, deps = null) {
    const currentComponent = componentStack.current;
    if (!currentComponent) {
        console.error("Watch called outside component context");
        return;
    }

    // Get or create effect store for this component
    if (!componentEffects.has(currentComponent)) {
        componentEffects.set(currentComponent, new EffectStore());
    }

    if (!afterRenderEffects.has(currentComponent)) {
        afterRenderEffects.set(currentComponent, new Set());
    }

    const store = componentEffects.get(currentComponent);
    const currentEffectId = store.getNextEffectId();

    // Store or update the effect
    store.effects.set(currentEffectId, { callback, deps });

    const runEffect = () => {
        // Run cleanup if it exists
        const cleanup = store.cleanups.get(currentEffectId);
        if (typeof cleanup === 'function') {
            try {
                cleanup();
            } catch (error) {
                console.error('Error in cleanup function:', error);
            }
        }

        // Run the effect and store any cleanup function
        try {
            const result = callback();
            if (typeof result === 'function') {
                store.cleanups.set(currentEffectId, result);
            } else {
                store.cleanups.delete(currentEffectId);
            }
        } catch (error) {
            console.error('Error in effect:', error);
        }
    };

    if (!deps) {
        // No dependencies - run on every render
        afterRenderEffects.get(currentComponent).add(runEffect);
        return;
    }

    if (!Array.isArray(deps)) {
        console.error(
            "%c[Watch Error]%c Expected an array of dependencies.\n" +
            "Wrap dependencies in square brackets like this: %c[dep1, dep2]%c.",
            "color: red; font-weight: bold;",
            "color: white;",
            "color: cyan; font-style: italic;",
            "color: white;"
        );
        return;
    }

    // Empty array - run only once on mount
    if (deps.length === 0) {
        if (!mountedComponents.has(currentComponent)) {
            store.mountEffects.add(runEffect);
            // Force effect application
            requestAnimationFrame(() => {
                if (!mountedComponents.has(currentComponent)) {
                    runEffect();
                    mountedComponents.add(currentComponent);
                    store.mountEffects.delete(runEffect);
                }
            });
        }
        return;
    }

    // Check if dependencies changed
    const oldDeps = store.oldDeps.get(currentEffectId);
    const isInitialRun = !oldDeps;

    // On initial run, just store the deps but don't run the effect
    if (isInitialRun) {
        store.oldDeps.set(currentEffectId, [...deps]);
        return;
    }

    // For subsequent runs, check if deps changed
    const hasChanged = !areDepsEqual(deps, oldDeps);
    if (hasChanged) {
        store.oldDeps.set(currentEffectId, [...deps]);
        afterRenderEffects.get(currentComponent).add(runEffect);
    }
}

export function resetEffectCount(component) {
    if (componentEffects.has(component)) {
        const store = componentEffects.get(component);
        store.reset();
    }
}

export function applyCallbacksAfterRender() {
    const currentComponent = componentStack.current;
    if (!currentComponent || !afterRenderEffects.has(currentComponent)) {
        return;
    }

    const store = componentEffects.get(currentComponent);
    const effects = afterRenderEffects.get(currentComponent);

    // Ensure DOM is ready and refs are synchronized
    requestAnimationFrame(() => {
        // Run mount effects first if component not mounted
        if (!mountedComponents.has(currentComponent) && store.mountEffects.size > 0) {
            store.mountEffects.forEach(effect => {
                try {
                    effect();
                } catch (error) {
                    console.error("Error in mount effect:", error);
                }
            });
            mountedComponents.add(currentComponent);
            store.mountEffects.clear();
        }

        // Then run regular effects
        effects.forEach(effect => {
            try {
                effect();
            } catch (error) {
                console.error("Error in effect:", error);
            }
        });
    });

    afterRenderEffects.set(currentComponent, new Set()); // Clear effects
    resetEffectCount(currentComponent);
}

export function cleanupComponentEffects(component) {
    if (componentEffects.has(component)) {
        const store = componentEffects.get(component);
        // Run all cleanup functions
        store.cleanups.forEach(cleanup => {
            if (typeof cleanup === 'function') {
                try {
                    cleanup();
                } catch (error) {
                    console.error('Error in cleanup function:', error);
                }
            }
        });
        componentEffects.delete(component);
    }

    mountedComponents.delete(component);
    afterRenderEffects.delete(component);
}