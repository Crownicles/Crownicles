import {
	describe, expect, it
} from "vitest";
import { MissionUtils } from "../../src/utils/MissionUtils";
import {
	BaseMission, MissionType
} from "../../src/types/CompletedMission";

const ORDER_MATTERS_FLAG = 0x40000000;

function variantOf(fromMap: number, toMap: number, hours: number, orderMatter: boolean): number {
	return (orderMatter ? ORDER_MATTERS_FLAG : 0) | fromMap << 20 | toMap << 10 | hours;
}

function missionWithId(missionId: string): BaseMission {
	return {
		missionId,
		missionObjective: 1,
		missionVariant: 0,
		numberDone: 0,
		missionType: MissionType.CAMPAIGN
	};
}

describe("MissionUtils.fromPlaceToPlaceParamsFromVariant", () => {
	it("decodes the maps, the time and the order flag packed in the variant", () => {
		expect(MissionUtils.fromPlaceToPlaceParamsFromVariant(variantOf(5, 24, 30, true))).toEqual({
			fromMap: 5,
			toMap: 24,
			time: 30,
			orderMatter: true
		});
	});

	it("decodes the largest values of each 10 bits field without overlap", () => {
		expect(MissionUtils.fromPlaceToPlaceParamsFromVariant(variantOf(1023, 1023, 1023, false))).toEqual({
			fromMap: 1023,
			toMap: 1023,
			time: 1023,
			orderMatter: false
		});
		expect(MissionUtils.fromPlaceToPlaceParamsFromVariant(variantOf(0, 1023, 0, false))).toEqual({
			fromMap: 0,
			toMap: 1023,
			time: 0,
			orderMatter: false
		});
	});
});

describe("MissionUtils.fromPlaceToPlaceDataFromSaveBlob", () => {
	it("reads the start timestamp and the start map written by the mission", () => {
		const saveBlob = Buffer.alloc(10);
		saveBlob.writeBigUInt64LE(BigInt(1_735_689_600_123));
		saveBlob.writeUInt16LE(24, 8);

		expect(MissionUtils.fromPlaceToPlaceDataFromSaveBlob(saveBlob)).toEqual({
			startTimestamp: 1_735_689_600_123,
			startMap: 24
		});
	});

	it("returns null without a save blob", () => {
		// The save blob column is nullable in database even though the signature does not say it
		expect(MissionUtils.fromPlaceToPlaceDataFromSaveBlob(null as unknown as Buffer)).toBeNull();
	});
});

describe("MissionUtils required mission data", () => {
	it("requires a fight action for the attack missions only", () => {
		expect(MissionUtils.isRequiredFightActionId(missionWithId("fightAttacks"))).toBe(true);
		expect(MissionUtils.isRequiredFightActionId(missionWithId("finishWithAttack"))).toBe(true);
		expect(MissionUtils.isRequiredFightActionId(missionWithId("goToPlace"))).toBe(false);
	});

	it("requires a map type for the go to place mission only", () => {
		expect(MissionUtils.isRequiredMapLocationMapType(missionWithId("goToPlace"))).toBe(true);
		expect(MissionUtils.isRequiredMapLocationMapType(missionWithId("fightAttacks"))).toBe(false);
	});
});
