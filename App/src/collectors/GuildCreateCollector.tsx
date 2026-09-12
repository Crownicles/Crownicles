import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, GUILD_DATA_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {Confirmation, KeyValue, Note, Panel} from "@/src/design/Primitives";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

function guildConfirmationTitle(data: ReactionCollectorData): string {
	if (data.type === GUILD_DATA_KINDS.CREATE) return i18n.t("app:guild.confirmCreate", {name: data.data.guildName});
	return i18n.t(data.type === GUILD_DATA_KINDS.DESCRIPTION ? "app:guild.confirmDescription" : "app:guild.leave");
}

function GuildConfirmationDetails({data}: {data: ReactionCollectorData}): ReactNode {
	if (data.type === GUILD_DATA_KINDS.CREATE) return <Panel><KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(data.data.price)} /></Panel>;
	if (data.type === GUILD_DATA_KINDS.DESCRIPTION) return <Note>{data.data.description}</Note>;
	if (data.type === GUILD_DATA_KINDS.LEAVE) return <Note>{i18n.t(data.data.isGuildDestroyed ? "app:guild.dissolveWarning" : "app:guild.leaveWarning", {name: data.data.guildName})}</Note>;
	return null;
}

export function GuildCreateCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	return <Confirmation title={guildConfirmationTitle(collector.data)} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<GuildConfirmationDetails data={collector.data} />
		<CollectorChoices collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}