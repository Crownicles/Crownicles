import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/fromPlaceToPlace";

describe("fromPlaceToPlace mission", () => {
	// Variant encoding for Mergagnan (26) <-> Claire de Ville (23), 72 hours, order doesn't matter
	// fromMap: 26, toMap: 23, time: 72, orderMatter: false
	// Encoded as: (26 << 20) | (23 << 10) | 72 = 27286600
	const variant = 27286600;

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should return false when saveBlob is null", () => {
			const result = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, null as unknown as Buffer);
			expect(result).toBe(false);
		});

		it("should return true when traveling from Mergagnan to Claire de Ville within time limit", () => {
			// Create a saveBlob indicating player started at Mergagnan (26) just now
			const saveBlob = Buffer.alloc(10);
			saveBlob.writeBigUInt64LE(BigInt(Date.now())); // Current timestamp
			saveBlob.writeUInt16LE(26, 8); // Started at Mergagnan

			// Now arriving at Claire de Ville (23)
			const result = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob);
			expect(result).toBe(true);
		});

		it("should return true when traveling from Claire de Ville to Mergagnan within time limit (order doesn't matter)", () => {
			// Create a saveBlob indicating player started at Claire de Ville (23) just now
			const saveBlob = Buffer.alloc(10);
			saveBlob.writeBigUInt64LE(BigInt(Date.now())); // Current timestamp
			saveBlob.writeUInt16LE(23, 8); // Started at Claire de Ville

			// Now arriving at Mergagnan (26)
			const result = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 26 }, saveBlob);
			expect(result).toBe(true);
		});

		it("should return false when time limit exceeded (72 hours)", () => {
			// Create a saveBlob with timestamp from 73 hours ago
			const saveBlob = Buffer.alloc(10);
			const hoursAgo73 = Date.now() - (73 * 60 * 60 * 1000);
			saveBlob.writeBigUInt64LE(BigInt(hoursAgo73));
			saveBlob.writeUInt16LE(26, 8); // Started at Mergagnan

			// Now arriving at Claire de Ville (23) but too late
			const result = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob);
			expect(result).toBe(false);
		});

		it("should return false when arriving at wrong destination", () => {
			// Create a saveBlob indicating player started at Mergagnan (26)
			const saveBlob = Buffer.alloc(10);
			saveBlob.writeBigUInt64LE(BigInt(Date.now()));
			saveBlob.writeUInt16LE(26, 8); // Started at Mergagnan

			// Arriving at some other location (e.g., Sentinelle = 1)
			const result = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 1 }, saveBlob);
			expect(result).toBe(false);
		});
	});

	describe("updateSaveBlob", () => {
		it("should create a saveBlob when arriving at starting location (Mergagnan)", () => {
			const beforeTime = Date.now();
			const result = missionInterface.updateSaveBlob(variant, null as unknown as Buffer, { mapId: 26 });
			const afterTime = Date.now();

			expect(result).not.toBeNull();
			expect(result.length).toBe(10);

			const timestamp = Number(result.readBigUInt64LE());
			const mapId = result.readUInt16LE(8);

			expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(timestamp).toBeLessThanOrEqual(afterTime);
			expect(mapId).toBe(26);
		});

		it("should create a saveBlob when arriving at destination location (Claire de Ville) first (order doesn't matter)", () => {
			const beforeTime = Date.now();
			const result = missionInterface.updateSaveBlob(variant, null as unknown as Buffer, { mapId: 23 });
			const afterTime = Date.now();

			expect(result).not.toBeNull();
			expect(result.length).toBe(10);

			const timestamp = Number(result.readBigUInt64LE());
			const mapId = result.readUInt16LE(8);

			expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(timestamp).toBeLessThanOrEqual(afterTime);
			expect(mapId).toBe(23);
		});

		it("should return null when arriving at wrong location with null saveBlob", () => {
			// Arriving at Sentinelle (1) which is neither Mergagnan nor Claire de Ville
			const result = missionInterface.updateSaveBlob(variant, null as unknown as Buffer, { mapId: 1 });
			expect(result).toBeNull();
		});

		it("should keep saveBlob when continuing from start location to destination", () => {
			// Create a saveBlob for Mergagnan
			const originalSaveBlob = Buffer.alloc(10);
			const startTime = Date.now();
			originalSaveBlob.writeBigUInt64LE(BigInt(startTime));
			originalSaveBlob.writeUInt16LE(26, 8);

			// Now arriving at Claire de Ville - saveBlob should stay the same
			const result = missionInterface.updateSaveBlob(variant, originalSaveBlob, { mapId: 23 });
			
			expect(result).toEqual(originalSaveBlob);
			expect(Number(result.readBigUInt64LE())).toBe(startTime);
			expect(result.readUInt16LE(8)).toBe(26);
		});

		it("should reset saveBlob when returning to start location", () => {
			// Create a saveBlob for Mergagnan
			const originalSaveBlob = Buffer.alloc(10);
			const oldTime = Date.now() - 1000;
			originalSaveBlob.writeBigUInt64LE(BigInt(oldTime));
			originalSaveBlob.writeUInt16LE(26, 8);

			// Returning to Mergagnan - should reset the timestamp
			const beforeTime = Date.now();
			const result = missionInterface.updateSaveBlob(variant, originalSaveBlob, { mapId: 26 });
			const afterTime = Date.now();

			const newTimestamp = Number(result.readBigUInt64LE());
			expect(newTimestamp).toBeGreaterThan(oldTime);
			expect(newTimestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(newTimestamp).toBeLessThanOrEqual(afterTime);
			expect(result.readUInt16LE(8)).toBe(26);
		});

		it("should handle expired journey by returning null when arriving at wrong place", () => {
			// Create expired saveBlob (73 hours ago)
			const saveBlob = Buffer.alloc(10);
			const expiredTime = Date.now() - (73 * 60 * 60 * 1000);
			saveBlob.writeBigUInt64LE(BigInt(expiredTime));
			saveBlob.writeUInt16LE(26, 8);

			// Arriving at wrong location (Sentinelle = 1)
			const result = missionInterface.updateSaveBlob(variant, saveBlob, { mapId: 1 });
			expect(result).toBeNull();
		});

		it("BUG FIX TEST: should initialize saveBlob on first visit to starting location even from elsewhere", () => {
			// This is the regression test for issue #3751
			// Player receives mission 62: Mergagnan <-> Claire de Ville
			// Player is currently NOT at either location (e.g., at Sentinelle)
			
			// Step 1: Player arrives at some other location first (Sentinelle = 1)
			// saveBlob is still null, updateSaveBlob returns null
			let saveBlob = missionInterface.updateSaveBlob(variant, null as unknown as Buffer, { mapId: 1 });
			expect(saveBlob).toBeNull();

			// Step 2: Player travels to Mergagnan (starting point)
			// BUG FIX: updateSaveBlob should be called even though saveBlob was null
			// and should initialize the saveBlob
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob, { mapId: 26 });
			expect(saveBlob).not.toBeNull();
			expect(saveBlob.readUInt16LE(8)).toBe(26);

			// Step 3: Player travels to Claire de Ville (destination)
			// Now the params should match and mission should complete
			const paramsMatch = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob);
			expect(paramsMatch).toBe(true);
		});

		it("BUG FIX TEST: full journey scenario with intermediate stops", () => {
			// Scenario from bug report: Player traveling from elsewhere to Mergagnan to Claire de Ville
			
			// Player at Voie champêtre (2)
			let saveBlob: Buffer | null = missionInterface.updateSaveBlob(variant, null as unknown as Buffer, { mapId: 2 });
			expect(saveBlob).toBeNull(); // Not at Mergagnan or Claire de Ville

			// Player travels to Plage Sentinelle (1)
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob, { mapId: 1 });
			expect(saveBlob).toBeNull(); // Still not at Mergagnan or Claire de Ville

			// Player arrives at Mergagnan (26) - should initialize saveBlob
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob, { mapId: 26 });
			expect(saveBlob).not.toBeNull();
			expect(saveBlob!.readUInt16LE(8)).toBe(26);
			
			const startTimestamp = Number(saveBlob!.readBigUInt64LE());

			// Player does some activity at Mergagnan (using /report)
			// params match returns false because they're staying at the same place
			let paramsMatch = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 26 }, saveBlob!);
			expect(paramsMatch).toBe(false);

			// Player travels to Claire de Ville (23) - should complete mission
			paramsMatch = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob!);
			expect(paramsMatch).toBe(true);

			// Verify the timestamp wasn't changed
			expect(Number(saveBlob!.readBigUInt64LE())).toBe(startTimestamp);
		});
	});

	describe("alwaysUpdateBlob flag", () => {
		it("should have alwaysUpdateBlob set to true", () => {
			// This is critical for the bug fix #3751
			// Without this flag, the controller won't call updateBlob when params don't match,
			// which means the saveBlob never gets initialized when the player first arrives
			// at one of the mission locations
			expect(missionInterface.alwaysUpdateBlob).toBe(true);
		});
	});

	describe("REGRESSION TEST #3751: blob initialization flow", () => {
		it("should initialize blob on first visit to mission location (Mergagnan) even when params don't match initially", () => {
			// The bug: When a player first arrives at Mergagnan with a null saveBlob,
			// areParamsMatchingVariantAndBlob returns false (params don't match).
			// Without alwaysUpdateBlob, the controller wouldn't call updateSaveBlob,
			// so the blob never gets initialized.
			
			// Step 1: Player arrives at Mergagnan for the first time (saveBlob is null)
			let saveBlob: Buffer | null = null;
			
			// Params don't match because saveBlob is null
			const paramsMatchBefore = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 26 }, saveBlob as unknown as Buffer);
			expect(paramsMatchBefore).toBe(false);
			
			// But with alwaysUpdateBlob=true, controller should still call updateSaveBlob
			// This call initializes the blob
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob as unknown as Buffer, { mapId: 26 });
			
			// Verify blob was initialized
			expect(saveBlob).not.toBeNull();
			expect(saveBlob!.readUInt16LE(8)).toBe(26);
			
			// Step 2: Player travels to Claire de Ville
			// Now params should match and mission can complete
			const paramsMatchAfter = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob!);
			expect(paramsMatchAfter).toBe(true);
		});

		it("should initialize blob on first visit to alternate mission location (Claire de Ville) when order doesn't matter", () => {
			// Test the same scenario but starting at the destination location instead
			let saveBlob: Buffer | null = null;
			
			// Params don't match because saveBlob is null
			const paramsMatchBefore = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 23 }, saveBlob as unknown as Buffer);
			expect(paramsMatchBefore).toBe(false);
			
			// With alwaysUpdateBlob=true, blob gets initialized at Claire de Ville
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob as unknown as Buffer, { mapId: 23 });
			
			// Verify blob was initialized
			expect(saveBlob).not.toBeNull();
			expect(saveBlob!.readUInt16LE(8)).toBe(23);
			
			// Player travels to Mergagnan
			// Now params should match and mission can complete
			const paramsMatchAfter = missionInterface.areParamsMatchingVariantAndBlob(variant, { mapId: 26 }, saveBlob!);
			expect(paramsMatchAfter).toBe(true);
		});

		it("should not initialize blob when visiting non-mission locations", () => {
			// Verify that alwaysUpdateBlob doesn't cause initialization at wrong locations
			let saveBlob: Buffer | null = null;
			
			// Player at Sentinelle (1) - not a mission location
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob as unknown as Buffer, { mapId: 1 });
			expect(saveBlob).toBeNull();
			
			// Player at Voie champêtre (2) - not a mission location
			saveBlob = missionInterface.updateSaveBlob(variant, saveBlob as unknown as Buffer, { mapId: 2 });
			expect(saveBlob).toBeNull();
		});
	});
});
