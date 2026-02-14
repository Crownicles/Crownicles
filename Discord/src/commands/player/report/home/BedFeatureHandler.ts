import { StringSelectMenuInteraction } from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "./HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorHomeBedReaction } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";

export class BedFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "bed";

	public isAvailable(_ctx: HomeFeatureHandlerContext): boolean {
		return true; // All homes have a bed
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		return {
			label: i18n.t("commands:report.city.homes.bed.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.bed.menuDescription", {
				lng: ctx.lng,
				health: ctx.homeData.features.bedHealthRegeneration
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.bed,
			value: this.featureId
		};
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		return [
			i18n.t("commands:report.city.homes.bed.available", {
				lng: ctx.lng,
				health: ctx.homeData.features.bedHealthRegeneration
			})
		];
	}

	public async handleFeatureSelection(
		ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		_nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await selectInteraction.deferReply();
		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorHomeBedReaction.name
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, selectInteraction, reactionIndex);
		}
	}

	public handleSubMenuSelection(
		_ctx: HomeFeatureHandlerContext,
		_selectedValue: string,
		_componentInteraction: ComponentInteraction,
		_nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		return Promise.resolve(false); // No sub-menu
	}

	public addSubMenuOptions(): void {
		// No sub-menu
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.bed.menuLabel", { lng: ctx.lng });
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.bed.available", {
			lng: ctx.lng,
			health: ctx.homeData.features.bedHealthRegeneration
		});
	}
}
