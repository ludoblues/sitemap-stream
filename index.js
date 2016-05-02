'use strict';

const fs = require('fs');
const url = require('url');
const EventEmitter = require('events').EventEmitter;
const zlib = require('zlib');

const Joi = require('joi');

const schemas = require('./schemas');

class SitemapStream extends EventEmitter {
  constructor(conf) {
    super();

    this.sitemapDirectoryUrl = conf.sitemapDirectoryUrl;
    this.date = conf.date;
    this.limit = conf.limit;
    this.isMobile = conf.isMobile;
    this.outputFolder = conf.outputFolder;
    this.toCompress = conf.toCompress;

    this.nbInjectedUrls = 0;
    this.writer = {};

    this.nbWrittenFiles = 0;
    this.isInjectOverver = false;
  }

  compress(path, done) {
    const reader = fs.createReadStream(path);
    const writer = fs.createWriteStream(`${path}.gz`);

    const compressionStream = reader
      .pipe(zlib.createGzip())
      .pipe(writer);

    compressionStream.on('finish', () => {
      fs.unlink(path, done);
    });
  }

  changeWriteStream() {
    const nbFile = Math.floor(this.nbInjectedUrls / this.limit) + 1;

    if (nbFile > 1) this.endOfFile();

    this.writer = fs.createWriteStream(`${this.outputFolder}sitemap-${nbFile}.xml`);

    this.writer.on('finish', () => {
      if (!this.toCompress) {
        this.nbWrittenFiles++;

        this.emit('sitemap-created', `${this.outputFolder}sitemap-${nbFile}.xml`);

        if (this.nbWrittenFiles === Math.ceil(this.nbInjectedUrls / this.limit)+1) this.emit('done', this.nbWrittenFiles);

        return ;
      }

      this.compress(`${this.outputFolder}sitemap-${nbFile}.xml`, err => {
        if (err) return this.emit('error', err);

        this.nbWrittenFiles++;

        this.emit('sitemap-created', `${this.outputFolder}sitemap-${nbFile}.xml.gz`);

        if (this.nbWrittenFiles === Math.ceil(this.nbInjectedUrls / this.limit)+1) this.emit('done', this.nbWrittenFiles);
      });
    });

    this.writer.on('error', err => {
      this.emit('error', err);
    });

    this.writer.on('drain', () => {
      this.emit('drain', this.nbInjectedUrls);
    });

    let mobileHeader = this.isMobile ? ' xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"' : '';
    let header = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${mobileHeader}>`;

    this.writer.write(header);
  }

  inject(entry) {
    if (typeof entry === 'string') entry = { url: entry };

    const validation = Joi.validate(entry, schemas.entry);
    if (validation.error) throw new Error(validation.error);

    if (!this.nbInjectedUrls || this.nbInjectedUrls % this.limit === 0) this.changeWriteStream();

    const loc = `<loc>${entry.url}</loc>\n`;
    const lastMod = `<lastmod>${this.date}</lastmod>\n`;
    const changeFreq = entry.changeFreq ? `<changefreq>${entry.changeFreq}</changefreq>\n` : '';
    const priority = entry.priority ? `<priority>${entry.priority}</priority>\n` : '';
    const mobile = this.isMobile ? '<mobile:mobile/>\n' : '';

    const isWritten = this.writer.write(`<url>\n${loc}${lastMod}${changeFreq}${priority}${mobile}</url>\n`);

    this.nbInjectedUrls++;

    return isWritten;
  }

  generateIndexFile() {
    this.writer = fs.createWriteStream(`${this.outputFolder}sitemapindex.xml`);

    this.writer.on('error', err => {
      this.emit('error', err);
    });

    this.writer.on('drain', () => {
      this.emit('drain', this.nbInjectedUrls);
    });

    this.writer.on('finish', () => {
      if (!this.toCompress) {
        this.nbWrittenFiles++;

         this.emit('sitemapindex-created', `${this.outputFolder}sitemapindex.xml`);

         if (this.nbWrittenFiles === Math.ceil(this.nbInjectedUrls / this.limit)+1) this.emit('done', this.nbWrittenFiles);

         return ;
       }

      this.compress(`${this.outputFolder}sitemapindex.xml`, err => {
        if (err) return this.emit('error', err);

        this.nbWrittenFiles++;

        this.emit('sitemapindex-created', `${this.outputFolder}sitemapindex.xml.gz`);

        if (this.nbWrittenFiles === Math.ceil(this.nbInjectedUrls / this.limit)+1) this.emit('done', this.nbWrittenFiles);
      });
    });

    this.writer.write('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    const nbSitemaps = (this.nbInjectedUrls / this.limit) + 1;
    for (let i=1; i<=nbSitemaps; i++) {
      const ext = this.toCompress ? 'xml.gz' : 'xml';
      const loc = url.resolve(this.sitemapDirectoryUrl, `sitemap-${i}.${ext}`);

      this.writer.write(`<sitemap>\n<loc>${loc}</loc>\n<lastmod>${this.date}</lastmod>\n</sitemap>\n`);
    }

    this.writer.end();
  }

  reset() {
    this.isInjectOver = false;
    this.nbInjectedUrls = 0;
    this.writer = {};
  }

  endOfFile() {
    this.writer.write('</urlset>');
    this.writer.end();
  }

  done() {
    this.isInjectOver = true;

    this.endOfFile();

    this.generateIndexFile();
  }
}

module.exports = conf => {
  const valideConf = Joi.validate(conf || {}, schemas.config);

  if (valideConf.error) throw new Error('Invalid parameters: ', valideConf.error);

  return new SitemapStream(valideConf.value);
};
