'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class CODriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "sw_mesh_smoke_detector";
  }

  async onInit() {
    this.log('CO detector driver has been initialized');
  }
};