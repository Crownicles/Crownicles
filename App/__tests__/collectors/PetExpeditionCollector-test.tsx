import {fireEvent, render, screen} from "@testing-library/react-native";
import {PetExpeditionCollector} from "@/src/collectors/PetExpeditionCollector";
import {PetExpeditionOutcome} from "@/src/collectors/PetExpeditionOutcome";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "fr", t: (key: string, options?: Record<string, unknown>): string => key === "app:expedition.locationName" ? String(options?.name) : key}}));

const PET = {petTypeId: 1, petSex: "m" as const, petNickname: "Aster"};
const OPTION = {id: "trip", displayDurationMinutes: 120, mapLocationId: 12, locationType: "forest", riskCategory: "moderate", difficultyCategory: "easy", rewardCategory: "meager", foodCost: 3};

describe("expedition collectors", () => {
	it("confirms a destination without changing the Core reaction index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "trip", endTime: Date.now() + 60_000, data: {type: "expeditionChoice", data: {pet: PET, expeditions: [OPTION], hasGuild: true, guildFoodAmount: 4}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "expeditionSelect", data: {expeditionId: "trip"}}, {type: "expeditionCancel", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetExpeditionCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("commands:petExpedition.mapLocationExpeditions.12"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("app:expedition.confirmStart")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("requires confirmation before recalling a travelling pet", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "trip", endTime: Date.now() + 60_000, data: {type: "expeditionProgress", data: {pet: PET, locationType: "forest", mapLocationId: 12, returnTime: Date.now() + 120_000, riskCategory: "moderate"}}, reactions: [{type: "expeditionRecall", data: {}}, {type: "expeditionClose", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetExpeditionCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:expedition.recall"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		await fireEvent.press(screen.getByText("app:expedition.recall"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("displays the granted rewards without applying another partial-success multiplier", async () => {
		const packet = Object.assign(new PetExpeditionResolveRes(), {success: true, partialSuccess: true, totalFailure: false, pet: PET, expedition: {locationType: "forest", mapLocationId: 12}, rewards: {money: 53, experience: 29, points: 37, tokens: 2}, loveChange: 3, petLikedExpedition: true});
		await render(<PetExpeditionOutcome outcome={{kind: "resolved", packet}} onContinue={jest.fn()} />);
		expect(screen.getByText("29")).toBeTruthy();
		expect(screen.getByText("37")).toBeTruthy();
		expect(screen.getByText("app:expedition.resolved.partial")).toBeTruthy();
	});
});