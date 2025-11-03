import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/meetDifferentPlayers";

describe("meetDifferentPlayers mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		it("should return true when saveBlob is null (first player met)", () => {
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player1" }, null as unknown as Buffer);
			expect(result).toBe(true);
		});

		it("should return true when player is not in saveBlob (new player)", () => {
			const saveBlob = Buffer.from("player1,player2");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player3" }, saveBlob);
			expect(result).toBe(true);
		});

		it("should return false when player is already in saveBlob (already met)", () => {
			const saveBlob = Buffer.from("player1,player2,player3");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player2" }, saveBlob);
			expect(result).toBe(false);
		});

		it("should return false when meeting the same player again", () => {
			const saveBlob = Buffer.from("player1");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player1" }, saveBlob);
			expect(result).toBe(false);
		});
	});

	describe("updateSaveBlob", () => {
		it("should create a new blob with the player keycloak ID when saveBlob is null", () => {
			const result = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { metPlayerKeycloakId: "player1" });
			expect(result.toString()).toBe("player1");
		});

		it("should append the player keycloak ID to existing saveBlob", () => {
			const saveBlob = Buffer.from("player1,player2");
			const result = missionInterface.updateSaveBlob(0, saveBlob, { metPlayerKeycloakId: "player3" });
			expect(result.toString()).toBe("player1,player2,player3");
		});

		it("should handle meeting the same player multiple times correctly", () => {
			// Meet player1 for the first time
			let saveBlob = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { metPlayerKeycloakId: "player1" });
			expect(saveBlob.toString()).toBe("player1");
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player1" }, saveBlob)).toBe(false);

			// Meet player2
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player2" }, saveBlob)).toBe(true);
			saveBlob = missionInterface.updateSaveBlob(0, saveBlob, { metPlayerKeycloakId: "player2" });
			expect(saveBlob.toString()).toBe("player1,player2");

			// Meet player1 again - should NOT count as a different player
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { metPlayerKeycloakId: "player1" }, saveBlob)).toBe(false);
			// With the fix, updateBlob should NOT be called when areParamsMatchingVariantAndBlob returns false
			// So the blob should remain "player1,player2" and NOT become "player1,player2,player1"
		});
	});
});
