import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, GUILD_DATA_KINDS, ReactionCollectorData, ReactionCollectorDataOf} from "ws-packets/src/fromServer/collectors";
import {Confirmation, Note} from "@/src/design/Primitives";
import {CollectorDecision} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {Fact} from "@/src/design/Sections";

function guildConfirmationTitle(data: ReactionCollectorData): string {
	if (data.type === GUILD_DATA_KINDS.REIMBURSE) return i18n.t("app:guildDomain.reimburse");
	if (data.type === GUILD_DATA_KINDS.INVITE) return i18n.t("app:guild.invitation");
	if (data.type === GUILD_DATA_KINDS.MEMBER) return i18n.t(`app:guild.memberControls.${data.data.action}`);
	if (data.type === GUILD_DATA_KINDS.CREATE) return i18n.t("app:guild.confirmCreate", {name: data.data.guildName});
	return i18n.t(data.type === GUILD_DATA_KINDS.DESCRIPTION ? "app:guild.confirmDescription" : "app:guild.leave");
}

function GuildDepartureDetails({data}: {data: ReactionCollectorDataOf<typeof GUILD_DATA_KINDS.LEAVE>}): ReactNode {
	return <>
		<Note>{i18n.t(data.data.isGuildDestroyed ? "app:guild.dissolveWarning" : "app:guild.leaveWarning", {name: data.data.guildName})}</Note>
		{data.data.memberName ? <Note>{i18n.t("app:guild.newChief", {name: data.data.memberName})}</Note> : null}
	</>;
}

function GuildConfirmationDetails({data}: {data: ReactionCollectorData}): ReactNode {
	if (data.type === GUILD_DATA_KINDS.REIMBURSE) return <Note>{i18n.t("app:guildDomain.confirmReimburse", {amount: formatMoney(data.data.amount)})}</Note>;
	if (data.type === GUILD_DATA_KINDS.INVITE) return <Note>{i18n.t("app:guild.confirmInvitation", {guild: data.data.guildName})}</Note>;
	if (data.type === GUILD_DATA_KINDS.MEMBER) return <Note>{i18n.t("app:guild.confirmMember", {member: data.data.memberName ?? i18n.t("app:profile.values.unknown"), guild: data.data.guildName})}</Note>;
	if (data.type === GUILD_DATA_KINDS.CREATE) return <Fact label={i18n.t("app:pet.care.price")} value={formatMoney(data.data.price)} />;
	if (data.type === GUILD_DATA_KINDS.DESCRIPTION) return <Note>{data.data.description}</Note>;
	if (data.type === GUILD_DATA_KINDS.LEAVE) return <GuildDepartureDetails data={data} />;
	return null;
}

export function GuildCreateCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	return <Confirmation title={guildConfirmationTitle(collector.data)} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<GuildConfirmationDetails data={collector.data} />
		<CollectorDecision collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}