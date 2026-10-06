"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    if (!process.env.DATABASE_URL)
        throw new Error('Thiếu biến môi trường DATABASE_URL');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    await app.listen(3000, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map