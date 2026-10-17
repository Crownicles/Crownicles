import { CrowniclesNestedMenus } from "../../../messages/CrowniclesNestedMenus";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import { handleStayInCityInteraction } from "./ReportCityMenu";
import { CrowniclesErrorEmbed } from "../../../messages/CrowniclesErrorEmbed";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";

/**
 * Minimal context shared by the guild domain and standalone guild food shop menus.
 * Both flows need to send a final reply and end the /rapport interaction.
 */
export interface ReportFlowContext {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
}

/**
 * Send the final action result as a followup reply and end the /rapport command.
 * Mirrors the pattern used by CookingFeatureHandler.sendCraftFollowup so the player
 * has to run /rapport again to see fully refreshed stats (avoids partial UI updates).
 */
export function finishReportWithMessage(
	ctx: ReportFlowContext,
	nestedMenus: CrowniclesNestedMenus,
	finalMessage: string
): void {
	const message = nestedMenus.message;
	if (message) {
		message.reply({ content: finalMessage })
			.catch(() => {
				// Ignore reply errors (e.g., message deleted): we still want to end the report.
			});
	}
	handleStayInCityInteraction(ctx.packet, ctx.context, null);
}

/**
 * Send the action failure as a CrowniclesErrorEmbed followup reply and end the /rapport command.
 * Used when a transactional action fails (e.g. concurrent buy that drained the treasury) so the
 * player gets a clear error and has to run /rapport again to see refreshed state.
 */
export function finishReportWithErrorEmbed(
	ctx: ReportFlowContext,
	nestedMenus: CrowniclesNestedMenus,
	reason: string
): void {
	const message = nestedMenus.message;
	if (message) {
		const errorEmbed = new CrowniclesErrorEmbed(ctx.interaction.user, ctx.context, ctx.interaction, reason, false, false);
		message.reply({ embeds: [errorEmbed] })
			.catch(() => {
				// Ignore reply errors (e.g., message deleted): we still want to end the report.
			});
	}
	handleStayInCityInteraction(ctx.packet, ctx.context, null);
}
