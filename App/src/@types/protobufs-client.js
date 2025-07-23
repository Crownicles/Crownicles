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
    
    $root.PingReq = (function() {
    
        /**
         * Properties of a PingReq.
         * @exports IPingReq
         * @interface IPingReq
         * @property {number} time PingReq time
         */
    
        /**
         * Constructs a new PingReq.
         * @exports PingReq
         * @classdesc Represents a PingReq.
         * @implements IPingReq
         * @constructor
         * @param {IPingReq=} [properties] Properties to set
         */
        function PingReq(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * PingReq time.
         * @member {number} time
         * @memberof PingReq
         * @instance
         */
        PingReq.prototype.time = 0;
    
        /**
         * Creates a new PingReq instance using the specified properties.
         * @function create
         * @memberof PingReq
         * @static
         * @param {IPingReq=} [properties] Properties to set
         * @returns {PingReq} PingReq instance
         */
        PingReq.create = function create(properties) {
            return new PingReq(properties);
        };
    
        /**
         * Encodes the specified PingReq message. Does not implicitly {@link PingReq.verify|verify} messages.
         * @function encode
         * @memberof PingReq
         * @static
         * @param {IPingReq} message PingReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PingReq.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.time);
            return writer;
        };
    
        /**
         * Encodes the specified PingReq message, length delimited. Does not implicitly {@link PingReq.verify|verify} messages.
         * @function encodeDelimited
         * @memberof PingReq
         * @static
         * @param {IPingReq} message PingReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PingReq.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a PingReq message from the specified reader or buffer.
         * @function decode
         * @memberof PingReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {PingReq} PingReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PingReq.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.PingReq();
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
         * Decodes a PingReq message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof PingReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {PingReq} PingReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PingReq.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a PingReq message.
         * @function verify
         * @memberof PingReq
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PingReq.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.time))
                return "time: integer expected";
            return null;
        };
    
        /**
         * Creates a PingReq message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof PingReq
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {PingReq} PingReq
         */
        PingReq.fromObject = function fromObject(object) {
            if (object instanceof $root.PingReq)
                return object;
            var message = new $root.PingReq();
            if (object.time != null)
                message.time = object.time | 0;
            return message;
        };
    
        /**
         * Creates a plain object from a PingReq message. Also converts values to other types if specified.
         * @function toObject
         * @memberof PingReq
         * @static
         * @param {PingReq} message PingReq
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PingReq.toObject = function toObject(message, options) {
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
         * Converts this PingReq to JSON.
         * @function toJSON
         * @memberof PingReq
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PingReq.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Gets the default type url for PingReq
         * @function getTypeUrl
         * @memberof PingReq
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PingReq.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/PingReq";
        };
    
        return PingReq;
    })();
    
    $root.ProfileReq = (function() {
    
        /**
         * Properties of a ProfileReq.
         * @exports IProfileReq
         * @interface IProfileReq
         * @property {ProfileReq.IAskedPlayer} askedPlayer ProfileReq askedPlayer
         */
    
        /**
         * Constructs a new ProfileReq.
         * @exports ProfileReq
         * @classdesc Represents a ProfileReq.
         * @implements IProfileReq
         * @constructor
         * @param {IProfileReq=} [properties] Properties to set
         */
        function ProfileReq(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * ProfileReq askedPlayer.
         * @member {ProfileReq.IAskedPlayer} askedPlayer
         * @memberof ProfileReq
         * @instance
         */
        ProfileReq.prototype.askedPlayer = null;
    
        /**
         * Creates a new ProfileReq instance using the specified properties.
         * @function create
         * @memberof ProfileReq
         * @static
         * @param {IProfileReq=} [properties] Properties to set
         * @returns {ProfileReq} ProfileReq instance
         */
        ProfileReq.create = function create(properties) {
            return new ProfileReq(properties);
        };
    
        /**
         * Encodes the specified ProfileReq message. Does not implicitly {@link ProfileReq.verify|verify} messages.
         * @function encode
         * @memberof ProfileReq
         * @static
         * @param {IProfileReq} message ProfileReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileReq.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            $root.ProfileReq.AskedPlayer.encode(message.askedPlayer, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };
    
        /**
         * Encodes the specified ProfileReq message, length delimited. Does not implicitly {@link ProfileReq.verify|verify} messages.
         * @function encodeDelimited
         * @memberof ProfileReq
         * @static
         * @param {IProfileReq} message ProfileReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProfileReq.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a ProfileReq message from the specified reader or buffer.
         * @function decode
         * @memberof ProfileReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {ProfileReq} ProfileReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileReq.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileReq();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.askedPlayer = $root.ProfileReq.AskedPlayer.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("askedPlayer"))
                throw $util.ProtocolError("missing required 'askedPlayer'", { instance: message });
            return message;
        };
    
        /**
         * Decodes a ProfileReq message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof ProfileReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {ProfileReq} ProfileReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProfileReq.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a ProfileReq message.
         * @function verify
         * @memberof ProfileReq
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProfileReq.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            {
                var error = $root.ProfileReq.AskedPlayer.verify(message.askedPlayer);
                if (error)
                    return "askedPlayer." + error;
            }
            return null;
        };
    
        /**
         * Creates a ProfileReq message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof ProfileReq
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {ProfileReq} ProfileReq
         */
        ProfileReq.fromObject = function fromObject(object) {
            if (object instanceof $root.ProfileReq)
                return object;
            var message = new $root.ProfileReq();
            if (object.askedPlayer != null) {
                if (typeof object.askedPlayer !== "object")
                    throw TypeError(".ProfileReq.askedPlayer: object expected");
                message.askedPlayer = $root.ProfileReq.AskedPlayer.fromObject(object.askedPlayer);
            }
            return message;
        };
    
        /**
         * Creates a plain object from a ProfileReq message. Also converts values to other types if specified.
         * @function toObject
         * @memberof ProfileReq
         * @static
         * @param {ProfileReq} message ProfileReq
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProfileReq.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.askedPlayer = null;
            if (message.askedPlayer != null && message.hasOwnProperty("askedPlayer"))
                object.askedPlayer = $root.ProfileReq.AskedPlayer.toObject(message.askedPlayer, options);
            return object;
        };
    
        /**
         * Converts this ProfileReq to JSON.
         * @function toJSON
         * @memberof ProfileReq
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProfileReq.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Gets the default type url for ProfileReq
         * @function getTypeUrl
         * @memberof ProfileReq
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProfileReq.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/ProfileReq";
        };
    
        ProfileReq.AskedPlayer = (function() {
    
            /**
             * Properties of an AskedPlayer.
             * @memberof ProfileReq
             * @interface IAskedPlayer
             * @property {number|null} [rank] AskedPlayer rank
             * @property {string|null} [keycloakId] AskedPlayer keycloakId
             */
    
            /**
             * Constructs a new AskedPlayer.
             * @memberof ProfileReq
             * @classdesc Represents an AskedPlayer.
             * @implements IAskedPlayer
             * @constructor
             * @param {ProfileReq.IAskedPlayer=} [properties] Properties to set
             */
            function AskedPlayer(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * AskedPlayer rank.
             * @member {number} rank
             * @memberof ProfileReq.AskedPlayer
             * @instance
             */
            AskedPlayer.prototype.rank = 0;
    
            /**
             * AskedPlayer keycloakId.
             * @member {string} keycloakId
             * @memberof ProfileReq.AskedPlayer
             * @instance
             */
            AskedPlayer.prototype.keycloakId = "";
    
            /**
             * Creates a new AskedPlayer instance using the specified properties.
             * @function create
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {ProfileReq.IAskedPlayer=} [properties] Properties to set
             * @returns {ProfileReq.AskedPlayer} AskedPlayer instance
             */
            AskedPlayer.create = function create(properties) {
                return new AskedPlayer(properties);
            };
    
            /**
             * Encodes the specified AskedPlayer message. Does not implicitly {@link ProfileReq.AskedPlayer.verify|verify} messages.
             * @function encode
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {ProfileReq.IAskedPlayer} message AskedPlayer message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AskedPlayer.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.rank != null && Object.hasOwnProperty.call(message, "rank"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.rank);
                if (message.keycloakId != null && Object.hasOwnProperty.call(message, "keycloakId"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.keycloakId);
                return writer;
            };
    
            /**
             * Encodes the specified AskedPlayer message, length delimited. Does not implicitly {@link ProfileReq.AskedPlayer.verify|verify} messages.
             * @function encodeDelimited
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {ProfileReq.IAskedPlayer} message AskedPlayer message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AskedPlayer.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes an AskedPlayer message from the specified reader or buffer.
             * @function decode
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {ProfileReq.AskedPlayer} AskedPlayer
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AskedPlayer.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProfileReq.AskedPlayer();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.rank = reader.int32();
                            break;
                        }
                    case 2: {
                            message.keycloakId = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };
    
            /**
             * Decodes an AskedPlayer message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {ProfileReq.AskedPlayer} AskedPlayer
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AskedPlayer.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies an AskedPlayer message.
             * @function verify
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            AskedPlayer.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.rank != null && message.hasOwnProperty("rank"))
                    if (!$util.isInteger(message.rank))
                        return "rank: integer expected";
                if (message.keycloakId != null && message.hasOwnProperty("keycloakId"))
                    if (!$util.isString(message.keycloakId))
                        return "keycloakId: string expected";
                return null;
            };
    
            /**
             * Creates an AskedPlayer message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {ProfileReq.AskedPlayer} AskedPlayer
             */
            AskedPlayer.fromObject = function fromObject(object) {
                if (object instanceof $root.ProfileReq.AskedPlayer)
                    return object;
                var message = new $root.ProfileReq.AskedPlayer();
                if (object.rank != null)
                    message.rank = object.rank | 0;
                if (object.keycloakId != null)
                    message.keycloakId = String(object.keycloakId);
                return message;
            };
    
            /**
             * Creates a plain object from an AskedPlayer message. Also converts values to other types if specified.
             * @function toObject
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {ProfileReq.AskedPlayer} message AskedPlayer
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            AskedPlayer.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.rank = 0;
                    object.keycloakId = "";
                }
                if (message.rank != null && message.hasOwnProperty("rank"))
                    object.rank = message.rank;
                if (message.keycloakId != null && message.hasOwnProperty("keycloakId"))
                    object.keycloakId = message.keycloakId;
                return object;
            };
    
            /**
             * Converts this AskedPlayer to JSON.
             * @function toJSON
             * @memberof ProfileReq.AskedPlayer
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            AskedPlayer.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for AskedPlayer
             * @function getTypeUrl
             * @memberof ProfileReq.AskedPlayer
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            AskedPlayer.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/ProfileReq.AskedPlayer";
            };
    
            return AskedPlayer;
        })();
    
        return ProfileReq;
    })();

    return $root;
});
