'use strict';

const Joi = require('joi');

module.exports = {
  config: Joi.object({
    sitemapDirectoryUrl: Joi.string().uri().default(''),
    date: Joi.date().iso().default(new Date().toISOString()),
    limit: Joi.number().integer().min(1).default(50000),
    isMobile: Joi.boolean().default(false),
    outputFolder: Joi.string().default('./'),
    toCompress: Joi.boolean().default(true)
  }),

  entry: Joi.object({
    url: Joi.string().required(),
    changeFreq: Joi.string(),
    priority: Joi.number().min(0).max(1)
  })
};
