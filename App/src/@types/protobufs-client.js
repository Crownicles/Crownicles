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
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
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
            return new $root.PingReq();
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
        PingReq.toObject = function toObject() {
            return {};
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

    return $root;
});
