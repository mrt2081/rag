'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/containers/chat',
      handler: 'container.chat',
      config: {
        prefix: '',
        policies: [],
      },
    }
  ],
};
