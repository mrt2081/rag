'use strict';

const { OpenAI } = require('openai');

module.exports = {
  /**
   * Checks if the OpenAI API is responsive.
   * Sends a small prompt using the cheapest model and updates the ACTIVE_MODEL_PROVIDER setting.
   */
  async checkOpenAIStatus() {
    try {
      // Retrieve OpenAI configuration from settings
      const openAiConfig = await strapi
        .service('api::setting.setting')
        .getSetting('OPENAI_CONFIG');

      if (!openAiConfig || !openAiConfig.API_KEY || !openAiConfig.API_BASE) {
        throw new Error('OpenAI configuration is missing');
      }

      // Initialize OpenAI API client
      const openai = new OpenAI({
        apiKey: openAiConfig.API_KEY,
      });

      // Send request to OpenAI API
      const response = await openai.chat.completions.create({
        model: openAiConfig.PING_MODEL || 'gpt-4o-mini', // Use a cheap model
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 5,
      });
      // Check if the response is valid
      if (response && response.choices) {
        // Update the ACTIVE_MODEL_PROVIDER setting to OpenAI
        await strapi
          .service('api::setting.setting')
          .updateSetting('ACTIVE_MODEL_PROVIDER', 'OpenAI');
        console.log('OpenAI is responsive. ACTIVE_MODEL_PROVIDER set to OpenAI.');
      } else {
        throw new Error('Invalid response from OpenAI');
      }
    } catch (error) {
      console.error('Error checking OpenAI status:', error.message);

      // Update the ACTIVE_MODEL_PROVIDER setting to Gemeni
      await strapi
        .service('api::setting.setting')
        .updateSetting('ACTIVE_MODEL_PROVIDER', 'Gemeni');
      console.log('OpenAI is not responsive. ACTIVE_MODEL_PROVIDER set to Gemeni.');
    }
  },
};
