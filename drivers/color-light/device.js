'use strict';

const Homey = require('homey');

module.exports = class LightDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.pendingUpdate = null;
    this.updateTimeout = null;
    this.currentMode = 'color';

    this.registerCapabilityListener("onoff", async (value) => {
      await this.scheduleUpdate({ onoff: value });
    });

    this.registerCapabilityListener("dim", async (value) => {
      await this.scheduleUpdate({ dim: value });
    });

    this.registerCapabilityListener("light_hue", async (value) => {
      this.currentMode = 'color';
      await this.scheduleUpdate({ hue: value });
    });

    this.registerCapabilityListener("light_saturation", async (value) => {
      this.currentMode = 'color';
      await this.scheduleUpdate({ saturation: value });
    });

    this.registerCapabilityListener("light_temperature", async (value) => {
      this.currentMode = 'temperature';
      await this.scheduleUpdate({ hue: value, saturation: 0 });
    });

    this.registerCapabilityListener("light_mode", async (value) => {
      this.currentMode = value;
    });

    this.log('Light device has been initialized');
  }

  async scheduleUpdate(changes) {
    if (!this.pendingUpdate) {
      this.pendingUpdate = {};
    }
    
    Object.assign(this.pendingUpdate, changes);

    if (this.updateTimeout) {
      this.homey.clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = this.homey.setTimeout(async () => {
      await this.executeUpdate();
    }, 50);
  }

  async executeUpdate() {
    if (!this.pendingUpdate) return;

    try {
      const state = { ...this.pendingUpdate };
      
      if (state.onoff === undefined) {
        state.onoff = await this.getCapabilityValue("onoff");
      }
      if (state.dim === undefined) {
        state.dim = await this.getCapabilityValue("dim");
      }

      if (this.currentMode === 'temperature') {
        if (state.hue === undefined) {
          state.hue = await this.getCapabilityValue("light_temperature");
        }
        state.saturation = 0;
      } else {
        if (state.hue === undefined) {
          state.hue = await this.getCapabilityValue("light_hue");
        }
        if (state.saturation === undefined) {
          state.saturation = await this.getCapabilityValue("light_saturation");
        }
      }

      this.log('Executing light update:', state);
      await this.homey.app.controlLight(this, state);

      this.pendingUpdate = null;
    } catch (error) {
      this.error('Error executing light update:', error);
      this.pendingUpdate = null;
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Light device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Light device settings were changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   */
  async onRenamed(name) {
    this.log('Light device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Light device has been deleted');
  }

};