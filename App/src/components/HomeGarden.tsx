import { ReactNode } from "react";
import { Text } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import { GardenInfoReq } from "ws-packets/src/fromClient/GardenReq";
import { GardenRes } from "ws-packets/src/fromServer/home/GardenRes";
import {
	GardenSnapshot, GardenCompostOffer, GardenOperation, GardenOutcome, GARDEN_OPERATIONS, GARDEN_ACCESS
} from "ws-packets/src/objects/Garden";
import { GameClient } from "@/src/networking/GameClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";
import { useGameQuery } from "@/src/store/useGameQuery";
import { useGardenActions } from "@/src/store/useGardenActions";
import { GameQueryContent } from "@/src/components/GameQueryContent";
import {
	Button, ButtonRow, Note, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, EFFECT_TONES, Effects, EntryRow, ExpandableEntry, ExpandableList, Fact, Figures, Gauge, Lock, useSectionStyles
} from "@/src/design/Sections";
import {
	Check, Clock3, Droplets, Sprout
} from "@/src/design/FightIcons";
import {
	ExpandedEntry, useExpandedEntry
} from "@/src/design/useExpandedEntry";
import { plantName } from "@/src/display/Resources";
import { formatTimeUntil } from "@/src/display/ItemEffects";
import { AppIcons } from "@/src/AppIcons";
import { i18n } from "@/src/translations/i18n";
import { useColors } from "@/src/design/ThemeContext";
import {
	CLOCK_INTERVALS, useCurrentTime
} from "@/src/store/useCurrentTime";

const PERCENTAGE_SCALE = 100;
type GardenActions = {
	pending: boolean;
	unfolding: ExpandedEntry<string>;
	submit: (operation: GardenOperation) => Promise<void>;
};
type GardenPlot = GardenSnapshot["plots"][number];

/** An operation is confirmed inside the row it belongs to, so the player never loses sight of it. */
function GardenChoice({
	entryKey, label, caption, end, operation, actions, action
}: {
	entryKey: string;
	label: string;
	caption?: string;
	end?: string;
	operation: GardenOperation;
	actions: GardenActions;
	action: string;
}): ReactNode {
	const sectionStyles = useSectionStyles();
	return <ExpandableEntry
		label={label}
		{...caption ? { caption } : {}}
		{...end ? { end: <Text style={sectionStyles.caption}>{end}</Text> } : {}}
		dimmed={actions.pending}
		expanded={actions.unfolding.isExpanded(entryKey)}
		onToggle={(): void => actions.unfolding.toggle(entryKey)}
	>
		<ActionBanner
			icon={Check}
			label={action}
			pending={actions.pending}
			onPress={(): void => {
				actions.unfolding.collapse();
				actions.submit(operation).catch(console.error);
			}}
		/>
	</ExpandableEntry>;
}

function GardenPlotRow({
	plot, garden, actions
}: {
	plot: GardenPlot; garden: GardenSnapshot; actions: GardenActions;
}): ReactNode {
	const colors = useColors();
	if (plot.plantId !== 0) {
		return <Gauge
			label={i18n.t("app:city.garden.plotPlant", {
				slot: plot.slot + 1, plant: plantName(plot.plantId)
			})}
			value={i18n.t(plot.isReady ? "app:city.garden.ready" : "app:city.garden.growing", { progress: Math.round(plot.growthProgress * PERCENTAGE_SCALE) })}
			ratio={plot.growthProgress}
			color={colors.green}
		/>;
	}
	if (!garden.eligibility.canPlantSeed) {
		return <EntryRow
			title={i18n.t("app:city.garden.plot", { slot: plot.slot + 1 })}
			subtitle={i18n.t("app:garden.errors.noSeed")}
			end={i18n.t("app:city.garden.empty")}
		/>;
	}
	return <GardenChoice
		entryKey={`plot-${plot.slot}`}
		label={i18n.t("app:city.garden.plot", { slot: plot.slot + 1 })}
		caption={i18n.t("app:garden.confirmPlant", {
			plant: plantName(garden.seedPlantId), slot: plot.slot + 1
		})}
		end={i18n.t("app:city.garden.empty")}
		operation={{
			type: GARDEN_OPERATIONS.PLANT, gardenSlot: plot.slot
		}}
		actions={actions}
		action={i18n.t("app:garden.plant")}
	/>;
}

