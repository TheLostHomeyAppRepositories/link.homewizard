'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class HomeWizardLinkApp extends Homey.App {

  async onInit() {
    this.log('HomeWizard Link has been initialized');
    this.startPolling();
    
    // Register API endpoint for settings page
    this.homey.api.realtime('links-data-update', null);
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
      this.error('Error fetching token:', error.message);
      if (error.response && error.response.status === 401) {
        device.setUnavailable(this.homey.__("errors.login"));
        return;
      }
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

  async controlWhiteLight(device, state) {
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
        
      
        color.hue = Math.round(state.hue * 200);
        color.saturation = 0;
        
        if (state.dim !== undefined) {
          color.brightness = Math.round(state.dim * 100);
        }

        payload.color = color;
      }

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

  async getAllLinksData() {
    try {
      const email = this.homey.settings.get('email');
      const password = this.homey.settings.get('password');
      
      if (!email || !password) {
        return { error: 'No credentials found. Please pair a device first.' };
      }

      const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
      
      // Get all available links
      const devicesResponse = await axios.get('https://api.homewizardeasyonline.com/v1/auth/devices', {
        headers: { 'Authorization': `${basicAuth}` }
      });
      
      const links = devicesResponse.data.devices.filter(d => d.type === "link");
      
      if (links.length === 0) {
        return { error: 'No Links found in your account.' };
      }

      // Fetch data from each link
      const linksData = await Promise.all(links.map(async (link) => {
        try {
          // Get token for this link
          const tokenResponse = await axios.post('https://api.homewizardeasyonline.com/v1/auth/token', {
            device: link.identifier
          }, {
            headers: { 'Authorization': `${basicAuth}` }
          });
          
          const token = tokenResponse.data.token;
          
          // Get home data
          const homeResponse = await axios.get(`${link.endpoint}/v42/home`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          return {
            id: link.identifier,
            name: link.name,
            endpoint: link.endpoint,
            data: homeResponse.data
          };
        } catch (error) {
          this.error(`Error fetching data for link ${link.identifier}:`, error.message);
          return {
            id: link.identifier,
            name: link.name,
            endpoint: link.endpoint,
            error: error.message
          };
        }
      }));

      return { links: linksData };
    } catch (error) {
      this.error('Error in getAllLinksData:', error.message);
      return { error: error.message };
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
                  device.setUnavailable(this.homey.__("errors.token"));
                }
                continue;
              }
            } else {
              this.error(`Error fetching data from endpoint ${endpoint}:`, error.message);
              for (const device of devices) {
                device.setUnavailable(this.homey.__("errors.linkoffline"));
              }
              continue;
            }
          }

          const homeData = response.data;

          for (const device of devices) {
            const deviceInfo = homeData.devices.find(d => d.id === device.getStoreValue('deviceId'));
            if (!deviceInfo) continue;

            try {
              if (deviceInfo.type === "hw_contact_sensor") {
                device.setAvailable();
                await device.setCapabilityValue('alarm_contact', deviceInfo.state.status === "opened");
                await device.setCapabilityValue('alarm_tamper', deviceInfo.state.status === "tampered");
              } else if (deviceInfo.type === "sw_leak_detector") {
                device.setAvailable();
                await device.setCapabilityValue('alarm_water', deviceInfo.state.status !== "ok" && deviceInfo.state.status !== "tested");
              } else if (deviceInfo.type === "sw_smoke_detector") {
                device.setAvailable();
                await device.setCapabilityValue('alarm_smoke', deviceInfo.state.status !== "ok" && deviceInfo.state.status !== "tested");
              } else if (deviceInfo.type === "hw_led_light_5ch") {
                if (deviceInfo.status === "out_of_reach") {
                  device.setUnavailable(this.homey.__("errors.unreachable"));
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
              } else if (deviceInfo.type === "hw_led_light_2ch") {
                if (deviceInfo.status === "out_of_reach") {
                  device.setUnavailable(this.homey.__("errors.unreachable"));
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
                  const temperature = hue / 200;
                  await device.setCapabilityValue('light_temperature', temperature);
                }
              }
            } catch (err) {
              device.setUnavailable(this.homey.__("errors.generic"));
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