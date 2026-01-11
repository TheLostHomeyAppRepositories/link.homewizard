'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class ThermometerDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "hw_thermometer";
  }

  async onInit() {
    this.log('Thermometer driver has been initialized');
  }
};