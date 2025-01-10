'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();
  };
};
