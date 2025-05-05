import { MyEventSystem } from "./event.js";
import { render } from "./vdom.js";
import { jsx } from "./framework.js";
export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = null;
        this.initEventListeners();
    }


    initEventListeners() {
        MyEventSystem.addEventListener(window,'popstate',() => {
            this.handleRouting();
        })
    }

    navigate(path) {
        history.pushState({}, '', path);
        this.handleRouting();
    }

    handleRouting() {
        const path = window.location.pathname;
        const route = this.routes[path];
        
        if (route) {
            const body = document.body;
            body.innerHTML = '';
            const routeComponents = route();            
            routeComponents.forEach(component => {
              //  body.appendChild(createElement(component));
                render(component,body)
            });
            this.currentRoute = path;
        } else {
            console.log('Route not found');
            
            this.handle404();
        }
    }

    handle404() {
        const NotFoundPage = () => {
          return jsx('div', { className: 'not-found-container' },
            jsx('h1', { className: 'not-found-title' }, '404'),
            jsx('p', { className: 'not-found-text' }, 'Page Not found'),
            jsx('a', { 
              href: '/', 
              className: 'home-link',
              onClick: (e) => {
                e.preventDefault();
                this.navigate('/');
              }
            }, 'Go Home')
          );
        };
        
        const body = document.body;
        body.innerHTML = '';
        render(NotFoundPage(), body);
      }

    init() {
        this.handleRouting();
    }
}