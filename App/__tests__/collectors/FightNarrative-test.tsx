import {render, screen} from "@testing-library/react-native";
import {FightEventStory, FightLog} from "@/src/components/FightDetails";
import {FightLogRecord} from "@/src/store/FightStore";
import {reloadI18n} from "@/src/translations/i18nLoader";
import {AppIcons} from "@/src/AppIcons";
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
	it.each([true, false])("keeps chronological order in compact and expanded history (compact: %s)", async compact => {
		const defense: FightLogRecord = {sequence: 2, entry: {fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "defenseBuff", status: "normal", customMessage: true}};
		const view = await render(<FightLog entries={[PET_ACTION, defense]} compact={compact} />);
		const rendered = JSON.stringify(view.toJSON());
		expect(rendered.indexOf("Intervention de Milo")).toBeLessThan(rendered.indexOf("Boost de la défense"));
	});
	it("retains older actions in the live history instead of dropping them", async () => {
		const entries = [1, 2, 3, 4, 5].map(sequence => ({...PET_ACTION, sequence}));
		await render(<FightLog entries={entries} compact />);
		expect(screen.getAllByText("Intervention de Milo")).toHaveLength(5);
		expect(screen.getAllByText(/Drapht demande l'aide de Milo qui s'élance/)).toHaveLength(5);
	});
	it("does not turn journal entries into controls", async () => {
		await render(<FightLog entries={[PET_ACTION]} />);
		expect(screen.queryAllByRole("button")).toHaveLength(0);
	});
	it("tells the outcome right away instead of announcing the action first", async () => {
		await render(<FightEventStory record={PET_ACTION} />);
		expect(screen.getByText(/s'empare de l'arme ennemie/)).toBeTruthy();
		expect(screen.queryByText(/s'apprête/)).toBeNull();
	});
	it("labels effects exactly like the Discord history does", async () => {
		const stats = {power: 73, maxEnergy: 100, attack: 10, defense: 10, speed: 10, breath: 5, maxBreath: 10, breathRegen: 2};
		const record: FightLogRecord = {sequence: 2, entry: {
			fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "energeticAttack", status: "normal",
			fightActionEffectDealt: {damages: 27, reflectedDamages: 3}, fightActionEffectReceived: {energy: 8}
		}, after: {fightId: "story", numberOfTurn: 2, maxNumberOfTurn: 30, activeFighter: {isSelf: true, stats}, defendingFighter: {isSelf: false, name: "Arsene", stats}}};
		await render(<FightEventStory record={record} />);
		expect(screen.getByText(/Énergie récupérée : 8/)).toBeTruthy();
		expect(screen.getByText(/Dégâts infligés : 27/)).toBeTruthy();
		expect(screen.getByText(/Dégâts reçus : 3/)).toBeTruthy();
		expect(screen.queryByText(/`/)).toBeNull();
	});
	it("shows the matching game icon next to each effect", async () => {
		jest.spyOn(AppIcons, "getIconOrNull").mockImplementation((path: string) => path === "unitValues.lostHealth" ? "\u{1F494}" : null);
		try {
			const record: FightLogRecord = {sequence: 4, entry: {
				fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "energeticAttack", status: "normal", fightActionEffectDealt: {damages: 27}
			}};
			await render(<FightEventStory record={record} />);
			expect(screen.getByLabelText("\u{1F494}")).toBeTruthy();
		}
		finally {
			jest.restoreAllMocks();
		}
	});
	it("uses the custom defensive action description instead of a generic successful attack", async () => {
		await render(<FightEventStory record={{sequence: 3, entry: {fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "defenseBuff", status: "normal", customMessage: true}}} />);
		expect(screen.getByText("Drapht se prépare à se défendre...")).toBeTruthy();
	});
	it("names the substituted action in both the title and the story", async () => {
		const record: FightLogRecord = {sequence: 4, entry: {fightId: "story", fighter: {isSelf: true, name: "Drapht"}, fightActionId: "counterAttack", usedFightActionId: "fireAttack", status: "normal"}};
		await render(<FightLog entries={[record]} />);
		expect(screen.getByText("Attaque riposte → Attaque feu")).toBeTruthy();
		await render(<FightEventStory record={record} />);
		expect(screen.getByText(/attaque feu/i)).toBeTruthy();
		expect(screen.queryByText(/riposte/i)).toBeNull();
	});
});