'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class LightDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "hw_led_light_5ch";
  }

  async onInit() {
    this.log('Color light driver has been initialized');
  }
};