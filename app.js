'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class HomeWizardLinkApp extends Homey.App {

  async onInit() {
    this.log('HomeWizard Link has been initialized');
    this.startPolling();
  }

  async getToken(linkId) {
    try {
      const email = this.homey.settings.get('email');
      const password = this.homey.settings.get('password');
      const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
      const response = await axios.post('https://api.homewizardeasyonline.com/v1/auth/token', {
        device: linkId
      }, {
        headers: {
          'Authorization': `${basicAuth}`
        }
      });
      return response.data.token;
    } catch (error) {
      this.log('Error fetching token:', error.message);
      throw new Error("Error fetching token: " + error.message);
    }
  }

  async controlLight(device, state) {
    try {
      const linkEndpoint = device.getStoreValue('linkEndpoint');
      const token = device.getStoreValue('token');
      const deviceId = device.getStoreValue('deviceId');

      if (!linkEndpoint || !token || !deviceId) {
        throw new Error("Missing device information for controlling light");
      }

      const payload = {
        status: state.onoff ? "on" : "off",
      };

      if (state.onoff) {
        const color = {};
        
        const isTemperatureMode = state.saturation === 0;
        
        if (isTemperatureMode) {
          color.hue = Math.round(state.hue * 200);
          color.saturation = 0;
        } else {
          color.hue = Math.round(state.hue * 360);
          color.saturation = Math.round(state.saturation * 100);
        }
        
        if (state.dim !== undefined) {
          color.brightness = Math.round(state.dim * 100);
        }

        payload.color = color;
      }

      this.log('Controlling light with payload:', JSON.stringify(payload, null, 2));

      await axios.post(`${linkEndpoint}/v42/devices/${deviceId}/state`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

    } catch (error) {
      if (error.response) {
        this.error('Error controlling light:', error.response.status, error.response.data);
      } else {
        this.error('Error controlling light:', error.message);
      }
      throw new Error("Error controlling light: " + error.message);
    }
  }

  async startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        const drivers = this.homey.drivers.getDrivers();
        let allDevices = [];
        for (const driverId in drivers) {
          const driver = drivers[driverId];
          allDevices = allDevices.concat(driver.getDevices());
        }

        if (!allDevices || allDevices.length === 0) return;

        const endpointMap = {};
        for (const device of allDevices) {
          const endpoint = device.getStoreValue('linkEndpoint');
          const token = device.getStoreValue('token');
          if (!endpoint || !token) continue;

          if (!endpointMap[endpoint]) endpointMap[endpoint] = [];
          endpointMap[endpoint].push(device);
        }

        for (const endpoint in endpointMap) {
          const devices = endpointMap[endpoint];
          const token = devices[0].getStoreValue('token');
          let response;
          try {
            response = await axios.get(`${endpoint}/v42/home`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } catch (error) {
            if (error.response && error.response.data.code && error.response.data.code === "auth_forbidden_invalid_token") {
              try {
                const newToken = await this.getToken(devices[0].getStoreValue('linkId'));
                for (const device of devices) {
                  device.setStoreValue('token', newToken);
                }
                response = await axios.get(`${endpoint}/v42/home`, {
                  headers: { 'Authorization': `Bearer ${newToken}` }
                });
              } catch (err) {
                this.error('Error refreshing token:', err.message);
                for (const device of devices) {
                  device.setUnavailable("The HomeWizard Link server isn't responding");
                }
                continue;
              }
            } else {
              this.error(`Error fetching data from endpoint ${endpoint}:`, error.message);
              continue;
            }
          }

          const homeData = response.data;

          for (const device of devices) {
            const deviceInfo = homeData.devices.find(d => d.id === device.getStoreValue('deviceId'));
            if (!deviceInfo) continue;

            try {
              if (deviceInfo.type === "hw_contact_sensor") {
                await device.setCapabilityValue('alarm_contact', deviceInfo.state.status === "opened");
                await device.setCapabilityValue('alarm_tamper', deviceInfo.state.status === "tampered");
              } else if (deviceInfo.type === "hw_led_light_5ch") {
                if (deviceInfo.status === "out_of_reach") {
                  device.setUnavailable("The light is unreachable. Is it plugged in?");
                  continue;
                } else {
                  device.setAvailable();
                }
                const isOn = deviceInfo.state.status === "on";
                await device.setCapabilityValue('onoff', isOn);

                if (isOn && deviceInfo.state.color) {
                  const brightness = deviceInfo.state.color.brightness / 100;
                  const saturation = deviceInfo.state.color.saturation / 100;
                  const hue = deviceInfo.state.color.hue;

                  await device.setCapabilityValue('dim', brightness);

                  if (saturation === 0) {
                    const temperature = hue / 200;
                    await device.setCapabilityValue('light_temperature', temperature);
                    await device.setCapabilityValue('light_mode', 'temperature');
                  } else {
                    const hueNormalized = hue / 360;
                    await device.setCapabilityValue('light_hue', hueNormalized);
                    await device.setCapabilityValue('light_saturation', saturation);
                    await device.setCapabilityValue('light_mode', 'color');
                  }
                }
              }
            } catch (err) {
              device.setUnavailable("Something went wrong while updating the device");
              this.error(`Error updating device ${device.getName()}:`, err.message);
              continue;
            }
          }
        }

      } catch (err) {
        this.error('Polling error:', err.message);
      }
    }, 4000);
  }

};