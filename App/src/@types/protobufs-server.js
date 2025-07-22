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

    return $root;
});
