'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class WaterLeakDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "sw_leak_detector";
  }

  async onInit() {
    this.log('Water leakage detector driver has been initialized');
  }
};