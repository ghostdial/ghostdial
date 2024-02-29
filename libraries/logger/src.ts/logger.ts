import util from "util";
import {
  createLogger as createWinstonLogger,
  transports,
  Logger,
  format,
  addColors,
} from "winston";

const customLevels = {
  error: 0,
  warn: 1,
  data: 2,
  info: 3,
  debug: 4,
  verbose: 5,
  silly: 6,
  custom: 7,
};

const customColors = {
  error: "red",
  warn: "yellow",
  data: "grey",
  info: "green",
  debug: "red",
  verbose: "cyan",
  silly: "magenta",
  custom: "blue",
};

const customFormatter = ({ level, message, label, timestamp }) => {
  return `${label}|${timestamp}|${level}|${
    typeof message === "string"
      ? message
      : util.inspect(message, { colors: true, depth: 15 })
  }`;
};

interface GhostLogger extends ReturnType<typeof createWinstonLogger> {
  star(v: any): GhostLogger;
}

export const createLogger = (proc?: string): GhostLogger => {
  addColors(customColors);
  const logger: any = createWinstonLogger({
    defaultMeta: {
      service: proc || "ghostdial",
    },
    levels: customLevels,
    format: format.combine(format.errors({ stack: true }), format.json()),
    transports: [
      new transports.Console({
        level: "verbose",
        format: format.combine(
          format.label({ label: proc }),
          format.timestamp(),
          format.printf(customFormatter),
        ),
      }),
    ],
  });
  logger.error = function (err) {
    console.error(err);
  };
  logger.star = function (v) {
    console.log("✨ ", v);
  };
  return logger as GhostLogger;
};
