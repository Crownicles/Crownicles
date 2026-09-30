import {fireEvent, render, screen} from "@testing-library/react-native";
import {PetExpeditionCollector} from "@/src/collectors/PetExpeditionCollector";
import {PetExpeditionOutcome} from "@/src/collectors/PetExpeditionOutcome";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PetExpeditionCancelRes, PetExpeditionResolveRes, PetExpeditionStartedRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "fr", tArray: (): string[] => [], t: (key: string, options?: Record<string, unknown>): string => key === "app:expedition.locationName" ? String(options?.name) : key}}));

const PET = {petTypeId: 1, petSex: "m" as const, petNickname: "Aster"};
const OPTION = {id: "trip", displayDurationMinutes: 120, mapLocationId: 12, locationType: "forest", riskCategory: "moderate", difficultyCategory: "easy", rewardCategory: "meager", foodCost: 3};

describe("expedition collectors", () => {
	it("shows every destination on one screen and starts only the one picked, on its Core reaction index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "trip", endTime: Date.now() + 60_000, data: {type: "expeditionChoice", data: {pet: PET, expeditions: [OPTION, {...OPTION, id: "far", mapLocationId: 13, riskCategory: "extreme", hasCloneTalismanBonus: true}], hasGuild: true, guildFoodAmount: 4}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "expeditionSelect", data: {expeditionId: "trip"}}, {type: "expeditionSelect", data: {expeditionId: "far"}}, {type: "expeditionCancel", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetExpeditionCollector collector={collector} onChoose={onChoose} submitting={false} />);
		expect(screen.getByText("commands:petExpedition.mapLocationExpeditions.12")).toBeTruthy();
		expect(screen.getByText("commands:petExpedition.riskCategories.extreme")).toBeTruthy();
		expect(screen.getByText("app:expedition.cloneBonus")).toBeTruthy();
		expect(screen.getByText("app:expedition.provisions")).toBeTruthy();
		expect(screen.getByText("commands:petExpedition.chooseExpedition")).toBeTruthy();
		expect(screen.getByTestId("pet-impatience", {includeHiddenElements: true})).toBeTruthy();
		await fireEvent.press(screen.getByText("commands:petExpedition.selectPlaceholder"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByLabelText("commands:petExpedition.mapLocationExpeditions.13"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:expedition.start"));
		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it("requires confirmation before recalling a travelling pet", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "trip", endTime: Date.now() + 60_000, data: {type: "expeditionProgress", data: {pet: PET, locationType: "forest", mapLocationId: 12, returnTime: Date.now() + 120_000, riskCategory: "moderate"}}, reactions: [{type: "expeditionRecall", data: {}}, {type: "expeditionClose", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetExpeditionCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:expedition.recall"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:expedition.recall"));
		expect(screen.queryByText("app:expedition.confirmRecall")).toBeNull();
		await fireEvent.press(screen.getByText("app:expedition.recall"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:expedition.confirmRecall"));
		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("tells a costly cancellation with the pet's disappointment and the trust it lost", async () => {
		const packet = Object.assign(new PetExpeditionCancelRes(), {loveLost: 5, isFreeCancellation: false, pet: {...PET, petSex: "f" as const}});
		await render(<PetExpeditionOutcome outcome={{kind: "cancelled", packet}} onContinue={jest.fn()} />);
		expect(screen.getByTestId("pet-let-down", {includeHiddenElements: true})).toBeTruthy();
		expect(screen.getByText("commands:petExpedition.cancelled")).toBeTruthy();
		expect(screen.getByText("-5")).toBeTruthy();
	});

	it("only warns about the next cancellations when this one was free", async () => {
		const packet = Object.assign(new PetExpeditionCancelRes(), {loveLost: 0, isFreeCancellation: true, pet: PET});
		await render(<PetExpeditionOutcome outcome={{kind: "cancelled", packet}} onContinue={jest.fn()} />);
		expect(screen.getByText("commands:petExpedition.freeCancelled")).toBeTruthy();
		expect(screen.queryByTestId("event-effect")).toBeNull();
	});

	it("announces a departure with a toast, the pet page following the trip from there", async () => {
		const packet = Object.assign(new PetExpeditionStartedRes(), {success: true, expedition: {pet: PET, locationType: "forest", mapLocationId: 12, returnTime: Date.now() + 60_000, riskCategory: "low"}, insufficientFood: true, insufficientFoodCause: "guildNoFood"});
		await render(<PetExpeditionOutcome outcome={{kind: "started", packet}} onContinue={jest.fn()} />);
		expect(screen.getByText("app:expedition.outcomes.started")).toBeTruthy();
		expect(screen.getByText("app:expedition.insufficientFood.guildNoFood")).toBeTruthy();
		expect(screen.queryByText("app:common.back")).toBeNull();
	});

	it("displays the granted rewards without applying another partial-success multiplier", async () => {
		const packet = Object.assign(new PetExpeditionResolveRes(), {success: true, partialSuccess: true, totalFailure: false, pet: PET, expedition: {locationType: "forest", mapLocationId: 12}, rewards: {money: 53, experience: 29, points: 37, tokens: 2}, loveChange: 3, petLikedExpedition: true});
		await render(<PetExpeditionOutcome outcome={{kind: "resolved", packet}} onContinue={jest.fn()} />);
		expect(screen.getByText("+29")).toBeTruthy();
		expect(screen.getByText("+37")).toBeTruthy();
		expect(screen.getByText("app:expedition.resolvedTitles.partial")).toBeTruthy();
		expect(screen.getByText("commands:petExpedition.partialSuccesscommands:petExpedition.loveChangePartialPositivecommands:petExpedition.petLikedExpedition")).toBeTruthy();
	});

	it("names the equipment brought back among the gains and leads straight to it", async () => {
		const onContinue = jest.fn();
		const packet = Object.assign(new PetExpeditionResolveRes(), {success: true, partialSuccess: false, totalFailure: false, pet: PET, expedition: {locationType: "forest", mapLocationId: 12}, rewards: {money: 20, experience: 35, points: 10, itemGiven: true}, loveChange: 10});
		await render(<PetExpeditionOutcome outcome={{kind: "resolved", packet}} onContinue={onContinue} />);
		expect(screen.getByText("app:expedition.itemFound")).toBeTruthy();
		expect(screen.queryByTestId("detail-sheet-backdrop")).toBeNull();
		await fireEvent.press(screen.getByText("app:expedition.seeItem"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});