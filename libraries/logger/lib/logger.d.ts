import { createLogger as createWinstonLogger } from "winston";
interface GhostLogger extends ReturnType<typeof createWinstonLogger> {
    star(v: any): GhostLogger;
}
export declare const createLogger: (proc?: string) => GhostLogger;
export {};
