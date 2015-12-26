'use strict';

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

const Joi = require('joi');

const schemas = require('./schemas');

class SitemapStream extends EventEmitter {
  constructor(conf) {
    super();

    this.hostname = conf.hostname;
    this.date = conf.date;
    this.limit = conf.limit;
    this.isMobile = conf.isMobile;

    this.nbInjectedUrls = 0;
    this.writer = {};
  }

  changeWriteStream() {
    const nbFile = (this.nbInjectedUrls / this.limit) + 1;

    if (nbFile > 1) this.endOfFile();

    this.writer = fs.createWriteStream(`sitemap-${nbFile}.xml`);

    this.writer.on('finish', () => {
      this.emit('sitemap-created', `sitemap-${nbFile}.xml`);
    });

    this.writer.on('error', this.emit);
    this.writer.on('drain', this.emit);

    let mobileHeader = this.isMobile ? ' xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"' : '';
    let header = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${mobileHeader}>`;

    this.writer.write(header);
  }

  inject(entry) {
    if (typeof entry === 'string') entry = { url: entry };

    const validation = Joi.validate(entry, schemas.entry);
    if (validation.error) throw new Error(validation.error);

    if (!this.nbInjectedUrls || this.nbInjectedUrls % this.limit === 0) this.changeWriteStream();

    const loc = `<loc>${this.hostname}${entry.url}</loc>\n`;
    const lastMod = `<lastmod>${this.date}</lastmod>\n`;
    const changeFreq = entry.changeFreq ? `<changefreq>${entry.changeFreq}</changefreq>\n` : '';
    const priority = entry.priority ? `<priority>${entry.priority}</priority>\n` : '';
    const mobile = this.isMobile ? '<mobile:mobile/>\n' : '';

    this.writer.write(`${loc}${lastMod}${changeFreq}${priority}${mobile}`);

    this.nbInjectedUrls++;
  }

  generateIndexFile() {
    this.writer = fs.createWriteStream('sitemapindex.xml');

    this.writer.on('error', this.emit);
    this.writer.on('drain', this.emit);

    this.writer.on('finish', () => {
      this.emit('sitemapindex-created');
    });

    this.writer.write('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    const nbSitemaps = (this.nbInjectedUrls / this.limit) + 1;
    for (let i=1; i<=nbSitemaps; i++) this.writer.write(`<sitemap>\n<loc>http://www.example.com/sitemap-${i}.xml</loc>\n<lastmod>${this.date}</lastmod>\n</sitemap>\n`);

    this.writer.end();
  }

  endOfFile() {
    this.writer.write('</urlset>');
    this.writer.end();
  }

  done() {
    this.endOfFile();
    
    this.generateIndexFile();
  }
}

module.exports = (conf) => {
  const valideConf = Joi.validate(conf || {}, schemas.config);

  if (valideConf.error) throw new Error('Invalid parameters: ', valideConf.error);

  return new SitemapStream(valideConf.value);
};
