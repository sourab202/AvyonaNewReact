const baseUrl = process.env.API_BASE_URL || "http://localhost:4000/api/v1";
const adminToken = process.env.ADMIN_TEST_TOKEN || "local-dev-admin-token";
const stamp = Date.now();
const manualEmail = `manage-access-manual-${stamp}@avyona.local`;
const inviteEmail = `manage-access-invite-${stamp}@avyona.local`;
const manualPassword = "ManualAccess123!";
const invitePassword = "InviteAccess123!";
const createdIds = [];
const results = [];

function check(label, condition) {
  results.push({ label, passed: Boolean(condition) });
  if (!condition) throw new Error(label);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.auth === false ? {} : { Authorization: `Bearer ${adminToken}` }),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function removeCreatedUsers() {
  const usersResponse = await request("/admin/access/users").catch(() => null);
  const matchingIds = (usersResponse?.payload?.data || [])
    .filter((user) => user.email === manualEmail || user.email === inviteEmail)
    .map((user) => user.id);
  const ids = [...new Set([...createdIds, ...matchingIds])];

  for (const id of ids) {
    await request(`/admin/access/users/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
}

try {
  const health = await request("/health", { auth: false });
  check("Backend and database are available", health.response.ok && health.payload.services?.database === "connected");

  const unauthorized = await request("/admin/access/users", { auth: false });
  check("Manage Access API blocks unauthenticated requests", unauthorized.response.status === 401);

  const roles = await request("/admin/access/roles");
  check("Authorized Super Admin can load roles", roles.response.ok && Array.isArray(roles.payload.data));

  const manualCreate = await request("/admin/access/users", {
    method: "POST",
    body: JSON.stringify({
      mode: "manual",
      fullName: "Manual Access Test",
      email: manualEmail,
      phone: "9999999999",
      role: "viewer",
      password: manualPassword
    })
  });
  check("Manual ID/password user can be created", manualCreate.response.status === 201);
  createdIds.push(manualCreate.payload.data.user.id);

  const manualLogin = await request("/admin/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email: manualEmail, password: manualPassword })
  });
  check("Manual account can login", manualLogin.response.ok && Boolean(manualLogin.payload.data?.token));

  const suspend = await request(`/admin/access/users/${manualCreate.payload.data.user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "suspended", role: "viewer", fullName: "Manual Access Test", phone: "9999999999" })
  });
  check("Dashboard user can be suspended", suspend.response.ok && suspend.payload.data?.status === "suspended");

  const suspendedLogin = await request("/admin/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email: manualEmail, password: manualPassword })
  });
  check("Suspended user cannot login", suspendedLogin.response.status === 401);

  const inviteCreate = await request("/admin/access/users", {
    method: "POST",
    body: JSON.stringify({
      mode: "email",
      fullName: "Invite Access Test",
      email: inviteEmail,
      role: "viewer"
    })
  });
  check("Email invitation can be created", inviteCreate.response.status === 201 && Boolean(inviteCreate.payload.data?.inviteUrl));
  createdIds.push(inviteCreate.payload.data.user.id);

  const inviteToken = new URL(inviteCreate.payload.data.inviteUrl).searchParams.get("token");
  const acceptInvite = await request("/admin/access/invitations/accept", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ token: inviteToken, password: invitePassword })
  });
  check("Invite link can set the first password", acceptInvite.response.ok);

  const inviteLogin = await request("/admin/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email: inviteEmail, password: invitePassword })
  });
  check("Invited account can login after acceptance", inviteLogin.response.ok && Boolean(inviteLogin.payload.data?.token));

  const permissions = await request("/admin/access/roles/viewer/permissions");
  check("Permission matrix loads from the database", permissions.response.ok && Array.isArray(permissions.payload.data));

  const securityRules = await request("/admin/access/security-rules");
  check("Security rules load from the database", securityRules.response.ok && Number(securityRules.payload.data?.passwordMinLength) >= 8);

  const logs = await request("/admin/access/logs");
  check("Access activity logs are available", logs.response.ok && Array.isArray(logs.payload.data));
} finally {
  await removeCreatedUsers();
}

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
}

console.log(`\nAll ${results.length} Manage Access workflow checks passed.`);
