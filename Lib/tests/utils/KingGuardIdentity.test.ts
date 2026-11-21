import {
	describe, expect, it
} from "vitest";
import { KingGuardIdentity } from "../../src/utils/KingGuardIdentity";

describe("KingGuardIdentity", () => {
	it("finds back the id of a guard from the identifier sent in place of its keycloak id", () => {
		expect(KingGuardIdentity.getGuardId(KingGuardIdentity.toKeycloakId(1))).toBe(1);
		expect(KingGuardIdentity.getGuardId(KingGuardIdentity.toKeycloakId(1710))).toBe(1710);
	});

	it("tells apart the keycloak ids of the players and the malformed identifiers", () => {
		expect(KingGuardIdentity.getGuardId("2f1c6a4e-8a8f-4a39-9b1a-0d4c5b7e2a11")).toBeNull();
		expect(KingGuardIdentity.getGuardId(undefined)).toBeNull();
		expect(KingGuardIdentity.getGuardId(null)).toBeNull();
		expect(KingGuardIdentity.getGuardId(`${KingGuardIdentity.toKeycloakId(0)}`)).toBeNull();
		expect(KingGuardIdentity.getGuardId(`${KingGuardIdentity.toKeycloakId(12)}x`)).toBeNull();
	});
});
