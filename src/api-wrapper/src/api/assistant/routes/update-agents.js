'use strict';

module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/assistants/:id/update-agents',
      handler: 'assistant.updateAgents',
      config: {
        prefix: '',
        policies: [],
      },
    },
  ],
};
