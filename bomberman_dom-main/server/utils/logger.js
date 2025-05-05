class Logger {
    constructor() {
      this.colors = {
        red: "\x1b[31m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        gray: "\x1b[90m",
        reset: "\x1b[0m",
      };
    }
  
    error(message, ...args) {
      this._log("ERROR", this.colors.red, message, args);
    }
  
    warn(message, ...args) {
      this._log("WARN", this.colors.yellow, message, args);
    }
  
    info(message, ...args) {
      this._log("INFO", this.colors.blue, message, args);
    }
  
    debug(message, ...args) {
      this._log("DEBUG", this.colors.gray, message, args);
    }
  
    _log(level, color, message, args) {
      const timestamp = new Date().toISOString();
      const formatted = `${color}[${timestamp}] ${level}: ${message}${this.colors.reset}`;
      console.log(formatted, ...args);
    }
  }
  
  export const logger = new Logger();