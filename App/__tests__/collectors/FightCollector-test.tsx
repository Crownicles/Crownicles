import {act, fireEvent, render, screen, within} from "@testing-library/react-native";
import {AccessibilityInfo, Animated} from "react-native";
import {FightConfirmCollector, FightActions} from "@/src/collectors/FightActionCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {fightStore, FightSnapshot} from "@/src/store/FightStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FightIntroductionRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightLiveView} from "@/src/collectors/FightCollector";
import {FightFighter} from "ws-packets/src/objects/Fight";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

describe("fight collectors", () => {
	afterEach(() => fightStore.reset());
	it("keeps action positions stable and exposes details without submitting", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: {fightId: "duel", initiator: {isSelf: true}, opponent: {isSelf: false}, initiatorActions: [["heavyAttack", 7], ["simpleAttack", 2], ["resting", 0]], opponentActions: []}});
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "stable-turn", endTime: Date.now() + 60_000, data: {type: "fightAction", data: {fightId: "duel"}}, reactions: [{type: "fightAction", data: {id: "resting"}}, {type: "fightAction", data: {id: "simpleAttack"}}]});
		const choose = jest.fn();
		await render(<FightActions collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByRole("button", {name: "models:fight_actions.heavyAttack.name"})).toBeDisabled();
		await fireEvent.press(screen.getAllByRole("button", {name: "app:battle.actionDetails"})[0]);
		expect(screen.getByText("models:fight_actions.heavyAttack.description")).toBeTruthy();
		expect(choose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:common.back"));
		await fireEvent.press(screen.getByText("models:fight_actions.simpleAttack.name"));
		expect(choose).toHaveBeenCalledWith(1);
	});
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

function battle(): FightSnapshot {
	const fighter: FightFighter = {isSelf: true, name: "Aster", classId: 1, level: 10, stats: {power: 80, maxEnergy: 100, attack: 15, defense: 12, speed: 20, breath: 6, maxBreath: 10, breathRegen: 2}};
	return {introduction: {fightId: "screen", initiator: fighter, opponent: {...fighter, name: "Arsene", isSelf: false}, initiatorActions: [["simpleAttack", 2]], opponentActions: []}, status: {fightId: "screen", numberOfTurn: 3, maxNumberOfTurn: 26, activeFighter: {...fighter, name: "Arsene", isSelf: false}, defendingFighter: fighter}, logs: [], result: null, reward: null, error: null, visible: true, waiting: true};
}

describe("live battle presentation", () => {
	afterEach(() => jest.restoreAllMocks());
	it("keeps the player on the left during an opponent turn and exposes fighter details", async () => {
		await render(<FightLiveView fight={battle()} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(within(screen.getByTestId("fight-fighter-self")).getByText("Aster")).toBeTruthy();
		expect(within(screen.getByTestId("fight-fighter-opponent")).getByText("Arsene")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.details : Aster"}));
		expect(screen.getByText("app:arena.stats.attack")).toBeTruthy();
		expect(screen.getByText("15")).toBeTruthy();
	});
	it("waits for the final animation before revealing victory and retains the full journal", async () => {
		let finish: ((result: {finished: boolean}) => void) | undefined;
		jest.spyOn(Animated, "timing").mockImplementation((_value, config) => ({start: callback => {if (config.useNativeDriver) finish = callback;}, stop: jest.fn(), reset: jest.fn()}));
		const initial = battle();
		const view = await render(<FightLiveView fight={initial} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		const final = {...initial, logs: [{sequence: 1, before: initial.status!, entry: {fightId: "screen", fighter: {isSelf: true}, fightActionId: "heavyAttack", status: "critical", fightActionEffectDealt: {damages: 80}}}], result: {winner: {isSelf: true, name: "Aster", finalEnergy: 80, maxEnergy: 100}, loser: {isSelf: false, name: "Arsene", finalEnergy: 0, maxEnergy: 100}, draw: false, turns: 3, maxTurns: 26}};
		await view.rerender(<FightLiveView fight={final} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.queryByText("app:arena.victory")).toBeNull();
		expect(screen.getByTestId("fight-effect-heavy", {includeHiddenElements: true})).toBeTruthy();
		await act(() => finish?.({finished: true}));
		expect(screen.getByText("app:arena.victory")).toBeTruthy();
		await fireEvent.press(screen.getAllByRole("button", {name: "app:arena.log"})[0]);
		expect(screen.getByText("models:fight_actions.heavyAttack.name")).toBeTruthy();
	});
	it("omits moving visual effects when reduced motion is enabled", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		const initial = battle();
		const view = await render(<FightLiveView fight={initial} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		await act(async () => undefined);
		await view.rerender(<FightLiveView fight={{...initial, logs: [{sequence: 1, before: initial.status!, entry: {fightId: "screen", fighter: {isSelf: true}, fightActionId: "fireAttack", status: "normal"}}]}} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.queryByTestId("fight-effect-flame", {includeHiddenElements: true})).toBeNull();
	});
});
