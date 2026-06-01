import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import {
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { StringUtils } from "../../../../utils/StringUtils";
import { createCityCollector } from "../ReportCityMenu";
import {
	ReportCityButtonStyles, ReportCityMenuIds
} from "../ReportCityMenuConstants";

type CityConfirmationAction = {
	buttonInteraction: MessageComponentInteraction;
	nestedMenus: CrowniclesNestedMenus;
};

/**
 * How the confirm button interaction should be acknowledged before `onConfirm`
 * runs. "update" defers via deferUpdate (default — used when the confirm handler
 * edits the menu in place). "reply" defers via deferReply (used when the
 * handler will produce a new reply, e.g. notary reactions). "none" leaves
 * acknowledgement to the caller.
 */
export type CityConfirmationAck = "update" | "reply" | "none";

export type CityConfirmationMenuConfig = {
	interaction: CrowniclesInteraction;
	collectorTime: number;
	lng: Language;
	pseudo: string;
	description: string;
	confirmLabel: string;
	confirmEmoji?: string;
	confirmStyle?: ButtonStyle;
	backMenuId: string;
	confirmAck?: CityConfirmationAck;
	onConfirm: (action: CityConfirmationAction) => Promise<void>;
};

function buildCityConfirmationContainer(config: CityConfirmationMenuConfig): ContainerBuilder {
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(StringUtils.formatHeader(i18n.t("commands:report.city.confirmation.title", {
			lng: config.lng,
			pseudo: config.pseudo
		})))
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(config.description)
	);
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	const confirmButton = new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM)
		.setLabel(config.confirmLabel)
		.setEmoji(config.confirmEmoji ?? CrowniclesIcons.collectors.accept)
		.setStyle(config.confirmStyle ?? ReportCityButtonStyles.CONFIRM);

	const cancelButton = new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.CITY_CONFIRMATION_CANCEL)
		.setLabel(i18n.t("commands:report.city.confirmation.cancel", { lng: config.lng }))
		.setEmoji(CrowniclesIcons.collectors.refuse)
		.setStyle(ReportCityButtonStyles.CANCEL);

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)
	);

	return container;
}

async function ackConfirm(action: CityConfirmationAction, ack: CityConfirmationAck): Promise<void> {
	if (ack === "update") {
		await action.buttonInteraction.deferUpdate();
	}
	else if (ack === "reply") {
		await action.buttonInteraction.deferReply();
	}
}

function createCityConfirmationCollector(
	config: CityConfirmationMenuConfig
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(config.interaction, config.collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		if (customId === ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM) {
			const action = {
				buttonInteraction,
				nestedMenus
			};
			await ackConfirm(action, config.confirmAck ?? "update");
			await config.onConfirm(action);
			return;
		}

		if (customId === ReportCityMenuIds.CITY_CONFIRMATION_CANCEL) {
			await buttonInteraction.deferUpdate();
			await nestedMenus.changeMenu(config.backMenuId);
		}
	});
}

export function registerCityConfirmationMenu(
	nestedMenus: CrowniclesNestedMenus,
	config: CityConfirmationMenuConfig
): void {
	nestedMenus.registerMenu(ReportCityMenuIds.CITY_CONFIRMATION_MENU, {
		containers: [buildCityConfirmationContainer(config)],
		createCollector: createCityConfirmationCollector(config)
	});
}

/**
 * Register the shared confirmation menu and immediately navigate to it.
 * Single entry point used by every "are you sure?" flow in the city.
 */
export async function openCityConfirmationMenu(
	nestedMenus: CrowniclesNestedMenus,
	config: CityConfirmationMenuConfig
): Promise<void> {
	registerCityConfirmationMenu(nestedMenus, config);
	await nestedMenus.changeMenu(ReportCityMenuIds.CITY_CONFIRMATION_MENU);
}

/**
 * Subset of menu context every city confirmation needs. Lets callers forward
 * their own typed context object without re-listing the fields each time.
 */
export type CityConfirmationContext = Pick<CityConfirmationMenuConfig, "interaction" | "collectorTime" | "lng" | "pseudo">;

export type CityConfirmationOptions = Pick<
	CityConfirmationMenuConfig,
	"description" | "confirmLabel" | "confirmEmoji" | "confirmStyle" | "backMenuId" | "confirmAck" | "onConfirm"
>;

/**
 * Convenience overload: call sites typically pass a wider menu context object.
 * This avoids each caller re-listing `interaction / collectorTime / lng / pseudo`.
 */
export async function openCityConfirmation(
	nestedMenus: CrowniclesNestedMenus,
	ctx: CityConfirmationContext,
	options: CityConfirmationOptions
): Promise<void> {
	await openCityConfirmationMenu(nestedMenus, {
		interaction: ctx.interaction,
		collectorTime: ctx.collectorTime,
		lng: ctx.lng,
		pseudo: ctx.pseudo,
		...options
	});
}