function CompostOffers({
	offers, actions
}: {
	offers: GardenCompostOffer[]; actions: GardenActions;
}): ReactNode {
	if (!offers.length) {
		return null;
	}
	return <>
		<SectionHeader>{i18n.t("app:garden.compost")}</SectionHeader>
		<ExpandableList>{offers.map(offer => <GardenChoice
			key={`${offer.plantId}-${offer.quantity}`}
			entryKey={`compost-${offer.plantId}-${offer.quantity}`}
			label={plantName(offer.plantId)}
			caption={i18n.t("app:garden.confirmCompost", {
				plant: plantName(offer.plantId), count: offer.quantity
			})}
			end={i18n.t("app:garden.quantity", { count: offer.quantity })}
			operation={{
				type: GARDEN_OPERATIONS.COMPOST, ...offer
			}}
			actions={actions}
			action={i18n.t("app:garden.compost")}
		/>)}</ExpandableList>
	</>;
}

function ReceivedMaterials({ materials }: { materials: number[] }): ReactNode {
	const counts = new Map<number, number>();
	for (const materialId of materials) {
		counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
	}
	return <Effects items={[...counts].map(([materialId, quantity]) => ({
		label: i18n.t(`models:materials.${materialId}`),
		value: i18n.t("app:garden.quantity", { count: quantity }),
		tone: EFFECT_TONES.GAIN,
		emoji: AppIcons.getIconOrNull(`materials.${materialId}`) ?? AppIcons.getIcon("inventory.stock")
	}))} />;
}

function GardenResult({ outcome }: { outcome: GardenOutcome | null }): ReactNode {
	if (!outcome) {
		return null;
	}
	switch (outcome.kind) {
		case "plant": return <Note>{i18n.t("app:garden.planted", {
			plant: plantName(outcome.plantId), slot: outcome.gardenSlot + 1
		})}</Note>;
		case "water": return <Note>{i18n.t("app:garden.watered", {
			count: outcome.slotsWatered, ready: outcome.slotsBecameReady
		})}</Note>;
		case "harvest": return <><Note>{i18n.t("app:garden.harvested", {
			stored: outcome.plantsHarvested, composted: outcome.plantsComposted
		})}</Note><ReceivedMaterials materials={outcome.compostResults.map(result => result.materialId)} /></>;
		case "compost": return <><Note>{i18n.t("app:garden.composted", { count: outcome.quantity })}</Note><ReceivedMaterials materials={outcome.materials} /></>;
		case "notEnoughPlants": return <Note>{i18n.t("app:garden.notEnoughPlants")}</Note>;
		case "noAccess": return <Note>{i18n.t(`app:garden.noAccess.${outcome.reason}`)}</Note>;
		case "error": return <Note>{i18n.t(`app:garden.errors.${outcome.error}`)}</Note>;
		default: return null;
	}
}

/** Watering waits for its cooldown, or for a plant that needs it. */
function waterLock(garden: GardenSnapshot, now: number): Lock | undefined {
	if (garden.eligibility.canWaterGarden) {
		return undefined;
	}
	return garden.wateringAvailableAt !== null && garden.wateringAvailableAt > now
		? {
			reason: i18n.t("app:garden.locks.watering", { time: formatTimeUntil(garden.wateringAvailableAt, now) }), icon: Clock3
		}
		: { reason: i18n.t("app:garden.errors.noPlantsToWater") };
}

