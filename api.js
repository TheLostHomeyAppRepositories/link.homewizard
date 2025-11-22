const axios = require('axios');

module.exports = {
  async getLinksData({ homey }) {
    return await homey.app.getAllLinksData();
  },

  async send({ homey, body }) {
    try {
      const { message, linkId, linkName, data } = body;

      if (!message || !data) {
        throw new Error('Missing required fields');
      }

      const response = await axios.post('https://device-support-requests.vercel.app/api/send-report', {
        message: message,
        app: 'HomeWizard Link',
        report: {
          linkId: linkId,
          linkName: linkName,
          data: data
        }
      });

      return {
        success: true,
        id: response.data.id
      };
    } catch (error) {
      homey.app.error('Error sending to support:', error.message);
      throw new Error(error.response?.data?.error || error.message);
    }
  }
};