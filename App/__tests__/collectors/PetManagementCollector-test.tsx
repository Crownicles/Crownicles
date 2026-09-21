import {fireEvent, render, screen} from "@testing-library/react-native";
import {PetManagementCollector} from "@/src/collectors/PetManagementCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
const PET = {typeId: 1, nickname: "Aster", sex: "m", rarity: 1, loveLevel: 3, force: 10, feedDelay: 2};
describe("pet management confirmation", () => {
	it("confirms the transfer inside the row and preserves the original index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "transfer", endTime: Date.now() + 60_000, data: {type: "petTransfer", data: {ownPet: PET, shelterPets: []}}, reactions: [{type: "refuse", data: {}}, {type: "petDeposit", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetManagementCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:pet.management.deposit"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:pet.management.confirmTransfer"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
	it("leaves the transfer without asking anything when backing out", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "transfer", endTime: Date.now() + 60_000, data: {type: "petTransfer", data: {ownPet: PET, shelterPets: []}}, reactions: [{type: "refuse", data: {}}, {type: "petDeposit", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetManagementCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:common.back"));
		expect(onChoose).toHaveBeenCalledWith(0);
	});
	it("closes the transfer window as soon as the answer leaves, without waiting for the server", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "transfer", endTime: Date.now() + 60_000, data: {type: "petTransfer", data: {ownPet: PET, shelterPets: []}}, reactions: [{type: "refuse", data: {}}, {type: "petDeposit", data: {}}]});
		await render(<PetManagementCollector collector={collector} onChoose={jest.fn()} submitting={false} />);
		await fireEvent.press(screen.getByText("app:pet.management.deposit"));
		await fireEvent.press(screen.getByText("app:pet.management.confirmTransfer"));
		expect(screen.queryByText("app:pet.management.confirmTransfer")).toBeNull();
	});
	it("shows the irreversible warning and exact server price before freeing", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "free", endTime: Date.now() + 60_000, data: {type: "petFreeConfirm", data: {pet: {petTypeId: 1, petSex: "m", petNickname: "Aster"}, freeCost: 1000, isFromShelter: true}}, reactions: [{type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetManagementCollector collector={collector} onChoose={onChoose} submitting={false} />);
		expect(screen.getByText("app:pet.management.irreversible")).toBeTruthy();
		expect(screen.getByText("app:pet.management.shelter")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});