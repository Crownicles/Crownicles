<div style="text-align: center;">
<img src="https://cdn.discordapp.com/attachments/456120666874183680/575235193384861716/couronne.png" style="border-radius: 50%; width: 300px" alt="Couronne DraftBot">

DraftBot is a text adventure game. The story takes place in a medieval world, and the player embodies an adventurer who
wants to win a competition launched by the king, to win the princess' hand. To achieve this, he must travel and earn
points by going through a lot of danger, including thieves, wilderness, and scary children. Every few hours, the player
can follow their adventure through "reports" and interact with a multiple choice system, using reactions below the
report. Each choice has multiple issues, which could hurt the character, heal them, or even give them some stuff. During
the journey, they earn money, equipments, and points, and can use them to buy potions, items, or effects in the shop,
fight other players, and ascend the leaderboard.

[![](https://img.shields.io/discord/429765017332613120.svg)](https://discord.gg/5JqrMtZ)
[![](https://img.shields.io/github/stars/BastLast/DraftBot-A-Discord-Adventure.svg?label=Stars&style=social)](https://github.com/BastLast/DraftBot-A-Discord-Adventure)

</div>

<br>

# How to play the game?

DraftBot is originally a discord bot and has evolved to become a fully fledged game that you can play either through
discord or through other clients.

You can start playing by visiting our website: https://draftbot.com

# Create a custom DraftBot instance

_Before creating your own instance, please note that you can add the bot to your server through the link available on
the bot's discord_

**If you decide to work on the creation of your own instance of the bot, you are supposed to have a minimum of computer
skills. Bot support team will prioritize players of the main instance and will only provide very limited assistance. We
will fix bugs you report, but we will not teach you how to code a discord bot.**

Please do not copy and paste the commands we provide in this readme without :

- Understanding the command
- Replacing the relevant parts with your data
- Having read the whole document

**Only the code available in the "release" tab is considered "stable".**

## BETA BRANCH WARNING

You are here in the not yet released v5 of DraftBot. Compared to previous versions of the game, we migrated to
microservices. Cloning this repository will allow you to get all the services necessary to run draftbot v5.

This work is still in progress, please do not open issues about bugs faced in this version of the software.

## Dev environment setup

### Requirements

This list contains all the software programs necessary to run DraftBot. Our start guide will walk you through the
installation process

- Docker desktop
  - 🐧: https://docs.docker.com/engine/install/
  - 🪟: https://docs.docker.com/docker-for-windows/install/
- Webstorm
  - (or any other IDE, but we recommend Webstorm since our team uses it and we provide configurations for it)
- Git
- nvm (not mandatory but highly recommended)
  - 🪟: https://github.com/coreybutler/nvm-windows
  - 🐧: https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
- Node
  - (see package.json of any service for the relevant version)
- Yarn
  - (see package.json of any service for the relevant version)
  - https://yarnpkg.com/getting-started/install

### Start guide

This guide will help you run DraftBot on your computer. We provide instructions for Linux, MacOS (🐧) and Windows (🪟). If
not specified, the command is the same for all OS.
Please do not skip any step of this guide; otherwise, the following commands will not work.

2. Setup projects

Open the project in webstorm and use our "yarn install all" configuration to install all the dependencies.
Alternatively, you can run the following commands in the terminal (starting from the root of the project):

```sh
cd Lib && yarn install
cd ../Discord && yarn install
cd ../Core && yarn install
```

3. Setup database, Keycloak and an MQTT broker

#### Keycloak

For Keycloak, follow instructions in [README.md](./keycloak/README.md) in the keycloak folder.

#### Database

For the database, you can use a mariadb container with the following command:

```sh
# Run mariadb database with docker
docker run -d --name mariadb -e MARIADB_USER=draftbot -e MARIADB_PASSWORD=secret_password -e MARIADB_ROOT_PASSWORD=super_secret_password -v /path/to/volumes/mariadb:/var/lib/mysql -p 3306:3306 mariadb:latest
```

#### MQTT broker

You can use any MQTT broker, but we recommend using Mosquitto.

You can use [this guide](https://github.com/sukesh-ak/setup-mosquitto-with-docker) to install it with docker. Step 1, 2,
3, and 5 are enough to have a working MQTT broker.

The following config file can be used:

```
allow_anonymous true
listener 1883
persistence true
persistence_file mosquitto.db
persistence_location /mosquitto/data/
```

The only thing important is to allow anonymous connections.

4. Fill config files

```sh
# Copy files with default values
cp $DRAFTBOT_ROOT/Core/config/config.default.toml $DRAFTBOT_ROOT/Core/config/config.toml
cp $DRAFTBOT_ROOT/Discord/config/config.default.toml $DRAFTBOT_ROOT/Discord/config/config.toml
# The Core module also need access to the Keycloak server on the first launch
touch $DRAFTBOT_ROOT/Core/config/keycloak.toml # 🐧
New-Item $DRAFTBOT_ROOT/Core/config/keycloak.toml # 🪟
```

You can copy and paste the content of the keycloak section from the config.toml file in the Discord folder in the
keycloak.toml file.

5. Run projects

```sh
# First: start the core module
cd $DRAFTBOT_ROOT/Core && yarn start
# Then: start the discord module
cd $DRAFTBOT_ROOT/Discord && yarn start
```

You can set up npm launch scripts to make the start easier.
From now on you should be able to start the bot by running `yarn start` in the Core and Discord folders while having the
database and keycloak running.
Starting order is important, start with the database container and keycloak, then the Core and finally the Discord
module.

# Screenshots

![image](https://user-images.githubusercontent.com/56274541/120916573-ad599000-c6aa-11eb-9e6f-ccc804bc63b2.png)

# Links

- [Website](https://draftbot.com)
- [Discord server _(in French)_](https://discord.gg/5JqrMtZ)
- [Suggestion board _(in French)_](https://feedback.draftbot.com/)
- [Player guide](https://guide.draftbot.com)
- [Twitter account _(in French)_](https://twitter.com/DraftBot_?s=09)
