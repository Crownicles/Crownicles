import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { KeycloakUtils } = require("../../Lib/dist/src/keycloak/KeycloakUtils.js");
const { KeycloakUtils: ServiceKeycloakUtils } = require("../../RestWs/dist/Lib/src/keycloak/KeycloakUtils.js");
const { AccountCollisionService } = require("../../RestWs/dist/RestWs/src/services/AccountCollisionService.js");
const requireApp = createRequire(new URL("../../App/package.json", import.meta.url));
const { JSDOM } = requireApp("jsdom");
const { CookieJar } = requireApp("tough-cookie");
const BASE = "http://127.0.0.1:18180";
const REALM = "crownicles-discord-identity-proof";
const PROVIDER_PORT = 18181;
const CALLBACK = "http://127.0.0.1:18182/callback";
const MAILPIT = "http://127.0.0.1:18025";
const MAX_REDIRECTS = 20;
const DISCORD_ID = "123456789012345679";
const EMAIL = "collision@example.test";
const CONFIG = {url: BASE, realm: REALM, clientId: "proof-service", clientSecret: "proof-service-local-only"};
const DRIFT_CLIENT = {clientId: "proof-realm-drift", clientSecret: "proof-realm-drift-local-only"};
let adminToken;
let provider;
let legacyId;
let emailId;
let profile = {id: DISCORD_ID, username: "proof-discord", global_name: "Historical player", email: EMAIL, verified: true};

