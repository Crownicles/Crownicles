import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS, FIGHT_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {Confirmation, KeyValue, Note, Panel, Row} from "@/src/design/Primitives";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {useFight} from "@/src/store/FightStore";
import {fightActionName} from "@/src/display/Fight";
import {className} from "@/src/display/Classes";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type CollectorProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

export function FightConfirmCollector({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== FIGHT_DATA_KINDS.CONFIRM) return null;
	const stats = collector.data.data.playerStats;
	return <Confirmation title={i18n.t("app:arena.confirm")} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<Panel>
			<KeyValue label={i18n.t("app:arena.class")} value={className(stats.classId)} />
			<KeyValue label={i18n.t("app:arena.energy")} value={i18n.t("app:profile.formats.progress", {value: stats.energy.value, max: stats.energy.max})} />
			<KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(stats.fightRanking.glory)} />
			{(["attack", "defense", "speed"] as const).map(stat => <KeyValue key={stat} label={i18n.t(`app:arena.stats.${stat}`)} value={formatNumber(stats[stat])} />)}
			{stats.pet ? <KeyValue label={i18n.t("app:arena.pet")} value={expeditionPetName(stats.pet)} /> : null}
		</Panel>
		{stats.pet?.isOnExpedition ? <Note>{i18n.t("app:pet.powers.expedition")}</Note> : null}
		<CollectorChoices collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}

export function FightActions({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const {introduction} = useFight();
	const choices = collector.reactions.map((reaction, index) => ({reaction, index, key: `${collector.id}:${index}`}));
	return <Panel>
		{choices.map(({reaction, index, key}) => {
			if (reaction.type !== FIGHT_REACTION_KINDS.ACTION) return <Row key={key} title={i18n.t("app:collector.unknownChoice")} disabled />;
			const breath = introduction?.initiatorActions.find(([id]) => id === reaction.data.id)?.[1];
			return <Row key={key} title={fightActionName(reaction.data.id)} subtitle={i18n.t(`models:fight_actions.${reaction.data.id}.description`, {defaultValue: ""})}
				{...(breath === undefined ? {} : {end: i18n.t("app:arena.actionBreath", {value: breath})})} disabled={locked} onPress={(): void => answer(index)} chevron />;
		})}
		<Note>{i18n.t(submitting ? "app:collector.answering" : "app:collector.timeLeft", {seconds: secondsLeft})}</Note>
	</Panel>;
}
