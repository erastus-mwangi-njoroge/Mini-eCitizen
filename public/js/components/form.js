import { h } from "../core/dom.js";

/** A labelled form control with a slot for its validation message. `control` must have a `name`. */
export function field(label, control, hint) {
  const id = `f-${control.name}`;
  control.id = id;
  control.setAttribute("aria-describedby", `${id}-error`);
  return h("div", { class: "field", dataset: { field: control.name } },
    h("label", { for: id }, label),
    hint ? h("p", { class: "hint" }, hint) : null,
    control,
    h("p", { class: "field-error", id: `${id}-error`, hidden: true }));
}

/** Show server-side validation messages next to their fields (pass {} to clear). */
export function showErrors(form, fields = {}) {
  for (const el of form.querySelectorAll("[data-field]")) {
    const message = fields[el.dataset.field];
    const error = el.querySelector(".field-error");
    error.textContent = message || "";
    error.hidden = !message;
    el.querySelector("[name]")?.setAttribute("aria-invalid", message ? "true" : "false");
  }
  form.querySelector("[aria-invalid=true]")?.focus();
}

/** Disable a button and show "…" text while an async action runs. */
export async function busy(button, label, action) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/** A <select> filled from [{value, label}] with an optional first "choose" option. */
export function select(name, options, placeholder) {
  return h("select", { name },
    placeholder ? h("option", { value: "" }, placeholder) : null,
    options.map((o) => h("option", { value: o.value }, o.label)));
}
