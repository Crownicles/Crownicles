import { createTransport } from "nodemailer";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { AccountDeletionConfig } from "../config/RestWsConfig";

/**
 * Who asked for a deletion, as shown to the administrator handling the request
 */
export type DeletionRequest = {
	keycloakId: string;
	username: string;
	email?: string;
	discordId?: string;
};

/**
 * Lays the request out the same way for every channel, so the administrator reads the same
 * thing whether the alert arrives by mail or on Discord.
 * @param request
 */
function describeRequest(request: DeletionRequest): string {
	const lines = [
		`Username: ${request.username}`,
		`Keycloak ID: ${request.keycloakId}`
	];
	if (request.email) {
		lines.push(`Email: ${request.email}`);
	}
	if (request.discordId) {
		lines.push(`Discord ID: ${request.discordId}`);
	}
	lines.push("", "Check the request, then run /deletecode to generate the code and send it to the player.");
	return lines.join("\n");
}

/**
 * Mails the request to the administrator.
 * @param request
 * @param config
 */
async function sendMail(request: DeletionRequest, config: AccountDeletionConfig): Promise<void> {
	const { SMTP } = config;
	if (!SMTP.HOST || !SMTP.TO) {
		return;
	}

	const transport = createTransport({
		host: SMTP.HOST,
		port: SMTP.PORT,
		secure: SMTP.PORT === 465,
		auth: SMTP.USERNAME
			? {
				user: SMTP.USERNAME, pass: SMTP.PASSWORD
			}
			: undefined
	});

	await transport.sendMail({
		from: SMTP.FROM || SMTP.USERNAME,
		to: SMTP.TO,
		subject: `Crownicles - account deletion requested by ${request.username}`,
		text: describeRequest(request)
	});
}

/**
 * Posts the request to the Discord webhook.
 * @param request
 * @param config
 */
async function sendWebhook(request: DeletionRequest, config: AccountDeletionConfig): Promise<void> {
	if (!config.WEBHOOK_URL) {
		return;
	}

	const res = await fetch(config.WEBHOOK_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content: `**Account deletion requested**\n\`\`\`\n${describeRequest(request)}\n\`\`\`` })
	});

	if (!res.ok) {
		throw new Error(`Discord webhook answered ${res.status}`);
	}
}

/**
 * Warns the administrator that a player asked for their account to be deleted.
 *
 * A channel that fails must not hide the request: every channel is attempted, and the request is
 * logged whatever happens, so it can still be handled by hand.
 * @param request
 * @param config
 */
export async function notifyDeletionRequest(request: DeletionRequest, config: AccountDeletionConfig): Promise<void> {
	CrowniclesLogger.info("Account deletion requested", {
		keycloakId: request.keycloakId,
		username: request.username
	});

	const results = await Promise.allSettled([sendMail(request, config), sendWebhook(request, config)]);
	for (const result of results) {
		if (result.status === "rejected") {
			CrowniclesLogger.errorWithObj("Could not warn about an account deletion request", result.reason);
		}
	}
}
