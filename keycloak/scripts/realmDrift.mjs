// Compares the account settings of a deployed realm with keycloak/realm.json and, with --apply, converges
// them. Read-only by default; the exit code stays 1 while a difference remains.
// Only the settings below are managed: the template holds placeholders, not live users, keys or secrets.
// Needs a service account of that realm with the realm-management roles view-realm, manage-realm,
// view-identity-providers and manage-identity-providers.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const APPLY_FLAG = "--apply";
const EXACT_FIELDS = ["registrationAllowed", "resetPasswordAllowed", "verifyEmail", "eventsEnabled"];
const FLOW_BINDINGS = ["browserFlow", "registrationFlow", "resetCredentialsFlow"];
const REFERENCING_BINDINGS = [...FLOW_BINDINGS, "directGrantFlow", "clientAuthenticationFlow", "dockerAuthenticationFlow", "firstBrokerLoginFlow"];
const PROVIDER_FLOWS = ["firstBrokerLoginFlowAlias", "postBrokerLoginFlowAlias"];
const PRIORITY_STEP = 10;
const TEMPLATE = JSON.parse(readFileSync(new URL("../realm.json", import.meta.url), "utf8"));

function configuration() {
	const names = {url: "KEYCLOAK_URL", realm: "KEYCLOAK_REALM", clientId: "KEYCLOAK_CLIENT_ID", clientSecret: "KEYCLOAK_CLIENT_SECRET"};
	return Object.fromEntries(Object.entries(names).map(([field, name]) => {
		const value = process.env[name];
		if (!value) throw new Error(`Missing ${name}`);
		return [field, value];
	}));
}

function applyRequested() {
	const unknown = process.argv.slice(2).filter(argument => argument !== APPLY_FLAG);
	if (unknown.length) throw new Error("Only --apply is supported; default is read-only");
	return process.argv.includes(APPLY_FLAG);
}

async function adminApi(config) {
	const response = await fetch(`${config.url}/realms/${config.realm}/protocol/openid-connect/token`, {
		method: "POST",
		body: new URLSearchParams({grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret})
	});
	if (!response.ok) throw new Error(`Could not authenticate: HTTP ${response.status}`);
	const {access_token: token} = await response.json();
	return async (method, route, body) => {
		const answer = await fetch(`${config.url}/admin/realms/${config.realm}${route}`, {
			method,
			headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
			...(body ? {body: JSON.stringify(body)} : {})
		});
		const text = await answer.text();
		if (!answer.ok) throw new Error(`${method} ${route}: HTTP ${answer.status} ${text}`);
		return {created: answer.headers.get("location")?.split("/").pop(), body: text ? JSON.parse(text) : null};
	};
}

async function liveRealm(api) {
	return (await api("POST", "/partial-export?exportClients=false&exportGroupsAndRoles=false")).body;
}

function byPriority(executions) {
	return [...executions].sort((first, second) => first.priority - second.priority);
}

function findFlow(realm, alias) {
	return realm.authenticationFlows.find(flow => flow.alias === alias);
}

function templateConfig(alias) {
	return TEMPLATE.authenticatorConfig.find(config => config.alias === alias).config;
}

/** A flow as it behaves: its steps in order with their requirement, configuration and nested flows, names aside. */
function flowShape(realm, alias) {
	const flow = findFlow(realm, alias);
	return flow ? {
		providerId: flow.providerId,
		executions: byPriority(flow.authenticationExecutions).map(execution => ({
			requirement: execution.requirement,
			authenticator: execution.authenticator ?? null,
			config: execution.authenticatorConfig ? realm.authenticatorConfig.find(config => config.alias === execution.authenticatorConfig)?.config ?? null : null,
			flow: execution.authenticatorFlow ? flowShape(realm, execution.flowAlias) : null
		}))
	} : null;
}

/** The custom flows the realm must run, as the template's bindings and identity providers name them. */
function managedFlows() {
	const aliases = [...FLOW_BINDINGS.map(binding => TEMPLATE[binding]), ...TEMPLATE.identityProviders.map(provider => provider.postBrokerLoginFlowAlias)];
	return [...new Set(aliases.filter(alias => alias && !findFlow(TEMPLATE, alias).builtIn))];
}

function providerDrift(live) {
	return TEMPLATE.identityProviders.filter(provider => provider.postBrokerLoginFlowAlias).flatMap(provider => {
		const actual = live.identityProviders?.find(candidate => candidate.alias === provider.alias);
		return actual?.postBrokerLoginFlowAlias === provider.postBrokerLoginFlowAlias ? [] : [{
			setting: `identityProviders.${provider.alias}.postBrokerLoginFlowAlias`,
			provider: actual ? provider.alias : null,
			expected: provider.postBrokerLoginFlowAlias,
			actual: actual ? actual.postBrokerLoginFlowAlias ?? null : "missing provider"
		}];
	});
}

function drift(live) {
	const differences = [...EXACT_FIELDS, ...FLOW_BINDINGS]
		.filter(field => live[field] !== TEMPLATE[field])
		.map(field => ({setting: field, expected: TEMPLATE[field], actual: live[field] ?? null}));
	const missingListeners = TEMPLATE.eventsListeners.filter(listener => !live.eventsListeners?.includes(listener));
	if (missingListeners.length) differences.push({setting: "eventsListeners", expected: missingListeners, actual: live.eventsListeners ?? []});
	for (const alias of managedFlows()) {
		const actual = flowShape(live, alias);
		if (!isDeepStrictEqual(actual, flowShape(TEMPLATE, alias))) differences.push({setting: `authenticationFlows.${alias}`, expected: "as in realm.json", actual: actual ? "different" : "missing"});
	}
	return [...differences, ...providerDrift(live)];
}

