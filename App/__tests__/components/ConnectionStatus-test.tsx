import {render, screen} from "@testing-library/react-native";
import {ConnectionStatus} from "@/src/components/ConnectionStatus";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

describe("ConnectionStatus", () => {
	it("keeps the connection state visible through a cut and recovery", async () => {
		const {rerender} = await render(<ConnectionStatus state={AuthStateEnum.LOGGED_IN} bottomInset={34} />);
		expect(screen.getByText("Connecté au serveur")).toBeTruthy();
		for (const state of [AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE, AuthStateEnum.RECONNECTING_PACKET_QUEUE]) {
			await rerender(<ConnectionStatus state={state} bottomInset={34} />);
			expect(screen.getByText("Hors ligne · reconnexion en cours")).toBeTruthy();
			expect(screen.queryByText("Connecté au serveur")).toBeNull();
		}
		await rerender(<ConnectionStatus state={AuthStateEnum.LOGGED_IN} bottomInset={0} />);
		expect(screen.getByText("Connecté au serveur").props.accessibilityLiveRegion).toBe("polite");
		expect(screen.queryByText("Hors ligne · reconnexion en cours")).toBeNull();
	});
});