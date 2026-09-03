import {clearTestQueryClients} from "./src/testing/testUtils";

afterEach((): void => {
	clearTestQueryClients();
});