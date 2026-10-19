const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** The password-reset email. `portal` is "citizen" or "staff"; only the wording differs. */
function passwordResetEmail({ name, link, minutes, portal }) {
  const where = portal === "staff" ? "the Murang'a County Staff Portal" : "Murang'a County Service Requests";
  return {
    subject: `Reset your password – ${portal === "staff" ? "Staff Portal" : "Murang'a Service Requests"}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;line-height:1.5;color:#16261e">
<h2 style="margin:0 0 12px">Reset your password</h2>
<p>Hello ${escapeHtml(name)},</p>
<p>We received a request to reset the password for your account on ${where}. Click the button below to choose a new one. The link works once and expires in ${minutes} minutes.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f4d3a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
<p style="font-size:13px;color:#55665d">If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#55665d">If you did not ask for this, you can ignore this email — your password will stay as it is.</p>
</div>`,
  };
}

/** The staff approval-code email, sent when the administrator locks a code to one address. */
function staffInviteEmail({ code, link, days, invitedBy }) {
  return {
    subject: "Your approval code – Murang'a County Staff Portal",
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;line-height:1.5;color:#16261e">
<h2 style="margin:0 0 12px">You have been invited to the Staff Portal</h2>
<p>${escapeHtml(invitedBy)} has approved you to create a staff account on the Murang'a County Staff Portal.</p>
<p>Your approval code is:</p>
<p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#eef2f7;padding:12px 16px;border-radius:8px;display:inline-block">${escapeHtml(code)}</p>
<p>Use it on the <a href="${escapeHtml(link)}">staff sign-up page</a> with this email address. The code works once and expires in ${days} days.</p>
<p style="font-size:13px;color:#55665d">If the link does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#55665d">If you were not expecting this, you can ignore this email.</p>
</div>`,
  };
}

module.exports = { passwordResetEmail, staffInviteEmail };