/** What the garden holds at a glance: how much is ripe, and whether a seed waits to be planted. */
function GardenFigures({ garden }: { garden: GardenSnapshot }): ReactNode {
	const ready = garden.plots.filter(plot => plot.isReady).length;
	return <Figures items={[
		{
			caption: i18n.t("app:garden.ready"), value: `${ready} / ${garden.totalPlots}`
		},
		{
			caption: i18n.t("app:inventory.seed"), value: garden.hasSeed ? plantName(garden.seedPlantId) : i18n.t("app:profile.values.none")
		}
	]} />;
}

function GardenPlots({
	garden, actions
}: {
	garden: GardenSnapshot; actions: GardenActions;
}): ReactNode {
	const lockFor = (lock: Lock | undefined): { lock?: Lock } => lock ? { lock } : {};
	const now = useCurrentTime(CLOCK_INTERVALS.MINUTE_MS);
	return <>
		<GardenFigures garden={garden} />
		<SectionHeader>{i18n.t("app:garden.plots")}</SectionHeader>
		<ExpandableList>{garden.plots.map(plot => <GardenPlotRow key={plot.slot} plot={plot} garden={garden} actions={actions} />)}</ExpandableList>
		<ActionBanner
			icon={Sprout}
			label={i18n.t("app:garden.harvest")}
			pending={actions.pending}
			{...lockFor(garden.eligibility.canHarvest ? undefined : { reason: i18n.t("app:garden.errors.noReadyPlants") })}
			onPress={(): void => {
				actions.submit({ type: GARDEN_OPERATIONS.HARVEST }).catch(console.error);
			}}
		/>
		{garden.accessMode === GARDEN_ACCESS.FULL
			? <ActionBanner
				icon={Droplets}
				label={i18n.t("app:garden.water")}
				pending={actions.pending}
				{...lockFor(waterLock(garden, now))}
				onPress={(): void => {
					actions.submit({ type: GARDEN_OPERATIONS.WATER }).catch(console.error);
				}}
			/>
			: null}
	</>;
}

function GardenStorage({ plants }: { plants: GardenSnapshot["plantStorage"] }): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:garden.storage")}</SectionHeader>
		<ExpandableList>{plants.map(plant => <Fact key={plant.plantId} label={plantName(plant.plantId)} value={i18n.t("app:equipment.capacity", {
			count: plant.quantity, max: plant.maxCapacity
		})} />)}{!plants.length ? <Note>{i18n.t("app:homeChest.noStoredPlants")}</Note> : null}</ExpandableList>
	</>;
}

function GardenContent({
	garden, offers
}: {
	garden: GardenSnapshot; offers: GardenCompostOffer[];
}): ReactNode {
	const {
		pending, message, submit, outcome
	} = useGardenActions();
	const unfolding = useExpandedEntry<string>();
	const actions = {
		pending, unfolding, submit
	};
	return <>
		{garden.accessMode === GARDEN_ACCESS.READ_ONLY ? <Note>{i18n.t("app:garden.remote")}</Note> : null}
		{message ? <Note>{message}</Note> : null}
		<GardenResult outcome={outcome} />
		<GardenPlots garden={garden} actions={actions} />
		<GardenStorage plants={garden.plantStorage} />
		<CompostOffers offers={offers} actions={actions} />
	</>;
}

export function HomeGarden(): ReactNode {
	const queryClient = useQueryClient();
	const state = useGameQuery(GAME_ENTITIES.GARDEN, () => GameClient.request(makeFromClientPacket(GardenInfoReq, {}), GardenRes));
	return <>
		<GameQueryContent state={state} entity={GAME_ENTITIES.GARDEN}>{packet => packet.outcome.kind === "snapshot" ? <GardenContent garden={packet.outcome.garden} offers={packet.outcome.compostOffers} /> : <GardenResult outcome={packet.outcome} />}</GameQueryContent>
		<ButtonRow><Button onPress={(): void => { queryClient.invalidateQueries({ queryKey: gameKey(GAME_ENTITIES.GARDEN) }).catch(console.error); }}>{i18n.t("app:garden.refresh")}</Button></ButtonRow>
	</>;
}
