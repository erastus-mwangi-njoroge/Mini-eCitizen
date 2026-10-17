import { h } from "../core/dom.js";
import { route } from "../core/router.js";

route("/404", {
  title: "Page not found",
  access: "public",
  notFound: true,
  render: () => h("div", { class: "wrap narrow center" }, h("h1", null, "Page not found"), h("p", { class: "muted" }, "That page does not exist."), h("a", { class: "btn btn-primary", href: "#/" }, "Go home")),
});
