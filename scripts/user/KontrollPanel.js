/*
 * KontrollPanel.js — PIXILAB Blocks UserScript
 * Placering: script/user/KontrollPanel.js
 *
 * Datalager för kontrollpanelen (Tekniska Museet):
 *  - Markörpositioner för spots/RPi per yta  → /public/kontrollpanel/positions.json
 *  - Händelselogg (senaste 200)              → /public/kontrollpanel/events.json
 *  - Uppladdad kartbild per yta (data-URL)   → /public/kontrollpanel/map_<yta>.txt
 *  - Öppettider per yta → sätter Realm-variabel (openVar i areas.json)
 *  - selection — delad vald-markör mellan inbäddade WebBlocks/native
 *
 * PubSub:
 *   Script.user.KontrollPanel.positions         (läs)
 *   Script.user.KontrollPanel.pendingPositions  (skriv → sparar fil)
 *   Script.user.KontrollPanel.events            (läs)
 *   Script.user.KontrollPanel.pendingEvent      (skriv → appendar, dedupe 90s)
 *   Script.user.KontrollPanel.pendingMap        (skriv → sparar kartbild)
 *   Script.user.KontrollPanel.selection         (läs/skriv)
 *   Script.user.KontrollPanel.settings          (läs)  → settings.json
 *   Script.user.KontrollPanel.pendingSettings   (skriv → sparar settings.json)
 *   Script.user.KontrollPanel.command           (skriv → {action:"reloadSpot"|"powerOffSpot"|"wakeSpot",target:"<punktsökväg>"})
 *   Script.user.KontrollPanel.commandResult     (läs)  → {ts,ok,text} kvittens
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

define(["require", "exports", "../system_lib/Script", "../system_lib/Metadata", "../system/SimpleFile", "../system/Spot", "../system/Realm"],
function (require, exports, Script_1, Metadata_1, SimpleFile_1, Spot_1, Realm_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.KontrollPanel = void 0;

    var BASE = "/public/kontrollpanel/";
    var POSITIONS_PATH = BASE + "positions.json";
    var EVENTS_PATH = BASE + "events.json";
    var SETTINGS_PATH = BASE + "settings.json";
    var AREAS_PATH = BASE + "areas.json";
    var TICK_MS = 20000;   // hur ofta öppet/stängt-läget prövas

    function toMinutes(hhmm) {
        var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
        return m ? (+m[1]) * 60 + (+m[2]) : null;
    }
    var MAX_EVENTS = 200;
    var DEDUPE_MS = 90000;

    function sanitizeKey(s) {
        return String(s).replace(/[^A-Za-z0-9_-]/g, "_");
    }

    var KontrollPanel = exports.KontrollPanel = (function (_super) {
        __extends(KontrollPanel, _super);

        function KontrollPanel(env) {
            var _this = _super.call(this, env) || this;
            _this._positions = "{}";
            _this._pendingPositions = "";
            _this._events = "[]";
            _this._pendingEvent = "";
            _this._pendingMap = "";
            _this._selection = "";
            _this._settings = "{}";
            _this._pendingSettings = "";
            _this._command = "";
            _this._commandResult = "";
            _this.eventList = [];

            _this.openVars = {};   // areaKey -> "Realm.Variabel"
            _this.lastOpen = {};   // areaKey -> senast skrivet läge

            SimpleFile_1.SimpleFile.read(SETTINGS_PATH)
                .then(function (content) {
                    _this.settings = content;
                    console.warn("KontrollPanel: settings loaded");
                    _this.applyOpenState();
                })
                .catch(function () {
                    console.warn("KontrollPanel: no settings.json yet, starting empty");
                });

            SimpleFile_1.SimpleFile.read(AREAS_PATH)
                .then(function (content) {
                    try {
                        var cfg = JSON.parse(content);
                        var list = (cfg && cfg.areas) || [];
                        for (var i = 0; i < list.length; i++)
                            if (list[i].openVar)
                                _this.openVars[list[i].key] = list[i].openVar;
                        console.warn("KontrollPanel: openVars " + JSON.stringify(_this.openVars));
                        _this.applyOpenState();
                    } catch (e) {
                        console.error("KontrollPanel: bad areas.json");
                    }
                })
                .catch(function () {
                    console.warn("KontrollPanel: no areas.json — öppet/stängt-variabler inaktiva");
                });

            _this.scheduleTick();

            SimpleFile_1.SimpleFile.read(POSITIONS_PATH)
                .then(function (content) {
                    _this.positions = content;
                    console.warn("KontrollPanel: positions loaded");
                })
                .catch(function () {
                    console.warn("KontrollPanel: no positions.json yet, starting empty");
                });

            SimpleFile_1.SimpleFile.read(EVENTS_PATH)
                .then(function (content) {
                    try {
                        var parsed = JSON.parse(content);
                        if (parsed instanceof Array) {
                            _this.eventList = parsed;
                            _this.events = JSON.stringify(parsed);
                        }
                        console.warn("KontrollPanel: events loaded (" + _this.eventList.length + ")");
                    } catch (e) {
                        console.error("KontrollPanel: bad events.json, starting empty");
                    }
                })
                .catch(function () {
                    console.warn("KontrollPanel: no events.json yet, starting empty");
                });

            console.warn("KontrollPanel: started");
            return _this;
        }

        // ---- positions ----
        Object.defineProperty(KontrollPanel.prototype, "positions", {
            get: function () { return this._positions; },
            set: function (v) { this._positions = v; },
            enumerable: false, configurable: true
        });

        Object.defineProperty(KontrollPanel.prototype, "pendingPositions", {
            get: function () { return this._pendingPositions; },
            set: function (json) {
                this._pendingPositions = json;
                if (!json) return;
                var parsed;
                try {
                    parsed = JSON.parse(json);
                } catch (e) {
                    console.error("KontrollPanel: invalid JSON in pendingPositions");
                    return;
                }
                var formatted = JSON.stringify(parsed, null, 2);
                this.positions = formatted;
                SimpleFile_1.SimpleFile.write(POSITIONS_PATH, formatted)
                    .then(function () { console.warn("KontrollPanel: positions saved"); })
                    .catch(function () { console.error("KontrollPanel: failed to write positions.json"); });
            },
            enumerable: false, configurable: true
        });

        // ---- events ----
        Object.defineProperty(KontrollPanel.prototype, "events", {
            get: function () { return this._events; },
            set: function (v) { this._events = v; },
            enumerable: false, configurable: true
        });

        Object.defineProperty(KontrollPanel.prototype, "pendingEvent", {
            get: function () { return this._pendingEvent; },
            set: function (json) {
                this._pendingEvent = json;
                if (!json) return;
                var ev;
                try {
                    ev = JSON.parse(json);
                } catch (e) {
                    console.error("KontrollPanel: invalid JSON in pendingEvent");
                    return;
                }
                if (!ev || !ev.name || !ev.text) return;
                if (typeof ev.ts !== "number") ev.ts = Date.now();
                // Dedupe: samma typ+namn+text inom DEDUPE_MS (flera paneler
                // upptäcker samma övergång samtidigt)
                for (var i = 0; i < this.eventList.length; i++) {
                    var old = this.eventList[i];
                    if (old.type === ev.type && old.name === ev.name && old.text === ev.text) {
                        if (ev.ts - old.ts < DEDUPE_MS) return;
                        break; // listan är nyast-först — räcker att kolla första träffen
                    }
                }
                this.eventList.unshift({ ts: ev.ts, type: ev.type || "", name: ev.name, text: ev.text, level: ev.level || "info" });
                if (this.eventList.length > MAX_EVENTS)
                    this.eventList.length = MAX_EVENTS;
                var out = JSON.stringify(this.eventList);
                this.events = out;
                SimpleFile_1.SimpleFile.write(EVENTS_PATH, out)
                    .catch(function () { console.error("KontrollPanel: failed to write events.json"); });
            },
            enumerable: false, configurable: true
        });

        // ---- kartbild (data-URL) ----
        Object.defineProperty(KontrollPanel.prototype, "pendingMap", {
            get: function () { return this._pendingMap; },
            set: function (json) {
                this._pendingMap = json;
                if (!json) return;
                var msg;
                try {
                    msg = JSON.parse(json);
                } catch (e) {
                    console.error("KontrollPanel: invalid JSON in pendingMap");
                    return;
                }
                if (!msg || !msg.area || !msg.dataUrl) return;
                if (String(msg.dataUrl).indexOf("data:image/") !== 0) {
                    console.error("KontrollPanel: pendingMap dataUrl is not an image data-URL");
                    return;
                }
                var path = BASE + "map_" + sanitizeKey(msg.area) + ".txt";
                SimpleFile_1.SimpleFile.write(path, msg.dataUrl)
                    .then(function () { console.warn("KontrollPanel: map saved to " + path); })
                    .catch(function () { console.error("KontrollPanel: failed to write " + path); });
            },
            enumerable: false, configurable: true
        });

        // ---- settings (öppettider, larmkvitteringar) ----
        Object.defineProperty(KontrollPanel.prototype, "settings", {
            get: function () { return this._settings; },
            set: function (v) { this._settings = v; },
            enumerable: false, configurable: true
        });

        Object.defineProperty(KontrollPanel.prototype, "pendingSettings", {
            get: function () { return this._pendingSettings; },
            set: function (json) {
                this._pendingSettings = json;
                if (!json) return;
                var parsed;
                try {
                    parsed = JSON.parse(json);
                } catch (e) {
                    console.error("KontrollPanel: invalid JSON in pendingSettings");
                    return;
                }
                var formatted = JSON.stringify(parsed, null, 2);
                this.settings = formatted;
                this.applyOpenState();   // nya tider ska slå igenom direkt
                SimpleFile_1.SimpleFile.write(SETTINGS_PATH, formatted)
                    .then(function () { console.warn("KontrollPanel: settings saved"); })
                    .catch(function () { console.error("KontrollPanel: failed to write settings.json"); });
            },
            enumerable: false, configurable: true
        });

        // ---- command (fjärråtgärder från panelen) ----
        Object.defineProperty(KontrollPanel.prototype, "command", {
            get: function () { return this._command; },
            set: function (json) {
                this._command = json;
                if (!json) return;
                var cmd;
                try {
                    cmd = JSON.parse(json);
                } catch (e) {
                    console.error("KontrollPanel: invalid JSON in command");
                    return;
                }
                if (!cmd || !cmd.action) return;
                if (!cmd.target) { this.reportCommand(false, "Ingen spot angiven"); return; }

                // Slå upp spoten i Spot-trädet via punktsökväg
                var obj = Spot_1.Spot;
                var segs = String(cmd.target).split(".");
                for (var i = 0; i < segs.length && obj; i++)
                    obj = obj[segs[i]];
                var d = (obj && obj.isOfTypeName) ? obj.isOfTypeName("DisplaySpot") : null;
                if (!d) {
                    console.error("KontrollPanel: spot not found: " + cmd.target);
                    this.reportCommand(false, "Hittar inte spot " + cmd.target);
                    return;
                }
                var self = this;
                try {
                    if (cmd.action === "reloadSpot") {
                        // reload(true) laddar om hela webbsidan i spelaren.
                        // Kräver att spoten är ansluten.
                        if (!d.connected) {
                            this.reportCommand(false, d.name + " är frånkopplad — kan inte laddas om");
                            return;
                        }
                        d.reload(true);
                        console.warn("KontrollPanel: reloaded " + cmd.target);
                        this.reportCommand(true, d.name + " laddas om");
                    } else if (cmd.action === "powerOffSpot") {
                        // power=false stänger av och Blocks håller spoten avstängd
                        // tills den väcks igen (wakeSpot).
                        d.power = false;
                        console.warn("KontrollPanel: powered off " + cmd.target);
                        this.reportCommand(true, d.name + " stängs av");
                    } else if (cmd.action === "wakeSpot") {
                        // power=true väcker skärm/spelare som Blocks stängt av
                        d.power = true;
                        if (typeof d.wakeUp === "function") {
                            d.wakeUp(45)
                                .then(function () { self.reportCommand(true, d.name + " är uppe igen"); })
                                .catch(function () { self.reportCommand(false, d.name + " svarade inte — kontrollera ström och nätverk"); });
                            this.reportCommand(true, "Väcker " + d.name + "…");
                        } else {
                            this.reportCommand(true, "Ström på skickad till " + d.name);
                        }
                        console.warn("KontrollPanel: wake sent to " + cmd.target);
                    } else {
                        this.reportCommand(false, "Okänd åtgärd: " + cmd.action);
                    }
                } catch (e2) {
                    console.error("KontrollPanel: " + cmd.action + " failed: " + e2);
                    this.reportCommand(false, "Åtgärden misslyckades: " + e2);
                }
            },
            enumerable: false, configurable: true
        });

        // ---- commandResult (kvittens tillbaka till panelen) ----
        Object.defineProperty(KontrollPanel.prototype, "commandResult", {
            get: function () { return this._commandResult; },
            set: function (v) { this._commandResult = v; },
            enumerable: false, configurable: true
        });

        KontrollPanel.prototype.reportCommand = function (ok, text) {
            this.commandResult = JSON.stringify({ ts: Date.now(), ok: !!ok, text: text });
        };

        // ---- Öppet/stängt → Realm-variabel ----
        KontrollPanel.prototype.scheduleTick = function () {
            var _this = this;
            this.tickTimer = wait(TICK_MS);
            this.tickTimer.then(function () {
                _this.applyOpenState();
                _this.scheduleTick();
            });
        };

        /* Sätter varje ytas öppet-variabel efter klockan. Läget beräknas om
           varje tick och skrivs bara när det ändras — så variabeln blir rätt
           även efter serveromstart eller ändrade tider mitt på dagen. */
        KontrollPanel.prototype.applyOpenState = function () {
            var st;
            try { st = JSON.parse(this._settings); } catch (e) { return; }
            if (!st) return;
            var hours = st.hours || {};
            var now = new Date();
            var nowMin = now.getHours() * 60 + now.getMinutes();
            for (var key in this.openVars) {
                var h = hours[key];
                var open = h ? toMinutes(h.open) : null;
                var close = h ? toMinutes(h.close) : null;
                if (open === null || close === null) continue;
                // Stängningstid före öppning = passerar midnatt
                var isOpen = close > open
                    ? (nowMin >= open && nowMin < close)
                    : (nowMin >= open || nowMin < close);
                if (this.lastOpen[key] === isOpen) continue;
                if (this.setRealmVar(this.openVars[key], isOpen)) {
                    this.lastOpen[key] = isOpen;
                    console.warn("KontrollPanel: " + this.openVars[key] + " = " + isOpen);
                }
            }
        };

        /* spec = "Realm.Variabel" eller bara "Variabel" (söks i alla realms) */
        KontrollPanel.prototype.setRealmVar = function (spec, value) {
            var dot = String(spec).indexOf(".");
            var realmName = dot > 0 ? spec.substring(0, dot) : null;
            var varName = dot > 0 ? spec.substring(dot + 1) : spec;
            try {
                if (realmName) {
                    var r = Realm_1.Realm[realmName];
                    if (r && r.variable && r.variable[varName]) {
                        r.variable[varName].value = value;
                        return true;
                    }
                    console.error("KontrollPanel: hittar inte realm-variabel " + spec);
                    return false;
                }
                for (var rn in Realm_1.Realm) {
                    var rr = Realm_1.Realm[rn];
                    if (rr && rr.variable && rr.variable[varName]) {
                        rr.variable[varName].value = value;
                        return true;
                    }
                }
                console.error("KontrollPanel: hittar inte realm-variabel " + varName + " i någon realm");
            } catch (e) {
                console.error("KontrollPanel: kunde inte sätta " + spec + ": " + e);
            }
            return false;
        };

        // ---- selection (delad mellan block) ----
        Object.defineProperty(KontrollPanel.prototype, "selection", {
            get: function () { return this._selection; },
            set: function (v) { this._selection = v; },
            enumerable: false, configurable: true
        });

        __decorate([
            (0, Metadata_1.property)("Marker positions per area as JSON string"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "positions", null);

        __decorate([
            (0, Metadata_1.property)("Set to JSON string of all marker positions to save to disk"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "pendingPositions", null);

        __decorate([
            (0, Metadata_1.property)("Event log, newest first, as JSON array string"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "events", null);

        __decorate([
            (0, Metadata_1.property)("Set to JSON event {type,name,text,level} to append to log"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "pendingEvent", null);

        __decorate([
            (0, Metadata_1.property)("Set to JSON {area,dataUrl} to store a new map image"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "pendingMap", null);

        __decorate([
            (0, Metadata_1.property)("Panel settings (open hours, acked alarms) as JSON string"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "settings", null);

        __decorate([
            (0, Metadata_1.property)("Set to JSON settings object to save to disk"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "pendingSettings", null);

        __decorate([
            (0, Metadata_1.property)("Set to JSON {action:'reloadSpot'|'powerOffSpot'|'wakeSpot',target:'<dot-path>'} to execute"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "command", null);

        __decorate([
            (0, Metadata_1.property)("Result of last command as JSON {ts,ok,text}"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "commandResult", null);

        __decorate([
            (0, Metadata_1.property)("Currently selected marker key (spot:<path> / rpi:<mac>), shared between blocks"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], KontrollPanel.prototype, "selection", null);

        return KontrollPanel;
    }(Script_1.Script));
});
