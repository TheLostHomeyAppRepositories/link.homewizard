'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class SmokeDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "sw_smoke_detector";
  }

  async onInit() {
    this.log('Smoke detector driver has been initialized');
  }
};