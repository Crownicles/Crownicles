import {render, screen} from "@testing-library/react-native";
import {FightEventStory} from "@/src/components/FightDetails";
import {FightLogRecord} from "@/src/store/FightStore";
import {reloadI18n} from "@/src/translations/i18nLoader";
import french from "../../../Lang/fr/app.json";
import commands from "../../../Lang/fr/commands.json";
import models from "../../../Lang/fr/models.json";

const PET_ACTION: FightLogRecord = {sequence: 1, entry: {
	fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "stealWeapon", status: "success",
	pet: {typeId: 1, nickname: "Milo", rarity: 1, sex: "m", loveLevel: 5, force: 10, feedDelay: 0}
}};

describe("live combat narrative", () => {
	beforeAll(async () => {
		await reloadI18n(new Map([["Lang/fr/app.json", JSON.stringify(french)], ["Lang/fr/commands.json", JSON.stringify(commands)], ["Lang/fr/models.json", JSON.stringify(models)]]));
	});
	it("renders the pet-specific story with its nickname and without raw Markdown", async () => {
		await render(<FightEventStory record={PET_ACTION} />);
		expect(screen.getByText(/Drapht demande l'aide de Milo qui s'élance/)).toBeTruthy();
		expect(screen.queryByText(/\*\*|\{\{petNickname\}\}/)).toBeNull();
	});
	it("does not reveal the result or its consequences before impact", async () => {
		await render(<FightEventStory record={PET_ACTION} pending />);
		expect(screen.getByText("Milo s'apprête à intervenir pour Drapht.")).toBeTruthy();
		expect(screen.queryByText(/s'empare de l'arme ennemie/)).toBeNull();
	});
	it("names the correct recipients of damage, healing and reflected damage", async () => {
		const stats = {power: 73, maxEnergy: 100, attack: 10, defense: 10, speed: 10, breath: 5, maxBreath: 10, breathRegen: 2};
		const record: FightLogRecord = {sequence: 2, entry: {
			fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "energeticAttack", status: "normal",
			fightActionEffectDealt: {damages: 27, reflectedDamages: 3}, fightActionEffectReceived: {energy: 8}
		}, after: {fightId: "story", numberOfTurn: 2, maxNumberOfTurn: 30, activeFighter: {isSelf: true, stats}, defendingFighter: {isSelf: false, name: "Arsene", stats}}};
		await render(<FightEventStory record={record} />);
		expect(screen.getByText("Arsene : -27 énergie")).toBeTruthy();
		expect(screen.getByText("Vous : +8 énergie · -3 énergie")).toBeTruthy();
	});
	it("uses the custom defensive action description instead of a generic successful attack", async () => {
		await render(<FightEventStory record={{sequence: 3, entry: {fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "defenseBuff", status: "normal", customMessage: true}}} />);
		expect(screen.getByText("Drapht se prépare à se défendre...")).toBeTruthy();
	});
});