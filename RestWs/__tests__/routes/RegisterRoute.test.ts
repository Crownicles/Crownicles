import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import Fastify from "fastify";

const registerUser = vi.fn();
const sendVerificationEmail = vi.fn();
const deleteUser = vi.fn();
const userExists = vi.fn();

vi.mock("../../src/index", () => ({ keycloakConfig: {
	url: "http://keycloak.test", realm: "Crownicles", clientId: "test", clientSecret: "test"
} }));
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({ KeycloakUtils: {
	registerUser, sendVerificationEmail, deleteUser, userExists
} }));

const KEYCLOAK_ID = "3f2a1b4c-0000-4000-8000-000000000001";

async function post(body: Record<string, unknown>): Promise<{ statusCode: number; payload: string }> {
	const { setupRegisterRoute } = await import("../../src/services/routes/RegisterRoute");
	const server = Fastify();
	setupRegisterRoute(server, true);
	const response = await server.inject({
		method: "POST", url: "/register", payload: body
	});
	await server.close();
	return {
		statusCode: response.statusCode, payload: response.payload
	};
}

function validBody(): Record<string, unknown> {
	return {
		username: "Aventurier", password: "un-mot-de-passe", email: "joueur@crownicles.test", language: "fr"
	};
}

describe("register route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		userExists.mockResolvedValue({
			isError: false, status: 200, payload: { exists: false }
		});
		registerUser.mockResolvedValue({
			isError: false, status: 201, payload: { user: { id: KEYCLOAK_ID } }
		});
		sendVerificationEmail.mockResolvedValue({
			isError: false, status: 204, payload: {}
		});
		deleteUser.mockResolvedValue({
			isError: false, status: 204, payload: {}
		});
	});

	it("refuses to create an account without an address", async () => {
		const { email, ...withoutEmail } = validBody();
		expect(email).toBeDefined();

		const response = await post(withoutEmail);

		expect(response.statusCode).toBe(400);
		expect(registerUser).not.toHaveBeenCalled();
	});

	it("refuses an address that is not one", async () => {
		const response = await post({
			...validBody(), email: "pas-une-adresse"
		});

		expect(response.statusCode).toBe(400);
		expect(registerUser).not.toHaveBeenCalled();
	});

	it("carries the address to Keycloak and asks for its verification", async () => {
		const response = await post(validBody());

		expect(response.statusCode).toBe(200);
		expect(registerUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: "joueur@crownicles.test" }));
		expect(sendVerificationEmail).toHaveBeenCalledWith(expect.anything(), KEYCLOAK_ID);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it("frees the address again when the mail cannot be sent, instead of leaving it taken", async () => {
		sendVerificationEmail.mockResolvedValue({
			isError: true, status: 500, payload: { error: { details: "quota reached" } }
		});

		const response = await post(validBody());

		expect(response.statusCode).toBe(503);
		expect(deleteUser).toHaveBeenCalledWith(expect.anything(), KEYCLOAK_ID);
	});
});
