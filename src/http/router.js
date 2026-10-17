/**
 * A minimal router. Routes look like "/api/requests/:id"; each route has one or more handlers that run in order.
 * Early handlers are "guards" (they throw to stop the request); the last handler returns the response data.
 */
class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, ...handlers) {
    const keys = [];
    const source = pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), "([^/]+)"));
    this.routes.push({ method, regex: new RegExp(`^${source}$`), keys, handlers });
    return this;
  }

  get(pattern, ...handlers) { return this.add("GET", pattern, ...handlers); }
  post(pattern, ...handlers) { return this.add("POST", pattern, ...handlers); }
  patch(pattern, ...handlers) { return this.add("PATCH", pattern, ...handlers); }

  /** @returns {{handlers: Function[], params: object}|null} */
  match(method, pathname) {
    for (const route of this.routes) {
      const m = route.method === method && route.regex.exec(pathname);
      if (m) {
        const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return { handlers: route.handlers, params };
      }
    }
    return null;
  }
}

module.exports = { Router };
