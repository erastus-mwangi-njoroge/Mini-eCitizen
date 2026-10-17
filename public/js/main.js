import { loadSession, onUserChange } from "./core/session.js";
import { startRouter } from "./core/router.js";
import { renderNavbar } from "./components/navbar.js";
import { renderFooter } from "./components/footer.js";

// Each view registers its own route when imported.
import "./views/home.js";
import "./views/auth.js";
import "./views/newRequest.js";
import "./views/myRequests.js";
import "./views/requestDetail.js";
import "./views/track.js";
import "./views/dashboard.js";
import "./views/notFound.js";

async function boot() {
  const header = document.getElementById("site-header");
  const refresh = () => renderNavbar(header);
  try {
    await loadSession();
  } catch {
    document.getElementById("main").textContent = "The service is unavailable right now. Please try again shortly.";
    return;
  }
  renderFooter(document.getElementById("site-footer"));
  onUserChange(refresh);
  document.addEventListener("route-changed", refresh);
  refresh();
  startRouter(document.getElementById("main"));
}

boot();
