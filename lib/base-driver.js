'use strict';

const Homey = require('homey');
const axios = require('axios');

/**
 * Base driver class with shared pairing logic for all HomeWizard devices
 */
module.exports = class BaseHomeWizardDriver extends Homey.Driver {

  /**
   * Override this method in child classes to specify the device type filter
   * @returns {string} The device type to filter (e.g., "hw_contact_sensor", "hw_light")
   */
  getDeviceType() {
    throw new Error('getDeviceType() must be implemented by child class');
  }

  /**
   * Override this method in child classes to map device data to Homey device format
   * @param {Object} device - The device data from the API
   * @param {string} linkId - The link identifier
   * @param {string} linkEndpoint - The link endpoint URL
   * @param {string} token - The authentication token
   * @returns {Object} Homey device object with name, data, and store properties
   */
  mapDeviceData(device, linkId, linkEndpoint, token) {
    return {
      name: device.name,
      data: {
        id: device.code,
      },
      store: {
        linkId: linkId,
        linkEndpoint: linkEndpoint,
        deviceId: device.id,
        token: token,
      },
    };
  }

  async onInit() {
    this.log(`${this.constructor.name} has been initialized`);
  }

  async onPair(session) {
    session.setHandler("showView", async (viewId) => {
      if (viewId === 'select_link') {
        try {
          const loggedIn = this.homey.settings.get('loggedIn');
          const data = {
            email: this.homey.settings.get('email'),
            password: this.homey.settings.get('password'),
          };
          if (loggedIn) {
            const email = data.email;
            const password = data.password;
            if (!data.email || !data.password) {
              throw new Error("Email or password not found in storage.");
            }
            const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
            const response = await axios.get('https://api.homewizardeasyonline.com/v1/auth/devices', {
              headers: {
                'Authorization': `${basicAuth}`
              }
            });
            const links = response.data.devices.filter(d => d.type === "link");
            if (links.length === 1) {
              this.homey.settings.set('selectedLinkId', links[0].identifier);
              this.homey.settings.set('selectedLinkEndpoint', links[0].endpoint);
              await session.showView('list_devices');
            } else {
              return;
            }
          }
        } catch (error) {
          throw new Error("Error while checking Links: " + error.message);
        }
      } else if (viewId === 'login') {
        try {
          const loggedIn = this.homey.settings.get('loggedIn');
          if (loggedIn) {
            await session.showView('select_link');
          }
        } catch (error) {
          throw new Error("Error while checking login status in storage: " + error.message);
        }
      }
    });

    session.setHandler("getLinks", async (data) => {
      try {
        const email = this.homey.settings.get('email');
        const password = this.homey.settings.get('password');
        if (!email || !password) {
          throw new Error("Email or password not found in storage.");
        }
        const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
        const response = await axios.get('https://api.homewizardeasyonline.com/v1/auth/devices', {
          headers: {
            'Authorization': `${basicAuth}`
          }
        });
        const links = response.data.devices.filter(d => d.type === "link");
        if (links.length === 0) {
          return { error: "nolinks" };
        }
        return {
          links: links.map(link => ({
            id: link.identifier,
            endpoint: link.endpoint,
            name: link.name
          }))
        };
      } catch (error) {
        throw new Error("Error while fetching links: " + error.message);
      }
    });

    session.setHandler("login", async (data) => {
      try {
        const email = data.email;
        const password = data.password;
        if (!data.email || !data.password) {
          return false;
        }
        const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
        const response = await axios.get('https://api.homewizardeasyonline.com/v1/auth/devices', {
          headers: {
            'Authorization': `${basicAuth}`
          }
        });
        this.homey.settings.set('email', email);
        this.homey.settings.set('password', password);
        this.homey.settings.set('loggedIn', true);
        await session.showView('select_link');
        return true;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          return false;
        }
        throw new Error("Error during login check: " + error.message);
      }
    });

    session.setHandler("selected", async (data) => {
      try {
        const id = data.id;
        const endpoint = data.endpoint;
        if (!id || !endpoint) {
          return false;
        }
        this.homey.settings.set('selectedLinkId', id);
        this.homey.settings.set('selectedLinkEndpoint', endpoint);
        await session.showView('list_devices');
        return true;
      } catch (error) {
        throw new Error("Error during link selection: " + error.message);
      }
    });

    session.setHandler("list_devices", async () => {
      try {
        return await this.onPairListDevices();
      } catch (error) {
        throw new Error("Error while fetching devices: " + error.message);
      }
    });
  }

  async onRepair(session,device) {
    session.setHandler("login", async (data) => {
      try {
        const email = data.email;
        const password = data.password;
        if (!data.email || !data.password) {
          return false;
        }
        const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
        const response = await axios.get('https://api.homewizardeasyonline.com/v1/auth/devices', {
          headers: {
            'Authorization': `${basicAuth}`
          }
        });
        this.homey.settings.set('email', email);
        this.homey.settings.set('password', password);
        this.homey.settings.set('loggedIn', true);
        await session.done();
        return true;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          return false;
        }
        throw new Error("Error during API key check: " + error.message);
      }
    });
  }

  async onPairListDevices() {
    try {
      const id = this.homey.settings.get('selectedLinkId');
      const endpoint = this.homey.settings.get('selectedLinkEndpoint');
      if (!id || !endpoint) {
        return [];
      }
      const email = this.homey.settings.get('email');
      const password = this.homey.settings.get('password');
      const basicAuth = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
      
      const tokenResponse = await axios.post('https://api.homewizardeasyonline.com/v1/auth/token', {
        device: id
      }, {
        headers: {
          'Authorization': `${basicAuth}`
        }
      });
      
      const token = tokenResponse.data.token;
      
      const homeResponse = await axios.get(`${endpoint}/v42/home`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const deviceType = this.getDeviceType();
      const devices = homeResponse.data.devices.filter(d => d.type === deviceType);
      
      if (devices.length === 0 || !devices) {
        return [];
      }
      
      return devices.map(device => this.mapDeviceData(device, id, endpoint, token));
    } catch (error) {
      this.error('Error in onPairListDevices:', error.message);
      return [];
    }
  }
};