async function admin(route, method = "GET", body) {
	const response = await fetch(`${BASE}/admin/realms${route}`, {
		method,
		headers: {Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json"},
		...(body ? {body: JSON.stringify(body)} : {})
	});
	assert.ok(response.ok, `${method} ${route}: HTTP ${response.status}`);
	return [201, 204].includes(response.status) ? null : response.json();
}

async function createUser(user) {
	await admin(`/${REALM}/users`, "POST", user);
	const users = await admin(`/${REALM}/users?username=${encodeURIComponent(user.username)}&exact=true`);
	assert.equal(users.length, 1);
	return users[0].id;
}

function providerRequest(request, response) {
	const url = new URL(request.url, `http://127.0.0.1:${PROVIDER_PORT}`);
	if (url.pathname === "/authorize") {
		const redirect = new URL(url.searchParams.get("redirect_uri"));
		redirect.searchParams.set("code", "synthetic-discord-code");
		redirect.searchParams.set("state", url.searchParams.get("state"));
		response.writeHead(302, {Location: redirect.href});
		response.end();
		return;
	}
	response.setHeader("Content-Type", "application/json");
	if (url.pathname === "/token") {
		response.end(JSON.stringify({access_token: "synthetic-discord-token", token_type: "Bearer", expires_in: 300}));
		return;
	}
	if (url.pathname === "/userinfo") {
		response.end(JSON.stringify(profile));
		return;
	}
	response.writeHead(404);
	response.end("{}");
}

function authorizationUrl({register, credentials, state, verifier}) {
	const url = new URL(`${BASE}/realms/${REALM}/protocol/openid-connect/auth`);
	url.search = new URLSearchParams({client_id: "proof-app", redirect_uri: CALLBACK, response_type: "code", scope: "openid", kc_idp_hint: "discord", prompt: "login", state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url")}).toString();
	if (register) {
		url.searchParams.delete("kc_idp_hint");
		url.searchParams.set("prompt", "create");
	}
	if (credentials) url.searchParams.delete("kc_idp_hint");
	return url.href;
}

async function exchangeCode(current, {state, verifier}) {
	const callback = new URL(current);
	assert.equal(callback.searchParams.get("state"), state);
	const token = await fetch(`${BASE}/realms/${REALM}/protocol/openid-connect/token`, {
		method: "POST",
		body: new URLSearchParams({client_id: "proof-app", grant_type: "authorization_code", code: callback.searchParams.get("code"), redirect_uri: CALLBACK, code_verifier: verifier})
	});
	assert.equal(token.status, 200);
	const payload = await token.json();
	const userInfo = await fetch(`${BASE}/realms/${REALM}/protocol/openid-connect/userinfo`, {headers: {Authorization: `Bearer ${payload.access_token}`}}).then(response => response.json());
	return {sub: userInfo.sub, provider: userInfo.identity_provider, accessToken: payload.access_token};
}

async function browse(jar, current, formBody) {
	const response = await fetch(current, {method: formBody ? "POST" : "GET", redirect: "manual", headers: {Cookie: await jar.getCookieString(current, {secure: current.startsWith(BASE)})}, ...(formBody ? {body: formBody} : {})});
	for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, current);
	return response;
}

function loginSubmission(document, credentials, current) {
	const form = document.querySelector("form");
	if (!form) return null;
	const formBody = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	formBody.set("username", credentials.username);
	formBody.set("password", credentials.password);
	return {current: new URL(form.action, current).href, formBody};
}

function landingPage(document, {status, url, jar}) {
	return {document, status, url, jar, cookies: jar.serializeSync().cookies.map(({key, domain, path, secure}) => ({key, domain, path, secure}))};
}

async function authorize(register = false, credentials) {
	const proof = {verifier: randomUUID().replaceAll("-", "").repeat(2), state: randomUUID()};
	const jar = new CookieJar();
	let current = authorizationUrl({register, credentials, ...proof});
	let formBody;
	let pendingCredentials = credentials;
	for (let redirectCount = 0; redirectCount < MAX_REDIRECTS; redirectCount++) {
		if (current.startsWith(CALLBACK)) return exchangeCode(current, proof);
		const response = await browse(jar, current, formBody);
		formBody = undefined;
		const redirect = response.headers.get("location");
		if (redirect) {
			current = new URL(redirect, current).href;
			continue;
		}
		const document = new JSDOM(await response.text()).window.document;
		const login = pendingCredentials ? loginSubmission(document, pendingCredentials, current) : null;
		if (!login) return landingPage(document, {status: response.status, url: current, jar});
		({current, formBody} = login);
		pendingCredentials = undefined;
	}
	throw new Error("Too many authentication redirects");
}

/** The action link of the latest mail sent to an address, or null when none arrived. */
async function mailedActionLink(address) {
	const messages = await fetch(`${MAILPIT}/api/v1/messages`).then(response => response.json());
	const message = messages.messages.find(candidate => candidate.To.some(recipient => recipient.Address === address));
	if (!message) return null;
	const mail = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`).then(response => response.json());
	return [...new JSDOM(mail.HTML).window.document.querySelectorAll("a[href]")].find(anchor => anchor.href.includes("action-token"))?.href ?? null;
}

/** Opens the sign-in page of an application-initiated action meant for one account. */
async function openAccountAction(action, targetId) {
	const proof = {verifier: randomUUID().replaceAll("-", "").repeat(2), state: randomUUID()};
	const jar = new CookieJar();
	const url = new URL(authorizationUrl({credentials: true, ...proof}));
	url.searchParams.set("kc_action", action);
	url.searchParams.set("crownicles_account", targetId);
	const entry = await browse(jar, url.href);
	return {jar, proof, url: url.href, document: new JSDOM(await entry.text()).window.document};
}

/** Another step of the same authentication session, such as signing up or a forgotten password. */
function loginActionUrl({document, url}, action) {
	const form = new URL(document.querySelector("form").action, url);
	const target = new URL(`${BASE}/realms/${REALM}/login-actions/${action}`);
	for (const name of ["client_id", "tab_id", "client_data"]) {
		if (form.searchParams.has(name)) target.searchParams.set(name, form.searchParams.get(name));
	}
	return target.href;
}

/** Fills the sign-up form reached from an account action meant for an existing account. */
async function signUpDuringAccountAction(targetId) {
	const email = `signup-action-${randomUUID()}@example.test`;
	const session = await openAccountAction("UPDATE_EMAIL", targetId);
	const signup = await browse(session.jar, loginActionUrl(session, "registration"));
	const form = new JSDOM(await signup.text()).window.document.querySelector("form");
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("username", `signup-${randomUUID().slice(0, 8)}`);
	values.set("email", email);
	const response = await browse(session.jar, new URL(form.action, session.url).href, values);
	return {email, response, document: new JSDOM(await response.text()).window.document};
}

function realmDrift(...flags) {
	const result = spawnSync(process.execPath, [new URL("../scripts/realmDrift.mjs", import.meta.url).pathname, ...flags], {encoding: "utf8", env: {...process.env, KEYCLOAK_URL: BASE, KEYCLOAK_REALM: REALM, KEYCLOAK_CLIENT_ID: DRIFT_CLIENT.clientId, KEYCLOAK_CLIENT_SECRET: DRIFT_CLIENT.clientSecret}});
	assert.ok([0, 1].includes(result.status), result.stderr);
	return {status: result.status, report: JSON.parse(result.stdout)};
}

before(async () => {
	const response = await fetch(`${BASE}/realms/master/protocol/openid-connect/token`, {method: "POST", body: new URLSearchParams({client_id: "admin-cli", grant_type: "password", username: "proof-admin", password: "local-proof-only-password"})});
	assert.equal(response.status, 200, "Only the disposable proof container is supported");
	adminToken = (await response.json()).access_token;
	const template = JSON.parse(readFileSync(new URL("../realm.json", import.meta.url), "utf8"));
	const discord = template.identityProviders.find(identity => identity.alias === "discord");
	const removeExisting = await fetch(`${BASE}/admin/realms/${REALM}`, {method: "DELETE", headers: {Authorization: `Bearer ${adminToken}`}});
	assert.ok([204, 404].includes(removeExisting.status));
	await admin("", "POST", {
		realm: REALM, enabled: true, sslRequired: "none", duplicateEmailsAllowed: false, verifyEmail: template.verifyEmail, registrationAllowed: template.registrationAllowed,
		resetPasswordAllowed: template.resetPasswordAllowed,
		eventsListeners: template.eventsListeners,
		registrationFlow: template.registrationFlow,
		resetCredentialsFlow: template.resetCredentialsFlow,
		authenticationFlows: template.authenticationFlows.map(({id, ...flow}) => flow),
		authenticatorConfig: template.authenticatorConfig.map(({id, ...config}) => config),
		requiredActions: template.requiredActions,
		identityProviders: [{...discord, internalId: undefined, config: {...discord.config, clientId: "synthetic-provider", clientSecret: "synthetic-only", authorizationUrl: `http://127.0.0.1:${PROVIDER_PORT}/authorize`, tokenUrl: `http://host.docker.internal:${PROVIDER_PORT}/token`, userInfoUrl: `http://host.docker.internal:${PROVIDER_PORT}/userinfo`}}],
		identityProviderMappers: template.identityProviderMappers.map(({id, ...mapper}) => mapper),
		clients: [
			{clientId: "proof-app", publicClient: true, standardFlowEnabled: true, redirectUris: [CALLBACK], protocolMappers: template.clients.find(client => client.clientId === "crownicles-app").protocolMappers},
			{clientId: CONFIG.clientId, secret: CONFIG.clientSecret, serviceAccountsEnabled: true, publicClient: false, standardFlowEnabled: false},
			{clientId: DRIFT_CLIENT.clientId, secret: DRIFT_CLIENT.clientSecret, serviceAccountsEnabled: true, publicClient: false, standardFlowEnabled: false}
		]
	});
	const userProfile = JSON.parse(template.components["org.keycloak.userprofile.UserProfileProvider"][0].config["kc.user.profile.config"][0]);
	await admin(`/${REALM}/users/profile`, "PUT", userProfile);
	const clients = await admin(`/${REALM}/clients`);
	const management = clients.find(client => client.clientId === "realm-management");
	const roles = await admin(`/${REALM}/clients/${management.id}/roles`);
	for (const [clientId, granted] of [
		[CONFIG.clientId, ["manage-users", "view-users", "query-users"]],
		[DRIFT_CLIENT.clientId, ["view-realm", "manage-realm", "view-identity-providers", "manage-identity-providers"]]
	]) {
		const serviceUser = await admin(`/${REALM}/clients/${clients.find(client => client.clientId === clientId).id}/service-account-user`);
		await admin(`/${REALM}/users/${serviceUser.id}/role-mappings/clients/${management.id}`, "POST", roles.filter(role => granted.includes(role.name)));
	}
	legacyId = await createUser({username: `discord-${DISCORD_ID}`, enabled: true, attributes: {discordId: [DISCORD_ID], gameUsername: ["Historical player"], language: ["fr"]}});
	emailId = await createUser({username: "email-player", email: EMAIL, emailVerified: true, enabled: true, firstName: "Email", lastName: "Player", credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	provider = createServer(providerRequest);
	await new Promise(resolve => provider.listen(PROVIDER_PORT, "0.0.0.0", resolve));
});

after(async () => {
	if (provider) await new Promise(resolve => provider.close(resolve));
});

test("real Keycloak: reproduce email collision, then preserve the historical subject after explicit linking", async () => {
	const beforeLink = await authorize();
	assert.ok(beforeLink.document, "The unlinked legacy identity should not reach the app");
	assert.ok(beforeLink.document.body.textContent.includes(EMAIL), `Unexpected broker page: ${beforeLink.document.title}; cookies: ${JSON.stringify(beforeLink.cookies)}`);
	const user = await KeycloakUtils.getUserByKeycloakId(CONFIG, legacyId);
	assert.equal(user.isError, false);
	const linked = await KeycloakUtils.linkLegacyDiscordUser(CONFIG, user.payload.user);
	assert.equal(linked.isError, false);
	assert.equal(linked.payload.changed, true);
	const afterLink = await authorize();
	assert.equal(afterLink.sub, legacyId, afterLink.document?.body.textContent.trim());
	assert.equal(afterLink.provider, "discord");
	const authenticated = await admin(`/${REALM}/users/${legacyId}`);
	assert.deepEqual(authenticated.attributes.discordEmail, [EMAIL]);
	assert.deepEqual(authenticated.attributes.discordEmailVerified, ["true"]);
	assert.notEqual(afterLink.sub, emailId);
	const repeated = await KeycloakUtils.linkLegacyDiscordUser(CONFIG, user.payload.user);
	assert.deepEqual(repeated.payload, {changed: false});
	assert.equal((await admin(`/${REALM}/users/${legacyId}`)).username, `discord-${DISCORD_ID}`);
	assert.equal((await admin(`/${REALM}/users/${emailId}`)).email, EMAIL);
});

test("real Keycloak: new bot accounts authenticate as their original subject despite a concurrent email account", async () => {
	const discordId = "123456789012345680";
	profile = {...profile, id: discordId, email: "new-collision@example.test"};
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: "New bot player", language: "fr"});
	assert.equal(created.isError, false);
	const otherId = await createUser({username: "new-email-player", email: profile.email, emailVerified: true, enabled: true});
	const result = await authorize();
	assert.equal(result.sub, created.payload.user.id, result.document?.body.textContent.trim());
	assert.notEqual(result.sub, otherId);
});

