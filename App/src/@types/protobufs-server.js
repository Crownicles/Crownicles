/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
(function(global, factory) { /* global define, require, module */

    /* AMD */ if (typeof define === 'function' && define.amd)
        define(["protobufjs/minimal"], factory);

    /* CommonJS */ else if (typeof require === 'function' && typeof module === 'object' && module && module.exports)
        module.exports = factory(require("protobufjs/minimal"));

})(this, function($protobuf) {
    "use strict";

    // Common aliases
    var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
    
    // Exported root namespace
    var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});
    
    $root.PingRes = (function() {
    
        /**
         * Properties of a PingRes.
         * @exports IPingRes
         * @interface IPingRes
         * @property {number} time PingRes time
         */
    
        /**
         * Constructs a new PingRes.
         * @exports PingRes
         * @classdesc Represents a PingRes.
         * @implements IPingRes
         * @constructor
         * @param {IPingRes=} [properties] Properties to set
         */
        function PingRes(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * PingRes time.
         * @member {number} time
         * @memberof PingRes
         * @instance
         */
        PingRes.prototype.time = 0;
    
        /**
         * Creates a new PingRes instance using the specified properties.
         * @function create
         * @memberof PingRes
         * @static
         * @param {IPingRes=} [properties] Properties to set
         * @returns {PingRes} PingRes instance
         */
        PingRes.create = function create(properties) {
            return new PingRes(properties);
        };
    
        /**
         * Encodes the specified PingRes message. Does not implicitly {@link PingRes.verify|verify} messages.
         * @function encode
         * @memberof PingRes
         * @static
         * @param {IPingRes} message PingRes message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PingRes.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.time);
            return writer;
        };
    
        /**
         * Encodes the specified PingRes message, length delimited. Does not implicitly {@link PingRes.verify|verify} messages.
         * @function encodeDelimited
         * @memberof PingRes
         * @static
         * @param {IPingRes} message PingRes message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PingRes.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a PingRes message from the specified reader or buffer.
         * @function decode
         * @memberof PingRes
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {PingRes} PingRes
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PingRes.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.PingRes();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.time = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("time"))
                throw $util.ProtocolError("missing required 'time'", { instance: message });
            return message;
        };
    
        /**
         * Decodes a PingRes message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof PingRes
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {PingRes} PingRes
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PingRes.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a PingRes message.
         * @function verify
         * @memberof PingRes
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PingRes.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.time))
                return "time: integer expected";
            return null;
        };
    
        /**
         * Creates a PingRes message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof PingRes
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {PingRes} PingRes
         */
        PingRes.fromObject = function fromObject(object) {
            if (object instanceof $root.PingRes)
                return object;
            var message = new $root.PingRes();
            if (object.time != null)
                message.time = object.time | 0;
            return message;
        };
    
        /**
         * Creates a plain object from a PingRes message. Also converts values to other types if specified.
         * @function toObject
         * @memberof PingRes
         * @static
         * @param {PingRes} message PingRes
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PingRes.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.time = 0;
            if (message.time != null && message.hasOwnProperty("time"))
                object.time = message.time;
            return object;
        };
    
        /**
         * Converts this PingRes to JSON.
         * @function toJSON
         * @memberof PingRes
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PingRes.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Gets the default type url for PingRes
         * @function getTypeUrl
         * @memberof PingRes
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PingRes.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/PingRes";
        };
    
        return PingRes;
    })();
    
    $root.ProfileNotFound = (function() {
    
        /**
         * Properties of a ProfileNotFound.
         * @exports IProfileNotFound
         * @interface IProfileNotFound
         */
    
        /**
         * Constructs a new ProfileNotFound.
         * @exports ProfileNotFound
         * @classdesc Represents a ProfileNotFound.
         * @implements IProfileNotFound
         * @constructor
         * @param {IProfileNotFound=} [properties] Properties to set
         */
        function ProfileNotFound(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * Creates a new ProfileNotFound instance using the specified properties.
         * @function create
         * @memberof ProfileNotFound
         * @static
         * @param {IProfileNotFound=} [properties] Properties to set
         * @returns {ProfileNotFound} ProfileNotFound instance
         */
        ProfileNotFound.create = function create(properties) {
            return new ProfileNotFound(properties);
        };
    
        /**
         * Encodes the specified ProfileNotFound message. Does not implicitly {@link ProfileNotFound.verify|verify} messages.
         * @function encode
         * @memberof ProfileNotFound
         * @static
         * @param {IProfileNotFound} message ProfileNotFound message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileNotFound.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            return writer;
        };
    
        /**
         * Encodes the specified ProfileNotFound message, length delimited. Does not implicitly {@link ProfileNotFound.verify|verify} messages.
         * @function encodeDelimited
         * @memberof ProfileNotFound
         * @static
         * @param {IProfileNotFound} message ProfileNotFound message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileNotFound.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a ProfileNotFound message from the specified reader or buffer.
         * @function decode
         * @memberof ProfileNotFound
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {ProfileNotFound} ProfileNotFound
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileNotFound.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileNotFound();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a ProfileNotFound message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof ProfileNotFound
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {ProfileNotFound} ProfileNotFound
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileNotFound.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a ProfileNotFound message.
         * @function verify
         * @memberof ProfileNotFound
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProfileNotFound.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            return null;
        };
    
        /**
         * Creates a ProfileNotFound message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof ProfileNotFound
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {ProfileNotFound} ProfileNotFound
         */
        ProfileNotFound.fromObject = function fromObject(object) {
            if (object instanceof $root.ProfileNotFound)
                return object;
            return new $root.ProfileNotFound();
        };
    
        /**
         * Creates a plain object from a ProfileNotFound message. Also converts values to other types if specified.
         * @function toObject
         * @memberof ProfileNotFound
         * @static
         * @param {ProfileNotFound} message ProfileNotFound
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProfileNotFound.toObject = function toObject() {
            return {};
        };
    
        /**
         * Converts this ProfileNotFound to JSON.
         * @function toJSON
         * @memberof ProfileNotFound
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProfileNotFound.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Gets the default type url for ProfileNotFound
         * @function getTypeUrl
         * @memberof ProfileNotFound
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProfileNotFound.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/ProfileNotFound";
        };
    
        return ProfileNotFound;
    })();
    
    $root.ProfileRes = (function() {
    
        /**
         * Properties of a ProfileRes.
         * @exports IProfileRes
         * @interface IProfileRes
         * @property {Array.<string>|null} [badges] ProfileRes badges
         * @property {ProfileRes.IStats|null} [stats] ProfileRes stats
         * @property {ProfileRes.IMissions} missions ProfileRes missions
         * @property {ProfileRes.IRank} rank ProfileRes rank
         * @property {ProfileRes.IEffect} effect ProfileRes effect
         * @property {number|null} [classId] ProfileRes classId
         * @property {ProfileRes.IFightRanking|null} [fightRanking] ProfileRes fightRanking
         * @property {string|null} [guild] ProfileRes guild
         * @property {number|null} [destinationId] ProfileRes destinationId
         * @property {string|null} [mapTypeId] ProfileRes mapTypeId
         * @property {ProfileRes.IPet|null} [pet] ProfileRes pet
         * @property {string} color ProfileRes color
         * @property {number} level ProfileRes level
         * @property {ProfileRes.IHealth} health ProfileRes health
         * @property {ProfileRes.IExperience} experience ProfileRes experience
         * @property {number} money ProfileRes money
         * @property {string} pseudo ProfileRes pseudo
         */
    
        /**
         * Constructs a new ProfileRes.
         * @exports ProfileRes
         * @classdesc Represents a ProfileRes.
         * @implements IProfileRes
         * @constructor
         * @param {IProfileRes=} [properties] Properties to set
         */
        function ProfileRes(properties) {
            this.badges = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * ProfileRes badges.
         * @member {Array.<string>} badges
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.badges = $util.emptyArray;
    
        /**
         * ProfileRes stats.
         * @member {ProfileRes.IStats|null|undefined} stats
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.stats = null;
    
        /**
         * ProfileRes missions.
         * @member {ProfileRes.IMissions} missions
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.missions = null;
    
        /**
         * ProfileRes rank.
         * @member {ProfileRes.IRank} rank
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.rank = null;
    
        /**
         * ProfileRes effect.
         * @member {ProfileRes.IEffect} effect
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.effect = null;
    
        /**
         * ProfileRes classId.
         * @member {number} classId
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.classId = 0;
    
        /**
         * ProfileRes fightRanking.
         * @member {ProfileRes.IFightRanking|null|undefined} fightRanking
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.fightRanking = null;
    
        /**
         * ProfileRes guild.
         * @member {string} guild
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.guild = "";
    
        /**
         * ProfileRes destinationId.
         * @member {number} destinationId
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.destinationId = 0;
    
        /**
         * ProfileRes mapTypeId.
         * @member {string} mapTypeId
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.mapTypeId = "";
    
        /**
         * ProfileRes pet.
         * @member {ProfileRes.IPet|null|undefined} pet
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.pet = null;
    
        /**
         * ProfileRes color.
         * @member {string} color
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.color = "";
    
        /**
         * ProfileRes level.
         * @member {number} level
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.level = 0;
    
        /**
         * ProfileRes health.
         * @member {ProfileRes.IHealth} health
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.health = null;
    
        /**
         * ProfileRes experience.
         * @member {ProfileRes.IExperience} experience
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.experience = null;
    
        /**
         * ProfileRes money.
         * @member {number} money
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.money = 0;
    
        /**
         * ProfileRes pseudo.
         * @member {string} pseudo
         * @memberof ProfileRes
         * @instance
         */
        ProfileRes.prototype.pseudo = "";
    
        /**
         * Creates a new ProfileRes instance using the specified properties.
         * @function create
         * @memberof ProfileRes
         * @static
         * @param {IProfileRes=} [properties] Properties to set
         * @returns {ProfileRes} ProfileRes instance
         */
        ProfileRes.create = function create(properties) {
            return new ProfileRes(properties);
        };
    
        /**
         * Encodes the specified ProfileRes message. Does not implicitly {@link ProfileRes.verify|verify} messages.
         * @function encode
         * @memberof ProfileRes
         * @static
         * @param {IProfileRes} message ProfileRes message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileRes.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.badges != null && message.badges.length)
                for (var i = 0; i < message.badges.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.badges[i]);
            if (message.stats != null && Object.hasOwnProperty.call(message, "stats"))
                $root.ProfileRes.Stats.encode(message.stats, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            $root.ProfileRes.Missions.encode(message.missions, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            $root.ProfileRes.Rank.encode(message.rank, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            $root.ProfileRes.Effect.encode(message.effect, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.classId != null && Object.hasOwnProperty.call(message, "classId"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.classId);
            if (message.fightRanking != null && Object.hasOwnProperty.call(message, "fightRanking"))
                $root.ProfileRes.FightRanking.encode(message.fightRanking, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
            if (message.guild != null && Object.hasOwnProperty.call(message, "guild"))
                writer.uint32(/* id 8, wireType 2 =*/66).string(message.guild);
            if (message.destinationId != null && Object.hasOwnProperty.call(message, "destinationId"))
                writer.uint32(/* id 9, wireType 0 =*/72).int32(message.destinationId);
            if (message.mapTypeId != null && Object.hasOwnProperty.call(message, "mapTypeId"))
                writer.uint32(/* id 10, wireType 2 =*/82).string(message.mapTypeId);
            if (message.pet != null && Object.hasOwnProperty.call(message, "pet"))
                $root.ProfileRes.Pet.encode(message.pet, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
            writer.uint32(/* id 12, wireType 2 =*/98).string(message.color);
            writer.uint32(/* id 13, wireType 0 =*/104).int32(message.level);
            $root.ProfileRes.Health.encode(message.health, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
            $root.ProfileRes.Experience.encode(message.experience, writer.uint32(/* id 15, wireType 2 =*/122).fork()).ldelim();
            writer.uint32(/* id 16, wireType 0 =*/128).int32(message.money);
            writer.uint32(/* id 17, wireType 2 =*/138).string(message.pseudo);
            return writer;
        };
    
        /**
         * Encodes the specified ProfileRes message, length delimited. Does not implicitly {@link ProfileRes.verify|verify} messages.
         * @function encodeDelimited
         * @memberof ProfileRes
         * @static
         * @param {IProfileRes} message ProfileRes message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileRes.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a ProfileRes message from the specified reader or buffer.
         * @function decode
         * @memberof ProfileRes
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {ProfileRes} ProfileRes
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileRes.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.badges && message.badges.length))
                            message.badges = [];
                        message.badges.push(reader.string());
                        break;
                    }
                case 2: {
                        message.stats = $root.ProfileRes.Stats.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.missions = $root.ProfileRes.Missions.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.rank = $root.ProfileRes.Rank.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.effect = $root.ProfileRes.Effect.decode(reader, reader.uint32());
                        break;
                    }
                case 6: {
                        message.classId = reader.int32();
                        break;
                    }
                case 7: {
                        message.fightRanking = $root.ProfileRes.FightRanking.decode(reader, reader.uint32());
                        break;
                    }
                case 8: {
                        message.guild = reader.string();
                        break;
                    }
                case 9: {
                        message.destinationId = reader.int32();
                        break;
                    }
                case 10: {
                        message.mapTypeId = reader.string();
                        break;
                    }
                case 11: {
                        message.pet = $root.ProfileRes.Pet.decode(reader, reader.uint32());
                        break;
                    }
                case 12: {
                        message.color = reader.string();
                        break;
                    }
                case 13: {
                        message.level = reader.int32();
                        break;
                    }
                case 14: {
                        message.health = $root.ProfileRes.Health.decode(reader, reader.uint32());
                        break;
                    }
                case 15: {
                        message.experience = $root.ProfileRes.Experience.decode(reader, reader.uint32());
                        break;
                    }
                case 16: {
                        message.money = reader.int32();
                        break;
                    }
                case 17: {
                        message.pseudo = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("missions"))
                throw $util.ProtocolError("missing required 'missions'", { instance: message });
            if (!message.hasOwnProperty("rank"))
                throw $util.ProtocolError("missing required 'rank'", { instance: message });
            if (!message.hasOwnProperty("effect"))
                throw $util.ProtocolError("missing required 'effect'", { instance: message });
            if (!message.hasOwnProperty("color"))
                throw $util.ProtocolError("missing required 'color'", { instance: message });
            if (!message.hasOwnProperty("level"))
                throw $util.ProtocolError("missing required 'level'", { instance: message });
            if (!message.hasOwnProperty("health"))
                throw $util.ProtocolError("missing required 'health'", { instance: message });
            if (!message.hasOwnProperty("experience"))
                throw $util.ProtocolError("missing required 'experience'", { instance: message });
            if (!message.hasOwnProperty("money"))
                throw $util.ProtocolError("missing required 'money'", { instance: message });
            if (!message.hasOwnProperty("pseudo"))
                throw $util.ProtocolError("missing required 'pseudo'", { instance: message });
            return message;
        };
    
        /**
         * Decodes a ProfileRes message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof ProfileRes
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {ProfileRes} ProfileRes
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileRes.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a ProfileRes message.
         * @function verify
         * @memberof ProfileRes
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProfileRes.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.badges != null && message.hasOwnProperty("badges")) {
                if (!Array.isArray(message.badges))
                    return "badges: array expected";
                for (var i = 0; i < message.badges.length; ++i)
                    if (!$util.isString(message.badges[i]))
                        return "badges: string[] expected";
            }
            if (message.stats != null && message.hasOwnProperty("stats")) {
                var error = $root.ProfileRes.Stats.verify(message.stats);
                if (error)
                    return "stats." + error;
            }
            {
                var error = $root.ProfileRes.Missions.verify(message.missions);
                if (error)
                    return "missions." + error;
            }
            {
                var error = $root.ProfileRes.Rank.verify(message.rank);
                if (error)
                    return "rank." + error;
            }
            {
                var error = $root.ProfileRes.Effect.verify(message.effect);
                if (error)
                    return "effect." + error;
            }
            if (message.classId != null && message.hasOwnProperty("classId"))
                if (!$util.isInteger(message.classId))
                    return "classId: integer expected";
            if (message.fightRanking != null && message.hasOwnProperty("fightRanking")) {
                var error = $root.ProfileRes.FightRanking.verify(message.fightRanking);
                if (error)
                    return "fightRanking." + error;
            }
            if (message.guild != null && message.hasOwnProperty("guild"))
                if (!$util.isString(message.guild))
                    return "guild: string expected";
            if (message.destinationId != null && message.hasOwnProperty("destinationId"))
                if (!$util.isInteger(message.destinationId))
                    return "destinationId: integer expected";
            if (message.mapTypeId != null && message.hasOwnProperty("mapTypeId"))
                if (!$util.isString(message.mapTypeId))
                    return "mapTypeId: string expected";
            if (message.pet != null && message.hasOwnProperty("pet")) {
                var error = $root.ProfileRes.Pet.verify(message.pet);
                if (error)
                    return "pet." + error;
            }
            if (!$util.isString(message.color))
                return "color: string expected";
            if (!$util.isInteger(message.level))
                return "level: integer expected";
            {
                var error = $root.ProfileRes.Health.verify(message.health);
                if (error)
                    return "health." + error;
            }
            {
                var error = $root.ProfileRes.Experience.verify(message.experience);
                if (error)
                    return "experience." + error;
            }
            if (!$util.isInteger(message.money))
                return "money: integer expected";
            if (!$util.isString(message.pseudo))
                return "pseudo: string expected";
            return null;
        };
    
        /**
         * Creates a ProfileRes message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof ProfileRes
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {ProfileRes} ProfileRes
         */
        ProfileRes.fromObject = function fromObject(object) {
            if (object instanceof $root.ProfileRes)
                return object;
            var message = new $root.ProfileRes();
            if (object.badges) {
                if (!Array.isArray(object.badges))
                    throw TypeError(".ProfileRes.badges: array expected");
                message.badges = [];
                for (var i = 0; i < object.badges.length; ++i)
                    message.badges[i] = String(object.badges[i]);
            }
            if (object.stats != null) {
                if (typeof object.stats !== "object")
                    throw TypeError(".ProfileRes.stats: object expected");
                message.stats = $root.ProfileRes.Stats.fromObject(object.stats);
            }
            if (object.missions != null) {
                if (typeof object.missions !== "object")
                    throw TypeError(".ProfileRes.missions: object expected");
                message.missions = $root.ProfileRes.Missions.fromObject(object.missions);
            }
            if (object.rank != null) {
                if (typeof object.rank !== "object")
                    throw TypeError(".ProfileRes.rank: object expected");
                message.rank = $root.ProfileRes.Rank.fromObject(object.rank);
            }
            if (object.effect != null) {
                if (typeof object.effect !== "object")
                    throw TypeError(".ProfileRes.effect: object expected");
                message.effect = $root.ProfileRes.Effect.fromObject(object.effect);
            }
            if (object.classId != null)
                message.classId = object.classId | 0;
            if (object.fightRanking != null) {
                if (typeof object.fightRanking !== "object")
                    throw TypeError(".ProfileRes.fightRanking: object expected");
                message.fightRanking = $root.ProfileRes.FightRanking.fromObject(object.fightRanking);
            }
            if (object.guild != null)
                message.guild = String(object.guild);
            if (object.destinationId != null)
                message.destinationId = object.destinationId | 0;
            if (object.mapTypeId != null)
                message.mapTypeId = String(object.mapTypeId);
            if (object.pet != null) {
                if (typeof object.pet !== "object")
                    throw TypeError(".ProfileRes.pet: object expected");
                message.pet = $root.ProfileRes.Pet.fromObject(object.pet);
            }
            if (object.color != null)
                message.color = String(object.color);
            if (object.level != null)
                message.level = object.level | 0;
            if (object.health != null) {
                if (typeof object.health !== "object")
                    throw TypeError(".ProfileRes.health: object expected");
                message.health = $root.ProfileRes.Health.fromObject(object.health);
            }
            if (object.experience != null) {
                if (typeof object.experience !== "object")
                    throw TypeError(".ProfileRes.experience: object expected");
                message.experience = $root.ProfileRes.Experience.fromObject(object.experience);
            }
            if (object.money != null)
                message.money = object.money | 0;
            if (object.pseudo != null)
                message.pseudo = String(object.pseudo);
            return message;
        };
    
        /**
         * Creates a plain object from a ProfileRes message. Also converts values to other types if specified.
         * @function toObject
         * @memberof ProfileRes
         * @static
         * @param {ProfileRes} message ProfileRes
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProfileRes.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.badges = [];
            if (options.defaults) {
                object.stats = null;
                object.missions = null;
                object.rank = null;
                object.effect = null;
                object.classId = 0;
                object.fightRanking = null;
                object.guild = "";
                object.destinationId = 0;
                object.mapTypeId = "";
                object.pet = null;
                object.color = "";
                object.level = 0;
                object.health = null;
                object.experience = null;
                object.money = 0;
                object.pseudo = "";
            }
            if (message.badges && message.badges.length) {
                object.badges = [];
                for (var j = 0; j < message.badges.length; ++j)
                    object.badges[j] = message.badges[j];
            }
            if (message.stats != null && message.hasOwnProperty("stats"))
                object.stats = $root.ProfileRes.Stats.toObject(message.stats, options);
            if (message.missions != null && message.hasOwnProperty("missions"))
                object.missions = $root.ProfileRes.Missions.toObject(message.missions, options);
            if (message.rank != null && message.hasOwnProperty("rank"))
                object.rank = $root.ProfileRes.Rank.toObject(message.rank, options);
            if (message.effect != null && message.hasOwnProperty("effect"))
                object.effect = $root.ProfileRes.Effect.toObject(message.effect, options);
            if (message.classId != null && message.hasOwnProperty("classId"))
                object.classId = message.classId;
            if (message.fightRanking != null && message.hasOwnProperty("fightRanking"))
                object.fightRanking = $root.ProfileRes.FightRanking.toObject(message.fightRanking, options);
            if (message.guild != null && message.hasOwnProperty("guild"))
                object.guild = message.guild;
            if (message.destinationId != null && message.hasOwnProperty("destinationId"))
                object.destinationId = message.destinationId;
            if (message.mapTypeId != null && message.hasOwnProperty("mapTypeId"))
                object.mapTypeId = message.mapTypeId;
            if (message.pet != null && message.hasOwnProperty("pet"))
                object.pet = $root.ProfileRes.Pet.toObject(message.pet, options);
            if (message.color != null && message.hasOwnProperty("color"))
                object.color = message.color;
            if (message.level != null && message.hasOwnProperty("level"))
                object.level = message.level;
            if (message.health != null && message.hasOwnProperty("health"))
                object.health = $root.ProfileRes.Health.toObject(message.health, options);
            if (message.experience != null && message.hasOwnProperty("experience"))
                object.experience = $root.ProfileRes.Experience.toObject(message.experience, options);
            if (message.money != null && message.hasOwnProperty("money"))
                object.money = message.money;
            if (message.pseudo != null && message.hasOwnProperty("pseudo"))
                object.pseudo = message.pseudo;
            return object;
        };
    
        /**
         * Converts this ProfileRes to JSON.
         * @function toJSON
         * @memberof ProfileRes
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProfileRes.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Gets the default type url for ProfileRes
         * @function getTypeUrl
         * @memberof ProfileRes
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProfileRes.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/ProfileRes";
        };
    
        ProfileRes.Stats = (function() {
    
            /**
             * Properties of a Stats.
             * @memberof ProfileRes
             * @interface IStats
             * @property {ProfileRes.Stats.IEnergy} energy Stats energy
             * @property {number} attack Stats attack
             * @property {number} defense Stats defense
             * @property {number} speed Stats speed
             * @property {ProfileRes.Stats.IBreath} breath Stats breath
             */
    
            /**
             * Constructs a new Stats.
             * @memberof ProfileRes
             * @classdesc Represents a Stats.
             * @implements IStats
             * @constructor
             * @param {ProfileRes.IStats=} [properties] Properties to set
             */
            function Stats(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Stats energy.
             * @member {ProfileRes.Stats.IEnergy} energy
             * @memberof ProfileRes.Stats
             * @instance
             */
            Stats.prototype.energy = null;
    
            /**
             * Stats attack.
             * @member {number} attack
             * @memberof ProfileRes.Stats
             * @instance
             */
            Stats.prototype.attack = 0;
    
            /**
             * Stats defense.
             * @member {number} defense
             * @memberof ProfileRes.Stats
             * @instance
             */
            Stats.prototype.defense = 0;
    
            /**
             * Stats speed.
             * @member {number} speed
             * @memberof ProfileRes.Stats
             * @instance
             */
            Stats.prototype.speed = 0;
    
            /**
             * Stats breath.
             * @member {ProfileRes.Stats.IBreath} breath
             * @memberof ProfileRes.Stats
             * @instance
             */
            Stats.prototype.breath = null;
    
            /**
             * Creates a new Stats instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Stats
             * @static
             * @param {ProfileRes.IStats=} [properties] Properties to set
             * @returns {ProfileRes.Stats} Stats instance
             */
            Stats.create = function create(properties) {
                return new Stats(properties);
            };
    
            /**
             * Encodes the specified Stats message. Does not implicitly {@link ProfileRes.Stats.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Stats
             * @static
             * @param {ProfileRes.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                $root.ProfileRes.Stats.Energy.encode(message.energy, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.attack);
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.defense);
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.speed);
                $root.ProfileRes.Stats.Breath.encode(message.breath, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                return writer;
            };
    
            /**
             * Encodes the specified Stats message, length delimited. Does not implicitly {@link ProfileRes.Stats.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Stats
             * @static
             * @param {ProfileRes.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a Stats message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Stats();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.energy = $root.ProfileRes.Stats.Energy.decode(reader, reader.uint32());
                            break;
                        }
                    case 2: {
                            message.attack = reader.int32();
                            break;
                        }
                    case 3: {
                            message.defense = reader.int32();
                            break;
                        }
                    case 4: {
                            message.speed = reader.int32();
                            break;
                        }
                    case 5: {
                            message.breath = $root.ProfileRes.Stats.Breath.decode(reader, reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("energy"))
                    throw $util.ProtocolError("missing required 'energy'", { instance: message });
                if (!message.hasOwnProperty("attack"))
                    throw $util.ProtocolError("missing required 'attack'", { instance: message });
                if (!message.hasOwnProperty("defense"))
                    throw $util.ProtocolError("missing required 'defense'", { instance: message });
                if (!message.hasOwnProperty("speed"))
                    throw $util.ProtocolError("missing required 'speed'", { instance: message });
                if (!message.hasOwnProperty("breath"))
                    throw $util.ProtocolError("missing required 'breath'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a Stats message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a Stats message.
             * @function verify
             * @memberof ProfileRes.Stats
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Stats.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                {
                    var error = $root.ProfileRes.Stats.Energy.verify(message.energy);
                    if (error)
                        return "energy." + error;
                }
                if (!$util.isInteger(message.attack))
                    return "attack: integer expected";
                if (!$util.isInteger(message.defense))
                    return "defense: integer expected";
                if (!$util.isInteger(message.speed))
                    return "speed: integer expected";
                {
                    var error = $root.ProfileRes.Stats.Breath.verify(message.breath);
                    if (error)
                        return "breath." + error;
                }
                return null;
            };
    
            /**
             * Creates a Stats message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Stats
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Stats} Stats
             */
            Stats.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Stats)
                    return object;
                var message = new $root.ProfileRes.Stats();
                if (object.energy != null) {
                    if (typeof object.energy !== "object")
                        throw TypeError(".ProfileRes.Stats.energy: object expected");
                    message.energy = $root.ProfileRes.Stats.Energy.fromObject(object.energy);
                }
                if (object.attack != null)
                    message.attack = object.attack | 0;
                if (object.defense != null)
                    message.defense = object.defense | 0;
                if (object.speed != null)
                    message.speed = object.speed | 0;
                if (object.breath != null) {
                    if (typeof object.breath !== "object")
                        throw TypeError(".ProfileRes.Stats.breath: object expected");
                    message.breath = $root.ProfileRes.Stats.Breath.fromObject(object.breath);
                }
                return message;
            };
    
            /**
             * Creates a plain object from a Stats message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Stats
             * @static
             * @param {ProfileRes.Stats} message Stats
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Stats.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.energy = null;
                    object.attack = 0;
                    object.defense = 0;
                    object.speed = 0;
                    object.breath = null;
                }
                if (message.energy != null && message.hasOwnProperty("energy"))
                    object.energy = $root.ProfileRes.Stats.Energy.toObject(message.energy, options);
                if (message.attack != null && message.hasOwnProperty("attack"))
                    object.attack = message.attack;
                if (message.defense != null && message.hasOwnProperty("defense"))
                    object.defense = message.defense;
                if (message.speed != null && message.hasOwnProperty("speed"))
                    object.speed = message.speed;
                if (message.breath != null && message.hasOwnProperty("breath"))
                    object.breath = $root.ProfileRes.Stats.Breath.toObject(message.breath, options);
                return object;
            };
    
            /**
             * Converts this Stats to JSON.
             * @function toJSON
             * @memberof ProfileRes.Stats
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Stats.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Stats
             * @function getTypeUrl
             * @memberof ProfileRes.Stats
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Stats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Stats";
            };
    
            Stats.Energy = (function() {
    
                /**
                 * Properties of an Energy.
                 * @memberof ProfileRes.Stats
                 * @interface IEnergy
                 * @property {number} value Energy value
                 * @property {number} max Energy max
                 */
    
                /**
                 * Constructs a new Energy.
                 * @memberof ProfileRes.Stats
                 * @classdesc Represents an Energy.
                 * @implements IEnergy
                 * @constructor
                 * @param {ProfileRes.Stats.IEnergy=} [properties] Properties to set
                 */
                function Energy(properties) {
                    if (properties)
                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null)
                                this[keys[i]] = properties[keys[i]];
                }
    
                /**
                 * Energy value.
                 * @member {number} value
                 * @memberof ProfileRes.Stats.Energy
                 * @instance
                 */
                Energy.prototype.value = 0;
    
                /**
                 * Energy max.
                 * @member {number} max
                 * @memberof ProfileRes.Stats.Energy
                 * @instance
                 */
                Energy.prototype.max = 0;
    
                /**
                 * Creates a new Energy instance using the specified properties.
                 * @function create
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {ProfileRes.Stats.IEnergy=} [properties] Properties to set
                 * @returns {ProfileRes.Stats.Energy} Energy instance
                 */
                Energy.create = function create(properties) {
                    return new Energy(properties);
                };
    
                /**
                 * Encodes the specified Energy message. Does not implicitly {@link ProfileRes.Stats.Energy.verify|verify} messages.
                 * @function encode
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {ProfileRes.Stats.IEnergy} message Energy message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                Energy.encode = function encode(message, writer) {
                    if (!writer)
                        writer = $Writer.create();
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.max);
                    return writer;
                };
    
                /**
                 * Encodes the specified Energy message, length delimited. Does not implicitly {@link ProfileRes.Stats.Energy.verify|verify} messages.
                 * @function encodeDelimited
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {ProfileRes.Stats.IEnergy} message Energy message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                Energy.encodeDelimited = function encodeDelimited(message, writer) {
                    return this.encode(message, writer).ldelim();
                };
    
                /**
                 * Decodes an Energy message from the specified reader or buffer.
                 * @function decode
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {ProfileRes.Stats.Energy} Energy
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                Energy.decode = function decode(reader, length, error) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Stats.Energy();
                    while (reader.pos < end) {
                        var tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.value = reader.int32();
                                break;
                            }
                        case 2: {
                                message.max = reader.int32();
                                break;
                            }
                        default:
                            reader.skipType(tag & 7);
                            break;
                        }
                    }
                    if (!message.hasOwnProperty("value"))
                        throw $util.ProtocolError("missing required 'value'", { instance: message });
                    if (!message.hasOwnProperty("max"))
                        throw $util.ProtocolError("missing required 'max'", { instance: message });
                    return message;
                };
    
                /**
                 * Decodes an Energy message from the specified reader or buffer, length delimited.
                 * @function decodeDelimited
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @returns {ProfileRes.Stats.Energy} Energy
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                Energy.decodeDelimited = function decodeDelimited(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.uint32());
                };
    
                /**
                 * Verifies an Energy message.
                 * @function verify
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {Object.<string,*>} message Plain object to verify
                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
                 */
                Energy.verify = function verify(message) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (!$util.isInteger(message.value))
                        return "value: integer expected";
                    if (!$util.isInteger(message.max))
                        return "max: integer expected";
                    return null;
                };
    
                /**
                 * Creates an Energy message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {ProfileRes.Stats.Energy} Energy
                 */
                Energy.fromObject = function fromObject(object) {
                    if (object instanceof $root.ProfileRes.Stats.Energy)
                        return object;
                    var message = new $root.ProfileRes.Stats.Energy();
                    if (object.value != null)
                        message.value = object.value | 0;
                    if (object.max != null)
                        message.max = object.max | 0;
                    return message;
                };
    
                /**
                 * Creates a plain object from an Energy message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {ProfileRes.Stats.Energy} message Energy
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                Energy.toObject = function toObject(message, options) {
                    if (!options)
                        options = {};
                    var object = {};
                    if (options.defaults) {
                        object.value = 0;
                        object.max = 0;
                    }
                    if (message.value != null && message.hasOwnProperty("value"))
                        object.value = message.value;
                    if (message.max != null && message.hasOwnProperty("max"))
                        object.max = message.max;
                    return object;
                };
    
                /**
                 * Converts this Energy to JSON.
                 * @function toJSON
                 * @memberof ProfileRes.Stats.Energy
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                Energy.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };
    
                /**
                 * Gets the default type url for Energy
                 * @function getTypeUrl
                 * @memberof ProfileRes.Stats.Energy
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                Energy.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/ProfileRes.Stats.Energy";
                };
    
                return Energy;
            })();
    
            Stats.Breath = (function() {
    
                /**
                 * Properties of a Breath.
                 * @memberof ProfileRes.Stats
                 * @interface IBreath
                 * @property {number} base Breath base
                 * @property {number} max Breath max
                 * @property {number} regen Breath regen
                 */
    
                /**
                 * Constructs a new Breath.
                 * @memberof ProfileRes.Stats
                 * @classdesc Represents a Breath.
                 * @implements IBreath
                 * @constructor
                 * @param {ProfileRes.Stats.IBreath=} [properties] Properties to set
                 */
                function Breath(properties) {
                    if (properties)
                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null)
                                this[keys[i]] = properties[keys[i]];
                }
    
                /**
                 * Breath base.
                 * @member {number} base
                 * @memberof ProfileRes.Stats.Breath
                 * @instance
                 */
                Breath.prototype.base = 0;
    
                /**
                 * Breath max.
                 * @member {number} max
                 * @memberof ProfileRes.Stats.Breath
                 * @instance
                 */
                Breath.prototype.max = 0;
    
                /**
                 * Breath regen.
                 * @member {number} regen
                 * @memberof ProfileRes.Stats.Breath
                 * @instance
                 */
                Breath.prototype.regen = 0;
    
                /**
                 * Creates a new Breath instance using the specified properties.
                 * @function create
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {ProfileRes.Stats.IBreath=} [properties] Properties to set
                 * @returns {ProfileRes.Stats.Breath} Breath instance
                 */
                Breath.create = function create(properties) {
                    return new Breath(properties);
                };
    
                /**
                 * Encodes the specified Breath message. Does not implicitly {@link ProfileRes.Stats.Breath.verify|verify} messages.
                 * @function encode
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {ProfileRes.Stats.IBreath} message Breath message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                Breath.encode = function encode(message, writer) {
                    if (!writer)
                        writer = $Writer.create();
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.base);
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.max);
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.regen);
                    return writer;
                };
    
                /**
                 * Encodes the specified Breath message, length delimited. Does not implicitly {@link ProfileRes.Stats.Breath.verify|verify} messages.
                 * @function encodeDelimited
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {ProfileRes.Stats.IBreath} message Breath message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                Breath.encodeDelimited = function encodeDelimited(message, writer) {
                    return this.encode(message, writer).ldelim();
                };
    
                /**
                 * Decodes a Breath message from the specified reader or buffer.
                 * @function decode
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {ProfileRes.Stats.Breath} Breath
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                Breath.decode = function decode(reader, length, error) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Stats.Breath();
                    while (reader.pos < end) {
                        var tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.base = reader.int32();
                                break;
                            }
                        case 2: {
                                message.max = reader.int32();
                                break;
                            }
                        case 3: {
                                message.regen = reader.int32();
                                break;
                            }
                        default:
                            reader.skipType(tag & 7);
                            break;
                        }
                    }
                    if (!message.hasOwnProperty("base"))
                        throw $util.ProtocolError("missing required 'base'", { instance: message });
                    if (!message.hasOwnProperty("max"))
                        throw $util.ProtocolError("missing required 'max'", { instance: message });
                    if (!message.hasOwnProperty("regen"))
                        throw $util.ProtocolError("missing required 'regen'", { instance: message });
                    return message;
                };
    
                /**
                 * Decodes a Breath message from the specified reader or buffer, length delimited.
                 * @function decodeDelimited
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @returns {ProfileRes.Stats.Breath} Breath
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                Breath.decodeDelimited = function decodeDelimited(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.uint32());
                };
    
                /**
                 * Verifies a Breath message.
                 * @function verify
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {Object.<string,*>} message Plain object to verify
                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
                 */
                Breath.verify = function verify(message) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (!$util.isInteger(message.base))
                        return "base: integer expected";
                    if (!$util.isInteger(message.max))
                        return "max: integer expected";
                    if (!$util.isInteger(message.regen))
                        return "regen: integer expected";
                    return null;
                };
    
                /**
                 * Creates a Breath message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {ProfileRes.Stats.Breath} Breath
                 */
                Breath.fromObject = function fromObject(object) {
                    if (object instanceof $root.ProfileRes.Stats.Breath)
                        return object;
                    var message = new $root.ProfileRes.Stats.Breath();
                    if (object.base != null)
                        message.base = object.base | 0;
                    if (object.max != null)
                        message.max = object.max | 0;
                    if (object.regen != null)
                        message.regen = object.regen | 0;
                    return message;
                };
    
                /**
                 * Creates a plain object from a Breath message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {ProfileRes.Stats.Breath} message Breath
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                Breath.toObject = function toObject(message, options) {
                    if (!options)
                        options = {};
                    var object = {};
                    if (options.defaults) {
                        object.base = 0;
                        object.max = 0;
                        object.regen = 0;
                    }
                    if (message.base != null && message.hasOwnProperty("base"))
                        object.base = message.base;
                    if (message.max != null && message.hasOwnProperty("max"))
                        object.max = message.max;
                    if (message.regen != null && message.hasOwnProperty("regen"))
                        object.regen = message.regen;
                    return object;
                };
    
                /**
                 * Converts this Breath to JSON.
                 * @function toJSON
                 * @memberof ProfileRes.Stats.Breath
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                Breath.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };
    
                /**
                 * Gets the default type url for Breath
                 * @function getTypeUrl
                 * @memberof ProfileRes.Stats.Breath
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                Breath.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/ProfileRes.Stats.Breath";
                };
    
                return Breath;
            })();
    
            return Stats;
        })();
    
        ProfileRes.Missions = (function() {
    
            /**
             * Properties of a Missions.
             * @memberof ProfileRes
             * @interface IMissions
             * @property {number} gems Missions gems
             * @property {number} campaignProgression Missions campaignProgression
             */
    
            /**
             * Constructs a new Missions.
             * @memberof ProfileRes
             * @classdesc Represents a Missions.
             * @implements IMissions
             * @constructor
             * @param {ProfileRes.IMissions=} [properties] Properties to set
             */
            function Missions(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Missions gems.
             * @member {number} gems
             * @memberof ProfileRes.Missions
             * @instance
             */
            Missions.prototype.gems = 0;
    
            /**
             * Missions campaignProgression.
             * @member {number} campaignProgression
             * @memberof ProfileRes.Missions
             * @instance
             */
            Missions.prototype.campaignProgression = 0;
    
            /**
             * Creates a new Missions instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Missions
             * @static
             * @param {ProfileRes.IMissions=} [properties] Properties to set
             * @returns {ProfileRes.Missions} Missions instance
             */
            Missions.create = function create(properties) {
                return new Missions(properties);
            };
    
            /**
             * Encodes the specified Missions message. Does not implicitly {@link ProfileRes.Missions.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Missions
             * @static
             * @param {ProfileRes.IMissions} message Missions message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Missions.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.gems);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.campaignProgression);
                return writer;
            };
    
            /**
             * Encodes the specified Missions message, length delimited. Does not implicitly {@link ProfileRes.Missions.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Missions
             * @static
             * @param {ProfileRes.IMissions} message Missions message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Missions.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a Missions message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Missions
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Missions} Missions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Missions.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Missions();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.gems = reader.int32();
                            break;
                        }
                    case 2: {
                            message.campaignProgression = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("gems"))
                    throw $util.ProtocolError("missing required 'gems'", { instance: message });
                if (!message.hasOwnProperty("campaignProgression"))
                    throw $util.ProtocolError("missing required 'campaignProgression'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a Missions message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Missions
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Missions} Missions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Missions.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a Missions message.
             * @function verify
             * @memberof ProfileRes.Missions
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Missions.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.gems))
                    return "gems: integer expected";
                if (!$util.isInteger(message.campaignProgression))
                    return "campaignProgression: integer expected";
                return null;
            };
    
            /**
             * Creates a Missions message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Missions
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Missions} Missions
             */
            Missions.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Missions)
                    return object;
                var message = new $root.ProfileRes.Missions();
                if (object.gems != null)
                    message.gems = object.gems | 0;
                if (object.campaignProgression != null)
                    message.campaignProgression = object.campaignProgression | 0;
                return message;
            };
    
            /**
             * Creates a plain object from a Missions message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Missions
             * @static
             * @param {ProfileRes.Missions} message Missions
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Missions.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.gems = 0;
                    object.campaignProgression = 0;
                }
                if (message.gems != null && message.hasOwnProperty("gems"))
                    object.gems = message.gems;
                if (message.campaignProgression != null && message.hasOwnProperty("campaignProgression"))
                    object.campaignProgression = message.campaignProgression;
                return object;
            };
    
            /**
             * Converts this Missions to JSON.
             * @function toJSON
             * @memberof ProfileRes.Missions
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Missions.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Missions
             * @function getTypeUrl
             * @memberof ProfileRes.Missions
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Missions.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Missions";
            };
    
            return Missions;
        })();
    
        ProfileRes.Rank = (function() {
    
            /**
             * Properties of a Rank.
             * @memberof ProfileRes
             * @interface IRank
             * @property {boolean} unranked Rank unranked
             * @property {number} rank Rank rank
             * @property {number} numberOfPlayers Rank numberOfPlayers
             * @property {number} score Rank score
             */
    
            /**
             * Constructs a new Rank.
             * @memberof ProfileRes
             * @classdesc Represents a Rank.
             * @implements IRank
             * @constructor
             * @param {ProfileRes.IRank=} [properties] Properties to set
             */
            function Rank(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Rank unranked.
             * @member {boolean} unranked
             * @memberof ProfileRes.Rank
             * @instance
             */
            Rank.prototype.unranked = false;
    
            /**
             * Rank rank.
             * @member {number} rank
             * @memberof ProfileRes.Rank
             * @instance
             */
            Rank.prototype.rank = 0;
    
            /**
             * Rank numberOfPlayers.
             * @member {number} numberOfPlayers
             * @memberof ProfileRes.Rank
             * @instance
             */
            Rank.prototype.numberOfPlayers = 0;
    
            /**
             * Rank score.
             * @member {number} score
             * @memberof ProfileRes.Rank
             * @instance
             */
            Rank.prototype.score = 0;
    
            /**
             * Creates a new Rank instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Rank
             * @static
             * @param {ProfileRes.IRank=} [properties] Properties to set
             * @returns {ProfileRes.Rank} Rank instance
             */
            Rank.create = function create(properties) {
                return new Rank(properties);
            };
    
            /**
             * Encodes the specified Rank message. Does not implicitly {@link ProfileRes.Rank.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Rank
             * @static
             * @param {ProfileRes.IRank} message Rank message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Rank.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).bool(message.unranked);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.rank);
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.numberOfPlayers);
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.score);
                return writer;
            };
    
            /**
             * Encodes the specified Rank message, length delimited. Does not implicitly {@link ProfileRes.Rank.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Rank
             * @static
             * @param {ProfileRes.IRank} message Rank message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Rank.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a Rank message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Rank
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Rank} Rank
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Rank.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Rank();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.unranked = reader.bool();
                            break;
                        }
                    case 2: {
                            message.rank = reader.int32();
                            break;
                        }
                    case 3: {
                            message.numberOfPlayers = reader.int32();
                            break;
                        }
                    case 4: {
                            message.score = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("unranked"))
                    throw $util.ProtocolError("missing required 'unranked'", { instance: message });
                if (!message.hasOwnProperty("rank"))
                    throw $util.ProtocolError("missing required 'rank'", { instance: message });
                if (!message.hasOwnProperty("numberOfPlayers"))
                    throw $util.ProtocolError("missing required 'numberOfPlayers'", { instance: message });
                if (!message.hasOwnProperty("score"))
                    throw $util.ProtocolError("missing required 'score'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a Rank message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Rank
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Rank} Rank
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Rank.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a Rank message.
             * @function verify
             * @memberof ProfileRes.Rank
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Rank.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (typeof message.unranked !== "boolean")
                    return "unranked: boolean expected";
                if (!$util.isInteger(message.rank))
                    return "rank: integer expected";
                if (!$util.isInteger(message.numberOfPlayers))
                    return "numberOfPlayers: integer expected";
                if (!$util.isInteger(message.score))
                    return "score: integer expected";
                return null;
            };
    
            /**
             * Creates a Rank message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Rank
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Rank} Rank
             */
            Rank.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Rank)
                    return object;
                var message = new $root.ProfileRes.Rank();
                if (object.unranked != null)
                    message.unranked = Boolean(object.unranked);
                if (object.rank != null)
                    message.rank = object.rank | 0;
                if (object.numberOfPlayers != null)
                    message.numberOfPlayers = object.numberOfPlayers | 0;
                if (object.score != null)
                    message.score = object.score | 0;
                return message;
            };
    
            /**
             * Creates a plain object from a Rank message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Rank
             * @static
             * @param {ProfileRes.Rank} message Rank
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Rank.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.unranked = false;
                    object.rank = 0;
                    object.numberOfPlayers = 0;
                    object.score = 0;
                }
                if (message.unranked != null && message.hasOwnProperty("unranked"))
                    object.unranked = message.unranked;
                if (message.rank != null && message.hasOwnProperty("rank"))
                    object.rank = message.rank;
                if (message.numberOfPlayers != null && message.hasOwnProperty("numberOfPlayers"))
                    object.numberOfPlayers = message.numberOfPlayers;
                if (message.score != null && message.hasOwnProperty("score"))
                    object.score = message.score;
                return object;
            };
    
            /**
             * Converts this Rank to JSON.
             * @function toJSON
             * @memberof ProfileRes.Rank
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Rank.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Rank
             * @function getTypeUrl
             * @memberof ProfileRes.Rank
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Rank.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Rank";
            };
    
            return Rank;
        })();
    
        ProfileRes.Effect = (function() {
    
            /**
             * Properties of an Effect.
             * @memberof ProfileRes
             * @interface IEffect
             * @property {boolean} healed Effect healed
             * @property {number} timeLeft Effect timeLeft
             * @property {string} effect Effect effect
             * @property {boolean} hasTimeDisplay Effect hasTimeDisplay
             */
    
            /**
             * Constructs a new Effect.
             * @memberof ProfileRes
             * @classdesc Represents an Effect.
             * @implements IEffect
             * @constructor
             * @param {ProfileRes.IEffect=} [properties] Properties to set
             */
            function Effect(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Effect healed.
             * @member {boolean} healed
             * @memberof ProfileRes.Effect
             * @instance
             */
            Effect.prototype.healed = false;
    
            /**
             * Effect timeLeft.
             * @member {number} timeLeft
             * @memberof ProfileRes.Effect
             * @instance
             */
            Effect.prototype.timeLeft = 0;
    
            /**
             * Effect effect.
             * @member {string} effect
             * @memberof ProfileRes.Effect
             * @instance
             */
            Effect.prototype.effect = "";
    
            /**
             * Effect hasTimeDisplay.
             * @member {boolean} hasTimeDisplay
             * @memberof ProfileRes.Effect
             * @instance
             */
            Effect.prototype.hasTimeDisplay = false;
    
            /**
             * Creates a new Effect instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Effect
             * @static
             * @param {ProfileRes.IEffect=} [properties] Properties to set
             * @returns {ProfileRes.Effect} Effect instance
             */
            Effect.create = function create(properties) {
                return new Effect(properties);
            };
    
            /**
             * Encodes the specified Effect message. Does not implicitly {@link ProfileRes.Effect.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Effect
             * @static
             * @param {ProfileRes.IEffect} message Effect message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Effect.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).bool(message.healed);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.timeLeft);
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.effect);
                writer.uint32(/* id 4, wireType 0 =*/32).bool(message.hasTimeDisplay);
                return writer;
            };
    
            /**
             * Encodes the specified Effect message, length delimited. Does not implicitly {@link ProfileRes.Effect.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Effect
             * @static
             * @param {ProfileRes.IEffect} message Effect message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Effect.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes an Effect message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Effect
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Effect} Effect
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Effect.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Effect();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.healed = reader.bool();
                            break;
                        }
                    case 2: {
                            message.timeLeft = reader.int32();
                            break;
                        }
                    case 3: {
                            message.effect = reader.string();
                            break;
                        }
                    case 4: {
                            message.hasTimeDisplay = reader.bool();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("healed"))
                    throw $util.ProtocolError("missing required 'healed'", { instance: message });
                if (!message.hasOwnProperty("timeLeft"))
                    throw $util.ProtocolError("missing required 'timeLeft'", { instance: message });
                if (!message.hasOwnProperty("effect"))
                    throw $util.ProtocolError("missing required 'effect'", { instance: message });
                if (!message.hasOwnProperty("hasTimeDisplay"))
                    throw $util.ProtocolError("missing required 'hasTimeDisplay'", { instance: message });
                return message;
            };
    
            /**
             * Decodes an Effect message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Effect
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Effect} Effect
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Effect.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies an Effect message.
             * @function verify
             * @memberof ProfileRes.Effect
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Effect.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (typeof message.healed !== "boolean")
                    return "healed: boolean expected";
                if (!$util.isInteger(message.timeLeft))
                    return "timeLeft: integer expected";
                if (!$util.isString(message.effect))
                    return "effect: string expected";
                if (typeof message.hasTimeDisplay !== "boolean")
                    return "hasTimeDisplay: boolean expected";
                return null;
            };
    
            /**
             * Creates an Effect message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Effect
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Effect} Effect
             */
            Effect.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Effect)
                    return object;
                var message = new $root.ProfileRes.Effect();
                if (object.healed != null)
                    message.healed = Boolean(object.healed);
                if (object.timeLeft != null)
                    message.timeLeft = object.timeLeft | 0;
                if (object.effect != null)
                    message.effect = String(object.effect);
                if (object.hasTimeDisplay != null)
                    message.hasTimeDisplay = Boolean(object.hasTimeDisplay);
                return message;
            };
    
            /**
             * Creates a plain object from an Effect message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Effect
             * @static
             * @param {ProfileRes.Effect} message Effect
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Effect.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.healed = false;
                    object.timeLeft = 0;
                    object.effect = "";
                    object.hasTimeDisplay = false;
                }
                if (message.healed != null && message.hasOwnProperty("healed"))
                    object.healed = message.healed;
                if (message.timeLeft != null && message.hasOwnProperty("timeLeft"))
                    object.timeLeft = message.timeLeft;
                if (message.effect != null && message.hasOwnProperty("effect"))
                    object.effect = message.effect;
                if (message.hasTimeDisplay != null && message.hasOwnProperty("hasTimeDisplay"))
                    object.hasTimeDisplay = message.hasTimeDisplay;
                return object;
            };
    
            /**
             * Converts this Effect to JSON.
             * @function toJSON
             * @memberof ProfileRes.Effect
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Effect.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Effect
             * @function getTypeUrl
             * @memberof ProfileRes.Effect
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Effect.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Effect";
            };
    
            return Effect;
        })();
    
        ProfileRes.Pet = (function() {
    
            /**
             * Properties of a Pet.
             * @memberof ProfileRes
             * @interface IPet
             * @property {number} typeId Pet typeId
             * @property {string} sex Pet sex
             * @property {number} rarity Pet rarity
             * @property {string} nickname Pet nickname
             */
    
            /**
             * Constructs a new Pet.
             * @memberof ProfileRes
             * @classdesc Represents a Pet.
             * @implements IPet
             * @constructor
             * @param {ProfileRes.IPet=} [properties] Properties to set
             */
            function Pet(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Pet typeId.
             * @member {number} typeId
             * @memberof ProfileRes.Pet
             * @instance
             */
            Pet.prototype.typeId = 0;
    
            /**
             * Pet sex.
             * @member {string} sex
             * @memberof ProfileRes.Pet
             * @instance
             */
            Pet.prototype.sex = "";
    
            /**
             * Pet rarity.
             * @member {number} rarity
             * @memberof ProfileRes.Pet
             * @instance
             */
            Pet.prototype.rarity = 0;
    
            /**
             * Pet nickname.
             * @member {string} nickname
             * @memberof ProfileRes.Pet
             * @instance
             */
            Pet.prototype.nickname = "";
    
            /**
             * Creates a new Pet instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Pet
             * @static
             * @param {ProfileRes.IPet=} [properties] Properties to set
             * @returns {ProfileRes.Pet} Pet instance
             */
            Pet.create = function create(properties) {
                return new Pet(properties);
            };
    
            /**
             * Encodes the specified Pet message. Does not implicitly {@link ProfileRes.Pet.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Pet
             * @static
             * @param {ProfileRes.IPet} message Pet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Pet.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.typeId);
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.sex);
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.rarity);
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.nickname);
                return writer;
            };
    
            /**
             * Encodes the specified Pet message, length delimited. Does not implicitly {@link ProfileRes.Pet.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Pet
             * @static
             * @param {ProfileRes.IPet} message Pet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Pet.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a Pet message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Pet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Pet} Pet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Pet.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Pet();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.typeId = reader.int32();
                            break;
                        }
                    case 2: {
                            message.sex = reader.string();
                            break;
                        }
                    case 3: {
                            message.rarity = reader.int32();
                            break;
                        }
                    case 4: {
                            message.nickname = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("typeId"))
                    throw $util.ProtocolError("missing required 'typeId'", { instance: message });
                if (!message.hasOwnProperty("sex"))
                    throw $util.ProtocolError("missing required 'sex'", { instance: message });
                if (!message.hasOwnProperty("rarity"))
                    throw $util.ProtocolError("missing required 'rarity'", { instance: message });
                if (!message.hasOwnProperty("nickname"))
                    throw $util.ProtocolError("missing required 'nickname'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a Pet message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Pet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Pet} Pet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Pet.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a Pet message.
             * @function verify
             * @memberof ProfileRes.Pet
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Pet.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.typeId))
                    return "typeId: integer expected";
                if (!$util.isString(message.sex))
                    return "sex: string expected";
                if (!$util.isInteger(message.rarity))
                    return "rarity: integer expected";
                if (!$util.isString(message.nickname))
                    return "nickname: string expected";
                return null;
            };
    
            /**
             * Creates a Pet message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Pet
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Pet} Pet
             */
            Pet.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Pet)
                    return object;
                var message = new $root.ProfileRes.Pet();
                if (object.typeId != null)
                    message.typeId = object.typeId | 0;
                if (object.sex != null)
                    message.sex = String(object.sex);
                if (object.rarity != null)
                    message.rarity = object.rarity | 0;
                if (object.nickname != null)
                    message.nickname = String(object.nickname);
                return message;
            };
    
            /**
             * Creates a plain object from a Pet message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Pet
             * @static
             * @param {ProfileRes.Pet} message Pet
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Pet.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.typeId = 0;
                    object.sex = "";
                    object.rarity = 0;
                    object.nickname = "";
                }
                if (message.typeId != null && message.hasOwnProperty("typeId"))
                    object.typeId = message.typeId;
                if (message.sex != null && message.hasOwnProperty("sex"))
                    object.sex = message.sex;
                if (message.rarity != null && message.hasOwnProperty("rarity"))
                    object.rarity = message.rarity;
                if (message.nickname != null && message.hasOwnProperty("nickname"))
                    object.nickname = message.nickname;
                return object;
            };
    
            /**
             * Converts this Pet to JSON.
             * @function toJSON
             * @memberof ProfileRes.Pet
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Pet.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Pet
             * @function getTypeUrl
             * @memberof ProfileRes.Pet
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Pet.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Pet";
            };
    
            return Pet;
        })();
    
        ProfileRes.FightRanking = (function() {
    
            /**
             * Properties of a FightRanking.
             * @memberof ProfileRes
             * @interface IFightRanking
             * @property {number} glory FightRanking glory
             * @property {number} league FightRanking league
             */
    
            /**
             * Constructs a new FightRanking.
             * @memberof ProfileRes
             * @classdesc Represents a FightRanking.
             * @implements IFightRanking
             * @constructor
             * @param {ProfileRes.IFightRanking=} [properties] Properties to set
             */
            function FightRanking(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * FightRanking glory.
             * @member {number} glory
             * @memberof ProfileRes.FightRanking
             * @instance
             */
            FightRanking.prototype.glory = 0;
    
            /**
             * FightRanking league.
             * @member {number} league
             * @memberof ProfileRes.FightRanking
             * @instance
             */
            FightRanking.prototype.league = 0;
    
            /**
             * Creates a new FightRanking instance using the specified properties.
             * @function create
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {ProfileRes.IFightRanking=} [properties] Properties to set
             * @returns {ProfileRes.FightRanking} FightRanking instance
             */
            FightRanking.create = function create(properties) {
                return new FightRanking(properties);
            };
    
            /**
             * Encodes the specified FightRanking message. Does not implicitly {@link ProfileRes.FightRanking.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {ProfileRes.IFightRanking} message FightRanking message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            FightRanking.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.glory);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.league);
                return writer;
            };
    
            /**
             * Encodes the specified FightRanking message, length delimited. Does not implicitly {@link ProfileRes.FightRanking.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {ProfileRes.IFightRanking} message FightRanking message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            FightRanking.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a FightRanking message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.FightRanking} FightRanking
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            FightRanking.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.FightRanking();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.glory = reader.int32();
                            break;
                        }
                    case 2: {
                            message.league = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("glory"))
                    throw $util.ProtocolError("missing required 'glory'", { instance: message });
                if (!message.hasOwnProperty("league"))
                    throw $util.ProtocolError("missing required 'league'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a FightRanking message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.FightRanking} FightRanking
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            FightRanking.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a FightRanking message.
             * @function verify
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            FightRanking.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.glory))
                    return "glory: integer expected";
                if (!$util.isInteger(message.league))
                    return "league: integer expected";
                return null;
            };
    
            /**
             * Creates a FightRanking message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.FightRanking} FightRanking
             */
            FightRanking.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.FightRanking)
                    return object;
                var message = new $root.ProfileRes.FightRanking();
                if (object.glory != null)
                    message.glory = object.glory | 0;
                if (object.league != null)
                    message.league = object.league | 0;
                return message;
            };
    
            /**
             * Creates a plain object from a FightRanking message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {ProfileRes.FightRanking} message FightRanking
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            FightRanking.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.glory = 0;
                    object.league = 0;
                }
                if (message.glory != null && message.hasOwnProperty("glory"))
                    object.glory = message.glory;
                if (message.league != null && message.hasOwnProperty("league"))
                    object.league = message.league;
                return object;
            };
    
            /**
             * Converts this FightRanking to JSON.
             * @function toJSON
             * @memberof ProfileRes.FightRanking
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            FightRanking.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for FightRanking
             * @function getTypeUrl
             * @memberof ProfileRes.FightRanking
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            FightRanking.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.FightRanking";
            };
    
            return FightRanking;
        })();
    
        ProfileRes.Health = (function() {
    
            /**
             * Properties of a Health.
             * @memberof ProfileRes
             * @interface IHealth
             * @property {number} value Health value
             * @property {number} max Health max
             */
    
            /**
             * Constructs a new Health.
             * @memberof ProfileRes
             * @classdesc Represents a Health.
             * @implements IHealth
             * @constructor
             * @param {ProfileRes.IHealth=} [properties] Properties to set
             */
            function Health(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Health value.
             * @member {number} value
             * @memberof ProfileRes.Health
             * @instance
             */
            Health.prototype.value = 0;
    
            /**
             * Health max.
             * @member {number} max
             * @memberof ProfileRes.Health
             * @instance
             */
            Health.prototype.max = 0;
    
            /**
             * Creates a new Health instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Health
             * @static
             * @param {ProfileRes.IHealth=} [properties] Properties to set
             * @returns {ProfileRes.Health} Health instance
             */
            Health.create = function create(properties) {
                return new Health(properties);
            };
    
            /**
             * Encodes the specified Health message. Does not implicitly {@link ProfileRes.Health.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Health
             * @static
             * @param {ProfileRes.IHealth} message Health message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Health.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.max);
                return writer;
            };
    
            /**
             * Encodes the specified Health message, length delimited. Does not implicitly {@link ProfileRes.Health.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Health
             * @static
             * @param {ProfileRes.IHealth} message Health message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Health.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a Health message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Health
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Health} Health
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Health.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Health();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.int32();
                            break;
                        }
                    case 2: {
                            message.max = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("value"))
                    throw $util.ProtocolError("missing required 'value'", { instance: message });
                if (!message.hasOwnProperty("max"))
                    throw $util.ProtocolError("missing required 'max'", { instance: message });
                return message;
            };
    
            /**
             * Decodes a Health message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Health
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Health} Health
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Health.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a Health message.
             * @function verify
             * @memberof ProfileRes.Health
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Health.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.value))
                    return "value: integer expected";
                if (!$util.isInteger(message.max))
                    return "max: integer expected";
                return null;
            };
    
            /**
             * Creates a Health message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Health
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Health} Health
             */
            Health.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Health)
                    return object;
                var message = new $root.ProfileRes.Health();
                if (object.value != null)
                    message.value = object.value | 0;
                if (object.max != null)
                    message.max = object.max | 0;
                return message;
            };
    
            /**
             * Creates a plain object from a Health message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Health
             * @static
             * @param {ProfileRes.Health} message Health
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Health.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.value = 0;
                    object.max = 0;
                }
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                if (message.max != null && message.hasOwnProperty("max"))
                    object.max = message.max;
                return object;
            };
    
            /**
             * Converts this Health to JSON.
             * @function toJSON
             * @memberof ProfileRes.Health
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Health.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Health
             * @function getTypeUrl
             * @memberof ProfileRes.Health
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Health.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Health";
            };
    
            return Health;
        })();
    
        ProfileRes.Experience = (function() {
    
            /**
             * Properties of an Experience.
             * @memberof ProfileRes
             * @interface IExperience
             * @property {number} value Experience value
             * @property {number} max Experience max
             */
    
            /**
             * Constructs a new Experience.
             * @memberof ProfileRes
             * @classdesc Represents an Experience.
             * @implements IExperience
             * @constructor
             * @param {ProfileRes.IExperience=} [properties] Properties to set
             */
            function Experience(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * Experience value.
             * @member {number} value
             * @memberof ProfileRes.Experience
             * @instance
             */
            Experience.prototype.value = 0;
    
            /**
             * Experience max.
             * @member {number} max
             * @memberof ProfileRes.Experience
             * @instance
             */
            Experience.prototype.max = 0;
    
            /**
             * Creates a new Experience instance using the specified properties.
             * @function create
             * @memberof ProfileRes.Experience
             * @static
             * @param {ProfileRes.IExperience=} [properties] Properties to set
             * @returns {ProfileRes.Experience} Experience instance
             */
            Experience.create = function create(properties) {
                return new Experience(properties);
            };
    
            /**
             * Encodes the specified Experience message. Does not implicitly {@link ProfileRes.Experience.verify|verify} messages.
             * @function encode
             * @memberof ProfileRes.Experience
             * @static
             * @param {ProfileRes.IExperience} message Experience message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Experience.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.max);
                return writer;
            };
    
            /**
             * Encodes the specified Experience message, length delimited. Does not implicitly {@link ProfileRes.Experience.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileRes.Experience
             * @static
             * @param {ProfileRes.IExperience} message Experience message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Experience.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes an Experience message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileRes.Experience
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileRes.Experience} Experience
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Experience.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileRes.Experience();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.int32();
                            break;
                        }
                    case 2: {
                            message.max = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("value"))
                    throw $util.ProtocolError("missing required 'value'", { instance: message });
                if (!message.hasOwnProperty("max"))
                    throw $util.ProtocolError("missing required 'max'", { instance: message });
                return message;
            };
    
            /**
             * Decodes an Experience message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileRes.Experience
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileRes.Experience} Experience
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Experience.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies an Experience message.
             * @function verify
             * @memberof ProfileRes.Experience
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Experience.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.value))
                    return "value: integer expected";
                if (!$util.isInteger(message.max))
                    return "max: integer expected";
                return null;
            };
    
            /**
             * Creates an Experience message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileRes.Experience
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileRes.Experience} Experience
             */
            Experience.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileRes.Experience)
                    return object;
                var message = new $root.ProfileRes.Experience();
                if (object.value != null)
                    message.value = object.value | 0;
                if (object.max != null)
                    message.max = object.max | 0;
                return message;
            };
    
            /**
             * Creates a plain object from an Experience message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileRes.Experience
             * @static
             * @param {ProfileRes.Experience} message Experience
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Experience.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.value = 0;
                    object.max = 0;
                }
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                if (message.max != null && message.hasOwnProperty("max"))
                    object.max = message.max;
                return object;
            };
    
            /**
             * Converts this Experience to JSON.
             * @function toJSON
             * @memberof ProfileRes.Experience
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Experience.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for Experience
             * @function getTypeUrl
             * @memberof ProfileRes.Experience
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Experience.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileRes.Experience";
            };
    
            return Experience;
        })();
    
        return ProfileRes;
    })();

    return $root;
});
