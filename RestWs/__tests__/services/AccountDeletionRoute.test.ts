import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import fastify, {FastifyInstance} from "fastify";
import {setupAccountDeletionRoutes} from "../../src/services/routes/AccountDeletionRoute";
import type {AccountDeletionConfig} from "../../src/config/RestWsConfig";
import {generateDeletionCode} from "../../../Lib/src/utils/AccountDeletionCode";

const mocks = vi.hoisted(() => ({authenticate: vi.fn(), getUser: vi.fn(), deleteUser: vi.fn(), notify: vi.fn(), close: vi.fn()}));
vi.mock("../../src/index", () => ({keycloakConfig: {url: "https://keycloak.test", realm: "test", clientId: "test", clientSecret: "test-only"}}));
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({KeycloakUtils: {checkTokenAndGetKeycloakId: mocks.authenticate, getUserByKeycloakId: mocks.getUser, deleteUser: mocks.deleteUser}}));
vi.mock("../../src/services/AccountDeletionNotifier", () => ({notifyDeletionRequest: mocks.notify}));
vi.mock("../../src/services/WebSocketServer", () => ({WebSocketServer: {closeConnection: mocks.close}}));

const playerId = "authenticated-player";
const config: AccountDeletionConfig = {SECRET: "test-only-secret", WEBHOOK_URL: "", SMTP: {HOST: "", PORT: 587, USERNAME: "", PASSWORD: "", FROM: "", TO: ""}};
let server: FastifyInstance;

beforeEach(() => {
	vi.clearAllMocks();
	mocks.authenticate.mockResolvedValue({isError: false, payload: {keycloakId: playerId}});
	mocks.getUser.mockResolvedValue({isError: false, payload: {user: {username: "account-without-character"}}});
	mocks.deleteUser.mockResolvedValue({isError: false});
	mocks.notify.mockResolvedValue(true);
});
afterEach(async () => {await server?.close();});

function setup(settings = config): void {
	server = fastify();
	setupAccountDeletionRoutes(server, settings);
}

describe("account deletion HTTP boundary", () => {
	it("rejects unauthenticated requests before reading or deleting any account", async () => {
		setup();
		const response = await server.inject({method: "DELETE", url: "/account", payload: {code: "CODE"}});
		expect(response.statusCode).toBe(401);
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it.each(["POST", "DELETE"] as const)("reports missing server configuration for %s", async method => {
		setup({...config, SECRET: ""});
		const response = await server.inject({method, url: method === "POST" ? "/account/deletion-request" : "/account", headers: {authorization: "Bearer test-token"}});
		expect(response.statusCode).toBe(503);
		expect(mocks.deleteUser).not.toHaveBeenCalled();
		expect(mocks.notify).not.toHaveBeenCalled();
	});

	it("reports delivery failure instead of acknowledging an unusable request", async () => {
		setup();
		mocks.notify.mockResolvedValue(false);
		const response = await server.inject({method: "POST", url: "/account/deletion-request", headers: {authorization: "Bearer test-token"}});
		expect(response.statusCode).toBe(503);
		expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({keycloakId: playerId, username: "account-without-character"}), config);
	});

	it("acknowledges a transmitted request without deleting the account", async () => {
		setup();
		const response = await server.inject({method: "POST", url: "/account/deletion-request", headers: {authorization: "Bearer test-token"}});
		expect(response.statusCode).toBe(200);
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it.each(["wrong-code", 123, null])("rejects invalid codes without deletion: %s", async code => {
		setup();
		const response = await server.inject({method: "DELETE", url: "/account", headers: {authorization: "Bearer test-token"}, payload: {code}});
		expect(response.statusCode).toBe(403);
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it("deletes only the authenticated account and closes its connection after success", async () => {
		setup();
		const response = await server.inject({method: "DELETE", url: "/account", headers: {authorization: "Bearer test-token"}, payload: {code: generateDeletionCode(playerId, config.SECRET), keycloakId: "another-player"}});
		expect(response.statusCode).toBe(200);
		expect(mocks.deleteUser).toHaveBeenCalledWith(expect.any(Object), playerId);
		expect(mocks.close).toHaveBeenCalledWith(playerId, expect.any(String));
	});

	it("does not close the session or report success when account deletion fails", async () => {
		setup();
		mocks.deleteUser.mockResolvedValue({isError: true, status: 503});
		const response = await server.inject({method: "DELETE", url: "/account", headers: {authorization: "Bearer test-token"}, payload: {code: generateDeletionCode(playerId, config.SECRET)}});
		expect(response.statusCode).toBe(503);
		expect(mocks.close).not.toHaveBeenCalled();
	});
});