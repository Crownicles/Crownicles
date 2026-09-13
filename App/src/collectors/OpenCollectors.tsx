import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {isAdventureCollector} from "@/src/collectors/CollectorRouting";
import {Theme} from "@/src/design/Theme";
import {CLASSES_DATA_KINDS, DAILY_BONUS_DATA_KINDS, DRINK_DATA_KINDS, EQUIP_DATA_KINDS, EXPEDITION_DATA_KINDS, PET_FEED_DATA_KINDS, PET_MANAGEMENT_DATA_KINDS, SELL_DATA_KINDS, GUILD_DATA_KINDS, FIGHT_DATA_KINDS, ReactionCollectorDataKind,PLAYER_UTILITY_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {EquipCollector} from "@/src/collectors/EquipCollector";
import {SellCollector} from "@/src/collectors/SellCollector";
import {useInventoryOutcome} from "@/src/store/useInventoryOutcome";
import {InventoryOutcome} from "@/src/collectors/InventoryOutcome";
import {ConsumableCollector} from "@/src/collectors/ConsumableCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ClassesCollector} from "@/src/collectors/ClassesCollector";
import {ClassOutcome} from "@/src/collectors/ClassOutcome";
import {useClassOutcome} from "@/src/store/useClassOutcome";
import {usePetFeedOutcome} from "@/src/store/usePetFeedOutcome";
import {PetFeedCollector} from "@/src/collectors/PetFeedCollector";
import {PetFeedOutcome} from "@/src/collectors/PetFeedOutcome";
import {PetExpeditionCollector} from "@/src/collectors/PetExpeditionCollector";
import {useExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {PetExpeditionOutcome} from "@/src/collectors/PetExpeditionOutcome";
import {PetManagementCollector} from "@/src/collectors/PetManagementCollector";
import {PetSellCollector} from "@/src/collectors/PetSellCollector";
import {PetManagementOutcome} from "@/src/collectors/PetManagementOutcome";
import {usePetManagementOutcome} from "@/src/store/usePetManagementOutcome";
import {GuildCreateCollector} from "@/src/collectors/GuildCreateCollector";
import {GuildOutcome} from "@/src/collectors/GuildOutcome";
import {useGuildOutcome} from "@/src/store/useGuildOutcome";
import {useGuildDomainOutcome} from "@/src/store/useGuildDomainOutcome";
import {GuildDomainOutcome} from "@/src/collectors/GuildDomainOutcome";
import {FightSession} from "@/src/collectors/FightCollector";
import {FightConfirmCollector} from "@/src/collectors/FightActionCollector";
import {useLeagueRewardOutcome} from "@/src/store/useLeagueRewardOutcome";
import {LeagueRewardOutcome} from "@/src/collectors/LeagueRewardOutcome";
import {PlayerUtilityCollector, PlayerUtilityOutcome} from "@/src/collectors/PlayerUtilityCollector";
import {usePlayerUtilityOutcome} from "@/src/store/usePlayerUtilityOutcome";

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.xl, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.wash
	}
});

type ActiveCollectorProps = {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
};

