import * as migration_20260826_112408_baseline from './20260826_112408_baseline';
import * as migration_20260827_161435_card_image_size from './20260827_161435_card_image_size';
import * as migration_20260828_045233_web_video_architecture from './20260828_045233_web_video_architecture';
import * as migration_20260912_161212_images_storage_provider from './20260912_161212_images_storage_provider';
import * as migration_20260913_085713_images_filename_namespace_unique from './20260913_085713_images_filename_namespace_unique';

export const migrations = [
  {
    up: migration_20260826_112408_baseline.up,
    down: migration_20260826_112408_baseline.down,
    name: '20260826_112408_baseline',
  },
  {
    up: migration_20260827_161435_card_image_size.up,
    down: migration_20260827_161435_card_image_size.down,
    name: '20260827_161435_card_image_size',
  },
  {
    up: migration_20260828_045233_web_video_architecture.up,
    down: migration_20260828_045233_web_video_architecture.down,
    name: '20260828_045233_web_video_architecture',
  },
  {
    up: migration_20260912_161212_images_storage_provider.up,
    down: migration_20260912_161212_images_storage_provider.down,
    name: '20260912_161212_images_storage_provider',
  },
  {
    up: migration_20260913_085713_images_filename_namespace_unique.up,
    down: migration_20260913_085713_images_filename_namespace_unique.down,
    name: '20260913_085713_images_filename_namespace_unique'
  },
];
