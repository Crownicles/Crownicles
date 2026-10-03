import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { KeycloakUtils } = require("../../Lib/dist/src/keycloak/KeycloakUtils.js");
const { AccountCollisionService } = require("../../RestWs/dist/RestWs/src/services/AccountCollisionService.js");
const requireApp = createRequire(new URL("../../App/package.json", import.meta.url));
const { JSDOM } = requireApp("jsdom");
const { CookieJar } = requireApp("tough-cookie");
const BASE = "http://127.0.0.1:18180";
const REALM = "crownicles-discord-identity-proof";
const PROVIDER_PORT = 18181;
const CALLBACK = "http://127.0.0.1:18182/callback";
const MAX_REDIRECTS = 20;
const DISCORD_ID = "123456789012345679";
const EMAIL = "collision@example.test";
const CONFIG = {url: BASE, realm: REALM, clientId: "proof-service", clientSecret: "proof-service-local-only"};
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
		authenticationFlows: template.authenticationFlows.map(({id, ...flow}) => flow),
		authenticatorConfig: template.authenticatorConfig.map(({id, ...config}) => config),
		requiredActions: template.requiredActions,
		identityProviders: [{...discord, internalId: undefined, config: {...discord.config, clientId: "synthetic-provider", clientSecret: "synthetic-only", authorizationUrl: `http://127.0.0.1:${PROVIDER_PORT}/authorize`, tokenUrl: `http://host.docker.internal:${PROVIDER_PORT}/token`, userInfoUrl: `http://host.docker.internal:${PROVIDER_PORT}/userinfo`}}],
		identityProviderMappers: template.identityProviderMappers.map(({id, ...mapper}) => mapper),
		clients: [
			{clientId: "proof-app", publicClient: true, standardFlowEnabled: true, redirectUris: [CALLBACK], protocolMappers: template.clients.find(client => client.clientId === "crownicles-app").protocolMappers},
			{clientId: CONFIG.clientId, secret: CONFIG.clientSecret, serviceAccountsEnabled: true, publicClient: false, standardFlowEnabled: false}
		]
	});
	const userProfile = JSON.parse(template.components["org.keycloak.userprofile.UserProfileProvider"][0].config["kc.user.profile.config"][0]);
	await admin(`/${REALM}/users/profile`, "PUT", userProfile);
	const clients = await admin(`/${REALM}/clients`);
	const service = clients.find(client => client.clientId === CONFIG.clientId);
	const management = clients.find(client => client.clientId === "realm-management");
	const serviceUser = await admin(`/${REALM}/clients/${service.id}/service-account-user`);
	const roles = await admin(`/${REALM}/clients/${management.id}/roles`);
	await admin(`/${REALM}/users/${serviceUser.id}/role-mappings/clients/${management.id}`, "POST", roles.filter(role => ["manage-users", "view-users", "query-users"].includes(role.name)));
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
		const verified = await service.verify(discordSession.accessToken, emailSession.accessToken);
		const kept = choice === "discord" ? discordSession : emailSession;
		const discarded = choice === "discord" ? emailSession : discordSession;
		assert.deepEqual(await service.resolve(kept.accessToken, verified.proof, choice), {kept: choice});
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