test("real Keycloak: a conflicting identity is refused without moving or merging either account", async () => {
	const discordId = "123456789012345681";
	const historical = await createUser({username: `discord-${discordId}`, enabled: true, attributes: {discordId: [discordId], gameUsername: ["Conflict player"]}});
	const other = await createUser({username: "conflicting-email-player", enabled: true, federatedIdentities: [{identityProvider: "discord", userId: discordId, userName: "other"}]});
	const user = await KeycloakUtils.getUserByKeycloakId(CONFIG, historical);
	const result = await KeycloakUtils.linkLegacyDiscordUser(CONFIG, user.payload.user);
	assert.equal(result.isError, true);
	assert.equal(result.status, 409);
	assert.equal((await admin(`/${REALM}/users/${historical}/federated-identity`)).length, 0);
	assert.equal((await admin(`/${REALM}/users/${other}/federated-identity`))[0].userId, discordId);
});

test("real Keycloak: the backfill is read-only by default and can be repeated safely", async () => {
	const pendingId = "123456789012345682";
	const pendingUser = await createUser({username: `discord-${pendingId}`, enabled: true, attributes: {discordId: [pendingId], gameUsername: ["Pending legacy"]}});
	const result = spawnSync(process.execPath, [new URL("../scripts/linkLegacyDiscordAccounts.mjs", import.meta.url).pathname], {encoding: "utf8", env: {...process.env, KEYCLOAK_URL: BASE, KEYCLOAK_REALM: REALM, KEYCLOAK_CLIENT_ID: CONFIG.clientId, KEYCLOAK_CLIENT_SECRET: CONFIG.clientSecret}});
	const report = JSON.parse(result.stdout);
	assert.equal(report.mode, "read-only");
	assert.equal(report.linked, 0);
	assert.ok(report.alreadyLinked >= 2);
	assert.equal(report.conflicts, 1);
	assert.equal((await admin(`/${REALM}/users/${pendingUser}/federated-identity`)).length, 0);
	const apply = spawnSync(process.execPath, [new URL("../scripts/linkLegacyDiscordAccounts.mjs", import.meta.url).pathname, "--apply"], {encoding: "utf8", env: {...process.env, KEYCLOAK_URL: BASE, KEYCLOAK_REALM: REALM, KEYCLOAK_CLIENT_ID: CONFIG.clientId, KEYCLOAK_CLIENT_SECRET: CONFIG.clientSecret}});
	assert.equal(JSON.parse(apply.stdout).linked, 1);
	assert.equal((await admin(`/${REALM}/users/${pendingUser}/federated-identity`))[0].userId, pendingId);
	const repeat = spawnSync(process.execPath, [new URL("../scripts/linkLegacyDiscordAccounts.mjs", import.meta.url).pathname, "--apply"], {encoding: "utf8", env: {...process.env, KEYCLOAK_URL: BASE, KEYCLOAK_REALM: REALM, KEYCLOAK_CLIENT_ID: CONFIG.clientId, KEYCLOAK_CLIENT_SECRET: CONFIG.clientSecret}});
	assert.equal(JSON.parse(repeat.stdout).linked, 0);
});

