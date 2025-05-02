import { router } from "../framework/core/router.js"
import { Div } from "../framework/core/components"



router.register('/', App, "hello")

function App() {
    return Div({ className: 'test' }, "HELLO WORLD");
}

router.start();