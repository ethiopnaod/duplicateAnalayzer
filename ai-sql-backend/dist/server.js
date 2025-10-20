"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const router_1 = require("./services/router");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.use("/api", router_1.router);
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(env_1.PORT, () => {
    console.log(`AI SQL Backend listening on :${env_1.PORT}`);
});
