import log from 'electron-log/main';
import { logsPath } from './platform';
import path from 'node:path';

log.transports.file.resolvePathFn = () => path.join(logsPath(), 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = 'info';
log.transports.file.level = 'info';

export const logger = log.scope('main');

export const scoped = (scope: string) => log.scope(scope);
