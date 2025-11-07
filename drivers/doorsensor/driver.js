'use strict';

const BaseHomeWizardDriver = require('../../lib/base-driver');

module.exports = class ContactDriver extends BaseHomeWizardDriver {

  getDeviceType() {
    return "hw_contact_sensor";
  }

  async onInit() {
    this.log('Contact sensor driver has been initialized');
  }
};