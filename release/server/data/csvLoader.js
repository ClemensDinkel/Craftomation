"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMetalElements = loadMetalElements;
exports.loadOrganicElements = loadOrganicElements;
exports.loadMetalProducts = loadMetalProducts;
exports.loadOrganicProducts = loadOrganicProducts;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function parseCsv(filename) {
    // Check for release layout (data/ next to cwd), fall back to __dirname
    const releasePath = path_1.default.join(process.cwd(), 'data', filename);
    const filepath = fs_1.default.existsSync(releasePath)
        ? releasePath
        : path_1.default.resolve(__dirname, filename);
    const content = fs_1.default.readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
            obj[h.trim()] = (values[i] || '').trim();
        });
        return obj;
    });
}
function loadMetalElements() {
    return parseCsv('metal_elements.csv');
}
function loadOrganicElements() {
    return parseCsv('organic_elements.csv');
}
function loadMetalProducts() {
    return parseCsv('metal_products.csv');
}
function loadOrganicProducts() {
    return parseCsv('organic_products.csv');
}
//# sourceMappingURL=csvLoader.js.map