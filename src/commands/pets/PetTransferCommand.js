import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";

module.exports.commandInfo = {
	name: "pettransfer",
	aliases: ["pettr","ptr","ptransfer"],
	allowEffects: EFFECT.SMILEY
};

/**
 * Allow to transfer a pet
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
const PetTransferCommand = async function(message, language, args) {
	const [entity] = await Entities.getOrRegister(message.author.id);
	const pPet = entity.Player.Pet;

	let guild;
	try {
		guild = await Guilds.getById(entity.Player.guildId);
	}
	catch (error) {
		guild = null;
	}
	if (!guild) {
		return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.guildKick.getTranslation(language).notInAguild);
	}
	const guildPetCount = guild.GuildPets.length;
	const confirmEmbed = new DraftBotEmbed()
		.formatAuthor(JsonReader.commands.petTransfer.getTranslation(language).confirmSwitchTitle, message.author);
	const [server] = await Servers.getOrRegister(message.guild.id);

	if (args.length === 0) {
		if (!pPet) {
			return sendErrorMessage(message.author, message.channel, language, format(JsonReader.commands.petTransfer.getTranslation(language).noPetToTransfer, {
				prefix: server.prefix,
				cmd: "pettransfer",
				cmdShelter: "shelter"
			}));
		}
		if (pPet.lovePoints < PETS.LOVE_LEVELS[0]) {
			return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.petTransfer.getTranslation(language).isFeisty);
		}
		if (guildPetCount >= JsonReader.models.pets.slots) {
			return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.petTransfer.getTranslation(language).noSlotAvailable);
		}
		entity.Player.petId = null;
		entity.Player.save();
		await (await GuildPets.addPet(guild.id, pPet.id)).save();
		confirmEmbed.setDescription(format(JsonReader.commands.petTransfer.getTranslation(language).confirmDeposit, {
			pet: PetEntities.getPetEmote(pPet) + " " + (pPet.nickname ? pPet.nickname : PetEntities.getPetTypeName(pPet, language))
		}));
		return message.channel.send(confirmEmbed);
	}

	if (guildPetCount === 0) {
		return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.guildShelter.getTranslation(language).noPetMessage);
	}

	if (args.length !== 1 || !RegExp(/^[0-9]*$/).test(args[0])) {
		return sendErrorMessage(message.author, message.channel, language, format(JsonReader.commands.petTransfer.getTranslation(language).correctUsage, {
			prefix: server.prefix,
			cmd: "pettransfer",
			cmdShelter: "shelter"
		}));
	}

	const petId = parseInt(args[0], 10);
	if (petId < 1 || petId > guildPetCount) {
		if (guildPetCount === 1) {
			return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.petTransfer.getTranslation(language).wrongPetNumberSingle);
		}
		return sendErrorMessage(message.author, message.channel, language, format(JsonReader.commands.petTransfer.getTranslation(language).wrongPetNumberBetween, {
			max: guildPetCount
		}));
	}

	const swPet = guild.GuildPets[petId - 1];
	const swPetEntity = swPet.PetEntity;

	if (pPet) {
		swPet.petEntityId = pPet.id;
		await swPet.save();
	}
	else {
		await swPet.destroy();
	}
	entity.Player.petId = swPetEntity.id;
	await entity.Player.save();

	if (pPet) {
		if (pPet.lovePoints < PETS.LOVE_LEVELS[0]) {
			return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.petTransfer.getTranslation(language).isFeisty);
		}
		confirmEmbed.setDescription(format(JsonReader.commands.petTransfer.getTranslation(language).confirmSwitch, {
			pet1: PetEntities.getPetEmote(pPet) + " " + (pPet.nickname ? pPet.nickname : PetEntities.getPetTypeName(pPet, language)),
			pet2: PetEntities.getPetEmote(swPetEntity) + " " + (swPetEntity.nickname ? swPetEntity.nickname : PetEntities.getPetTypeName(swPetEntity, language))
		}));
	}
	else {
		confirmEmbed.setDescription(format(JsonReader.commands.petTransfer.getTranslation(language).confirmFollows, {
			pet: PetEntities.getPetEmote(swPetEntity) + " " + (swPetEntity.nickname ? swPetEntity.nickname : PetEntities.getPetTypeName(swPetEntity, language))
		}));
	}
	return message.channel.send(confirmEmbed);
};

module.exports.execute = PetTransferCommand;