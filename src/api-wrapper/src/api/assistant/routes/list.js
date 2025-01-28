'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/assistants',
      handler: 'assistant.list',
      config: {
        prefix: '',
        policies: [],
      },
    }
  ],
};