test("real Keycloak: registration still rejects a missing email", async () => {
	const page = await authorize(true);
	const form = page.document.querySelector("form");
	assert.ok(form, page.document.body.textContent.trim());
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("username", "registration-without-email");
	values.set("email", "");
	values.set("password", "synthetic-password-only");
	values.set("password-confirm", "synthetic-password-only");
	const url = new URL(form.action, page.url).href;
	const response = await fetch(url, {method: "POST", redirect: "manual", headers: {Cookie: await page.jar.getCookieString(url, {secure: true})}, body: values});
	const document = new JSDOM(await response.text()).window.document;
	assert.ok(document.querySelector("#input-error-email"), document.body.textContent.trim());
	assert.equal((await admin(`/${REALM}/users?username=registration-without-email&exact=true`)).length, 0);
});

test("real Keycloak: registration refuses an email already belonging to another account", async () => {
	const response = await fetch(`${BASE}/admin/realms/${REALM}/users`, {method: "POST", headers: {Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json"}, body: JSON.stringify({username: "duplicate-email-player", email: EMAIL, enabled: true})});
	assert.equal(response.status, 409);
	assert.equal((await admin(`/${REALM}/users?username=duplicate-email-player&exact=true`)).length, 0);
});

test("real Keycloak: registration rejects a reserved bot username before creating an identity", async () => {
	const username = "discord-123456789012349999";
	const page = await authorize(true);
	const form = page.document.querySelector("form");
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("username", username);
	values.set("email", "reserved-proof@example.test");
	const response = await browse(page.jar, form.action, values);
	const document = new JSDOM(await response.text()).window.document;
	assert.equal(response.status, 200);
	assert.ok(document.querySelector("#input-error-username"), document.body.textContent.trim());
	assert.equal((await admin(`/${REALM}/users?username=${username}&exact=true`)).length, 0);
});

for (const choice of ["discord", "email"]) {
	test(`real Keycloak: explicit ${choice} choice deletes only the other identity and retains the chosen subject`, async () => {
		const discordId = choice === "discord" ? "123456789012345690" : "123456789012345691";
		const email = `choose-${choice}@example.test`;
		const username = `choose-${choice}-email`;
		const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: `Historical ${choice}`, language: "fr"});
		assert.equal(created.isError, false);
		const otherId = await createUser({username, email, emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
		profile = {...profile, id: discordId, email, verified: true};
		const discordSession = await authorize();
		const emailSession = await authorize(false, {username, password: "synthetic-password-only"});
		assert.equal(discordSession.sub, created.payload.user.id);
		assert.equal(emailSession.sub, otherId, emailSession.document?.body.textContent.trim());
		const service = new AccountCollisionService(CONFIG);
		assert.ok((await service.check(discordSession.accessToken)).collision);
		const kept = choice === "discord" ? discordSession : emailSession;
		const discarded = choice === "discord" ? emailSession : discordSession;
		assert.deepEqual(await service.resolve(kept.accessToken, discarded.accessToken, choice), {kept: choice});
		const deleted = await fetch(`${BASE}/admin/realms/${REALM}/users/${discarded.sub}`, {headers: {Authorization: `Bearer ${adminToken}`}});
		assert.equal(deleted.status, 404);
		const current = await admin(`/${REALM}/users/${kept.sub}`);
		assert.equal(current.id, kept.sub);
		assert.equal(current.email, email);
		assert.equal(current.attributes.accountCollisionResolution, undefined);
		assert.equal((await admin(`/${REALM}/users/${kept.sub}/federated-identity`))[0].userId, discordId);
		const nextDiscordLogin = await authorize();
		assert.equal(nextDiscordLogin.sub, kept.sub);
	});
}

test("real Keycloak: the shared address alone keeps its account and takes over the Discord identity", async () => {
	const discordId = "123456789012345694";
	const email = `address-alone-${randomUUID()}@example.test`;
	const username = `address-alone-${randomUUID().slice(0, 8)}`;
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: "Discarded by its address", language: "fr"});
	assert.equal(created.isError, false);
	const keptId = await createUser({username, email, emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	profile = {...profile, id: discordId, email, verified: true};
	assert.equal((await authorize()).sub, created.payload.user.id);
	const emailSession = await authorize(false, {username, password: "synthetic-password-only"});
	assert.equal(emailSession.sub, keptId, emailSession.document?.body.textContent.trim());
	const service = new AccountCollisionService(CONFIG);
	assert.equal((await service.check(emailSession.accessToken)).current, "email");
	assert.deepEqual(await service.resolve(emailSession.accessToken, "", "email"), {kept: "email"});
	const deleted = await fetch(`${BASE}/admin/realms/${REALM}/users/${created.payload.user.id}`, {headers: {Authorization: `Bearer ${adminToken}`}});
	assert.equal(deleted.status, 404);
	assert.equal((await authorize()).sub, keptId);
});

test("real Keycloak: a Discord sign-in gives an account without address its verified Discord one, closing sign-up with it", async () => {
	const discordId = "123456789012345695";
	const email = `adopted-${randomUUID()}@example.test`;
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: "Adopting hero", language: "fr"});
	assert.equal(created.isError, false);
	profile = {...profile, id: discordId, email, verified: true};
	assert.equal((await authorize()).sub, created.payload.user.id);
	const adopted = await admin(`/${REALM}/users/${created.payload.user.id}`);
	assert.equal(adopted.email, email);
	assert.equal(adopted.emailVerified, true);
	const signup = await authorize(true);
	const form = signup.document.querySelector("form");
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("username", "adopted-address-copy");
	values.set("email", email);
	const refused = await browse(signup.jar, form.action, values);
	assert.ok(new JSDOM(await refused.text()).window.document.querySelector("#input-error-email"));
	assert.equal((await admin(`/${REALM}/users?username=adopted-address-copy&exact=true`)).length, 0);
});

test("real Keycloak: a Discord address another account holds is left to it, and the sign-in still opens the collision", async () => {
	const discordId = "123456789012345696";
	const email = `held-${randomUUID()}@example.test`;
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: "Late Discord hero", language: "fr"});
	assert.equal(created.isError, false);
	await createUser({username: `held-${randomUUID().slice(0, 8)}`, email, emailVerified: true, enabled: true});
	profile = {...profile, id: discordId, email, verified: true};
	const session = await authorize();
	assert.equal(session.sub, created.payload.user.id);
	assert.equal((await admin(`/${REALM}/users/${created.payload.user.id}`)).email, undefined);
	assert.ok((await new AccountCollisionService(CONFIG).check(session.accessToken)).collision);
});

