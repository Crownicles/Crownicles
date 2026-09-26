import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	asMilliseconds, asMinutes
} from "../../../Lib/src/types/TimeTypes";
import { minutesToMilliseconds } from "../../../Lib/src/utils/TimeUtils";

const getRegisterEvents = vi.fn();
const getUserByKeycloakId = vi.fn();
const deleteUser = vi.fn();
const updateGameUsername = vi.fn();

vi.mock("../../src/index", () => ({ keycloakConfig: {
	url: "http://keycloak.test", realm: "Crownicles", clientId: "test", clientSecret: "test"
} }));
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({ KeycloakUtils: {
	getRegisterEvents, getUserByKeycloakId, deleteUser, updateGameUsername
} }));

const NOW = asMilliseconds(Date.UTC(2026, 8, 27, 12));

type Account = {
	id: string;
	username: string;
	emailVerified: boolean;
	gameUsername?: string;
	minutesAgo: number;
	method?: string;
};

function arrange(accounts: Account[]): void {
	getRegisterEvents.mockResolvedValue({
		isError: false,
		status: 200,
		payload: { events: accounts.map(account => ({
			time: NOW - minutesToMilliseconds(asMinutes(account.minutesAgo)),
			userId: account.id,
			details: { username: account.username, register_method: account.method ?? "form" }
		})) }
	});
	getUserByKeycloakId.mockImplementation((_config: unknown, id: string) => {
		const account = accounts.find(candidate => candidate.id === id)!;
		return Promise.resolve({
			isError: false,
			status: 200,
			payload: { user: {
				id: account.id,
				username: account.username,
				emailVerified: account.emailVerified,
				attributes: account.gameUsername ? { gameUsername: [account.gameUsername] } : undefined
			} }
		});
	});
}

async function review(): Promise<void> {
	const { RegistrationHygiene } = await import("../../src/services/RegistrationHygiene");
	await RegistrationHygiene.review(NOW);
}

describe("registration hygiene", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		deleteUser.mockResolvedValue({
			isError: false, status: 204, payload: {}
		});
		updateGameUsername.mockResolvedValue({
			isError: false, status: 204, payload: {}
		});
	});

	it("frees the name of the account the bot creates for a Discord player", async () => {
		arrange([
			{
				id: "squatter", username: "discord-123456789012345678", emailVerified: false, gameUsername: "discord-123456789012345678", minutesAgo: 1
			}
		]);

		await review();

		expect(deleteUser).toHaveBeenCalledWith(expect.anything(), "squatter");
	});

	it("frees a name that would pass for the staff, even once verified", async () => {
		arrange([
			{
				id: "fake-staff", username: "admin", emailVerified: true, gameUsername: "Admin", minutesAgo: 2
			}
		]);

		await review();

		expect(deleteUser).toHaveBeenCalledWith(expect.anything(), "fake-staff");
	});

	it("frees an address nobody confirmed within the hour, not before", async () => {
		arrange([
			{
				id: "abandoned", username: "oublie", emailVerified: false, gameUsername: "Oublie", minutesAgo: 61
			},
			{
				id: "pending", username: "patient", emailVerified: false, gameUsername: "Patient", minutesAgo: 20
			}
		]);

		await review();

		expect(deleteUser).toHaveBeenCalledTimes(1);
		expect(deleteUser).toHaveBeenCalledWith(expect.anything(), "abandoned");
	});

	it("resets a displayed name that is not the username", async () => {
		arrange([
			{
				id: "impostor", username: "anonyme", emailVerified: true, gameUsername: "Crownicles", minutesAgo: 5
			},
			{
				id: "no-script", username: "sansjs", emailVerified: false, minutesAgo: 5
			}
		]);

		await review();

		expect(updateGameUsername).toHaveBeenCalledTimes(2);
		expect(updateGameUsername).toHaveBeenCalledWith(expect.objectContaining({ id: "impostor" }), "anonyme", expect.anything());
		expect(updateGameUsername).toHaveBeenCalledWith(expect.objectContaining({ id: "no-script" }), "sansjs", expect.anything());
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it("keeps the case the player typed and stops looking at a settled account", async () => {
		arrange([
			{
				id: "player", username: "bastlast", emailVerified: true, gameUsername: "BastLast", minutesAgo: 90
			}
		]);

		await review();
		await review();

		expect(updateGameUsername).not.toHaveBeenCalled();
		expect(deleteUser).not.toHaveBeenCalled();
		expect(getUserByKeycloakId).toHaveBeenCalledTimes(1);
	});

	it("leaves the accounts brokered by Discord alone", async () => {
		arrange([
			{
				id: "brokered", username: "discord-123456789012345678", emailVerified: false, minutesAgo: 120, method: "identity_provider"
			}
		]);

		await review();

		expect(getUserByKeycloakId).not.toHaveBeenCalled();
		expect(deleteUser).not.toHaveBeenCalled();
	});
});
