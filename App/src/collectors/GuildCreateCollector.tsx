import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, GUILD_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Confirmation, KeyValue, Panel} from "@/src/design/Primitives";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

export function GuildCreateCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== GUILD_DATA_KINDS.CREATE) return null;
	return <Confirmation title={i18n.t("app:guild.confirmCreate", {name: collector.data.data.guildName})} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<Panel><KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(collector.data.data.price)} /></Panel>
		<CollectorChoices collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}