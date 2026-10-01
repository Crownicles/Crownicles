import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { KeycloakUtils } = require("../../Lib/dist/src/keycloak/KeycloakUtils.js");
const { KeycloakConstants } = require("../../Lib/dist/src/constants/KeycloakConstants.js");
const PAGE_SIZE = 100;
const APPLY_FLAG = "--apply";

function configuration() {
	const names = {
		url: "KEYCLOAK_URL",
		realm: "KEYCLOAK_REALM",
		clientId: "KEYCLOAK_CLIENT_ID",
		clientSecret: "KEYCLOAK_CLIENT_SECRET"
	};
	return Object.fromEntries(Object.entries(names).map(([field, name]) => {
		const value = process.env[name];
		if (!value) throw new Error(`Missing ${name}`);
		return [field, value];
	}));
}

async function run() {
	const unknown = process.argv.slice(2).filter(argument => argument !== APPLY_FLAG);
	if (unknown.length) throw new Error("Only --apply is supported; default is read-only");
	const apply = process.argv.includes(APPLY_FLAG);
	const config = configuration();
	const totals = {scanned: 0, candidates: 0, alreadyLinked: 0, needsLink: 0, linked: 0, conflicts: 0};
	let first = 0;
	while (true) {
		const page = await KeycloakUtils.getUsersPage(config, first, PAGE_SIZE);
		if (page.isError) throw new Error(`Could not read users: HTTP ${page.status}`);
		if (!page.payload.users.length) break;
		for (const user of page.payload.users) {
			totals.scanned++;
			const discordId = user.attributes?.discordId?.[0];
			if (!discordId || user.username !== `discord-${discordId}`) continue;
			totals.candidates++;
			await processCandidate(config, user, {apply, totals});
		}
		first += page.payload.users.length;
	}
	console.log(JSON.stringify({mode: apply ? "apply" : "read-only", ...totals}, null, 2));
	if (totals.conflicts) process.exitCode = 1;
}

async function inspectCandidate(config, user) {
	const discordId = user.attributes.discordId[0];
	const links = await KeycloakUtils.getFederatedIdentities(config, user.id);
	if (links.isError) throw new Error(`Could not inspect identities: HTTP ${links.status}`);
	const owners = await KeycloakUtils.getDiscordIdentityOwners(config, discordId);
	if (owners.isError) throw new Error(`Could not inspect identity ownership: HTTP ${owners.status}`);
	if (owners.payload.users.some(owner => owner.id !== user.id)) return "conflicts";
	const existing = links.payload.identities.find(identity => identity.identityProvider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD);
	if (!existing) return "needsLink";
	return existing.userId === discordId ? "alreadyLinked" : "conflicts";
}

async function processCandidate(config, user, {apply, totals}) {
	const outcome = await inspectCandidate(config, user);
	totals[outcome]++;
	if (outcome !== "needsLink" || !apply) return;
	const result = await KeycloakUtils.linkLegacyDiscordUser(config, user);
	if (result.isError) {
		if (result.status !== 409) throw new Error(`Could not link a historical identity: HTTP ${result.status}`);
		totals.conflicts++;
		return;
	}
	if (result.payload.changed) totals.linked++;
	else totals.alreadyLinked++;
}

run().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});