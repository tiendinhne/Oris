"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceOptions = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const notification_entity_1 = require("./notification.entity");
/** Dùng chung cho ứng dụng và cho TypeORM CLI (npm run migration:...). */
exports.dataSourceOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [notification_entity_1.Notification],
    migrations: [__dirname + '/migrations/*.js'],
    uuidExtension: 'pgcrypto', // gen_random_uuid() có sẵn từ PostgreSQL 13, không cần cài extension
    installExtensions: false,
    synchronize: false,
};
exports.default = new typeorm_1.DataSource(exports.dataSourceOptions);
//# sourceMappingURL=data-source.js.map