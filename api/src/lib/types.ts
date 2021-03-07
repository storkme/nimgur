import { DataMapper } from '@aws/dynamodb-data-mapper';

export interface AppContext {
  data: DataMapper,
}