test("real Keycloak: an interrupted email choice remains the bot owner and can finish", async () => {
	const discordId = "123456789012345692";
	const email = "interrupted-choice@example.test";
	const username = "interrupted-choice-email";
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: "Discarded hero", language: "fr"});
	assert.equal(created.isError, false);
	const keptId = await createUser({username, email, emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	profile = {...profile, id: discordId, email, verified: true};
	const discordSession = await authorize();
	const emailSession = await authorize(false, {username, password: "synthetic-password-only"});
	const service = new AccountCollisionService(CONFIG);
	const linkIdentity = ServiceKeycloakUtils.linkDiscordIdentity;
	ServiceKeycloakUtils.linkDiscordIdentity = async () => ({isError: true, status: 503, payload: {}});
	try {
		await assert.rejects(service.resolve(emailSession.accessToken, discordSession.accessToken, "email"), {status: 409});
	}
	finally {
		ServiceKeycloakUtils.linkDiscordIdentity = linkIdentity;
	}
	const deleted = await fetch(`${BASE}/admin/realms/${REALM}/users/${created.payload.user.id}`, {headers: {Authorization: `Bearer ${adminToken}`}});
	assert.equal(deleted.status, 404);
	const botLookup = await KeycloakUtils.getOrRegisterDiscordUser(CONFIG, discordId, "Kept bot hero", "fr");
	assert.equal(botLookup.isError, false);
	assert.equal(botLookup.payload.user.id, keptId);
	assert.deepEqual(await new AccountCollisionService(CONFIG).check(emailSession.accessToken), {collision: null, pending: "email"});
	assert.deepEqual(await new AccountCollisionService(CONFIG).resolve(emailSession.accessToken, "", "email"), {kept: "email"});
	const kept = await admin(`/${REALM}/users/${keptId}`);
	assert.deepEqual(kept.attributes.gameUsername, ["Kept bot hero"]);
	assert.equal(kept.attributes.accountCollisionResolution, undefined);
	assert.equal((await authorize()).sub, keptId);
});

