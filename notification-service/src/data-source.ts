import 'reflect-metadata'
import { DataSource, DataSourceOptions } from 'typeorm'
import { Notification, NotificationActor, NotificationSetting } from './notification.entity'

/** Dùng chung cho ứng dụng và cho TypeORM CLI (npm run migration:...). */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Notification, NotificationActor, NotificationSetting],
  migrations: [__dirname + '/migrations/*.js'],
  uuidExtension: 'pgcrypto', // gen_random_uuid() có sẵn từ PostgreSQL 13, không cần cài extension
  installExtensions: false,
  synchronize: false,
}

export default new DataSource(dataSourceOptions)
