class Mutex {
  constructor() {
    this._locked = false;
    this._waiting = [];
  }
  async lock() {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise(resolve => this._waiting.push(resolve));
  }
  unlock() {
    if (this._waiting.length > 0) {
      const resolve = this._waiting.shift();
      resolve();
    } else {
      this._locked = false;
    }
  }
}
const singleLegMutex = new Mutex();
module.exports = { singleLegMutex, Mutex };
