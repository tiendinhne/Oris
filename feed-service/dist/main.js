"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const errors_1 = require("./errors");
async function bootstrap() {
    for (const k of ['DATABASE_URL', 'JWT_SECRET'])
        if (!process.env[k])
            throw new Error(`Thiếu biến môi trường ${k}`);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new errors_1.ErrorFilter());
    await app.listen(3000, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map