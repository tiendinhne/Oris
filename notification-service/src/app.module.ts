import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { dataSourceOptions } from './data-source'
import { EventsController } from './events.controller'
import { Notification, NotificationActor, NotificationSetting } from './notification.entity'
import { NotificationsController } from './notifications.controller'

@Module({
  imports: [
    // Khởi động là tự chạy các migration chưa áp dụng (giống `alembic upgrade head` bên Python)
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: true }),
    TypeOrmModule.forFeature([Notification, NotificationActor, NotificationSetting]),
  ],
  controllers: [NotificationsController, EventsController],
})
export class AppModule {}
