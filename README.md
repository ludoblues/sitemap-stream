[![Build Status](https://travis-ci.org/ludoblues/sitemap-stream.svg?branch=master)](https://travis-ci.org/ludoblues/sitemap-stream)
[![Coverage Status](https://coveralls.io/repos/ludoblues/sitemap-stream/badge.svg?branch=master&service=github)](https://coveralls.io/github/ludoblues/sitemap-stream?branch=master)

# sitemap-stream

SitemapStream is a simple and fast tool that build sitemaps using streams.  
It automatically creates separated files, following the [Google specifications](https://support.google.com/webmasters/topic/4581190?hl=en&ref_topic=4581352)

You can find information about the sitemap's syntax [here](http://www.sitemaps.org/protocol.html) (you'll find the authorized values the #inject method can receive).

*Notes:*
- This package respects the [semver](http://semver.org/) and the [keep a changelog](http://keepachangelog.com/) specifications.
- This module's code is using ES6 features, so you'll probably need to run your application with the flag --harmony (depending to your Node version).

## Install
npm i sitemap-stream

## Methods
#### SitemapStream#Constructor(options):
```js
{
  sitemapDirectoryUrl: String,
  limit: Number, // (default: 50000)
  isMobile: Boolean, // (default: false)
  outputFolder: String // (default: './')
  toCompress: Boolean // (default: true)
}
```

#### SitemapStream#inject(url || options)
Url Case:
```js
// The url
```

Options Case:

````js
{
  url: String, // (required)
  changeFreq: String,
  priority: String
}
````

#### SitemapStream#reset
Useful if you want to start writing a new sitemap using the same SitemapStream instance


## Events

SitemapStream use streams, so it emit events to let you know what happens.
Here are the events you can listen to:

####  error
````js
sg.on('error', err => {
  console.error(`Something wrong happened: ${err}`);
});
````
####  drain
````js
let i = 0;

function injectUrls() {
  while (i<1000000) {
    const isInjected = sg.inject(`http://test-${i}.com`);

    if (!isInjected) return i;

    i++;
  }
}

sg.on('drain', () => {
  console.info(`Because we have injected a big amount of lines in a short time, the stream could need to be drained, in this case, the sg#inject method returns false and the drain event is emitted when the stream is ready to write again`);

  injectUrls();
});

injectUrls();
````

####  sitemap-created
````js
sg.on('sitemap-created', path => {
  console.info(`A sitemap file has just been written here: ${path}`);
});
````

####  sitemap-index
````js
sg.on('sitemap-index', path => {
  console.info(`A sitemapindex file has just been written here: ${path}`);
});
````

####  done
````js
sg.on('done', nbFiles => {
  console.info(`The job is done, we have written ${nbFiles} files !`);
});
````

## Examples

Basic
```` js
  const sg = require('sitemap-stream')();

  sg.inject('/some-path');

  sg.inject({ url: '/another-path' });

  sg.inject({ url: '/my-last-path', changeFreq: 'daily', priority: 0.7 });

  sg.done();
````

With options
```` js
  const sg = require('sitemap-stream')({ isMobile: true });

  sg.inject('/some-path');

  sg.inject({ url: '/another-path' });

  sg.inject({ url: '/my-last-path', changeFreq: 'daily', priority: 0.7 });

  sg.done();
````

With Events
```` js
  const sg = require('sitemap-stream')();

  sg.on('sitemap-created', (fileName) => {
    // This listener will be trigger twice, one when the first 50 000 urls will be injected, and another time when you'll call the #done method  
    console.log('A sitemap has been created !');
  });

  sg.on('sitemapindex-index', () => {
    // When  listener will be trigger once the sitemapindex file will be written
    console.log('The sitemapindex has been created, we are done !');
  });

  sg.on('done', () => {
    console.info('Everything is done !');
  });

  for (let i=0; i<60000; i++) sg.inject(`/some-path-${i}`);

  sg.done();
````