test("real Keycloak: Discord's public name survives without a global display name", async () => {
	const discordId = "123456789012345693";
	const email = "discord-public-name@example.test";
	const created = await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${discordId}`, discordId, gameUsername: `discord-${discordId}`, language: "fr"});
	assert.equal(created.isError, false);
	await createUser({username: "public-name-email", email, emailVerified: true, enabled: true});
	profile = {...profile, id: discordId, username: "public.discord.name", global_name: null, email, verified: true};
	const session = await authorize();
	assert.equal(session.sub, created.payload.user.id);
	const check = await new AccountCollisionService(CONFIG).check(session.accessToken);
	assert.equal(check.collision.discord.name, "public.discord.name");
	profile = {...profile, global_name: "Public display name"};
	const renamedSession = await authorize();
	assert.equal((await new AccountCollisionService(CONFIG).check(renamedSession.accessToken)).collision.discord.name, "Public display name");
	assert.deepEqual((await admin(`/${REALM}/users/${session.sub}`)).attributes.gameUsername, [`discord-${discordId}`]);
});

test("real Keycloak: a password-bearing account defaults to an emailed link and keeps password optional", async () => {
	const template = JSON.parse(readFileSync(new URL("../realm.json", import.meta.url), "utf8"));
	await admin(`/${REALM}`, "PUT", {browserFlow: template.browserFlow, loginTheme: "crownicles", emailTheme: "crownicles", smtpServer: {host: "host.docker.internal", port: "11025", from: "proof@example.test", auth: "false"}});
	const email = "password-optional-proof@example.test";
	const username = "password-optional-proof";
	const userId = await createUser({username, email, emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	const proof = {verifier: randomUUID().replaceAll("-", "").repeat(2), state: randomUUID()};
	const jar = new CookieJar();
	const authUrl = new URL(authorizationUrl({credentials: true, ...proof}));
	authUrl.searchParams.set("login_hint", email);
	authUrl.searchParams.set("ui_locales", "fr");
	const login = await browse(jar, authUrl.href);
	const document = new JSDOM(await login.text()).window.document;
	const form = document.querySelector("form");
	const response = await browse(jar, new URL(form.action, authUrl).href, new URLSearchParams({username: email}));
	const waiting = new JSDOM(await response.text()).window.document;
	assert.ok(waiting.querySelector("#crownicles-link-status"), "Email must be the default, even when a password exists");
	assert.equal(waiting.querySelector("input[type=password]"), null);
	const link = await mailedActionLink(email);
	assert.ok(link, "A sign-in email must be sent");
	const opened = await fetch(link);
	assert.equal(opened.status, 200);
	const carryOn = waiting.querySelector("#crownicles-link-continue");
	const completed = await browse(jar, carryOn.href);
	assert.ok(completed.headers.get("location")?.startsWith(CALLBACK));
	assert.equal((await exchangeCode(completed.headers.get("location"), proof)).sub, userId);
	const passwordProof = {verifier: randomUUID().replaceAll("-", "").repeat(2), state: randomUUID()};
	const passwordJar = new CookieJar();
	const passwordAuthUrl = new URL(authorizationUrl({credentials: true, ...passwordProof}));
	passwordAuthUrl.searchParams.set("login_hint", email);
	const passwordEntry = await browse(passwordJar, passwordAuthUrl.href);
	const passwordEntryDocument = new JSDOM(await passwordEntry.text()).window.document;
	const passwordEntryForm = passwordEntryDocument.querySelector("form");
	const passwordWaitingResponse = await browse(passwordJar, passwordEntryForm.action, new URLSearchParams({username: email}));
	const passwordWaiting = new JSDOM(await passwordWaitingResponse.text()).window.document;
	const methodsForm = passwordWaiting.querySelector("#kc-select-try-another-way-form");
	assert.ok(methodsForm, "The player must still be able to choose another method");
	const methodsResponse = await browse(passwordJar, methodsForm.action, new URLSearchParams({tryAnotherWay: "on"}));
	const methods = new JSDOM(await methodsResponse.text()).window.document;
	const passwordMethod = [...methods.querySelectorAll("button[name=authenticationExecution]")].find(button => !button.textContent.includes("email"));
	assert.ok(passwordMethod);
	const passwordFormResponse = await browse(passwordJar, passwordMethod.closest("form").action, new URLSearchParams({authenticationExecution: passwordMethod.value}));
	const passwordForm = new JSDOM(await passwordFormResponse.text()).window.document.querySelector("form");
	assert.ok(passwordForm.querySelector("input[type=password]"));
	const passwordValues = new URLSearchParams([...passwordForm.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	passwordValues.set("password", "synthetic-password-only");
	const passwordResult = await browse(passwordJar, passwordForm.action, passwordValues);
	assert.ok(passwordResult.headers.get("location")?.startsWith(CALLBACK));
	assert.equal((await exchangeCode(passwordResult.headers.get("location"), passwordProof)).sub, userId);
});

async function openPasswordAction(targetId, username) {
	const {jar, proof, document: entryDocument} = await openAccountAction("UPDATE_PASSWORD", targetId);
	const entryForm = entryDocument.querySelector("form");
	const waitingResponse = await browse(jar, entryForm.action, new URLSearchParams({username}));
	const waiting = new JSDOM(await waitingResponse.text()).window.document;
	const optionsResponse = await browse(jar, waiting.querySelector("#kc-select-try-another-way-form").action, new URLSearchParams({tryAnotherWay: "on"}));
	const options = new JSDOM(await optionsResponse.text()).window.document;
	const method = [...options.querySelectorAll("button[name=authenticationExecution]")].find(button => !button.textContent.includes("email"));
	const passwordResponse = await browse(jar, method.closest("form").action, new URLSearchParams({authenticationExecution: method.value}));
	const passwordForm = new JSDOM(await passwordResponse.text()).window.document.querySelector("form");
	const values = new URLSearchParams([...passwordForm.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("password", "synthetic-password-only");
	let response = await browse(jar, passwordForm.action, values);
	for (let redirectCount = 0; redirectCount < MAX_REDIRECTS; redirectCount++) {
		const redirect = response.headers.get("location");
		if (!redirect || redirect.startsWith(CALLBACK)) break;
		response = await browse(jar, new URL(redirect, BASE).href);
	}
	return {response, jar, proof};
}

test("real Keycloak: a wrong account cannot reach an application-initiated password action", async () => {
	const targetId = await createUser({username: "action-target", email: "action-target@example.test", emailVerified: true, enabled: true});
	const wrongId = await createUser({username: "action-other", email: "action-other@example.test", emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	const {response: refused} = await openPasswordAction(targetId, "action-other");
	assert.equal(refused.status, 400);
	assert.equal(new JSDOM(await refused.text()).window.document.querySelector("input[name=password-new]"), null);
	assert.equal((await admin(`/${REALM}/users/${wrongId}/credentials`)).length, 1);
	assert.equal((await admin(`/${REALM}/users/${targetId}/credentials`)).length, 0);
});

test("real Keycloak: the intended account completes its password action with a correlated PKCE code", async () => {
	const username = "action-success";
	const targetId = await createUser({username, email: "action-success@example.test", emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	const {response, jar, proof} = await openPasswordAction(targetId, username);
	assert.equal(response.status, 200);
	const form = new JSDOM(await response.text()).window.document.querySelector("form");
	assert.ok(form.querySelector("input[name=password-new]"));
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("password-new", "synthetic-new-password-only");
	values.set("password-confirm", "synthetic-new-password-only");
	const completed = await browse(jar, form.action, values);
	const callback = new URL(completed.headers.get("location"));
	assert.equal(callback.searchParams.get("state"), proof.state);
	assert.equal(callback.searchParams.get("kc_action_status"), "success");
	assert.ok(callback.searchParams.get("code"));
	assert.equal((await exchangeCode(callback.href, proof)).sub, targetId);
});

async function brokeredEmailAction(targetId) {
	const proof = {verifier: randomUUID().replaceAll("-", "").repeat(2), state: randomUUID()};
	const jar = new CookieJar();
	const url = new URL(authorizationUrl(proof));
	url.searchParams.set("kc_action", "UPDATE_EMAIL");
	url.searchParams.set("crownicles_account", targetId);
	let current = url.href;
	let response;
	for (let redirectCount = 0; redirectCount < MAX_REDIRECTS; redirectCount++) {
		response = await browse(jar, current);
		const redirect = response.headers.get("location");
		if (!redirect || redirect.startsWith(CALLBACK)) break;
		current = new URL(redirect, current).href;
	}
	return response;
}

test("real Keycloak: signing in through Discord cannot run an account action meant for another account", async () => {
	const discordId = "923456789012345777";
	profile = {...profile, id: discordId, email: "brokered-action@example.test", global_name: "Brokered"};
	const discordUser = await createUser({username: `discord-${discordId}`, enabled: true, attributes: {discordId: [discordId], gameUsername: ["Brokered"]}, federatedIdentities: [{identityProvider: "discord", userId: discordId, userName: "brokered"}]});
	const emailTarget = await createUser({username: "brokered-target", email: "brokered-target@example.test", emailVerified: true, enabled: true});
	const refused = await brokeredEmailAction(emailTarget);
	assert.equal(refused.status, 400);
	assert.equal(new JSDOM(await refused.text()).window.document.querySelector("input[name=email]"), null);
	const allowed = await brokeredEmailAction(discordUser);
	assert.equal(allowed.status, 200);
	assert.ok(new JSDOM(await allowed.text()).window.document.querySelector("input[name=email]"), "The Discord account keeps its own email action");
});

test("real Keycloak: confirming a registration retires only its pending marker", async () => {
	const username = "RegisteredHero";
	const email = "registration-confirmed-proof@example.test";
	const signup = await authorize(true);
	const form = signup.document.querySelector("form");
	const values = new URLSearchParams([...form.querySelectorAll("input[name]")].map(input => [input.name, input.value]));
	values.set("username", username);
	values.set("email", email);
	const submitted = await browse(signup.jar, form.action, values);
	assert.equal(submitted.status, 200);
	const waiting = new JSDOM(await submitted.text()).window.document;
	const users = await admin(`/${REALM}/users?username=${username.toLowerCase()}&exact=true`);
	assert.equal(users.length, 1);
	const pending = await admin(`/${REALM}/users/${users[0].id}`);
	assert.equal(pending.emailVerified, false);
	assert.deepEqual(pending.attributes.registrationPending, ["true"]);
	assert.deepEqual(pending.attributes.gameUsername, [username]);
	const link = await mailedActionLink(email);
	assert.ok(link);
	assert.equal((await fetch(link)).status, 200);
	const completed = await browse(signup.jar, waiting.querySelector("#crownicles-link-continue").href);
	assert.ok(completed.headers.get("location")?.startsWith(CALLBACK));
	const confirmed = await admin(`/${REALM}/users/${pending.id}`);
	assert.equal(confirmed.email, email);
	assert.equal(confirmed.emailVerified, true);
	assert.equal(confirmed.attributes.registrationPending, undefined);
	assert.deepEqual(confirmed.attributes.gameUsername, [username]);
});

test("real Keycloak: signing up cannot take over an account action meant for another account", async () => {
	const targetId = await createUser({username: "signup-action-target", email: "signup-action-target@example.test", emailVerified: true, enabled: true});
	const {email, response, document} = await signUpDuringAccountAction(targetId);
	assert.equal(response.status, 400);
	assert.equal(document.querySelector("#crownicles-link-status"), null);
	assert.equal(document.querySelector("input[name=email]"), null);
	assert.equal(await mailedActionLink(email), null, "No sign-up link may be sent for an account action");
});

test("real Keycloak: a forgotten password cannot take over an account action meant for another account", async () => {
	const targetId = await createUser({username: "reset-action-target", email: "reset-action-target@example.test", emailVerified: true, enabled: true});
	const email = `reset-action-${randomUUID()}@example.test`;
	const otherId = await createUser({username: "reset-action-other", email, emailVerified: true, enabled: true, credentials: [{type: "password", value: "synthetic-password-only", temporary: false}]});
	const [password] = await admin(`/${REALM}/users/${otherId}/credentials`);
	const session = await openAccountAction("UPDATE_PASSWORD", targetId);
	const reset = await browse(session.jar, loginActionUrl(session, "reset-credentials"));
	const form = new JSDOM(await reset.text()).window.document.querySelector("form");
	const sent = await browse(session.jar, new URL(form.action, session.url).href, new URLSearchParams({username: email}));
	assert.equal(sent.status, 200);
	const link = await mailedActionLink(email);
	assert.ok(link, "The owner of the other account still receives its reset link");
	let opened = await browse(session.jar, link);
	for (let redirectCount = 0; opened.headers.get("location") && redirectCount < MAX_REDIRECTS; redirectCount++) {
		opened = await browse(session.jar, new URL(opened.headers.get("location"), link).href);
	}
	assert.equal(opened.status, 400);
	assert.equal(new JSDOM(await opened.text()).window.document.querySelector("input[name=password-new]"), null);
	assert.deepEqual(await admin(`/${REALM}/users/${otherId}/credentials`), [password]);
});

test("real Keycloak: the realm drift check reports a removed account guard and only --apply restores it", async () => {
	assert.deepEqual(realmDrift(), {status: 0, report: {mode: "read-only", applied: [], drift: []}});
	for (const flow of ["crownicles registration", "crownicles post broker login"]) {
		const guard = (await admin(`/${REALM}/authentication/flows/${encodeURIComponent(flow)}/executions`)).find(execution => execution.providerId === "crownicles-account-target");
		await admin(`/${REALM}/authentication/executions/${guard.id}`, "DELETE");
	}
	await admin(`/${REALM}`, "PUT", {resetCredentialsFlow: "reset credentials"});
	const changed = ["authenticationFlows.crownicles post broker login", "authenticationFlows.crownicles registration", "resetCredentialsFlow"];
	const audit = realmDrift();
	assert.equal(audit.status, 1);
	assert.deepEqual(audit.report.drift.map(difference => difference.setting).sort(), changed);
	assert.equal((await admin(`/${REALM}`)).resetCredentialsFlow, "reset credentials", "The default run must not change the realm");
	const targetId = await createUser({username: "drift-action-target", email: "drift-action-target@example.test", emailVerified: true, enabled: true});
	assert.equal((await signUpDuringAccountAction(targetId)).response.status, 200, "Without its guard the registration flow lets the action through");
	const applied = realmDrift("--apply");
	assert.equal(applied.status, 0, JSON.stringify(applied.report));
	assert.deepEqual(applied.report.applied.sort(), changed);
	assert.deepEqual(realmDrift(), {status: 0, report: {mode: "read-only", applied: [], drift: []}});
	const realm = await admin(`/${REALM}`);
	assert.equal(realm.registrationFlow, "crownicles registration");
	assert.equal(realm.resetCredentialsFlow, "crownicles reset credentials");
	assert.equal((await admin(`/${REALM}/identity-provider/instances/discord`)).postBrokerLoginFlowAlias, "crownicles post broker login");
	assert.ok(!(await admin(`/${REALM}/authentication/flows`)).some(flow => flow.alias.includes(" staged ")), "No staged copy may remain");
	assert.equal((await signUpDuringAccountAction(targetId)).response.status, 400);
	assert.deepEqual(realmDrift("--apply").report, {mode: "apply", applied: [], drift: []});
});