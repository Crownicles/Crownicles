import { keycloakConfig } from "../index";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	hoursToMilliseconds, minutesToMilliseconds
} from "../../../Lib/src/utils/TimeUtils";
import {
	asHours, asMilliseconds, asMinutes, Millisecond
} from "../../../Lib/src/types/TimeTypes";

const REVIEW_INTERVAL = minutesToMilliseconds(asMinutes(1));
const PENDING_LIFETIME = hoursToMilliseconds(asHours(1));
const PAGE_SIZE = 100;

/** Only an address nobody confirmed, on an account the sign-up form marked, may be removed. */
function isPending(user: KeycloakUser): boolean {
	return !user.emailVerified && user.attributes?.registrationPending?.[0] === "true";
}

export abstract class PendingRegistrations {
	private static running = false;

	public static start(): void {
		setInterval(() => PendingRegistrations.review().catch(error => CrowniclesLogger.errorWithObj("Pending registrations cleanup failed", error)), REVIEW_INTERVAL);
	}

	public static async review(now: Millisecond = asMilliseconds(Date.now())): Promise<void> {
		if (PendingRegistrations.running) {
			return;
		}
		PendingRegistrations.running = true;
		try {
			const expired: string[] = [];
			for (let first = 0; ; first += PAGE_SIZE) {
				const result = await KeycloakUtils.getPendingRegistrations(keycloakConfig, first, PAGE_SIZE);
				if (result.isError) {
					throw new Error("Pending registrations unavailable");
				}
				expired.push(...result.payload.users.filter(user => isPending(user) && now - user.createdTimestamp > PENDING_LIFETIME).map(user => user.id));
				if (result.payload.users.length < PAGE_SIZE) {
					break;
				}
			}
			for (const id of expired) {
				const current = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, id);
				if (current.isError || !isPending(current.payload.user)) {
					continue;
				}
				const deletion = await KeycloakUtils.deleteUser(keycloakConfig, id);
				if (deletion.isError) {
					CrowniclesLogger.warn("An expired registration could not be deleted", {
						keycloakId: id, status: deletion.status
					});
				}
			}
		}
		finally {
			PendingRegistrations.running = false;
		}
	}
}
