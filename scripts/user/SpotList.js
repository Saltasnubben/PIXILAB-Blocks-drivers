/*
 * SpotList.js — PIXILAB Blocks UserScript
 * Placering: script/user/SpotList.js  (på Blocks-servern)
 *
 * Scannar Spot-trädet och publicerar alla DisplaySpots som JSON-array
 * via PubSub: Script.user.SpotList.spotList
 *
 * Varje element: { name, path, connected, ipAddress, playingBlock, active }
 * path = spotens fulla punktsökväg i Spot-trädet (unik nyckel)
 */

var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};

var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};

define(["require", "exports", "../system_lib/Script", "../system_lib/Metadata", "../system/Spot"],
function (require, exports, Script_1, Metadata_1, Spot_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SpotList = void 0;

    var SpotList = exports.SpotList = (function (_super) {
        __extends(SpotList, _super);

        function SpotList(env) {
            var _this = _super.call(this, env) || this;
            _this._spotList = "[]";
            _this.publish();
            _this.scheduleNext();
            console.warn("SpotList: started");
            return _this;
        }

        Object.defineProperty(SpotList.prototype, "spotList", {
            get: function () { return this._spotList; },
            set: function (v) { this._spotList = v; },
            enumerable: false, configurable: true
        });

        SpotList.prototype.publish = function () {
            try {
                var result = [];
                SpotList.collect('', Spot_1.Spot, result);
                this.spotList = JSON.stringify(result);
                console.warn("SpotList: published " + result.length + " spots");
            } catch (e) {
                console.warn("SpotList: scan failed: " + e);
            }
        };

        SpotList.prototype.scheduleNext = function () {
            var _this = this;
            this.timer = wait(60000);
            this.timer.then(function () {
                _this.publish();
                _this.scheduleNext();
            });
        };

        SpotList.collect = function (enclPath, group, result) {
            for (var name in group) {
                var item = group[name];
                var nestedGroup = item.isOfTypeName('SpotGroup');
                if (nestedGroup) {
                    var nestedPath = enclPath ? enclPath + '.' + name : name;
                    SpotList.collect(nestedPath, nestedGroup, result);
                } else {
                    var displaySpot = item.isOfTypeName('DisplaySpot');
                    if (displaySpot) {
                        result.push({
                            name:         displaySpot.name,
                            path:         enclPath ? enclPath + '.' + name : name,
                            connected:    displaySpot.connected,
                            ipAddress:    displaySpot.address,
                            playingBlock: displaySpot.playingBlock,
                            active:       displaySpot.active
                        });
                    }
                }
            }
        };

        __decorate([
            (0, Metadata_1.property)("JSON array of all DisplaySpots with status"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], SpotList.prototype, "spotList", null);

        return SpotList;
    }(Script_1.Script));
});
