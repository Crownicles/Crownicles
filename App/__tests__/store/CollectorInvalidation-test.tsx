import { ReactElement } from "react";
import { Text } from "react-native";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import { GameQueryProvider } from "@/src/store/GameQueryProvider";
import { useGameQuery } from "@/src/store/useGameQuery";
import { useGameInvalidations } from "@/src/store/GameInvalidations";
import { GAME_ENTITIES } from "@/src/store/GameEntities";
import { GameAnswer } from "@/src/networking/GameClient";
import { DRINK_DATA_KINDS } from "ws-packets/src/fromServer/collectors";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { InventoryRes } from "ws-packets/src/fromServer/inventory/InventoryRes";

jest.mock("expo-router", () => ({
	useFocusEffect: (): void => undefined
}));

/**
 * Drinking is resolved by the server well after the screen asked for it, so what a screen shows
 * next depends on the collector telling the store which entities to read again.
 */
describe("invalidation after a collector is answered", () => {
	it("reads the profile and the inventory again once a drink collector is answered", async () => {
		let profileReads = 0;
		let inventoryReads = 0;

		const readProfile = (): Promise<GameAnswer<ProfileRes>> => {
			profileReads++;
			return Promise.resolve({ kind: "answer", packet: { health: { value: profileReads === 1 ? 50 : 67 } } as ProfileRes });
		};
		const readInventory = (): Promise<GameAnswer<InventoryRes>> => {
			inventoryReads++;
			return Promise.resolve({ kind: "answer", packet: { foundPlayer: true } as InventoryRes });
		};

		let answerDrink = (): void => undefined;

		function DrinkScreen(): ReactElement {
			const profile = useGameQuery<ProfileRes>(GAME_ENTITIES.PROFILE, readProfile);
			useGameQuery<InventoryRes>(GAME_ENTITIES.INVENTORY, readInventory);
			const { afterCollector } = useGameInvalidations();

			answerDrink = (): void => afterCollector(DRINK_DATA_KINDS.COLLECTOR);

			return <Text>{profile.status === "ready" ? `health ${profile.data.health.value}` : profile.status}</Text>;
		}

		render(
			<GameQueryProvider>
				<DrinkScreen />
			</GameQueryProvider>
		);
		await waitFor(() => expect(screen.getByText("health 50")).toBeTruthy());
		expect(inventoryReads).toBe(1);

		await act(async () => {
			answerDrink();
		});

		await waitFor(() => expect(screen.getByText("health 67")).toBeTruthy());
		expect(inventoryReads).toBe(2);
	});

	it("leaves untouched entities alone", async () => {
		let petReads = 0;
		const readPet = (): Promise<GameAnswer<ProfileRes>> => {
			petReads++;
			return Promise.resolve({ kind: "answer", packet: {} as ProfileRes });
		};

		let answerDrink = (): void => undefined;

		function PetScreen(): ReactElement {
			const pet = useGameQuery<ProfileRes>(GAME_ENTITIES.PET, readPet);
			const { afterCollector } = useGameInvalidations();

			answerDrink = (): void => afterCollector(DRINK_DATA_KINDS.COLLECTOR);

			return <Text>{pet.status}</Text>;
		}

		render(
			<GameQueryProvider>
				<PetScreen />
			</GameQueryProvider>
		);
		await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());

		await act(async () => {
			answerDrink();
		});

		expect(petReads).toBe(1);
	});
});
