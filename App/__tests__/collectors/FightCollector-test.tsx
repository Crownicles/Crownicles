import {fireEvent, render, screen} from "@testing-library/react-native";
import {FightConfirmCollector, FightActions} from "@/src/collectors/FightActionCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

describe("fight collectors", () => {
	it("lets the player cancel preparation at the original refusal index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "confirm", endTime: Date.now() + 60_000, data: {type: "fightConfirm", data: {playerStats: {classId: 1, fightRanking: {glory: 500}, energy: {value: 90, max: 100}, attack: 10, defense: 5, speed: 8, breath: {base: 3, max: 10, regen: 2}}}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const choose = jest.fn();
		await render(<FightConfirmCollector collector={collector} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(choose).toHaveBeenCalledWith(2);
	});
	it("sends the original action index once even if the player taps twice", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "turn", endTime: Date.now() + 60_000, data: {type: "fightAction", data: {fightId: "duel"}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "fightAction", data: {id: "rest"}}, {type: "fightAction", data: {id: "simpleAttack"}}]});
		const choose = jest.fn();
		await render(<FightActions collector={collector} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:fight_actions.rest.name"));
		await fireEvent.press(screen.getByText("models:fight_actions.rest.name"));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(1);
	});
});
