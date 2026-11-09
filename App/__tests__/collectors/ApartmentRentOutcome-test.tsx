import {
	render, screen
} from "@testing-library/react-native";
import { ApartmentRentRes } from "ws-packets/src/fromServer/home/ApartmentRentRes";
import { ApartmentRentOutcome } from "@/src/collectors/ApartmentRentOutcome";

describe("apartment rent outcome", () => {
	it("tells the rent just collected and the apartment it came from", async () => {
		await render(<ApartmentRentOutcome outcome={{
			mapLocationId: 6, rent: 2700
		} as ApartmentRentRes} onContinue={jest.fn()} />);

		expect(screen.getByText("Loyer perçu")).toBeTruthy();
		expect(screen.getByText(/^\+2[\s,.  ]?700$/u)).toBeTruthy();
	});
});