const COLLECTOR_COMPONENTS: Partial<Record<ReactionCollectorDataKind, (props: ActiveCollectorProps) => ReactNode>> = {
	[PLAYER_UTILITY_DATA_KINDS.UNLOCK]: PlayerUtilityCollector,
	[PLAYER_UTILITY_DATA_KINDS.BOAT]: PlayerUtilityCollector,
	[FIGHT_DATA_KINDS.CONFIRM]: FightConfirmCollector,
	[GUILD_DATA_KINDS.REIMBURSE]: GuildCreateCollector,
	[GUILD_DATA_KINDS.INVITE]: GuildCreateCollector,
	[GUILD_DATA_KINDS.MEMBER]: GuildCreateCollector,
	[GUILD_DATA_KINDS.DESCRIPTION]: GuildCreateCollector,
	[GUILD_DATA_KINDS.LEAVE]: GuildCreateCollector,
	[GUILD_DATA_KINDS.CREATE]: GuildCreateCollector,
	[PET_MANAGEMENT_DATA_KINDS.TRANSFER]: PetManagementCollector,
	[PET_MANAGEMENT_DATA_KINDS.SELL]: PetSellCollector,
	[PET_MANAGEMENT_DATA_KINDS.FREE_SELECT]: PetManagementCollector,
	[PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM]: PetManagementCollector,
	[EXPEDITION_DATA_KINDS.CHOICE]: PetExpeditionCollector,
	[EXPEDITION_DATA_KINDS.PROGRESS]: PetExpeditionCollector,
	[EXPEDITION_DATA_KINDS.FINISHED]: PetExpeditionCollector,
	[PET_FEED_DATA_KINDS.GUILD]: PetFeedCollector,
	[PET_FEED_DATA_KINDS.PERSONAL]: PetFeedCollector,
	[CLASSES_DATA_KINDS.COLLECTOR]: ClassesCollector,
	[SELL_DATA_KINDS.COLLECTOR]: SellCollector,
	[DAILY_BONUS_DATA_KINDS.COLLECTOR]: ConsumableCollector,
	[DRINK_DATA_KINDS.COLLECTOR]: ConsumableCollector
};

function InventoryCollector({collector, onChoose, submitting}: ActiveCollectorProps): ReactNode {
	if (collector.data.type === EQUIP_DATA_KINDS.COLLECTOR) return <EquipCollector collector={{...collector, data: collector.data}} onChoose={onChoose} submitting={submitting} />;
	const Component = COLLECTOR_COMPONENTS[collector.data.type] ?? CollectorPrompt;
	return <Component collector={collector} onChoose={onChoose} submitting={submitting} />;
}

/**
 * Shows every collector waiting for an answer, wherever the player is.
 *
 * A collector is not tied to the screen that opened it, and the server may open one on its own, so
 * it is rendered above the tabs rather than inside a screen.
 */
function PendingOutcome<Outcome>({state, Content}: {state: {outcome: Outcome | null; clear: () => void}; Content: (props: {outcome: Outcome; onContinue: () => void}) => ReactNode}): ReactNode {
	return state.outcome === null ? null : <Content outcome={state.outcome} onContinue={state.clear} />;
}

function PendingOutcomes(): ReactNode {
	const inventoryOutcome = useInventoryOutcome();
	const classOutcome = useClassOutcome();
	const feedOutcome = usePetFeedOutcome();
	const expeditionOutcome = useExpeditionOutcome();
	const managementOutcome = usePetManagementOutcome();
	const guildOutcome = useGuildOutcome();
	const domainOutcome = useGuildDomainOutcome();
	const leagueOutcome = useLeagueRewardOutcome();
	const utilityOutcome = usePlayerUtilityOutcome();
	return <>
		<PendingOutcome state={utilityOutcome} Content={PlayerUtilityOutcome} />
		<PendingOutcome state={leagueOutcome} Content={LeagueRewardOutcome} />
		<PendingOutcome state={domainOutcome} Content={GuildDomainOutcome} />
		<PendingOutcome state={guildOutcome} Content={GuildOutcome} />
		<PendingOutcome state={managementOutcome} Content={PetManagementOutcome} />
		<PendingOutcome state={expeditionOutcome} Content={PetExpeditionOutcome} />
		<PendingOutcome state={feedOutcome} Content={PetFeedOutcome} />
		<PendingOutcome state={classOutcome} Content={ClassOutcome} />
		<PendingOutcome state={inventoryOutcome} Content={InventoryOutcome} />
	</>;
}

export function OpenCollectors(): ReactNode {
	const {open, react, isAnswerPending} = useCollectors();
	const fallbackCollectors = open.filter(collector => !isAdventureCollector(collector) && collector.data.type !== FIGHT_DATA_KINDS.ACTION);
	return <>
		<FightSession />
		<PendingOutcomes />
		{fallbackCollectors.length > 0 ? <View style={styles.container}>
			{fallbackCollectors.map(collector => (
				<InventoryCollector
					key={collector.id}
					collector={collector}
					onChoose={(reactionIndex): void => react(collector.id, reactionIndex)}
					submitting={isAnswerPending(collector.id)}
				/>
			))}
		</View> : null}
	</>;
}
