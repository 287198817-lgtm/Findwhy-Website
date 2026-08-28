import * as migration_20260826_112408_baseline from './20260826_112408_baseline';
import * as migration_20260827_161435_card_image_size from './20260827_161435_card_image_size';

export const migrations = [
  {
    up: migration_20260826_112408_baseline.up,
    down: migration_20260826_112408_baseline.down,
    name: '20260826_112408_baseline',
  },
  {
    up: migration_20260827_161435_card_image_size.up,
    down: migration_20260827_161435_card_image_size.down,
    name: '20260827_161435_card_image_size'
  },
];
