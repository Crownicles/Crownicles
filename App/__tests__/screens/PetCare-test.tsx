import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PetNickname} from "@/src/components/PetNickname";
import {PetFeedCollector} from "@/src/collectors/PetFeedCollector";
import {PetSellCollector} from "@/src/collectors/PetSellCollector";
import {PetSale} from "@/src/components/PetSale";
import {PetPowersContent} from "@/src/components/PetPowers";
import {PetSellReq} from "ws-packets/src/fromClient/PetManagementReq";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PetNickReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetNickRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {GameClient} from "@/src/networking/GameClient";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: jest.fn()})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const PET = {typeId: 1, nickname: "Aster", rarity: 1, sex: "m" as const, loveLevel: 3, force: 10, feedDelay: 2};

describe("pet care screens", () => {
	beforeEach(() => jest.clearAllMocks());

	it("filters the catalog by species and displays server-linked powers", async () => {
		await render(<PetPowersContent powers={[{petTypeId: 1, rarity: 1, assistanceId: "bite"}, {petTypeId: 85, rarity: 1, assistanceId: "isUseless"}]} />);
		expect(screen.getByText("app:pet.powers.effects.isUseless")).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("app:pet.powers.search"), "pets.85");
		expect(screen.getByText("models:pets.85")).toBeTruthy();
		expect(screen.queryByText("models:pets.1")).toBeNull();
	});

	it("offers a pet to the chosen rank without changing the price", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "PetManagementRes"});
		await render(<PetSale pet={PET} />);
		await fireEvent.changeText(screen.getByLabelText("app:pet.sale.rank"), "12");
		await fireEvent.changeText(screen.getByLabelText("app:pet.sale.price"), "321");
		await fireEvent.press(screen.getByText("app:pet.sale.offer"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toEqual(Object.assign(new PetSellReq(), {rank: 12, price: 321}));
	});

	it.each(["seller", "buyer"])("offers only the authenticated %s controls with original indices", async role => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "sale", endTime: Date.now() + 60_000, data: {type: "petSell", data: {pet: PET, price: 321, role}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetSellCollector collector={collector} onChoose={onChoose} submitting={false} />);
		if (role === "seller") {
			expect(screen.queryByText("app:pet.sale.buy")).toBeNull();
			await fireEvent.press(screen.getByText("app:pet.sale.cancel"));
			expect(onChoose).toHaveBeenCalledWith(2);
		}
		else {
			await fireEvent.press(screen.getByText("app:pet.sale.buy"));
			expect(onChoose).toHaveBeenCalledWith(1);
		}
	});

	it("submits a nickname and reports the server validation error", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new PetNickRes(), {foundPet: true, nickNameIsAcceptable: false, newNickname: "!"})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><PetNickname pet={PET} /></QueryClientProvider>);
		await fireEvent.changeText(screen.getByLabelText("app:pet.care.newNickname"), "!");
		await fireEvent.press(screen.getByText("app:pet.care.save"));
		await waitFor(() => expect(screen.getByText("app:pet.care.invalidNickname")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledWith(expect.any(PetNickReq), expect.any(Function), expect.any(Array));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({newNickname: "!"});
	});

	it("clears the nickname only after the server confirms it", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new PetNickRes(), {foundPet: true, nickNameIsAcceptable: true, newNickname: ""})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><PetNickname pet={PET} /></QueryClientProvider>);
		await fireEvent.press(screen.getByText("app:pet.care.clear"));
		await waitFor(() => expect(screen.getByDisplayValue("")).toBeTruthy());
		expect(screen.getByText("app:pet.care.cleared")).toBeTruthy();
	});

	it("keeps the feed confirmation's original index when unknown choices exist", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "feed", endTime: Date.now() + 60_000, data: {type: "petFeedPersonal", data: {pet: PET, food: "commonFood", price: 42}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetFeedCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});