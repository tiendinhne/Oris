import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { dataSourceOptions } from './data-source'
import { Notification } from './notification.entity'
import { NotificationsController } from './notifications.controller'

@Module({
  imports: [
    // Khởi động là tự chạy các migration chưa áp dụng (giống `alembic upgrade head` bên Python)
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: true }),
    TypeOrmModule.forFeature([Notification]),
  ],
  controllers: [NotificationsController],
})
export class AppModule {}
