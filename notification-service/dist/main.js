"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const errors_1 = require("./errors");
async function bootstrap() {
    for (const k of ['DATABASE_URL', 'JWT_SECRET'])
        if (!process.env[k])
            throw new Error(`Thiếu biến môi trường ${k}`);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new errors_1.ErrorFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        // Lỗi dữ liệu trả 422 kèm danh sách trường lỗi, giống Auth/Post
        exceptionFactory: (errors) => (0, errors_1.validationError)(errors.map((e) => ({ field: e.property, message: Object.values(e.constraints ?? {})[0] }))),
    }));
    await app.listen(3000, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map