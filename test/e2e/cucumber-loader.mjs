/**
 * Cucumber Loader for ES Modules - US-066
 * Loads TypeScript files for Cucumber
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('ts-node/esm', pathToFileURL('./'));

