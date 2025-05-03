import router from "../framework/core/router.js"
import { Div } from "../framework/core/components.js"
import { Login } from "./login.js";



router.register('/', Login, "hello");

function App() {
    return Div({ className: 'test' }, "HELLO WORLD");
}

router.start();