import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import type { LevelDef } from './types';

export const LEVELS: (() => LevelDef)[] = [level1, level2, level3];
