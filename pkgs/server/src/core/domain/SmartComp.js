import SmartModel from './SmartModel.js';

/**
 * A SIMPLE TEST of domain objects gleaned from a central core package!
 */
export default class SmartComp extends SmartModel {

  /**
   * Create a SmartComp.
   *
   * **Please Note** this constructor uses named parameters.
   *
   * @param {string} msg - dumb message used in our simulation.
   */
  constructor({msg, ...unknownArgs}={}) {
    super({msg});
  }

  /**
   * A polymorphic method used in our simple test.
   */
  sayIt() {
    return `SmartComp: ${this.msg}`;
  }
}
