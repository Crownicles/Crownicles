import { RuleTester } from "eslint";
import parser from "@typescript-eslint/parser";
import rule from "../../../eslint-custom-rules/no-unsaved-player-before-mission-update.mjs";

const options = [
	{
		playerMutators: ["addEnergy"],
		playerReloaders: ["addMoney", "addExperience"],
		nonPlayerReceiver: "[Gg]uild$"
	}
];

const unsavedPlayer = [{ messageId: "unsavedPlayer" }];

function inFunction(body: string): string {
	return `async function f(player, guild, guildChief, guildLike, x, list) { ${body} }`;
}

new RuleTester({ languageOptions: { parser } }).run("no-unsaved-player-before-mission-update", rule, {
	valid: [
		"player.class = 2; await player.save(); await player.addMoney({});",
		"await player.addMoney({}); player.class = 2;",
		"const later = () => { player.class = 2; }; await player.addMoney({});",
		"guild.treasury -= 1; await guild.addExperience({});",
		"guildLike.guild.score = 1; await guildLike.guild.addExperience({});",
		"if (x) { player.class = 2; } else { await player.addMoney({}); }",
		"switch (x) { case 0: player.class = 2; break; case 1: await player.addMoney({}); }",
		"switch (x) { case 0: { player.class = 2; return; } case 1: await MissionsController.update(player, [], {}); }"
	].map(body => ({
		code: inFunction(body), options
	})),
	invalid: [
		"player.class = 2; await player.addMoney({});",
		"player.addEnergy(1); await player.addMoney({});",
		"player.class = 2; await MissionsController.update(player, [], {});",
		"guildChief.class = 2; await guildChief.addMoney({});",
		"if (x) { player.class = 2; } await player.addMoney({});",
		"switch (x) { case 0: player.class = 2; case 1: await player.addMoney({}); }",
		"switch (x) { case 0: player.class = 2; case 1: await MissionsController.update(player, [], {}); }",
		"for (const y of list) { if (y) { player.class = 2; } else { await player.addMoney({}); } }",
		"while (x) { switch (x) { case 0: player.class = 2; break; case 1: await player.addMoney({}); } }",
		"player.class = 2; await player.addMoney({ amount: 0 });",
		"player.class = 2; x ? await player.addMoney({}) : null;",
		"try { player.class = 2; } finally { await player.addMoney({}); }"
	].map(body => ({
		code: inFunction(body), options, errors: unsavedPlayer
	}))
});

const modelOptions = [
	{
		...options[0],
		playerReloaders: [...options[0].playerReloaders, "refresh"],
		playerModelFile: "models/Player.ts"
	}
];

new RuleTester({ languageOptions: { parser } }).run("no-unsaved-player-before-mission-update (model)", rule, {
	valid: [
		{
			code: "class Guild { async a() { this.score = 1; await this.addExperience({}); } }",
			filename: "models/Guild.ts"
		},
		{
			code: "class Player { async addMoney() { Object.assign(this, await load()); } async refresh() { await this.addMoney({}); } }",
			filename: "models/Player.ts"
		}
	].map(test => ({
		...test, options: modelOptions
	})),
	invalid: [
		{
			code: "class Player { async resync() { Object.assign(this, await load()); } async reload() { await this.resync(); } }",
			filename: "models/Player.ts",
			errors: [{ messageId: "unlistedReloader" }, { messageId: "unlistedReloader" }]
		},
		{
			code: "class Player { async addMoney() { Object.assign(this, await load()); } async refresh() { this.class = 2; await this.save(); this.class = 3; await this.addMoney({}); } }",
			filename: "models/Player.ts",
			errors: unsavedPlayer
		}
	].map(test => ({
		...test, options: modelOptions
	}))
});
