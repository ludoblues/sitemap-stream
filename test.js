'use strict';

const exec = require('child_process').exec;
const fs = require('fs');
const zlib = require('zlib');
const WritableStream = require('readable-stream').Writable;

const expect = require('chai').expect;
const sinon = require('sinon');

describe('SitemapStream', () => {
  describe('#constructor', () => {
    context('With invalid conf', () => {
      it('should throw an error', () => {
        let err = '';

        try { require('./index')({ limit: 0 }); }
        catch(e) { err = e.message; }

        expect(err).to.be.equal('Invalid parameters: ');
      });
    });

    context('With no conf', () => {
      const sitemap = require('./index')();

      it('should have 50000 as limit', () => {
        expect(sitemap.limit).to.be.equal(50000);
      });

      it('should have isMobile as false', () => {
        expect(sitemap.isMobile).to.be.equal(false);
      });
    });

    context('With conf', () => {
      const sitemap = require('./index')({ limit: 10, isMobile: true });

      it('should have 10 as limit', () => {
        expect(sitemap.limit).to.be.equal(10);
      });

      it('should have isMobile as true', () => {
        expect(sitemap.isMobile).to.be.equal(true);
      });
    });
  });

  describe('#changeWriteStream', () => {
    context('It is the first sitemap we write', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
      });

      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should emit the stream error events', done => {
        sitemap.on('error', err => {
          expect(err).to.be.equal('broadcast the error');
          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.emit('error', 'broadcast the error');
      });

      it('should emit the stream drain events', done => {
        sitemap.on('drain', () => {
          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.emit('drain');
      });

      it('should not call #endOfFile', () => {
        sitemap.changeWriteStream();

        expect(sitemap.endOfFile.callCount).to.be.equal(0);
      });

      it('should have created the file', (done) => {
        sitemap.toCompress = false;

        sitemap.on('sitemap-created', (fileName) => {
          fs.lstat(fileName, done);
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should emit a done event when it is the last file to write', done => {
        sitemap.nbWrittenFiles = 1; // To simulate the sitemapindex file done
        sitemap.nbInjectedUrls = sitemap.limit - 1;
        sitemap.toCompress = false;

        sitemap.on('done', nbFiles => {
          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should not emit a done event when it is not the last file to write', done => {
        sitemap.nbInjectedUrls = sitemap.limit - 1;
        sitemap.toCompress = false;

        sitemap.on('done', nbFiles => {
          done('should not fire this event');
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();

        setTimeout(done, 1500);
      });

      it('should not the file contain the mobile header', (done) => {
        sitemap.toCompress = false;

        sitemap.on('sitemap-created', (fileName) => {
          const fileContent = fs.readFileSync(fileName);

          expect(fileContent.toString()).to.be.equal('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should emit a "sitemap-created" event when the sitemap is frozen', (done) => {
        sitemap.on('sitemap-created', (fileName) => {
          expect(fileName).to.be.equal('./sitemap-1.xml.gz');

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });
    });

    context('It is not the first sitemap we write', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap generator', () => {
        sitemap = require('./index')();
      });

      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should call #endOfFile', () => {
        sitemap.nbInjectedUrls = sitemap.limit;

        sitemap.changeWriteStream();

        expect(sitemap.endOfFile.callCount).to.be.equal(1);
      });
    });

    context('We are on mobile mod', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')({ isMobile: true });
      });

      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should add the mobile header', (done) => {
        sitemap.toCompress = false;

        sitemap.on('sitemap-created', (fileName) => {
          const fileContent = fs.readFileSync(fileName);

          expect(fileContent.toString()).to.be.equal('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">');

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });
    });

    context('We want to compress the generated sitemaps', (done) => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
      });

      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      afterEach('restore #compress stub', () => {
        if (typeof sitemap.compress.restore === 'undefined') return ;

        sitemap.compress.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should have created the file', (done) => {
        sitemap.on('sitemap-created', () => {
          const reader = fs.createReadStream('sitemap-1.xml.gz');
          const writer = fs.createWriteStream('sitemap-1.xml');

          expect(fs.lstatSync('sitemap-1.xml.gz').size).to.be.gt(0);
          expect(fs.lstatSync.bind('sitemap-1.xml.xml')).to.throw;

          const compressionStream = reader
            .pipe( zlib.createUnzip() )
            .pipe(writer);

          compressionStream.on('finish', () => {
            const fileContent = fs.readFileSync('sitemap-1.xml');

            expect(fileContent.toString()).to.be.equal('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

            done();
          });
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should emit a done event when it is the last file to write in compress mode', done => {
        sitemap.nbWrittenFiles = 1; // To simulate the sitemapindex file done
        sitemap.nbInjectedUrls = sitemap.limit - 1;
        sitemap.toCompress = true;

        sitemap.on('done', nbFiles => {
          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should not emit a done event when it is not the last file to write in compress mode', done => {
        sitemap.nbInjectedUrls = sitemap.limit - 1;
        sitemap.toCompress = true;

        sitemap.on('done', nbFiles => {
          done('should not fire this event');
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();

        setTimeout(done, 1500);
      });

      it('should emit an event if the compression fails', done => {
        sinon.stub(sitemap, 'compress', () => {
          sitemap.emit('error', 'compression failed');
        });

        sitemap.toCompress = true;
        sitemap.date = new Date().toISOString();

        sitemap.on('error', err => {
          expect(err).to.be.equal('compression failed');
          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });
    });
  });

  describe('#inject', () => {
    context('The entry format is invalid', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap-generator', () => {
        let sitemap = require('./index')();
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should return an error', () => {
        let errOne = '';
        let errTwo = '';

        try { sitemap.inject(); }
        catch (e) { errOne = e.message; }

        try { sitemap.inject([ '/some-path' ]); }
        catch (e) { errTwo = e.message; }

        expect(errOne).to.be.equal('Cannot read property \'url\' of undefined');
        expect(errTwo).to.be.equal('ValidationError: "value" must be an object');
      });
    });

    context('With no parameters', () => {
      let sitemap = require('./index')();
      const now = new Date().toISOString();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = 1;
        sitemap.date = now;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });


      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);
      });

      it('should inject the given url with required parameters only', (done) => {
        sitemap.writer.on('finish', () => {
          const fileContent = fs.readFileSync('test.xml');

          expect(fileContent.toString()).to.be.equal(`<url>\n<loc>/some-path</loc>\n<lastmod>${now}</lastmod>\n</url>\n`);

          done();
        });

        sitemap.inject('/some-path');

        sitemap.writer.end();
      });
    });

    context('With all parameters', () => {
      let sitemap = require('./index')();
      const now = new Date().toISOString();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')({ isMobile: true });
        sitemap.nbInjectedUrls = 1;
        sitemap.date = now;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should inject the given url with all parameters', (done) => {
        const entry = {
          url: '/some-path',
          changeFreq: 'monthly',
          priority: 0.9
        }

        sitemap.writer.on('finish', () => {
          const fileContent = fs.readFileSync('test.xml');

          expect(fileContent.toString()).to.be.equal(`<url>\n<loc>/some-path</loc>\n<lastmod>${now}</lastmod>\n<changefreq>monthly</changefreq>\n<priority>0.9</priority>\n<mobile:mobile/>\n</url>\n`);

          done();
        });

        sitemap.inject(entry);

        sitemap.writer.end();
      });
    });

    context('The url we inject is the last one before writing on another file', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = sitemap.limit - 1;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);
      });
    });

    context('This is the first url we inject', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap generator', () => {
        sitemap = require('./index')();
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should call #changeWriteStream', () => {
        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(1);
      });
    });

    context('We overcome the limit with this injection', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = sitemap.limit;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml*', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      afterEach('remove listeners', () => {
        sitemap.removeAllListeners();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(1);
      });
    });

    context('We inject after high watermark reached', () => {
      const limit = 20;
      const highWaterMark = 16;
      let sitemap;

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')({ limit });
      });

      beforeEach('stub #changeWriteStream and spy on #writer', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {
          sitemap.writer = new WritableStream({
            objectMode: true,
            highWaterMark,
            write: (chunk, encoding, callback) => {
              setTimeout(() => callback(), 0);
            }
          });

          sinon.spy(sitemap.writer, 'write');
        });
      });

      it('should create new sitemap writer even when some entries was buffered', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        for (let i = 1; i <= (highWaterMark * 2); i++) {
          const buffered = i >= highWaterMark && i <= limit;
          let written = sitemap.inject('http://example.com/path');

          expect(written).to.equal(!buffered);
        }

        expect(sitemap.changeWriteStream.callCount).to.be.equal(2);
        expect(sitemap.writer.write.callCount).to.be.equal(12);
      });
    });
  });

  describe('#generateIndexFile', () => {
    let sitemap = require('./index')();

    beforeEach('generate a new sitemap generator', () => {
      sitemap = require('./index')({
        sitemapDirectoryUrl: 'http://www.example.com'
      });
    });

    afterEach('should remove generated xml files', (done) => {
      exec('rm *.xml*', done.bind(null, null));
    });

    afterEach('restore #compress stub', () => {
      if (typeof sitemap.compress.restore === 'undefined') return ;

      sitemap.compress.restore();
    });

    afterEach('remove listeners', () => {
      sitemap.removeAllListeners();
    });

    it('should emit the stream error events', done => {
      sitemap.generateIndexFile();
      sitemap.on('done', () => {
        sitemap.on('error', err => {
          expect(err).to.be.equal('broadcast the error');
          done();
        });

        sitemap.writer.emit('error', 'broadcast the error');
      });
    });

    it('should emit the stream drain events', done => {
      sitemap.generateIndexFile();
      sitemap.on('done', () => {
        sitemap.on('drain', err => {
          done();
        });

        sitemap.writer.emit('drain');
      });
    });

    it('should emit an event "sitemapindex-created" when the sitemapindex is frozen', done => {
      sitemap.on('sitemapindex-created', () => {
        done();
      });

      sitemap.generateIndexFile();
    });

    it('should have created a sitemapindex file', done => {
      sitemap.toCompress = false;

      sitemap.on('sitemapindex-created', () => {
        fs.lstat('sitemapindex.xml', done);
      });

      sitemap.generateIndexFile();
    });

    it('should the sitemapindex file reference all the created sitemaps', (done) => {
      sitemap.nbInjectedUrls = sitemap.limit * 4;
      sitemap.date = new Date().toISOString();
      sitemap.toCompress = false;

      sitemap.on('sitemapindex-created', () => {
        const fileContent = fs.readFileSync('sitemapindex.xml');

        expect(fileContent.toString()).to.be.equal(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap>\n<loc>http://www.example.com/sitemap-1.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-2.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-3.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-4.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-5.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n`);

        done();
      });

      sitemap.generateIndexFile();
    });

    it('should emit a done event when it is the last file to write', done => {
      sitemap.nbWrittenFiles = 1; // To simulate the sitemap file done
      sitemap.nbInjectedUrls = sitemap.limit - 1;
      sitemap.toCompress = false;

      sitemap.on('done', nbFiles => {
        done();
      });

      sitemap.generateIndexFile();
    });

    it('should not emit a done event when it is not the last file to write', done => {
      sitemap.nbInjectedUrls = sitemap.limit - 1;
      sitemap.toCompress = false;

      sitemap.on('done', nbFiles => {
        done('should not fire this event');
      });

      sitemap.generateIndexFile();

      setTimeout(done, 1500);
    });

    it('should compress the file when asked in option', (done) => {
      sitemap.toCompress = true;

      sitemap.nbInjectedUrls = sitemap.limit * 4;
      sitemap.date = new Date().toISOString();

      sitemap.on('sitemapindex-created', () => {
        const reader = fs.createReadStream('sitemapindex.xml.gz');
        const writer = fs.createWriteStream('sitemapindex.xml');

        expect(fs.lstatSync('sitemapindex.xml.gz').size).to.be.gt(0);
        expect(fs.lstatSync.bind('sitemapindex.xml')).to.throw;

        const compressionStream = reader
          .pipe( zlib.createUnzip() )
          .pipe(writer);

        compressionStream.on('finish', () => {
          const fileContent = fs.readFileSync('sitemapindex.xml');

          expect(fileContent.toString()).to.be.equal(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap>\n<loc>http://www.example.com/sitemap-1.xml.gz</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-2.xml.gz</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-3.xml.gz</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-4.xml.gz</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-5.xml.gz</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n`);

          done();
        });
      });

      sitemap.generateIndexFile();
    });

    it('should emit a done event when it is the last file to write in compress mode', done => {
      sitemap.nbWrittenFiles = 1; // To simulate the sitemap file done
      sitemap.nbInjectedUrls = sitemap.limit - 1;
      sitemap.toCompress = true;

      sitemap.on('done', nbFiles => {
        done();
      });

      sitemap.generateIndexFile();
    });

    it('should not emit a done event when it is not the last file to write in compress mode', done => {
      sitemap.nbInjectedUrls = sitemap.limit - 1;
      sitemap.toCompress = true;

      sitemap.on('done', nbFiles => {
        done('should not fire this event');
      });

      sitemap.generateIndexFile();

      setTimeout(done, 1500);
    });

    it('should emit an event if the compression fails', done => {
      sinon.stub(sitemap, 'compress', () => {
        sitemap.emit('error', 'compression failed');
      });

      sitemap.toCompress = true;

      sitemap.nbInjectedUrls = sitemap.limit * 4;
      sitemap.date = new Date().toISOString();

      sitemap.on('error', err => {
        expect(err).to.be.equal('compression failed');
        done();
      });

      sitemap.generateIndexFile();
    });
  });

  describe('#reset', () => {
    let sitemap = require('./index')();

    beforeEach('Override parameters', () => {
      sitemap.nbInjectedUrls = 1000;
      sitemap.isInjectOver = true;
      sitemap.writer = { foo: 'bar' };
    });

    it('should reset the #isInjectOver', () => {
      expect(sitemap.isInjectOver).to.be.equal(true);

      sitemap.reset();

      expect(sitemap.isInjectOver).to.be.equal(false);
    });

    it('should reset the #nbInjectedUrls', () => {
      expect(sitemap.nbInjectedUrls).to.be.equal(1000);

      sitemap.reset();

      expect(sitemap.nbInjectedUrls).to.be.equal(0);
    });

    it('should reset the #writer', () => {
      expect(sitemap.writer).to.be.eql({ foo: 'bar' });

      sitemap.reset();

      expect(sitemap.writer).to.be.eql({});
    });
  });

  describe('#endOfFile', () => {
    let sitemap = require('./index')();

    beforeEach('generate a new sitemap generator', () => {
      sitemap = require('./index')();
    });

    beforeEach('create a writable stream', () => {
      sitemap.writer = fs.createWriteStream(`test.xml`);
    });

    afterEach('should remove generated xml files', (done) => {
      exec('rm *.xml*', done.bind(null, null));
    });

    afterEach('remove listeners', () => {
      sitemap.removeAllListeners();
    });

    it('should close the urlset element', (done) => {
      sitemap.writer.on('finish', () => {
        const fileContent = fs.readFileSync('test.xml');

        expect(fileContent.toString()).to.be.equal('</urlset>');

        done();
      });

      sitemap.endOfFile();
    });
  });

  describe('#done', () => {
    const sitemap = require('./index')();

    beforeEach('mute & spy #endOfFile', () => {
      sinon.stub(sitemap, 'endOfFile', () => {});
    });

    beforeEach('mute & spy #generateIndexFile', () => {
      sinon.stub(sitemap, 'generateIndexFile', () => {});
    });

    afterEach('restore #endOfFile spy', () => {
      sitemap.endOfFile.restore();
    });

    afterEach('restore #generateIndexFile spy', () => {
      sitemap.generateIndexFile.restore();
    });

    afterEach('remove listeners', () => {
      sitemap.removeAllListeners();
    });

    it('should call #endOfFile', () => {
      expect(sitemap.endOfFile.callCount).to.be.equal(0);

      sitemap.done();

      expect(sitemap.endOfFile.callCount).to.be.equal(1);
    });

    it('should call #generateIndexFile', () => {
      expect(sitemap.generateIndexFile.callCount).to.be.equal(0);

      sitemap.done();

      expect(sitemap.generateIndexFile.callCount).to.be.equal(1);
    });
  });
});
