import {CITY_REACTION_KINDS, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {cityIconPath} from "@/src/collectors/CityIcons";

function reaction(type: string, data: object): ReactionCollectorReaction {
	return {type, data} as ReactionCollectorReaction;
}

describe("cityIconPath", () => {
	beforeEach(() => {
		AppIcons.reloadAppIcons({city: {inn: "🍺"}, meals: {sushi: "🍣"}, rooms: {luxuryRoom: "👑"}});
	});

	it("shows each inn offer with its own emoji", () => {
		expect(cityIconPath(reaction(CITY_REACTION_KINDS.INN_MEAL, {mealId: "sushi"}))).toBe("meals.sushi");
		expect(cityIconPath(reaction(CITY_REACTION_KINDS.INN_ROOM, {roomId: "luxuryRoom"}))).toBe("rooms.luxuryRoom");
	});

	it("falls back to the inn emoji for an offer the game gives no emoji", () => {
		expect(cityIconPath(reaction(CITY_REACTION_KINDS.INN_MEAL, {mealId: "unknownMeal"}))).toBe("city.inn");
	});
});
