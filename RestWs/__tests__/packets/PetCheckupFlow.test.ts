import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandMissionShopPetInformation} from "../../../Lib/src/packets/commands/CommandMissionShopPacket";
import ShopServerTranslator from "../../src/packets/fromServer/translators/ShopServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

function petInformation(fightAssistIds: string[]): CommandMissionShopPetInformation {
	return makePacket(CommandMissionShopPetInformation, {
		nickname: "Moka",
		petId: 3,
		typeId: 42,
		sex: "f",
		loveLevel: 2,
		lovePoints: 30,
		diet: "herbivorous",
		nextFeed: 0,
		fightAssistIds,
		ageCategory: "adult",
		feedDelay: 3600,
		force: 12,
		speed: 9
	});
}

describe("pet checkup", () => {
	it("keeps the first fight power where installed apps read it, and adds the second one when the pet has it", async () => {
		const mammoth = await ShopServerTranslator.checkup(CONTEXT, petInformation(["petCharge", "unstoppable"]));
		expect(mammoth).toMatchObject({fightAssistId: "petCharge", secondFightAssistId: "unstoppable"});

		const cat = await ShopServerTranslator.checkup(CONTEXT, petInformation(["claws"]));
		expect(cat.fightAssistId).toBe("claws");
		expect(JSON.parse(JSON.stringify(cat))).not.toHaveProperty("secondFightAssistId");
	});
});
