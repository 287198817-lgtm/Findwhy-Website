import * as migration_20260826_112408_baseline from './20260826_112408_baseline';

export const migrations = [
  {
    up: migration_20260826_112408_baseline.up,
    down: migration_20260826_112408_baseline.down,
    name: '20260826_112408_baseline'
  },
];
