import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session } from "../core/session.js";
import { toast } from "../core/toast.js";
import { field, select, showErrors, busy } from "../components/form.js";

const MAX_DIMENSION = 1600;

/** Read a chosen photo as a data URL, shrinking big phone photos so uploads stay fast. */
async function readPhoto(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPG or WebP photo.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) return readAsDataUrl(file);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/** Category picker: big radio cards. */
function categoryPicker(selected) {
  return h("div", { class: "field", dataset: { field: "category" } },
    h("fieldset", null, h("legend", null, "What is the problem?"),
      h("div", { class: "choice-grid" }, session.meta.categories.map((c) =>
        h("label", { class: "choice" },
          h("input", { type: "radio", name: "category", value: c.id, checked: c.id === selected }),
          h("span", null, h("span", { "aria-hidden": "true" }, c.icon), " ", c.label))))),
    h("p", { class: "field-error", hidden: true }));
}

/** Sub-county + ward selects where the ward list follows the sub-county. */
function locationFields() {
  const subCounty = select("subCounty", Object.keys(session.meta.locations).map((n) => ({ value: n, label: n })), "Choose sub-county");
  const ward = select("ward", [], "Choose a sub-county first");
  ward.disabled = true;
  subCounty.addEventListener("change", () => {
    const wards = session.meta.locations[subCounty.value] || [];
    ward.replaceChildren(h("option", { value: "" }, "Choose ward"), ...wards.map((w) => h("option", { value: w }, w)));
    ward.disabled = !wards.length;
  });
  return [field("Sub-county", subCounty), field("Ward", ward)];
}

/** Optional photo input with preview and a remove button. Exposes the data URL via `.value()`. */
function photoField() {
  let dataUrl = "";
  const error = h("p", { class: "field-error", hidden: true });
  const preview = h("div", { class: "photo-preview", hidden: true });
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", id: "f-image", "aria-describedby": "photo-hint" });

  input.addEventListener("change", async () => {
    error.hidden = true;
    if (!input.files[0]) return;
    try {
      dataUrl = await readPhoto(input.files[0]);
      preview.replaceChildren(h("img", { src: dataUrl, alt: "Preview of the chosen photo" }),
        h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: clear }, "Remove photo"));
      preview.hidden = false;
    } catch (err) {
      clear();
      error.textContent = err.message;
      error.hidden = false;
    }
  });

  function clear() {
    dataUrl = "";
    input.value = "";
    preview.hidden = true;
  }

  const el = h("div", { class: "field", dataset: { field: "image" } },
    h("label", { for: "f-image" }, "Photo (optional)"),
    h("p", { class: "hint", id: "photo-hint" }, `PNG, JPG or WebP, up to ${session.meta.maxImageMb} MB. A clear photo helps crews find and fix the problem faster.`),
    input, preview, error);
  return { el, value: () => dataUrl };
}

route("/new", {
  title: "Report a problem",
  access: "user",
  render({ query }) {
    const description = h("textarea", { name: "description", rows: 5, maxLength: 2000 });
    const counter = h("span", { class: "muted small" }, "0 / 2000");
    description.addEventListener("input", () => (counter.textContent = `${description.value.length} / 2000`));
    const photo = photoField();
    const note = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });
    const submit = h("button", { class: "btn btn-primary btn-lg", type: "submit" }, "Submit request");

    const form = h("form", { novalidate: true },
      note,
      categoryPicker(query.category),
      h("div", { class: "grid-2" }, locationFields()),
      field("Where exactly?", h("input", { name: "locationDetail", maxLength: 200, placeholder: "Street, landmark, pole number…" })),
      field("Describe the problem", description, "What is wrong, since when, and how it affects people."),
      counter, photo.el,
      h("div", { class: "form-actions" }, submit, h("a", { class: "btn btn-ghost", href: "#/requests" }, "Cancel")));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      note.hidden = true;
      showErrors(form);
      const body = { ...Object.fromEntries(new FormData(form)), image: photo.value() };
      try {
        const { request } = await busy(submit, "Submitting…", () => api.post("/api/requests", body));
        toast(`Submitted. Your reference is ${request.ref}.`);
        navigate(`/requests/${request.id}`);
      } catch (err) {
        showErrors(form, err.fields);
        if (!Object.keys(err.fields).length) { note.textContent = err.message; note.hidden = false; }
      }
    });

    return h("div", { class: "wrap narrow" }, h("h1", null, "Report a problem"), h("p", { class: "muted" }, "Tell us what is wrong and where. Staff will review it and keep you updated."), h("div", { class: "card" }, form));
  },
});
