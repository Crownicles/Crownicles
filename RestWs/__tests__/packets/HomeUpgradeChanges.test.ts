import {
	describe, expect, it
} from "vitest";
import { HOME_UPGRADE_CHANGES as CORE_HOME_UPGRADE_CHANGES } from "../../../Lib/src/utils/HomeUpgradeChanges";
import { HOME_UPGRADE_CHANGES } from "../../../WsPackets/src/objects/HomeUpgrade";

describe("home upgrade changes sent to the app", () => {
	it("name every change as Core does", () => {
		expect(HOME_UPGRADE_CHANGES).toEqual(CORE_HOME_UPGRADE_CHANGES);
	});
});
