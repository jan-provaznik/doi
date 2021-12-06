/* 2021 Jan Provaznik (provaznik@optics.upol.cz)
 *
 * Uses the mithril.js library.
 * Interfaces the api.crossref.org.
 */

const em = window.m;

const API_PREFIX = 'https://api.crossref.org/works/';
const API_SUFFIX = '/transform/application/x-bibtex';
const TAB_SPACES = '  ';

/* Bootstrap the interactive application. */

window.addEventListener('load', function (event) {
  em.mount(document.querySelector('.resolver'), ComponentResolver);
});

/* Interfacing the api.crossref.org */

function resolveDoi (what) {
  let path = API_PREFIX + what + API_SUFFIX;
  return window
    .fetch(path)
    .then(response => {
      return response
        .text()
        .then(content => {
          return {
            success : response.ok,
            bib : processBib(content),
            doi : what
          };
        });
    });
}

function processBib (text) {
  let next = text
    .replace(/^(@[^\{]+\{)([^,]+)/, rewriteBibHeader)
    .replace(/\t/g, TAB_SPACES);
  
  return window
    .decodeURIComponent(next);
}

function rewriteBibHeader (match, recordType, recordName) {
  return recordType + recordName.replace(/_/g, '').toLowerCase();
}

/* Application logic. */

class ComponentResolver {

  viewControls () {
    return em('.column.control', [
      em('textarea.row', { 
        oninput     : this.handleTextareaInput.bind(this),
        disabled    : this.isWorking,
        placeholder : 'Enter line-separated DOI names.'
      }, this.textareaValue),
      em('.row.apart', [
        em('button', {
          onclick     : this.handleButtonResolve.bind(this),
          disabled    : this.isWorking
        }, this.isWorking ? 'retrieving...' : 'retrieve biblatex entries'),
        this.isWorking ? em('.loading') : []
      ])
    ]);
  }

  handleTextareaInput (event) {
    this.textareaValue = event.target.value;
  }

  handleButtonResolve (event) {
    this.isWorking = true;
    this.requestQueue = processLines(this.textareaValue);
    this.resolvedRecords = [];

    this.processQueue();
  }

  viewResults () {
    return em('.column.results', [
      this.viewResultsButtons(),
      this.resolvedRecords.map(record => {
        if (record.success) {
          return em('pre', record.bib)
        }

        return em('pre.failed', 'Could not resolve [' + record.doi + ']');
      })
    ]);
  }

  viewResultsButtons () {
    let disable = this.isWorking || !this.resolvedRecords.filter(record => record.success).length;
    return em('.buttons.row.together', [
      em('button', {
        onclick   : this.handleButtonClipboard.bind(this),
        disabled  : disable
      }, 'Copy results to cliboard'),
      em('button', {
        onclick   : this.handleButtonWindow.bind(this),
        disabled  : disable
      }, 'Open results in new window'),
      em('button.highlight', {
        onclick   : this.handleButtonDownload.bind(this),
        disabled  : disable
      }, 'Download results')
    ]);
  }

  handleButtonClipboard () {
    let text = this.createRecordsText();
    navigator.clipboard.writeText(text);
  }

  handleButtonWindow () {
    let url = this.createRecordsURL();
    let win = window.open(url, '_blank');

    let timer = window.setInterval(nil => {
      if (win.closed) {
        URL.revokeObjectURL(url);
        window.clearInterval(timer);

        console.log('handleButtonWindow housekeeping: freed URL')
      }
    }, 1000);
  }

  handleButtonDownload () {
    let url = this.createRecordsURL();
    let elm = document.createElement('a');

    elm.style.display = 'none';
    elm.download = 'db.bib';
    elm.href = url;

    document.body.appendChild(elm)
    elm.click();

    window.setTimeout(nil => {
      URL.revokeObjectURL(url);
      document.body.removeChild(elm);

      console.log('handleButtonDownload housekeeping: freed URL')
    }, 1000);

  }

  view () {
    return em('.row', [
      this.viewControls(),
      this.viewResults(),
    ]);
  }

  constructor (vnode) {
    this.isWorking = false;
    this.resolvedRecords = [];
    this.requestQueue = [];
    this.textareaValue = '';

    /*
    this.resolvedRecords = [
      { success: true, doi: 'test/1', bib: '@article{test1, doi = {test/1}}' },
      { success: true, doi: 'test/2', bib: '@article{test2, doi = {test/2}}' },
      { success: true, doi: 'test/3', bib: '@article{test3, doi = {test/3}}' },
    ]
    */
  }

  /* Record retrieval. */

  processQueue () {
    if (this.requestQueue.length == 0) {
      this.isWorking = false;
      em.redraw();
      return;
    }

    let what = this.requestQueue.shift();

    resolveDoi(what)
      .then(record => this.resolvedRecords.push(record))
      .catch(error => console.error(error))
      .finally(nil => {
        em.redraw();
        schedule50ms(this.processQueue.bind(this))
      });
  }

  /* Record serialization. */

  createRecordsText () {
    return this.resolvedRecords
      .filter(record => record.success)
      .map(record => record.bib)
      .join('\n\n');
  }

  createRecordsBlob () {
    return new Blob([ this.createRecordsText() ], { type : 'text/plain' });
  }

  createRecordsURL () {
    return URL.createObjectURL(this.createRecordsBlob());
  }

}

/* Utility. */

function processLines (blob) {
  return (blob ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      let match;

      if (match = line.match(/doi\.org\/([^\s]+)$/)) {
        line = match[1];
      }

      return line.trim();
    });
}

/* Rudimentary rate limiting (keeps ~ 20 requests / second). */

function schedule50ms (callback) {
  return window
    .setTimeout(callback, 50);
}
