/**
 * A SIMPLE TEST of domain objects gleaned from a central core package!
 */
export default class SmartModel {

  /**
   * Create a SmartModel.
   *
   * **Please Note** this constructor uses named parameters.
   *
   * @param {string} msg - dumb message used in our simulation.
   */
  constructor({msg, ...unknownArgs}={}) {
    // retain parameters in self
    this.msg = msg;
  }

  /**
   * A polymorphic method used in our simple test.
   */
  sayIt() {
    return `SmartModel: ${this.msg}`;
  }

}
