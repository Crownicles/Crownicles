import { ReactNode } from "react";
import {
	act, fireEvent, render, screen, waitFor, within
} from "@testing-library/react-native";
import { ReactionCollectorCreation } from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	DEFENSE_DATA_KINDS, DEFENSE_REACTION_KINDS, GENERIC_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {
	DefenseCancelRes, DefenseRes
} from "ws-packets/src/fromServer/defense/DefenseRes";
import { DefenseRecord } from "ws-packets/src/objects/DefenseRecord";
import { DefenseCollector } from "@/src/collectors/DefenseCollector";
import { DefenseOutcome } from "@/src/collectors/DefenseOutcome";
import { useDefenseOutcome } from "@/src/store/useDefenseOutcome";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import { renderWithGameQuery } from "@/src/testing/testUtils";

jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIconOrNull: (): null => null, getIcon: (): string => ""
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}` } }));

// The sheet then closes on the spot, so what closing it sends can be checked without waiting for its animation.
jest.mock("@/src/store/useReducedMotion", () => ({ useReducedMotion: (): boolean => true }));

const KNIGHT = 2;
const FIERY = "knightFiery";
const styleName = (personality: string): string => `commands:defense.personalities.${personality}.name`;

/** A knight defended by the fiery style, offered its three styles, the random one, then the refusal. */
function defenseCollector({
	currentPersonality, recentDefenses = []
}: {
	currentPersonality?: string; recentDefenses?: DefenseRecord[];
}): ReactionCollectorCreation {
	return {
		id: "defense",
		endTime: Date.now() + 60_000,
		data: {
			type: DEFENSE_DATA_KINDS.COLLECTOR,
			data: {
				classId: KNIGHT, recentDefenses, recentDefensesDays: 7, ...currentPersonality ? { currentPersonality } : {}
			}
		},
		reactions: [
			...[
				"knightStrategist",
				"knightEnduring",
				FIERY
			].map(personality => ({
				type: DEFENSE_REACTION_KINDS.STYLE, data: { personality }
			})),
			{
				type: DEFENSE_REACTION_KINDS.STYLE, data: {}
			},
			{
				type: GENERIC_REACTION_KINDS.REFUSE, data: {}
			}
		]
	};
}

async function renderChoice(collector: ReactionCollectorCreation): Promise<jest.Mock> {
	const choose = jest.fn();
	await render(<DefenseCollector collector={collector} onChoose={choose} submitting={false} />);
	return choose;
}

describe("defense style choice", () => {
	it("marks the style defending the player and describes every style of its class", async () => {
		await renderChoice(defenseCollector({ currentPersonality: FIERY }));
		expect(screen.getByText(/app:defense.currentStyle.*knightFiery\.name/)).toBeTruthy();
		expect(within(screen.getByRole("button", { name: styleName(FIERY) })).getByText("app:defense.current")).toBeTruthy();
		expect(within(screen.getByRole("button", { name: styleName("knightStrategist") })).queryByText("app:defense.current")).toBeNull();
		expect(screen.getByText("commands:defense.personalities.knightEnduring.description")).toBeTruthy();
		expect(screen.getByText("commands:defense.personalities.random.description")).toBeTruthy();
	});

	it("marks the random style as current when no style was picked", async () => {
		await renderChoice(defenseCollector({}));
		expect(within(screen.getByRole("button", { name: styleName("random") })).getByText("app:defense.current")).toBeTruthy();
	});

	it("tells the recent defenses by attacker class over the window sent by the server", async () => {
		await renderChoice(defenseCollector({ recentDefenses: [
			{
				attackerClassId: 4, defenses: 5, won: 3
			}
		] }));
		expect(screen.getByText(/commands:defense.recentDefensesTitle.*"count":7/)).toBeTruthy();
		expect(screen.getByText(/app:classes.name.*models:classes.4/)).toBeTruthy();
		expect(screen.getByText(/app:defense.won.*"count":3,"total":5/)).toBeTruthy();
	});

	it("says when nobody attacked the player lately", async () => {
		await renderChoice(defenseCollector({}));
		expect(screen.getByText("commands:defense.noRecentDefense")).toBeTruthy();
	});

	it("adopts the picked style by its reaction index, the random one included", async () => {
		const choose = await renderChoice(defenseCollector({ currentPersonality: FIERY }));
		await fireEvent.press(screen.getByRole("button", { name: "app:defense.choose" }));
		expect(choose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: styleName("random") }));
		await fireEvent.press(screen.getByRole("button", { name: "app:defense.choose" }));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(3);
	});

	it("says the current style already defends the player instead of sending it again", async () => {
		const choose = await renderChoice(defenseCollector({ currentPersonality: FIERY }));
		await fireEvent.press(screen.getByRole("button", { name: styleName(FIERY) }));
		expect(screen.getByText("app:defense.alreadyCurrent")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "app:defense.choose" }));
		expect(choose).not.toHaveBeenCalled();
	});

	it("leaves the style unchanged when the sheet is put away", async () => {
		const choose = await renderChoice(defenseCollector({ currentPersonality: FIERY }));
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
		await waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
		expect(choose).toHaveBeenCalledWith(4);
	});

	it("answers once: putting the sheet away after adopting a style does not refuse it as well", async () => {
		const choose = await renderChoice(defenseCollector({ currentPersonality: FIERY }));
		await fireEvent.press(screen.getByRole("button", { name: styleName("knightEnduring") }));
		await fireEvent.press(screen.getByRole("button", { name: "app:defense.choose" }));
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(1);
	});
});

describe("defense style outcome", () => {
	function LatestOutcome(): ReactNode {
		const {
			outcome, clear
		} = useDefenseOutcome();
		return outcome ? <DefenseOutcome outcome={outcome} onContinue={clear} /> : null;
	}

	async function receive(wireName: string, packet: object): Promise<void> {
		await act(async () => {
			Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(wireName, packet);
		});
	}

	it("names the style that now defends the player", async () => {
		await renderWithGameQuery(<LatestOutcome />);
		await receive(DefenseRes.wireName, { personality: "mageWarlock" });
		expect(screen.getByText("app:defense.changed")).toBeTruthy();
		expect(screen.getByRole("alert")).toHaveTextContent(/app:defense.changedTo.*mageWarlock\.name/);
	});

	it("says a different style will be drawn at each fight", async () => {
		await renderWithGameQuery(<LatestOutcome />);
		await receive(DefenseRes.wireName, {});
		expect(screen.getByText("app:defense.changedToRandom")).toBeTruthy();
	});

	it("keeps quiet when the choice was left", async () => {
		await renderWithGameQuery(<LatestOutcome />);
		await receive(DefenseCancelRes.wireName, {});
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
