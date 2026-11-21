import { vi } from "vitest";

/**
 * Mocked modules of the Discord front-end, kept free of any source import so the hoisted vi.mock factories can load them:
 * vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock)
 */

/**
 * Players known by the fake keycloak, by keycloak id
 */
export const knownPlayers = new Map<string, string>();

export const keycloakUtilsMock = {
	KeycloakUtils: {
		getUserByKeycloakId: vi.fn((_config: unknown, keycloakId: string) => Promise.resolve(knownPlayers.has(keycloakId)
			? {
				isError: false,
				payload: {
					user: {
						id: keycloakId,
						attributes: {
							gameUsername: [knownPlayers.get(keycloakId)],
							discordId: ["0"],
							language: ["fr"]
						}
					}
				}
			}
			: {
				isError: true,
				status: 404
			})),
		getUsersFromIds: vi.fn((_config: unknown, keycloakIds: string[]) => Promise.resolve({
			isError: false,
			payload: {
				users: keycloakIds.map(keycloakId => knownPlayers.has(keycloakId)
					? { attributes: { gameUsername: [knownPlayers.get(keycloakId)] } }
					: null)
			}
		})),
		getKeycloakIdFromDiscordId: vi.fn(() => Promise.resolve({
			isError: false,
			payload: { keycloakId: "keycloak-id" }
		}))
	}
};

export const shardMock = {
	crowniclesClient: {
		users: {
			cache: new Map(),
			fetch: (): Promise<null> => Promise.resolve(null)
		}
	},
	discordConfig: {},
	keycloakConfig: {},
	shardId: 0,
	discordDatabase: {}
};

export const loggerMock = {
	CrowniclesLogger: {
		warn: vi.fn(),
		error: vi.fn(),
		errorWithObj: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		isInitialized: vi.fn(() => true)
	}
};

