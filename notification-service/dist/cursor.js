"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeCursor = void 0;
exports.decodeCursor = decodeCursor;
const class_validator_1 = require("class-validator");
const errors_1 = require("./errors");
/** Cursor mã hóa (created_at, id) của dòng cuối trang trước, giống pagination.py bên Python. */
const encodeCursor = (createdAt, id) => Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
exports.encodeCursor = encodeCursor;
function decodeCursor(cursor) {
    const [ts, id] = Buffer.from(cursor, 'base64url').toString().split('|');
    const createdAt = new Date(ts);
    if (!id || isNaN(createdAt.getTime()) || !(0, class_validator_1.isUUID)(id))
        throw (0, errors_1.apiError)(400, 'INVALID_CURSOR', 'Cursor không hợp lệ');
    return { createdAt, id };
}
//# sourceMappingURL=cursor.js.map