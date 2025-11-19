'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class WhiteLightDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "hw_led_light_2ch";
  }

  async onInit() {
    this.log('Color light driver has been initialized');
  }
};