/** Adds a template flow's steps, in order, to its staged copy; nested flows are staged the same way. */
async function stageSteps(api, {alias, stage, renames}) {
	const stagedAlias = `${alias}${stage}`;
	for (const [position, execution] of byPriority(findFlow(TEMPLATE, alias).authenticationExecutions).entries()) {
		const executionId = execution.authenticatorFlow
			? await stageSubflow(api, {execution, parent: stagedAlias, stage, renames})
			: (await api("POST", `/authentication/flows/${encodeURIComponent(stagedAlias)}/executions/execution`, {provider: execution.authenticator})).created;
		await api("PUT", `/authentication/flows/${encodeURIComponent(stagedAlias)}/executions`, {id: executionId, requirement: execution.requirement, priority: (position + 1) * PRIORITY_STEP});
		if (execution.authenticatorConfig) {
			const config = templateConfig(execution.authenticatorConfig);
			const {created} = await api("POST", `/authentication/executions/${executionId}/config`, {alias: `${execution.authenticatorConfig}${stage}`, config});
			renames.push({route: `/authentication/config/${created}`, body: {id: created, alias: execution.authenticatorConfig, config}});
		}
	}
}

async function stageSubflow(api, {execution, parent, stage, renames}) {
	const subflow = findFlow(TEMPLATE, execution.flowAlias);
	const {created} = await api("POST", `/authentication/flows/${encodeURIComponent(parent)}/executions/flow`, {
		alias: `${execution.flowAlias}${stage}`, type: subflow.providerId, description: subflow.description ?? "",
		...execution.authenticator ? {provider: execution.authenticator} : {}
	});
	renames.push({flowId: created, alias: execution.flowAlias});
	await stageSteps(api, {alias: execution.flowAlias, stage, renames});
	const {body: executions} = await api("GET", `/authentication/flows/${encodeURIComponent(parent)}/executions`);
	return executions.find(candidate => candidate.flowId === created).id;
}

/** Points whatever runs a flow at another one, so the first can be deleted without a gap. */
async function retarget(api, live, from, to) {
	const bindings = REFERENCING_BINDINGS.filter(binding => live[binding] === from);
	if (bindings.length) await api("PUT", "", Object.fromEntries(bindings.map(binding => [binding, to])));
	for (const provider of live.identityProviders ?? []) {
		const fields = PROVIDER_FLOWS.filter(field => provider[field] === from);
		if (!fields.length) continue;
		const route = `/identity-provider/instances/${encodeURIComponent(provider.alias)}`;
		const {body: current} = await api("GET", route);
		await api("PUT", route, {...current, ...Object.fromEntries(fields.map(field => [field, to]))});
	}
}

/** Builds the template flow beside the running one, switches over to it, then gives it the template names. */
async function replaceFlow(api, live, alias) {
	const stage = ` staged ${Date.now().toString(36)}`;
	const template = findFlow(TEMPLATE, alias);
	const {created} = await api("POST", "/authentication/flows", {alias: `${alias}${stage}`, description: template.description ?? "", providerId: template.providerId, topLevel: true, builtIn: false});
	const renames = [];
	await stageSteps(api, {alias, stage, renames});
	const running = findFlow(live, alias);
	if (running) {
		await retarget(api, live, alias, `${alias}${stage}`);
		await api("DELETE", `/authentication/flows/${running.id}`);
	}
	for (const rename of [...renames, {flowId: created, alias}]) {
		if (rename.route) {
			await api("PUT", rename.route, rename.body);
			continue;
		}
		const route = `/authentication/flows/${rename.flowId}`;
		const {body: flow} = await api("GET", route);
		await api("PUT", route, {...flow, alias: rename.alias});
	}
}

async function converge(api, live) {
	const applied = [];
	for (const alias of managedFlows()) {
		if (isDeepStrictEqual(flowShape(live, alias), flowShape(TEMPLATE, alias))) continue;
		await replaceFlow(api, await liveRealm(api), alias);
		applied.push(`authenticationFlows.${alias}`);
	}
	const fields = [...EXACT_FIELDS, ...FLOW_BINDINGS].filter(field => live[field] !== TEMPLATE[field]);
	const listeners = [...new Set([...live.eventsListeners ?? [], ...TEMPLATE.eventsListeners])];
	const listenersMissing = listeners.length !== (live.eventsListeners ?? []).length;
	if (fields.length || listenersMissing) {
		await api("PUT", "", {...Object.fromEntries(fields.map(field => [field, TEMPLATE[field]])), ...listenersMissing ? {eventsListeners: listeners} : {}});
		applied.push(...fields, ...listenersMissing ? ["eventsListeners"] : []);
	}
	// A missing provider needs its secrets, which the template does not hold: it stays reported
	for (const difference of providerDrift(live).filter(candidate => candidate.provider)) {
		const route = `/identity-provider/instances/${encodeURIComponent(difference.provider)}`;
		const {body: current} = await api("GET", route);
		await api("PUT", route, {...current, postBrokerLoginFlowAlias: difference.expected});
		applied.push(difference.setting);
	}
	return applied;
}

async function run() {
	const apply = applyRequested();
	const api = await adminApi(configuration());
	const live = await liveRealm(api);
	const applied = apply ? await converge(api, live) : [];
	const remaining = drift(apply ? await liveRealm(api) : live);
	console.log(JSON.stringify({mode: apply ? "apply" : "read-only", applied, drift: remaining}, null, 2));
	if (remaining.length) process.exitCode = 1;
}

run().catch(error => {
	console.error(error.message);
	process.exitCode = 2;
});
