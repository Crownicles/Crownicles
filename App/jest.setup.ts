import {clearTestQueryClients} from "./src/testing/testUtils";

// Tests render screens outside the app shell, where the real provider would have no window to measure.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

afterEach((): void => {
	clearTestQueryClients();
});