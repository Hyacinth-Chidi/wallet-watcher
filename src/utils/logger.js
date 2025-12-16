import winston from 'winston';
import config from '../config/index.js';
import { mkdirSync } from 'fs';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const transports = [
  // Console transport
  new winston.transports.Console({
    format: combine(
      colorize(),
      logFormat
    )
  })
];

// Only add file transports if NOT running in Vercel/Serverless
// We check for VERCEL env var. 
// Also wrap in try/catch for generic read-only filesystem protection.
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

if (!isServerless) {
  try {
    // Create logs directory if it doesn't exist
    mkdirSync('logs', { recursive: true });
    
    transports.push(
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    );
  } catch (err) {
    // If we can't create directory (e.g. read-only fs), just ignore file transports
    // In serverless, std out (console) is usually captured anyway.
    console.warn('⚠️ Logging to file disabled: could not create logs directory', err.message);
  }
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: transports
});

export default logger;